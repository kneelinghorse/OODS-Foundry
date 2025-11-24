# CMOS Operations Guide

This guide consolidates operational procedures for both AI agents and human maintainers working with CMOS. All practices assume the SQLite-backed runtime is authoritative and every session follows the backlog-driven mission lifecycle.

---

## Purpose

- Align agent prompts, mission orchestration, and validation commands with CMOS guardrails
- Provide deterministic steps for context management, delegation patterns, and failure recovery
- Ensure automation honors security, quality, and telemetry requirements before marking missions complete
- Document procedures maintainers follow when operating CMOS

---

## Core Workflows

### Context Intake

1. **Load core context**: Read `cmos/agents.md` for CMOS operations guidance. Contexts (PROJECT and MASTER) are loaded from the database via the mission runtime helpers or SQLiteClient.
2. **Validate session state**: Check database health and review recent sessions via `./cmos/cli.py db show current`.
3. **Assess mission readiness**: Query database for next mission via `next_mission()` and ensure prerequisites are completed.
4. **Document assumptions**: If new constraints surface, update MASTER_CONTEXT in database via SQLiteClient.

**AI Agent Requirements**:
- Load `cmos/agents.md` before any mission; treat it as non-optional configuration
- Honor directory-specific overrides when editing submodules
- Mirror mission selection, session count, and last-session markers between `PROJECT_CONTEXT.json`, the `contexts` table, and `SESSIONS.jsonl`
- Follow OWASP rules; never echo secrets in prompts or logs

### Mission Lifecycle

1. **Select mission**: Apply status precedence (`In Progress` → `Current` → `Queued`). Use `next_mission()` to get the next candidate.
2. **Start**: Use `start()` to mark In Progress and log to database.
3. **Execute**: Follow mission requirements. Capture intermediate decisions in mission notes or MASTER_CONTEXT (in database).
4. **Validate**: Run required tests and link validators. Document outcomes in mission notes.
5. **Complete**: Use `complete()` to mark Completed, record notes, and auto-promote the next mission.
6. **Export research artifacts**: When the mission is research-focused, run `./cmos/cli.py research export <mission-id>` to capture the Markdown report under `cmos/research/` before committing.

**Orchestration Patterns**:
- Choose a single mode (`none`, `rsip`, `delegation`, `boomerang`) per mission
- Document the pattern decision in mission notes
- Follow pattern-specific validation requirements

### Runtime Operations

- **Database-only storage**: `cmos/db/cmos.sqlite` is the single source of truth. All missions, contexts, and sessions live in the database.
- **Export on-demand**: Generate file views when needed:
  - `./cmos/cli.py db export backlog` - Export current backlog
  - `./cmos/cli.py db export contexts` - Export PROJECT and MASTER contexts
- **Backlog editing**: Use `./cmos/cli.py mission add|update|depends` to manage backlog entries. Each command updates SQLite first and then rewrites `cmos/missions/backlog.yaml` automatically.
- **Research exports**: After completing research missions, generate Markdown reports with `./cmos/cli.py research export <mission-id>`. Commit only the exported file; the SQLite database remains authoritative.
- **Seeding**: Import from external sources with `python cmos/scripts/seed_sqlite.py --data-root <path>`
- **Telemetry**: Database health events logged to `cmos/telemetry/events/database-health.jsonl`. Review after sessions.
- **Failure handling**: Log blockers with `status: Blocked` in database. Document unblock requirements in mission metadata.

### Quality & Security

**Test Suite Matrix**

| Suite | Focus | Command | When to Run |
| --- | --- | --- | --- |
| Integration | Presence and wiring of mission templates, context files, orchestration assets | `node cmos/context/integration_test_runner.js` | After template/asset changes |
| Security Guardrails | OWASP coverage, context protection, forbidden patterns | `npm run test:integration -- security` | After security guidance changes |
| Quality Assurance | LLM output validation and style enforcement | `npm run test:quality` | After code generation changes |
| Performance Benchmarks | Regression checks for runtime throughput | `npm run test:performance` | After runtime changes |
| Backward Compatibility | Legacy mission scenarios and workflows | `npm run test:integration -- backward` | Before major releases |
| Database Health | SQLite connectivity and integrity | `./cmos/cli.py db show current` | Start of each session |
| Documentation Links | Foundational doc references | `./cmos/cli.py validate docs` | After doc updates |

**Mandatory Checkpoints**

1. **Before completing any mission**:
   - Run applicable test suites based on what was modified (use git diff to scope)
   - Run `./cmos/cli.py validate docs` if documentation was updated
   - Document test results in mission notes

2. **Before closing a session**:
   - Check database health: `./cmos/cli.py db show current`
   - Review `cmos/telemetry/events/database-health.jsonl` for anomalies
   - Verify recent missions are tracked correctly

3. **During sprint planning**:
   - Review test results from previous sprint
   - Update performance benchmarks if runtime characteristics changed
   - Add new test fixtures for any new security rules or mission templates
   - Archive old telemetry events from `cmos/telemetry/events/`

**Security Posture**:
- Ensure prepared statements for all DB access
- Apply rate limiting guidance in runtime assets
- Leverage fixtures under `cmos/tests/security/` to confirm OWASP coverage
- Update security checklist if controls change

**Performance Monitoring**: 
- Update `cmos/tests/performance/benchmarks.json` when runtime characteristics shift
- Review benchmarks during sprint planning for degradation trends

### Documentation Governance

- **Internal vs external**: Store maintainer-only procedures in this playbook. Material intended for downstream starters belongs under `cmos/docs/` or `cmos/foundational-docs/`.
- **Cross-references**: Replace duplicated roadmap or architecture content with links to `cmos/foundational-docs/roadmap_template.md` and `cmos/foundational-docs/tech_arch_template.md`.
- **Review cadence**: Re-evaluate each document when orchestration patterns, database schema, or telemetry targets change. Use the checklist in `cmos/README.md`.
- **Knowledge capture**: Record new operational patterns or deviations within `cmos/MASTER_CONTEXT.json` and update this guide when behavior changes persist.

### Escalation & Fallback

- **Tier 1**: Automatic retry on `worker_timeout`, `evaluation_call_failure`, or `network_errors` (one retry per worker/iteration)
- **Tier 2**: Pattern-specific thresholds (RSIP max iterations, Delegation two failed workers, Boomerang two failed step attempts or checkpoint write failure)
- **Tier 3**: Fallback gracefully to linear execution and emit `status=fallback`, `fallbackTriggered=true` in telemetry
- **Tier 4**: Require human review before closing missions that triggered fallback; document remediation steps in mission notes
- **Blocked missions**: Set backlog status to `Blocked`, append a `needs` array in `SESSIONS.jsonl`, and document unblock criteria in mission notes
- **Knowledge capture**: For recurring incidents, add a `decisions_made` entry to `MASTER_CONTEXT.json` and update relevant workflow sections

---

## Quick Reference

### Commands

| Purpose | Command |
| --- | --- |
| Seed database | `python cmos/scripts/seed_sqlite.py` |
| Migrate YAML missions | `python cmos/scripts/migrate_sprint_yaml_to_db.py --sprint N` |
| Check DB health | `./cmos/cli.py db show current` |
| Integration suite | `node cmos/context/integration_test_runner.js` |
| Guardrail refs | `./cmos/cli.py validate docs` |
| Show backlog | `./cmos/cli.py db show backlog` |
| Mission status | `./cmos/cli.py mission status` |
| Add backlog mission | `./cmos/cli.py mission add <id> "<name>" --sprint "<sprint>"` |
| Update mission | `./cmos/cli.py mission update <id> --status "<status>" [--notes ...]` |
| Add dependency | `./cmos/cli.py mission depends <from> <to> --type "<label>"` |
| Start mission | `./cmos/cli.py mission start <id> --summary "<session>"` |
| Complete mission | `./cmos/cli.py mission complete <id> --summary "<session>" --notes "<notes>"` |
| Export research report | `./cmos/cli.py research export <id>` |
| Snapshot context | `./cmos/cli.py context snapshot master --source "<milestone>"` |
| View context history | `./cmos/cli.py context history master` |
| List strategic decisions | `./cmos/cli.py decisions list [--limit N] [--domain]` |
| Search decisions | `./cmos/cli.py decisions search "<keyword>"` |
| Start session | `./cmos/cli.py session start --type <type> --title "<title>"` |
| Capture insight | `./cmos/cli.py session capture <category> "<content>"` |
| Complete session | `./cmos/cli.py session complete --summary "<summary>"` |
| Onboard agent | `./cmos/cli.py session onboard` |
| List sessions | `./cmos/cli.py session list [--limit N] [--type <type>]` |
| Search sessions | `./cmos/cli.py session search "<query>"` |
| Package starter | `./cmos/scripts/package_starter.sh` |
| Reset starter | `./cmos/scripts/reset_starter.sh` |

### Validation Checklist

- [ ] Mission events logged to database (`session_events` table)
- [ ] Mission status updated in database
- [ ] Required test suites executed based on changes made (see Test Suite Matrix)
- [ ] Test results documented in mission notes
- [ ] Telemetry updated or explicitly noted as unchanged
- [ ] Mission notes capture orchestration mode and follow-up actions

---

## AI Agent Specific Instructions

### Pre-Flight Requirements
1. Load `cmos/agents.md` before starting any mission
2. Review the backlog entry for the candidate mission
3. Confirm database health via `./cmos/cli.py validate health`

### Operational Constraints
- **Status precedence**: Query missions in the order `In Progress → Current → Queued`
- **Sensitive data handling**: Use provided repositories/env vars instead of embedding credentials
- **Session consistency**: Keep `PROJECT_CONTEXT.json`, SQLite `contexts` table, and `SESSIONS.jsonl` synchronized
- **Scope boundaries**: Keep operations limited to the active mission; split backlogs if work scope grows

### Output Requirements
- Document all decisions in mission notes or `MASTER_CONTEXT.json`
- Include clear `next_hint` guidance in completion events
- Record orchestration mode selection and rationale
- Flag any fallbacks or escalations for human review

---

## Human Operator Procedures

### Session Management
- Monitor `cmos/telemetry/events/database-health.jsonl` for anomalies
- Review session events for patterns or recurring issues
- Update `cmos/MASTER_CONTEXT.json` with operational insights
- Keep working memory synchronized across context stores

### Maintenance Operations
- **Database refresh**: Run `python cmos/scripts/seed_sqlite.py` when importing external data or schema changes
- **YAML migration**: When agents write mission specs to YAML files instead of DB, run `python cmos/scripts/migrate_sprint_yaml_to_db.py --sprint N --dry-run` to preview and then apply migration
- **Database health**: Check `./cmos/cli.py db show current` and review telemetry logs
- **Export contexts**: Generate file snapshots when needed: `./cmos/cli.py db export contexts`
- **Export backlog**: Generate minimal backlog view: `./cmos/cli.py db export backlog`
- **Telemetry cleanup**: Archive old events from `cmos/telemetry/events/` periodically
- **Performance review**: Check `cmos/tests/performance/benchmarks.json` for degradation trends
- **Packaging**: Create distribution with `./cmos/scripts/package_starter.sh` (outputs to `cmos/dist/`)
- **Reset for distribution**: Use `./cmos/scripts/reset_starter.sh` to clear runtime data before packaging

### Incident Response
- For blocked missions: Document unblock criteria and required actions in database
- For fallback scenarios: Review telemetry, document root cause, update patterns if needed
- For database errors: Check telemetry logs, verify schema integrity, re-seed if corrupted
- For security violations: Immediate rollback, audit log review, guardrail reinforcement

---

## Reference Links

- **Core guidance**: `cmos/agents.md`, `cmos/README.md`
- **Roadmap template**: `cmos/foundational-docs/roadmap_template.md`
- **Technical architecture**: `cmos/foundational-docs/tech_arch_template.md`
- **Build session prompt**: `cmos/docs/build-session-prompt.md`
- **SQLite schema**: `cmos/docs/sqlite-schema-reference.md`
- **Migration guide**: `cmos/docs/legacy-migration-guide.md`
- **Test assets**: `cmos/tests/` (integration, security, quality, performance, backward compatibility)

---

**Last Updated**: 2025-11-08  
**Replaces**: `AI-coding-assistant-workflows.md`, `cmos_Playbook.md`, `packaging-guide.md`, `integration-testing-guide.md`
