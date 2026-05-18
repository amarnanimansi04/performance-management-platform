import hashlib
import json
import os
from typing import Optional

from groq import Groq

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _client


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


async def score_goal_quality(
    goal_text: str,
    supabase,
    goal_id: Optional[str] = None,
) -> dict:
    text_hash = _hash_text(goal_text)

    cached_row = (
        supabase.table("ai_evaluations")
        .select("score, tip")
        .eq("text_hash", text_hash)
        .maybe_single()
        .execute()
    )

    if cached_row.data:
        return {
            "score": cached_row.data["score"],
            "tip": cached_row.data["tip"],
            "cached": True,
        }

    prompt = (
        "You are a goal quality evaluator. Given the following goal description, "
        "return a JSON object with:\n"
        "- score (integer 0-100): how well-written and SMART the goal is\n"
        "- tip (string): one concise improvement tip\n\n"
        f"Goal: {goal_text}\n\n"
        "Respond ONLY with valid JSON."
    )

    client = _get_client()
    response = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    raw = response.choices[0].message.content
    result = json.loads(raw)
    score = int(result.get("score", 50))
    tip = result.get("tip", "")

    supabase.table("ai_evaluations").insert(
        {"text_hash": text_hash, "goal_text": goal_text, "score": score, "tip": tip}
    ).execute()

    if goal_id:
        supabase.table("goals").update({"quality_score": score}).eq(
            "id", goal_id
        ).execute()

    return {"score": score, "tip": tip, "cached": False}
