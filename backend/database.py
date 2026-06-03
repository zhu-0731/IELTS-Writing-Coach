import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "ielts.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    with conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                id          INTEGER PRIMARY KEY CHECK (id = 1),
                provider    TEXT    NOT NULL DEFAULT 'openai_compatible',
                model_name  TEXT    NOT NULL DEFAULT '',
                base_url    TEXT    NOT NULL DEFAULT 'https://api.openai.com/v1',
                api_key     TEXT    NOT NULL DEFAULT '',
                supports_vision         INTEGER NOT NULL DEFAULT 0,
                supports_json_schema    INTEGER NOT NULL DEFAULT 1,
                supports_tool_calling   INTEGER NOT NULL DEFAULT 1,
                temperature             REAL    NOT NULL DEFAULT 0.7,
                max_tokens              INTEGER NOT NULL DEFAULT 2048,
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS user_profile (
                id                   INTEGER PRIMARY KEY CHECK (id = 1),
                target_band          TEXT    NOT NULL,
                main_task            TEXT    NOT NULL,
                main_problem         TEXT    NOT NULL,
                template_style       TEXT    NOT NULL,
                allow_profile_update INTEGER NOT NULL DEFAULT 1,
                created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS essays (
                essay_id        TEXT PRIMARY KEY,
                task_type       TEXT NOT NULL,
                question_type   TEXT,
                prompt          TEXT NOT NULL DEFAULT '',
                content         TEXT NOT NULL DEFAULT '',
                word_count      INTEGER NOT NULL DEFAULT 0,
                topic_tags_json TEXT NOT NULL DEFAULT '[]',
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS language_resources (
                resource_id         TEXT PRIMARY KEY,
                type                TEXT NOT NULL,
                name                TEXT NOT NULL,
                zh_goal             TEXT NOT NULL DEFAULT '',
                pattern             TEXT NOT NULL DEFAULT '',
                items_json          TEXT NOT NULL DEFAULT '[]',
                zh_logic_chain_json TEXT NOT NULL DEFAULT '[]',
                topic_tags_json     TEXT NOT NULL DEFAULT '[]',
                task_types_json     TEXT NOT NULL DEFAULT '[]',
                question_types_json TEXT NOT NULL DEFAULT '[]',
                difficulty          TEXT NOT NULL DEFAULT '6.0',
                mastery             TEXT NOT NULL DEFAULT 'learning',
                mastery_score       REAL NOT NULL DEFAULT 0.3,
                last_used_at        TEXT,
                next_review_at      TEXT,
                common_errors_json  TEXT NOT NULL DEFAULT '[]',
                source_essay_id     TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS hint_usage (
                hint_id          TEXT PRIMARY KEY,
                essay_id         TEXT NOT NULL,
                resource_id      TEXT NOT NULL,
                hint_type        TEXT NOT NULL,
                shown_at         TEXT NOT NULL DEFAULT (datetime('now')),
                user_action      TEXT,
                diagnosis_result TEXT,
                feedback         TEXT
            );

            CREATE TABLE IF NOT EXISTS diagnoses (
                diagnosis_id            TEXT PRIMARY KEY,
                essay_id                TEXT NOT NULL,
                estimated_band          TEXT,
                main_problems_json      TEXT NOT NULL DEFAULT '[]',
                top_sentence_fixes_json TEXT NOT NULL DEFAULT '[]',
                hint_usage_feedback_json TEXT NOT NULL DEFAULT '[]',
                next_training_task      TEXT NOT NULL DEFAULT '',
                created_at              TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
    conn.close()
