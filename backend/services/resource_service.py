import json
import uuid
import sqlite3


def extract_and_save(
    conn: sqlite3.Connection,
    diagnosis_result: dict,
    essay_id: str,
    task_type: str,
) -> list[str]:
    """
    Extract language resources from top_sentence_fixes and save to language_resources.
    Returns list of new resource_ids created.
    """
    saved_ids: list[str] = []

    for fix in diagnosis_result.get("top_sentence_fixes", []):
        suggestion = (fix.get("suggestion") or "").strip()
        name = (fix.get("resource_name") or "").strip()
        resource_type = (fix.get("resource_type") or "expression").strip()
        problem = (fix.get("problem") or "").strip()

        if not suggestion or not name:
            continue

        # Only accept known types
        if resource_type not in ("expression", "pattern", "collocation"):
            resource_type = "expression"

        # Dedup: skip if an identical pattern already exists
        existing = conn.execute(
            "SELECT resource_id FROM language_resources WHERE pattern = ?",
            (suggestion,),
        ).fetchone()
        if existing:
            continue

        resource_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO language_resources
               (resource_id, type, name, zh_goal, pattern,
                items_json, zh_logic_chain_json,
                topic_tags_json, task_types_json, question_types_json,
                difficulty, mastery, mastery_score, source_essay_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                resource_id,
                resource_type,
                name,
                problem or "从诊断提炼的改写建议",
                suggestion,
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                json.dumps([task_type]),
                json.dumps([]),
                "6.0",
                "unstable",
                0.1,
                essay_id,
            ),
        )
        saved_ids.append(resource_id)

    return saved_ids
