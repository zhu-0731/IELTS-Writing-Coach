from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn
from services.hint_service import get_hints, record_action, match_hints
from services.provider import make_provider_from_db

router = APIRouter(prefix="/api/hints", tags=["hints"])


class ActionRequest(BaseModel):
    essay_id: str | None = None
    action: str  # used | see_ref | next | too_hard | irrelevant


class MatchRequest(BaseModel):
    prompt: str
    task_type: str = "task2"
    essay_id: str | None = None
    limit: int = 5


@router.get("")
def list_hints(task_type: str = "task2", limit: int = 6):
    conn = get_conn()
    try:
        hints = get_hints(conn, task_type, limit)
        return hints
    finally:
        conn.close()


@router.post("/match")
def match_hints_endpoint(body: MatchRequest):
    if not body.prompt.strip():
        raise HTTPException(400, "prompt 不能为空")
    conn = get_conn()
    try:
        cfg = conn.execute("SELECT * FROM settings LIMIT 1").fetchone()
        if not cfg or not cfg["api_key"]:
            raise HTTPException(400, "请先在设置页配置 API Key")
        provider = make_provider_from_db(cfg)
        result = match_hints(provider, conn, body.task_type, body.prompt, body.limit)
        return result
    finally:
        conn.close()


@router.post("/{resource_id}/action")
def hint_action(resource_id: str, body: ActionRequest):
    valid = {"used", "see_ref", "next", "too_hard", "irrelevant"}
    if body.action not in valid:
        raise HTTPException(400, f"action 必须是以下之一：{valid}")

    conn = get_conn()
    try:
        with conn:
            new_score = record_action(conn, resource_id, body.essay_id, body.action)
        return {"ok": True, "new_mastery_score": new_score}
    finally:
        conn.close()
