# Build Session Prompt

**Purpose**: Efficient prompts for running build missions and planning sessions with CMOS.

**Usage**: Paste at the start of a session to establish context, then iterate through missions efficiently.

---

## MCP Session Prompts (Recommended for AI Agents)

### Build Session Initialization

```
We're running a CMOS build session. If anything is unclear, pause and ask before proceeding.

CMOS uses MCP tools for database operations. Start by getting context:

1. ONBOARD: Call cmos_agent_onboard() to get project state
2. HEALTH CHECK: Call cmos_db_health() to verify database
3. LOAD RULES: Read cmos/agents.md for project rules

Then run missions in a loop:

1. SELECT NEXT: Call cmos_mission_status() to see work queue
   - Priority: In Progress → Current → Queued

2. START: Call cmos_mission_start(missionId="<id>")
   - Logs start event to database
   - Transitions to In Progress

3. EXECUTE: Actually implement the work
   - Write real code, not stubs
   - Create comprehensive tests
   - Verify all success criteria met
   - CRITICAL: Don't mark complete unless work is actually done

4. COMPLETE: Call cmos_mission_complete(missionId="<id>", notes="<what was done>")
   - Marks completed in database
   - Logs completion event

5. VERIFY: Call cmos_mission_status() to confirm state

If blocked: Call cmos_mission_block(missionId="<id>", reason="<why>", blockers=["<what's needed>"])

Loop until all missions complete or you need to pause.
```

### Minimal Build Loop (Experienced Users)

```
CMOS build loop using MCP:

1. Onboard: cmos_agent_onboard()
2. Queue: cmos_mission_status()
3. Start: cmos_mission_start(missionId)
4. Execute: Implement fully, test thoroughly
5. Complete: cmos_mission_complete(missionId, notes)
6. Verify: cmos_mission_status()
7. Repeat
```

### Planning Session

```
We're running a CMOS planning session. Start by getting context:

1. ONBOARD: Call cmos_agent_onboard() to understand current state
2. CONTEXT: Call cmos_context_view() to see project history and decisions
3. LOAD RULES: Read cmos/agents.md for CMOS rules, agents.md for project rules

Start a planning session:
cmos_session_start(type="planning", title="<sprint/topic>")

During planning, capture insights:
cmos_session_capture(category="decision", content="<choice made>")
cmos_session_capture(category="constraint", content="<limitation>")
cmos_session_capture(category="next-step", content="<action item>")

Categories: decision, learning, constraint, context, next-step

When planning is complete:
cmos_session_complete(summary="<what was decided>", nextSteps=["<actions>"])

If creating new work:
1. Create sprint: cmos_sprint_add(sprintId="sprint-XX", title="<name>", focus="<theme>")
2. Add missions: cmos_mission_add(missionId="<id>", name="<name>", sprintId="sprint-XX", objective="<goal>", successCriteria=["<criteria>"])
3. Add dependencies: cmos_mission_depends(fromId="<dependent>", toId="<dependency>", type="Requires")
```

### Sprint Review Session

```
We're running a CMOS sprint review. Get context first:

1. ONBOARD: cmos_agent_onboard()
2. SPRINT: cmos_sprint_show(sprintId="<current-sprint>")
3. DECISIONS: cmos_decisions_list(sprintId="<current-sprint>")

Start review session:
cmos_session_start(type="review", title="Sprint XX Review")

Capture learnings:
cmos_session_capture(category="learning", content="<what worked/didn't>")
cmos_session_capture(category="decision", content="<changes for next sprint>")

Complete review:
cmos_session_complete(summary="<sprint outcomes>", nextSteps=["<carry forward items>"])

Take context snapshot at milestone:
cmos_context_snapshot(contextType="master_context", source="Sprint XX completed")
```

### Onboarding Session (New Agent/Context)

```
I'm starting fresh and need to understand the project. Get me up to speed:

1. QUICK CONTEXT: cmos_agent_onboard()
   - Returns: project identity, current sprint, pending missions, recent decisions

2. FULL CONTEXT: cmos_context_view()
   - Returns: master context (history, decisions) + project context (current state)

3. WORK QUEUE: cmos_mission_status(includeBlocked=true)
   - Shows what's in progress, current, queued, and blocked

4. LOAD RULES: Read cmos/agents.md and agents.md

If formalizing onboarding:
cmos_session_start(type="onboarding", title="Onboarding for <feature/area>")
cmos_session_capture(category="context", content="<key understanding>")
cmos_session_complete(summary="<ready to work on X>")
```

### Research Session

```
We're doing a research spike. Set up the session:

1. ONBOARD: cmos_agent_onboard()
2. START: cmos_session_start(type="research", title="<research topic>")

During research, capture findings:
cmos_session_capture(category="learning", content="<finding>")
cmos_session_capture(category="decision", content="<recommendation>")
cmos_session_capture(category="constraint", content="<limitation discovered>")

Complete with recommendations:
cmos_session_complete(summary="<findings summary>", nextSteps=["<recommended actions>"])
```

---

## CLI Session Prompts (For Human Operators)

### Build Session Initialization

```
We're running a CMOS build session from project root.
If anything is unclear, pause and ask before proceeding.

CMOS location: cmos/
Database: cmos/db/cmos.sqlite (source of truth)
Mission runtime: Use context/mission_runtime.py helpers

Load contexts:
- Read cmos/agents.md for project rules
- Check ./cmos/cli.py db show current for state

Run missions in a loop:

1. SELECT: ./cmos/cli.py mission status
2. START: ./cmos/cli.py mission start <id>
3. EXECUTE: Implement fully, test thoroughly
4. COMPLETE: ./cmos/cli.py mission complete <id> --notes "<details>"
5. VERIFY: ./cmos/cli.py db show current
6. Repeat

If blocked: ./cmos/cli.py mission block <id> --reason "<why>"
```

### Planning Session (CLI)

```
We're doing sprint planning from project root.

Load context:
- Read agents.md, cmos/agents.md
- Run ./cmos/cli.py session onboard

Start session:
./cmos/cli.py session start --type planning --title "Sprint XX Planning"

Capture decisions:
./cmos/cli.py session capture decision "<choice>"
./cmos/cli.py session capture constraint "<limitation>"
./cmos/cli.py session capture next-step "<action>"

Complete:
./cmos/cli.py session complete --summary "<outcome>" --next-steps "<action>"

Create missions:
./cmos/cli.py mission add <id> "<name>" --sprint "Sprint XX"
./cmos/cli.py mission depends <from> <to> --type "Requires"
```

---

## Validation Commands

### MCP Validation

```
# Quick health check
cmos_db_health()

# View current state
cmos_mission_status(includeBlocked=true)

# Check sprint progress
cmos_sprint_show(sprintId="<current>")

# Review context
cmos_context_view()
```

### CLI Validation

```bash
./cmos/cli.py validate health
./cmos/cli.py db show current
./cmos/cli.py db show backlog
./cmos/cli.py mission status --limit 5
```

---

## Key Principles

**MCP First**:
- Use MCP tools for all database operations
- Structured JSON responses, no shell parsing
- Direct database access, optimized for agents

**Database First**:
- SQLite is source of truth
- File mirrors are for human inspection
- MCP/runtime handles synchronization

**Validation Checkpoints**:
- After each mission completion
- Before ending session
- If anything seems wrong

**Mission Loop Efficiency**:
- Don't re-explain system between missions
- Trust tools to handle state transitions
- Focus on execution and validation

---

## Common Session Patterns

### Pattern 1: Sequential Mission Execution
Run missions one by one until backlog clears or you pause.

### Pattern 2: Batch Similar Missions
Group related missions (e.g., all testing missions) and run together with similar context.

### Pattern 3: Stop on Blocker
If mission blocks, stop loop, document needs, end session.

### Pattern 4: Planning → Build Flow
Start with planning session, create missions, then switch to build loop.

---

## What You DON'T Need to Prompt

Once session is initialized, agent should know:

- Where database is located
- How to use MCP tools
- Table names and schema
- Path to scripts

**Do prompt**:
- Start next mission
- Mission-specific context
- Stop/pause when needed

---

## Example MCP Session Flow

```
You: [Paste MCP Build Session Initialization Prompt]

Agent: Getting context...
       cmos_agent_onboard() → Project: CMOS, Sprint: sprint-14, 3 pending missions
       cmos_mission_status() → Next: s14-m01 "Implement caching"
       Ready to start s14-m01?

You: Go ahead

Agent: cmos_mission_start(missionId="s14-m01")
       [Implements caching layer, writes tests, verifies]
       cmos_mission_complete(missionId="s14-m01", notes="Redis caching implemented with 85% hit rate")

       cmos_mission_status() → Next: s14-m02 "Update API endpoints"
       Ready to start s14-m02?

You: Yes

Agent: cmos_mission_start(missionId="s14-m02")
       [Implements, tests, completes]

       cmos_mission_status() → Next: s14-m03 "Performance testing"
       Ready to start s14-m03?

You: Pause there, let's review s14-m02

Agent: [Stops loop, shows what was done]
```

---

## Troubleshooting

**"No pending missions"**
- All missions completed or blocked
- Check: `cmos_mission_status(includeBlocked=true)` or `cmos_sprint_show(sprintId)`

**"Database error"**
- Database connection or query failed
- Fix: `cmos_db_health()` to diagnose, check if DB exists

**"Mission still showing In Progress"**
- Wasn't properly completed
- Fix: `cmos_mission_complete(missionId, notes)` or check for errors

**"Cannot start - invalid state transition"**
- Mission not in Queued or Current status
- Check current status with `cmos_mission_show(missionId)`

---

## Quick Reference Card

### MCP Build Loop
```
cmos_agent_onboard()                    # Get context
cmos_mission_status()                   # See queue
cmos_mission_start(missionId)           # Start work
# ... implement ...
cmos_mission_complete(missionId, notes) # Finish work
```

### MCP Planning Loop
```
cmos_agent_onboard()                    # Get context
cmos_session_start(type, title)         # Start session
cmos_session_capture(category, content) # Capture insights
cmos_session_complete(summary)          # End session
cmos_sprint_add(sprintId, title)        # Create sprint
cmos_mission_add(missionId, name, ...)  # Add missions
```

### MCP Context Commands
```
cmos_context_view()                     # See all context
cmos_context_snapshot(contextType, source) # Save milestone
cmos_decisions_search(query)            # Find past decisions
```

---

**Last Updated**: 2025-12-10
**CMOS Version**: 2.1 (MCP-enabled)
**For**: Build sessions, planning sessions, research sessions
**See Also**: `cmos/docs/mcp-reference.md` for complete MCP tool documentation
