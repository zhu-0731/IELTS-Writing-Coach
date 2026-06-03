from typing import Protocol, Any
import httpx
import json


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
            return json.loads(raw)


def make_provider_from_db(row) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        base_url=row["base_url"],
        api_key=row["api_key"],
        model_name=row["model_name"],
        temperature=row["temperature"],
        max_tokens=row["max_tokens"],
    )
