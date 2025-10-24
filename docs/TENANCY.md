# Multi-Tenancy Architecture

**Status**: v1.1 — Implemented in Sprint 17  
**Last Updated**: 2025-10-24

---

## Overview

OODS Foundry supports a **bridge tenancy** strategy that lets us start cost-efficient in pooled mode while offering crisp upgrade paths to isolated deployments. All modes are **explicitly configured** and flow through a common runtime so that guards, audit, and compliance stay consistent.

Research references: Direction Check §26, Industry Research R1.4 (§84-108), Subscription/Billing R13.5.

---

## Architecture At A Glance

```mermaid
flowchart LR
    Request -->|Tenant Resolver| TenantContext
    TenantContext -->|shared-schema| SharedDB[(Postgres Schema: public)]
    TenantContext -->|schema-per-tenant| SchemaRouter[(Postgres)]
    TenantContext -->|external-adapter| ExternalPool[(Tenant DB Pool)]
    SharedDB --> AuditLog
    SchemaRouter --> AuditLog
    ExternalPool --> AuditLog
    AuditLog --> Monitoring
```

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Gateway
    participant Service
    participant TenantContext
    participant Adapter
    Client->>API Gateway: HTTP request (headers / host / JWT)
    API Gateway->>Service: Forward request
    Service->>TenantContext: withTenantContext(tenantId, fn)
    TenantContext->>Adapter: resolve adapter for mode
    Adapter->>DB: scoped query / schema switch / dedicated connection
    Adapter-->>TenantContext: results
    TenantContext-->>Service: result
    Service-->>Client: response
```

---

## Tenancy Modes

### 1. `shared-schema` (Default)
- **Use when**: SMB & pooled SaaS
- **Isolation**: Row-Level Security inside a single schema
- **Scaling**: read replicas, connection pool tuning
- **Runbook**:
  1. Provision tenant row in `tenants`
  2. Enable RLS on all tenant tables
  3. Monitor `pg_stat_activity` for noisy neighbours

```sql
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

---

### 2. `schema-per-tenant`
- **Use when**: Enterprise customers requesting logical isolation
- **Isolation**: Dedicated PostgreSQL schema (`tenant_<slug>`)
- **Scaling**: ensure connection pool size ≥ active tenants
- **Runbook**:
  1. `CREATE SCHEMA tenant_<slug>`
  2. Apply migrations with schema override
  3. Rotate schema credentials with per-tenant secrets

```sql
CREATE SCHEMA tenant_abc123;
SET search_path = tenant_abc123, public;
```

---

### 3. `external-adapter`
- **Use when**: Regulated customers, BYO database, residency split
- **Isolation**: Dedicated database per tenant (region aware)
- **Runbook**:
  1. Provision DB (cloud API / Terraform)
  2. Apply full migration suite
  3. Add entry to `tenant-databases.json`
  4. Restart services to refresh adapter pool

```typescript
const context = TenancyContext.create('tenant-charlie');
await context.withTenant(async (db) => {
  return db.query('SELECT * FROM subscriptions');
});
```

---

## Configuration

### Environment Variables

```bash
OODS_TENANCY_MODE=shared-schema          # or schema-per-tenant | external-adapter
OODS_TENANT_RESOLVER=subdomain           # header | jwt-claim | path-prefix
DATABASE_URL=postgresql://user:pass@localhost:5432/oods_foundry
TENANT_CONFIG_PATH=configs/tenant-databases.json
OODS_STRICT_ISOLATION=true               # fail fast when no tenant context
OODS_FALLBACK_TENANT_ID=0000-...-0001    # only when strict isolation disabled
```

Runtime validation lives in `configs/tenancy.ts` using Zod schemas.

### Tenant Registry Template

`configs/tenant-databases.json` (default path) encodes dedicated database metadata:

```json
[
  {
    "tenantId": "tenant-alice",
    "displayName": "Alice Corp",
    "host": "alice.db.internal",
    "port": 5432,
    "database": "oods_alice",
    "username": "alice_svc",
    "sslMode": "disable",
    "region": "us-east-1",
    "residency": "US",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

You can also inject `externalTenants` directly into the config object for testing.

---

## Runtime Helpers

### TenancyContext API

```typescript
import {
  TenancyContext,
  withTenantContext,
} from '@/services/tenancy/tenancy-context';

const context = TenancyContext.create('tenant-alice');

await context.withTenant(async (adapter) => {
  const conn = await adapter.getConnection();
  return conn.query('SELECT * FROM subscriptions');
});

const ref = TenancyContext.getCurrentTenant(); // → TenantRef | null
ref?.tenantId;       // string
ref?.displayName;    // optional registry metadata

TenancyContext.requireCurrentTenantId(); // throws when context missing
```

- Uses `AsyncLocalStorage` to isolate concurrent requests
- Provides `withTenant`, `withTenantSync`, and functional helper `withTenantContext`
- Decorator `@RequiresTenant()` guards service methods

### Tenant Resolvers

`TenantResolver.createDefault()` chains header → subdomain → JWT claim strategies. Custom resolvers can be composed for bespoke routing.

### Database Adapters

| Adapter             | Isolation Mechanism            | Notes                                     |
| ------------------- | ------------------------------ | ----------------------------------------- |
| `SharedSchemaAdapter`   | RLS filter `tenant_id`         | Auto-rewrites queries with tenant filter  |
| `SchemaPerTenantAdapter`| `SET search_path=tenant_<id>` | Keeps per-tenant schema migrations        |
| `ExternalAdapter`       | Dedicated DB connection pool  | Loads registry from `TENANT_CONFIG_PATH`  |

---

## Seeds & Tests

- `pnpm tenancy:seed` ⇒ seeds current mode
- `OODS_TENANCY_MODE=external-adapter pnpm tenancy:seed` ⇒ seeds dedicated DBs using registry

Test harness (`tests/tenancy/`):
- `shared.spec.ts` — pooled mode isolation & query rewriting
- `isolated.spec.ts` — schema-per-tenant switching + migrations
- `external.spec.ts` — registry metadata, fail-fast on missing config

`pnpm tenancy:test` runs all suites once.  
`pnpm tenancy:check` (see CI) executes the matrix across all three modes.

---

## Migration Playbooks

### SMB → Schema-Per-Tenant Upgrade
1. `CREATE SCHEMA tenant_<slug>`
2. Copy data:
   ```sql
   INSERT INTO tenant_abc123.subscriptions
   SELECT id, status, created_at
   FROM public.subscriptions
   WHERE tenant_id = 'tenant-abc123';
   ```
3. Switch feature flag / resolver to new mode
4. Monitor for 24h, then delete legacy rows

### Schema → External Adapter
1. Provision new tenant database in target region
2. Run full migration suite
3. Update `tenant-databases.json`
4. Restart services (adapter reload)
5. Backfill warehouse integration

---

## Operational Runbooks

- **RLS Drift Detection**: nightly `tenancy:check` run in pooled mode ensures filters stay intact.
- **Schema Drift**: `SchemaPerTenantAdapter` exposes `seedMockData` hooks used by e2e tests; production should run per-tenant migration audits.
- **Emergency Tenant Freeze**: set feature flag to block tenant, rotate credentials in registry, rerun `tenancy:check` to confirm isolation.

---

## CI Guardrails

`ci.yml` (`tenancy-matrix` job) runs `pnpm tenancy:check` across `shared-schema`, `schema-per-tenant`, and `external-adapter`. Failing any mode blocks merge to main.

---

## Compliance & Security

- **Audit Logging**: All adapters enforce `tenantId` in audit trail metadata; cross-tenant actions flagged.
- **Data Residency**: Registry records include `region`/`residency`; external adapter reads them into `TenantRef.metadata`.
- **Secrets Handling**: Credentials stored encrypted in production (placeholder values in registry file).

---

## Appendix: Decision Log

| Date       | Decision                                          | Rationale                                        |
| ---------- | ------------------------------------------------- | ------------------------------------------------ |
| 2025-10-24 | Default to `shared-schema` for SMB onboarding     | Lowest cost, fastest provisioning                |
| 2025-10-24 | Expose `OODS_TENANCY_MODE`                       | Avoid implicit behaviour, enable matrix testing  |
| 2025-10-24 | Require RLS in pooled mode                        | Defense-in-depth against code regressions        |
| 2025-10-24 | Support external registry for dedicated adapters  | Sets up residency compliance and billing ACL     |

---

## References

- `configs/tenancy.ts`
- `configs/tenant-databases.json`
- `src/services/tenancy/tenancy-context.ts`
- `tests/tenancy/*.spec.ts`
- `scripts/tenancy/seed.ts` / `scripts/tenancy/check.ts`
