from fastapi import APIRouter
from database import get_conn

router = APIRouter()

CLEARABLE_TABLES = [
    "user_profile",
    "essays",
    "language_resources",
    "hint_usage",
    "diagnoses",
    "practice_items",
    "practice_sessions",
]

@router.post("/api/data/reset")
def reset_data():
    db = get_conn()
    for table in CLEARABLE_TABLES:
        db.execute(f"DELETE FROM {table}")
    db.commit()
    db.close()
    return {"ok": True}
