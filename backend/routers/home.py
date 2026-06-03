import json
from fastapi import APIRouter
from database import get_conn

router = APIRouter(prefix="/api/home", tags=["home"])


@router.get("/summary")
def home_summary():
    conn = get_conn()
    try:
        # Profile
        profile_row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        profile = dict(profile_row) if profile_row else None

        # API configured?
        settings_row = conn.execute(
            "SELECT api_key, model_name FROM settings WHERE id = 1"
        ).fetchone()
        api_configured = bool(
            settings_row and settings_row["api_key"] and settings_row["model_name"]
        )

        # Latest diagnosis
        diag_row = conn.execute(
            "SELECT * FROM diagnoses ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

        recent_diagnosis = None
        if diag_row:
            recent_diagnosis = {
                "diagnosis_id": diag_row["diagnosis_id"],
                "essay_id": diag_row["essay_id"],
                "estimated_band": diag_row["estimated_band"],
                "main_problems": json.loads(diag_row["main_problems_json"] or "[]"),
                "next_training_task": diag_row["next_training_task"],
                "created_at": diag_row["created_at"],
            }

        # Recent resources from essays (non-seed)
        resource_rows = conn.execute(
            """SELECT resource_id, type, name, zh_goal, mastery, mastery_score
               FROM language_resources
               WHERE source_essay_id IS NOT NULL
               ORDER BY created_at DESC
               LIMIT 4"""
        ).fetchall()
        recent_resources = [dict(r) for r in resource_rows]

        # Problem frequency (aggregate last 10 diagnoses)
        all_diag = conn.execute(
            "SELECT main_problems_json FROM diagnoses ORDER BY created_at DESC LIMIT 10"
        ).fetchall()
        problem_counts: dict[str, int] = {}
        for row in all_diag:
            for p in json.loads(row["main_problems_json"] or "[]"):
                cat = p.get("category", "Other")
                problem_counts[cat] = problem_counts.get(cat, 0) + 1
        problem_stats = sorted(
            [{"category": k, "count": v} for k, v in problem_counts.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:3]

        # Counts
        essay_count = conn.execute("SELECT COUNT(*) FROM essays").fetchone()[0]
        diagnosis_count = conn.execute("SELECT COUNT(*) FROM diagnoses").fetchone()[0]

        return {
            "profile": profile,
            "api_configured": api_configured,
            "recent_diagnosis": recent_diagnosis,
            "recent_resources": recent_resources,
            "problem_stats": problem_stats,
            "essay_count": essay_count,
            "diagnosis_count": diagnosis_count,
        }
    finally:
        conn.close()
