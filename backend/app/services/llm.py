import json
from collections.abc import AsyncIterator

import httpx

from ..config import settings


def _endpoint_and_headers() -> tuple[str, dict, str]:
    if settings.llm_mode == "groq":
        return (
            "https://api.groq.com/openai/v1/chat/completions",
            {"Authorization": f"Bearer {settings.groq_api_key}"},
            settings.groq_model,
        )
    if settings.llm_mode == "openai":
        return (
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {settings.openai_api_key}"},
            settings.openai_model,
        )
    raise RuntimeError("No LLM provider configured")


async def stream_chat(messages: list[dict], temperature: float = 0.2, max_tokens: int = 1200) -> AsyncIterator[str]:
    url, headers, model = _endpoint_and_headers()
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": True}
    async with httpx.AsyncClient(timeout=90) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue
                if delta:
                    yield delta


async def complete(messages: list[dict], temperature: float = 0.3, max_tokens: int = 1500) -> str:
    url, headers, model = _endpoint_and_headers()
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


def extract_json(text: str) -> dict | list | None:
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start < 0:
        return None
    end = max(text.rfind("}"), text.rfind("]"))
    if end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
