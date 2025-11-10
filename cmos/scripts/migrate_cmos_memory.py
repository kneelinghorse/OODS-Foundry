#!/usr/bin/env python3
"""Migrate CMOS v1 memory/context mirrors into a CMOS v2 workspace."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


def _find_cmos_root() -> Path:
    """Find cmos/ directory from any working directory."""
    script_dir = Path(__file__).resolve().parent
    candidate = script_dir.parent
    if (candidate / "db" / "schema.sql").exists() and (candidate / "agents.md").exists():
        return candidate
    if (Path.cwd() / "cmos" / "db" / "schema.sql").exists():
        return Path.cwd() / "cmos"
    current = Path.cwd().resolve()
    for _ in range(5):
        if (current / "cmos" / "db" / "schema.sql").exists():
            return current / "cmos"
        if current.parent == current:
            break
        current = current.parent
    raise RuntimeError("Cannot find cmos/ directory. Please run from project root.")


CMOS_ROOT = _find_cmos_root()
if str(CMOS_ROOT) not in sys.path:
    sys.path.insert(0, str(CMOS_ROOT))

from context.db_client import SQLiteClient

try:
    import yaml  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    yaml = None


def _default_paths(script_path: Path) -> Tuple[Path, Path]:
    scripts_dir = script_path.parent
    project_dir = scripts_dir.parent
    repo_root = project_dir.parent
    source = repo_root / "cmos"
    target = project_dir
    return source, target


def _parse_args() -> argparse.Namespace:
    script_path = Path(__file__).resolve()
    default_source, default_target = _default_paths(script_path)

    parser = argparse.ArgumentParser(
        description="Migrate CMOS v1 memory/context files into a CMOS v2 checkout."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=default_source,
        help="Path to CMOS v1 workspace (default: sibling 'cmos').",
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=default_target,
        help="Path to CMOS v2 workspace (default: current project root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview merged payloads without writing to disk.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating timestamped backups of target files before writing.",
    )
    parser.add_argument(
        "--skip-files",
        action="store_true",
        help="Do not update flat-file mirrors; operate on the database only.",
    )
    parser.add_argument(
        "--sync-db",
        action="store_true",
        help="Update the SQLite database (db/cmos.sqlite) after migrating files.",
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=None,
        help="Override path to SQLite database (default: <target>/db/cmos.sqlite).",
    )
    parser.add_argument(
        "--source-db",
        type=Path,
        default=None,
        help="Optional SQLite database containing contexts/session data to migrate (contexts table expected).",
    )
    return parser.parse_args()


def _resolve_file(root: Path, candidates: Iterable[str], description: str) -> Path:
    for name in candidates:
        candidate = root / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"Could not locate {description}. Checked: {', '.join(str(root / name) for name in candidates)}"
    )


def _load_json(path: Path) -> Dict[str, Any]:
    if not path.exists() or path.stat().st_size == 0:
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, indent=2)
    path.write_text(f"{serialized}\n", encoding="utf-8")


def _load_context_from_db(db_path: Path, context_id: str) -> Dict[str, Any]:
    if not db_path.exists():
        raise FileNotFoundError(f"Source database not found: {db_path}")
    connection = sqlite3.connect(str(db_path))
    try:
        cursor = connection.execute(
            "SELECT content FROM contexts WHERE id = ? ORDER BY updated_at DESC LIMIT 1",
            (context_id,),
        )
        row = cursor.fetchone()
        if not row or not row[0]:
            return {}
        return json.loads(row[0])
    finally:
        connection.close()


def _load_sessions_from_db(db_path: Path) -> List[Dict[str, Any]]:
    if not db_path.exists():
        raise FileNotFoundError(f"Source database not found: {db_path}")
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            "SELECT ts, agent, mission, action, status, summary, next_hint, raw_event FROM session_events ORDER BY id"
        ).fetchall()
    finally:
        connection.close()

    events: List[Dict[str, Any]] = []
    for row in rows:
        raw_event = row["raw_event"]
        if raw_event:
            try:
                payload = json.loads(raw_event)
            except json.JSONDecodeError:
                payload = {}
        else:
            payload = {}

        for key in ("ts", "timestamp"):
            if key not in payload or not payload[key]:
                payload[key] = row["ts"]
        payload.setdefault("agent", row["agent"])
        payload.setdefault("mission", row["mission"])
        payload.setdefault("action", row["action"])
        payload.setdefault("status", row["status"])
        payload.setdefault("summary", row["summary"])
        if row["next_hint"]:
            payload.setdefault("next_hint", row["next_hint"])
        payload.setdefault("__raw__", raw_event or json.dumps({k: payload.get(k) for k in payload if k != "__raw__"}))
        events.append(payload)
    return events


def _load_sessions(path: Path) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    if not path.exists():
        return entries
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError as exc:
                try:
                    parsed = _parse_loose_mapping(stripped)
                except ValueError:
                    if yaml is None:
                        raise ValueError(f"Invalid JSONL entry in {path}: {stripped}") from exc
                    try:
                        loaded = yaml.safe_load(stripped)
                    except yaml.YAMLError as yaml_exc:  # type: ignore[attr-defined]
                        raise ValueError(f"Invalid JSONL entry in {path}: {stripped}") from yaml_exc
                    if not isinstance(loaded, dict):
                        raise ValueError(f"Unsupported session entry in {path}: {stripped}")
                    parsed = loaded
            parsed["__raw__"] = stripped
            entries.append(parsed)
    return entries


def _write_sessions(path: Path, entries: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps({k: v for k, v in item.items() if k != "__raw__"}) for item in entries]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def _parse_loose_mapping(payload: str) -> Dict[str, Any]:
    trimmed = payload.strip()
    if not trimmed.startswith("{") or not trimmed.endswith("}"):
        raise ValueError("Unsupported loose mapping format")
    body = trimmed[1:-1]
    segments: List[str] = []
    start = 0
    depth = 0
    in_quotes = False
    prev_char = ""
    for index, char in enumerate(body):
        if char == "\"" and prev_char != "\\":
            in_quotes = not in_quotes
        if in_quotes:
            prev_char = char
            continue
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            segments.append(body[start:index])
            start = index + 1
        prev_char = char
    segments.append(body[start:])

    result: Dict[str, Any] = {}
    for segment in segments:
        if not segment.strip():
            continue
        if ":" not in segment:
            raise ValueError("Loose mapping entry missing colon")
        key, raw_value = segment.split(":", 1)
        key = key.strip().strip('"\'')
        value = raw_value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        result[key] = value
    return result


def _parse_timestamp(value: Any) -> datetime:
    if value is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return datetime.min.replace(tzinfo=timezone.utc)
        if candidate.endswith("Z"):
            candidate = f"{candidate[:-1]}+00:00"
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.min.replace(tzinfo=timezone.utc)


def _merge_sessions(old_entries: List[Dict[str, Any]], new_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    combined: Dict[Tuple[Any, Any, Any, Any], Tuple[Dict[str, Any], int]] = {}
    order = 0
    for source_entries in (new_entries, old_entries):
        for entry in source_entries:
            key = (
                entry.get("session_id"),
                entry.get("timestamp") or entry.get("ts"),
                entry.get("type") or entry.get("status"),
                entry.get("summary"),
            )
            if key in combined:
                continue
            combined[key] = (entry, order)
            order += 1

    def sort_key(item: Tuple[Dict[str, Any], int]) -> Tuple[datetime, Any, int]:
        payload, index = item
        ts = payload.get("timestamp") or payload.get("ts")
        return (_parse_timestamp(ts), payload.get("session_id"), index)

    sorted_entries = sorted(combined.values(), key=sort_key)
    merged: List[Dict[str, Any]] = []
    for entry, _ in sorted_entries:
        payload = dict(entry)
        serialised = json.dumps({k: v for k, v in payload.items() if k != "__raw__"})
        payload["__raw__"] = serialised
        merged.append(payload)
    return merged


def _should_replace(current: Any, incoming: Any) -> bool:
    if incoming is None:
        return False
    if current is None:
        return True
    if isinstance(current, str):
        return not current.strip() and bool(incoming)
    if isinstance(current, (list, dict)):
        return not current and bool(incoming)
    if isinstance(current, (int, float)):
        return current == 0 and incoming not in (None, "")
    return False


def _merge_project_context(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    merged = deepcopy(new) if new else {}
    project = merged.setdefault("project", {})
    if _should_replace(project.get("name"), old.get("project_name")):
        project["name"] = old.get("project_name")
    if _should_replace(project.get("version"), old.get("version")):
        project["version"] = old.get("version")
    if _should_replace(project.get("start_date"), old.get("created")):
        project["start_date"] = old.get("created")
    if _should_replace(project.get("status"), old.get("status")):
        project["status"] = old.get("status")

    working_old = old.get("working_memory", {})
    working_new = merged.setdefault("working_memory", {})
    for field in ("active_domain", "session_count", "last_session", "active_mission"):
        if _should_replace(working_new.get(field), working_old.get(field)):
            working_new[field] = working_old.get(field)
    if working_old.get("domains"):
        existing_domains = working_new.get("domains")
        if not existing_domains:
            working_new["domains"] = working_old["domains"]

    if old.get("domains") and not working_new.get("domains"):
        working_new["domains"] = old["domains"]

    technical_new = merged.setdefault("technical_context", {})
    if old.get("mission_planning") and "mission_planning" not in technical_new:
        technical_new["mission_planning"] = old["mission_planning"]
    if old.get("current_sprint") and "current_sprint" not in technical_new:
        technical_new["current_sprint"] = old["current_sprint"]

    if old.get("ai_instructions") and "ai_instructions" not in merged:
        merged["ai_instructions"] = old["ai_instructions"]

    metadata = merged.setdefault("metadata", {})
    metadata["migrated_at"] = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    metadata["source_version"] = "cmos-v1"

    return merged


def _merge_master_context(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    merged = deepcopy(new) if new else {}

    def deep_merge(target: Dict[str, Any], incoming: Dict[str, Any]) -> None:
        for key, value in incoming.items():
            if isinstance(value, dict):
                node = target.setdefault(key, {}) if isinstance(target.get(key), dict) else {}
                target[key] = node or target.get(key, {})
                deep_merge(target[key], value)
            elif isinstance(value, list):
                existing = target.get(key)
                if not existing:
                    target[key] = value
                elif isinstance(existing, list):
                    existing_items = list(existing)
                    for item in value:
                        if item not in existing_items:
                            existing_items.append(item)
                    target[key] = existing_items
            else:
                if _should_replace(target.get(key), value):
                    target[key] = value

    deep_merge(merged, old)
    metadata = merged.setdefault("metadata", {})
    metadata["migrated_at"] = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    metadata["source_version"] = "cmos-v1"
    return merged


def _create_backup(path: Path) -> Path:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    backup_path = path.with_suffix(f"{path.suffix}.backup-{timestamp}")
    backup_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    return backup_path


def _session_hint(payload: Dict[str, Any]) -> str | None:
    working = payload.get("working_memory") or {}
    for key in ("last_session", "active_mission", "current_session"):
        value = working.get(key)
        if value:
            return str(value)
    return None


def _sync_database(
    db_path: Path,
    schema_path: Path,
    project_payload: Dict[str, Any],
    master_payload: Dict[str, Any],
    sessions: Iterable[Dict[str, Any]],
    *,
    project_source: Path,
    master_source: Path
) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    client = SQLiteClient(db_path, schema_path=schema_path)
    try:
        with client.transaction() as connection:
            client.set_context(
                "project_context",
                project_payload,
                source_path=str(project_source),
                session_id=_session_hint(project_payload),
                snapshot=True,
                snapshot_source=str(project_source),
            )
            client.set_context(
                "master_context",
                master_payload,
                source_path=str(master_source),
                session_id=_session_hint(master_payload),
                snapshot=True,
                snapshot_source=str(master_source),
            )

            connection.execute("DELETE FROM session_events")
            connection.executemany(
                """
                INSERT INTO session_events (ts, agent, mission, action, status, summary, next_hint, raw_event)
                VALUES (:ts, :agent, :mission, :action, :status, :summary, :next_hint, :raw_event)
                """,
                (
                    {
                        "ts": event.get("timestamp") or event.get("ts"),
                        "agent": event.get("agent"),
                        "mission": event.get("mission"),
                        "action": event.get("action"),
                        "status": event.get("status") or event.get("type"),
                        "summary": event.get("summary"),
                        "next_hint": event.get("next_hint"),
                        "raw_event": event.get("__raw__")
                        or json.dumps({k: v for k, v in event.items() if k != "__raw__"})
                    }
                    for event in sessions
                ),
            )
    finally:
        client.close()


def main() -> int:
    args = _parse_args()
    source = args.source.resolve()
    target = args.target.resolve()

    sessions_src = _resolve_file(
        source, ["SESSIONS.jsonl", "sessions.jsonl", "session.jsonl"], "sessions JSONL"
    )
    project_src = _resolve_file(source, ["PROJECT_CONTEXT.json"], "PROJECT_CONTEXT.json")
    master_src = _resolve_file(source / "context", ["MASTER_CONTEXT.json"], "MASTER_CONTEXT.json")

    sessions_dst = target / "SESSIONS.jsonl"
    project_dst = target / "PROJECT_CONTEXT.json"
    master_dst = target / "context" / "MASTER_CONTEXT.json"

    old_sessions = _load_sessions(sessions_src)
    source_db_path = args.source_db.resolve() if args.source_db else None
    if source_db_path:
        db_sessions = _load_sessions_from_db(source_db_path)
        if db_sessions:
            old_sessions.extend(db_sessions)
    new_sessions = _load_sessions(sessions_dst)
    merged_sessions = _merge_sessions(old_sessions, new_sessions)

    old_project = _load_json(project_src)
    if source_db_path:
        project_from_db = _load_context_from_db(source_db_path, "project_context")
        if project_from_db:
            old_project = project_from_db
    new_project = _load_json(project_dst)
    merged_project = _merge_project_context(old_project, new_project)

    old_master = _load_json(master_src)
    if source_db_path:
        master_from_db = _load_context_from_db(source_db_path, "master_context")
        if master_from_db:
            old_master = master_from_db
    new_master = _load_json(master_dst)
    merged_master = _merge_master_context(old_master, new_master)

    if args.dry_run:
        print("--- Dry run preview ---")
        print(f"Sessions to write: {len(merged_sessions)} entries")
        print("Projected PROJECT_CONTEXT.json excerpt:")
        print(json.dumps(merged_project, indent=2)[:2000])
        print("Projected MASTER_CONTEXT.json excerpt:")
        print(json.dumps(merged_master, indent=2)[:2000])
        return 0

    if not args.skip_files:
        if not args.no_backup:
            for path in (sessions_dst, project_dst, master_dst):
                if path.exists():
                    _create_backup(path)
        _write_sessions(sessions_dst, merged_sessions)
        _write_json(project_dst, merged_project)
        _write_json(master_dst, merged_master)
    else:
        print("Flat-file mirror updates skipped (--skip-files).")

    if args.sync_db:
        db_path = args.db_path.resolve() if args.db_path else target / "db" / "cmos.sqlite"
        schema_path = target / "db" / "schema.sql"
        _sync_database(
            db_path,
            schema_path,
            merged_project,
            merged_master,
            merged_sessions,
            project_source=project_dst,
            master_source=master_dst,
        )
        print(f"SQLite database synchronised at {db_path}")

    print("Migration complete.")
    if not args.skip_files:
        print(f"Merged sessions written to {sessions_dst}")
        print(f"Merged PROJECT_CONTEXT.json written to {project_dst}")
        print(f"Merged MASTER_CONTEXT.json written to {master_dst}")
        if not args.no_backup:
            print("Backups created alongside target files.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pragma: no cover
        print(f"Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)
