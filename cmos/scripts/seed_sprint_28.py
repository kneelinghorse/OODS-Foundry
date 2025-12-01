#!/usr/bin/env python3
"""Seed Sprint 28 missions into CMOS database."""

import sys
from pathlib import Path

# Add parent directory to path to import db_client
sys.path.insert(0, str(Path(__file__).parent.parent))

from context.db_client import SQLiteClient

def seed_sprint_28():
    """Seed Sprint 28 missions."""

    db_path = Path(__file__).parent.parent / "db" / "cmos.sqlite"
    client = SQLiteClient(db_path, create_missing=False)

    sprint_id = "Sprint 28"
    sprint_title = "Authorization Extension Pack"

    missions = [
        {
            "id": "B28.1",
            "name": "Authable Trait Foundation & RBAC Schema Registry",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Implement foundational Authable trait and canonical RBAC schema registry with R21.2 patterns",
            "success_criteria": "Trait specs, schemas (Role/Permission/Membership), registry API, validator, docs with R21.2 citations, ≥90% coverage",
            "metadata": {
                "estimatedEffort": "4-6 hours",
                "complexity": "Medium",
                "research": ["R21.2 Part 2, Part 4.2"],
                "scaffolding": "Preferenceable registry pattern"
            }
        },
        {
            "id": "B28.2",
            "name": "RBAC Database Foundations & SQL Migrations",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "PostgreSQL schema implementation: 5-table RBAC model + SoD tables, triggers, indexes, seed scripts",
            "success_criteria": "8 migrations (authz schema, 5 core tables, SoD tables, trigger), rollbacks, seed scripts, integration tests",
            "metadata": {
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "research": ["R21.2 Part 4.2", "R28.1 Part 2"],
                "tables": ["roles", "permissions", "role_permissions", "memberships", "role_hierarchy", "sod_role_conflicts", "action_log"]
            }
        },
        {
            "id": "B28.3",
            "name": "Role Graph & Entitlement Runtime Services",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Permission resolution engine with role hierarchy traversal, <5ms performance target",
            "success_criteria": "Role graph resolver (recursive CTE), entitlement service, membership service, <5ms p99 benchmarks",
            "metadata": {
                "estimatedEffort": "5-6 hours",
                "complexity": "High",
                "research": ["R21.2 Part 3.1"],
                "performance": "<5ms p99"
            }
        },
        {
            "id": "B28.4",
            "name": "SoD Policy Builder & Validator",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Separation of Duty policy management: Static SoD enforcement + Dynamic SoD detection",
            "success_criteria": "Policy builder API, SoD validator, Static SoD enforcement (via B28.2 trigger), Dynamic SoD detection (audit mode)",
            "metadata": {
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "research": ["R28.1 Part 1, Part 2"],
                "scope": "v1.0: Static + Dynamic detection; v2.0: Quorum"
            }
        },
        {
            "id": "B28.5",
            "name": "Permission Cache & Performance Guardrails",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Permission caching infrastructure mirroring Preferenceable patterns: Redis adapter, warmers, metrics",
            "success_criteria": "PermissionCache, Redis adapter, cache warmer, metrics table, <5ms p99 with cache, >80% hit rate",
            "metadata": {
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "scaffolding": "Preferenceable cache patterns",
                "performance": "<5ms p99, >80% hit rate"
            }
        },
        {
            "id": "B28.6",
            "name": "Role Matrix UI & Policy Editor Components",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "React components: RolePermissionMatrix, MembershipManager, SoDPolicyEditor, CLI tools",
            "success_criteria": "4 React components, hooks, Storybook stories, a11y compliance (WCAG 2.2 AA), CLI admin tools",
            "metadata": {
                "estimatedEffort": "5-6 hours",
                "complexity": "Medium",
                "scaffolding": "Preferenceable UI (NotificationMatrix → RolePermissionMatrix)",
                "accessibility": "WCAG 2.2 AA, keyboard nav"
            }
        },
        {
            "id": "B28.7",
            "name": "Trait Integration & Entitlement Export",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Wire Authable into User/Organization objects, entitlement export CLI, composition tests",
            "success_criteria": "User + Authable composition, Organization + Authable composition, entitlement export CLI, audit CLI, integration tests",
            "metadata": {
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "integration": "R21.2 Part 4.2 TABLE 4 (Membership contract)"
            }
        },
        {
            "id": "B28.8",
            "name": "Sprint 28 Close-out & Sprint 29 Preparation",
            "sprint_id": sprint_id,
            "status": "Queued",
            "description": "Retrospective, diagnostics updates, context sync, changelog, Sprint 29 prep",
            "success_criteria": "Retrospective, changelog, diagnostics updated, MASTER_CONTEXT updated, context snapshot, Sprint 29 backlog seeded",
            "metadata": {
                "estimatedEffort": "2-3 hours",
                "complexity": "Low"
            }
        }
    ]

    # Insert missions
    with client.transaction() as conn:
        for mission in missions:
            # Check if mission already exists
            existing = conn.execute(
                "SELECT id FROM missions WHERE id = ?",
                (mission["id"],)
            ).fetchone()

            if existing:
                print(f"✓ Mission {mission['id']} already exists, skipping")
                continue

            conn.execute(
                """
                INSERT INTO missions (
                    id, name, sprint_id, status, description,
                    success_criteria, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mission["id"],
                    mission["name"],
                    mission["sprint_id"],
                    mission["status"],
                    mission["description"],
                    mission["success_criteria"],
                    str(mission["metadata"])  # Convert dict to string for storage
                )
            )
            print(f"✓ Added mission {mission['id']}: {mission['name']}")

    client.close()
    print(f"\n✅ Sprint 28 seeded successfully! Total missions: {len(missions)}")
    print(f"\nNext steps:")
    print(f"  1. Export backlog: ./cmos/cli.py db export backlog")
    print(f"  2. View current: ./cmos/cli.py db show current")
    print(f"  3. Start first mission: python -c 'from cmos.context.mission_runtime import next_mission, start; m = next_mission(); print(m)'")

if __name__ == "__main__":
    seed_sprint_28()
