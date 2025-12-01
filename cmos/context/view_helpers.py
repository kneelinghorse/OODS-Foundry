"""Context view helper utilities for building aggregated project snapshots."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

try:  # pragma: no cover - optional dependency
    import yaml  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    yaml = None

from .db_client import SQLiteClient, SQLiteClientError


CAPTURE_CATEGORIES = {"decision", "learning", "constraint", "context", "next-step"}
SESSION_FETCH_LIMIT = 250


class ContextViewError(RuntimeError):
    """Raised when context view helpers cannot build the requested view."""


@dataclass(frozen=True)
class ContextFilters:
    """Filter parameters for context aggregation operations."""

    as_of: Optional[str] = None
    domain: Optional[str] = None
    recent_limit: int = 10


def get_master_context_view(
    client: SQLiteClient,
    *,
    recent_limit: int = 10,
    limit_sessions: int = SESSION_FETCH_LIMIT,
) -> Dict[str, Any]:
    """Build the current master context view from all completed sessions."""

    builder = _ContextViewBuilder(client)
    filters = ContextFilters(recent_limit=max(1, recent_limit))
    return builder.build(filters, session_limit=limit_sessions)


def get_context_at_point(
    client: SQLiteClient,
    *,
    as_of: str,
    domain: Optional[str] = None,
    recent_limit: int = 10,
) -> Dict[str, Any]:
    """Build the historical context view as of a specific timestamp or session ID."""

    if not as_of:
        raise ContextViewError("as_of value is required for historical context views.")
    builder = _ContextViewBuilder(client)
    filters = ContextFilters(as_of=as_of.strip(), domain=_clean(domain), recent_limit=max(1, recent_limit))
    return builder.build(filters)


def get_domain_view(
    client: SQLiteClient,
    domain: str,
    *,
    as_of: Optional[str] = None,
    recent_limit: int = 10,
) -> Dict[str, Any]:
    """Build a domain-specific context view using the domain stored in session metadata."""

    if not domain or not domain.strip():
        raise ContextViewError("domain must be provided for domain-specific views.")
    builder = _ContextViewBuilder(client)
    filters = ContextFilters(as_of=_clean(as_of), domain=domain.strip(), recent_limit=max(1, recent_limit))
    return builder.build(filters)


def export_context(view: Dict[str, Any], format: str = "json") -> str:
    """Serialize a context view using the requested format."""

    normalized = (format or "json").strip().lower()
    if normalized == "json":
        return json.dumps(view, ensure_ascii=False, indent=2)
    if normalized == "yaml":
        if yaml is None:
            raise ContextViewError("PyYAML is not installed; cannot export YAML.")
        return yaml.safe_dump(view, sort_keys=False, allow_unicode=True)
    if normalized == "markdown":
        return _render_markdown(view)
    raise ContextViewError(f"Unsupported export format '{format}'.")


class _ContextViewBuilder:
    """Builds aggregated context views from canonical session data."""

    def __init__(self, client: SQLiteClient) -> None:
        self.client = client

    def build(self, filters: ContextFilters, *, session_limit: int = SESSION_FETCH_LIMIT) -> Dict[str, Any]:
        sessions, resolved_as_of = self._load_sessions(filters, session_limit=session_limit)
        base_master = self.client.get_context("master_context") or {}
        project_identity = (base_master.get("project_identity") or {}).copy()
        project_identity.setdefault("name", project_identity.get("name") or "CMOS Project")

        aggregates = _aggregate_sessions(sessions)
        metrics = aggregates["metrics"]
        view: Dict[str, Any] = {
            "project_identity": {
                **project_identity,
                "session_count": metrics["session_count"],
                "sprint_count": metrics["sprint_count"],
                "last_activity": metrics.get("last_activity"),
            },
            "view_parameters": {
                "as_of": resolved_as_of or aggregates["as_of"],
                "domain": filters.domain or "all",
                "recent_limit": filters.recent_limit,
                "sessions_considered": metrics["sessions_considered"],
            },
            "aggregated_insights": {
                "total_decisions": len(aggregates["decisions"]),
                "total_learnings": len(aggregates["learnings"]),
                "total_constraints": len(aggregates["constraints"]),
                "capture_totals": aggregates["capture_totals"],
                "by_sprint": aggregates["by_sprint"],
            },
            "decisions_made": aggregates["decisions"],
            "learnings": aggregates["learnings"],
            "constraints": aggregates["constraints"],
            "context_notes": aggregates["context_notes"],
            "recent_sessions": aggregates["recent_sessions"][: filters.recent_limit],
            "pending_next_steps": aggregates["next_steps"],
        }
        return view

    def _load_sessions(
        self,
        filters: ContextFilters,
        *,
        session_limit: int,
    ) -> tuple[List[Dict[str, Any]], Optional[str]]:
        as_of_payload = self._normalize_as_of(filters.as_of) if filters.as_of else None
        as_of_ts = as_of_payload.get("timestamp") if as_of_payload else None
        params: Dict[str, Any] = {"status": "completed"}
        clauses = ["status = :status"]
        if as_of_ts:
            clauses.append("COALESCE(completed_at, started_at) <= :as_of")
            params["as_of"] = as_of_ts
        where_clause = " AND ".join(clauses)
        query = f"""
            SELECT rowid as _rowid, id, type, title, sprint_id, started_at, completed_at, summary,
                   captures, next_steps, metadata
              FROM sessions
             WHERE {where_clause}
             ORDER BY COALESCE(completed_at, started_at)
             LIMIT :limit
        """
        params["limit"] = max(1, session_limit)

        try:
            rows = self.client.fetchall(query, params)
        except SQLiteClientError as exc:  # pragma: no cover - database error surface
            raise ContextViewError(str(exc)) from exc

        filtered: List[Dict[str, Any]] = []
        for row in rows:
            metadata = _load_json_dict(row.get("metadata"))
            domain = metadata.get("domain") or metadata.get("project_domain")
            if filters.domain and domain and domain.lower() != filters.domain.lower():
                continue
            if filters.domain and not domain:
                # Skip sessions without explicit domain when a filter is applied
                continue

            session_ts = row.get("completed_at") or row.get("started_at")
            if as_of_ts and session_ts and session_ts > as_of_ts:
                continue
            if (
                as_of_payload
                and as_of_payload.get("session_id")
                and session_ts == as_of_ts
                and row.get("id")
                and row["id"] > as_of_payload["session_id"]
            ):
                continue

            filtered.append(
                {
                    "_rowid": row.get("_rowid"),
                    "id": row.get("id"),
                    "type": row.get("type"),
                    "title": row.get("title"),
                    "sprint_id": row.get("sprint_id"),
                    "started_at": row.get("started_at"),
                    "completed_at": row.get("completed_at"),
                    "summary": row.get("summary"),
                    "captures": _load_json_array(row.get("captures")),
                    "next_steps": _load_json_array(row.get("next_steps")),
                    "metadata": metadata,
                }
            )

        return filtered, as_of_ts

    def _normalize_as_of(self, as_of_value: str) -> Dict[str, Optional[str]]:
        candidate = as_of_value.strip()
        if not candidate:
            raise ContextViewError("as_of value cannot be empty.")
        if candidate.upper().startswith("PS-"):
            row = self.client.fetchone(
                """
                SELECT COALESCE(completed_at, started_at) AS ts
                  FROM sessions
                 WHERE id = :session_id
                """,
                {"session_id": candidate},
            )
            if not row or not row.get("ts"):
                raise ContextViewError(f"Session {candidate} not found for as_of filter.")
            return {
                "timestamp": _normalize_timestamp(row["ts"]),
                "session_id": candidate,
            }
        return {"timestamp": _normalize_timestamp(candidate), "session_id": None}


def _aggregate_sessions(sessions: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    decisions: List[str] = []
    learnings: List[str] = []
    constraints: List[str] = []
    context_notes: List[str] = []
    next_steps: List[str] = []
    capture_totals: Counter[str] = Counter()
    constraint_seen: set[str] = set()
    by_sprint: Dict[str, Dict[str, int]] = {}
    recent_sessions: List[Dict[str, Any]] = []

    last_activity: Optional[str] = None
    sprint_ids: set[str] = set()

    for session in sessions:
        session_ts = session.get("completed_at") or session.get("started_at")
        last_activity = session_ts or last_activity
        sprint_id = session.get("sprint_id") or "unspecified"
        sprint_ids.add(sprint_id)

        capture_counts: Counter[str] = Counter()
        for capture in session.get("captures", []):
            category = (capture.get("category") or "").strip().lower()
            content = (capture.get("content") or "").strip()
            if not content or category not in CAPTURE_CATEGORIES:
                continue
            capture_counts[category] += 1
            capture_totals[category] += 1
            if category == "decision":
                decisions.append(_with_session_reference(content, session.get("id")))
            elif category == "learning":
                learnings.append(_with_session_reference(content, session.get("id")))
            elif category == "constraint":
                normalized = content.lower()
                if normalized not in constraint_seen:
                    constraints.append(content)
                    constraint_seen.add(normalized)
            elif category == "context":
                context_notes.append(content)

        for step in session.get("next_steps", []):
            step_text = (step or "").strip()
            if step_text:
                next_steps.append(f"{session.get('id')}: {step_text}")

        by_sprint.setdefault(sprint_id, {"sessions": 0, "decisions": 0, "learnings": 0, "constraints": 0})
        by_sprint[sprint_id]["sessions"] += 1
        by_sprint[sprint_id]["decisions"] += capture_counts.get("decision", 0)
        by_sprint[sprint_id]["learnings"] += capture_counts.get("learning", 0)
        by_sprint[sprint_id]["constraints"] += capture_counts.get("constraint", 0)

        recent_sessions.append(
            {
                "id": session.get("id"),
                "session_type": session.get("type"),
                "title": session.get("title"),
                "completed_at": session.get("completed_at"),
                "sprint_id": None if sprint_id == "unspecified" else sprint_id,
                "summary": session.get("summary"),
                "capture_count": sum(capture_counts.values()),
                "captures": {k: v for k, v in capture_counts.items() if v},
                "domain": session.get("metadata", {}).get("domain"),
            }
        )

    return {
        "decisions": decisions,
        "learnings": learnings,
        "constraints": constraints,
        "context_notes": context_notes,
        "recent_sessions": list(reversed(recent_sessions))[: SESSION_FETCH_LIMIT],
        "next_steps": next_steps[-25:],
        "capture_totals": dict(sorted(capture_totals.items())),
        "by_sprint": {k: v for k, v in sorted(by_sprint.items())},
        "as_of": last_activity,
        "metrics": {
            "session_count": len(sessions),
            "sprint_count": len([s for s in sprint_ids if s != "unspecified"]),
            "last_activity": last_activity,
            "sessions_considered": len(sessions),
        },
    }


def _render_markdown(view: Dict[str, Any]) -> str:
    project = view.get("project_identity", {})
    params = view.get("view_parameters", {})
    insights = view.get("aggregated_insights", {})
    lines: List[str] = []
    lines.append(f"# Context View — {project.get('name', 'CMOS Project')}")
    lines.append("")
    lines.append(f"- Sessions considered: {params.get('sessions_considered', 0)}")
    lines.append(f"- Domain: {params.get('domain', 'all')}")
    if params.get("as_of"):
        lines.append(f"- As of: {params['as_of']}")
    if project.get("last_activity"):
        lines.append(f"- Last activity: {project['last_activity']}")
    lines.append("")
    lines.append("## Aggregated Insights")
    lines.append(f"- Decisions: {insights.get('total_decisions', 0)}")
    lines.append(f"- Learnings: {insights.get('total_learnings', 0)}")
    lines.append(f"- Constraints: {insights.get('total_constraints', 0)}")
    lines.append("")
    if view.get("decisions_made"):
        lines.append("### Decisions")
        for entry in view["decisions_made"][:10]:
            lines.append(f"- {entry}")
        lines.append("")
    if view.get("learnings"):
        lines.append("### Learnings")
        for entry in view["learnings"][:10]:
            lines.append(f"- {entry}")
        lines.append("")
    if view.get("constraints"):
        lines.append("### Constraints")
        for entry in view["constraints"][:10]:
            lines.append(f"- {entry}")
        lines.append("")
    if view.get("recent_sessions"):
        lines.append("## Recent Sessions")
        for sess in view["recent_sessions"]:
            detail = f"- {sess.get('id')}: {sess.get('title')}" \
                f" ({sess.get('session_type')}) — captures: {sess.get('capture_count', 0)}"
            lines.append(detail)
        lines.append("")
    if view.get("pending_next_steps"):
        lines.append("## Pending Next Steps")
        for step in view["pending_next_steps"]:
            lines.append(f"- {step}")
    return "\n".join(lines).strip()


def _normalize_timestamp(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContextViewError(f"Invalid timestamp '{value}'. Use ISO-8601 or a session ID.") from exc
    dt = dt.astimezone(timezone.utc).replace(tzinfo=timezone.utc, microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def _with_session_reference(content: str, session_id: Optional[str]) -> str:
    if not session_id:
        return content
    if session_id in content:
        return content
    return f"{content} (from {session_id})"


def _load_json_array(raw: Any) -> List[Any]:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return []
    return payload if isinstance(payload, list) else []


def _load_json_dict(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _clean(value: Optional[str]) -> Optional[str]:
    return value.strip() if value else None
