import json
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from database import get_conn

router = APIRouter()


class ResourceCreate(BaseModel):
    type: str = Field(default="expression")
    name: str
    zh_goal: str = ""
    pattern: str
    items: list[str] = Field(default_factory=list)
    task_type: str = "task2"
    source_essay_id: str | None = None


def _normalize_type(resource_type: str) -> str:
    if resource_type not in ("pattern", "collocation", "expression"):
        return "expression"
    return resource_type


@router.get("/api/resources")
def list_resources(
    type: Optional[str] = Query(None),
    mastery: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = get_conn()
    conditions: list[str] = []
    params: list = []

    if type:
        conditions.append("type = ?")
        params.append(type)
    if mastery:
        conditions.append("mastery = ?")
        params.append(mastery)
    if task_type:
        conditions.append("task_types_json LIKE ?")
        params.append(f'%"{task_type}"%')

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = db.execute(
        f"SELECT COUNT(*) FROM language_resources {where}", params
    ).fetchone()[0]

    rows = db.execute(
        f"""SELECT resource_id, type, name, zh_goal, pattern, items_json,
                   zh_logic_chain_json, common_errors_json, difficulty,
                   mastery, mastery_score, task_types_json, source_essay_id, created_at
            FROM language_resources {where}
            ORDER BY mastery_score ASC, created_at DESC
            LIMIT ? OFFSET ?""",
        params + [limit, offset],
    ).fetchall()

    db.close()
    return {"total": total, "items": [dict(r) for r in rows]}


@router.post("/api/resources", status_code=201)
def create_resource(body: ResourceCreate):
    name = body.name.strip()
    pattern = body.pattern.strip()
    if not name or not pattern:
        raise HTTPException(status_code=400, detail="Resource name and pattern are required")

    db = get_conn()
    try:
        existing = db.execute(
            "SELECT resource_id FROM language_resources WHERE pattern = ?",
            (pattern,),
        ).fetchone()
        if existing:
            row = db.execute(
                """SELECT resource_id, type, name, zh_goal, pattern, items_json,
                          zh_logic_chain_json, common_errors_json, difficulty,
                          mastery, mastery_score, task_types_json, source_essay_id, created_at
                   FROM language_resources WHERE resource_id = ?""",
                (existing["resource_id"],),
            ).fetchone()
            return dict(row)

        resource_id = str(uuid.uuid4())
        with db:
            db.execute(
                """INSERT INTO language_resources
                   (resource_id, type, name, zh_goal, pattern,
                    items_json, zh_logic_chain_json, topic_tags_json, task_types_json,
                    question_types_json, difficulty, mastery, mastery_score, source_essay_id)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    resource_id,
                    _normalize_type(body.type),
                    name,
                    body.zh_goal.strip(),
                    pattern,
                    json.dumps(body.items, ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    json.dumps([body.task_type], ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    "6.0",
                    "unstable",
                    0.1,
                    body.source_essay_id,
                ),
            )

        row = db.execute(
            """SELECT resource_id, type, name, zh_goal, pattern, items_json,
                      zh_logic_chain_json, common_errors_json, difficulty,
                      mastery, mastery_score, task_types_json, source_essay_id, created_at
               FROM language_resources WHERE resource_id = ?""",
            (resource_id,),
        ).fetchone()
        return dict(row)
    finally:
        db.close()


@router.delete("/api/resources/{resource_id}", status_code=204)
def delete_resource(resource_id: str):
    db = get_conn()
    row = db.execute(
        "SELECT resource_id FROM language_resources WHERE resource_id = ?", (resource_id,)
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Resource not found")
    db.execute("DELETE FROM language_resources WHERE resource_id = ?", (resource_id,))
    db.commit()
    db.close()
