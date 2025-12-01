# SQLite Schema Reference

**Database**: `cmos/db/cmos.sqlite`  
**Schema**: `cmos/db/schema.sql`

Quick reference for querying CMOS history using any SQLite client.

---

## Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sprints` | Sprint registry with metrics | `id`, `title`, `status`, `total_missions`, `completed_missions` |
| `missions` | Mission backlog with status | `id`, `sprint_id`, `name`, `status`, `completed_at`, `notes` |
| `mission_dependencies` | Edges between missions | `from_id`, `to_id`, `type` |
| `contexts` | JSON payloads for PROJECT/MASTER context | `id`, `content`, `updated_at` |
| `context_snapshots` | Historical context versions | `context_id`, `content`, `created_at`, `content_hash` |
| `sessions` | Universal session registry | `id`, `type`, `sprint_id`, `started_at`, `status` |
| `session_events` | Append-only session log | `ts`, `agent`, `mission`, `action`, `status`, `summary` |
| `telemetry_events` | Runtime metrics and health signals | `source_path`, `event_data`, `created_at` |
| `prompt_mappings` | Prompt → behavior mapping | `prompt`, `behavior` |

**Views**:
- `active_missions` - Convenience projection for current work

---

## Useful Queries

### View Current Sprint Status
```sql
SELECT sprint_id, status, COUNT(*) as count
FROM missions
GROUP BY sprint_id, status
ORDER BY sprint_id, status;
```

### Find Active/Recent Missions
```sql
SELECT id, name, status, completed_at
FROM missions
WHERE status IN ('Current', 'In Progress', 'Queued')
ORDER BY completed_at DESC NULLS FIRST;
```

### View Sprint Progress
```sql
SELECT id, title, 
       completed_missions || '/' || total_missions as progress,
       status
FROM sprints
ORDER BY id;
```

### Get Recent Sessions
```sql
SELECT ts, mission, action, status, summary
FROM session_events
ORDER BY ts DESC
LIMIT 10;
```

### Review Planning/Onboarding Sessions
```sql
SELECT id, type, title, started_at, completed_at, status
FROM sessions
WHERE type IN ('planning', 'onboarding')
ORDER BY started_at DESC
LIMIT 10;
```

### Export Full Mission History for a Sprint
```sql
SELECT id, name, status, completed_at, notes
FROM missions
WHERE sprint_id = 'Sprint 05'
ORDER BY id;
```

### Check Context Updates
```sql
SELECT id, updated_at, 
       LENGTH(content) as size_bytes
FROM contexts
ORDER BY updated_at DESC;
```

### View Context History
```sql
SELECT created_at, session_id, source,
       LENGTH(content) as size_bytes
FROM context_snapshots
WHERE context_id = 'master_context'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Accessing the Database

Use any SQLite client:

**Command line**:
```bash
sqlite3 cmos/db/cmos.sqlite

# Run query
sqlite3 cmos/db/cmos.sqlite "SELECT * FROM sprints;"

# Interactive mode
sqlite3 cmos/db/cmos.sqlite
> .tables
> .schema missions
> SELECT * FROM missions LIMIT 5;
```

**GUI tools** (any will work):
- DB Browser for SQLite
- DBeaver
- TablePlus
- DataGrip
- VS Code SQLite extension
- etc.

All standard SQLite tools work - no special configuration needed.

---

## Schema Details

See `cmos/db/schema.sql` for complete schema including:
- Table definitions with foreign keys
- Indexes for query performance
- Views for common queries
- Constraints and defaults

---

## Maintenance Queries

### Compact Database
```sql
VACUUM;
```

### Check Database Size
```sql
SELECT page_count * page_size as size_bytes 
FROM pragma_page_count(), pragma_page_size();
```

### Verify Foreign Keys
```sql
PRAGMA foreign_key_check;
```

### List All Tables and Row Counts
```sql
SELECT name, 
       (SELECT COUNT(*) FROM sqlite_master m2 
        WHERE m2.type='table' AND m2.name=m1.name) 
FROM sqlite_master m1 
WHERE type='table' 
ORDER BY name;
```

---

**Last Updated**: 2025-11-13  
**Replaces**: `sqlite-db-browser-guide.md` (tool-agnostic version)
