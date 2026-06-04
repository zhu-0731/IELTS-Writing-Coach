import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn
from services.provider import make_provider_for_feature
from services.diagnosis_service import run_diagnosis

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])


class DiagnosisRequest(BaseModel):
    essay_id: str | None = None
    task_type: str
    question_type: str = ""
    prompt: str = ""
    content: str
    image_base64: str | None = None


def _get_provider():
    conn = get_conn()
    try:
        return make_provider_for_feature(conn, "diagnosis")
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        conn.close()


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
            image_base64=body.image_base64,
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
    finally:
        conn.close()

    return {
        **result,
        "diagnosis_id": diagnosis_id,
        "saved_resource_count": 0,
    }
