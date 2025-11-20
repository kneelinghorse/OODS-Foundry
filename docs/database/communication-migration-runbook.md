# Communication Migration Runbook

This runbook governs B29.2 migrations that create the communication schema, delivery metadata, and supporting objects. It mirrors the RBAC workflow from Sprint 28 while using the dedicated CLI `pnpm tsx src/cli/communication-migrate.ts`.

## Pre-Migration Checklist
1. **Backups** – capture logical + PITR backups for the target database. Confirm `pg_dump` and WAL archiving succeeded within the last 4 hours.
2. **Replica lag** – ensure read replicas are <5s behind primary. Pause async consumers that depend on communication tables.
3. **Connection drain** – notify app owners, drain write traffic for 5 minutes to minimise lock contention.
4. **Environment variables** – export `COMMUNICATION_DATABASE_URL` or provide `--url` explicitly.
5. **Dry-run** – execute `pnpm tsx src/cli/communication-migrate.ts migrate --dry-run --url $URL` to review SQL ordering and ensure filesystem includes all nine migrations.

## Execution Steps
1. `pnpm tsx src/cli/communication-migrate.ts status --url $URL` – verify no prior runs and confirm schema objects absent.
2. `pnpm tsx src/cli/communication-migrate.ts migrate --url $URL` – runs migrations sequentially while recording checksums inside `communication.schema_migrations`.
3. `pnpm tsx src/cli/communication-migrate.ts status --url $URL` – confirm each migration displays `[x]` and that tables exist.
4. Seed sample data if required for smoke tests:
   - `pnpm tsx src/data/communication/seed-channels.ts --url $URL`
   - `pnpm tsx src/data/communication/seed-templates.ts --url $URL`
   - `pnpm tsx src/data/communication/seed-policies.ts --url $URL`
5. Run validation queries described below before re-enabling the application tier.

## Rollback Procedures
The CLI supports step-wise rollback plus a full reset.

- **Single step rollback** – `pnpm tsx src/cli/communication-migrate.ts rollback --url $URL`
  - Drops the most recent table set using the mirrored rollback SQL.
  - Removes the related entry from `communication.schema_migrations`.

- **Full reset** – `pnpm tsx src/cli/communication-migrate.ts reset --url $URL`
  - Runs every rollback file (participants → schema) then reapplies all migrations.
  - Use when you need a clean slate for QA/UAT cycles.

After rollback, rerun `status` to confirm `[ ]` for all migrations and `communication.*` tables are absent.

## Post-Migration Validation
1. **Structural checks**
   ```sql
   SELECT to_regclass('communication.messages') AS messages,
          to_regclass('communication.delivery_attempts') AS delivery_attempts,
          to_regclass('communication.message_recipients') AS recipients;
   ```
   Expect non-null results for every object.

2. **Index verification**
   ```sql
   SELECT to_regclass('communication.idx_recipients_user') AS unread_idx,
          to_regclass('communication.idx_delivery_status_scheduled') AS queue_idx;
   ```
   Both indexes must exist; otherwise rerun migrations.

3. **Foreign-key health**
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE connamespace = 'communication'::regnamespace
     AND contype = 'f';
   ```
   Ensure references to `core.users` and `core.organizations` are present.

4. **Smoke seeds** – insert a sample message using the seed scripts, then query unread inbox results to prove indexes operate correctly.

## Troubleshooting
| Symptom | Resolution |
|---------|------------|
| `ERROR: relation "core.users" does not exist` | Create stub `core.users`/`core.organizations` tables in the integration environment before running the CLI. Production already contains them. |
| `duplicate key value violates unique constraint communication.schema_migrations_pkey` | Schema already migrated. Run `status` and skip or call `reset` if a clean re-run is required. |
| `CHECK constraint "templates_body_covers_variables" is violated` | Body text is missing `{{variable}}` tokens. Update template body or adjust the `variables` JSON array. |
| `timeout on idx_delivery_status_scheduled` | Index creation was cancelled mid-run. Execute `pnpm tsx src/cli/communication-migrate.ts rollback --url $URL` followed by `migrate` to rerun idempotently. |

## References
- R20.1 Part 3.2 — Delivery lifecycle guarantees (states + retries)
- R20.6 Part 2.1 — Message storage and metadata requirements
- Sprint 28 Runbook (`docs/database/authz-migration-runbook.md`) for shared operational posture
