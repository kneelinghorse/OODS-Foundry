"""Validation helpers for session/context workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Optional, Sequence, Tuple

ALLOWED_SESSION_TYPES: Tuple[str, ...] = (
    "onboarding",
    "planning",
    "review",
    "research",
    "check-in",
    "custom",
)

CAPTURE_CATEGORIES: Tuple[str, ...] = (
    "decision",
    "learning",
    "constraint",
    "context",
    "next-step",
)

MAX_CAPTURE_LENGTH = 1000
MAX_NEXT_STEP_LENGTH = 500


def _normalize_choice(value: str, allowed: Iterable[str], field: str) -> str:
    cleaned = (value or "").strip().lower()
    if not cleaned:
        raise ValueError(f"{field} must be provided.")
    allowed_set = {item.lower(): item for item in allowed}
    if cleaned not in allowed_set:
        readable = ", ".join(sorted(allowed_set.values()))
        raise ValueError(f"Invalid {field} '{value}'. Valid options: {readable}.")
    return cleaned


def _normalize_text(value: str, field: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{field} must be provided.")
    return cleaned


def normalize_session_type(value: str) -> str:
    return _normalize_choice(value, ALLOWED_SESSION_TYPES, "session type")


def normalize_capture_category(value: str) -> str:
    return _normalize_choice(value, CAPTURE_CATEGORIES, "category")


def normalize_capture_content(content: str) -> str:
    cleaned = _normalize_text(content, "content")
    if len(cleaned) > MAX_CAPTURE_LENGTH:
        raise ValueError(f"content exceeds {MAX_CAPTURE_LENGTH} characters.")
    return cleaned


def normalize_summary(summary: str) -> str:
    return _normalize_text(summary, "summary")


def normalize_title(title: str) -> str:
    return _normalize_text(title, "title")


def normalize_next_steps(next_steps: Sequence[str] | None) -> List[str]:
    if not next_steps:
        return []
    cleaned: List[str] = []
    for raw in next_steps:
        if not isinstance(raw, str):
            continue
        note = raw.strip()
        if not note:
            continue
        if len(note) > MAX_NEXT_STEP_LENGTH:
            raise ValueError(
                f"next step '{note[:25]}...' exceeds {MAX_NEXT_STEP_LENGTH} characters."
            )
        cleaned.append(note)
    return cleaned


def detect_stale_session(
    started_at: Optional[str],
    *,
    threshold_hours: int = 24
) -> Tuple[bool, Optional[int]]:
    if not started_at:
        return False, None
    parsed = _parse_iso(started_at)
    if not parsed:
        return False, None
    now = datetime.now(tz=timezone.utc)
    delta = now - parsed.astimezone(timezone.utc)
    hours = int(delta.total_seconds() // 3600)
    if hours < 0:
        hours = 0
    return hours >= threshold_hours, hours


def _parse_iso(value: str) -> Optional[datetime]:
    cleaned = (value or "").strip()
    if not cleaned:
        return None
    normalized = cleaned.replace("Z", "+00:00") if cleaned.endswith("Z") else cleaned
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None
