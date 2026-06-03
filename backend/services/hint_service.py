import uuid
import sqlite3
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.provider import LLMProvider


MASTERY_DELTA: dict[str, float] = {
    "used": 0.1,
    "see_ref": 0.05,
    "next": 0.0,
    "too_hard": -0.1,
    "irrelevant": 0.0,
}


def score_to_mastery(score: float) -> str:
    if score < 0.3:
        return "unstable"
    if score < 0.6:
        return "learning"
    if score < 0.85:
        return "familiar"
    return "mastered"


def get_hints(conn: sqlite3.Connection, task_type: str, limit: int = 6) -> list[dict]:
    cursor = conn.execute(
        """
        SELECT * FROM language_resources
        WHERE task_types_json LIKE ?
        ORDER BY mastery_score ASC, last_used_at ASC
        LIMIT ?
        """,
        (f'%"{task_type}"%', limit),
    )
    rows = cursor.fetchall()
    return [dict(r) for r in rows]


def record_action(
    conn: sqlite3.Connection,
    resource_id: str,
    essay_id: str | None,
    action: str,
) -> float:
    row = conn.execute(
        "SELECT mastery_score FROM language_resources WHERE resource_id = ?",
        (resource_id,),
    ).fetchone()

    if not row:
        return 0.0

    delta = MASTERY_DELTA.get(action, 0.0)
    new_score = max(0.0, min(1.0, row["mastery_score"] + delta))
    new_mastery = score_to_mastery(new_score)

    conn.execute(
        """UPDATE language_resources
           SET mastery_score = ?, mastery = ?, last_used_at = datetime('now')
           WHERE resource_id = ?""",
        (new_score, new_mastery, resource_id),
    )

    conn.execute(
        """INSERT INTO hint_usage (hint_id, essay_id, resource_id, hint_type, user_action)
           VALUES (?, ?, ?, 'ai_hint', ?)""",
        (str(uuid.uuid4()), essay_id or "", resource_id, action),
    )

    return new_score


def match_hints(
    provider: "LLMProvider",
    conn: sqlite3.Connection,
    task_type: str,
    prompt: str,
    limit: int = 5,
) -> dict:
    """Use LLM to select the most topic-relevant resources from the user's library."""
    candidates = conn.execute(
        """SELECT resource_id, name, zh_goal, type
           FROM language_resources
           WHERE task_types_json LIKE ?
           ORDER BY mastery_score ASC LIMIT 30""",
        (f'%"{task_type}"%',),
    ).fetchall()

    if not candidates:
        return {"context": "", "hints": []}

    # Number the candidates 1-N so LLM returns indices instead of full UUIDs
    numbered = list(enumerate(candidates, 1))
    resource_list = "\n".join(
        f"{i}. [{r['type']}] 《{r['name']}》：{r['zh_goal']}"
        for i, r in numbered
    )

    system = (
        "你是IELTS写作教练。根据学生当前的写作题目，从他积累的语言资源库中"
        "挑选最相关的几条，帮助他发现哪些已学的表达可以用在这篇文章里。"
        "Return ONLY valid JSON."
    )
    user = f"""学生正在写以下题目：
{prompt}

以下是他积累的语言资源（编号 | 类型 | 名称：用途）：
{resource_list}

请选出最适合本题目使用的 3-5 条资源，并生成一句简洁的中文提示，
直接说明这些资源和题目的关联（不要说"我为你选了"之类的话，
直接说"这道题是关于XXX的，以下这些表达可能用得上"）。

返回 JSON：
{{
  "context": "一句中文提示，例如：这道题探讨XXX，以下这些你学过的表达可能用得上",
  "selected_indices": [1, 3, 5]
}}"""

    try:
        result = provider.chat_json(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            schema={},
            temperature=0.3,
            max_tokens=300,
        )
    except Exception:
        return {"context": "", "hints": []}

    indices = [i for i in result.get("selected_indices", []) if isinstance(i, int)][:limit]
    context = result.get("context", "")

    id_map = {i: r["resource_id"] for i, r in numbered}
    hints = []
    for idx in indices:
        rid = id_map.get(idx)
        if not rid:
            continue
        row = conn.execute(
            "SELECT * FROM language_resources WHERE resource_id = ?", (rid,)
        ).fetchone()
        if row:
            hints.append(dict(row))

    return {"context": context, "hints": hints}
