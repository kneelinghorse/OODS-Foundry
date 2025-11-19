# Preference Schema Evolution

> Mission B27.3 deliverable — schema evolution playbook for the Preferenceable trait.

The Preferenceable trait now ships a dual-strategy migration engine:

- **Lazy read-repair** fills new optional fields on read without downtime.
- **Eager dual-write** orchestrates breaking changes with a zero-downtime switchover.

This guide explains when to use each strategy, how to execute migrations, and the
operational guardrails (version tracking, logging, and rollback).

## Strategy Matrix

| Change Type | Examples | Strategy | Runtime Impact |
|-------------|----------|----------|----------------|
| Add optional field, widen enum | `theme.highContrast`, new digest cadence | **Lazy read-repair** (`applyPreferenceReadRepair`) | Zero downtime; documents repaired as they are read |
| Rename/move field, tighten type | `notifications.channels` array → map, `theme` rename | **Eager dual-write** (`runDualWriteMigration`) | Writes land in legacy + next schema until cutover |

### Lazy Read-Repair

- Uses JSON Schema defaults + registry metadata to backfill missing fields.
- Validates compatibility with `analyzeSchemaCompatibility`. If the diff is
  breaking, the helper throws and instructs you to pick the eager path.
- Adds a `lazy` migration record via `recordPreferenceMigration` so we know which
  version wrote the defaults.
- Stores per-field change sets (`PreferenceMigrationChange`) so rollbacks can
  surgically remove injected data.

### Eager Dual-Write

- Loads registry migration plans (`PreferenceSchemaMigration`) and applies the
  declarative steps (array → map, mergers, new blocks, etc.).
- Returns two documents: `legacyDocument` (old schema) and `nextDocument`
  (target schema). Persist both during the dual-write window.
- Appends an `eager` migration record and surfaces the object-level change set to
  the logger + CLI.

## Version Tracking & Logging

- `src/traits/preferenceable/version-tracker.ts` centralises metadata updates.
  Every migration goes through `recordPreferenceMigration` (or
  `rollbackPreferenceVersion`).
- The `preferences.migration_log` table (see
  `database/migrations/20251118_preference_migration_log.sql`) records each
  per-user event with `strategy`, `status`, and the serialized change set.
- `PreferenceMigrationLogger` exports `JsonlMigrationLogWriter` (CLI friendly)
  and `InMemoryMigrationLogWriter` (unit tests). Swap in a custom writer that
  inserts rows into `preferences.migration_log` to wire telemetry end-to-end.

## CLI — `scripts/preferences/migrate-schema.ts`

```
# Apply migrations (auto mode picks lazy/backward vs eager/breaking)
scripts/preferences/migrate-schema.ts \
  --input data/preferences/documents.json \
  --output artifacts/preference-migrations.json \
  --log artifacts/preference-migrations.log

# Force eager strategy and pin target version
scripts/preferences/migrate-schema.ts \
  --input ./tmp/prefs.json --output ./tmp/prefs.v2.json \
  --strategy eager --to 2.0.0

# Roll back a previous run
scripts/preferences/migrate-schema.ts \
  --rollback --input artifacts/preference-migrations.json \
  --output artifacts/preference-migrations.rollback.json
```

### Artifact Structure

Each migration run produces an artifact that can be stored in diagnostics or fed
into rollback:

```json
{
  "version": 1,
  "generatedAt": "2025-11-19T02:30:00Z",
  "targetVersion": "2.0.0",
  "entries": [
    {
      "userId": "411ab800-...",
      "strategy": "eager",
      "fromVersion": "1.1.0",
      "toVersion": "2.0.0",
      "changeSet": [
        { "path": "preferences.notifications.channels", "from": ["email"], "to": { "email": {"enabled": true} } }
      ],
      "document": { ... },
      "legacyDocument": { ... }
    }
  ]
}
```

The rollback command consumes the artifact, reapplies the change set in reverse
(lazy) or restores the stored legacy document (eager), and emits a new artifact
with documents reset to the previous schema version.

## Operational Runbook

1. **Assess compatibility** — `analyzeSchemaCompatibility(from, to)`
   - Backward/identical → proceed with read-repair.
   - Breaking → stage dual-write migrator.
2. **Migrate** — Use the CLI with `--strategy auto` to process affected users.
3. **Verify** —
   - Run `pnpm test tests/traits/preferenceable/*.test.ts`.
   - Inspect `preferences.migration_log` (or the JSONL log) for failures.
4. **Cutover (eager only)** — Drop the legacy column/read path once V2-only
   reads succeed.
5. **Rollback (if needed)** — Re-run the CLI with `--rollback` pointing to the
   previous artifact. This leverages `rollbackPreferenceReadRepair` and the
   stored `legacyDocument` snapshots.

## Examples

- `examples/preferences/additive-migration.ts` — read-repair defaults for v1.1.
- `examples/preferences/breaking-migration.ts` — dual-write projection for v2.

Both examples can be executed with `tsx` for quick experimentation.
