#!/usr/bin/env python3
"""Utility commands for inspecting and exporting CMOS state from the SQLite database."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

try:
    import yaml  # type: ignore
except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
    raise SystemExit("PyYAML is required for db_tools.py") from exc


def _find_cmos_root() -> Path:
    """Find cmos/ directory from any working directory.
    
    Searches in order:
    1. Check if script is in cmos/scripts/ (standard location)
    2. Check if cmos/ exists relative to cwd
    3. Walk up parent directories looking for cmos/
    
    Returns:
        Path to cmos/ directory
        
    Raises:
        RuntimeError: If cmos/ directory cannot be found
    """
    script_dir = Path(__file__).resolve().parent
    
    # Are we in cmos/scripts/?
    candidate = script_dir.parent
    if (candidate / "db" / "schema.sql").exists() and (candidate / "agents.md").exists():
        return candidate
    
    # Is cmos/ a subdirectory of cwd?
    if (Path.cwd() / "cmos" / "db" / "schema.sql").exists():
        return Path.cwd() / "cmos"
    
    # Walk up from cwd looking for cmos/
    current = Path.cwd().resolve()
    for _ in range(5):
        if (current / "cmos" / "db" / "schema.sql").exists():
            return current / "cmos"
        if current.parent == current:  # Reached filesystem root
            break
        current = current.parent
    
    raise RuntimeError(
        "Cannot find cmos/ directory. Please run from project root or set CMOS_ROOT environment variable."
    )


CMOS_ROOT = _find_cmos_root()
if str(CMOS_ROOT) not in sys.path:
    sys.path.insert(0, str(CMOS_ROOT))

from context.db_client import SQLiteClient, SQLiteClientError

DEFAULT_DB_PATH = CMOS_ROOT / "db" / "cmos.sqlite"


def _open_client(db_path: Path) -> SQLiteClient:
    return SQLiteClient(db_path, create_missing=False)


def _ensure_output_path(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


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


def export_contexts(args: argparse.Namespace) -> None:
    client = _open_client(args.database)
    try:
        project = client.get_context("project_context") or {}
        master = client.get_context("master_context") or {}
    finally:
        client.close()

    output_root = args.output_root.resolve() if args.output_root else CMOS_ROOT
    project_path = output_root / "PROJECT_CONTEXT.json"
    master_path = output_root / "context" / "MASTER_CONTEXT.json"
    _ensure_output_path(project_path)
    _ensure_output_path(master_path)
    project_path.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    master_path.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported project context to {project_path}")
    print(f"Exported master context to {master_path}")


def export_backlog(args: argparse.Namespace) -> None:
    client = _open_client(args.database)
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
        "generatedAt": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
    }

    domain_fields = {
        "type": "Planning.SprintPlan.v1",
        "sprints": backlog["sprints"],
        "missionDependencies": backlog["dependencies"],
        "promptMapping": {"prompts": backlog["prompts"]},
    }

    output_path = args.output.resolve()
    _ensure_output_path(output_path)
    with output_path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump_all([metadata_doc, {"domainFields": domain_fields}], handle, sort_keys=False)
    print(f"Exported backlog to {output_path}")


def show_backlog(args: argparse.Namespace) -> None:
    client = _open_client(args.database)
    try:
        backlog = _load_backlog(client)
    finally:
        client.close()

    if not backlog["sprints"]:
        print("No sprints defined in the database.")
        return

    for sprint in backlog["sprints"]:
        print(f"[{sprint.get('sprintId') or 'UNSET'}] {sprint.get('title') or '(untitled sprint)'}")
        status = sprint.get("status") or "unknown"
        window = " - ".join(filter(None, [sprint.get("startDate"), sprint.get("endDate")]))
        print(f"  status: {status}")
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


def show_current_mission(args: argparse.Namespace) -> None:
    client = _open_client(args.database)
    try:
        project = client.get_context("project_context") or {}
        missions = client.fetchall(
            "SELECT id, name, status, completed_at, notes FROM missions WHERE status IN ('Current', 'In Progress') ORDER BY completed_at IS NOT NULL, id"
        )
    finally:
        client.close()

    active_mission_id = (project.get("working_memory") or {}).get("active_mission")
    if active_mission_id:
        print(f"Active mission from context: {active_mission_id}")
    else:
        print("Active mission not set in project context.")

    if missions:
        print("Tracked missions in progress:")
        for mission in missions:
            line = f"- {mission.get('id')}: {mission.get('name')} [{mission.get('status')}]."
            if mission.get("completed_at"):
                line += f" completed {mission['completed_at']}"
            print(line)
            if mission.get("notes"):
                print(f"    notes: {mission['notes']}")
    else:
        print("No missions currently marked as In Progress or Current.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CMOS SQLite helper commands")
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to the CMOS SQLite database (default: {DEFAULT_DB_PATH})",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    export_ctx = subparsers.add_parser("export-contexts", help="Write PROJECT_CONTEXT.json and MASTER_CONTEXT.json from the database")
    export_ctx.add_argument(
        "--output-root",
        type=Path,
        default=None,
        help="Directory that will receive PROJECT_CONTEXT.json and context/MASTER_CONTEXT.json (default: cmos root)",
    )
    export_ctx.set_defaults(func=export_contexts)

    export_backlog_parser = subparsers.add_parser("export-backlog", help="Write missions/backlog.yaml based on the database")
    export_backlog_parser.add_argument(
        "--output",
        type=Path,
        default=CMOS_ROOT / "missions" / "backlog.yaml",
        help="Output backlog YAML path (default: cmos/missions/backlog.yaml)",
    )
    export_backlog_parser.set_defaults(func=export_backlog)

    show_backlog_parser = subparsers.add_parser("show-backlog", help="Display sprint and mission status from the database")
    show_backlog_parser.set_defaults(func=show_backlog)

    current_parser = subparsers.add_parser("show-current", help="Display the current mission and active work indicators")
    current_parser.set_defaults(func=show_current_mission)

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        args.func(args)
    except SQLiteClientError as error:
        print(f"Database error: {error}", file=sys.stderr)
        return 1
    except FileNotFoundError as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
