from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_conn
from services.practice_service import generate_practice, complete_session, check_answer
from services.provider import make_provider_from_db
import json

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


class AppealRequest(BaseModel):
    item_id: str
    user_answer: str


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


@router.post("/appeal")
def appeal(body: AppealRequest):
    user_answer = body.user_answer.strip()
    if not user_answer:
        raise HTTPException(400, "user_answer 不能为空")

    conn = get_conn()
    try:
        item = conn.execute(
            """SELECT item_id, category, sentence_original, sentence_display,
                      answer, acceptable_answers_json, weak_answer,
                      hint_zh, explanation_zh
               FROM practice_items WHERE item_id = ?""",
            (body.item_id,),
        ).fetchone()
        if not item:
            raise HTTPException(404, "Practice item not found")

        cfg = conn.execute("SELECT * FROM settings LIMIT 1").fetchone()
        if not cfg or not cfg["api_key"]:
            raise HTTPException(400, "请先在设置页配置 API Key")
        provider = make_provider_from_db(cfg)

        acceptable = json.loads(item["acceptable_answers_json"] or "[]")
        system = (
            "You are an IELTS writing answer judge. "
            "Decide whether the student's appealed answer can naturally fill the blank. "
            "Return ONLY valid JSON. Be strict about grammar, collocation, and meaning. "
            "Do not reward the student's original/basic expression if the exercise explicitly asks for a better replacement."
        )
        user = f"""请判定这个 IELTS 写作练习答案申诉是否成立。

练习类型：{item['category']}
原完整句：{item['sentence_original']}
题目显示：{item['sentence_display']}
推荐答案：{item['answer']}
已接受答案：{acceptable}
原始/普通表达（如有，命中它通常应判为需要替换而不是正确）：{item['weak_answer'] or '无'}
中文提示：{item['hint_zh']}
解析：{item['explanation_zh']}
学生申诉答案：{user_answer}

判定规则：
1. 如果学生答案能自然、语法正确、语义等价或非常接近地填入空格，可接受。
2. 如果只是拼写/大小写/单复数/标点轻微差异，且不改变语义，可接受。
3. 如果学生答案是原始/普通表达 weak_answer，或没有完成本题希望练习的表达升级，应返回 verdict="replace"，accepted=false。
4. 如果语义、搭配、语法或语域不自然，应返回 verdict="wrong"，accepted=false。
5. 若 accepted=true，suggest_add_to_acceptable=true。

返回 JSON：
{{
  "accepted": true,
  "verdict": "accepted / replace / wrong",
  "reason_zh": "一句中文理由，说明为什么接受或不接受",
  "suggest_add_to_acceptable": true
}}"""

        try:
            result = provider.chat_json(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                schema={},
                temperature=0.1,
                max_tokens=500,
            )
        except Exception as e:
            raise HTTPException(422, f"申诉判题失败：{e}")

        accepted = bool(result.get("accepted"))
        verdict = str(result.get("verdict") or ("accepted" if accepted else "wrong"))
        reason = str(result.get("reason_zh") or "")
        if accepted and result.get("suggest_add_to_acceptable", True):
            normalized = {str(a).strip().lower() for a in acceptable if str(a).strip()}
            if user_answer.lower() not in normalized:
                acceptable.append(user_answer)
                with conn:
                    conn.execute(
                        """UPDATE practice_items
                           SET acceptable_answers_json = ?
                           WHERE item_id = ?""",
                        (json.dumps(acceptable, ensure_ascii=False), body.item_id),
                    )

        return {
            "accepted": accepted,
            "verdict": verdict,
            "reason_zh": reason,
            "acceptable_answers": acceptable,
        }
    finally:
        conn.close()
