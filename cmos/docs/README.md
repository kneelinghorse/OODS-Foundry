# CMOS Documentation

**Complete documentation for the Context + Mission Orchestration System.**

---

## Quick Start

**New to CMOS?** Start here:
1. 📘 [Getting Started](./getting-started.md) - Installation and setup
2. 🔌 [MCP Reference](./mcp-reference.md) - **MCP tools for AI agents** (recommended)
3. 📖 [User Manual](./user-manual.md) - Complete guide from foundation to operations
4. 💡 [Workflow Examples](./workflow-examples.md) - Practical examples of sessions and missions

---

## Core Documentation

### Setup & Configuration
- **[Getting Started](./getting-started.md)** - Day 0 setup from fresh install to first sprint
- **[agents.md Guide](./agents-md-guide.md)** - How to write effective AI instructions
- **[Operations Guide](./operations-guide.md)** - Operational procedures and best practices

### MCP Interface (Recommended for AI Agents)
- **[MCP Reference](./mcp-reference.md)** - Complete MCP tool documentation with examples
  - Sprint management: `cmos_sprint_add`, `cmos_sprint_list`, `cmos_sprint_show`, `cmos_sprint_update`
  - Mission lifecycle: `cmos_mission_add`, `cmos_mission_start`, `cmos_mission_complete`, `cmos_mission_depends`
  - Sessions: `cmos_session_start`, `cmos_session_capture`, `cmos_session_complete`
  - Context & Decisions: `cmos_context_view`, `cmos_context_snapshot`, `cmos_decisions_search`
  - Onboarding: `cmos_agent_onboard` - Quick context for agent cold-start

### Daily Usage
- **[User Manual](./user-manual.md)** - Complete reference: phases, commands, workflows
- **[Workflow Examples](./workflow-examples.md)** - Real-world examples of sessions + missions (MCP + CLI)
- **[Session Management Guide](./session-management-guide.md)** - Planning, onboarding, reviews
- **[Build Session Prompt](./build-session-prompt.md)** - Template for starting build sessions

### Technical Reference
- **[SQLite Schema Reference](./sqlite-schema-reference.md)** - Database structure and queries
- **[Mission Runtime Migration](./mission_runtime_migration.md)** - Helper functions vs MissionRuntime class
- **[Legacy Migration Guide](./legacy-migration-guide.md)** - Upgrading from older CMOS versions

---

## Documentation by Use Case

### "I'm setting up CMOS for the first time"
1. Read [Getting Started](./getting-started.md)
2. Follow the 5-step setup process
3. Review [User Manual Phase 1](./user-manual.md#phase-1-foundation) for foundation docs

### "I'm planning a new sprint"
1. Review [Session Management Guide](./session-management-guide.md) - Planning section
2. Use [Workflow Examples #1](./workflow-examples.md#example-1-starting-a-new-project) as template
3. See [User Manual Phase 2](./user-manual.md#phase-2-sprint-planning) for backlog creation

### "I'm starting a build session"
1. Use [Build Session Prompt](./build-session-prompt.md) as your template
2. Follow mission execution pattern in [User Manual Phase 3](./user-manual.md#phase-3-build-execution)
3. Check [Operations Guide - Mission Lifecycle](./operations-guide.md#mission-lifecycle) for details

### "I need to onboard a new agent/teammate"
1. **MCP**: Call `cmos_agent_onboard()` for quick context (recommended)
2. **CLI**: Run `./cmos/cli.py session onboard`
3. Follow [Workflow Examples #4](./workflow-examples.md#example-4-onboarding-a-new-agent)
4. See [Session Management Guide - Onboarding](./session-management-guide.md#agent-onboarding)

### "I'm completing a sprint"
1. Follow [User Manual Phase 4](./user-manual.md#phase-4-sprint-closure)
2. Use [Workflow Examples #3](./workflow-examples.md#example-3-sprint-review-and-next-sprint-planning)
3. Update master context and take snapshot

### "I'm migrating from an older CMOS version"
1. Read [Legacy Migration Guide](./legacy-migration-guide.md)
2. Check [Mission Runtime Migration](./mission_runtime_migration.md) for code updates
3. Follow incremental upgrade path

### "I need database/schema information"
1. See [SQLite Schema Reference](./sqlite-schema-reference.md)
2. Check [Operations Guide - Runtime Operations](./operations-guide.md#runtime-operations)
3. Use CLI: `./cmos/cli.py db show --help`

---

## Documentation Map

```
cmos/docs/
├── README.md (you are here)
│
├── 📘 Getting Started
│   ├── getting-started.md          # Day 0 setup (includes MCP setup)
│   └── agents-md-guide.md          # Writing AI instructions
│
├── 🔌 MCP Reference (NEW)
│   └── mcp-reference.md            # Complete MCP tool documentation
│
├── 📖 Usage Guides
│   ├── user-manual.md              # Complete reference guide
│   ├── workflow-examples.md        # Practical examples (MCP + CLI)
│   ├── session-management-guide.md # Sessions: planning, onboarding, reviews
│   └── build-session-prompt.md     # Build session template
│
├── 🔧 Operations
│   └── operations-guide.md         # Procedures and best practices (MCP + CLI)
│
├── 📚 Technical Reference
│   ├── sqlite-schema-reference.md  # Database structure
│   ├── mission_runtime_migration.md # Runtime API changes
│   └── legacy-migration-guide.md   # Upgrade guide
│
└── 📁 Related
    ├── ../AGENTS.md                # CMOS operations for AI agents
    ├── ../foundational-docs/       # Project templates
    └── ../missions/templates/      # Mission templates
```

---

## Key Concepts

### Sessions
Non-build work: planning, onboarding, reviews, research. Captured with `./cmos/cli.py session` commands.

**Types:** planning, onboarding, review, research, check-in, custom

**Learn more:** [Session Management Guide](./session-management-guide.md)

### Missions
Build work: implementing features, writing code, tests. Executed through mission runtime helpers.

**Lifecycle:** Queued → Current → In Progress → Completed (or Blocked)

**Learn more:** [User Manual - Mission Execution](./user-manual.md#phase-3-build-execution)

### Contexts
- **PROJECT_CONTEXT**: Current session state, working memory
- **MASTER_CONTEXT**: Project history, decisions, constraints

**Learn more:** [Operations Guide - Context Management](./operations-guide.md#context-intake)

### Database
SQLite as source of truth. Export files on-demand for readability.

**Learn more:** [SQLite Schema Reference](./sqlite-schema-reference.md)

---

## Command Quick Reference

### MCP Tools (Recommended for AI Agents)

```
cmos_agent_onboard()                              # Quick context
cmos_db_health()                                  # Check database
cmos_mission_status()                             # View work queue
cmos_sprint_add(sprintId, title)                  # Create sprint
cmos_mission_add(missionId, name, sprintId)       # Create mission
cmos_mission_start(missionId)                     # Start mission
cmos_mission_complete(missionId, notes)           # Complete mission
cmos_session_start(type, title)                   # Start session
cmos_session_capture(category, content)           # Capture insight
cmos_session_complete(summary)                    # Complete session
cmos_context_snapshot(contextType, source)        # Take snapshot
cmos_decisions_search(query)                      # Search decisions
```

See [MCP Reference](./mcp-reference.md) for complete documentation.

### CLI Commands (For Human Operators)

```bash
# Database
./cmos/cli.py db show current        # View current mission
./cmos/cli.py db show backlog        # View all sprints
./cmos/cli.py db export backlog      # Export backlog to YAML

# Sessions
./cmos/cli.py session start --type <type> --title "<title>"
./cmos/cli.py session capture <category> "<content>"
./cmos/cli.py session complete --summary "<summary>"
./cmos/cli.py session onboard        # Quick context report

# Missions
./cmos/cli.py mission add <id> "<name>" --sprint "<sprint>"
./cmos/cli.py mission start <id>
./cmos/cli.py mission complete <id> --notes "<notes>"

# Context
./cmos/cli.py context snapshot master --source "<milestone>"
./cmos/cli.py context history master
./cmos/cli.py context view <snapshot-id>

# Validation
./cmos/cli.py validate health        # Check database
./cmos/cli.py validate docs          # Check documentation links
```

---

## Contributing to Documentation

When updating CMOS documentation:

1. **Keep consistency**: Use the same terminology across all docs
2. **Update Quick Reference**: Add new commands to quick reference tables
3. **Link related docs**: Use relative links to connect concepts
4. **Update dates**: Change "Last Updated" date at bottom of files
5. **Test examples**: Verify all command examples work
6. **Update this README**: Add new docs to the map above

---

## Need Help?

- **General questions**: Start with [User Manual](./user-manual.md)
- **Setup issues**: Check [Getting Started](./getting-started.md)
- **Session workflow**: See [Workflow Examples](./workflow-examples.md)
- **Technical details**: Review [Operations Guide](./operations-guide.md)
- **Database queries**: Consult [SQLite Schema Reference](./sqlite-schema-reference.md)

---

**Last Updated**: 2025-12-10
**CMOS Version**: 2.1 (MCP-enabled)
**Status**: Complete documentation set with MCP reference

