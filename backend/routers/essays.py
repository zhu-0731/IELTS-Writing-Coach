import uuid
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from database import get_conn

router = APIRouter()


class EssayCreate(BaseModel):
    task_type: str
    question_type: Optional[str] = None
    prompt: str = ''
    content: str = ''
    word_count: int = 0
    topic_tags_json: str = '[]'


class EssayUpdate(BaseModel):
    question_type: Optional[str] = None
    prompt: Optional[str] = None
    content: Optional[str] = None
    word_count: Optional[int] = None
    topic_tags_json: Optional[str] = None


class EssayRead(BaseModel):
    essay_id: str
    task_type: str
    question_type: Optional[str]
    prompt: str
    content: str
    word_count: int
    topic_tags_json: str
    created_at: str
    updated_at: str


@router.post("/api/essays", response_model=EssayRead, status_code=201)
def create_essay(body: EssayCreate):
    essay_id = str(uuid.uuid4())
    db = get_conn()
    db.execute(
        """INSERT INTO essays
           (essay_id, task_type, question_type, prompt, content, word_count, topic_tags_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (essay_id, body.task_type, body.question_type, body.prompt,
         body.content, body.word_count, body.topic_tags_json),
    )
    db.commit()
    row = db.execute("SELECT * FROM essays WHERE essay_id = ?", (essay_id,)).fetchone()
    db.close()
    return dict(row)


@router.put("/api/essays/{essay_id}", response_model=EssayRead)
def update_essay(essay_id: str, body: EssayUpdate):
    db = get_conn()
    row = db.execute("SELECT * FROM essays WHERE essay_id = ?", (essay_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Essay not found")

    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        vals = list(fields.values()) + [essay_id]
        db.execute(
            f"UPDATE essays SET {sets}, updated_at = datetime('now') WHERE essay_id = ?",
            vals,
        )
        db.commit()

    row = db.execute("SELECT * FROM essays WHERE essay_id = ?", (essay_id,)).fetchone()
    db.close()
    return dict(row)


@router.get("/api/essays")
def list_essays(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = get_conn()
    total = db.execute("SELECT COUNT(*) FROM essays").fetchone()[0]
    rows = db.execute(
        """SELECT e.essay_id, e.task_type, e.question_type, e.prompt,
                  e.word_count, e.created_at, e.updated_at,
                  d.diagnosis_id, d.estimated_band,
                  d.main_problems_json, d.next_training_task
           FROM essays e
           LEFT JOIN diagnoses d ON d.essay_id = e.essay_id
               AND d.created_at = (
                   SELECT MAX(d2.created_at) FROM diagnoses d2
                   WHERE d2.essay_id = e.essay_id
               )
           ORDER BY e.updated_at DESC
           LIMIT ? OFFSET ?""",
        [limit, offset],
    ).fetchall()
    db.close()
    return {"total": total, "items": [dict(r) for r in rows]}


@router.get("/api/essays/{essay_id}", response_model=EssayRead)
def get_essay(essay_id: str):
    db = get_conn()
    row = db.execute("SELECT * FROM essays WHERE essay_id = ?", (essay_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Essay not found")
    return dict(row)


@router.delete("/api/essays/{essay_id}", status_code=204)
def delete_essay(essay_id: str):
    db = get_conn()
    row = db.execute("SELECT essay_id FROM essays WHERE essay_id = ?", (essay_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Essay not found")
    db.execute("DELETE FROM diagnoses WHERE essay_id = ?", (essay_id,))
    db.execute("DELETE FROM essays WHERE essay_id = ?", (essay_id,))
    db.commit()
    db.close()
