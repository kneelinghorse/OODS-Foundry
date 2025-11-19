# Authorization Migration Runbook

This runbook explains how to execute and verify the Authorization Extension Pack migrations
introduced in Sprint 28 (Mission B28.2). The workflow assumes PostgreSQL 14+, access to the
`core` schema (users + organizations), and the new CLI utilities checked into `src/cli`.

## Prerequisites

- `DATABASE_URL` or `AUTHZ_DATABASE_URL` must point to the target cluster.
- Ensure the `core.users` and `core.organizations` tables already exist. The migration runner
  validates these references before touching the authz schema.
- Run migrations from the repository root so relative paths resolve correctly.

## Running Migrations

```bash
# Preview connection + FK readiness
pnpm tsx src/cli/authz-migrate.ts status --url "$DATABASE_URL"

# Apply all authz migrations
pnpm tsx src/cli/authz-migrate.ts migrate --url "$DATABASE_URL"
```

The runner streams each SQL file in lexicographic order:

1. Create `authz` schema + `pgcrypto`
2. Roles, permissions, role_permissions
3. Memberships + indexes
4. Role hierarchy
5. SoD tables + trigger

A success message is printed after all files commit. If a step fails, fix the issue, then rerun;
the SQL scripts are idempotent via `IF NOT EXISTS` safeguards.

## Seeding Default Data

```bash
# Run everything (roles + permissions + bindings)
pnpm tsx src/cli/authz-seed.ts seed-all --url "$DATABASE_URL"

# Dry-run preview
pnpm tsx src/cli/authz-seed.ts seed-all --dry-run
```

Each command validates the static datasets using the Zod schemas from B28.1 before inserting data.
`ON CONFLICT DO NOTHING` keeps operations idempotent, so the runbook can be repeated safely.

## Rollback Procedures

1. Drop only the SoD trigger if needed:
   ```bash
   pnpm tsx src/cli/authz-migrate.ts rollback --url "$DATABASE_URL"
   ```
   The rollback directory executes scripts in reverse order: trigger removal first, then the
   schema drop (which cascades through all authz tables).

2. **Destructive:** To fully remove the schema, confirm no other sprint depends on these tables
   and that an ops ticket authorizes the drop.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `Cannot find required foreign table core.users` | Core schema not present or using different namespace; create compat views or update FK references. |
| `SoD violation: ...` during seeding | Seed script attempted to assign conflicting roles. Inspect `authz.sod_role_conflicts` data before rerunning. |
| `permission denied for schema core` | Ensure migration role has `USAGE` + `REFERENCES` on `core`. |
| `cannot drop schema authz because other objects depend on it` | Additional objects were created manually. Drop dependent objects then rerun rollback. |

## Validation Checklist

- Run `pnpm tsx src/cli/authz-migrate.ts status --url "$DATABASE_URL"` and confirm all tables/indexes show `[x]`.
- Execute the seed tests locally: `pnpm vitest run tests/database/authz-seeds.test.ts`.
- Capture `pg_dump --schema-only --schema=authz` to archive the deployed DDL alongside the release.

Following this runbook keeps the authorization schema synchronized between dev, staging, and prod
and provides clear rollback levers aligned with the mission success criteria.
