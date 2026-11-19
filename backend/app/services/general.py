"""Open-domain fallback backed by Wikipedia when no document or analytics answer exists.

Campus-specific facts still come only from the ingested corpus or the analytics brain. This
service is used when the local retriever finds nothing and no hosted LLM is configured, so
SAMVIT can still answer general academic and factual questions with a citable source.
"""

from __future__ import annotations

import html
import re
from urllib.parse import quote

import httpx

API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "CampusVerseSAMVIT/1.0 (educational campus assistant; samvit@campus.edu)"}

STOPWORDS = {
    "what", "who", "when", "where", "why", "how", "is", "are", "the", "a", "an", "of", "in", "on",
    "for", "to", "and", "or", "does", "do", "did", "can", "could", "would", "should", "tell", "me",
    "about", "explain", "define", "meaning", "please", "give", "some", "any", "with", "from",
}


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def _topic(question: str) -> str:
    words = [w for w in re.findall(r"[A-Za-z0-9+#.-]+", question) if w.lower() not in STOPWORDS]
    return " ".join(words) or question.strip()


async def lookup(question: str) -> dict | None:
    try:
        return await _lookup(question)
    except Exception:
        return None


async def _lookup(question: str) -> dict | None:
    topic = _topic(question)
    if len(topic) < 3:
        return None
    # trust_env=False: proxy env vars (e.g. NO_PROXY entries like [::1]) crash httpx URL parsing
    async with httpx.AsyncClient(timeout=12, headers=HEADERS, follow_redirects=True, trust_env=False) as client:
        search = await client.get(
            API,
            params={"action": "query", "list": "search", "srsearch": topic, "format": "json", "srlimit": 1},
        )
        search.raise_for_status()
        hits = search.json().get("query", {}).get("search", [])
        if not hits:
            return None
        title = hits[0]["title"]
        summary = await client.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}"
        )
        summary.raise_for_status()
        data = summary.json()
    extract = _clean(data.get("extract") or "")
    if len(extract) < 60 or data.get("type") == "disambiguation":
        return None
    url = (data.get("content_urls") or {}).get("desktop", {}).get("page") or f"https://en.wikipedia.org/wiki/{quote(title)}"
    answer = (
        f"**{title}**\n\n{extract}\n\n"
        "_General knowledge from Wikipedia. For campus-specific policies, fees, dates or student records, "
        "ask about campus documents or your academic analytics instead._"
    )
    return {
        "title": title,
        "answer": answer,
        "source": {
            "doc_id": "wikipedia",
            "title": f"Wikipedia — {title}",
            "page": None,
            "snippet": extract[:300],
            "score": 0.5,
            "url": url,
        },
    }
