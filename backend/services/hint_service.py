import uuid
import sqlite3


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
