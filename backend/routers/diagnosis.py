import json
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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


class DiagnosisRetryRequest(DiagnosisRequest):
    diagnosis_id: str | None = None
    failed_task_keys: list[str] = Field(default_factory=list)
    previous_result: dict = Field(default_factory=dict)


def _json_loads(raw: str | None, fallback):
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return fallback


def _result_from_row(row) -> dict:
    stored = _json_loads(row["diagnosis_result_json"] if "diagnosis_result_json" in row.keys() else None, {})
    if isinstance(stored, dict) and stored:
        result = dict(stored)
    else:
        result = {
            "estimated_band": row["estimated_band"] or "",
            "dimension_scores": [],
            "main_problems": _json_loads(row["main_problems_json"], []),
            "top_sentence_fixes": _json_loads(row["top_sentence_fixes_json"], []),
            "phrase_resources": [],
            "template_misuse": "",
            "next_training_task": row["next_training_task"] or "",
            "diagnosis_scope_note": "",
            "saved_resource_count": 0,
            "diagnosis_status": "complete",
            "failed_tasks": [],
        }
    result["diagnosis_id"] = row["diagnosis_id"]
    result["essay_id"] = row["essay_id"]
    result["created_at"] = row["created_at"]
    result.setdefault("saved_resource_count", 0)
    return result


def _get_provider():
    conn = get_conn()
    try:
        return make_provider_for_feature(conn, "diagnosis")
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        conn.close()


def _save_diagnosis_result(
    *,
    diagnosis_id: str,
    essay_id: str,
    result: dict,
    update_existing: bool = False,
) -> None:
    conn = get_conn()
    try:
        conn.execute("PRAGMA query_only=OFF")
        conn.execute("PRAGMA busy_timeout=5000")
        with conn:
            if update_existing:
                existing = conn.execute(
                    "SELECT diagnosis_id FROM diagnoses WHERE diagnosis_id = ?",
                    (diagnosis_id,),
                ).fetchone()
                if existing:
                    conn.execute(
                        """UPDATE diagnoses
                           SET estimated_band = ?,
                               main_problems_json = ?,
                               top_sentence_fixes_json = ?,
                               hint_usage_feedback_json = ?,
                               diagnosis_result_json = ?,
                               next_training_task = ?
                           WHERE diagnosis_id = ?""",
                        (
                            result.get("estimated_band", ""),
                            json.dumps(result.get("main_problems", []), ensure_ascii=False),
                            json.dumps(result.get("top_sentence_fixes", []), ensure_ascii=False),
                            json.dumps([], ensure_ascii=False),
                            json.dumps(result, ensure_ascii=False),
                            result.get("next_training_task", ""),
                            diagnosis_id,
                        ),
                    )
                    return

            conn.execute(
                """INSERT INTO diagnoses
                   (diagnosis_id, essay_id, estimated_band,
                    main_problems_json, top_sentence_fixes_json,
                    hint_usage_feedback_json, diagnosis_result_json, next_training_task)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    diagnosis_id,
                    essay_id,
                    result.get("estimated_band", ""),
                    json.dumps(result.get("main_problems", []), ensure_ascii=False),
                    json.dumps(result.get("top_sentence_fixes", []), ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    json.dumps(result, ensure_ascii=False),
                    result.get("next_training_task", ""),
                ),
            )
    finally:
        conn.close()


def _try_save_diagnosis_result(**kwargs) -> str:
    try:
        _save_diagnosis_result(**kwargs)
        return ""
    except sqlite3.OperationalError as exc:
        message = f"诊断结果保存失败：{exc}"
        print(f"[diagnosis] {message}")
        return message


@router.get("/essay/{essay_id}")
def list_diagnoses_for_essay(essay_id: str):
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT diagnosis_id, essay_id, estimated_band, main_problems_json,
                      top_sentence_fixes_json, hint_usage_feedback_json,
                      diagnosis_result_json, next_training_task, created_at
               FROM diagnoses
               WHERE essay_id = ?
               ORDER BY created_at DESC""",
            (essay_id,),
        ).fetchall()
        return {
            "items": [
                {
                    "diagnosis_id": row["diagnosis_id"],
                    "essay_id": row["essay_id"],
                    "estimated_band": row["estimated_band"],
                    "created_at": row["created_at"],
                    "main_problems": _json_loads(row["main_problems_json"], []),
                    "next_training_task": row["next_training_task"],
                }
                for row in rows
            ]
        }
    finally:
        conn.close()


@router.get("/{diagnosis_id}")
def get_diagnosis(diagnosis_id: str):
    conn = get_conn()
    try:
        row = conn.execute(
            """SELECT diagnosis_id, essay_id, estimated_band, main_problems_json,
                      top_sentence_fixes_json, hint_usage_feedback_json,
                      diagnosis_result_json, next_training_task, created_at
               FROM diagnoses
               WHERE diagnosis_id = ?""",
            (diagnosis_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
        return _result_from_row(row)
    finally:
        conn.close()


@router.delete("/{diagnosis_id}")
def delete_diagnosis(diagnosis_id: str):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT diagnosis_id, essay_id FROM diagnoses WHERE diagnosis_id = ?",
            (diagnosis_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
        with conn:
            conn.execute("DELETE FROM diagnoses WHERE diagnosis_id = ?", (diagnosis_id,))
        return {"ok": True, "essay_id": row["essay_id"]}
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
    result = {**result, "diagnosis_id": diagnosis_id}
    save_error = _try_save_diagnosis_result(
        diagnosis_id=diagnosis_id,
        essay_id=essay_id,
        result=result,
    )

    return {
        **result,
        "diagnosis_id": diagnosis_id,
        "saved_resource_count": 0,
        "save_error": save_error,
    }


@router.post("/retry")
def retry_diagnosis(body: DiagnosisRetryRequest):
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
            retry_task_keys=body.failed_task_keys,
            previous_result=body.previous_result,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI 诊断重试失败：{e}")

    diagnosis_id = body.diagnosis_id or body.previous_result.get("diagnosis_id") or str(uuid.uuid4())
    essay_id = body.essay_id or f"tmp-{uuid.uuid4()}"
    result = {**result, "diagnosis_id": diagnosis_id}
    save_error = _try_save_diagnosis_result(
        diagnosis_id=diagnosis_id,
        essay_id=essay_id,
        result=result,
        update_existing=True,
    )

    return {
        **result,
        "diagnosis_id": diagnosis_id,
        "saved_resource_count": 0,
        "save_error": save_error,
    }
