from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn
from services.provider import make_provider_from_db
from services.idea_service import generate_idea
from services.expression_service import generate_expression

router = APIRouter(prefix="/api/coach", tags=["coach"])


class IdeaRequest(BaseModel):
    task_type: str
    question_type: str = ""
    prompt: str
    essay_id: str | None = None


class ExpressionRequest(BaseModel):
    chinese_text: str
    task_type: str = "task2"


def _get_provider():
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    finally:
        conn.close()

    if not row or not row["api_key"]:
        raise HTTPException(400, "API Key 未配置，请前往设置页填写。")
    if not row["model_name"]:
        raise HTTPException(400, "Model Name 未配置，请前往设置页填写。")

    return make_provider_from_db(row)


@router.post("/idea")
def idea_coach(body: IdeaRequest):
    if not body.prompt.strip():
        raise HTTPException(400, "请先在左侧填写题目内容。")
    provider = _get_provider()
    try:
        return generate_idea(provider, body.task_type, body.question_type, body.prompt)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI 调用失败：{e}")


@router.post("/expression")
def expression_coach(body: ExpressionRequest):
    if not body.chinese_text.strip():
        raise HTTPException(400, "请输入要翻译的中文内容。")
    provider = _get_provider()
    try:
        return generate_expression(provider, body.chinese_text, body.task_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI 调用失败：{e}")
