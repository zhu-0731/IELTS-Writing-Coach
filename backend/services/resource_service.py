import json
import uuid
import sqlite3


def _save_resource(
    conn: sqlite3.Connection,
    *,
    resource_type: str,
    name: str,
    zh_goal: str,
    pattern: str,
    items: list,
    task_type: str,
    essay_id: str,
) -> str | None:
    """Insert one language resource; returns resource_id or None if dedup skipped."""
    if not pattern or not name:
        return None

    if resource_type not in ("expression", "pattern", "collocation"):
        resource_type = "expression"

    # Dedup on pattern text
    existing = conn.execute(
        "SELECT resource_id FROM language_resources WHERE pattern = ?",
        (pattern,),
    ).fetchone()
    if existing:
        return None

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
            zh_goal,
            pattern,
            json.dumps(items or []),
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
    return resource_id


def extract_and_save(
    conn: sqlite3.Connection,
    diagnosis_result: dict,
    essay_id: str,
    task_type: str,
) -> list[str]:
    """
    Extract language resources from diagnosis result and save to language_resources.
    Returns list of new resource_ids created.
    """
    saved_ids: list[str] = []

    # ── Sentence-level resources from top_sentence_fixes ─────────────────────
    for fix in diagnosis_result.get("top_sentence_fixes", []):
        resource_type = (fix.get("resource_type") or "expression").strip()
        name = (fix.get("resource_name") or "").strip()
        goal = (fix.get("resource_goal") or fix.get("problem") or "").strip()

        # Prefer the abstracted resource_pattern; fall back to suggestion for old data
        pattern = (fix.get("resource_pattern") or fix.get("suggestion") or "").strip()
        items = fix.get("resource_items") or []
        if isinstance(items, str):
            items = [items]

        rid = _save_resource(
            conn,
            resource_type=resource_type,
            name=name,
            zh_goal=goal,
            pattern=pattern,
            items=items,
            task_type=task_type,
            essay_id=essay_id,
        )
        if rid:
            saved_ids.append(rid)

    # ── Phrase-level resources from phrase_resources ──────────────────────────
    for pr in diagnosis_result.get("phrase_resources", []):
        pattern = (pr.get("pattern") or "").strip()
        name = (pr.get("name") or "").strip()
        goal = (pr.get("goal") or "").strip()
        resource_type = (pr.get("type") or "collocation").strip()

        rid = _save_resource(
            conn,
            resource_type=resource_type,
            name=name,
            zh_goal=goal,
            pattern=pattern,
            items=[],
            task_type=task_type,
            essay_id=essay_id,
        )
        if rid:
            saved_ids.append(rid)

    return saved_ids
