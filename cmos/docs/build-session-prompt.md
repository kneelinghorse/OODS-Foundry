# Build Session Prompt

**Purpose**: Efficient prompt for running multiple build missions in a session loop.

**Usage**: Paste at the start of a build session to establish context, then iterate through 3-10 missions efficiently.

---

## Session Initialization Prompt

```
We're running a CMOS build session from project root.

CMOS location: cmos/
Database: cmos/db/cmos.sqlite (source of truth)
Mission runtime: Use context/mission_runtime.py helpers (`next_mission`, `start`, `complete`, `block`)
DB client: Use context/db_client.py SQLiteClient for any direct queries

Load contexts:
- Read cmos/agents.md for project rules
- Load PROJECT_CONTEXT and MASTER_CONTEXT from database via mission runtime helpers or SQLiteClient

We'll run missions in a loop. For each mission:

1. SELECT NEXT: Use `next_mission()` (from `context.mission_runtime import next_mission`)
   - Priority: In Progress → Current → Queued
   - If Queued, it gets promoted to In Progress on start

2. START: Call `start(mission_id, summary="<brief>", agent="<name>")`
   - Logs start event to database
   - Updates contexts automatically in database

3. EXECUTE: Actually implement the work
   - Write real code, not stubs
   - Create comprehensive tests
   - Verify all success criteria met
   - CRITICAL: Don't mark complete unless work is actually done

4. COMPLETE: Call `complete(mission_id, summary="<brief>", notes="<details>", agent="<name>")`
   - Marks completed in database
   - Auto-promotes next mission
   - Logs completion event

5. VERIFY: Check ./cmos/cli.py db show current after each mission

If blocked: Call `block(mission_id, summary, reason, needs=[...])`. Do not promote next mission.

```

---

## Minimal Loop Prompt (For Experienced Users)

B22.1 If you are unsure or have questions, please pause and clarify
```
CMOS build loop from project root:

1. Fetch next: `next_mission()`
2. Start: `start(id, summary, agent)`
3. Execute: Implement fully, test thoroughly
4. Complete: `complete(id, summary, notes, agent)`
5. Verify: Check mission logged correctly
6. Repeat

Database: cmos/db/cmos.sqlite
Runtime: cmos/context/mission_runtime.py helpers (`next_mission`, `start`, `complete`, `block`)
```

---

## Key Principles

**Database First**:
- SQLite is source of truth
- File mirrors are for human inspection
- Mission runtime helpers handle synchronization

**Validation Checkpoints**:
- After each mission completion
- Before ending session
- If anything seems wrong

**Mission Loop Efficiency**:
- Don't re-explain system between missions
- Trust runtime to handle promotion/logging
- Focus on execution and validation

---

## Common Session Patterns

### Pattern 1: Sequential Mission Execution
Run missions one by one until backlog clears or you pause.

### Pattern 2: Batch Similar Missions
Group related missions (e.g., all testing missions) and run together with similar context.

### Pattern 3: Stop on Blocker
If mission blocks, stop loop, document needs, end session.

---

## What You DON'T Need to Prompt

Once session is initialized, agent should know:

❌ **Don't repeat**: Where database is located  
❌ **Don't repeat**: How to import SQLiteClient  
❌ **Don't repeat**: Table names and schema  
❌ **Don't repeat**: Path to scripts

✅ **Do prompt**: Start next mission  
✅ **Do prompt**: Mission-specific context  
✅ **Do prompt**: Stop/pause when needed

---

## Example Session Flow

```
You: [Paste Session Initialization Prompt]

Agent: Loaded. Fetching next mission... Found: B3.1 - Database Schema Design

You: Go ahead

Agent: [Starts B3.1, implements, tests, completes, validates]
      Next mission: B3.2 - Context Migration. Ready to start?

You: Yes

Agent: [Starts B3.2, implements, tests, completes, validates]
      Next mission: B3.3 - Parity Validator. Ready to start?

You: Pause there, let's review B3.2

Agent: [Stops loop, shows what was done]
```

---

## Validation After Session

Before ending any build session:

```bash
# Verify all changes are tracked
./cmos/cli.py validate health

# View what was accomplished
./cmos/cli.py db show backlog

# Check current state
./cmos/cli.py db show current
```

---

## Tests
```
./cmos/cli.py mission status --limit 5
./cmos/cli.py db show current
./cmos/cli.py db show backlog
./cmos/cli.py db export contexts --output-root cmos/tmp/test-export 
./cmos/cli.py db export backlog --output cmos/missions/backlog-export.yaml 
./cmos/cli.py validate health
./cmos/cli.py validate docs

```

## Troubleshooting

**"Cannot find next candidate"**
- All missions completed or blocked
- Check: `./cmos/cli.py db show backlog`

**"Database error"**
- Database connection or query failed
- Fix: Check telemetry logs, verify DB exists, check schema integrity

**"Mission still showing In Progress"**
- Wasn't properly completed
- Fix: Call complete_mission() or update database manually

---

**Last Updated**: 2025-11-08  
**For**: Build session mission loops  
**Replaces**: `sqlite-prompt-execution-guide.md` (old verbose version)
