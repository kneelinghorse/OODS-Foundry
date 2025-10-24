# Multi-Tenancy Implementation Guide

**Status**: ✅ Completed (Sprint 17, Mission B17.2)  
**Last Updated**: 2025-10-24

📚 For the full architecture guide with diagrams and migration runbooks, see [`Docs/TENANCY.md`](../../Docs/TENANCY.md).

## Quick Start

### 1. Configure Tenancy Mode

```bash
# Environment variables
export OODS_TENANCY_MODE=shared-schema  # or 'schema-per-tenant' | 'external-adapter'
export DATABASE_URL=postgresql://localhost:5432/oods_foundry
export OODS_STRICT_ISOLATION=true
export TENANT_CONFIG_PATH=configs/tenant-databases.json
```

### 2. Seed Test Tenants

```bash
pnpm tenancy:seed
```

This provisions 3 test tenants:
- **tenant-alice** (Alice Corp): 2 users, 2 subscriptions
- **tenant-bob** (Bob Industries): 1 user, 1 subscription  
- **tenant-charlie** (Charlie Enterprises): 3 users, 2 subscriptions

### 3. Run Isolation Tests

```bash
# Test current mode
pnpm tenancy:test

# Test all modes (matrix)
pnpm tenancy:check
```

---

## Core Concepts

### TenancyContext

All data access must flow through `TenancyContext`:

```typescript
import { TenancyContext } from '@/services/tenancy';

// Create tenant context
const context = TenancyContext.create('tenant-alice');

// Execute with tenant scoping
const subscriptions = await context.withTenant(async (adapter) => {
  const conn = await adapter.getConnection();
  return conn.query('SELECT * FROM subscriptions');
});
```

### Tenant Resolvers

Extract tenant ID from HTTP requests:

```typescript
import { TenantResolver } from '@/services/tenancy';

// Composite resolver (tries multiple strategies)
const resolver = TenantResolver.createDefault();

const result = resolver.resolve({
  headers: { 'x-tenant-id': 'tenant-abc' },
  hostname: 'tenant-abc.oods.app',
});

console.log(result.tenantId); // 'tenant-abc'
```

### Database Adapters

Mode-specific isolation:

```typescript
// Shared-schema: adds WHERE tenant_id = 'xxx'
const sharedAdapter = new SharedSchemaAdapter(config);

// Schema-per-tenant: uses SET search_path = tenant_xxx
const schemaAdapter = new SchemaPerTenantAdapter(config);
```

---

## Architecture Patterns

### Shared-Schema (Default)
- **Best for**: SMB SaaS, high-volume multi-tenant
- **Isolation**: Row-level security (RLS)
- **Cost**: Low (single database)

### Schema-Per-Tenant
- **Best for**: Enterprise customers requiring logical isolation
- **Isolation**: PostgreSQL schemas
- **Cost**: Medium (connection pool overhead)

### External-Adapter
- **Best for**: BYOD enterprise, data residency requirements
- **Isolation**: Separate databases per tenant
- **Cost**: High (N databases to maintain)

---

## Integration Examples

### With RBAC Service

```typescript
import { getRBACService } from '@/services/compliance/rbac-service';
import { TenancyContext } from '@/services/tenancy';

const rbac = getRBACService();
const context = TenancyContext.create('tenant-alice');

const allowed = await context.withTenant(async () => {
  return rbac.checkPermission(
    'user-123',
    'subscription:sub_456',
    'pause',
    TenancyContext.requireCurrentTenantId()
  );
});
```

### With Audit Service

```typescript
import { getAuditLogService } from '@/services/compliance/audit-service';
import { TenancyContext } from '@/services/tenancy';

const audit = getAuditLogService();
const context = TenancyContext.create('tenant-bob');

await context.withTenant(async () => {
  await audit.logEvent({
    userId: 'user-789',
    tenantId: TenancyContext.requireCurrentTenantId(),
    action: 'subscription.pause',
    resourceRef: 'subscription:sub_101',
    severity: 'info',
  });
});
```

---

## Testing

### Unit Tests

```typescript
import { TenancyContext } from '@/services/tenancy';

const context = TenancyContext.create('tenant-test');

await context.withTenant(async (adapter) => {
  // Your test code here
  expect(TenancyContext.getCurrentTenantId()).toBe('tenant-test');
});
```

### Integration Tests

See `tests/tenancy/shared.spec.ts`, `tests/tenancy/isolated.spec.ts`, and `tests/tenancy/external.spec.ts` for examples:
- Cross-tenant isolation
- Transaction handling
- Concurrent access
- Error scenarios

---

## Migration Playbook

### SMB → Enterprise (shared → schema-per-tenant)

1. Provision new schema: `tenant_<id>`
2. Replicate data:
   ```sql
   INSERT INTO tenant_abc.subscriptions
   SELECT id, status, created_at 
   FROM public.subscriptions 
   WHERE tenant_id = 'abc';
   ```
3. Update tenant config: `mode: 'schema-per-tenant'`
4. Validate isolation
5. Decommission old rows

### Enterprise → Isolated DB (schema-per-tenant → external-adapter)

1. Provision new database in target region
2. Run schema migrations
3. Replicate via logical replication or ETL
4. Update `tenant-databases.json`
5. Restart adapter pool
6. Cutover DNS/routing

---

## Security Guardrails

### Row-Level Security (RLS)

For shared-schema mode, RLS policies are **required**:

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON subscriptions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### Metadata Validation

```typescript
import { validateTenantMetadata } from '@/domain/tenancy';

// This throws if PII fields are present
validateTenantMetadata({
  industry: 'healthcare',  // ✅ OK
  email: 'admin@example.com'  // ❌ ERROR: PII not allowed
});
```

---

## Troubleshooting

### Error: "No tenant context set"

**Cause**: Data access attempted without tenant scoping  
**Fix**: Wrap in `TenancyContext.create(tenantId).withTenant(...)`

### Error: "DATABASE_URL is required"

**Cause**: Shared-schema mode needs database connection  
**Fix**: Set `DATABASE_URL` environment variable

### Cross-tenant data leak

**Cause**: Missing RLS policy or query not scoped  
**Fix**: Run `pnpm tenancy:check` to validate isolation

---

## Files & Scripts

### Documentation
- `docs/tenancy/TENANCY.md`: Comprehensive architecture guide
- `docs/tenancy/README.md`: This file

### Configuration
- `configs/tenancy.ts`: Zod-validated config schema

### Service Layer
- `src/services/tenancy/tenancy-context.ts`: Core context abstraction
- `src/services/tenancy/database-adapters.ts`: Mode-specific adapters
- `src/services/tenancy/tenant-resolver.ts`: Request-based resolvers

### Domain Models
- `src/domain/tenancy/tenant.ts`: Tenant entity & validation

### Tests
- `tests/tenancy/shared.spec.ts`: Shared-schema isolation (11 tests)
- `tests/tenancy/isolated.spec.ts`: Schema-per-tenant isolation (10 tests)

### Scripts
- `scripts/tenancy/seed.ts`: Provision sample tenants
- `scripts/tenancy/check.ts`: CI matrix runner

### Package Scripts
- `pnpm tenancy:seed`: Provision sample tenants
- `pnpm tenancy:test`: Run test suites
- `pnpm tenancy:check`: Matrix validation

---

## Next Steps

1. **B17.3**: Billing ACL v1 — Provider adapters will use `TenancyContext`
2. **B17.5**: Usage ingest will enforce tenant boundaries
3. **Production**: Add RLS policies to all tenant-scoped tables
4. **Ops**: Create tenant provisioning/deprovisioning runbooks

---

## References

- **Research**: `cmos/Industry-Research/R1.4_Convergent-Gravity-Divergent-Forces.md`
- **Direction**: `cmos/docs/OODS Direction-Check-for-sprint-17.md`
- **Mission**: `cmos/missions/sprint-17/B17.2_tenancy-strategy-scaffold.yaml`
- **Outcome**: `cmos/status/summary/B17.2_tenancy-strategy-scaffold.md`
