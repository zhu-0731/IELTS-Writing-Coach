from typing import Protocol, Any
import httpx
import json


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

    def chat(self, messages: list[dict], **kwargs) -> str:
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
        }
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    def chat_json(self, messages: list[dict], schema: dict, **kwargs) -> dict:
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "response_format": {"type": "json_object"},
        }
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            return _parse_json_loose(raw)


def make_provider_from_db(row) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        base_url=row["base_url"],
        api_key=row["api_key"],
        model_name=row["model_name"],
        temperature=row["temperature"],
        max_tokens=row["max_tokens"],
    )
