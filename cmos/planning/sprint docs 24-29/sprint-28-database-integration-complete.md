# Sprint 28 Database Integration Complete

**Date:** 2025-11-19
**Status:** ✅ COMPLETE - All missions have YAML file references in database

---

## Problem Solved

**Issue:** Database mission records contained only summary info (100-200 chars). Rich implementation details (100-550 lines) were in YAML files, but agents might not know to read them.

**Solution:**
1. ✅ Added explicit YAML file references to database mission `notes` field
2. ✅ Added `yaml_file` path to mission `metadata`
3. ✅ Updated `cmos/agents.md` with **CRITICAL** instructions to read YAML files
4. ✅ Re-exported `backlog.yaml` with updated references

---

## Database Updates

### Mission Notes Format

Each Sprint 28 mission now has a `notes` field with this format:

```
📋 FULL MISSION DETAILS: Read cmos/missions/B28.X-mission-name.yaml
for comprehensive implementation guidance (XXX lines). Includes:
research findings with citations, concrete deliverables, scaffolding
reuse maps, quality gates, examples, and success criteria.
```

### Mission Metadata

Each mission's `metadata` now includes:

```python
{
    'yaml_file': 'cmos/missions/B28.X-mission-name.yaml',
    'instruction': 'Read the YAML file for complete implementation details',
    # ... other metadata
}
```

### Verification

```bash
# View mission with YAML reference
./cmos/cli.py db show backlog | grep -A 5 "B28.1"

# Output shows:
# - B28.1: Authable trait & schema registry [Queued]
#     notes: 📋 FULL MISSION DETAILS: Read cmos/missions/B28.1-authable-trait-enriched.yaml...
```

---

## agents.md Updates

Added new section **"Reading Mission Details"** with:

### Key Points

1. **CRITICAL instruction**: "Mission database records contain summary information only. For complete implementation guidance, **ALWAYS read the mission YAML file**"

2. **Example workflow** showing how to:
   - Fetch mission from database
   - Extract YAML file path from notes
   - Read YAML for comprehensive details

3. **Clear comparison table**:
   - **Database**: Summary, status, basic metadata (100-200 chars)
   - **YAML file**: Full implementation guide (100-550 lines)

4. **What YAML files provide**:
   - Research findings with explicit citations
   - Concrete deliverables list (10-20+ files)
   - Scaffolding reuse maps
   - Quality gates (progressive validation)
   - SQL/code examples
   - Success criteria with measurable validation

---

## Sprint 28 Mission YAML Files

All 8 missions + 1 research spike have comprehensive YAML files:

| Mission | YAML File | Lines | Content Highlights |
|---------|-----------|-------|-------------------|
| **R28.1** | `R28.1-sod-constraint-patterns.yaml` | 460 | Research spike, deliverables, methodology |
| **B28.1** | `B28.1-authable-trait-enriched.yaml` | 363 | R21.2 citations, 20+ deliverables, scaffolding map |
| **B28.2** | `B28.2-rbac-database-foundations.yaml` | 541 | 8 migrations, complete DDL, rollback procedures |
| **B28.3** | `B28.3-role-graph-entitlement-runtime.yaml` | 107 | Recursive CTE, <5ms targets, caching integration |
| **B28.4** | `B28.4-sod-policy-builder.yaml` | 144 | Policy API, validator, R28.1 test cases |
| **B28.5** | `B28.5-permission-cache-guardrails.yaml` | 134 | Redis adapter, warmers, >80% hit rate |
| **B28.6** | `B28.6-role-matrix-ui.yaml` | 165 | 4 React components, a11y, Storybook |
| **B28.7** | `B28.7-trait-integration-entitlement-export.yaml` | 145 | User/Org composition, export CLI |
| **B28.8** | `B28.8-sprint-closeout.yaml` | 110 | Retrospective, contexts, Sprint 29 prep |

**Total:** 2,169 lines of comprehensive implementation guidance

---

## Verification Commands

### 1. Check Database Mission

```python
python3 << 'EOF'
from cmos.context.db_client import SQLiteClient

client = SQLiteClient("cmos/db/cmos.sqlite", create_missing=False)
mission = client.fetchone("SELECT id, name, notes, metadata FROM missions WHERE id = ?", ("B28.1",))

print(f"Mission: {mission['id']}")
print(f"Notes: {mission['notes'][:100]}...")  # First 100 chars
print(f"YAML file in metadata: {eval(mission['metadata']).get('yaml_file')}")

client.close()
EOF
```

**Expected output:**
```
Mission: B28.1
Notes: 📋 FULL MISSION DETAILS: Read cmos/missions/B28.1-authable-trait-enriched.yaml for comprehe...
YAML file in metadata: cmos/missions/B28.1-authable-trait-enriched.yaml
```

### 2. Check Backlog Export

```bash
./cmos/cli.py db export backlog
grep -A 3 "B28.1" cmos/missions/backlog.yaml
```

**Expected output:**
```yaml
- id: B28.1
  name: Authable trait & schema registry
  status: Queued
  notes: "📋 FULL MISSION DETAILS: Read cmos/missions/B28.1-authable-trait-enriched.yaml..."
```

### 3. Check agents.md

```bash
grep -A 5 "CRITICAL.*read the mission YAML" cmos/agents.md
```

**Expected output:**
```markdown
**CRITICAL**: Mission database records contain summary information only. For complete implementation guidance, **ALWAYS read the mission YAML file** specified in the mission's `notes` field or `metadata.yaml_file`.
```

---

## Agent Workflow (Post-Fix)

### Before (Risk of Missing Details)

```python
mission = next_mission()
# Agent sees: "B28.1 - Authable trait & schema registry"
# Might miss: R21.2 citations, scaffolding map, 20+ deliverables
# Result: Incomplete implementation
```

### After (Full Context Guaranteed)

```python
mission = next_mission()
# Agent sees: "📋 FULL MISSION DETAILS: Read cmos/missions/B28.1-authable-trait-enriched.yaml..."
# Agent knows: Must read YAML file (explicitly stated in agents.md)
# Agent reads: 363 lines of comprehensive guidance
# Result: Complete, research-backed implementation
```

---

## Files Modified

1. **Database** (`cmos/db/cmos.sqlite`):
   - Updated 8 missions with `notes` field
   - Updated 8 missions with `metadata.yaml_file`

2. **Backlog** (`cmos/missions/backlog.yaml`):
   - Re-exported with updated mission notes
   - Shows YAML references for all Sprint 28 missions

3. **Agent Instructions** (`cmos/agents.md`):
   - Added "Reading Mission Details" section (40 lines)
   - **CRITICAL** instruction to read YAML files
   - Example workflow for agents
   - Database vs YAML comparison table

4. **Seed Script** (`cmos/scripts/seed_sprint_28.py`):
   - Updated to include YAML file references
   - Available for future sprints

---

## Benefits

### For Agents
✅ **Clear instructions**: agents.md explicitly says "ALWAYS read the mission YAML file"
✅ **Easy discovery**: YAML path in both `notes` and `metadata.yaml_file`
✅ **Comprehensive context**: 100-550 lines per mission vs 100-200 chars in DB
✅ **Research citations**: Direct links to R21.2, R28.1 findings
✅ **Concrete deliverables**: 10-20+ specific files with requirements

### For Quality
✅ **Scaffolding reuse**: Explicit maps (Preferenceable → Authable)
✅ **Quality gates**: Progressive validation (not backloaded)
✅ **Success criteria**: Measurable with validation methods
✅ **Examples**: SQL DDL, code patterns, integration examples

### For Consistency
✅ **Single pattern**: All future sprints can follow this approach
✅ **Scalable**: Works for any mission complexity
✅ **Auditable**: YAML files are version-controlled, reviewable

---

## Next Steps

### For Sprint 28 Execution

```bash
# 1. Verify setup
./cmos/cli.py db show current

# 2. Start B28.1 (agent will read YAML file per agents.md instructions)
python3 -c "from cmos.context.mission_runtime import next_mission, start; m = next_mission(); start(m['id'], agent='assistant', summary='Starting Authable trait foundation')"

# 3. Agent workflow:
#    a. Fetch mission from DB (gets notes with YAML reference)
#    b. Read cmos/agents.md (sees CRITICAL instruction)
#    c. Read cmos/missions/B28.1-authable-trait-enriched.yaml (363 lines)
#    d. Implement with full context
```

### For Future Sprints

1. Create comprehensive YAML files (100-500 lines)
2. Seed database with YAML file reference in notes
3. Export backlog
4. Agents automatically follow agents.md instructions to read YAML

---

## Summary

**Problem:** Database had minimal mission info; YAML files had rich details but might be missed
**Solution:** Explicit YAML references in database + CRITICAL instructions in agents.md
**Result:** Agents have clear workflow to get comprehensive implementation guidance

**Sprint 28 is now fully prepared with guaranteed agent access to all implementation details! 🎉**
