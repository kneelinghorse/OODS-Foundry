# CMOS User Manual

**Complete guide**: From installation → first sprint → ongoing operations.

---

## Table of Contents

1. [Overview & Philosophy](#overview--philosophy)
2. [Phase 0: Installation](#phase-0-installation)
3. [Phase 1: Foundation](#phase-1-foundation)
4. [Phase 2: Sprint Planning](#phase-2-sprint-planning)
5. [Phase 3: Build Execution](#phase-3-build-execution)
6. [Session Management](#session-management)
7. [Phase 4: Sprint Closure](#phase-4-sprint-closure)
8. [Ongoing Operations](#ongoing-operations)

---

## Overview & Philosophy

### What is CMOS?

CMOS is a **mission-based project management system** designed for AI-assisted development. Instead of traditional time-based planning, you organize work into:

- **Missions**: Discrete pieces of work (completable in 1-3 sessions)
- **Sprints**: Groups of related missions (deliver meaningful milestones)
- **Sessions**: AI agent working periods (tracked and logged)

### Core Principles

1. **Database First**: SQLite stores complete history; files show current work
2. **Mission Driven**: Break work into clear, completable missions
3. **Context Rich**: Maintain rich context (decisions, constraints, learnings)
4. **Validated**: Guardrails ensure code and management stay in sync
5. **Separated**: Project management (cmos/) and application code (project root) never mix

### Why CMOS?

- 📊 **Scalability**: Handle 20+ sprints without YAML bloat
- 🎯 **Clarity**: Always know what to work on next
- 🔄 **History**: Complete project history queryable anytime
- ✅ **Validation**: Guardrails prevent drift between tracking and reality
- 🤖 **AI-Optimized**: Designed for agent-driven development

---

## Phase 0: Installation

### Install CMOS

**Option A: Extract starter archive**
```bash
cd yourproject
tar -xzf cmos-starter-TIMESTAMP.tar.gz
mv cmos-starter/ cmos/
```

**Option B: Copy from existing project**
```bash
cp -r /path/to/reference/cmos yourproject/cmos
```

### Install Dependencies

```bash
# From project root
cd yourproject

# Python (required)
pip install PyYAML

# Node.js (optional, for testing)
cd cmos && npm install && cd ..
```

### Initialize Database

```bash
# From project root
python cmos/scripts/seed_sqlite.py
```

Creates empty `cmos/db/cmos.sqlite` ready for your first mission.

### Configure Git

Add to `.gitignore`:
```gitignore
# CMOS Runtime Data
cmos/db/cmos.sqlite
cmos/SESSIONS.jsonl
cmos/dist/
cmos/telemetry/events/*.jsonl
cmos/runtime/boomerang/
cmos/**/__pycache__/
```

**Verify**:
```bash
./cmos/cli.py db show current
# Should show: "Active mission not set"
```

✅ **Installation complete!**

---

## Phase 1: Foundation

**Goal**: Create the core documents that guide all development.

**Time Investment**: 2-4 hours (or 1-2 AI sessions)

### Step 1: Create Project agents.md

```bash
# Copy template to project root
cp cmos/templates/agents.md ./agents.md

# Edit with your project details
[editor] agents.md
```

**Customize**:
- Project name, type, tech stack
- Your actual build commands
- Your coding standards
- Your testing requirements
- Your security rules

**See**: `cmos/docs/agents-md-guide.md` for detailed guidance.

### Step 2: Create Foundational Documents

```bash
# Copy templates
mkdir -p docs
cp cmos/foundational-docs/roadmap_template.md docs/roadmap.md
cp cmos/foundational-docs/tech_arch_template.md docs/technical_architecture.md

# Customize both
[editor] docs/roadmap.md
[editor] docs/technical_architecture.md
```

**roadmap.md should include**:
- Project vision and goals
- Sprint breakdown (Sprint 1, Sprint 2, etc.)
- Success metrics
- Key milestones

**technical_architecture.md should include**:
- System design and components
- Tech stack with rationale
- Data models and API design
- Infrastructure and deployment
- Security and performance considerations

**Focus on Sprint 1**: Be detailed for first sprint, high-level for later sprints.

### Step 3: Create PROJECT_CONTEXT.json

Update `cmos/PROJECT_CONTEXT.json` with your project basics:

```json
{
  "project": {
    "name": "Your Project Name",
    "version": "0.1.0",
    "description": "Brief description"
  },
  "working_memory": {
    "active_mission": null,
    "session_count": 0
  },
  "technical_context": {
    "dependencies": [
      "Python 3.11+",
      "PostgreSQL 15+"
    ],
    "tooling": {
      "seed_database": "python cmos/scripts/seed_sqlite.py",
      "validate_health": "./cmos/cli.py validate health"
    }
  }
}
```

### Phase 1 Completion Checklist

- [ ] `agents.md` created at project root with YOUR project details
- [ ] `docs/roadmap.md` completed with sprint plan
- [ ] `docs/technical_architecture.md` completed with system design
- [ ] `cmos/PROJECT_CONTEXT.json` updated with project info
- [ ] Sprint 1 is clearly defined with specific deliverables

✅ **Ready for Phase 2: Sprint Planning**

---

## Phase 2: Sprint Planning

**Goal**: Transform Sprint 1 plan into executable missions.

**Time Investment**: 1-2 hours (or 1 AI planning session)

### Step 1: Determine Mission Types

For Sprint 1, decide what work is needed:

**Research missions** (if needed):
- Investigate technologies
- Evaluate options
- Prototype approaches
- Document findings

**Build missions**:
- Implement features
- Write tests
- Integrate components
- Deploy infrastructure

### Step 2: Create Backlog

**Option A: Manual creation**

Edit `cmos/missions/backlog.yaml`:

```yaml
---
name: Planning.SprintPlan.v1
version: 0.0.0
displayName: [Your Project] Backlog
author: [Your Name]
---
domainFields:
  type: Planning.SprintPlan.v1
  sprints:
    - sprintId: "Sprint 01"
      title: "Foundation Build"
      focus: "Core infrastructure and initial features"
      status: "In Progress"
      missions:
        - id: "B1.1"
          name: "Project Bootstrap"
          status: "Queued"
        - id: "B1.2"
          name: "Database Schema"
          status: "Queued"
        - id: "B1.3"
          name: "Core API Endpoints"
          status: "Queued"
  
  missionDependencies:
    - from: "B1.1"
      to: "B1.2"
      type: "Blocks"
  
  promptMapping:
    prompts: []
```

**Option B: AI-assisted creation (CLI recommended)**

In a planning session with AI:
```
Review docs/roadmap.md and docs/technical_architecture.md.
Break Sprint 1 into 5-8 concrete missions.
Log each mission with the CLI (no manual YAML editing required).
```

Example CLI flow:

```bash
# Add missions as they are defined
./cmos/cli.py mission add B1.1 "Project Bootstrap" --sprint "Sprint 01" --description "Repo + pipeline"
./cmos/cli.py mission add B1.2 "Database Schema" --sprint "Sprint 01" --success "Tables defined"

# Capture ordering and adjustments mid-session
./cmos/cli.py mission update B1.2 --status "Current" --notes "Waiting on schema review"
./cmos/cli.py mission depends B1.1 B1.2 --type "Blocks"
```

The CLI writes directly to SQLite and automatically regenerates `cmos/missions/backlog.yaml`, keeping both views aligned.

### Step 3: Seed Database

```bash
# Import backlog into database
python cmos/scripts/seed_sqlite.py

# Verify
./cmos/cli.py db show backlog
```

### Step 4: Create Mission Templates (Optional)

If you have detailed requirements, create mission YAML files:

```bash
mkdir -p cmos/missions/sprint-01
```

Copy from `cmos/missions/templates/` and customize for your missions.

### Phase 2 Completion Checklist

- [ ] Sprint 1 missions defined via CLI (auto-synced to `cmos/missions/backlog.yaml`)
- [ ] Mission dependencies mapped
- [ ] Database seeded: `python cmos/scripts/seed_sqlite.py`
- [ ] Backlog verified: `./cmos/cli.py db show backlog`
- [ ] First mission is ready to start

✅ **Ready for Phase 3: Build Execution**

---

## Phase 3: Build Execution

**Goal**: Execute missions in build sessions until sprint completes.

**Pattern**: Run 3-10 missions per session, validate after each.

### Starting a Build Session

**From project root**, use the build session prompt:

```bash
# See full prompt in cmos/docs/build-session-prompt.md
```

**Minimal prompt**:
```
CMOS build session from project root.

Use mission runtime helpers from cmos/context/mission_runtime.py (`next_mission`, `start`, `complete`, `block`).
Loop through missions:
1. Fetch next: `next_mission()`
2. Start: `start(id, agent=..., summary=...)`
3. Execute: Implement fully, test thoroughly
4. Complete: `complete(id, agent=..., summary=..., notes=...)`
5. Validate: ./cmos/cli.py validate health

Database: cmos/db/cmos.sqlite
```

### Build Session Flow

```
You: [Paste build session prompt]

Agent: Loaded. Next mission: B1.1 - Project Bootstrap. Ready?

You: Go

Agent: [Implements B1.1, tests, completes]
      Next mission: B1.2 - Database Schema. Ready?

You: Yes

Agent: [Implements B1.2, tests, completes]
      Next mission: B1.3 - Core API. Ready?

You: Pause, let me review B1.2

Agent: [Stops, shows what was done]
```

### Verification Checkpoints

**After each mission**:
```bash
./cmos/cli.py db show current
```

**If mission not showing as expected**: Check telemetry logs, verify database integrity.

### Handling Blockers

If mission gets blocked:
```python
runtime.block_mission(
    mission_id="B1.3",
    agent="assistant",
    summary="Blocked on API design",
    reason="Need to decide between REST and GraphQL",
    needs=["Architecture decision", "Review docs/technical_architecture.md"]
)
```

**Then**: Resolve blocker before promoting next mission.

### Session End

```bash
# Check what's active
./cmos/cli.py db show current

# View progress
./cmos/cli.py db show backlog

# Export working backlog if needed
./cmos/cli.py db export backlog --output cmos/missions/backlog.yaml
```

### Research Mission Exports

Immediately after completing a research-focused mission, turn the findings into a durable artifact:

```bash
./cmos/cli.py research export <mission-id>
```

The command writes `cmos/research/<mission-id>.md`. Review the generated Markdown, commit it, and keep the mission's operational history in SQLite.

### Phase 3 Tips

- **Stay focused**: Complete one mission fully before moving to next
- **Test thoroughly**: Don't mark complete unless tests pass
- **Document as you go**: Update notes, contexts, decisions
- **Validate frequently**: Catch drift early
- **Pause intelligently**: Stop at natural breakpoints

---

## Session Management

Build missions aren't the only work you run inside CMOS. Planning, onboarding, and review sessions keep context healthy between builds and write directly to the SQLite timeline.

### Session Types

- **onboarding** – bring a new agent up to speed on a feature or sprint
- **planning** – roadmap, sprint, or architecture planning conversations
- **review** – retrospectives, weekly check-ins, or post-mission evaluations
- **research** – exploratory investigations, spikes, benchmarking
- **check-in** – quick syncs to capture current progress and blockers
- **custom** – any structured collaboration that doesn't fit the above

Need deeper walkthroughs? See `docs/session-management-guide.md` for worked examples and templates.

### When to Use Sessions vs Missions

- Use **sessions** for non-build work where the output is context: onboarding, planning, reviews, or research summaries.
- Use **missions** for build or documentation work that changes the repository and should follow the mission lifecycle.
- It's common to start a planning session before a series of missions, or to capture learnings in a review session after completing them.

### Basic Session Workflow

1. **Start**: `./cmos/cli.py session start --type planning --title "Sprint 17 planning"`
2. **Capture**: `./cmos/cli.py session capture decision "Prioritize API latency"`
3. **Complete**: `./cmos/cli.py session complete --summary "Sprint aligned; next focus on latency" --next-steps "Profile gateway"`

All session captures stay in the active session until completion, when `session_runtime` automatically updates `project_context`, `master_context`, and strategic decisions.

### Common Patterns

- **Sprint planning**: Start a planning session, capture decisions/constraints, then complete with next steps that seed the next missions.
- **Agent onboarding**: Run `./cmos/cli.py session onboard` for a snapshot, start an onboarding session, capture context and decisions, then complete with actionable next steps.
- **Weekly review**: Start a review session, capture learnings/constraints, and complete with a concise summary that feeds the master context.
- **Research spike**: Use a research session to capture findings before creating a follow-up mission.

Keep session notes concise and actionable—agents should be able to follow the transcript later without guessing what happened.

---

## Phase 4: Sprint Closure

**Goal**: Clean up completed sprint and prepare for next.

### Step 1: Review Sprint Results

```bash
# View completed missions
./cmos/cli.py db show backlog

# Check current state
./cmos/cli.py db show current
```

**Questions to answer**:
- All missions completed?
- All success criteria met?
- Any blockers or debt to carry forward?
- What did we learn?

### Step 2: Update Context History

Document sprint outcomes in `cmos/context/MASTER_CONTEXT.json`:

```python
from context.db_client import SQLiteClient

client = SQLiteClient("cmos/db/cmos.sqlite")
master = client.get_context("master_context") or {}

# Add decisions made
master.setdefault("decisions_made", []).append(
    "Sprint 1: Chose PostgreSQL for ACID compliance"
)

# Add constraints discovered
master.setdefault("constraints", []).append(
    "API response time must be <100ms for search queries"
)

# Save
client.set_context("master_context", master, source_path="context/MASTER_CONTEXT.json")
client.close()
```

### Step 3: Clean Up Backlog

Remove completed sprint from `cmos/missions/backlog.yaml`:

```bash
# Option A: Export fresh from DB (if Sprint 2 is already there)
./cmos/cli.py db export backlog --output cmos/missions/backlog.yaml

# Then manually edit to keep only current/upcoming sprints

# Option B: Manually remove Sprint 1 section from backlog.yaml
[editor] cmos/missions/backlog.yaml
# Delete Sprint 1 missions - they're in the DB!

**Note**: If you relied solely on `./cmos/cli.py mission add|update|depends`, the CLI already re-exported `backlog.yaml`. Use the manual steps above only when you need to edit the file directly.
```

**Result**: Backlog stays readable, history preserved in DB.

### Step 4: Plan Next Sprint

Either:
- Add Sprint 2 missions to backlog.yaml manually
- Run planning session with AI to create Sprint 2

Then seed database:
```bash
python cmos/scripts/seed_sqlite.py
./cmos/cli.py db show backlog  # Verify import
```

### Phase 4 Completion

- [ ] Sprint reviewed and documented
- [ ] Learnings captured in MASTER_CONTEXT
- [ ] Completed sprint removed from backlog.yaml (still in DB!)
- [ ] Next sprint planned and added
- [ ] Database reseeded and validated

✅ **Ready to start next sprint!**

---

## Ongoing Operations

### Daily Workflow

**Starting a build session**:
1. Load: `cmos/docs/build-session-prompt.md`
2. Execute: Run missions in loop
3. Validate: After each mission
4. Close: Validate final state

**Between sessions**:
1. Review: Check `./cmos/cli.py db show current`
2. Plan: Adjust mission order if needed
3. Document: Update contexts with new learnings

### Weekly Workflow

**Sprint planning**:
1. Review: Previous sprint results
2. Plan: Next sprint missions
3. Update: backlog.yaml with new sprint
4. Seed: `python cmos/scripts/seed_sqlite.py`

**Maintenance**:
1. Archive: Old telemetry events
2. Review: Performance benchmarks
3. Update: Documentation as project evolves

### Monthly Workflow

**History cleanup**:
1. Review: Database size and performance
2. Clean: Old telemetry and temp files
3. Archive: Completed sprint artifacts (optional)

**Documentation review**:
1. Update: roadmap.md with progress
2. Update: technical_architecture.md with changes
3. Update: agents.md with new standards

---

## Command Reference

### Mission Operations
```bash
# View missions
./cmos/cli.py db show current
./cmos/cli.py db show backlog

# Mission lifecycle (via Python API)
from context.mission_runtime import next_mission, start, complete, block

next_mission()
start(id, agent=..., summary=...)
complete(id, agent=..., summary=..., notes=...)
block(id, agent=..., summary=..., reason=..., needs=[...])
```

### Database Operations
```bash
# Seed from backlog
python cmos/scripts/seed_sqlite.py

# Seed from external source
python cmos/scripts/seed_sqlite.py --data-root /path/to/source

# Export backlog from DB
./cmos/cli.py db export backlog

# Export contexts
./cmos/cli.py db export contexts
```

### Validation
```bash
# Check database health
./cmos/cli.py db show current

# Validate documentation links
./cmos/cli.py validate docs

# Run integration tests
node cmos/context/integration_test_runner.js
```

### Packaging & Distribution
```bash
# Create starter archive
./cmos/scripts/package_starter.sh

# Reset to clean state
./cmos/scripts/reset_starter.sh
```

---

## Working with AI Agents

### Session Setup

**Always start with**:
1. Share location: "We're at project root"
2. Load contexts: Agent reads both agents.md files
3. Set scope: "Building missions from Sprint 1" or "Planning Sprint 2"

### Mission Execution Loop

**Efficient pattern**:
```
You: [Paste build-session-prompt.md]

Agent: [Loads system, fetches first mission]

You: Go [or just "Yes" or "Continue"]

Agent: [Implements → Tests → Completes → Fetches next]

[Repeat until pause or sprint complete]
```

### Staying in Flow

**DO**:
- ✅ Let agent loop through missions
- ✅ Trust the runtime for promotion
- ✅ Pause at natural breaks
- ✅ Validate after each mission

**DON'T**:
- ❌ Re-explain the system every mission
- ❌ Micromanage each step
- ❌ Skip validation
- ❌ Let drift accumulate

---

## Troubleshooting

### "Cannot find cmos/ directory"
**Fix**: Run from project root, not from inside cmos/

### "Database query failed"
**Fix**: Check telemetry logs, verify database exists and is readable

### "No missions with status Queued/Current"
**Fix**: All missions completed or blocked. Check `show-backlog`.

### "Database does not exist"
**Fix**: Run `python cmos/scripts/seed_sqlite.py`

### "Application code ended up in cmos/"
**Fix**: Move it to proper location (`src/`, `app/`, etc.). Update agents.md to be more explicit about boundaries.

---

## Advanced Topics

### Migrating from Legacy CMOS
See: `cmos/docs/legacy-migration-guide.md`

### Multi-Domain Projects
Create domain-specific agents.md files in subdirectories.

### Custom Orchestration Patterns
Configure RSIP, delegation, or boomerang patterns in mission templates.

### Custom Workflows
Extend mission_runtime.py or create custom scripts in `cmos/scripts/`.

---

## Philosophy Deep Dive

### Why Separate cmos/ from Application Code?

**Clarity**: Always know if you're building features or managing work.

**Portability**: CMOS can be extracted and reused across projects.

**Safety**: Prevents accidentally committing personal session logs or runtime data.

**Scalability**: DB holds unlimited history; code repo stays focused.

### Why Minimal backlog.yaml?

**Readability**: 20 sprints in one YAML file is unreadable.

**Performance**: Smaller files load faster, easier to diff.

**Focus**: Only see current/upcoming work, not ancient history.

**Trust the DB**: Complete history available anytime via queries.

### Why Two agents.md Files?

**Context switching**: When building features, focus on code. When managing missions, focus on process.

**Clarity**: No confusion about which guidance applies.

**Maintainability**: Update application guidance without touching CMOS operations.

---

## Quick Start Checklist (All Phases)

### Installation
- [ ] CMOS extracted to `cmos/` directory
- [ ] Dependencies installed (PyYAML)
- [ ] Database initialized: `python cmos/scripts/seed_sqlite.py`
- [ ] .gitignore configured

### Foundation
- [ ] `agents.md` created at project root
- [ ] `docs/roadmap.md` completed
- [ ] `docs/technical_architecture.md` completed
- [ ] `cmos/PROJECT_CONTEXT.json` updated

### Sprint Planning
- [ ] Sprint 1 missions defined in `cmos/missions/backlog.yaml`
- [ ] Dependencies mapped
- [ ] Database seeded
- [ ] Backlog validated

### Build Execution
- [ ] First mission started
- [ ] Code written in project root (NOT cmos/)
- [ ] Tests written and passing
- [ ] Mission completed
- [ ] Parity validated

### Sprint Closure
- [ ] All missions complete
- [ ] Learnings documented in MASTER_CONTEXT
- [ ] Completed sprint removed from backlog.yaml
- [ ] Next sprint planned

---

## Getting Help

- **Setup**: `cmos/docs/getting-started.md`
- **Operations**: `cmos/docs/operations-guide.md`
- **Build sessions**: `cmos/docs/build-session-prompt.md`
- **agents.md**: `cmos/docs/agents-md-guide.md`
- **Migration**: `cmos/docs/legacy-migration-guide.md`
- **Database**: `cmos/docs/sqlite-schema-reference.md`

---

**Last Updated**: 2025-11-08  
**Replaces**: Old CMOS_Playbook_Phases_1-3  
**Status**: Complete user manual from install → ongoing operations
