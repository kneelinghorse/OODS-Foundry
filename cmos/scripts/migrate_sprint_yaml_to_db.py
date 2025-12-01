#!/usr/bin/env python3
"""Migrate mission YAML files from sprint folders into the CMOS database.

This script handles the case where agents write mission specs to YAML files
instead of directly to the database. It maps YAML mission specs to existing
backlog entries and updates the database with full mission content.

Usage:
    python scripts/migrate_sprint_yaml_to_db.py --sprint 20
    python scripts/migrate_sprint_yaml_to_db.py --sprint 20 --dry-run
    python scripts/migrate_sprint_yaml_to_db.py --all  # Process all sprints
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

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


def load_yaml_mission(yaml_path: Path) -> Dict[str, Any] | None:
    """Load a mission YAML file and return its content."""
    try:
        with yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if not data:
                return None
            return data
    except (yaml.YAMLError, IOError) as e:
        print(f"Warning: Failed to load {yaml_path}: {e}", file=sys.stderr)
        return None


def find_sprint_yaml_files(missions_dir: Path, sprint_number: int | None = None) -> Dict[str, List[Tuple[Path, Dict[str, Any]]]]:
    """Find all YAML files in sprint directories.
    
    Returns:
        Dict mapping sprint_id (e.g., "Sprint 20") to list of (file_path, mission_data) tuples
    """
    sprint_files: Dict[str, List[Tuple[Path, Dict[str, Any]]]] = {}
    
    if not missions_dir.exists():
        print(f"Error: Missions directory not found: {missions_dir}", file=sys.stderr)
        return sprint_files
    
    # Determine which sprints to process
    if sprint_number is not None:
        sprint_dirs = [missions_dir / f"sprint-{sprint_number:02d}"]
    else:
        sprint_dirs = sorted(missions_dir.glob("sprint-*"))
    
    for sprint_dir in sprint_dirs:
        if not sprint_dir.is_dir():
            continue
        
        # Extract sprint number from directory name
        try:
            sprint_num = int(sprint_dir.name.split("-")[1])
            sprint_id = f"Sprint {sprint_num:02d}"
        except (IndexError, ValueError):
            print(f"Warning: Could not parse sprint number from {sprint_dir.name}", file=sys.stderr)
            continue
        
        yaml_files = list(sprint_dir.glob("*.yaml"))
        if not yaml_files:
            continue
        
        sprint_files[sprint_id] = []
        
        for yaml_file in sorted(yaml_files):
            mission_data = load_yaml_mission(yaml_file)
            if mission_data:
                sprint_files[sprint_id].append((yaml_file, mission_data))
    
    return sprint_files


def get_backlog_missions(connection: sqlite3.Connection, sprint_id: str) -> List[Dict[str, Any]]:
    """Get missions from database for a specific sprint."""
    cursor = connection.execute(
        """
        SELECT id, name, status, notes, objective, context
        FROM missions
        WHERE sprint_id = ?
        ORDER BY id
        """,
        (sprint_id,)
    )
    
    columns = [desc[0] for desc in cursor.description]
    missions = []
    for row in cursor.fetchall():
        mission = dict(zip(columns, row))
        missions.append(mission)
    
    return missions


def match_yaml_to_backlog(
    yaml_missions: List[Tuple[Path, Dict[str, Any]]],
    backlog_missions: List[Dict[str, Any]]
) -> List[Tuple[str, Path, Dict[str, Any]]]:
    """Match YAML files to backlog mission IDs.
    
    Returns:
        List of (backlog_id, yaml_path, yaml_data) tuples
    """
    matches = []
    
    # Sort both by filename/id to match them positionally
    yaml_sorted = sorted(yaml_missions, key=lambda x: x[0].name)
    backlog_sorted = sorted(backlog_missions, key=lambda x: x['id'])
    
    # Try exact matching first (by position and name similarity)
    for i, (yaml_path, yaml_data) in enumerate(yaml_sorted):
        if i < len(backlog_sorted):
            backlog_mission = backlog_sorted[i]
            
            # Check if names are similar (for validation)
            yaml_name = yaml_data.get('objective', '')[:50]
            backlog_name = backlog_mission.get('name', '')
            
            print(f"  Matching: {yaml_path.name}")
            print(f"    → Backlog ID: {backlog_mission['id']}")
            print(f"    → Backlog name: {backlog_name}")
            print(f"    → YAML objective: {yaml_name}...")
            
            matches.append((backlog_mission['id'], yaml_path, yaml_data))
    
    return matches


def serialize_json_field(value: Any) -> str | None:
    """Serialize list or dict to JSON, return None for empty."""
    if not value:
        return None
    return json.dumps(value, ensure_ascii=False)


def update_mission_in_db(
    connection: sqlite3.Connection,
    mission_id: str,
    yaml_data: Dict[str, Any],
    dry_run: bool = False
) -> None:
    """Update a mission in the database with YAML content."""
    
    update_fields = {
        "objective": yaml_data.get("objective"),
        "context": yaml_data.get("context"),
        "success_criteria": serialize_json_field(yaml_data.get("successCriteria")),
        "deliverables": serialize_json_field(yaml_data.get("deliverables")),
        "reference_docs": serialize_json_field(yaml_data.get("references")),
        "domain_fields": serialize_json_field(yaml_data.get("domainFields")),
    }
    
    if dry_run:
        print(f"    [DRY RUN] Would update mission {mission_id} with:")
        for key, value in update_fields.items():
            preview = str(value)[:100] if value else "(empty)"
            print(f"      {key}: {preview}...")
        return
    
    connection.execute(
        """
        UPDATE missions
        SET objective = ?,
            context = ?,
            success_criteria = ?,
            deliverables = ?,
            reference_docs = ?,
            domain_fields = ?
        WHERE id = ?
        """,
        (
            update_fields["objective"],
            update_fields["context"],
            update_fields["success_criteria"],
            update_fields["deliverables"],
            update_fields["reference_docs"],
            update_fields["domain_fields"],
            mission_id
        )
    )
    
    print(f"    ✓ Updated mission {mission_id} in database")


def migrate_sprint(
    cmos_root: Path,
    sprint_number: int | None = None,
    dry_run: bool = False,
    db_path: Path | None = None
) -> None:
    """Migrate YAML missions for a sprint into the database."""
    
    missions_dir = cmos_root / "missions"
    if db_path is None:
        db_path = cmos_root / "db" / "cmos.sqlite"
    
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}", file=sys.stderr)
        print("Run 'python cmos/scripts/seed_sqlite.py' first to create the database.", file=sys.stderr)
        sys.exit(1)
    
    # Find YAML files
    sprint_yaml_files = find_sprint_yaml_files(missions_dir, sprint_number)
    
    if not sprint_yaml_files:
        if sprint_number:
            print(f"No YAML files found for Sprint {sprint_number}")
        else:
            print("No YAML files found in any sprint directories")
        return
    
    # Connect to database
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    
    try:
        total_updated = 0
        
        for sprint_id, yaml_files in sorted(sprint_yaml_files.items()):
            print(f"\n{'='*60}")
            print(f"Processing {sprint_id}")
            print(f"{'='*60}")
            print(f"Found {len(yaml_files)} YAML files")
            
            # Get backlog missions for this sprint
            backlog_missions = get_backlog_missions(connection, sprint_id)
            
            if not backlog_missions:
                print(f"Warning: No missions found in database for {sprint_id}")
                print(f"Consider adding them to backlog first or running seed_sqlite.py")
                continue
            
            print(f"Found {len(backlog_missions)} missions in database backlog")
            
            # Match YAML files to backlog entries
            matches = match_yaml_to_backlog(yaml_files, backlog_missions)
            
            # Update database
            for backlog_id, yaml_path, yaml_data in matches:
                update_mission_in_db(connection, backlog_id, yaml_data, dry_run)
                total_updated += 1
        
        if not dry_run:
            connection.commit()
            print(f"\n{'='*60}")
            print(f"✓ Successfully updated {total_updated} missions in database")
            print(f"{'='*60}")
        else:
            print(f"\n{'='*60}")
            print(f"[DRY RUN] Would update {total_updated} missions")
            print(f"Run without --dry-run to apply changes")
            print(f"{'='*60}")
    
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate mission YAML files into CMOS database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Migrate Sprint 20 missions (dry run first)
  python scripts/migrate_sprint_yaml_to_db.py --sprint 20 --dry-run
  
  # Actually apply the migration
  python scripts/migrate_sprint_yaml_to_db.py --sprint 20
  
  # Migrate all sprints
  python scripts/migrate_sprint_yaml_to_db.py --all
        """
    )
    
    parser.add_argument(
        "--sprint",
        type=int,
        help="Sprint number to migrate (e.g., 20 for Sprint 20)"
    )
    
    parser.add_argument(
        "--all",
        action="store_true",
        help="Migrate all sprint directories"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes"
    )
    
    parser.add_argument(
        "--root",
        type=Path,
        default=CMOS_ROOT,
        help="Path to cmos/ directory (default: auto-detected)"
    )
    
    parser.add_argument(
        "--db",
        type=Path,
        help="Path to database file (default: <root>/db/cmos.sqlite)"
    )
    
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    
    if not args.sprint and not args.all:
        print("Error: Must specify either --sprint N or --all", file=sys.stderr)
        sys.exit(1)
    
    sprint_number = args.sprint if not args.all else None
    
    try:
        migrate_sprint(
            cmos_root=args.root.resolve(),
            sprint_number=sprint_number,
            dry_run=args.dry_run,
            db_path=args.db.resolve() if args.db else None
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

