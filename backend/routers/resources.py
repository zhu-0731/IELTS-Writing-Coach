from fastapi import APIRouter, Query
from typing import Optional
from database import get_conn

router = APIRouter()


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


@router.delete("/api/resources/{resource_id}", status_code=204)
def delete_resource(resource_id: str):
    from fastapi import HTTPException
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
