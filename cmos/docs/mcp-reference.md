# CMOS MCP Reference

**Complete reference for interacting with CMOS via Model Context Protocol (MCP).**

MCP is the recommended interface for AI agents working with CMOS. It provides direct database access without requiring shell commands, making it ideal for agent-native workflows.

---

## Quick Start

MCP tools are available when the `cmos-mcp` server is configured in your Claude environment. All tools accept an optional `projectRoot` parameter to specify the project directory (defaults to current working directory).

```
# Check CMOS is accessible
cmos_db_health()

# Get quick project overview
cmos_agent_onboard()

# View current work queue
cmos_mission_status()
```

---

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| **Onboarding** | `cmos_agent_onboard` | Quick context for agent cold-start |
| **Sprints** | `cmos_sprint_add`, `cmos_sprint_list`, `cmos_sprint_show`, `cmos_sprint_update` | Sprint lifecycle management |
| **Missions** | `cmos_mission_add`, `cmos_mission_list`, `cmos_mission_show`, `cmos_mission_status`, `cmos_mission_start`, `cmos_mission_complete`, `cmos_mission_block`, `cmos_mission_unblock`, `cmos_mission_update`, `cmos_mission_depends` | Mission lifecycle management |
| **Sessions** | `cmos_session_start`, `cmos_session_capture`, `cmos_session_complete`, `cmos_session_list` | Planning, onboarding, review sessions |
| **Context** | `cmos_context_view`, `cmos_context_snapshot`, `cmos_context_history` | Context management and snapshots |
| **Decisions** | `cmos_decisions_list`, `cmos_decisions_search` | Strategic decision queries |
| **Database** | `cmos_db_health` | Database health and diagnostics |

---

## Onboarding

### cmos_agent_onboard

Get aggregated context for agent cold-start. Returns project identity, active session, pending missions, recent decisions, and suggested actions. Optimized for context windows (<4KB).

**Parameters:**
- `projectRoot` (optional): Project root directory

**Returns:**
```json
{
  "project": { "name": "...", "description": "...", "status": "..." },
  "currentSprint": { "id": "...", "title": "...", "status": "...", "focus": "..." },
  "activeSession": null,
  "pendingMissions": [...],
  "blockedMissions": [...],
  "recentDecisions": [...],
  "nextSteps": [...],
  "suggestedActions": [...]
}
```

**Example:**
```
cmos_agent_onboard()
```

**Use when:** Starting a new conversation or session to quickly understand project state.

---

## Sprint Management

### cmos_sprint_add

Create a new sprint in the database.

**Parameters:**
- `sprintId` (required): Unique sprint identifier (e.g., "sprint-14")
- `title` (required): Sprint title
- `focus` (optional): Strategic focus or theme
- `status` (optional): Sprint status (default: "Active")
- `startDate` (optional): Start date in ISO format (e.g., "2025-01-01")
- `endDate` (optional): End date in ISO format

**Example:**
```
cmos_sprint_add(
  sprintId="sprint-14",
  title="API Performance Sprint",
  focus="Optimize database queries and caching",
  status="Active",
  startDate="2025-01-06"
)
```

---

### cmos_sprint_list

List all sprints with optional filtering.

**Parameters:**
- `status` (optional): Filter by status (e.g., "Active", "Completed")
- `limit` (optional): Maximum results (1-100, default: 20)

**Returns:** Array of sprints with mission counts (total, completed, blocked, active).

**Example:**
```
cmos_sprint_list(status="Active")
```

---

### cmos_sprint_show

Get detailed information about a specific sprint including all associated missions.

**Parameters:**
- `sprintId` (required): The sprint ID to retrieve

**Returns:** Sprint metadata plus list of all missions in the sprint.

**Example:**
```
cmos_sprint_show(sprintId="sprint-14")
```

---

### cmos_sprint_update

Update specific fields of a sprint.

**Parameters:**
- `sprintId` (required): The sprint ID to update
- `fields` (required): Object with fields to update:
  - `title` (optional): New title
  - `focus` (optional): New focus
  - `status` (optional): New status
  - `startDate` (optional): New start date
  - `endDate` (optional): New end date

**Example:**
```
cmos_sprint_update(
  sprintId="sprint-14",
  fields={ "status": "Completed", "endDate": "2025-01-15" }
)
```

---

## Mission Management

### cmos_mission_add

Create a new mission in the database.

**Parameters:**
- `missionId` (required): Mission identifier (e.g., "s14-m05")
- `name` (required): Display name for the mission
- `sprintId` (required): Must reference an existing sprint
- `status` (optional): Mission status (default: "Queued")
- `objective` (optional): What this mission aims to accomplish
- `context` (optional): Background context
- `successCriteria` (optional): Array of measurable criteria
- `deliverables` (optional): Array of files/artifacts to produce
- `referenceDocs` (optional): Array of documentation to reference
- `notes` (optional): Additional notes

**Example:**
```
cmos_mission_add(
  missionId="s14-m01",
  name="Implement Query Caching",
  sprintId="sprint-14",
  objective="Add Redis caching layer for frequent database queries",
  successCriteria=["Cache hit rate > 80%", "Response time < 100ms"],
  deliverables=["src/cache/redis-client.ts", "tests/cache.test.ts"]
)
```

---

### cmos_mission_list

List missions with optional filtering.

**Parameters:**
- `status` (optional): Filter by status ("Queued", "Current", "In Progress", "Completed", "Blocked")
- `sprintId` (optional): Filter by sprint ID
- `limit` (optional): Maximum results (1-100, default: 20)

**Example:**
```
cmos_mission_list(status="In Progress", sprintId="sprint-14")
```

---

### cmos_mission_show

Get full details of a specific mission.

**Parameters:**
- `missionId` (required): The mission ID to retrieve

**Returns:** Complete mission specification including objective, context, success criteria, deliverables, and sprint info.

**Example:**
```
cmos_mission_show(missionId="s14-m01")
```

---

### cmos_mission_status

Show the active work queue. Returns missions in priority order: In Progress first, then Current, then Queued.

**Parameters:**
- `includeBlocked` (optional): Include blocked missions in separate section (default: false)
- `queuedLimit` (optional): Maximum queued missions to show (1-50, default: 5)

**Example:**
```
cmos_mission_status(includeBlocked=true)
```

**Use when:** Starting work to see what to work on next.

---

### cmos_mission_start

Start a mission by transitioning it to "In Progress" status.

**Parameters:**
- `missionId` (required): The mission ID to start
- `notes` (optional): Notes about why this mission is being started

**Valid from:** Queued, Current

**Example:**
```
cmos_mission_start(missionId="s14-m01", notes="Beginning cache implementation")
```

---

### cmos_mission_complete

Complete a mission by transitioning it to "Completed" status.

**Parameters:**
- `missionId` (required): The mission ID to complete
- `notes` (optional): Notes or outcome summary

**Valid from:** In Progress

**Example:**
```
cmos_mission_complete(
  missionId="s14-m01",
  notes="Cache implemented with 85% hit rate. Tests passing."
)
```

---

### cmos_mission_block

Block a mission with a reason.

**Parameters:**
- `missionId` (required): The mission ID to block
- `reason` (required): Why this mission is blocked
- `blockers` (optional): Array of items needed to unblock

**Valid from:** Current, In Progress

**Example:**
```
cmos_mission_block(
  missionId="s14-m01",
  reason="Waiting for Redis credentials from DevOps",
  blockers=["Request Redis access", "Update environment config"]
)
```

---

### cmos_mission_unblock

Unblock a mission and transition it back to work.

**Parameters:**
- `missionId` (required): The mission ID to unblock
- `resolution` (optional): Notes explaining how the blocker was resolved
- `targetStatus` (optional): Target status after unblocking ("In Progress" or "Current", default: "In Progress")

**Valid from:** Blocked

**Example:**
```
cmos_mission_unblock(
  missionId="s14-m01",
  resolution="Redis credentials received and configured"
)
```

---

### cmos_mission_update

Update specific fields of a mission without replacing the entire record.

**Parameters:**
- `missionId` (required): The mission ID to update
- `fields` (required): Object with fields to update:
  - `name`, `objective`, `context`, `notes` (strings)
  - `status` (validates state transitions)
  - `successCriteria`, `deliverables`, `referenceDocs` (arrays)
  - `metadata`, `domainFields` (objects)

**Example:**
```
cmos_mission_update(
  missionId="s14-m01",
  fields={
    "notes": "Updated implementation approach",
    "successCriteria": ["Cache hit rate > 90%", "Response time < 50ms"]
  }
)
```

---

### cmos_mission_depends

Create a dependency relationship between two missions.

**Parameters:**
- `fromId` (required): The dependent mission ID
- `toId` (required): The dependency mission ID (must complete first)
- `type` (required): Dependency type - "Blocks", "Requires", or "Enables"

**Dependency types:**
- **Blocks**: Mission A blocks Mission B from starting
- **Requires**: Mission A requires Mission B to be completed first
- **Enables**: Mission A enables Mission B to proceed

**Example:**
```
cmos_mission_depends(
  fromId="s14-m02",
  toId="s14-m01",
  type="Requires"
)
```

---

## Session Management

### cmos_session_start

Start a new session for planning, onboarding, review, or research work.

**Parameters:**
- `type` (required): Session type - "onboarding", "planning", "review", "research", "check-in", or "custom"
- `title` (required): Short descriptive title (max 255 chars)
- `sprintId` (optional): Sprint ID to associate with this session
- `agent` (optional): Agent starting the session (default: "assistant")

**Note:** Only one session can be active at a time.

**Example:**
```
cmos_session_start(
  type="planning",
  title="Sprint 15 Planning",
  sprintId="sprint-15"
)
```

---

### cmos_session_capture

Capture an insight during an active session.

**Parameters:**
- `category` (required): Category type:
  - `decision` - Choices made
  - `learning` - What was learned
  - `constraint` - Limitations discovered
  - `context` - Background information
  - `next-step` - Action items
- `content` (required): The insight to capture (1-1000 chars)
- `context` (optional): Additional context for this capture
- `sessionId` (optional): Session ID (uses active session if not provided)
- `agent` (optional): Agent making the capture

**Example:**
```
cmos_session_capture(
  category="decision",
  content="Use Redis for caching layer based on team familiarity"
)

cmos_session_capture(
  category="next-step",
  content="Profile current API endpoints for cache candidates"
)
```

---

### cmos_session_complete

Complete an active session with a summary.

**Parameters:**
- `summary` (required): Summary of what was accomplished (1-2000 chars)
- `nextSteps` (optional): Array of next steps or action items
- `sessionId` (optional): Session ID (uses active session if not provided)
- `agent` (optional): Agent completing the session

**Example:**
```
cmos_session_complete(
  summary="Sprint 15 planned: 8 missions focused on performance optimization",
  nextSteps=["Create mission specs", "Assign priorities"]
)
```

---

### cmos_session_list

List sessions with optional filtering.

**Parameters:**
- `status` (optional): Filter by status - "active", "completed", or "canceled"
- `type` (optional): Filter by session type
- `sprintId` (optional): Filter by sprint ID
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (1-100, default: 20)

**Example:**
```
cmos_session_list(type="planning", status="completed")
```

---

## Context Management

### cmos_context_view

Render aggregated context from the database. Returns master_context and project_context merged.

**Parameters:**
- `contextType` (optional): Filter to "master_context" or "project_context". If omitted, returns both merged.

**Example:**
```
cmos_context_view()
cmos_context_view(contextType="master_context")
```

**Use when:** Need to understand current project state and historical decisions.

---

### cmos_context_snapshot

Take a strategic snapshot of a context. Creates an entry with timestamp for historical reference.

**Parameters:**
- `contextType` (required): Which context to snapshot - "master_context" or "project_context"
- `source` (required): Descriptive label for why this snapshot was taken
- `sessionId` (optional): Session ID to associate this snapshot with

**Example:**
```
cmos_context_snapshot(
  contextType="master_context",
  source="Sprint 14 completed - caching infrastructure ready"
)
```

**Use when:** After sprint completions, major architectural decisions, or strategic milestones.

---

### cmos_context_history

View the context snapshot timeline.

**Parameters:**
- `contextType` (optional): Filter to specific context type
- `sessionId` (optional): Filter to snapshots from specific session
- `since` (optional): Filter after this ISO date
- `until` (optional): Filter before this ISO date
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (1-100, default: 20)

**Example:**
```
cmos_context_history(contextType="master_context", pageSize=10)
```

---

## Strategic Decisions

### cmos_decisions_list

List strategic decisions from the database.

**Parameters:**
- `domain` (optional): Filter by project domain
- `sprintId` (optional): Filter by sprint ID
- `since` (optional): Filter after this ISO date
- `until` (optional): Filter before this ISO date
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Results per page (1-100, default: 20)

**Example:**
```
cmos_decisions_list(sprintId="sprint-14")
```

---

### cmos_decisions_search

Search strategic decisions by keyword.

**Parameters:**
- `query` (required): Search keywords
- `domain` (optional): Filter by domain
- `sprintId` (optional): Filter by sprint ID
- `limit` (optional): Maximum results (1-50, default: 20)

**Example:**
```
cmos_decisions_search(query="caching")
cmos_decisions_search(query="database", sprintId="sprint-14")
```

---

## Database Health

### cmos_db_health

Check CMOS database connectivity and health.

**Parameters:**
- `projectRoot` (optional): Project root directory

**Returns:**
```json
{
  "connected": true,
  "version": "3.50.4",
  "path": "cmos/db/cmos.sqlite",
  "tables": [...],
  "missionCount": 12,
  "sessionCount": 5,
  "contextCount": 2,
  "lastMissionActivity": "2025-01-10T...",
  "lastSessionActivity": "2025-01-10T...",
  "fileSizeBytes": 118784,
  "walModeEnabled": true
}
```

**Example:**
```
cmos_db_health()
```

**Use when:** Starting a session to verify CMOS is properly configured.

---

## Common Workflows

### Starting Fresh Work

```
# 1. Check health
cmos_db_health()

# 2. Get context
cmos_agent_onboard()

# 3. See what's pending
cmos_mission_status(includeBlocked=true)

# 4. Start working
cmos_mission_start(missionId="s14-m01")
```

### Planning a New Sprint

```
# 1. Start planning session
cmos_session_start(type="planning", title="Sprint 15 Planning")

# 2. Capture decisions
cmos_session_capture(category="decision", content="Focus on user-facing features")
cmos_session_capture(category="constraint", content="Must maintain API compatibility")

# 3. Complete session
cmos_session_complete(summary="Sprint 15 scoped with 6 missions")

# 4. Create sprint
cmos_sprint_add(sprintId="sprint-15", title="User Features Sprint")

# 5. Add missions
cmos_mission_add(missionId="s15-m01", name="User Dashboard", sprintId="sprint-15")
```

### Mission Lifecycle

```
# View queue
cmos_mission_status()

# Start mission
cmos_mission_start(missionId="s14-m01")

# ... do work ...

# Complete mission
cmos_mission_complete(missionId="s14-m01", notes="Implemented successfully")
```

### Handling Blockers

```
# Block with reason
cmos_mission_block(
  missionId="s14-m01",
  reason="Waiting for API credentials",
  blockers=["Contact DevOps", "Update .env"]
)

# Later, unblock
cmos_mission_unblock(
  missionId="s14-m01",
  resolution="Credentials received"
)
```

---

## MCP vs CLI Comparison

| Operation | MCP Tool | CLI Command |
|-----------|----------|-------------|
| Agent onboard | `cmos_agent_onboard()` | `./cmos/cli.py session onboard` |
| Create sprint | `cmos_sprint_add(...)` | (no CLI equivalent) |
| List sprints | `cmos_sprint_list()` | `./cmos/cli.py db show backlog` |
| Create mission | `cmos_mission_add(...)` | `./cmos/cli.py mission add ...` |
| Mission status | `cmos_mission_status()` | `./cmos/cli.py mission status` |
| Start mission | `cmos_mission_start(...)` | `./cmos/cli.py mission start ...` |
| Complete mission | `cmos_mission_complete(...)` | `./cmos/cli.py mission complete ...` |
| Start session | `cmos_session_start(...)` | `./cmos/cli.py session start ...` |
| Capture insight | `cmos_session_capture(...)` | `./cmos/cli.py session capture ...` |
| Context view | `cmos_context_view()` | `./cmos/cli.py context view` |
| Take snapshot | `cmos_context_snapshot(...)` | `./cmos/cli.py context snapshot ...` |
| Search decisions | `cmos_decisions_search(...)` | `./cmos/cli.py decisions search ...` |
| DB health | `cmos_db_health()` | `./cmos/cli.py validate health` |

---

## Error Handling

All MCP tools return consistent response shapes:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot start mission from Completed status",
    "current_state": "Completed",
    "valid_transitions": ["Queued", "Current"]
  }
}
```

**Common error codes:**
- `NOT_FOUND` - Mission, sprint, or session doesn't exist
- `INVALID_STATE_TRANSITION` - Invalid status change (includes valid transitions)
- `VALIDATION_ERROR` - Invalid parameters
- `DATABASE_ERROR` - Database connectivity issue

---

**Last Updated**: 2025-12-10
**CMOS Version**: 2.1 (MCP-enabled)
**Status**: Complete MCP reference
