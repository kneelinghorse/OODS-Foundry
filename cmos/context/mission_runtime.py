"""Mission runtime utilities backed by the canonical SQLite store."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import yaml

from .db_client import SQLiteClient


def utc_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_metadata(metadata: Optional[str]) -> Dict[str, Any]:
    if not metadata:
        return {}
    try:
        parsed = json.loads(metadata)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _format_metadata(metadata: Dict[str, Any]) -> Optional[str]:
    return json.dumps(metadata, ensure_ascii=False) if metadata else None


def _format_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(value, ensure_ascii=False)


def _load_inline_mapping(line: str) -> Dict[str, Any]:
    start = line.index("{")
    end = line.rindex("}") + 1
    return yaml.safe_load(line[start:end])


def _update_inline_line(line: str, updates: Dict[str, Any]) -> str:
    indent = line[: len(line) - len(line.lstrip())]
    mapping = _load_inline_mapping(line)
    order: List[str] = list(mapping.keys())

    for key, value in updates.items():
        if value is None:
            if key in mapping:
                mapping.pop(key)
                if key in order:
                    order.remove(key)
            continue
        mapping[key] = value
        if key not in order:
            order.append(key)

    formatted = ", ".join(f"{key}: {_format_value(mapping[key])}" for key in order if key in mapping)
    return f"{indent}- {{ {formatted} }}"


@dataclass
class MissionEventResult:
    raw_event: str
    event: Dict[str, Any]
    next_mission: Optional[str] = None


class MissionRuntimeError(RuntimeError):
    """Raised when mission runtime operations fail."""


DEFAULT_REPO_ROOT: Optional[Path] = None


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
        if (current / "cmos" / "db" / "schema.sql").exists():
            return (current / "cmos").resolve()
        if current.parent == current:
            break
        current = current.parent

    raise MissionRuntimeError("Cannot find cmos/ directory. Please run from project root or set repo_root.")


def _resolve_repo_root(repo_root: Path | str | None = None) -> Path:
    global DEFAULT_REPO_ROOT
    if repo_root:
        return Path(repo_root).resolve()
    if DEFAULT_REPO_ROOT is None:
        DEFAULT_REPO_ROOT = _detect_repo_root()
    return DEFAULT_REPO_ROOT


class MissionRuntime:
    """Coordinates mission selection, status transitions, and logging via SQLite."""

    def __init__(
        self,
        *,
        repo_root: Path | str | None = None,
        db_path: Path | str | None = None
    ) -> None:
        self.repo_root = _resolve_repo_root(repo_root)
        
        self.db_path = Path(db_path) if db_path else self.repo_root / "db" / "cmos.sqlite"
        self.schema_path = self.repo_root / "db" / "schema.sql"
        self.telemetry_dir = self.repo_root / "telemetry" / "events"
        self.client = SQLiteClient(self.db_path, schema_path=self.schema_path)

    def __enter__(self) -> "MissionRuntime":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:  # pragma: no cover - resource cleanup
        self.close()

    def close(self) -> None:
        self.client.close()

    def ensure_database(self) -> None:
        status = self.client.health_check()
        self._write_health_event(status)
        if not status.ok:
            raise MissionRuntimeError(f"Database health check failed: {status.message}")

    def _load_context(self, context_id: str) -> Dict[str, Any]:
        payload = self.client.get_context(context_id) or {}
        return deepcopy(payload)

    @staticmethod
    def _session_hint(payload: Dict[str, Any]) -> Optional[str]:
        working = payload.get("working_memory") or {}
        for key in ("current_session", "active_mission", "last_session"):
            value = working.get(key)
            if value:
                return str(value)
        return None

    @staticmethod
    def _ensure_list(container: Dict[str, Any], key: str) -> List[Any]:
        value = container.get(key)
        if isinstance(value, list):
            return value
        new_list: List[Any] = []
        container[key] = new_list
        return new_list

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

    def _touch_working_memory(
        self,
        payload: Dict[str, Any],
        *,
        mission_id: str,
        ts: str,
        agent: str,
        summary: str,
        action: str,
        next_mission: Optional[str] = None
    ) -> None:
        working = payload.setdefault("working_memory", {})
        history = self._ensure_list(working, "session_history")
        history = [item for item in history if isinstance(item, dict)]
        entry = {
            "mission": mission_id,
            "agent": agent,
            "summary": summary,
            "action": action,
            "ts": ts
        }
        history.append(entry)
        if len(history) > 50:
            del history[:-50]
        working["session_history"] = history

        working["last_session"] = ts
        working["session_count"] = int(working.get("session_count") or 0) + 1

        if action == "start":
            working["active_mission"] = mission_id
        elif action == "complete":
            working["active_mission"] = next_mission
            working["last_completed_mission"] = mission_id
        elif action == "blocked":
            working["active_mission"] = None
            working["last_blocked_mission"] = mission_id

        blocked = self._ensure_list(working, "blocked_missions")
        if action == "blocked":
            if mission_id not in blocked:
                blocked.append(mission_id)
        else:
            if mission_id in blocked:
                blocked.remove(mission_id)

    @staticmethod
    def _remove_blocker(next_session: Dict[str, Any], mission_id: str) -> None:
        blockers = next_session.get("blockers") or []
        if isinstance(blockers, list):
            filtered = [item for item in blockers if item.get("mission") != mission_id]
            if filtered:
                next_session["blockers"] = filtered
            else:
                next_session.pop("blockers", None)

        for key in ("important_reminders", "when_we_resume"):
            items = next_session.get(key)
            if isinstance(items, list):
                updated = [item for item in items if mission_id not in json.dumps(item, ensure_ascii=False)]
                if updated:
                    next_session[key] = updated
                else:
                    next_session.pop(key, None)

    def _record_blocker(
        self,
        next_session: Dict[str, Any],
        *,
        mission_id: str,
        ts: str,
        summary: str,
        reason: str,
        needs: Optional[List[str]]
    ) -> None:
        blockers = self._ensure_list(next_session, "blockers")
        blockers = [item for item in blockers if item.get("mission") != mission_id]
        blockers.append(
            {
                "mission": mission_id,
                "recorded_at": ts,
                "summary": summary,
                "reason": reason,
                "needs": needs or []
            }
        )
        next_session["blockers"] = blockers

        reminder = f"{mission_id}: {reason}"
        reminders = self._ensure_list(next_session, "important_reminders")
        if reminder not in reminders:
            reminders.append(reminder)

        if needs:
            resume = self._ensure_list(next_session, "when_we_resume")
            for need in needs:
                note = f"{mission_id} -> {need}"
                if note not in resume:
                    resume.append(note)

    def _persist_contexts(self, project: Dict[str, Any], master: Dict[str, Any], *, session_id: str) -> None:
        """Save contexts to database with snapshot history. No file mirrors."""
        self.client.set_context(
            "project_context",
            project,
            source_path="",  # No file mirror
            session_id=session_id,
            snapshot=True,
            snapshot_source="mission_runtime"
        )
        self.client.set_context(
            "master_context",
            master,
            source_path="",  # No file mirror
            session_id=session_id,
            snapshot=True,
            snapshot_source="mission_runtime"
        )

    def fetch_next_candidate(self) -> Optional[Dict[str, Any]]:
        rows = self.client.fetchall(
            """
            SELECT id, name, status, completed_at, notes, metadata
              FROM missions
             WHERE status IN ('Queued', 'Current', 'In Progress')
             ORDER BY CASE status
                      WHEN 'In Progress' THEN 0
                      WHEN 'Current' THEN 1
                      WHEN 'Queued' THEN 2
                      ELSE 3
                    END,
                    rowid
             LIMIT 1
            """
        )
        return rows[0] if rows else None

    def start_mission(
        self,
        mission_id: str,
        *,
        agent: str,
        summary: str,
        ts: Optional[str] = None
    ) -> MissionEventResult:
        ts = ts or utc_now()
        row = self.client.fetchone(
            "SELECT status, metadata FROM missions WHERE id = :id",
            {"id": mission_id}
        )
        if not row:
            raise MissionRuntimeError(f"Mission {mission_id} not found in database")

        metadata = _parse_metadata(row.get("metadata"))
        metadata["started_at"] = ts

        with self.client.transaction() as conn:
            project_context = self._load_context("project_context")
            master_context = self._load_context("master_context")

            self._touch_working_memory(
                project_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action="start"
            )
            self._touch_working_memory(
                master_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action="start"
            )

            next_session = master_context.setdefault("next_session_context", {})
            self._remove_blocker(next_session, mission_id)

            self._update_context_health(project_context, ts=ts, increment_sessions=True)
            self._update_context_health(master_context, ts=ts, increment_sessions=True)

            conn.execute(
                """
                UPDATE missions
                   SET status = 'In Progress',
                       metadata = :metadata
                 WHERE id = :id
                """,
                {"id": mission_id, "metadata": _format_metadata(metadata)}
            )

            event = {
                "ts": ts,
                "agent": agent,
                "mission": mission_id,
                "action": "start",
                "status": "in_progress",
                "summary": summary
            }
            raw_event = self._insert_session_event(conn, event)

            self._persist_contexts(project_context, master_context, session_id=mission_id)

        # Session event logged to database only
        # No file mirrors maintained
        return MissionEventResult(raw_event=raw_event, event=event)

    def complete_mission(
        self,
        mission_id: str,
        *,
        agent: str,
        summary: str,
        notes: str,
        ts: Optional[str] = None,
        next_hint: Optional[str] = None,
        promote_next: bool = True,
        immediate: bool = False
    ) -> MissionEventResult:
        ts = ts or utc_now()
        row = self.client.fetchone(
            "SELECT metadata FROM missions WHERE id = :id",
            {"id": mission_id}
        )
        if not row:
            raise MissionRuntimeError(f"Mission {mission_id} not found in database")
        metadata = _parse_metadata(row.get("metadata"))
        metadata["completed_at"] = ts

        next_mission_id: Optional[str] = None

        with self.client.transaction() as conn:
            project_context = self._load_context("project_context")
            master_context = self._load_context("master_context")

            conn.execute(
                """
                UPDATE missions
                   SET status = 'Completed',
                       completed_at = :completed_at,
                       notes = :notes,
                       metadata = :metadata
                 WHERE id = :id
                """,
                {
                    "id": mission_id,
                    "completed_at": ts,
                    "notes": notes,
                    "metadata": _format_metadata(metadata)
                }
            )

            if promote_next:
                next_mission_id = self._promote_next_queued(conn, immediate=immediate, started_at=ts if immediate else None)
                if next_mission_id and not next_hint:
                    next_status = "In Progress" if immediate else "Current"
                    next_hint = f"{next_mission_id} is now {next_status}"

            action = "complete"
            self._touch_working_memory(
                project_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action=action,
                next_mission=next_mission_id if immediate else None
            )
            self._touch_working_memory(
                master_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action=action,
                next_mission=next_mission_id if immediate else None
            )

            next_session = master_context.setdefault("next_session_context", {})
            self._remove_blocker(next_session, mission_id)
            if next_mission_id:
                resume = next_session.setdefault("when_we_resume", [])
                if isinstance(resume, list):
                    note = f"Pick up {next_mission_id}"
                    if note not in resume:
                        resume.append(note)

            self._update_context_health(project_context, ts=ts, increment_sessions=True)
            self._update_context_health(master_context, ts=ts, increment_sessions=True)

            event = {
                "ts": ts,
                "agent": agent,
                "mission": mission_id,
                "action": "complete",
                "status": "completed",
                "summary": summary,
                "next_hint": next_hint
            }
            raw_event = self._insert_session_event(conn, event)

            self._persist_contexts(project_context, master_context, session_id=mission_id)

        # Session event logged to database only
        # No file mirrors maintained
        
        backlog_updates = {
            "status": "Completed",
            "completed_at": ts,
            "notes": notes
        }
        self._update_backlog_entry(mission_id, backlog_updates)
        if next_mission_id:
            next_updates = {"status": "In Progress" if immediate else "Current"}
            if not immediate:
                next_updates["started_at"] = None
            else:
                next_updates["started_at"] = ts
            self._update_backlog_entry(next_mission_id, next_updates)

        return MissionEventResult(raw_event=raw_event, event=event, next_mission=next_mission_id)

    def block_mission(
        self,
        mission_id: str,
        *,
        agent: str,
        summary: str,
        reason: str,
        needs: Optional[List[str]] = None,
        ts: Optional[str] = None,
        next_hint: Optional[str] = None
    ) -> MissionEventResult:
        ts = ts or utc_now()
        row = self.client.fetchone(
            "SELECT metadata FROM missions WHERE id = :id",
            {"id": mission_id}
        )
        if not row:
            raise MissionRuntimeError(f"Mission {mission_id} not found in database")
        metadata = _parse_metadata(row.get("metadata"))
        metadata["blocked_at"] = ts
        metadata["blocked_reason"] = reason
        if needs:
            metadata["blocked_needs"] = needs
        else:
            metadata.pop("blocked_needs", None)

        with self.client.transaction() as conn:
            project_context = self._load_context("project_context")
            master_context = self._load_context("master_context")

            conn.execute(
                """
                UPDATE missions
                   SET status = 'Blocked',
                       completed_at = NULL,
                       notes = :notes,
                       metadata = :metadata
                 WHERE id = :id
                """,
                {
                    "id": mission_id,
                    "notes": reason,
                    "metadata": _format_metadata(metadata)
                }
            )
            event = {
                "ts": ts,
                "agent": agent,
                "mission": mission_id,
                "action": "blocked",
                "status": "blocked",
                "summary": summary,
                "next_hint": next_hint,
                "needs": needs or [],
                "reason": reason
            }
            raw_event = self._insert_session_event(conn, event)

            self._touch_working_memory(
                project_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action="blocked"
            )
            self._touch_working_memory(
                master_context,
                mission_id=mission_id,
                ts=ts,
                agent=agent,
                summary=summary,
                action="blocked"
            )

            next_session = master_context.setdefault("next_session_context", {})
            self._record_blocker(
                next_session,
                mission_id=mission_id,
                ts=ts,
                summary=summary,
                reason=reason,
                needs=needs
            )

            self._update_context_health(project_context, ts=ts, increment_sessions=True)
            self._update_context_health(master_context, ts=ts, increment_sessions=True)

            self._persist_contexts(project_context, master_context, session_id=mission_id)

        # Session event logged to database only
        # No file mirrors maintained
        return MissionEventResult(raw_event=raw_event, event=event)

    def _insert_session_event(self, connection: Any, event: Dict[str, Any]) -> str:
        raw_event = json.dumps(event, ensure_ascii=False)
        connection.execute(
            """
            INSERT INTO session_events (ts, agent, mission, action, status, summary, next_hint, raw_event)
            VALUES (:ts, :agent, :mission, :action, :status, :summary, :next_hint, :raw_event)
            """,
            {
                "ts": event.get("ts"),
                "agent": event.get("agent"),
                "mission": event.get("mission"),
                "action": event.get("action"),
                "status": event.get("status"),
                "summary": event.get("summary"),
                "next_hint": event.get("next_hint"),
                "raw_event": raw_event
            }
        )
        return raw_event

    # FILE MIRROR METHODS REMOVED - DB is single source of truth
    # Use db_tools.py export commands to generate files on-demand

    def _promote_next_queued(
        self,
        connection: Any,
        *,
        immediate: bool,
        started_at: Optional[str]
    ) -> Optional[str]:
        row = connection.execute(
            """
            SELECT id, metadata
              FROM missions
             WHERE status = 'Queued'
             ORDER BY rowid
             LIMIT 1
            """
        ).fetchone()
        if not row:
            return None

        metadata = _parse_metadata(row["metadata"])
        if immediate and started_at:
            metadata["started_at"] = started_at
        else:
            metadata.pop("started_at", None)

        new_status = "In Progress" if immediate else "Current"
        connection.execute(
            """
            UPDATE missions
               SET status = :status,
                   metadata = :metadata
             WHERE id = :id
            """,
            {
                "id": row["id"],
                "status": new_status,
                "metadata": _format_metadata(metadata)
            }
        )
        return row["id"]

    def _update_backlog_entry(self, mission_id: str, updates: Dict[str, Any]) -> None:
        """Stub method - no longer updates backlog.yaml file.
        
        Mission updates happen in database transaction (already handled).
        Use db_tools.py export-backlog to generate backlog.yaml on-demand.
        """
        pass

    def _write_health_event(self, status: Any) -> None:
        payload = {
            "ts": utc_now(),
            "source": "mission_runtime",
            "status": "ok" if status.ok else "error",
            "message": status.message,
            "details": status.details
        }
        self.telemetry_dir.mkdir(parents=True, exist_ok=True)
        health_path = self.telemetry_dir / "database-health.jsonl"
        with health_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False))
            handle.write("\n")


def _runtime_operation(
    operation: Callable[[MissionRuntime], Any],
    *,
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None
) -> Any:
    runtime = MissionRuntime(repo_root=repo_root, db_path=db_path)
    runtime.ensure_database()
    try:
        return operation(runtime)
    finally:
        runtime.close()


def next_mission(*, repo_root: Path | str | None = None, db_path: Path | str | None = None) -> Optional[Dict[str, Any]]:
    return _runtime_operation(lambda runtime: runtime.fetch_next_candidate(), repo_root=repo_root, db_path=db_path)


def start(
    mission_id: str,
    *,
    summary: str,
    agent: str = "codex",
    ts: Optional[str] = None,
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None
) -> MissionEventResult:
    return _runtime_operation(
        lambda runtime: runtime.start_mission(
            mission_id,
            agent=agent,
            summary=summary,
            ts=ts
        ),
        repo_root=repo_root,
        db_path=db_path
    )


def complete(
    mission_id: str,
    *,
    summary: str,
    notes: str,
    agent: str = "codex",
    ts: Optional[str] = None,
    next_hint: Optional[str] = None,
    promote_next: bool = True,
    immediate: bool = False,
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None
) -> MissionEventResult:
    return _runtime_operation(
        lambda runtime: runtime.complete_mission(
            mission_id,
            agent=agent,
            summary=summary,
            notes=notes,
            ts=ts,
            next_hint=next_hint,
            promote_next=promote_next,
            immediate=immediate
        ),
        repo_root=repo_root,
        db_path=db_path
    )


def block(
    mission_id: str,
    *,
    summary: str,
    reason: str,
    needs: Optional[List[str]] = None,
    agent: str = "codex",
    ts: Optional[str] = None,
    next_hint: Optional[str] = None,
    repo_root: Path | str | None = None,
    db_path: Path | str | None = None
) -> MissionEventResult:
    return _runtime_operation(
        lambda runtime: runtime.block_mission(
            mission_id,
            agent=agent,
            summary=summary,
            reason=reason,
            needs=needs,
            ts=ts,
            next_hint=next_hint
        ),
        repo_root=repo_root,
        db_path=db_path
    )


__all__ = [
    "MissionRuntime",
    "MissionRuntimeError",
    "MissionEventResult",
    "utc_now",
    "next_mission",
    "start",
    "complete",
    "block"
]
