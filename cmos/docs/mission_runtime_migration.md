# Mission Runtime API Migration Guide

The mission runtime now exposes **flat helper functions** so common operations no longer require instantiating the `MissionRuntime` class. This guide explains how to update existing scripts and prompts.

## What Changed

- New helpers exported from `context/mission_runtime.py`: `next_mission`, `start`, `complete`, and `block`.
- Each helper auto-detects the `cmos/` directory, opens the SQLite database, and closes connections after the operation.
- `MissionRuntime` remains fully supported for advanced workflows (batched operations, custom telemetry, etc.). It now implements the context manager protocol for safer manual usage.

## New Helper Usage

```python
from context.mission_runtime import next_mission, start, complete, block

candidate = next_mission()

start(
    mission_id=candidate["id"],
    agent="codex",
    summary="Kicking off mission"
)

complete(
    mission_id=candidate["id"],
    agent="codex",
    summary="Work finished",
    notes="Implemented feature + tests"
)

# Optional block flow
block(
    mission_id=candidate["id"],
    agent="codex",
    summary="Waiting on inputs",
    reason="Need design review",
    needs=["Architecture sign-off"]
)
```

Pass `repo_root` or `db_path` when running outside the repository root:

```python
next_mission(repo_root="/opt/projects/cmos")
complete("B2.4", summary="done", notes="...", db_path="/tmp/db.sqlite")
```

## Migration Steps (Class → Helpers)

1. Replace `from context.mission_runtime import MissionRuntime` with helper imports.
2. Remove explicit instantiation/close calls. Each helper manages setup/teardown.
3. Keep class usage only when you need multiple operations on the same runtime instance. Use the new context manager form:
   ```python
   from context.mission_runtime import MissionRuntime

   with MissionRuntime() as runtime:
       runtime.ensure_database()
       runtime.start_mission(...)
       runtime.complete_mission(...)
   ```
4. Update prompts and docs to reference helper functions for clarity.

Following these steps ensures older scripts continue to work while newer flows take advantage of the streamlined API.
