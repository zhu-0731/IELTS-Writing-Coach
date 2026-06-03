import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn
from services.provider import make_provider_from_db
from services.diagnosis_service import run_diagnosis
from services.resource_service import extract_and_save

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])


class DiagnosisRequest(BaseModel):
    essay_id: str | None = None
    task_type: str
    question_type: str = ""
    prompt: str = ""
    content: str


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


@router.post("/full")
def full_diagnosis(body: DiagnosisRequest):
    if not body.content.strip():
        raise HTTPException(400, "作文内容为空，无法诊断。")

    provider = _get_provider()

    try:
        result = run_diagnosis(
            provider,
            body.content,
            body.prompt,
            body.task_type,
            body.question_type,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI 诊断失败：{e}")

    diagnosis_id = str(uuid.uuid4())
    essay_id = body.essay_id or f"tmp-{uuid.uuid4()}"

    conn = get_conn()
    try:
        with conn:
            conn.execute(
                """INSERT INTO diagnoses
                   (diagnosis_id, essay_id, estimated_band,
                    main_problems_json, top_sentence_fixes_json,
                    hint_usage_feedback_json, next_training_task)
                   VALUES (?,?,?,?,?,?,?)""",
                (
                    diagnosis_id,
                    essay_id,
                    result.get("estimated_band", ""),
                    json.dumps(result.get("main_problems", []), ensure_ascii=False),
                    json.dumps(result.get("top_sentence_fixes", []), ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    result.get("next_training_task", ""),
                ),
            )
            saved_ids = extract_and_save(conn, result, essay_id, body.task_type)
    finally:
        conn.close()

    return {
        **result,
        "diagnosis_id": diagnosis_id,
        "saved_resource_count": len(saved_ids),
    }
