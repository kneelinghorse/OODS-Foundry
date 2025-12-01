# CMOS Operations - AI Agent Configuration

**Purpose**: Instructions for AI agents working with CMOS project management system.

**Scope**: This file covers CMOS operations ONLY (missions, contexts, database). For application code guidance, see `project-root/agents.md`.

---

## Critical Boundary

**CMOS is project management, NOT application code**.

✅ **CMOS manages**: Missions, sprints, contexts, sessions, backlog  
❌ **CMOS does NOT contain**: Application code, application tests, deployment configs

**When working with CMOS**:
- Read/write to: `cmos/missions/`, `cmos/db/`, `cmos/contexts/`
- Never write to: `src/`, `app/`, `tests/` (that's application code)
- Use: `cmos/scripts/` for operations
- Reference: `cmos/docs/` for procedures

---

## Data Storage & Telemetry

### SQLite as Source of Truth
- **Database**: `cmos/db/cmos.sqlite` is the single source of truth for all missions, contexts, and sessions
- **Export on-demand**: Generate file views when needed via `./cmos/cli.py db export [backlog|contexts]`
- **Health checks**: Use `./cmos/cli.py db show current` to verify database state

### Database Operations
- Use `context/mission_runtime.py` helpers (`next_mission`, `start`, `complete`, `block`) for mission operations. The MissionRuntime class remains available for advanced workflows.
- Use `context/db_client.py` SQLiteClient for context operations
- Never write raw SQL in prompts or mission code
- Database is authoritative - no file mirrors to maintain

### Key Commands

**Database Operations**:
```bash
# Seed database from backlog
python cmos/scripts/seed_sqlite.py --data-root <path>

# View mission status
./cmos/cli.py db show current

# View full backlog
./cmos/cli.py db show backlog

# Export backlog from DB
./cmos/cli.py db export backlog --output cmos/missions/backlog.yaml

# Export contexts from DB
./cmos/cli.py db export contexts
```

**Mission Management (CLI)**:
```bash
# Add new mission
./cmos/cli.py mission add <mission-id> "<name>" --sprint "<sprint-id>" --description "<desc>"

# Update mission status
./cmos/cli.py mission update <mission-id> --status <status> --notes "<notes>"

# Add dependency
./cmos/cli.py mission depends <from-mission> <to-mission> --type "Blocks"

# Export research mission findings
./cmos/cli.py research export <mission-id>
```

The CLI automatically:
- Writes directly to SQLite
- Re-exports `backlog.yaml` to keep it in sync
- Maintains database integrity

---

## Mission Lifecycle

### Reading Mission Details

**CRITICAL**: Mission database records contain summary information only. For complete implementation guidance, **ALWAYS read the mission YAML file** specified in the mission's `notes` field or `metadata.yaml_file`.

**Example workflow**:
```python
from context.mission_runtime import next_mission

# 1. Fetch next mission from database
mission = next_mission()
print(f"Mission: {mission['id']} - {mission['name']}")
print(f"Notes: {mission.get('notes', 'No notes')}")

# 2. Extract YAML file path from notes or metadata
# The notes field will contain: "📋 FULL MISSION DETAILS: Read cmos/missions/B28.1-authable-trait-enriched.yaml..."

# 3. READ THE YAML FILE for comprehensive details
# The YAML file contains:
#   - Research findings with explicit citations
#   - Concrete deliverables list (10-20+ specific files)
#   - Scaffolding reuse maps
#   - Quality gates and success criteria
#   - SQL/code examples
#   - Performance targets
```

**Mission YAML files provide**:

- **Research Findings**: Explicit citations (e.g., "R21.2 Part 4.2 TABLE 4")
- **Deliverables**: Concrete file list with requirements for each file
- **Scaffolding Reuse**: Maps showing how to adapt patterns from previous sprints
- **Quality Gates**: Progressive validation steps (during development & before completion)
- **Examples**: SQL DDL, code patterns, integration examples
- **Success Criteria**: Measurable validation methods

**Database vs YAML**:

- **Database** (via `next_mission()`): Summary, status, basic metadata (100-200 chars)
- **YAML file** (e.g., `B28.1-authable-trait-enriched.yaml`): Full implementation guide (100-550 lines)

**Always read the YAML file before starting implementation!**

### Mission Status Flow
`Queued` → `Current` → `In Progress` → `Completed` (or `Blocked`)

### Selection Priority
1. First mission with status `In Progress`
2. Otherwise, first mission with status `Current`
3. Otherwise, first mission with status `Queued` (auto-promote to `In Progress`)

### Mission Operations

**Using mission runtime helpers**:
```python
from context.mission_runtime import next_mission, start, complete, block

# Fetch next mission
candidate = next_mission()

# Start mission
start(
    mission_id="B3.1",
    agent="assistant",
    summary="Starting database work"
)

# Complete mission
complete(
    mission_id="B3.1",
    agent="assistant",
    summary="Database schema implemented",
    notes="Created schema.sql with all tables. Tests passing."
)

# Block mission if needed
block(
    mission_id="B3.1",
    agent="assistant",
    summary="Blocked on decision",
    reason="Waiting for schema approval",
    needs=["Review from architect"]
)
```

---

## Context Management

### Two Contexts

**PROJECT_CONTEXT.json**: Current session state
- Active mission
- Session count
- Working memory (temporary)
- Context health metrics

**context/MASTER_CONTEXT.json**: Project history
- Project identity
- Technical foundation
- Decisions made (permanent record)
- Constraints
- Quality standards

### Operations

**Reading contexts**:
```python
from context.db_client import SQLiteClient

client = SQLiteClient("cmos/db/cmos.sqlite", create_missing=False)

project = client.get_context("project_context") or {}
master = client.get_context("master_context") or {}

client.close()
```

**Updating contexts**:
```python
# Update and save
master["decisions_made"].append("Chose PostgreSQL for ACID compliance")
client.set_context(
    "master_context",
    master,
    source_path="context/MASTER_CONTEXT.json"
)
```

**When to update**:
- PROJECT_CONTEXT: Session start/end, mission transitions
- MASTER_CONTEXT: Major decisions, architecture changes, constraints

---

## Session Logging

**SESSIONS.jsonl**: Append-only chronological log

**Format**:
```json
{
  "ts": "2025-11-08T12:34:56Z",
  "agent": "assistant",
  "mission": "B3.1",
  "action": "start",
  "status": "in_progress",
  "summary": "Starting database schema work"
}
```

**Mission runtime helpers handle this automatically** - don't write directly to SESSIONS.jsonl.

---

## Backlog Management

### DB-First History Pattern

**Database**: Complete history (all sprints, unlimited)  
**backlog.yaml**: Current work view (3-5 sprints max)

**Workflow**:
1. All missions live in SQLite `missions` table
2. Export minimal backlog for readability: `./cmos/cli.py db export backlog`
3. Edit backlog.yaml to keep only current/recent sprints
4. Validate database health to ensure sync
5. Old sprints stay in DB, queryable anytime

**Querying history**:
```bash
# View all sprints (including old ones)
./cmos/cli.py db show backlog

# Query specific sprint
sqlite3 cmos/db/cmos.sqlite "SELECT * FROM missions WHERE sprint_id = 'Sprint 05'"
```

---

## Validation & Guardrails

### Mandatory Checkpoints

**After each mission**:
```bash
./cmos/cli.py db show current
```

**Before session end**:
```bash
./cmos/cli.py db show current
./cmos/cli.py db show backlog
```

**After documentation updates**:
```bash
./cmos/cli.py validate docs
```

### Test Requirements for CMOS Changes

If modifying CMOS system itself:
- Run: `node cmos/context/integration_test_runner.js`
- Security fixtures: `cmos/tests/security/`
- Quality fixtures: `cmos/tests/quality/`

**Note**: These are tests FOR CMOS, not for your application!

---

## Advanced Orchestration Patterns

### Pattern Selection
Choose ONE pattern per mission:
- `none` - Linear execution
- `rsip` - Refinement loops
- `delegation` - Worker distribution
- `boomerang` - Checkpointed execution

### Configuration
- Patterns configured in mission templates (`cmos/missions/templates/*.yaml`)
- Worker manifest: `cmos/workers/manifest.yaml`
- Runtime state: `cmos/runtime/boomerang/`
- Telemetry: `cmos/telemetry/events/`

### Failure Escalation
- **Tier 1**: Automatic retry
- **Tier 2**: Pattern-specific limits
- **Tier 3**: Fallback to linear
- **Tier 4**: Human review required

---

## Runtime Directories

**Do not write application code to these directories**:

| Directory | Purpose | When to Touch |
|-----------|---------|---------------|
| `cmos/runtime/boomerang/` | Checkpoint storage | Automatic (orchestration pattern) |
| `cmos/telemetry/events/` | Runtime metrics | Automatic (mission runtime) |
| `cmos/db/` | SQLite database | Via scripts only |
| `cmos/dist/` | Distribution archives | Via package_starter.sh |

---

## Environment Variables

```bash
# Development
NODE_ENV=development
DEBUG=true
DB_PATH=cmos/db/cmos.sqlite

# Production (if packaging)
NODE_ENV=production
DEBUG=false
```

---

## Documentation References

**For CMOS usage**:
- Setup: `cmos/docs/getting-started.md`
- Operations: `cmos/docs/operations-guide.md`
- Build sessions: `cmos/docs/build-session-prompt.md`
- Migration: `cmos/docs/legacy-migration-guide.md`
- Schema: `cmos/docs/sqlite-schema-reference.md`

**For YOUR project**:
- Application guidance: `project-root/agents.md` (you create this)
- Project roadmap: start from `cmos/foundational-docs/roadmap_template.md` and copy it into your docs workspace
- Technical architecture: start from `cmos/foundational-docs/tech_arch_template.md` and copy it into your docs workspace

---

## Key Principles for AI Agents

1. **Read both agents.md files** at session start:
   - Read `project-root/agents.md` for application code rules
   - Read `cmos/agents.md` (this file) for CMOS operations

2. **Respect boundaries**:
   - Application work → Use project-root/agents.md as guide
   - Mission management → Use cmos/agents.md as guide

3. **Use provided scripts**:
   - Don't recreate functionality that exists in `cmos/scripts/`
   - Use mission runtime helpers, SQLiteClient, or `./cmos/cli.py`

4. **Verify frequently**:
   - After mission completion (check show-current)
   - After context updates (verify in database)
   - Before session end (review show-backlog)

5. **Keep separation**:
   - CMOS operations stay in cmos/
   - Application code stays in project root
   - Never mix them

---

## Version Control & Git

### Recommended .gitignore for CMOS

**Commit CMOS structure** (your project's knowledge base):
- ✅ `cmos/agents.md` - CMOS operation instructions
- ✅ `cmos/missions/` - Sprint and mission definitions
- ✅ `cmos/context/` - Project context files
- ✅ `cmos/docs/` - CMOS documentation
- ✅ `cmos/scripts/` - Migration and seed scripts
- ✅ `cmos/foundational-docs/` - Roadmap and architecture

**Ignore runtime data** (session-specific, not portable):
```gitignore
# CMOS Runtime Data
cmos/db/cmos.sqlite
cmos/SESSIONS.jsonl
cmos/dist/
cmos/telemetry/events/*.jsonl
cmos/runtime/boomerang/
cmos/**/__pycache__/
```

**Why?** CMOS structure is project infrastructure that should be versioned. Only runtime session data should be ignored.

---

**Last Updated**: 2025-11-09
**Version**: 2.0 (SQLite-first architecture)
**Scope**: CMOS operations only (not application code)
