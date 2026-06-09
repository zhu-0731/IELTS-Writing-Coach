from typing import Protocol, Any
import httpx
import json
import logging
import time
import uuid


logger = logging.getLogger("ielts.llm")


def _parse_json_loose(raw: str) -> dict:
    """Parse JSON tolerantly: handle markdown fences and surrounding prose.

    Note: cannot recover from a truncated response — that needs a higher
    max_tokens at the call site.
    """
    raw = (raw or "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` fences if present
    if raw.startswith("```"):
        inner = raw.split("```")
        if len(inner) >= 2:
            candidate = inner[1]
            if candidate.lstrip().lower().startswith("json"):
                candidate = candidate.lstrip()[4:]
            try:
                return json.loads(candidate.strip())
            except json.JSONDecodeError:
                pass

    # Fall back to first '{' .. last '}'
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(raw[start:end + 1])

    raise ValueError("模型返回内容不是有效 JSON（可能被截断或格式异常）")


class LLMProvider(Protocol):
    def chat(self, messages: list[dict], **kwargs) -> str: ...
    def chat_json(self, messages: list[dict], schema: dict, **kwargs) -> dict: ...


class OpenAICompatibleProvider:
    def __init__(self, base_url: str, api_key: str, model_name: str,
                 temperature: float = 0.7, max_tokens: int = 2048):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _effective_max_tokens(self, requested: int | None) -> int:
        configured = int(self.max_tokens or 0)
        requested = int(requested or 0)
        return max(configured, requested, 1)

    def _log_error_context(self, *, call_id: str, context: str, max_tokens: int, exc: Exception) -> None:
        logger.exception(
            "[llm] call failed | call_id=%s | context=%s | model=%s | base_url=%s | max_tokens=%s | error=%s",
            call_id,
            context,
            self.model_name,
            self.base_url,
            max_tokens,
            exc,
        )

    def chat(self, messages: list[dict], **kwargs) -> str:
        call_id = uuid.uuid4().hex[:8]
        context = str(kwargs.get("context") or "chat")
        max_tokens = self._effective_max_tokens(kwargs.get("max_tokens"))
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": max_tokens,
        }
        started = time.perf_counter()
        with httpx.Client(timeout=60) as client:
            try:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                logger.info(
                    "[llm] chat ok | call_id=%s | context=%s | elapsed_ms=%d | content_len=%d",
                    call_id,
                    context,
                    int((time.perf_counter() - started) * 1000),
                    len(content or ""),
                )
                return content
            except Exception as exc:
                self._log_error_context(call_id=call_id, context=context, max_tokens=max_tokens, exc=exc)
                raise

    def chat_json(self, messages: list[dict], schema: dict, **kwargs) -> dict:
        call_id = uuid.uuid4().hex[:8]
        context = str(kwargs.get("context") or "chat_json")
        max_tokens = self._effective_max_tokens(kwargs.get("max_tokens"))
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        started = time.perf_counter()
        with httpx.Client(timeout=90) as client:
            try:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
            except Exception as exc:
                self._log_error_context(call_id=call_id, context=context, max_tokens=max_tokens, exc=exc)
                raise
            choice = resp.json()["choices"][0]
            raw = (choice.get("message") or {}).get("content", "") or ""
            finish = choice.get("finish_reason")
            try:
                parsed = _parse_json_loose(raw)
                logger.info(
                    "[llm] json ok | call_id=%s | context=%s | finish_reason=%s | elapsed_ms=%d | content_len=%d",
                    call_id,
                    context,
                    finish,
                    int((time.perf_counter() - started) * 1000),
                    len(raw),
                )
                return parsed
            except ValueError:
                snippet = raw[:600].replace("\n", "\\n")
                logger.error(
                    "[llm] JSON parse failed | call_id=%s | context=%s | model=%s | finish_reason=%s "
                    "| max_tokens=%s | content_len=%d | snippet=%r",
                    call_id,
                    context,
                    self.model_name,
                    finish,
                    max_tokens,
                    len(raw),
                    snippet,
                )
                if finish == "length":
                    raise ValueError(
                        "模型输出过长被截断（finish_reason=length）。"
                        "请到「设置」调高最大输出 Token，或改用支持更长输出的模型后重试"
                    )
                if not raw.strip():
                    raise ValueError(
                        "模型返回了空内容。若使用推理类模型（如 o1/r1），"
                        "请调高最大输出 Token，使其在思考后仍有足够额度输出 JSON"
                    )
                raise


def make_provider_from_db(row) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        base_url=row["base_url"],
        api_key=row["api_key"],
        model_name=row["model_name"],
        temperature=row["temperature"],
        max_tokens=row["max_tokens"],
    )


# ── Per-feature configuration resolution ───────────────────────────────────────
#
# Each feature ('diagnosis', 'practice', ...) may have an override row in
# feature_settings. Resolution rules:
#   • no row, or enabled = 0  → use the general settings row verbatim
#   • enabled = 1             → use the feature row, but for the three
#                                connection-critical fields (base_url,
#                                model_name, api_key) fall back to the general
#                                value when the feature field is left blank.
#                                temperature / max_tokens always come from the
#                                feature row when the override is active.
#
# This keeps the semantics unambiguous: an enabled override genuinely takes
# effect, and a disabled one is fully transparent.

def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


def resolve_feature_config(conn, feature: str | None) -> dict:
    """Return the effective LLM config for a feature.

    The returned dict carries the REAL api_key (for provider construction).
    Callers that surface this to clients must mask the key themselves.
    """
    base = _row_to_dict(conn.execute("SELECT * FROM settings WHERE id = 1").fetchone())

    fs: dict = {}
    if feature:
        fs = _row_to_dict(
            conn.execute(
                "SELECT * FROM feature_settings WHERE feature = ?", (feature,)
            ).fetchone()
        )

    if not fs or not fs.get("enabled"):
        return {
            "source": "general",
            "base_url": base.get("base_url", ""),
            "model_name": base.get("model_name", ""),
            "api_key": base.get("api_key", ""),
            "temperature": base.get("temperature", 0.7),
            "max_tokens": base.get("max_tokens", 2048),
        }

    return {
        "source": "feature",
        "base_url": (fs.get("base_url") or "").strip() or base.get("base_url", ""),
        "model_name": (fs.get("model_name") or "").strip() or base.get("model_name", ""),
        "api_key": (fs.get("api_key") or "").strip() or base.get("api_key", ""),
        "temperature": fs.get("temperature", 0.7),
        "max_tokens": fs.get("max_tokens", 2048),
    }


def make_provider_for_feature(conn, feature: str | None) -> OpenAICompatibleProvider:
    """Build a provider for a feature, applying override/fallback resolution.

    Raises ValueError (not HTTPException) so routers can translate it.
    """
    cfg = resolve_feature_config(conn, feature)
    if not cfg["api_key"]:
        raise ValueError("API Key 未配置，请前往设置页填写。")
    if not cfg["model_name"]:
        raise ValueError("Model Name 未配置，请前往设置页填写。")
    return OpenAICompatibleProvider(
        base_url=cfg["base_url"] or "https://api.openai.com/v1",
        api_key=cfg["api_key"],
        model_name=cfg["model_name"],
        temperature=cfg["temperature"],
        max_tokens=cfg["max_tokens"],
    )
