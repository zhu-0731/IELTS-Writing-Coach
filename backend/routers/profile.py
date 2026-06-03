from fastapi import APIRouter
from database import get_conn
from models.schemas import ProfileStatus, ProfileWrite, ProfileRead

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/status", response_model=ProfileStatus)
def get_profile_status():
    conn = get_conn()
    try:
        row = conn.execute("SELECT id FROM user_profile WHERE id = 1").fetchone()
        return ProfileStatus(is_setup_complete=row is not None)
    finally:
        conn.close()


@router.get("", response_model=ProfileRead)
def get_profile():
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        if row is None:
            return ProfileRead(
                target_band="6.0",
                main_task="both",
                main_problem="不知道写什么",
                template_style="简单稳妥，少出错",
                allow_profile_update=True,
            )
        return ProfileRead(
            target_band=row["target_band"],
            main_task=row["main_task"],
            main_problem=row["main_problem"],
            template_style=row["template_style"],
            allow_profile_update=bool(row["allow_profile_update"]),
        )
    finally:
        conn.close()


@router.post("", response_model=ProfileRead)
def create_or_update_profile(body: ProfileWrite):
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO user_profile
               (id, target_band, main_task, main_problem, template_style,
                allow_profile_update, created_at, updated_at)
               VALUES (1, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
               ON CONFLICT(id) DO UPDATE SET
                 target_band          = excluded.target_band,
                 main_task            = excluded.main_task,
                 main_problem         = excluded.main_problem,
                 template_style       = excluded.template_style,
                 allow_profile_update = excluded.allow_profile_update,
                 updated_at           = datetime('now')""",
            (
                body.target_band,
                body.main_task,
                body.main_problem,
                body.template_style,
                int(body.allow_profile_update),
            ),
        )
        conn.commit()
        return get_profile()
    finally:
        conn.close()
