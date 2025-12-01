#!/usr/bin/env python3
"""
Migrate historical data from old CMOS database to new database.

This script:
1. Copies missing context_snapshots from old DB
2. Extracts decisions from master_context JSON and populates strategic_decisions table
3. Preserves historical timeline
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

def migrate_snapshots(old_db_path: Path, new_db_path: Path) -> int:
    """Copy missing context snapshots from old DB to new DB."""
    old_conn = sqlite3.connect(old_db_path)
    new_conn = sqlite3.connect(new_db_path)
    old_conn.row_factory = sqlite3.Row
    new_conn.row_factory = sqlite3.Row
    
    # Get existing snapshot timestamps in new DB
    existing_dates = {
        row['created_at'] 
        for row in new_conn.execute("SELECT created_at FROM context_snapshots").fetchall()
    }
    
    # Get all snapshots from old DB
    old_snapshots = old_conn.execute("""
        SELECT context_id, session_id, source, content_hash, content, created_at
        FROM context_snapshots
        ORDER BY created_at
    """).fetchall()
    
    migrated = 0
    for snap in old_snapshots:
        if snap['created_at'] not in existing_dates:
            new_conn.execute("""
                INSERT INTO context_snapshots 
                (context_id, session_id, source, content_hash, content, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                snap['context_id'],
                snap['session_id'],
                snap['source'],
                snap['content_hash'],
                snap['content'],
                snap['created_at']
            ))
            migrated += 1
            print(f"  ✅ Migrated snapshot: {snap['context_id']} @ {snap['created_at']}")
            print(f"     Source: {snap['source']}")
    
    new_conn.commit()
    old_conn.close()
    new_conn.close()
    
    return migrated


def populate_strategic_decisions(db_path: Path) -> int:
    """Extract decisions from master_context JSON and populate strategic_decisions table."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # Get current master_context
    ctx = conn.execute("SELECT content FROM contexts WHERE id = 'master_context'").fetchone()
    if not ctx:
        print("  ⚠️  No master_context found in contexts table")
        conn.close()
        return 0
    
    master = json.loads(ctx['content'])
    decisions = master.get("decisions_made", [])
    
    if not decisions:
        print("  ℹ️  No decisions found in master_context")
        conn.close()
        return 0
    
    # Get existing decision count
    existing_count = conn.execute("SELECT COUNT(*) as cnt FROM strategic_decisions").fetchone()['cnt']
    
    if existing_count >= len(decisions):
        print(f"  ℹ️  strategic_decisions table already up to date ({existing_count} rows)")
        conn.close()
        return 0
    
    # Insert new decisions
    inserted = 0
    for decision in decisions:
        if isinstance(decision, dict):
            date = decision.get('date', datetime.utcnow().isoformat())
            text = decision.get('decision', str(decision))
            category = decision.get('category', None)
            sprint_id = decision.get('sprint_id', None)
        else:
            # String format: extract session ID if present
            text = str(decision)
            date = datetime.utcnow().isoformat()
            category = None
            sprint_id = None
            
            # Try to extract session ID from string like "(from PS-2025-11-13-001)"
            if "(from PS-" in text:
                parts = text.split("(from ")
                if len(parts) > 1:
                    session_part = parts[1].split(")")[0]
                    text = parts[0].strip()
        
        # Check if this decision already exists
        existing = conn.execute("""
            SELECT id FROM strategic_decisions 
            WHERE decision_text = ? AND created_at = ?
        """, (text, date)).fetchone()
        
        if not existing:
            conn.execute("""
                INSERT INTO strategic_decisions 
                (decision_text, created_at, sprint_id, project_domain, context_id)
                VALUES (?, ?, ?, ?, 'master_context')
            """, (text, date, sprint_id, 'oods-foundry'))
            inserted += 1
            print(f"  ✅ Added decision: {text[:60]}")
    
    conn.commit()
    conn.close()
    
    return inserted


def main():
    """Main migration workflow."""
    repo_root = Path(__file__).resolve().parent.parent
    old_db = repo_root / "db" / "cmos-old.sqlite"
    new_db = repo_root / "db" / "cmos.sqlite"
    
    if not old_db.exists():
        print(f"❌ Old database not found: {old_db}")
        print("   If you don't have an old database to migrate from, this is fine!")
        return 0
    
    print("=" * 80)
    print("CMOS Historical Data Migration")
    print("=" * 80)
    
    print("\n1. Migrating context snapshots...")
    snapshot_count = migrate_snapshots(old_db, new_db)
    print(f"   Migrated {snapshot_count} snapshots")
    
    print("\n2. Populating strategic_decisions table...")
    decision_count = populate_strategic_decisions(new_db)
    print(f"   Added {decision_count} decisions")
    
    print("\n" + "=" * 80)
    print(f"✅ Migration complete!")
    print(f"   - {snapshot_count} snapshots migrated")
    print(f"   - {decision_count} decisions indexed")
    print("=" * 80)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

