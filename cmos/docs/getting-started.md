# Getting Started with CMOS

**Day 0 Setup**: From fresh CMOS installation to ready-to-build project.

---

## What is CMOS?

**CMOS** (Context + Mission Orchestration System) is a project management layer for AI-assisted development. It provides:

- 📊 **SQLite-backed mission tracking** - History, sprints, dependencies
- 📝 **Context management** - PROJECT_CONTEXT, MASTER_CONTEXT with snapshots
- 🎯 **Mission-based workflow** - Research → Plan → Build → Ship
- 🔄 **Session management** - Capture planning, onboarding, reviews, and build sessions
- ✅ **Validation guardrails** - Keep code and management in sync

**Critical Principle**: CMOS is **project management**, NOT your application code. Keep them separate!

---

## Installation

### Option 1: Extract Starter Archive
```bash
# Extract CMOS starter into your project
tar -xzf cmos-starter-TIMESTAMP.tar.gz
mv cmos-starter/ yourproject/cmos/
```

### Option 2: Clone from Repository
```bash
# Clone CMOS into your project
git clone <cmos-repo-url> yourproject/cmos/
```

**Result**: You now have a `cmos/` subdirectory for project management.

---

## Setup Process (5 Steps)

### Step 1: Install Dependencies

```bash
# From project root
cd yourproject

# Python dependencies (required)
pip install PyYAML

# Node scripts (optional, for testing)
# No npm install required; run Node tools directly when needed
# Example:
node cmos/context/integration_test_runner.js --help
```

**Verify**:
```bash
python --version  # Should be 3.11+
python -c "import yaml"  # Should not error
```

---

### Step 2: Initialize Database

Create the SQLite database:

```bash
# From project root
python cmos/scripts/seed_sqlite.py
```

**What this does**:
- Applies the schema to create `cmos/db/cmos.sqlite`
- Imports mirrors if present (contexts, backlog, sessions, telemetry, prompt mappings)
- Ready for your first mission

**Verify**:
```bash
ls -lh cmos/db/cmos.sqlite
# Should show newly created database file
```

---

### Step 3: Set Up Project Boundaries

Create `.gitignore` at project root to exclude CMOS runtime data:

```bash
# Add to .gitignore (or create new file)
cat >> .gitignore << 'EOF'

# CMOS Runtime Data (exclude from version control)
cmos/db/cmos.sqlite
cmos/SESSIONS.jsonl
cmos/dist/
cmos/telemetry/events/*.jsonl
cmos/runtime/boomerang/
cmos/**/__pycache__/
EOF
```

**What to version control**:
- ✅ `cmos/agents.md` - CMOS operational guidance
- ✅ `cmos/missions/backlog.yaml` - Current sprint plan (minimal)
- ✅ `cmos/PROJECT_CONTEXT.json` - Project metadata (zero out secrets)
- ✅ `cmos/scripts/` - All scripts
- ✅ `cmos/docs/` - All documentation

**What to exclude**:
- ❌ `cmos/db/cmos.sqlite` - Runtime database (regenerate from files)
- ❌ `cmos/SESSIONS.jsonl` - Session logs (personal)
- ❌ `cmos/dist/` - Build artifacts
- ❌ `cmos/telemetry/` - Runtime metrics

---

### Step 4: Create Project-Specific agents.md Files

**CRITICAL**: You need TWO separate agents.md files!

#### 4a. Create Project Root agents.md (YOUR APPLICATION)

```bash
# Copy template to project root
cp cmos/templates/agents.md ./agents.md

# Edit it with YOUR project details
nano agents.md  # or your preferred editor
```

**Customize with**:
- Your project name, tech stack, framework
- Your build commands (npm start, pytest, etc.)
- Your coding standards and style guides
- Your test requirements
- Your deployment process

**Example**:
```markdown
# AI Agent Configuration

## Project Overview
**Project Name**: TraceLab UX Research API
**Project Type**: Web API
**Primary Language**: Python
**Framework**: FastAPI + PostgreSQL + Qdrant

## Build & Development Commands
npm start  # Start dev server
pytest tests/  # Run tests
```

**This file guides agents when working on YOUR APPLICATION CODE**.

#### 4b. Review cmos/agents.md (CMOS OPERATIONS)

`cmos/agents.md` already exists for CMOS operations. It tells agents:
- How to work with missions and sprints
- How to use the database
- CMOS-specific rules

**Don't edit this for YOUR project code** - it's for CMOS management only!

**Critical Boundary**:
- 📁 **project-root/agents.md** → Instructions for `src/`, `tests/`, YOUR CODE
- 📁 **cmos/agents.md** → Instructions for missions, contexts, CMOS operations

---

### Step 5: Create Foundational Documents

Copy templates and customize for YOUR project:

```bash
# Copy templates to project root
cp cmos/foundational-docs/roadmap_template.md ./docs/roadmap.md
cp cmos/foundational-docs/tech_arch_template.md ./docs/technical_architecture.md

# Create docs directory if needed
mkdir -p docs
```

**Customize each**:

**docs/roadmap.md**:
- Your project vision and goals
- Sprint breakdown (what you'll build when)
- Success metrics and milestones

**docs/technical_architecture.md**:
- System design and components
- Tech stack decisions and rationale
- API design, data models, infrastructure
- Security and performance considerations

**These documents guide your entire build process**.

---

## Project Structure After Setup

```
yourproject/                      # Project root
├── README.md                     # About YOUR PROJECT
├── agents.md                     # AI instructions for YOUR CODE
├── .gitignore                    # Excludes CMOS runtime data
│
├── src/                          # YOUR APPLICATION CODE
├── tests/                        # YOUR APPLICATION TESTS
├── docs/
│   ├── roadmap.md                # YOUR PROJECT ROADMAP
│   └── technical_architecture.md # YOUR TECHNICAL DESIGN
│
└── cmos/                         # PROJECT MANAGEMENT (separate!)
    ├── agents.md                 # AI instructions for CMOS operations
    ├── db/cmos.sqlite            # Mission tracking database
    ├── missions/backlog.yaml     # Current sprints/missions
    ├── PROJECT_CONTEXT.json      # Project metadata
    ├── context/MASTER_CONTEXT.json  # Project history
    ├── SESSIONS.jsonl            # Session logs
    ├── research/                 # Exported research reports (Markdown)
    ├── scripts/                  # CMOS automation
    └── docs/                     # CMOS documentation
```

**Golden Rule**: 
- ✅ Write YOUR CODE in project root
- ✅ Manage YOUR WORK in cmos/
- ❌ NEVER write code in cmos/
- ❌ NEVER write missions in src/

---

## Verification Checklist

After setup, verify everything works:

```bash
# From project root

# 1. Database is accessible
./cmos/cli.py db show current
# Should show: "Active mission not set in project context."

# 2. Database health check works
./cmos/cli.py validate health
# Should show: "Database cmos/db/cmos.sqlite is reachable and passed health checks."

# 3. Check database
./cmos/cli.py db show backlog
# Should show: "No sprints defined in the database."

# 4. Both agents.md files exist
ls -la agents.md cmos/agents.md
# Both should exist
```

✅ **If all checks pass, you're ready to plan your first sprint!**

---

## Next Steps

### Phase 1: Foundation (Planning)

1. **Complete your foundational documents**:
   - Fill out `docs/roadmap.md` with your project vision
   - Fill out `docs/technical_architecture.md` with system design
   - Define Sprint 1 deliverables in both docs

2. **Create your first backlog**:
   - Use the CLI (recommended): `./cmos/cli.py mission add <id> "<name>" --sprint "Sprint 01"`
   - Update priorities with `mission update` and link work with `mission depends`
   - Prefer CLI commands because they update SQLite and regenerate `cmos/missions/backlog.yaml` automatically
   - Manual editing of `cmos/missions/backlog.yaml` still works, but remember to re-seed afterward

3. **Seed the database**:
   ```bash
   python cmos/scripts/seed_sqlite.py
   ```
   This imports your backlog into SQLite.

### Phase 2: Build Execution

1. **Start a build session** using `cmos/docs/build-session-prompt.md`
2. **Run missions in a loop** (3-10 per session is typical)
3. **Validate after each mission**
4. **Review progress** in database
5. **Capture research outputs** with `./cmos/cli.py research export <mission-id>` to write `cmos/research/<mission-id>.md`

### Phase 3: Sprint Closure

1. **Review completed missions**
2. **Update minimal backlog** (remove completed sprint from YAML)
3. **Plan next sprint**
4. **Continue cycle**

---

## Common Pitfalls

❌ **DON'T**: Write application code in `cmos/`
- cmos/ is for project management only
- Your code belongs in `src/`, `app/`, or similar

❌ **DON'T**: Create tests in `cmos/tests/`
- Those are CMOS validation tests
- Your app tests belong in project-root `tests/`

❌ **DON'T**: Put both agents.md files in same location
- Project root: YOUR CODE instructions
- cmos/: CMOS operations instructions

❌ **DON'T**: Version control the database
- Database is regenerated from backlog.yaml
- Add `cmos/db/cmos.sqlite` to .gitignore

✅ **DO**: Keep boundaries clear
✅ **DO**: Use database as history store
✅ **DO**: Keep backlog.yaml minimal (current work)
✅ **DO**: Validate database health regularly

---

## Quick Reference

| Task | Command |
|------|---------|
| Initialize database | `python cmos/scripts/seed_sqlite.py` |
| View current mission | `./cmos/cli.py db show current` |
| View all sprints | `./cmos/cli.py db show backlog` |
| Add backlog mission | `./cmos/cli.py mission add <id> "<name>" --sprint "<sprint>"` |
| Update mission status | `./cmos/cli.py mission update <id> --status "<status>"` |
| Add dependency | `./cmos/cli.py mission depends <from> <to> --type "Blocks"` |
| Export research report | `./cmos/cli.py research export <id>` |
| Snapshot MASTER_CONTEXT | `./cmos/cli.py context snapshot master --source "<milestone>"` |
| View context history | `./cmos/cli.py context history master` |
| View specific snapshot | `./cmos/cli.py context view <snapshot-id>` |
| Start session | `./cmos/cli.py session start --type <type> --title "<title>"` |
| Capture session insight | `./cmos/cli.py session capture <category> "<content>"` |
| Complete session | `./cmos/cli.py session complete --summary "<summary>"` |
| Onboard agent | `./cmos/cli.py session onboard` |
| Validate sync | `./cmos/cli.py validate health` |
| Start build session | See `cmos/docs/build-session-prompt.md` |

---

## Getting Help

- **Setup issues**: Check `cmos/docs/operations-guide.md`
- **Session management**: See `cmos/docs/session-management-guide.md`
- **Migration from legacy**: See `cmos/docs/legacy-migration-guide.md`
- **Database queries**: See `cmos/docs/sqlite-schema-reference.md`
- **Build sessions**: See `cmos/docs/build-session-prompt.md`
- **agents.md help**: See `cmos/docs/agents-md-guide.md`

---

**Last Updated**: 2025-11-08  
**Status**: Ready for use  
**Next**: Complete foundational docs, create backlog, start building!
