#!/usr/bin/env python3
"""Unified CMOS command line entry point.

Provides mission lifecycle helpers, database inspection/export commands,
and lightweight validation utilities backed by the canonical SQLite store.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    yaml = None


def _find_cmos_root() -> Path:
    """Locate the cmos/ directory so the CLI can run from any path."""

    script_dir = Path(__file__).resolve().parent
    candidate = script_dir
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
    raise RuntimeError("Cannot find cmos/ directory. Please run from project root or supply --root.")


DEFAULT_ROOT = _find_cmos_root()
if str(DEFAULT_ROOT) not in sys.path:
    sys.path.insert(0, str(DEFAULT_ROOT))

from context.db_client import SQLiteClient, SQLiteClientError  # noqa: E402
from context.mission_runtime import (  # noqa: E402
    MissionRuntime,
    MissionRuntimeError,
    block as block_mission,
    complete as complete_mission,
    start as start_mission,
)


@dataclass(frozen=True)
class Environment:
    root: Path
    db_path: Path
    schema_path: Path


FOUNDATIONAL_CHECKS = {
    Path("agents.md"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
    Path("README.md"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
    Path("context/MASTER_CONTEXT.json"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
}

VALID_MISSION_STATUSES = (
    "Queued",
    "Current",
    "In Progress",
    "Blocked",
    "Completed",
)

_STATUS_LOOKUP = {status.lower(): status for status in VALID_MISSION_STATUSES}


def _normalize_status(value: str) -> str:
    normalized = _STATUS_LOOKUP.get((value or "").strip().lower())
    if not normalized:
        allowed = ", ".join(VALID_MISSION_STATUSES)
        raise SystemExit(f"Invalid status '{value}'. Choose from: {allowed}.")
    return normalized


def _ensure_mission_exists(client: SQLiteClient, mission_id: str) -> Dict[str, Any]:
    row = client.fetchone("SELECT id, metadata FROM missions WHERE id = :id", {"id": mission_id})
    if not row:
        raise SystemExit(f"Mission {mission_id} does not exist.")
    return row


def _ensure_sprint_exists(client: SQLiteClient, sprint_id: str) -> None:
    row = client.fetchone("SELECT id FROM sprints WHERE id = :id", {"id": sprint_id})
    if not row:
        raise SystemExit(f"Sprint {sprint_id} does not exist in the database.")


def _build_metadata_payload(
    *,
    base: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
    success_criteria: Optional[List[str]] = None,
    deliverables: Optional[List[str]] = None,
    metadata_json: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    payload: Dict[str, Any] = dict(base) if isinstance(base, dict) else {}
    if metadata_json:
        try:
            incoming = json.loads(metadata_json)
        except json.JSONDecodeError as error:
            raise SystemExit(f"Invalid metadata JSON: {error}") from error
        if not isinstance(incoming, dict):
            raise SystemExit("Metadata JSON must be an object.")
        payload.update(incoming)
    if description is not None:
        payload["description"] = description
    if success_criteria is not None:
        payload["successCriteria"] = success_criteria
    if deliverables is not None:
        payload["deliverables"] = deliverables
    return payload or None


def _resolve_environment(args: argparse.Namespace) -> Environment:
    root = (args.root or DEFAULT_ROOT).resolve()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    db_path = (args.database or (root / "db" / "cmos.sqlite")).resolve()
    schema_path = (root / "db" / "schema.sql").resolve()
    return Environment(root=root, db_path=db_path, schema_path=schema_path)


def _open_client(env: Environment) -> SQLiteClient:
    return SQLiteClient(env.db_path, schema_path=env.schema_path, create_missing=False)


def _build_runtime(env: Environment) -> MissionRuntime:
    return MissionRuntime(repo_root=env.root, db_path=env.db_path)


def _print_json(label: str, payload: Dict[str, Any]) -> None:
    print(label)
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _parse_metadata_blob(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _extract_string_items(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        candidate = value.strip()
        return [candidate] if candidate else []
    if isinstance(value, (list, tuple)):
        results: List[str] = []
        for item in value:
            if isinstance(item, str):
                candidate = item.strip()
                if candidate:
                    results.append(candidate)
        return results
    return []


def _format_sprint_label(mission: Dict[str, Any]) -> str:
    sprint_id = mission.get("sprint_id")
    sprint_title = mission.get("sprint_title")
    if sprint_id and sprint_title:
        return f"{sprint_id} – {sprint_title}"
    if sprint_id:
        return str(sprint_id)
    if sprint_title:
        return str(sprint_title)
    return "Unassigned"


def _render_bullet_block(items: List[str], placeholder: str) -> List[str]:
    if items:
        return [f"- {item}" for item in items]
    return [f"- {placeholder}"]


def _render_research_report(mission: Dict[str, Any], events: List[Dict[str, Any]]) -> str:
    metadata_blob = _parse_metadata_blob(mission.get("metadata"))
    brief = metadata_blob.get("metadata") if isinstance(metadata_blob.get("metadata"), dict) else {}

    description = brief.get("description") if isinstance(brief, dict) else None
    success = _extract_string_items(brief.get("successCriteria") if isinstance(brief, dict) else None)
    deliverables = _extract_string_items(brief.get("deliverables") if isinstance(brief, dict) else None)
    research_questions = _extract_string_items(brief.get("researchQuestions") if isinstance(brief, dict) else None)

    started_at = metadata_blob.get("started_at")
    completed_at = mission.get("completed_at") or metadata_blob.get("completed_at")

    lines: List[str] = []
    mission_name = mission.get("name") or "(untitled mission)"
    lines.append(f"# Research Report: {mission.get('id')} – {mission_name}")
    lines.append("")

    lines.append("## Mission Overview")
    lines.append(f"- **Status**: {mission.get('status') or 'unknown'}")
    lines.append(f"- **Sprint**: {_format_sprint_label(mission)}")
    if started_at:
        lines.append(f"- **Started**: {started_at}")
    if completed_at:
        lines.append(f"- **Completed**: {completed_at}")
    lines.append("")

    lines.append("## Mission Brief")
    if description:
        lines.append(description)
    else:
        lines.append("_No description recorded._")
    lines.append("")

    if research_questions:
        lines.append("### Research Questions")
        lines.extend(_render_bullet_block(research_questions, ""))
        lines.append("")

    lines.append("### Success Criteria")
    lines.extend(_render_bullet_block(success, "No success criteria recorded."))
    lines.append("")

    lines.append("### Deliverables")
    lines.extend(_render_bullet_block(deliverables, "No deliverables recorded."))
    lines.append("")

    lines.append("## Key Findings")
    notes = (mission.get("notes") or "").strip()
    if notes:
        lines.append(notes)
    else:
        lines.append("_No mission notes were stored._")
    lines.append("")

    lines.append("## Session Timeline")
    if events:
        for event in events:
            ts = event.get("ts") or "unknown time"
            agent = event.get("agent") or "unknown agent"
            action = event.get("action") or "event"
            summary = event.get("summary") or ""
            entry = f"- {ts} — **{agent}** [{action}]"
            if summary:
                entry += f": {summary}"
            next_hint = event.get("next_hint")
            if next_hint:
                entry += f" _(next: {next_hint})_"
            lines.append(entry)
    else:
        lines.append("_No session events recorded for this mission._")
    lines.append("")

    snapshot_source: Dict[str, Any]
    if metadata_blob:
        snapshot_source = metadata_blob
    else:
        raw = mission.get("metadata")
        snapshot_source = {"raw_metadata": raw} if raw else {}

    lines.append("## Metadata Snapshot")
    lines.append("```json")
    lines.append(json.dumps(snapshot_source, ensure_ascii=False, indent=2))
    lines.append("```")

    return "\n".join(lines).rstrip()


def _mission_status(runtime: MissionRuntime, limit: int) -> None:
    rows = runtime.client.fetchall(
        """
        SELECT id, name, status, completed_at
          FROM missions
         ORDER BY CASE status
                  WHEN 'In Progress' THEN 0
                  WHEN 'Current' THEN 1
                  WHEN 'Queued' THEN 2
                  WHEN 'Blocked' THEN 3
                  ELSE 4
                END,
                rowid
         LIMIT :limit
        """,
        {"limit": limit}
    )
    if not rows:
        print("No missions present in the queue.")
        return
    print("Mission queue:")
    for row in rows:
        status = row.get("status") or "unknown"
        completed = f" (completed {row['completed_at']})" if row.get("completed_at") else ""
        print(f"- {row.get('id')}: {row.get('name')} [{status}]{completed}")


def _mission_start(env: Environment, args: argparse.Namespace) -> None:
    result = start_mission(
        args.mission_id,
        agent=args.agent,
        summary=args.summary,
        ts=args.ts,
        repo_root=env.root,
        db_path=env.db_path,
    )
    _print_json(f"Mission {args.mission_id} started.", result.event)


def _mission_complete(env: Environment, args: argparse.Namespace) -> None:
    result = complete_mission(
        args.mission_id,
        agent=args.agent,
        summary=args.summary,
        notes=args.notes,
        ts=args.ts,
        next_hint=args.next_hint,
        promote_next=not args.no_promote,
        immediate=args.immediate,
        repo_root=env.root,
        db_path=env.db_path,
    )
    _print_json(f"Mission {args.mission_id} completed.", result.event)
    if result.next_mission:
        status = "In Progress" if args.immediate else "Current"
        print(f"Promoted {result.next_mission} -> {status}.")


def _mission_block(env: Environment, args: argparse.Namespace) -> None:
    result = block_mission(
        args.mission_id,
        agent=args.agent,
        summary=args.summary,
        reason=args.reason,
        needs=args.need or [],
        ts=args.ts,
        next_hint=args.next_hint,
        repo_root=env.root,
        db_path=env.db_path,
    )
    _print_json(f"Mission {args.mission_id} blocked.", result.event)


def _mission_add(env: Environment, args: argparse.Namespace) -> None:
    client = _open_client(env)
    try:
        _ensure_sprint_exists(client, args.sprint)
        existing = client.fetchone("SELECT id FROM missions WHERE id = :id", {"id": args.mission_id})
        if existing:
            raise SystemExit(f"Mission {args.mission_id} already exists.")
        metadata = _build_metadata_payload(
            description=args.description,
            success_criteria=args.success,
            deliverables=args.deliverable,
            metadata_json=args.metadata,
        )
        with client.transaction() as conn:
            conn.execute(
                """
                INSERT INTO missions (id, sprint_id, name, status, completed_at, notes, metadata)
                VALUES (:id, :sprint_id, :name, :status, NULL, :notes, :metadata)
                """,
                {
                    "id": args.mission_id,
                    "sprint_id": args.sprint,
                    "name": args.name,
                    "status": _normalize_status(args.status or "Queued"),
                    "notes": args.notes,
                    "metadata": json.dumps(metadata, ensure_ascii=False) if metadata else None,
                },
            )
    finally:
        client.close()
    _sync_backlog(env)
    print(f"Mission {args.mission_id} added to sprint {args.sprint}.")


def _mission_update(env: Environment, args: argparse.Namespace) -> None:
    client = _open_client(env)
    changed_fields: List[str] = []
    try:
        row = _ensure_mission_exists(client, args.mission_id)
        updates: Dict[str, Any] = {}
        if args.name:
            updates["name"] = args.name
        if args.status:
            updates["status"] = _normalize_status(args.status)
        if args.sprint:
            _ensure_sprint_exists(client, args.sprint)
            updates["sprint_id"] = args.sprint
        if args.notes is not None:
            updates["notes"] = args.notes

        metadata_requested = any(
            value is not None
            for value in (args.description, args.success, args.deliverable, args.metadata)
        )
        if metadata_requested:
            base: Optional[Dict[str, Any]] = None
            raw_metadata = row.get("metadata")
            if raw_metadata:
                try:
                    base = json.loads(raw_metadata)
                except json.JSONDecodeError:
                    base = {}
            metadata = _build_metadata_payload(
                base=base,
                description=args.description,
                success_criteria=args.success,
                deliverables=args.deliverable,
                metadata_json=args.metadata,
            )
            updates["metadata"] = json.dumps(metadata, ensure_ascii=False) if metadata else None

        if not updates:
            raise SystemExit("Provide at least one field to update.")

        changed_fields = list(updates.keys())
        assignments = ", ".join(f"{column} = :{column}" for column in changed_fields)
        updates["id"] = args.mission_id
        with client.transaction() as conn:
            conn.execute(f"UPDATE missions SET {assignments} WHERE id = :id", updates)
    finally:
        client.close()
    _sync_backlog(env)
    print(f"Mission {args.mission_id} updated ({', '.join(changed_fields)}).")


def _mission_depends(env: Environment, args: argparse.Namespace) -> None:
    if args.from_id == args.to_id:
        raise SystemExit("Dependencies require distinct missions.")
    client = _open_client(env)
    try:
        _ensure_mission_exists(client, args.from_id)
        _ensure_mission_exists(client, args.to_id)
        with client.transaction() as conn:
            conn.execute(
                """
                INSERT INTO mission_dependencies (from_id, to_id, type)
                VALUES (:from_id, :to_id, :type)
                ON CONFLICT(from_id, to_id) DO UPDATE SET type = excluded.type
                """,
                {"from_id": args.from_id, "to_id": args.to_id, "type": args.dep_type},
            )
    finally:
        client.close()
    _sync_backlog(env)
    print(f"Dependency recorded: {args.from_id} -> {args.to_id} ({args.dep_type}).")


def _research_export(env: Environment, args: argparse.Namespace) -> None:
    client = _open_client(env)
    try:
        mission = client.fetchone(
            """
            SELECT m.id,
                   m.name,
                   m.status,
                   m.completed_at,
                   m.notes,
                   m.metadata,
                   m.sprint_id,
                   s.title AS sprint_title
              FROM missions m
         LEFT JOIN sprints s ON s.id = m.sprint_id
             WHERE m.id = :id
            """,
            {"id": args.mission_id},
        )
        if not mission:
            raise SystemExit(f"Mission {args.mission_id} does not exist.")
        events = client.fetchall(
            """
            SELECT ts, agent, action, summary, next_hint
              FROM session_events
             WHERE mission = :mission
             ORDER BY ts ASC, id ASC
            """,
            {"mission": args.mission_id},
        )
    finally:
        client.close()

    if mission.get("status") != "Completed" and not args.allow_incomplete:
        raise SystemExit(
            f"Mission {args.mission_id} is {mission.get('status')}. Complete it first or pass --allow-incomplete."
        )

    default_path = env.root / "research" / f"{mission['id']}.md"
    output_path = (args.output or default_path).resolve()
    if output_path.exists() and not args.overwrite:
        raise SystemExit(
            f"Research report already exists: {output_path}. Use --overwrite to replace it."
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    document = _render_research_report(mission, events)
    output_path.write_text(document + "\n", encoding="utf-8")
    print(f"Research report written to {output_path}")


def _mission_status_cmd(env: Environment, args: argparse.Namespace) -> None:
    runtime = _build_runtime(env)
    try:
        runtime.ensure_database()
        _mission_status(runtime, args.limit)
    finally:
        runtime.close()


def _load_backlog(client: SQLiteClient) -> Dict[str, Any]:
    sprints = client.fetchall(
        "SELECT id, title, focus, status, start_date, end_date, total_missions, completed_missions "
        "FROM sprints ORDER BY COALESCE(start_date, '') ASC, id ASC"
    )
    missions = client.fetchall(
        "SELECT id, sprint_id, name, status, completed_at, notes, metadata "
        "FROM missions ORDER BY sprint_id ASC, id ASC"
    )
    dependencies = client.fetchall(
        "SELECT from_id, to_id, type FROM mission_dependencies ORDER BY from_id, to_id"
    )
    prompts = client.fetchall(
        "SELECT prompt, behavior FROM prompt_mappings ORDER BY id"
    )

    missions_by_sprint: Dict[str, List[Dict[str, Any]]] = {}
    for mission in missions:
        sprint_id = mission.get("sprint_id")
        bucket = missions_by_sprint.setdefault(sprint_id, [])
        entry: Dict[str, Any] = {
            "id": mission.get("id"),
            "name": mission.get("name"),
            "status": mission.get("status"),
        }
        if mission.get("completed_at"):
            entry["completed_at"] = mission["completed_at"]
        if mission.get("notes"):
            entry["notes"] = mission["notes"]
        if mission.get("metadata"):
            try:
                entry["metadata"] = json.loads(mission["metadata"])
            except json.JSONDecodeError:
                entry["metadata"] = mission["metadata"]
        bucket.append(entry)

    sprint_documents: List[Dict[str, Any]] = []
    for sprint in sprints:
        sprint_documents.append(
            {
                "sprintId": sprint.get("id"),
                "title": sprint.get("title"),
                "focus": sprint.get("focus"),
                "status": sprint.get("status"),
                "startDate": sprint.get("start_date"),
                "endDate": sprint.get("end_date"),
                "totalMissions": sprint.get("total_missions"),
                "completedMissions": sprint.get("completed_missions"),
                "missions": missions_by_sprint.get(sprint.get("id"), []),
            }
        )

    dependencies_doc = [
        {"from": row.get("from_id"), "to": row.get("to_id"), "type": row.get("type")}
        for row in dependencies
    ]

    prompt_doc = [
        {"prompt": row.get("prompt"), "agentBehavior": row.get("behavior")}
        for row in prompts
    ]

    return {
        "sprints": sprint_documents,
        "dependencies": dependencies_doc,
        "prompts": prompt_doc,
    }


def _print_backlog(backlog: Dict[str, Any]) -> None:
    sprints = backlog.get("sprints") or []
    if not sprints:
        print("No sprints defined in the database.")
        return
    for sprint in sprints:
        sprint_id = sprint.get("sprintId") or "UNSET"
        print(f"[{sprint_id}] {sprint.get('title') or '(untitled sprint)'}")
        status = sprint.get("status") or "unknown"
        print(f"  status: {status}")
        window = " - ".join(filter(None, [sprint.get("startDate"), sprint.get("endDate")]))
        if window:
            print(f"  window: {window}")
        missions = sprint.get("missions") or []
        if not missions:
            print("  (no missions)\n")
            continue
        for mission in missions:
            line = f"  - {mission.get('id')}: {mission.get('name')} [{mission.get('status') or 'unknown'}]"
            if mission.get("completed_at"):
                line += f" completed {mission['completed_at']}"
            print(line)
            notes = mission.get("notes")
            if notes:
                print(f"      notes: {notes}")
        print()


def _show_current(client: SQLiteClient) -> None:
    project = client.get_context("project_context") or {}
    missions = client.fetchall(
        "SELECT id, name, status, completed_at, notes FROM missions "
        "WHERE status IN ('Current', 'In Progress') ORDER BY completed_at IS NOT NULL, id"
    )

    active_mission_id = (project.get("working_memory") or {}).get("active_mission")
    if active_mission_id:
        print(f"Active mission from context: {active_mission_id}")
    else:
        print("Active mission not set in project context.")

    if not missions:
        print("No missions currently marked as In Progress or Current.")
        return

    print("Tracked missions in progress:")
    for mission in missions:
        line = f"- {mission.get('id')}: {mission.get('name')} [{mission.get('status')}]."
        if mission.get("completed_at"):
            line += f" completed {mission['completed_at']}"
        print(line)
        if mission.get("notes"):
            print(f"    notes: {mission['notes']}")


def _export_contexts(env: Environment, args: argparse.Namespace) -> None:
    output_root = (args.output_root or env.root).resolve()
    project_path = output_root / "PROJECT_CONTEXT.json"
    master_path = output_root / "context" / "MASTER_CONTEXT.json"
    client = _open_client(env)
    try:
        project = client.get_context("project_context") or {}
        master = client.get_context("master_context") or {}
    finally:
        client.close()

    project_path.parent.mkdir(parents=True, exist_ok=True)
    master_path.parent.mkdir(parents=True, exist_ok=True)
    project_path.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    master_path.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported project context to {project_path}")
    print(f"Exported master context to {master_path}")


def _export_backlog(env: Environment, output: Optional[Path] = None, *, quiet: bool = False) -> Path:
    if yaml is None:
        raise SystemExit("PyYAML is required for backlog export. Install pyyaml first.")
    output_path = (output or (env.root / "missions" / "backlog.yaml")).resolve()
    client = _open_client(env)
    try:
        backlog = _load_backlog(client)
    finally:
        client.close()

    metadata_doc = {
        "name": "Planning.SprintPlan.v1",
        "version": "0.0.0",
        "displayName": "CMOS Backlog Export",
        "description": "Backlog export generated from the CMOS SQLite database.",
        "author": "CMOS",
        "schema": "./schemas/SprintPlan.v1.json",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    domain_fields = {
        "type": "Planning.SprintPlan.v1",
        "sprints": backlog["sprints"],
        "missionDependencies": backlog["dependencies"],
        "promptMapping": {"prompts": backlog["prompts"]},
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump_all([metadata_doc, {"domainFields": domain_fields}], handle, sort_keys=False)
    if not quiet:
        print(f"Exported backlog to {output_path}")
    return output_path


def _sync_backlog(env: Environment) -> Path:
    path = _export_backlog(env, quiet=True)
    print(f"Backlog synced to {path}")
    return path


def _validate_foundational_refs(env: Environment) -> None:
    failures: List[str] = []
    for relative_path, rules in FOUNDATIONAL_CHECKS.items():
        file_path = env.root / relative_path
        required = rules.get("required", [])
        forbidden = rules.get("forbidden", [])
        try:
            content = file_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            failures.append(f"{relative_path}: missing file")
            continue
        for needle in required:
            if needle not in content:
                failures.append(f"{relative_path}: missing required reference '{needle}'")
        for needle in forbidden:
            if needle in content:
                failures.append(f"{relative_path}: contains forbidden reference '{needle}'")

    if failures:
        print("Foundational reference validation failed:")
        for failure in failures:
            print(f"  - {failure}")
        raise SystemExit(1)

    print("Foundational reference validation succeeded.")


def _validate_health(env: Environment) -> None:
    runtime = _build_runtime(env)
    try:
        runtime.ensure_database()
    finally:
        runtime.close()
    print(f"Database {env.db_path} is reachable and passed health checks.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CMOS helper CLI")
    parser.add_argument("--root", type=Path, default=None, help="Path to the cmos/ directory (auto-detected when omitted).")
    parser.add_argument(
        "--database",
        type=Path,
        default=None,
        help="Path to the CMOS SQLite database (default: <root>/db/cmos.sqlite)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    mission_parser = subparsers.add_parser("mission", help="Mission lifecycle helpers")
    mission_sub = mission_parser.add_subparsers(dest="mission_command", required=True)

    mission_status = mission_sub.add_parser("status", help="Show queued and active missions")
    mission_status.add_argument("--limit", type=int, default=5, help="Maximum missions to display")

    mission_start = mission_sub.add_parser("start", help="Mark a mission as In Progress")
    mission_start.add_argument("mission_id", help="Mission identifier (e.g. B3.3)")
    mission_start.add_argument("--summary", required=True, help="Session summary to log")
    mission_start.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    mission_start.add_argument("--ts", help="ISO timestamp override (UTC)")

    mission_complete = mission_sub.add_parser("complete", help="Mark a mission as Completed")
    mission_complete.add_argument("mission_id", help="Mission identifier (e.g. B3.3)")
    mission_complete.add_argument("--summary", required=True, help="Completion summary")
    mission_complete.add_argument("--notes", required=True, help="Notes to persist in the backlog")
    mission_complete.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    mission_complete.add_argument("--ts", help="ISO timestamp override (UTC)")
    mission_complete.add_argument("--next-hint", help="Optional follow-up hint to include in the session log")
    mission_complete.add_argument("--no-promote", action="store_true", help="Do not promote the next queued mission")
    mission_complete.add_argument("--immediate", action="store_true", help="Promote the next mission directly to In Progress")

    mission_block = mission_sub.add_parser("block", help="Mark a mission as Blocked")
    mission_block.add_argument("mission_id", help="Mission identifier (e.g. B3.3)")
    mission_block.add_argument("--summary", required=True, help="Short summary of the blocker")
    mission_block.add_argument("--reason", required=True, help="Reason stored in mission notes")
    mission_block.add_argument("--need", action="append", default=[], help="Follow-up need (can be repeated)")
    mission_block.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    mission_block.add_argument("--ts", help="ISO timestamp override (UTC)")
    mission_block.add_argument("--next-hint", help="Optional hint to include in the session log")

    mission_add = mission_sub.add_parser("add", help="Add a mission to the backlog database")
    mission_add.add_argument("mission_id", help="Mission identifier (e.g. B4.1)")
    mission_add.add_argument("name", help="Mission display name")
    mission_add.add_argument("--sprint", required=True, help="Sprint identifier")
    mission_add.add_argument("--status", default="Queued", help="Initial mission status (default: Queued)")
    mission_add.add_argument("--notes", help="Optional mission notes")
    mission_add.add_argument("--description", help="Description stored in metadata")
    mission_add.add_argument("--success", action="append", default=None, help="Success criteria entry (repeatable)")
    mission_add.add_argument("--deliverable", action="append", default=None, help="Deliverable entry (repeatable)")
    mission_add.add_argument("--metadata", help="Raw JSON merged into metadata (object)")

    mission_update = mission_sub.add_parser("update", help="Update mission fields in the backlog")
    mission_update.add_argument("mission_id", help="Mission identifier to update")
    mission_update.add_argument("--name", help="New mission name")
    mission_update.add_argument("--status", help="New mission status")
    mission_update.add_argument("--sprint", help="Move mission to another sprint")
    mission_update.add_argument("--notes", default=None, help="Replace mission notes")
    mission_update.add_argument("--description", help="Override metadata description")
    mission_update.add_argument("--success", action="append", default=None, help="Replace success criteria (repeatable)")
    mission_update.add_argument("--deliverable", action="append", default=None, help="Replace deliverables (repeatable)")
    mission_update.add_argument("--metadata", help="JSON merged into metadata (object)")

    mission_depends = mission_sub.add_parser("depends", help="Add or update mission dependencies")
    mission_depends.add_argument("from_id", help="Mission that blocks another")
    mission_depends.add_argument("to_id", help="Mission that is blocked")
    mission_depends.add_argument("--type", dest="dep_type", default="Blocks", help="Dependency label (default: Blocks)")

    research_parser = subparsers.add_parser("research", help="Research mission helpers")
    research_sub = research_parser.add_subparsers(dest="research_command", required=True)
    research_export = research_sub.add_parser("export", help="Export a mission's research findings to Markdown")
    research_export.add_argument("mission_id", help="Mission identifier to export")
    research_export.add_argument(
        "--output",
        type=Path,
        help="Destination path (default: <root>/research/<mission-id>.md)",
    )
    research_export.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite the destination file if it already exists",
    )
    research_export.add_argument(
        "--allow-incomplete",
        action="store_true",
        help="Allow exporting missions that have not been completed yet",
    )

    db_parser = subparsers.add_parser("db", help="Database inspection and exports")
    db_sub = db_parser.add_subparsers(dest="db_command", required=True)

    db_show = db_sub.add_parser("show", help="Display backlog or current mission state")
    db_show.add_argument("view", choices=["backlog", "current"], nargs="?", default="backlog", help="Data to display")

    db_export = db_sub.add_parser("export", help="Export contexts or backlog from the database")
    db_export.add_argument("artifact", choices=["backlog", "contexts"], help="Artifact to export")
    db_export.add_argument("--output", type=Path, help="Backlog export destination (default: cmos/missions/backlog.yaml)")
    db_export.add_argument(
        "--output-root",
        type=Path,
        help="Root directory for context exports (default: cmos root)",
    )

    validate_parser = subparsers.add_parser("validate", help="Project validation commands")
    validate_sub = validate_parser.add_subparsers(dest="validate_command", required=True)
    validate_sub.add_parser("health", help="Run a database health check")
    validate_sub.add_parser("docs", help="Validate foundational document references")

    return parser


def _handle_mission(env: Environment, args: argparse.Namespace) -> None:
    if args.mission_command == "status":
        _mission_status_cmd(env, args)
    elif args.mission_command == "start":
        _mission_start(env, args)
    elif args.mission_command == "complete":
        _mission_complete(env, args)
    elif args.mission_command == "block":
        _mission_block(env, args)
    elif args.mission_command == "add":
        _mission_add(env, args)
    elif args.mission_command == "update":
        _mission_update(env, args)
    elif args.mission_command == "depends":
        _mission_depends(env, args)
    else:  # pragma: no cover - argparse guards this
        raise SystemExit("Unknown mission subcommand")


def _handle_research(env: Environment, args: argparse.Namespace) -> None:
    if args.research_command == "export":
        _research_export(env, args)
    else:  # pragma: no cover - argparse guards this
        raise SystemExit("Unknown research subcommand")


def _handle_db(env: Environment, args: argparse.Namespace) -> None:
    if args.db_command == "show":
        client = _open_client(env)
        try:
            if args.view == "current":
                _show_current(client)
            else:
                backlog = _load_backlog(client)
                _print_backlog(backlog)
        finally:
            client.close()
    elif args.db_command == "export":
        if args.artifact == "contexts":
            _export_contexts(env, args)
        else:
            _export_backlog(env, args.output)
    else:  # pragma: no cover - argparse guards this
        raise SystemExit("Unknown db subcommand")


def _handle_validate(env: Environment, args: argparse.Namespace) -> None:
    if args.validate_command == "health":
        _validate_health(env)
    elif args.validate_command == "docs":
        _validate_foundational_refs(env)
    else:  # pragma: no cover - argparse guards this
        raise SystemExit("Unknown validate subcommand")


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    env = _resolve_environment(args)

    try:
        if args.command == "mission":
            _handle_mission(env, args)
        elif args.command == "research":
            _handle_research(env, args)
        elif args.command == "db":
            _handle_db(env, args)
        elif args.command == "validate":
            _handle_validate(env, args)
        else:  # pragma: no cover - argparse guards this
            parser.error("Unknown command")
    except (MissionRuntimeError, SQLiteClientError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
