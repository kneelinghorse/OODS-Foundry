# CMOS Starter

CMOS (Context + Mission Orchestration System) is a lightweight starter kit for teams that want to run Mission Protocol projects with high confidence. It provides a ready-to-ship repository structure, batteries-included automation, and security guardrails so human developers and AI agents can collaborate through mission-driven workflows.

---

## What You Get

- **Mission Protocol alignment** – Build/Research mission templates, domain packs, and worker manifests wired for RSIP, delegation, and boomerang orchestration patterns.
- **Agent-ready guidance** – A comprehensive `agents.md` contract plus empty context files that teams can populate with their own history.
- **Guardrails & validation** – Security, quality, and integration harnesses (JavaScript + Python) that enforce OWASP guidance and regression testing.
- **Optional SQLite canonical store** – Schema, seed script, and health validation commands for teams that want transactional mission state in addition to file mirrors.
- **Packaging workflow** – Automation to produce distributable starter archives without leaking local tooling artefacts.

---

## Prerequisites

- **Node.js** 20.x (tooling, tests, optional automation)
- **Python** 3.11+ (SQLite utilities and validation scripts)
- **npm** (for running the provided scripts and test suites)

Optional:
- SQLite client (CLI or GUI) if you plan to inspect `cmos/db/cmos.sqlite`
- Git (recommended for version control)

---

## Quick Start

### For New Projects

**Complete setup guide**: See `cmos/docs/getting-started.md`

**Quick version**:
```bash
# 1. Install dependencies
pip install PyYAML

# 2. Initialize database
python cmos/scripts/seed_sqlite.py

# 3. Create your project agents.md
cp cmos/templates/agents.md ./agents.md
# Edit with your project details

# 4. Create foundational docs
cp cmos/foundational-docs/roadmap_template.md <docs-dir>/roadmap.md
cp cmos/foundational-docs/tech_arch_template.md <docs-dir>/technical_architecture.md
# Complete both documents

# 5. Create your first backlog
# Use the CLI to add missions (auto-syncs backlog.yaml)
./cmos/cli.py mission add B1.1 "Bootstrap runtime" --sprint "Sprint 01" --description "Set up mission database"
# or edit cmos/missions/backlog.yaml manually and seed again later

# 6. Start building!
# See cmos/docs/build-session-prompt.md
```

### For Existing Users

```bash
# View current work
./cmos/cli.py db show current

# Start a build session
# See cmos/docs/build-session-prompt.md

# Export backlog after work
./cmos/cli.py db export backlog
```

---

## Working With Mission Protocol

The starter is designed to plug directly into Mission Protocol v2 workflows.

- **Mission templates**: Use the YAML files under `cmos/missions/templates/` as starting points for Build, Research, and Planning missions. Each template includes orchestration configuration and structured prompting scaffolds.
- **Mission execution**: Use `./cmos/cli.py mission [status|start|complete|block|add|update|depends]` to manage the mission queue and backlog data. The CLI keeps `cmos/missions/backlog.yaml`, `cmos/SESSIONS.jsonl`, and the SQLite mirror in sync automatically.
- **Research exports**: After completing a research mission, run `./cmos/cli.py research export <mission-id>` to generate `cmos/research/<mission-id>.md`. Only commit the exported Markdown; the database remains the source of truth.
- **Worker delegation**: Additional workers live in `cmos/workers/`. Update `cmos/workers/manifest.yaml` to register new delegates and reference them within mission templates.
- **Advanced orchestration**: The starter ships with RSIP, delegation, and boomerang patterns wired into mission templates. Adjust `cmos/runtime/` assets to tweak checkpoints or iteration policies.

When integrating with a Mission Protocol server, point it at this repository’s root. The starter already conforms to the required directory structure and schema expectations.

### Backlog Management CLI

Use mission commands to edit backlog data without hand-editing YAML. Each command persists to SQLite first and automatically regenerates `cmos/missions/backlog.yaml` so files mirror the database.

```bash
# Add a mission with metadata
./cmos/cli.py mission add B3.8 "Document research flow" --sprint "Sprint 03" \
  --description "Capture research export workflow" \
  --success "Export command documented" --deliverable "Guide published"

# Update status and notes
./cmos/cli.py mission update B3.8 --status "Current" --notes "Ready for research delegate"

# Record dependency (Blocks by default)
./cmos/cli.py mission depends B3.3 B3.8 --type "Blocks"
```

---

## Optional SQLite Runtime

The file system remains the source of truth, but some teams prefer transactional mission storage.

- **Generate a database**  
  ```bash
  python cmos/scripts/seed_sqlite.py
  ```
  This applies `cmos/db/schema.sql`, writes an empty `cmos/db/cmos.sqlite`, and stores copies of `cmos/PROJECT_CONTEXT.json` and `cmos/context/MASTER_CONTEXT.json` in the `contexts` table.

- **Validate database health**  
  ```bash
  ./cmos/cli.py validate health
  ```
  Confirms that mission runtime can reach the SQLite database and log telemetry.

- **Environment variables**  
  ```
  NODE_ENV=development
  DEBUG=true
  DB_PATH=cmos/db/cmos.sqlite
  ```
  Adjust `DB_PATH` if you embed the starter into another deployment layout.

---

## Repository Tour

- `agents.md` – Canonical instructions for AI collaborators (read this first).
- `context/` – Master context template and validation utilities (`integration_test_runner.js`, `security_validation.js`, `quality_assurance.js`, SQLite helpers).
- `missions/` – Mission templates plus an empty `backlog.yaml` scaffold.
- `research/` – Markdown artifacts exported from completed research missions via the CLI.
- `templates/` – Mission Protocol domain packs ready for import.
- `workers/` – Worker definitions and manifest used by delegation patterns.
- `runtime/` – Assets for boomerang checkpoints and orchestration state.
- `scripts/` – Automation (`seed_sqlite.py`, legacy helpers, `package_starter.sh`, etc.).
- `telemetry/` – Event schemas and sample JSONL streams for monitoring.
- `tests/` – Guardrail fixtures for integration, security, quality, performance, and backward compatibility.
- `foundational-docs/` – Roadmap and technical architecture templates to clone into your own documentation.
- `db/` – SQLite schema and generated database artefacts.

---

## Automation & Tooling

| Script | Description |
| ------ | ----------- |
| `cmos/cli.py` | Unified CLI for mission, db, and validation commands. |
| `cmos/scripts/mission_runtime.py` | Legacy mission lifecycle helper (still available for automation). |
| `cmos/scripts/db_tools.py` | Legacy database utilities (automation helpers for exports). |
| `cmos/scripts/seed_sqlite.py` | Imports backlog and contexts into `cmos/db/cmos.sqlite` from external sources. |
| `cmos/scripts/migrate_cmos_memory.py` | Migrates data from legacy CMOS systems. |
| `cmos/scripts/validate_foundational_refs.py` | Ensures documentation references target `foundational-docs/`. |
| `cmos/scripts/package_starter.sh` | Produces distributable `cmos-starter-<UTC>.tar.gz` bundle. |
| `cmos/scripts/reset_starter.sh` | Resets CMOS to clean state for distribution. |

---

## Testing & Guardrails

- **JavaScript test suites** – Run `npm run test:unit`, `npm run test:integration`, or `npm run test:e2e` for focused coverage. Use `npm run test:coverage` to generate reports.
- **Security validation** – `context/security_validation.js` scans mission outputs and fixtures against OWASP-aligned rules.
- **Quality assurance** – `context/quality_assurance.js` reviews generated code for common pitfalls.
- **Integration harness** – `context/integration_test_runner.js` orchestrates the full guardrail suite.
- **Telemetry** – Append-only logs under `telemetry/events/` capture mission runtime results and database health checks (`telemetry/events/database-health.jsonl`).

Keep coverage above 80% and run guardrails whenever missions modify runtime assets, orchestration scripts, or security-sensitive templates.

---

## Packaging & Distribution

Create a distributable archive with:

```bash
./cmos/scripts/package_starter.sh
```

The script normalises from cmos root, strips transient artefacts, and produces a tarball in `cmos/dist/`. Share the archive with downstream teams or automation pipelines to bootstrap new Mission Protocol projects quickly.

---

## Documentation

**Complete workflow**: See `cmos/docs/user-manual.md` for the full process from installation to ongoing operations.

**Quick guides**:
- **Getting Started**: `cmos/docs/getting-started.md` - Day 0 setup
- **Operations**: `cmos/docs/operations-guide.md` - Daily operations reference
- **Build Sessions**: `cmos/docs/build-session-prompt.md` - Mission execution loops
- **agents.md Guide**: `cmos/docs/agents-md-guide.md` - Writing effective AI instructions
- **Migration**: `cmos/docs/legacy-migration-guide.md` - Import from legacy CMOS
- **Schema**: `cmos/docs/sqlite-schema-reference.md` - Database queries and structure

**Critical concept**: CMOS is project management. Your application code lives in project root, NOT in cmos/.

---

## Key Principles

1. **Database Only** - `cmos/db/cmos.sqlite` is single source of truth, export files on-demand
2. **Minimal Backlog** - Keep `backlog.yaml` small (current work only), DB has full history
3. **Two agents.md Files** - One for your code (`project-root/agents.md`), one for CMOS operations (`cmos/agents.md`)
4. **Clear Boundaries** - Never write application code in cmos/
5. **Export When Needed** - Generate file views via `./cmos/cli.py db export [backlog|contexts]`

---

For questions or improvements, update the starter locally and regenerate the archive with `./cmos/scripts/package_starter.sh`.
