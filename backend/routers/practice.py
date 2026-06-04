from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_conn
from services.practice_service import generate_practice, complete_session, check_answer
from services.provider import make_provider_from_db

router = APIRouter(prefix="/api/practice", tags=["practice"])


class GenerateRequest(BaseModel):
    essay_id: str
    mode: str = "cloze"


class CompleteRequest(BaseModel):
    score: int
    item_results: list[dict] = Field(default_factory=list)


class CheckRequest(BaseModel):
    user_answer: str
    correct_answer: str


@router.post("/generate")
def generate(body: GenerateRequest):
    if body.mode not in ("cloze", "dictation"):
        raise HTTPException(400, "mode 必须是 cloze 或 dictation")
    conn = get_conn()
    try:
        cfg = conn.execute("SELECT * FROM settings LIMIT 1").fetchone()
        if not cfg or not cfg["api_key"]:
            raise HTTPException(400, "请先在设置页配置 API Key")
        provider = make_provider_from_db(cfg)
        try:
            result = generate_practice(provider, conn, body.essay_id, body.mode)
        except ValueError as e:
            raise HTTPException(422, str(e))
        return result
    finally:
        conn.close()


@router.get("/session/{session_id}")
def get_session(session_id: str):
    conn = get_conn()
    try:
        session = conn.execute(
            "SELECT * FROM practice_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if not session:
            raise HTTPException(404, "Session not found")
        items = conn.execute(
            "SELECT * FROM practice_items WHERE session_id = ? ORDER BY order_idx",
            (session_id,),
        ).fetchall()
        return {**dict(session), "items": [dict(i) for i in items]}
    finally:
        conn.close()


@router.delete("/session/{session_id}")
def delete_session(session_id: str):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT session_id FROM practice_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")
        with conn:
            conn.execute(
                "DELETE FROM practice_items WHERE session_id = ?",
                (session_id,),
            )
            conn.execute(
                "DELETE FROM practice_sessions WHERE session_id = ?",
                (session_id,),
            )
        return {"ok": True}
    finally:
        conn.close()


@router.get("/essay/{essay_id}/latest")
def get_latest_for_essay(essay_id: str):
    conn = get_conn()
    try:
        session = conn.execute(
            """SELECT * FROM practice_sessions
               WHERE essay_id = ? ORDER BY created_at DESC LIMIT 1""",
            (essay_id,),
        ).fetchone()
        return dict(session) if session else None
    finally:
        conn.close()


@router.get("/sessions")
def list_sessions(limit: int = Query(10, ge=1, le=50)):
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT ps.session_id, ps.essay_id, ps.mode, ps.status,
                      ps.score, ps.total, ps.created_at,
                      e.task_type, e.prompt
               FROM practice_sessions ps
               JOIN essays e ON e.essay_id = ps.essay_id
               ORDER BY ps.created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/session/{session_id}/complete")
def complete(session_id: str, body: CompleteRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT session_id FROM practice_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")
        complete_session(conn, session_id, body.score, body.item_results)
        return {"ok": True}
    finally:
        conn.close()


@router.post("/check")
def check(body: CheckRequest):
    """Pure answer-check utility — no DB side effects."""
    return {"correct": check_answer(body.user_answer, body.correct_answer)}
