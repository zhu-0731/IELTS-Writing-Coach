from fastapi import APIRouter, HTTPException
from database import get_conn
from models.schemas import (
    SettingsRead,
    SettingsWrite,
    FeatureSettingsRead,
    FeatureSettingsWrite,
)
from services.provider import resolve_feature_config

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Features that support an independent LLM override
FEATURES = ("diagnosis", "practice")


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 4:
        return "****"
    return "****" + key[-4:]


@router.get("", response_model=SettingsRead)
def get_settings():
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if row is None:
            return SettingsRead(
                provider="openai_compatible",
                model_name="",
                base_url="https://api.openai.com/v1",
                api_key_masked="",
                supports_vision=False,
                supports_json_schema=True,
                supports_tool_calling=True,
                temperature=0.7,
                max_tokens=2048,
            )
        return SettingsRead(
            provider=row["provider"],
            model_name=row["model_name"],
            base_url=row["base_url"],
            api_key_masked=_mask_key(row["api_key"]),
            supports_vision=bool(row["supports_vision"]),
            supports_json_schema=bool(row["supports_json_schema"]),
            supports_tool_calling=bool(row["supports_tool_calling"]),
            temperature=row["temperature"],
            max_tokens=row["max_tokens"],
        )
    finally:
        conn.close()


@router.put("", response_model=SettingsRead)
def save_settings(body: SettingsWrite):
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if row is None:
            # 首次写入
            conn.execute(
                """INSERT INTO settings
                   (id, provider, model_name, base_url, api_key,
                    supports_vision, supports_json_schema, supports_tool_calling,
                    temperature, max_tokens, updated_at)
                   VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (
                    body.provider or "openai_compatible",
                    body.model_name or "",
                    body.base_url or "https://api.openai.com/v1",
                    body.api_key or "",
                    int(body.supports_vision) if body.supports_vision is not None else 0,
                    int(body.supports_json_schema) if body.supports_json_schema is not None else 1,
                    int(body.supports_tool_calling) if body.supports_tool_calling is not None else 1,
                    body.temperature if body.temperature is not None else 0.7,
                    body.max_tokens if body.max_tokens is not None else 2048,
                ),
            )
        else:
            # 增量更新：只更新非 None 字段
            fields: list[str] = []
            params: list = []

            def maybe(col: str, val):
                if val is not None:
                    fields.append(f"{col} = ?")
                    params.append(val)

            maybe("provider", body.provider)
            maybe("model_name", body.model_name)
            maybe("base_url", body.base_url)
            # api_key 特殊处理：空字符串也允许（表示清除）
            if body.api_key is not None:
                fields.append("api_key = ?")
                params.append(body.api_key)
            if body.supports_vision is not None:
                fields.append("supports_vision = ?")
                params.append(int(body.supports_vision))
            if body.supports_json_schema is not None:
                fields.append("supports_json_schema = ?")
                params.append(int(body.supports_json_schema))
            if body.supports_tool_calling is not None:
                fields.append("supports_tool_calling = ?")
                params.append(int(body.supports_tool_calling))
            maybe("temperature", body.temperature)
            maybe("max_tokens", body.max_tokens)
            fields.append("updated_at = datetime('now')")

            if fields:
                sql = f"UPDATE settings SET {', '.join(fields)} WHERE id = 1"
                conn.execute(sql, params)

        conn.commit()
        return get_settings()
    finally:
        conn.close()


# ── Per-feature overrides ──────────────────────────────────────────────────────

def _feature_read(conn, feature: str) -> FeatureSettingsRead:
    row = conn.execute(
        "SELECT * FROM feature_settings WHERE feature = ?", (feature,)
    ).fetchone()
    eff = resolve_feature_config(conn, feature)
    if row is None:
        return FeatureSettingsRead(
            feature=feature,
            enabled=False,
            model_name="",
            base_url="",
            api_key_masked="",
            temperature=0.7,
            max_tokens=2048,
            effective_source=eff["source"],
            effective_model_name=eff["model_name"],
            effective_base_url=eff["base_url"],
            effective_api_key_masked=_mask_key(eff["api_key"]),
        )
    return FeatureSettingsRead(
        feature=feature,
        enabled=bool(row["enabled"]),
        model_name=row["model_name"],
        base_url=row["base_url"],
        api_key_masked=_mask_key(row["api_key"]),
        temperature=row["temperature"],
        max_tokens=row["max_tokens"],
        effective_source=eff["source"],
        effective_model_name=eff["model_name"],
        effective_base_url=eff["base_url"],
        effective_api_key_masked=_mask_key(eff["api_key"]),
    )


@router.get("/features")
def get_feature_settings():
    conn = get_conn()
    try:
        return {f: _feature_read(conn, f) for f in FEATURES}
    finally:
        conn.close()


@router.put("/features/{feature}", response_model=FeatureSettingsRead)
def save_feature_settings(feature: str, body: FeatureSettingsWrite):
    if feature not in FEATURES:
        raise HTTPException(404, f"未知功能：{feature}")

    conn = get_conn()
    try:
        # Ensure a row exists, then patch non-None fields.
        conn.execute(
            "INSERT OR IGNORE INTO feature_settings (feature) VALUES (?)",
            (feature,),
        )

        fields: list[str] = []
        params: list = []

        if body.enabled is not None:
            fields.append("enabled = ?")
            params.append(int(body.enabled))
        if body.model_name is not None:
            fields.append("model_name = ?")
            params.append(body.model_name)
        if body.base_url is not None:
            fields.append("base_url = ?")
            params.append(body.base_url)
        # api_key: blank submission leaves the stored key untouched (consistent
        # with the general settings behaviour). The feature key being empty is a
        # valid state meaning "fall back to the general key".
        if body.api_key is not None and body.api_key != "":
            fields.append("api_key = ?")
            params.append(body.api_key)
        if body.temperature is not None:
            fields.append("temperature = ?")
            params.append(body.temperature)
        if body.max_tokens is not None:
            fields.append("max_tokens = ?")
            params.append(body.max_tokens)

        fields.append("updated_at = datetime('now')")
        params.append(feature)
        conn.execute(
            f"UPDATE feature_settings SET {', '.join(fields)} WHERE feature = ?",
            params,
        )
        conn.commit()
        return _feature_read(conn, feature)
    finally:
        conn.close()
