#!/usr/bin/env python3
"""Seed Sprint 29 missions into CMOS database."""

import sys
from pathlib import Path

# Add parent directory to path to import db_client
sys.path.insert(0, str(Path(__file__).parent.parent))

from context.db_client import SQLiteClient

def seed_sprint_29():
    """Seed Sprint 29 missions."""

    db_path = Path(__file__).parent.parent / "db" / "cmos.sqlite"
    client = SQLiteClient(db_path, create_missing=False)

    sprint_id = "Sprint 29"
    sprint_title = "Communication Extension Pack"

    missions = [
        {
            "id": "B29.1",
            "name": "Communicable Trait Foundation & Messaging Schema Registry",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "Implement foundational Communicable trait and canonical messaging schema registry based on R20.1/R20.6 research",
            "success_criteria": "Trait specs, schemas (Channel/Template/DeliveryPolicy/Message/Conversation/MessageStatus), registry API, validator, docs with R20.1/R20.6 citations, ≥90% coverage",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.1-communicable-trait-foundation.yaml for comprehensive implementation guidance (385 lines). Includes: R20.1/R20.6 research findings, integration contract with Authable/Preferenceable/Classifiable, 6 entity schemas, registry/validator implementation, scaffolding reuse from Sprint 27-28, quality gates, examples.",
            "metadata": {
                "yaml_file": "cmos/missions/B29.1-communicable-trait-foundation.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "4-6 hours",
                "complexity": "Medium",
                "research": ["R20.1 Canonical Notification Model", "R20.6 Modern Messaging Systems"],
                "scaffolding": "Preferenceable/Authable registry patterns",
                "integrations": ["Authable (permissions)", "Preferenceable (routing)", "Classifiable (categorization)"]
            }
        },
        {
            "id": "B29.2",
            "name": "Communication Database Foundations & Postgres Migrations",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "PostgreSQL schema implementation: messages, delivery_attempts, conversations, channels, templates, delivery policies tables",
            "success_criteria": "10 migrations (schema + 9 tables), migration CLI, seed scripts, integration tests, schema guide + migration runbook",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.2-communication-database-foundations.yaml for comprehensive implementation guidance (390 lines). Includes: Complete DDL examples, migration orchestration CLI, seed scripts for channels/templates/policies, performance targets (<10ms message insert, <50ms unread query), rollback procedures.",
            "metadata": {
                "yaml_file": "cmos/missions/B29.2-communication-database-foundations.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "5-6 hours",
                "complexity": "Medium",
                "research": ["R20.6 Part 2.1 (Message Storage)", "R20.1 Part 3.2 (Delivery Lifecycle)"],
                "tables": ["channels", "templates", "delivery_policies", "messages", "message_recipients", "delivery_attempts", "conversations", "conversation_participants", "sla_metrics"]
            }
        },
        {
            "id": "B29.3",
            "name": "Delivery Runtime & Channel Resolution Services",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "Permission resolution engine with channel resolution, queue adapters, Authable/Preferenceable integration, <10ms delivery scheduling target",
            "success_criteria": "MessageDeliveryService, ChannelResolver, RetryScheduler, QueueAdapter (in-memory + Redis), Authable/Preferenceable bridges, <10ms p99 delivery scheduling",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.3-delivery-runtime-services.yaml for comprehensive implementation guidance (410 lines). Includes: Queue-based async delivery, permission gating via Authable, preference checking via Preferenceable, retry logic with exponential backoff, quiet hours validation, performance benchmarks.",
            "metadata": {
                "yaml_file": "cmos/missions/B29.3-delivery-runtime-services.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "5-6 hours",
                "complexity": "High",
                "research": ["R20.6 Part 4.1 (Queue Architecture)", "R20.1 Part 4.1 (Channel Routing)"],
                "performance": "<10ms p99 delivery scheduling, <5ms permission checks",
                "integrations": ["Authable (EntitlementService)", "Preferenceable (PreferenceCache)"]
            }
        },
        {
            "id": "B29.4",
            "name": "Communication Policy Builder & SLA Guardrails",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "Delivery policy DSL, throttling enforcement (sliding window), SLA metrics tracking (time-to-send, success rate, retry exhaustion)",
            "success_criteria": "DeliveryPolicyBuilder API, ThrottlingEnforcer (sliding window), SLAMonitor, SLA metrics table, diagnostics integration, ≥90% coverage",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.4-communication-policy-builder.yaml for comprehensive implementation guidance (320 lines). Includes: Policy builder with presets (standard, urgent, low priority), sliding window throttling via Redis sorted sets, SLA metrics aggregation (p50/p95/p99), throttling store implementation.",
            "metadata": {
                "yaml_file": "cmos/missions/B29.4-communication-policy-builder.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "research": ["R20.1 Part 5.1 (Rate Limiting)", "R20.6 Part 5.1 (Delivery SLOs)"],
                "scaffolding": "Sprint 28 SoD policy builder patterns"
            }
        },
        {
            "id": "B29.5",
            "name": "Communication UI Kit & Timeline Components",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "React components: MessageTimeline, ChannelPlanEditor, DeliveryHealthWidget, ConversationThread, plus hooks and Storybook stories",
            "success_criteria": "4 React components, 3 hooks (useMessages, useConversations, useDeliveryStatus), Storybook stories with theme variants, WCAG 2.2 AA compliance, ≥90% coverage",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.5-communication-ui-kit.yaml for comprehensive implementation guidance (360 lines). Includes: Virtualized timeline with react-window (1000+ messages), channel plan editor with form validation, SLA health widget with color-coded metrics, threaded conversation view with expand/collapse, a11y requirements (keyboard nav, ARIA labels, screen reader support).",
            "metadata": {
                "yaml_file": "cmos/missions/B29.5-communication-ui-kit.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "5-6 hours",
                "complexity": "Medium",
                "research": ["R20.6 Part 6.1 (Timeline UI)", "R20.6 Part 6.4 (Threading Patterns)"],
                "scaffolding": "Sprint 28 AuthZ UI components (RolePermissionMatrix → MessageTimeline)",
                "accessibility": "WCAG 2.2 AA, keyboard nav, ARIA, high-contrast support"
            }
        },
        {
            "id": "B29.6",
            "name": "Trait Integration & Message Export",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "Wire Communicable into User/Organization objects, generate helper methods, CLI tools (export, audit, admin), composition tests",
            "success_criteria": "User + Communicable composition, Organization + Communicable composition, 3 CLI tools (export, audit, admin), integration examples, integration tests, ≥90% coverage",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.6-trait-integration-message-export.yaml for comprehensive implementation guidance (325 lines). Includes: Object composition (User/Org + Communicable), generator extensions for helper methods, CLI tools (message export as JSON/CSV/HTML, audit reports, channel/template/policy admin), integration tests validating Authable/Preferenceable bridges.",
            "metadata": {
                "yaml_file": "cmos/missions/B29.6-trait-integration-message-export.yaml",
                "instruction": "Read the YAML file for complete implementation details",
                "estimatedEffort": "4-5 hours",
                "complexity": "Medium",
                "scaffolding": "Sprint 28 Authable integration patterns (CLI tools, object composition)",
                "integration": "User/Organization objects with Communicable trait"
            }
        },
        {
            "id": "B29.7",
            "name": "Sprint 29 Close-out & Sprint 30 Preparation",
            "sprint_id": sprint_id,
            "status": "Queued",
            "objective": "Retrospective, changelog, diagnostics updates, MASTER_CONTEXT sync, context snapshot, Sprint 30 prep",
            "success_criteria": "Retrospective, changelog, diagnostics updated with Communication sections, MASTER_CONTEXT updated with decisions, context snapshot, Sprint 30 prep document (pending user discussion on scope)",
            "notes": "📋 FULL MISSION DETAILS: Read cmos/missions/B29.7-sprint-closeout.yaml for comprehensive implementation guidance (285 lines). Includes: Validation checklist (code quality, build pipeline, a11y, database, documentation), metrics to capture (deliverables, coverage, performance), learnings placeholders, Sprint 30 discussion points (Content Management vs alternatives).",
            "metadata": {
                "yaml_file": "cmos/missions/B29.7-sprint-closeout.yaml",
                "instruction": "Read the YAML file for complete implementation details",
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
                    id, name, sprint_id, status, objective,
                    success_criteria, notes, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mission["id"],
                    mission["name"],
                    mission["sprint_id"],
                    mission["status"],
                    mission["objective"],
                    mission["success_criteria"],
                    mission["notes"],
                    str(mission["metadata"])  # Convert dict to string for storage
                )
            )
            print(f"✓ Added mission {mission['id']}: {mission['name']}")

    client.close()
    print(f"\n✅ Sprint 29 seeded successfully! Total missions: {len(missions)}")
    print(f"\nNext steps:")
    print(f"  1. Export backlog: ./cmos/cli.py db export backlog")
    print(f"  2. View current: ./cmos/cli.py db show current")
    print(f"  3. Start first mission: python -c 'from cmos.context.mission_runtime import next_mission, start; m = next_mission(); print(m)'")

if __name__ == "__main__":
    seed_sprint_29()
