"""Session runtime utilities for planning, onboarding, and review workflows."""

from __future__ import annotations

import json
from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar

from . import validators
from .db_client import SQLiteClient, SQLiteClientError


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _detect_repo_root() -> Path:
    script_dir = Path(__file__).resolve().parent
    candidate = script_dir.parent
    if (candidate / "db" / "schema.sql").exists() and (candidate / "agents.md").exists():
        return candidate

    cwd_candidate = Path.cwd() / "cmos"
    if (cwd_candidate / "db" / "schema.sql").exists():
        return cwd_candidate

    current = Path.cwd().resolve()
    for _ in range(5):
        probe = current / "cmos"
        if (probe / "db" / "schema.sql").exists():
            return probe
        if current.parent == current:
            break
        current = current.parent

    raise RuntimeError("Cannot find cmos/ directory. Please run from project root.")


def _resolve_repo_root(repo_root: Path | str | None = None) -> Path:
    return Path(repo_root).resolve() if repo_root else _detect_repo_root()


T = TypeVar("T")


@dataclass
class SessionCapture:
    timestamp: str
    category: str
    content: str
    context: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        payload = {
            "timestamp": self.timestamp,
            "category": self.category,
            "content": self.content,
        }
        if self.context:
            payload["context"] = self.context
        return payload


class SessionError(Exception):
    """Base class for session-related failures."""

    def __init__(self, message: str, *, hint: str | None = None, suggestion: str | None = None) -> None:
        super().__init__(message)
        self.hint = hint
        self.suggestion = suggestion


class SessionRuntimeError(SessionError):
    """Raised when session runtime operations fail."""


class ActiveSessionError(SessionError):
    """Raised when attempting to start/modify conflicting sessions."""


class ValidationError(SessionError):
    """Raised when user input fails validation."""


class NoActiveSessionError(SessionError):
    """Raised when an operation requires an active session but none exists."""


class SessionRuntime:
    """Manages lifecycle for non-build sessions backed by the canonical SQLite store."""

    CAPTURE_CATEGORIES = set(validators.CAPTURE_CATEGORIES)
    STALE_SESSION_THRESHOLD_HOURS = 24

    def __init__(
        self,
        *,
        repo_root: Path | str | None = None,
        db_path: Path | str | None = None
    ) -> None:
        self.repo_root = _resolve_repo_root(repo_root)
        self.db_path = Path(db_path) if db_path else self.repo_root / "db" / "cmos.sqlite"
        self.schema_path = self.repo_root / "db" / "schema.sql"
        self.client = SQLiteClient(self.db_path, schema_path=self.schema_path)

    def __enter__(self) -> "SessionRuntime":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:  # pragma: no cover - cleanup
        self.close()

    def close(self) -> None:
        self.client.close()

    def ensure_database(self) -> None:
        status = self.client.health_check()
        if not status.ok:
            raise SessionRuntimeError(
                f"Database health check failed: {status.message}",
                hint="Verify the SQLite file exists and is accessible.",
                suggestion="Run ./cmos/cli.py db show current to inspect the connection.",
            )

    def start_session(
        self,
        session_type: str,
        title: str,
        *,
        agent: str = "assistant",
        sprint_id: str | None = None,
        metadata: Dict[str, Any] | None = None
    ) -> str:
        """Start a new planning/onboarding session."""
        clean_type = self._run_validation(validators.normalize_session_type, session_type)
        clean_title = self._run_validation(validators.normalize_title, title)

        self.ensure_database()
        project_context = self._load_context("project_context")
        master_context = self._load_context("master_context")

        active_session = self._get_active_session(project_context)
        self._assert_no_active_session(active_session)

        try:
            with self.client.transaction() as conn:
                session_id = self._generate_session_id(conn)
                ts = _utc_now()
                conn.execute(
                """
                INSERT INTO sessions (
                    id, type, title, sprint_id, started_at, agent, status, captures, next_steps, metadata
                ) VALUES (
                    :id, :type, :title, :sprint_id, :started_at, :agent, 'active', :captures, NULL, :metadata
                )
                """,
                {
                    "id": session_id,
                    "type": clean_type,
                    "title": clean_title,
                    "sprint_id": sprint_id,
                    "started_at": ts,
                    "agent": agent,
                    "captures": "[]",
                    "metadata": json.dumps(metadata, ensure_ascii=False) if metadata else None,
                },
            )
                self._insert_session_event(
                    conn,
                    {
                        "ts": ts,
                        "agent": agent,
                        "mission": session_id,
                        "action": "start",
                        "status": "active",
                        "summary": clean_title,
                        "next_hint": sprint_id,
                    },
                )
        except SQLiteClientError as error:  # pragma: no cover - exercised via CLI tests
            raise self._translate_db_error(error) from error

        self._set_active_session(
            project_context,
            {
                "id": session_id,
                "type": clean_type,
                "title": clean_title,
                "agent": agent,
                "started_at": ts,
                "sprint_id": sprint_id,
                "captures": [],
            },
        )
        self._record_session_history(
            project_context,
            session_id=session_id,
            session_type=clean_type,
            ts=ts,
            agent=agent,
            summary=f"Started {clean_title}",
            action="start",
        )
        self._update_context_health(project_context, ts=ts, increment_sessions=True)
        self._update_context_health(master_context, ts=ts, increment_sessions=True)
        self._persist_contexts(project_context, master_context, session_id=session_id)
        return session_id

    def capture_insight(
        self,
        session_id: str,
        category: str,
        content: str,
        *,
        context: str | None = None,
        agent: str = "assistant"
    ) -> None:
        """Capture an insight for the active session."""
        normalized_category = self._run_validation(
            validators.normalize_capture_category,
            category,
        )
        clean_content = self._run_validation(validators.normalize_capture_content, content)
        context_text = context.strip() if context else None

        self.ensure_database()
        capture = SessionCapture(
            timestamp=_utc_now(),
            category=normalized_category,
            content=clean_content,
            context=context_text,
        )

        try:
            with self.client.transaction() as conn:
                row = conn.execute(
                    "SELECT status, captures FROM sessions WHERE id = :id",
                    {"id": session_id},
                ).fetchone()
                if not row:
                    raise NoActiveSessionError(
                        f"Session {session_id} does not exist.",
                        suggestion="List sessions with: ./cmos/cli.py session list",
                    )
                if row["status"] != "active":
                    raise ActiveSessionError(
                        f"Session {session_id} is not active.",
                        hint="Only active sessions accept new captures.",
                        suggestion=f"Resume or select another session with: ./cmos/cli.py session list",
                    )

                captures = self._load_capture_list(row.get("captures"))
                captures.append(capture.to_dict())
                conn.execute(
                    "UPDATE sessions SET captures = :captures WHERE id = :id",
                    {"captures": json.dumps(captures, ensure_ascii=False), "id": session_id},
                )
                summary = f"[{normalized_category}] {capture.content}"
                self._insert_session_event(
                    conn,
                    {
                        "ts": capture.timestamp,
                        "agent": agent,
                        "mission": session_id,
                        "action": "capture",
                        "status": "active",
                        "summary": summary,
                        "next_hint": capture.context,
                    },
                )
        except SQLiteClientError as error:  # pragma: no cover - exercised via CLI tests
            raise self._translate_db_error(error) from error

        project_context = self._load_context("project_context")
        active = self._get_active_session(project_context)
        if active and active.get("id") == session_id:
            cached = active.setdefault("captures", [])
            cached.append(capture.to_dict())
        self._record_session_history(
            project_context,
            session_id=session_id,
            session_type=(active or {}).get("type", "session"),
            ts=capture.timestamp,
            agent=agent,
            summary=f"Captured {normalized_category}",
            action="capture",
        )
        self._update_context_health(project_context, ts=capture.timestamp)
        # Master context changes happen on completion, but we still stamp health for visibility
        master_context = self._load_context("master_context")
        self._update_context_health(master_context, ts=capture.timestamp)
        self._persist_contexts(project_context, master_context, session_id=session_id)

    def complete_session(
        self,
        session_id: str,
        summary: str,
        *,
        next_steps: Optional[List[str]] = None,
        agent: str = "assistant"
    ) -> None:
        """Complete an active session and aggregate captures into master context."""
        clean_summary = self._run_validation(validators.normalize_summary, summary)
        clean_next_steps = self._run_validation(validators.normalize_next_steps, next_steps)

        self.ensure_database()
        completed_at = _utc_now()
        try:
            with self.client.transaction() as conn:
                row = conn.execute(
                    """
                    SELECT id, status, type, title, captures, agent AS owner
                      FROM sessions
                     WHERE id = :id
                    """,
                    {"id": session_id},
                ).fetchone()
                if not row:
                    raise NoActiveSessionError(
                        f"Session {session_id} does not exist.",
                        suggestion="List sessions with: ./cmos/cli.py session list",
                    )
                if row["status"] != "active":
                    raise ActiveSessionError(
                        f"Session {session_id} is not active.",
                        hint="Only active sessions can be completed.",
                        suggestion=f"Confirm session status via: ./cmos/cli.py session show {session_id}",
                    )

                captures = self._load_capture_list(row.get("captures"))
                conn.execute(
                    """
                    UPDATE sessions
                       SET status = 'completed',
                           completed_at = :completed_at,
                           summary = :summary,
                           next_steps = :next_steps
                     WHERE id = :id
                    """,
                    {
                        "id": session_id,
                        "completed_at": completed_at,
                        "summary": clean_summary,
                        "next_steps": json.dumps(clean_next_steps, ensure_ascii=False)
                        if clean_next_steps
                        else None,
                    },
                )
                self._insert_session_event(
                    conn,
                    {
                        "ts": completed_at,
                        "agent": agent,
                        "mission": session_id,
                        "action": "complete",
                        "status": "completed",
                        "summary": clean_summary,
                        "next_hint": "; ".join(clean_next_steps) if clean_next_steps else None,
                    },
                )
        except SQLiteClientError as error:  # pragma: no cover - exercised via CLI tests
            raise self._translate_db_error(error) from error

        project_context = self._load_context("project_context")
        master_context = self._load_context("master_context")

        self._clear_active_session(project_context, session_id)
        self._record_session_history(
            project_context,
            session_id=session_id,
            session_type=row.get("type", "session"),
            ts=completed_at,
            agent=agent,
            summary=clean_summary,
            action="complete",
        )
        capture_counts = self._apply_captures_to_master(master_context, captures, session_id)
        self._append_recent_session(
            project_context,
            row,
            clean_summary,
            completed_at,
            capture_summary=capture_counts,
        )
        self._append_recent_session(
            master_context,
            row,
            clean_summary,
            completed_at,
            target_key="recent_sessions",
            under_working_memory=False,
            capture_summary=capture_counts,
            limit=10,
        )
        if clean_next_steps:
            self._record_next_steps(project_context, master_context, session_id, clean_next_steps)

        self._update_context_health(project_context, ts=completed_at, increment_sessions=True)
        self._update_context_health(master_context, ts=completed_at, increment_sessions=True)
        self._persist_contexts(
            project_context,
            master_context,
            session_id=session_id,
            snapshot_source=f"session_complete:{session_id}",
        )

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _load_context(self, context_id: str) -> Dict[str, Any]:
        payload = self.client.get_context(context_id) or {}
        return deepcopy(payload)

    @staticmethod
    def _run_validation(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        try:
            return func(*args, **kwargs)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    @staticmethod
    def _ensure_list(container: Dict[str, Any], key: str) -> List[Any]:
        value = container.get(key)
        if isinstance(value, list):
            return value
        new_list: List[Any] = []
        container[key] = new_list
        return new_list

    def _get_active_session(self, project_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        working = project_context.get("working_memory") or {}
        active = working.get("active_session")
        return active if isinstance(active, dict) else None

    def _assert_no_active_session(self, active_session: Optional[Dict[str, Any]]) -> None:
        if not active_session:
            return
        message, hint, suggestion = self._build_active_session_message(active_session)
        raise ActiveSessionError(message, hint=hint, suggestion=suggestion)

    def _build_active_session_message(
        self,
        active_session: Dict[str, Any]
    ) -> tuple[str, str | None, str | None]:
        session_id = active_session.get("id") or "(unknown)"
        started_at = active_session.get("started_at")
        stale, hours = validators.detect_stale_session(
            started_at,
            threshold_hours=self.STALE_SESSION_THRESHOLD_HOURS,
        )
        readable_hours = f"{hours}h" if hours is not None else "24h"
        if stale:
            message = (
                f"Active session {session_id} has been idle for {readable_hours}. "
                "Use 'session resume' to continue capturing or 'session complete' to finish it."
            )
        else:
            message = (
                f"Active session {session_id} exists. Use 'session resume' to continue or "
                "'session complete' to finish it before starting another."
            )
        hint = "Resume capturing with: ./cmos/cli.py session capture decision \"Update\""
        suggestion = f"Finish it with: ./cmos/cli.py session complete --session {session_id} --summary \"Wrap-up\""
        return message, hint, suggestion

    def _set_active_session(self, project_context: Dict[str, Any], session_info: Dict[str, Any]) -> None:
        working = project_context.setdefault("working_memory", {})
        working["active_session"] = session_info

    def _clear_active_session(self, project_context: Dict[str, Any], session_id: str) -> None:
        working = project_context.setdefault("working_memory", {})
        active = working.get("active_session")
        if isinstance(active, dict) and active.get("id") == session_id:
            working.pop("active_session", None)

    def _record_session_history(
        self,
        project_context: Dict[str, Any],
        *,
        session_id: str,
        session_type: str,
        ts: str,
        agent: str,
        summary: str,
        action: str,
    ) -> None:
        working = project_context.setdefault("working_memory", {})
        history = self._ensure_list(working, "session_history")
        entry = {
            "session": session_id,
            "session_type": session_type,
            "agent": agent,
            "summary": summary,
            "action": action,
            "ts": ts,
        }
        history.append(entry)
        if len(history) > 50:
            del history[:-50]
        working["session_history"] = history
        working["last_session"] = ts
        if action == "start":
            working["session_count"] = int(working.get("session_count") or 0) + 1

    def _record_next_steps(
        self,
        project_context: Dict[str, Any],
        master_context: Dict[str, Any],
        session_id: str,
        next_steps: List[str],
    ) -> None:
        cleaned = [note.strip() for note in next_steps if note and note.strip()]
        if not cleaned:
            return

        working = project_context.setdefault("working_memory", {})
        todo = self._ensure_list(working, "next_steps")
        for note in cleaned:
            entry = f"{session_id}: {note}"
            if entry not in todo:
                todo.append(entry)
        if len(todo) > 25:
            del todo[:-25]

        next_session = master_context.setdefault("next_session_context", {})
        resume = next_session.setdefault("when_we_resume", [])
        for note in cleaned:
            entry = f"{session_id}: {note}"
            if entry not in resume:
                resume.append(entry)
        if len(resume) > 25:
            del resume[:-25]

    def _append_recent_session(
        self,
        context_payload: Dict[str, Any],
        row: Dict[str, Any],
        summary: str,
        completed_at: str,
        *,
        target_key: str = "recent_sessions",
        under_working_memory: bool = True,
        capture_summary: Optional[Dict[str, int]] = None,
        limit: int = 25,
    ) -> None:
        parent = (
            context_payload.setdefault("working_memory", {})
            if under_working_memory
            else context_payload
        )
        container = self._ensure_list(parent, target_key)
        capture_summary = capture_summary or {}
        sanitized = {
            key: value
            for key, value in capture_summary.items()
            if isinstance(value, int) and value > 0
        }
        capture_count = sum(
            value for value in capture_summary.values() if isinstance(value, int) and value > 0
        )
        entry = {
            "id": row.get("id"),
            "session_type": row.get("type"),
            "type": row.get("type"),
            "title": row.get("title"),
            "summary": summary,
            "completed_at": completed_at,
            "capture_count": capture_count,
        }
        if sanitized:
            entry["captures"] = sanitized
        container.append(entry)
        if len(container) > limit:
            del container[:-limit]

    def _apply_captures_to_master(
        self,
        master_context: Dict[str, Any],
        captures: List[Dict[str, Any]],
        session_id: str,
    ) -> Dict[str, int]:
        if not captures:
            return {}

        counts: Counter[str] = Counter()
        decisions = self._ensure_list(master_context, "decisions_made")
        learnings = self._ensure_list(master_context, "learnings")
        constraints = self._ensure_list(master_context, "constraints")
        notes = self._ensure_list(master_context, "context_notes")
        next_session = master_context.setdefault("next_session_context", {})
        resume = self._ensure_list(next_session, "when_we_resume")

        for capture in captures:
            category = (capture.get("category") or "").strip().lower()
            content = (capture.get("content") or "").strip()
            if not content or category not in self.CAPTURE_CATEGORIES:
                continue

            counts[category] += 1
            if category == "decision":
                entry = self._with_session_reference(content, session_id)
                if entry:
                    decisions.append(entry)
            elif category == "learning":
                entry = self._with_session_reference(content, session_id)
                if entry:
                    learnings.append(entry)
            elif category == "constraint":
                if content and not self._constraint_exists(constraints, content):
                    constraints.append(content)
            elif category == "context":
                notes.append(content)
            elif category == "next-step":
                entry = f"{session_id}: {content}"
                if entry not in resume:
                    resume.append(entry)
                    if len(resume) > 25:
                        del resume[:-25]

        return {key: value for key, value in counts.items() if value}

    @staticmethod
    def _with_session_reference(content: str, session_id: str) -> str:
        cleaned = content.strip()
        if not cleaned:
            return ""
        if session_id in cleaned:
            return cleaned
        return f"{cleaned} (from {session_id})"

    @staticmethod
    def _constraint_exists(existing: List[Any], candidate: str) -> bool:
        normalized = candidate.strip().lower()
        for item in existing:
            if isinstance(item, str) and item.strip().lower() == normalized:
                return True
        return False

    def _update_context_health(
        self,
        payload: Dict[str, Any],
        *,
        ts: str,
        increment_sessions: bool = False
    ) -> None:
        health = payload.setdefault("context_health", {})
        if increment_sessions:
            health["sessions_since_reset"] = int(health.get("sessions_since_reset") or 0) + 1
        health["last_update"] = ts
        serialized = json.dumps(payload, ensure_ascii=False)
        size_kb = len(serialized.encode("utf-8")) / 1024
        health["size_kb"] = round(size_kb, 2)
        health.setdefault("size_limit_kb", 100)

    def _persist_contexts(
        self,
        project_context: Dict[str, Any],
        master_context: Dict[str, Any],
        *,
        session_id: str,
        snapshot_source: str | None = None,
    ) -> None:
        source = snapshot_source or "session_runtime"
        self.client.set_context(
            "project_context",
            project_context,
            source_path="",
            session_id=session_id,
            snapshot=True,
            snapshot_source=source,
        )
        self.client.set_context(
            "master_context",
            master_context,
            source_path="",
            session_id=session_id,
            snapshot=True,
            snapshot_source=source,
        )

    @staticmethod
    def _translate_db_error(error: SQLiteClientError) -> SessionRuntimeError:
        return SessionRuntimeError(
            f"Database error: {error}",
            hint="Inspect database health with: ./cmos/cli.py db show current",
            suggestion="Run ./cmos/cli.py db health to verify schema integrity.",
        )

    @staticmethod
    def _load_capture_list(raw: Any) -> List[Dict[str, Any]]:
        if not raw:
            return []
        if isinstance(raw, list):
            return raw
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        return parsed if isinstance(parsed, list) else []

    @staticmethod
    def _insert_session_event(conn: Any, event: Dict[str, Any]) -> None:
        raw_event = json.dumps(event, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO session_events (
                ts, agent, mission, action, status, summary, next_hint, raw_event
            ) VALUES (
                :ts, :agent, :mission, :action, :status, :summary, :next_hint, :raw_event
            )
            """,
            {
                "ts": event.get("ts"),
                "agent": event.get("agent"),
                "mission": event.get("mission"),
                "action": event.get("action"),
                "status": event.get("status"),
                "summary": event.get("summary"),
                "next_hint": event.get("next_hint"),
                "raw_event": raw_event,
            },
        )

    @staticmethod
    def _generate_session_id(conn: Any) -> str:
        date_part = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        prefix = f"PS-{date_part}-"
        row = conn.execute(
            "SELECT id FROM sessions WHERE id LIKE :prefix ORDER BY id DESC LIMIT 1",
            {"prefix": f"{prefix}%"},
        ).fetchone()
        if row and isinstance(row.get("id"), str):
            try:
                last_counter = int(row["id"].split("-")[-1])
            except (ValueError, IndexError):
                last_counter = 0
        else:
            last_counter = 0
        return f"{prefix}{last_counter + 1:03d}"


def start(
    session_type: str,
    title: str,
    *,
    agent: str = "assistant",
    sprint_id: str | None = None,
    metadata: Dict[str, Any] | None = None,
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None,
) -> str:
    """Convenience helper to start a session without managing the runtime context."""
    with SessionRuntime(repo_root=repo_root, db_path=db_path) as runtime:
        return runtime.start_session(
            session_type=session_type,
            title=title,
            agent=agent,
            sprint_id=sprint_id,
            metadata=metadata,
        )


def capture(
    session_id: str,
    category: str,
    content: str,
    *,
    context: str | None = None,
    agent: str = "assistant",
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None,
) -> None:
    """Convenience helper to capture an insight for a session."""
    with SessionRuntime(repo_root=repo_root, db_path=db_path) as runtime:
        runtime.capture_insight(
            session_id=session_id,
            category=category,
            content=content,
            context=context,
            agent=agent,
        )


def complete(
    session_id: str,
    summary: str,
    *,
    next_steps: Optional[List[str]] = None,
    agent: str = "assistant",
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None,
) -> None:
    """Convenience helper to complete a session."""
    with SessionRuntime(repo_root=repo_root, db_path=db_path) as runtime:
        runtime.complete_session(
            session_id=session_id,
            summary=summary,
            next_steps=next_steps,
            agent=agent,
        )
