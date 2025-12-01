#!/usr/bin/env python3
"""Seed the CMOS SQLite prototype with data mirrored from file-based sources.

This script applies the schema in db/schema.sql, ingests backlog, context,
session, and telemetry data, and writes the resulting database to db/cmos.sqlite.
It is intended as a deterministic bridge between the existing file workflow and the
new SQLite-backed prototype defined in mission B3.1.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import yaml


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

from context.db_client import SQLiteClient, SQLiteClientError


def utc_now() -> str:
    """Return an ISO-8601 timestamp in UTC without microseconds."""
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_yaml_documents(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [doc for doc in yaml.safe_load_all(handle) if doc]


def load_backlog(backlog_path: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    documents = load_yaml_documents(backlog_path)
    if len(documents) < 2:
        return [], [], []
    domain_fields = documents[1].get("domainFields", {})
    sprints = domain_fields.get("sprints", []) or []
    missions: List[Dict[str, Any]] = []
    for sprint in sprints:
        sprint_id = sprint.get("sprintId")
        for mission in sprint.get("missions", []) or []:
            enriched = dict(mission)
            enriched["sprintId"] = sprint_id
            missions.append(enriched)
    dependencies = domain_fields.get("missionDependencies", []) or []
    return sprints, missions, dependencies


def load_sessions(sessions_path: Path) -> List[Dict[str, Any]]:
    if not sessions_path.exists():
        return []
    events: List[Dict[str, Any]] = []
    with sessions_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                continue
            parsed["__raw__"] = raw
            events.append(parsed)
    return events


def load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_telemetry(telemetry_dir: Path) -> List[Dict[str, Any]]:
    if not telemetry_dir.exists():
        return []
    payloads: List[Dict[str, Any]] = []
    for file_path in sorted(telemetry_dir.glob("*.json")):
        payloads.append({
            "source_path": str(file_path.relative_to(telemetry_dir.parent.parent)),
            "content": file_path.read_text(encoding="utf-8")
        })
    return payloads


def load_prompt_mapping(mission_path: Path) -> List[Dict[str, Any]]:
    documents = load_yaml_documents(mission_path)
    if len(documents) < 2:
        return []
    prompts = documents[1].get("domainFields", {}).get("promptMapping", {}).get("prompts", []) or []
    formatted: List[Dict[str, Any]] = []
    for item in prompts:
        formatted.append({
            "prompt": item.get("prompt", ""),
            "behavior": item.get("agentBehavior", "")
        })
    return formatted


def load_mission_files(missions_dir: Path) -> Dict[str, Dict[str, Any]]:
    """Scan sprint-XX/ directories for mission YAML files and parse them.
    
    Returns a dict mapping mission_id to full mission spec.
    """
    mission_specs: Dict[str, Dict[str, Any]] = {}
    
    if not missions_dir.exists():
        return mission_specs
    
    # Find all sprint-XX directories
    for sprint_dir in sorted(missions_dir.glob("sprint-*")):
        if not sprint_dir.is_dir():
            continue
        
        # Load all YAML files in this sprint directory
        for mission_file in sorted(sprint_dir.glob("*.yaml")):
            try:
                with mission_file.open("r", encoding="utf-8") as f:
                    mission_data = yaml.safe_load(f)
                    if not mission_data:
                        continue
                    
                    mission_id = mission_data.get("missionId")
                    if not mission_id:
                        continue
                    
                    mission_specs[mission_id] = mission_data
            except (yaml.YAMLError, IOError) as e:
                print(f"Warning: Failed to load {mission_file}: {e}", file=sys.stderr)
                continue
    
    return mission_specs


def insert_sprints(connection: sqlite3.Connection, sprints: Iterable[Dict[str, Any]]) -> None:
    connection.executemany(
        """
        INSERT OR REPLACE INTO sprints (
            id, title, focus, status, start_date, end_date, total_missions, completed_missions
        ) VALUES (:sprintId, :title, :focus, :status, :startDate, :endDate, :totalMissions, :completedMissions)
        """,
        (
            {
                "sprintId": sprint.get("sprintId"),
                "title": sprint.get("title"),
                "focus": sprint.get("focus"),
                "status": sprint.get("status"),
                "startDate": sprint.get("startDate"),
                "endDate": sprint.get("endDate"),
                "totalMissions": sprint.get("totalMissions"),
                "completedMissions": sprint.get("completedMissions")
            }
            for sprint in sprints
        )
    )


def insert_missions(
    connection: sqlite3.Connection, 
    missions: Iterable[Dict[str, Any]],
    mission_specs: Dict[str, Dict[str, Any]] | None = None
) -> None:
    """Insert missions with full YAML content if available.
    
    Args:
        connection: SQLite connection
        missions: Basic mission data from backlog.yaml
        mission_specs: Full mission YAML content keyed by mission_id
    """
    mission_specs = mission_specs or {}
    
    def serialize_metadata(mission: Dict[str, Any]) -> str | None:
        extras = {k: v for k, v in mission.items() if k not in {"id", "name", "status", "notes", "completed_at", "sprintId"}}
        return json.dumps(extras, ensure_ascii=False) if extras else None
    
    def serialize_json_field(value: Any) -> str | None:
        """Serialize list or dict to JSON, return None for empty."""
        if not value:
            return None
        return json.dumps(value, ensure_ascii=False)

    rows = []
    for mission in missions:
        mission_id = mission.get("id")
        spec = mission_specs.get(mission_id, {})
        
        rows.append({
            "id": mission_id,
            "sprint_id": mission.get("sprintId"),
            "name": mission.get("name"),
            "status": mission.get("status"),
            "completed_at": mission.get("completed_at"),
            "notes": mission.get("notes"),
            "objective": spec.get("objective"),
            "context": spec.get("context"),
            "success_criteria": serialize_json_field(spec.get("successCriteria")),
            "deliverables": serialize_json_field(spec.get("deliverables")),
            "reference_docs": serialize_json_field(spec.get("references")),
            "domain_fields": serialize_json_field(spec.get("domainFields")),
            "metadata": serialize_metadata(mission)
        })

    connection.executemany(
        """
        INSERT OR REPLACE INTO missions (
            id, sprint_id, name, status, completed_at, notes,
            objective, context, success_criteria, deliverables, reference_docs, domain_fields,
            metadata
        ) VALUES (
            :id, :sprint_id, :name, :status, :completed_at, :notes,
            :objective, :context, :success_criteria, :deliverables, :reference_docs, :domain_fields,
            :metadata
        )
        """,
        rows
    )


def insert_dependencies(connection: sqlite3.Connection, dependencies: Iterable[Dict[str, Any]]) -> None:
    connection.executemany(
        """
        INSERT OR REPLACE INTO mission_dependencies (from_id, to_id, type)
        VALUES (:from, :to, :type)
        """,
        (
            {
                "from": dep.get("from"),
                "to": dep.get("to"),
                "type": dep.get("type")
            }
            for dep in dependencies
        )
    )


def _canonical_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _session_hint(payload: Dict[str, Any]) -> str | None:
    working = payload.get("working_memory") or {}
    for key in ("last_session", "active_mission", "current_session"):
        value = working.get(key)
        if value:
            return str(value)
    return None


def insert_context(connection: sqlite3.Connection, context_id: str, source_path: Path, content: Dict[str, Any]) -> None:
    if not content:
        return
    timestamp = utc_now()
    pretty = json.dumps(content, ensure_ascii=False, indent=2)
    connection.execute(
        """
        INSERT OR REPLACE INTO contexts (id, source_path, content, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            context_id,
            str(source_path),
            pretty,
            timestamp
        )
    )

    canonical = _canonical_json(content)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    existing = connection.execute(
        "SELECT content_hash FROM context_snapshots WHERE context_id = ? ORDER BY created_at DESC LIMIT 1",
        (context_id,)
    ).fetchone()
    if existing and existing["content_hash"] == digest:
        return
    connection.execute(
        """
        INSERT INTO context_snapshots (context_id, session_id, source, content_hash, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            context_id,
            _session_hint(content),
            str(source_path),
            digest,
            pretty,
            timestamp
        )
    )


def insert_sessions(connection: sqlite3.Connection, events: Iterable[Dict[str, Any]]) -> None:
    connection.executemany(
        """
        INSERT INTO session_events (ts, agent, mission, action, status, summary, next_hint, raw_event)
        VALUES (:ts, :agent, :mission, :action, :status, :summary, :next_hint, :raw)
        """,
        (
            {
                "ts": event.get("ts") or event.get("timestamp"),
                "agent": event.get("agent"),
                "mission": event.get("mission"),
                "action": event.get("action"),
                "status": event.get("status") or event.get("type"),
                "summary": event.get("summary"),
                "next_hint": event.get("next_hint"),
                "raw": event.get("__raw__")
            }
            for event in events
        )
    )


def insert_telemetry(connection: sqlite3.Connection, payloads: Iterable[Dict[str, Any]]) -> None:
    for payload in payloads:
        content = payload.get("content")
        if not content:
            continue
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = None
        mission = None
        timestamp = None
        if isinstance(parsed, dict):
            mission = parsed.get("meta", {}).get("mission")
            timestamp = parsed.get("meta", {}).get("completedAt") or parsed.get("meta", {}).get("startedAt")
        connection.execute(
            """
            INSERT INTO telemetry_events (mission, source_path, ts, payload)
            VALUES (?, ?, ?, ?)
            """,
            (
                mission,
                payload.get("source_path"),
                timestamp,
                content
            )
        )


def insert_prompt_mappings(connection: sqlite3.Connection, mappings: Iterable[Dict[str, Any]]) -> None:
    connection.executemany(
        """
        INSERT INTO prompt_mappings (prompt, behavior)
        VALUES (:prompt, :behavior)
        """,
        (
            {
                "prompt": (item.get("prompt") or "").strip(),
                "behavior": (item.get("behavior") or "").strip()
            }
            for item in mappings
            if (item.get("prompt") or "").strip()
        )
    )


def seed_database(root: Path, db_path: Path, data_root: Path | None = None) -> None:
    project_root = root
    mirrors_root = Path(data_root).resolve() if data_root else project_root
    schema_path = project_root / "db" / "schema.sql"
    backlog_path = mirrors_root / "missions" / "backlog.yaml"
    missions_dir = mirrors_root / "missions"
    project_context_path = mirrors_root / "PROJECT_CONTEXT.json"
    master_context_path = mirrors_root / "context" / "MASTER_CONTEXT.json"
    sessions_path = mirrors_root / "SESSIONS.jsonl"
    telemetry_dir = mirrors_root / "telemetry" / "events"
    mission_path = mirrors_root / "missions" / "sprint-03" / "B3.1_sqlite-foundation-prototype.yaml"

    sprints, missions, dependencies = load_backlog(backlog_path)
    mission_specs = load_mission_files(missions_dir)
    session_events = load_sessions(sessions_path)
    telemetry_payloads = load_telemetry(telemetry_dir)
    prompt_mappings = load_prompt_mapping(mission_path)
    
    print(f"Loaded {len(mission_specs)} mission YAML files from {missions_dir}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    client = SQLiteClient(db_path, schema_path=schema_path)
    try:
        with client.transaction() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
                ("seeded_at", utc_now())
            )
            insert_sprints(connection, sprints)
            insert_missions(connection, missions, mission_specs)
            insert_dependencies(connection, dependencies)
            insert_context(connection, "project_context", project_context_path, load_json(project_context_path))
            insert_context(connection, "master_context", master_context_path, load_json(master_context_path))
            insert_sessions(connection, session_events)
            insert_telemetry(connection, telemetry_payloads)
            insert_prompt_mappings(connection, prompt_mappings)
    finally:
        client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the CMOS SQLite prototype database")
    parser.add_argument(
        "--root",
        type=Path,
        default=CMOS_ROOT,
        help="Path to cmos/ directory (default: auto-detected)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Override output database path (default: <root>/db/cmos.sqlite)"
    )
    parser.add_argument(
        "--data-root",
        type=Path,
        default=None,
        help="Path containing backlog/context mirrors for seeding (default: repository root)"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    db_path = args.output.resolve() if args.output else (root / "db" / "cmos.sqlite")
    try:
        seed_database(root, db_path, args.data_root.resolve() if args.data_root else None)
    except SQLiteClientError as error:
        raise SystemExit(f"Database seeding failed: {error}") from error
    print(f"Seeded SQLite database at {db_path}")


if __name__ == "__main__":
    main()
