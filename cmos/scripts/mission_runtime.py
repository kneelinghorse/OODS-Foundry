#!/usr/bin/env python3
"""Mission runtime CLI using the canonical SQLite data store."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


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

from context.mission_runtime import (
    MissionRuntime,
    MissionRuntimeError,
    block as block_mission,
    complete as complete_mission,
    start as start_mission,
    utc_now,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CMOS mission runtime helper")
    parser.add_argument("--root", type=Path, default=CMOS_ROOT, help="CMOS directory (default: auto-detected)")

    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start", help="Mark a mission as In Progress")
    start_parser.add_argument("--mission", required=True, help="Mission identifier (e.g. S4.1)")
    start_parser.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    start_parser.add_argument("--summary", required=True, help="Session summary message")
    start_parser.add_argument("--ts", help="ISO timestamp (UTC). Defaults to now.")

    complete_parser = subparsers.add_parser("complete", help="Mark a mission as Completed")
    complete_parser.add_argument("--mission", required=True, help="Mission identifier (e.g. S4.1)")
    complete_parser.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    complete_parser.add_argument("--summary", required=True, help="Completion summary")
    complete_parser.add_argument("--notes", required=True, help="Notes to persist in backlog and DB")
    complete_parser.add_argument("--ts", help="ISO timestamp (UTC). Defaults to now.")
    complete_parser.add_argument("--next-hint", help="Override next_hint field in session log")
    complete_parser.add_argument("--no-promote", action="store_true", help="Do not promote the next queued mission")
    complete_parser.add_argument("--immediate", action="store_true", help="Promote next mission directly to In Progress")

    block_parser = subparsers.add_parser("block", help="Mark a mission as Blocked")
    block_parser.add_argument("--mission", required=True, help="Mission identifier (e.g. S4.1)")
    block_parser.add_argument("--agent", default="codex", help="Agent identifier for session logging")
    block_parser.add_argument("--summary", required=True, help="Blocker summary")
    block_parser.add_argument("--reason", required=True, help="Reason to persist in notes and metadata")
    block_parser.add_argument("--need", action="append", default=[], help="Add a required follow-up item (can be repeated)")
    block_parser.add_argument("--ts", help="ISO timestamp (UTC). Defaults to now.")
    block_parser.add_argument("--next-hint", help="Follow-up hint to include in the session log")

    status_parser = subparsers.add_parser("status", help="Show the highest priority mission candidates")
    status_parser.add_argument("--limit", type=int, default=5, help="Limit number of missions displayed")

    return parser


def handle_start(args: argparse.Namespace) -> None:
    result = start_mission(
        args.mission,
        agent=args.agent,
        summary=args.summary,
        ts=args.ts or utc_now(),
        repo_root=args.root,
    )
    print(json.dumps(result.event, indent=2, ensure_ascii=False))


def handle_complete(args: argparse.Namespace) -> None:
    result = complete_mission(
        args.mission,
        agent=args.agent,
        summary=args.summary,
        notes=args.notes,
        ts=args.ts or utc_now(),
        next_hint=args.next_hint,
        promote_next=not args.no_promote,
        immediate=args.immediate,
        repo_root=args.root,
    )
    output = {
        "event": result.event,
        "next_mission": result.next_mission
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


def handle_block(args: argparse.Namespace) -> None:
    result = block_mission(
        args.mission,
        agent=args.agent,
        summary=args.summary,
        reason=args.reason,
        needs=args.need or [],
        ts=args.ts or utc_now(),
        next_hint=args.next_hint,
        repo_root=args.root,
    )
    print(json.dumps(result.event, indent=2, ensure_ascii=False))


def handle_status(args: argparse.Namespace) -> None:
    runtime = MissionRuntime(repo_root=args.root)
    try:
        runtime.ensure_database()
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
            {"limit": args.limit}
        )
    finally:
        runtime.close()
    print(json.dumps(rows, indent=2, ensure_ascii=False))


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "start":
            handle_start(args)
        elif args.command == "complete":
            handle_complete(args)
        elif args.command == "block":
            handle_block(args)
        elif args.command == "status":
            handle_status(args)
        else:
            parser.error("Unknown command")
    except MissionRuntimeError as error:
        raise SystemExit(f"Mission runtime error: {error}") from error


if __name__ == "__main__":
    main()
