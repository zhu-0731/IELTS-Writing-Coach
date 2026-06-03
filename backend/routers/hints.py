from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn
from services.hint_service import get_hints, record_action

router = APIRouter(prefix="/api/hints", tags=["hints"])


class ActionRequest(BaseModel):
    essay_id: str | None = None
    action: str  # used | see_ref | next | too_hard | irrelevant


@router.get("")
def list_hints(task_type: str = "task2", limit: int = 6):
    conn = get_conn()
    try:
        hints = get_hints(conn, task_type, limit)
        return hints
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
