# Legacy CMOS Migration Guide

**Purpose**: Migrate project history, context, sessions, and backlog from legacy CMOS systems into the current SQLite-first CMOS architecture.

**Audience**: Solo operator working with AI agent to ensure smooth migration.

---

## What Gets Migrated

✅ **PROJECT_CONTEXT.json** - Working memory, session counts, active missions  
✅ **context/MASTER_CONTEXT.json** - Project history, decisions, constraints, achievements  
✅ **SESSIONS.jsonl** - Session event history (chronological log)  
✅ **missions/backlog.yaml** - Sprint history, mission status, dependencies  
✅ **SQLite Database** - All of the above gets synced to `cmos/db/cmos.sqlite`

---

## Prerequisites

**Before starting**:
1. **Location**: You must be at **project root** (not inside cmos/)
2. **Legacy system**: Have path to your legacy CMOS directory
3. **Backups**: Script creates automatic backups, but verify they exist
4. **Python**: Script uses Python 3.11+ with PyYAML installed

**Check your location**:
```bash
# You should be here:
pwd
# Should show: /path/to/your/project-root

# NOT here:
# /path/to/your/project-root/cmos  ❌
```

---

## Migration Process

### Step 1: Migrate Contexts & Sessions

Run the migration script from **project root**:

```bash
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy/cmos \
  --target cmos \
  --sync-db
```

**What this does**:
- Merges legacy PROJECT_CONTEXT.json → `cmos/PROJECT_CONTEXT.json`
- Merges legacy MASTER_CONTEXT.json → `cmos/context/MASTER_CONTEXT.json`
- Merges and deduplicates SESSIONS.jsonl → `cmos/SESSIONS.jsonl`
- Syncs everything to SQLite → `cmos/db/cmos.sqlite`
- Creates timestamped backups of existing files

**Flags explained**:
- `--source`: Path to your legacy CMOS directory
- `--target`: Where to write merged files (use `cmos` for current structure)
- `--sync-db`: Push merged data to SQLite database (recommended)
- `--dry-run`: Preview without writing (optional, test first)
- `--no-backup`: Skip backups (not recommended)

### Step 2: Import Full Backlog History into Database

Import ALL sprint history into SQLite (this is your permanent history store):

```bash
python cmos/scripts/seed_sqlite.py \
  --data-root /path/to/legacy/cmos
```

**What this does**:
- Reads complete `missions/backlog.yaml` from legacy system (all 20+ sprints)
- Parses sprints, missions, dependencies, and prompt mappings
- Imports EVERYTHING into `cmos/db/cmos.sqlite`
- **Database becomes your permanent history** - all sprints preserved forever

### Step 3: Export Minimal Working Backlog

Now create a clean, readable backlog with only current work:

```bash
./cmos/cli.py db export backlog \
  --output cmos/missions/backlog.yaml
```

**What this creates**:
- Fresh backlog.yaml exported from DB
- Contains ALL sprints initially

**Then manually edit** `cmos/missions/backlog.yaml` to keep only:
- Current sprint (in progress)
- Previous sprint (for context, optional)
- Next sprint (if planned, optional)

**Delete the other 17+ completed sprints from the YAML** - they're safely in the DB!

**Result**: 
- ✅ DB has complete history (20+ sprints)
- ✅ backlog.yaml is small and readable (3-5 sprints max)
- ✅ No duplication - DB is source of truth

### Step 4: Validate Migration

Verify everything migrated correctly:

```bash
# View current mission status
./cmos/cli.py db show current

# Inspect backlog in database
./cmos/cli.py db show backlog

# Check database health
sqlite3 cmos/db/cmos.sqlite "SELECT COUNT(*) as missions FROM missions"
```

**Expected results**:
- ✅ `show-backlog` displays your sprint history
- ✅ `show-current` shows active/recent missions
- ✅ Database query returns mission count
- ✅ Backup files exist with `.backup-TIMESTAMP` suffix

---

## Example: Migrating cmos.old.tracelab

Using the legacy system at `cmos.old.tracelab/`:

```bash
# Step 1: From project root, migrate contexts and sessions
python cmos/scripts/migrate_cmos_memory.py \
  --source cmos.old.tracelab \
  --target cmos \
  --sync-db

# Step 2: Import FULL backlog history into database
python cmos/scripts/seed_sqlite.py \
  --data-root cmos.old.tracelab

# Step 3: Export minimal working backlog
./cmos/cli.py db export backlog \
  --output cmos/missions/backlog.yaml

# Step 4: Edit backlog.yaml - keep only current/recent sprints
# Open cmos/missions/backlog.yaml and delete completed sprints
# Keep: Current sprint + maybe 1-2 adjacent sprints
# All history is safe in the DB!

# Step 5: Validate
./cmos/cli.py db show backlog
./cmos/cli.py db show current  # Shows FULL history from DB
```

**What you'll see**:
```
Migration complete.
Merged sessions written to cmos/SESSIONS.jsonl
Merged PROJECT_CONTEXT.json written to cmos/PROJECT_CONTEXT.json
Merged MASTER_CONTEXT.json written to cmos/context/MASTER_CONTEXT.json
Backups created alongside target files.
SQLite database synchronised at cmos/db/cmos.sqlite
```

---

## How Merging Works

### PROJECT_CONTEXT.json Merge Strategy
- **New system wins** for structure/schema
- **Legacy data fills gaps** where new system is empty
- **Working memory** gets merged (session counts, active missions)
- **Domains** are preserved from legacy if missing in new
- Adds `metadata.migrated_at` timestamp

### MASTER_CONTEXT.json Merge Strategy
- **Deep merge** - Nested objects and arrays are combined
- **Legacy insights preserved** - decisions_made, constraints, achievements
- **Deduplicates lists** - No duplicate entries in arrays
- **New system structure maintained**

### SESSIONS.jsonl Merge Strategy
- **Chronological ordering** - Sorted by timestamp
- **Deduplicates entries** - Same session+timestamp+summary = one entry
- **Both sources combined** - Legacy + current sessions merged
- **Preserves raw events** - Original JSONL kept in `__raw__` field

---

## Advanced Options

### Dry Run (Preview Changes)
```bash
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy \
  --target cmos \
  --dry-run
```
Shows what would be migrated without writing files.

### Files Only (Skip Database)
```bash
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy \
  --target cmos
  # Note: no --sync-db flag
```
Updates JSON and JSONL files but doesn't touch SQLite.

### Database Only (Skip Files)
```bash
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy \
  --target cmos \
  --skip-files \
  --sync-db
```
Updates SQLite directly without touching flat files.

### Migrate from Legacy SQLite
If your legacy system has a SQLite database:
```bash
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy \
  --target cmos \
  --source-db /path/to/legacy/db/cmos.sqlite \
  --sync-db
```
Reads contexts and sessions from legacy SQLite instead of flat files.

---

## Troubleshooting

### Error: "Cannot find cmos/ directory"
**Problem**: Script can't locate the cmos/ directory.

**Solution**: 
```bash
# Make sure you're at project root
cd /path/to/project-root

# Verify cmos/ exists
ls -la cmos/db/schema.sql
ls -la cmos/agents.md

# These files must exist for auto-detection
```

### Error: "Could not locate PROJECT_CONTEXT.json"
**Problem**: Legacy system missing required files.

**Solution**:
```bash
# Check legacy system structure
ls -la /path/to/legacy/PROJECT_CONTEXT.json
ls -la /path/to/legacy/context/MASTER_CONTEXT.json
ls -la /path/to/legacy/SESSIONS.jsonl

# At minimum, PROJECT_CONTEXT.json must exist
```

### Error: "PyYAML is required"
**Problem**: Missing Python dependency.

**Solution**:
```bash
pip install PyYAML
```

### Database Shows Unexpected Data
**Problem**: Database doesn't match what you expect.

**Solution**:
```bash
# Re-import from legacy source
python cmos/scripts/seed_sqlite.py --data-root /path/to/legacy

# Or re-run migration
python cmos/scripts/migrate_cmos_memory.py \
  --source /path/to/legacy \
  --target cmos \
  --sync-db
```

### Sessions Appear Duplicated
**Problem**: Same sessions showing multiple times.

**Solution**: The script deduplicates by `(session_id, timestamp, type, summary)`. If these differ slightly, they'll appear as separate entries. This is expected - review and manually clean if needed.

---

## Post-Migration Checklist

- [ ] Backups exist (`.backup-TIMESTAMP` files created)
- [ ] `./cmos/cli.py db show backlog` shows sprint history
- [ ] `./cmos/cli.py db show current` shows recent missions
- [ ] Database query works: `sqlite3 cmos/db/cmos.sqlite "SELECT COUNT(*) FROM missions"`
- [ ] Export contexts works: `./cmos/cli.py db export contexts`
- [ ] Export backlog works: `./cmos/cli.py db export backlog`
- [ ] Test running a mission with new context loaded

---

## Working with an Agent

When migrating with AI assistance:

1. **Share paths**: Tell agent where legacy system is located
2. **Run from project root**: Agent should execute all commands from project root
3. **Review output**: Check what agent shows you after each step
4. **Validate together**: Review backlog, contexts, and sessions together
5. **Keep backups**: Don't delete legacy system until confident migration worked

**Example prompt for agent**:
```
I need to migrate from my legacy CMOS at cmos.old.<project_name>
into the current cmos/ system. We're at project root. 
Please run the migration script with --sync-db, 
then import the backlog, and validate everything worked.
```

---

## Rollback Procedure

If migration didn't work as expected:

```bash
# 1. Restore from automatic backups
cd cmos
mv PROJECT_CONTEXT.json.backup-TIMESTAMP PROJECT_CONTEXT.json
mv context/MASTER_CONTEXT.json.backup-TIMESTAMP context/MASTER_CONTEXT.json
mv SESSIONS.jsonl.backup-TIMESTAMP SESSIONS.jsonl

# 2. Re-seed database from restored files
python cmos/scripts/seed_sqlite.py --root cmos

# 3. Validate
./cmos/cli.py validate health
```

---

## File Locations Quick Reference

### Legacy System Structure (what we're migrating FROM):
```
/path/to/legacy/
├── PROJECT_CONTEXT.json       ← Project info, working memory
├── context/
│   └── MASTER_CONTEXT.json    ← History, decisions, constraints
├── SESSIONS.jsonl              ← Session events
└── missions/
    └── backlog.yaml            ← Sprint history, missions
```

### Current System Structure (what we're migrating TO):
```
project-root/
└── cmos/
    ├── PROJECT_CONTEXT.json        ← Merged here
    ├── context/
    │   └── MASTER_CONTEXT.json     ← Merged here
    ├── SESSIONS.jsonl              ← Merged here
    ├── db/
    │   └── cmos.sqlite             ← Everything synced here
    └── missions/
        └── backlog.yaml            ← Imported here
```

---

## Next Steps After Migration

1. **Review contexts**: Check merged PROJECT_CONTEXT.json and MASTER_CONTEXT.json for accuracy
2. **Update agents.md**: Ensure `cmos/agents.md` reflects current project state
3. **Test a mission**: Run through a simple mission to validate system works
4. **Archive legacy**: Once confident, archive (don't delete) legacy system
5. **Continue work**: Resume using current CMOS with full history preserved

---

**Last Updated**: 2025-11-08  
**CMOS Version**: 2.0 (SQLite-first architecture)  
**Migration Script**: `cmos/scripts/migrate_cmos_memory.py`

