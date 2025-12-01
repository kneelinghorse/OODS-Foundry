# Troubleshooting: Context Loading Issues

**Issue:** Agent reports "SQLite still lacks PROJECT_CONTEXT and MASTER_CONTEXT"  
**Reality:** Contexts exist and load successfully  
**Root cause:** Path or initialization issue in agent session

---

## ✅ **Verified: Contexts Exist**

**Database check:**
```
cmos/db/cmos.sqlite (9.9MB)
├─ project_context: 45,224 bytes ✅
└─ master_context: 56,695 bytes ✅

Both contexts load successfully via:
- SQLiteClient (direct)
- MissionRuntime (indirect)
- Both create_missing=True and create_missing=False
```

---

## 🔍 **Likely Causes**

### **1. Working Directory Issue (Most Likely)**

**Problem:** Agent running from wrong directory  
**Symptom:** Relative path 'cmos/db/cmos.sqlite' resolves to wrong location

**Check:**
```bash
pwd
# Should show: /Users/systemsystems/portfolio/OODS-Foundry
# NOT: /Users/systemsystems/portfolio/OODS-Foundry/cmos
```

**Fix:**
```python
# In agent prompt, explicitly state:
"Working directory: /Users/systemsystems/portfolio/OODS-Foundry (project root)"
"Database path: cmos/db/cmos.sqlite (relative to project root)"
```

---

### **2. Database Path Issue**

**Problem:** Agent using wrong database file

**Possibilities:**
- Using `cmos-old.sqlite` instead of `cmos.sqlite`
- Absolute vs relative path confusion
- create_missing=True creating new empty database

**Check:**
```python
# Print actual path being used
client = SQLiteClient("cmos/db/cmos.sqlite")
print(f"Database path: {client.db_path}")
```

**Fix:**
```python
# Use absolute path if needed
import os
db_path = os.path.join(os.getcwd(), "cmos/db/cmos.sqlite")
client = SQLiteClient(db_path, create_missing=False)
```

---

### **3. Initialization Flag Issue**

**Problem:** Using `create_missing=True` with wrong path creates empty database

**Check:**
```python
# If create_missing=True and path wrong, new empty DB created
client = SQLiteClient("wrong/path/cmos.sqlite", create_missing=True)
# ❌ Creates new empty database, no contexts!
```

**Fix:**
```python
# Always use create_missing=False in mission code
client = SQLiteClient("cmos/db/cmos.sqlite", create_missing=False)
# ✅ Fails if database doesn't exist (safer)
```

---

## 🎯 **Recommended Agent Prompt Pattern**

**For Sprint 27 missions, include in prompt:**

```markdown
## Context Loading (Critical)

**Working Directory:** /Users/systemsystems/portfolio/OODS-Foundry (project root)
**Database:** cmos/db/cmos.sqlite (relative to project root)

**Load contexts:**
```python
import sys
sys.path.insert(0, 'cmos')
from context.db_client import SQLiteClient

# Verify working directory
import os
print(f"Working directory: {os.getcwd()}")
# Should show: /Users/systemsystems/portfolio/OODS-Foundry

# Load contexts
client = SQLiteClient("cmos/db/cmos.sqlite", create_missing=False)
project = client.get_context("project_context")
master = client.get_context("master_context")

if not project or not master:
    raise RuntimeError("Contexts missing - check working directory")

print(f"✅ Contexts loaded")
print(f"   project_context keys: {list(project.keys())[:5]}")
print(f"   master_context decisions: {len(master.get('decisions_made', []))}")

client.close()
```

**Alternative (using MissionRuntime):**
```python
from context.mission_runtime import MissionRuntime

runtime = MissionRuntime()
runtime.ensure_database()  # Validates database accessible

# Contexts loaded automatically by start(), complete(), etc.
```

---

## 🔧 **Quick Verification Script**

**Run this to verify contexts accessible:**

```bash
cd /Users/systemsystems/portfolio/OODS-Foundry
python3 << 'EOF'
import sys
sys.path.insert(0, 'cmos')
from context.db_client import SQLiteClient

client = SQLiteClient("cmos/db/cmos.sqlite", create_missing=False)
master = client.get_context("master_context")

if master:
    print("✅ CONTEXTS WORKING")
    print(f"   Decisions: {len(master.get('decisions_made', []))}")
    print(f"   Roadmap: {list(master.get('roadmap', {}).keys())}")
else:
    print("❌ CONTEXTS MISSING")
    print("   Check working directory and database path")

client.close()
EOF
```

---

## 💡 **For Current Sprint 27 Session**

**If agent reports missing contexts:**

1. **Verify working directory:**
   ```bash
   pwd
   # Must be: /Users/systemsystems/portfolio/OODS-Foundry
   ```

2. **Use absolute path temporarily:**
   ```python
   client = SQLiteClient(
       "/Users/systemsystems/portfolio/OODS-Foundry/cmos/db/cmos.sqlite",
       create_missing=False
   )
   ```

3. **Check database health:**
   ```bash
   ./cmos/cli.py db show current
   # If this works, database is fine
   ```

---

## ✅ **Current Status**

**As of this check:**
- ✅ Database exists: cmos/db/cmos.sqlite (9.9MB)
- ✅ Contexts exist: project_context + master_context
- ✅ Contexts load: via SQLiteClient and MissionRuntime
- ✅ 174 snapshots captured
- ✅ 32 decisions tracked

**Contexts are NOT missing - this is a path/initialization issue in agent session.**

---

## 📋 **Action Items**

**For you:**
1. Check agent's working directory (pwd)
2. Verify agent using correct database path
3. Share agent's context loading code if issue persists

**For mission specs:**
- Consider adding explicit working directory to mission context
- Use absolute paths if relative paths problematic
- Add context validation step to mission start procedures

---

**The data is safe and accessible - this is a configuration issue, not data loss.**

