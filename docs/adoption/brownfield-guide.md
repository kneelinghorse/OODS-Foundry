# Brownfield Adoption Guide — Incremental Integration

**Version:** 1.0.0  
**Status:** Active (Sprint 17)  
**Last Updated:** 2025-10-25  
**Audience:** Product teams integrating OODS Foundry into existing applications

---

## Overview

This guide provides a step-by-step path for teams adopting OODS Foundry traits, objects, tokens, and compliance capabilities into existing ("brownfield") applications. Unlike greenfield projects, brownfield adoption requires:

- **Incremental rollout** — Layer by layer, not all-at-once
- **Coexistence patterns** — New system beside legacy code
- **Validation gates** — Prove each layer works before the next
- **Rollback safety** — Feature flags and gradual migration

The adoption journey follows a **four-phase model**:

```
Phase 1: Tokens & Theming ────→ Phase 2: Components & Contexts
         (1-2 weeks)                     (2-4 weeks)
                    ↓                          ↓
Phase 4: Compliance & Governance ←── Phase 3: Objects & Domain Logic
         (3-4 weeks)                     (2-3 weeks)
```

Each phase includes:
- **Success criteria** to gate progression
- **CLI validation** scripts
- **Storybook proofs** for visual regression
- **Rollback procedures** if issues arise

---

## Prerequisites

### Required Knowledge
- Familiarity with React, TypeScript, and Tailwind CSS
- Understanding of design tokens and semantic theming
- Basic Git workflow (branching, PRs, code review)

### System Requirements
- Node.js v20+ (LTS recommended)
- PostgreSQL 15+ (for compliance/tenancy features)
- pnpm v9+ (corepack enabled)

### Recommended Reading
- [Design Quickstart](../getting-started/design.md) — 10-minute token workflow
- [Development Quickstart](../getting-started/dev.md) — 10-minute component workflow
- [Multi-Brand Theming](../theming/multi-brand.md) — Brand scaffolding patterns
- [Compliance Core](../policies/compliance-core.md) — RBAC & audit logging

---

## Phase 1: Tokens & Theming

**Duration:** 1-2 weeks  
**Goal:** Establish semantic token foundation and theme switcher

### 1.1 Export Baseline Tokens

1. **Audit existing design system:**
   ```bash
   pnpm adoption:audit --focus=tokens
   ```
   This generates a gap analysis report showing:
   - Which semantic tokens exist
   - Missing WCAG AA pairs
   - Brand-specific overrides needed

2. **Map legacy tokens to OODS semantic layer:**
   Create a mapping CSV:
   ```csv
   Legacy Token,OODS Token,Notes
   --color-primary,color.brand.primary.default,Direct map
   --color-bg,color.surface.bg.default,Semantic upgrade
   --spacing-md,spacing.inset.default,Stack unit → inset
   ```

3. **Export from Figma (if applicable):**
   ```bash
   pnpm tokens:export
   pnpm tokens:transform
   ```
   See [Figma Handshake Docs](../figma/roundtrip-checklist.md) for sync workflow.

### 1.2 Introduce Theme Switcher

Add the brand/theme switcher to your app shell:

```typescript
import { useBrand, useTheme } from '@oods/react-core';

function AppShell() {
  const { brand, setBrand } = useBrand();
  const { theme, setTheme } = useTheme();

  return (
    <div data-brand={brand} data-theme={theme}>
      {/* Your existing app */}
    </div>
  );
}
```

**Storybook proof:**
```bash
pnpm storybook
# Navigate to: Adoption > Phase 1 > Theme Switcher
```

### 1.3 Validate Token Coverage

Run the coverage validator:
```bash
pnpm tokens:lint-semantic
pnpm tokens:governance
```

**Success criteria:**
- ✅ 100% semantic token coverage (no hex literals in components)
- ✅ WCAG AA contrast passes for all token pairs
- ✅ Brand switcher toggles between Brand A/B without errors
- ✅ Dark theme renders correctly with elevation tokens

**Rollback:** If token conflicts arise, use feature flags to gate new tokens:
```typescript
const bgColor = useFeatureFlag('oods-tokens')
  ? 'var(--color-surface-bg-default)'
  : 'var(--legacy-bg-color)';
```

---

## Phase 2: Components & Contexts

**Duration:** 2-4 weeks  
**Goal:** Adopt trait-driven components and context-aware layouts

### 2.1 Identify Component Migration Candidates

Run the component audit:
```bash
pnpm adoption:audit --focus=components
```

**Prioritization criteria:**
- High usage frequency
- Accessibility debt (low WCAG compliance)
- Active design evolution (frequent tweaks)

**Example output:**
```
Component        Usage  A11y Score  Migration Priority
Button           234    85%         HIGH
StatusBadge      89     60%         HIGH (a11y debt)
DataTable        45     92%         MEDIUM
CustomModal      12     70%         LOW
```

### 2.2 Adopt Statusables Pattern

Migrate status indicators to canonical token mapping:

**Before (legacy):**
```tsx
<Badge color={status === 'active' ? 'green' : 'red'} />
```

**After (OODS):**
```tsx
import { Badge } from '@oods/react-components';
import { getStatusIntent } from '@oods/react-core';

<Badge intent={getStatusIntent(status)} />
```

See [Statusables Documentation](../components/statusables.md) for full API.

### 2.3 Layer in Contexts

Wrap feature areas with context regions:

```tsx
import { ContextProvider } from '@oods/react-core';

<ContextProvider context="detail">
  <UserProfile user={user} />
</ContextProvider>

<ContextProvider context="list">
  <UserTable users={users} />
</ContextProvider>
```

**Context defaults:**
- `list`: Compact density, smaller type, tight spacing
- `detail`: Default density, base type, relaxed spacing
- `form`: Relaxed line-height, explicit labels, validation tokens
- `timeline`: Compact type, tight rhythm, event markers

Full reference: [Context Styling Guide](../views/context-styling.md)

### 2.4 Validate Component Parity

```bash
pnpm adoption:storybook-checklist --phase=2
```

Generates a checklist report:
```markdown
## Phase 2 Component Parity

- [x] Button: OODS variant matches legacy visually
- [x] Badge: Status mapping 100% coverage
- [ ] DataTable: Pagination controls need alignment
- [x] Form inputs: Validation states use tokens
```

**Success criteria:**
- ✅ Core components (Button, Badge, inputs) migrated
- ✅ Context wrappers applied to 2+ feature areas
- ✅ Storybook proofs cover light/dark/HC themes
- ✅ Accessibility smoke tests pass (`pnpm a11y:diff`)

**Rollback:** Use gradual feature flag rollout:
```typescript
const Component = useFeatureFlag('oods-components')
  ? OODSButton
  : LegacyButton;
```

---

## Phase 3: Objects & Domain Logic

**Duration:** 2-3 weeks  
**Goal:** Adopt trait-composed domain objects with validation

### 3.1 Map Domain Entities to Objects

Identify which backend/frontend entities align with Universal Quintet:

| Your Entity       | OODS Object       | Traits Applied                     |
|-------------------|-------------------|------------------------------------|
| `Customer`        | `User`            | Identifiable, Statusable, Timestamped |
| `Account`         | `Organization`    | Identifiable, Hierarchical, Timestamped |
| `Plan`            | `Product`         | Statusable, Priceable, Categorized |
| `Subscription`    | `Subscription`    | Statusable, Timestamped, Billable  |
| `Payment`         | `Transaction`     | Statusable, Timestamped, Auditable |

### 3.2 Compose Domain Objects

Define your objects in `objects/custom/`:

```yaml
# objects/custom/Customer.object.yaml
objectId: "custom.Customer"
displayName: "Customer"
description: "Core customer entity with lifecycle states"

traits:
  - trait: "Identifiable"
  - trait: "Statusable"
    params:
      states: ["prospect", "active", "churned", "archived"]
  - trait: "Timestamped"
  - trait: "Contactable"
    params:
      channels: ["email", "phone", "sms"]

schema:
  properties:
    customerId:
      type: string
    accountTier:
      type: string
      enum: ["free", "pro", "enterprise"]
```

Generate TypeScript types:
```bash
pnpm objects:generate --path=objects/custom/
```

See [Authoring Objects](../authoring-objects.md) for full syntax.

### 3.3 Integrate Validation Pipeline

Wire validation into your API layer:

```typescript
import { validateObject } from '@oods/trait-engine/validation';
import { CustomerObject } from '@/generated/objects/Customer';

// In your API endpoint
const result = await validateObject(CustomerObject, customerData);

if (!result.valid) {
  return res.status(400).json({
    errors: result.errors.map(e => ({
      field: e.field,
      message: e.message,
      severity: e.severity,
    })),
  });
}
```

### 3.4 Validate Object Coverage

```bash
pnpm adoption:audit --focus=objects
```

**Success criteria:**
- ✅ Core domain entities mapped to OODS objects
- ✅ Type generation produces clean TypeScript (no `any` types)
- ✅ Validation pipeline integrated in 2+ API endpoints
- ✅ Storybook stories render `<RenderObject>` with composed data

**Rollback:** Objects are additive—old schema remains valid. Use feature flags to gate new validation:
```typescript
const validator = useFeatureFlag('oods-validation')
  ? validateObject
  : legacyValidator;
```

---

## Phase 4: Compliance & Governance

**Duration:** 3-4 weeks  
**Goal:** Enable RBAC, audit logging, and tenancy isolation

### 4.1 Enable RBAC Service

1. **Run database migration:**
   ```bash
   pnpm db:migrate --file=20251024_171_compliance_core.sql
   ```

2. **Define roles and permissions:**
   ```typescript
   import { getRBACService } from '@/services/compliance/rbac-service';

   const rbac = getRBACService();

   // Create baseline roles
   await rbac.createRole({
     id: 'role_viewer',
     name: 'Viewer',
     permissions: ['subscription:read', 'user:read'],
   });

   await rbac.createRole({
     id: 'role_contributor',
     name: 'Contributor',
     permissions: ['subscription:read', 'subscription:write', 'user:read'],
   });

   await rbac.createRole({
     id: 'role_approver',
     name: 'Approver',
     permissions: ['subscription:approve', 'token:approve'],
   });
   ```

3. **Gate privileged actions:**
   ```typescript
   const canPause = await rbac.checkPermission(
     userId,
     `subscription:${subscriptionId}`,
     'pause'
   );

   if (!canPause.allowed) {
     throw new UnauthorizedError(canPause.reason);
   }
   ```

See [Compliance Core Documentation](../policies/compliance-core.md).

### 4.2 Enable Audit Logging

```typescript
import { getAuditLogService } from '@/services/compliance/audit-service';

const audit = getAuditLogService();

// Record critical actions
await audit.record({
  actorId: userId,
  actorType: 'user',
  action: 'subscription.pause',
  resourceRef: `subscription:${subscriptionId}`,
  payload: { reason: 'customer request' },
  severity: 'WARNING',
});
```

**Verify chain integrity:**
```typescript
const verification = await audit.verifyIntegrity();
if (!verification.valid) {
  console.error('CRITICAL: Audit log tampering detected');
}
```

### 4.3 Configure Tenancy Isolation

1. **Set tenancy mode:**
   ```bash
   export OODS_TENANCY_MODE=shared-schema  # or schema-per-tenant
   export OODS_STRICT_ISOLATION=true
   ```

2. **Seed test tenants:**
   ```bash
   pnpm tenancy:seed
   ```

3. **Wrap data access in tenant context:**
   ```typescript
   import { TenancyContext } from '@/services/tenancy';

   const context = TenancyContext.create(tenantId);

   const subscriptions = await context.withTenant(async (adapter) => {
     const conn = await adapter.getConnection();
     return conn.query('SELECT * FROM subscriptions');
   });
   ```

See [Tenancy Implementation Guide](../tenancy/README.md).

### 4.4 Validate Compliance Posture

```bash
pnpm adoption:audit --focus=compliance
```

**Success criteria:**
- ✅ RBAC gates 100% of privileged actions
- ✅ Audit log records all critical events with hash chain integrity
- ✅ Tenant isolation passes cross-tenant leak tests (`pnpm tenancy:check`)
- ✅ Separation-of-duty constraints enforced (e.g., submitter ≠ approver)

**Rollback:** Compliance features are opt-in—disable via environment variables:
```bash
export OODS_RBAC_ENABLED=false
export OODS_AUDIT_ENABLED=false
```

---

## CLI Reference

### `pnpm adoption:audit`

Generates a gap analysis report for brownfield integration.

**Usage:**
```bash
pnpm adoption:audit [--focus=tokens|components|objects|compliance]
```

**Output:**
- `artifacts/adoption/audit-report.json` — Machine-readable gaps
- `artifacts/adoption/audit-report.md` — Human-readable summary

**Flags:**
- `--focus` — Limit audit to specific phase
- `--format=json|markdown|html` — Output format
- `--threshold=high|medium|low` — Minimum severity to report

### `pnpm adoption:storybook-checklist`

Generates a component parity checklist comparing OODS components to legacy.

**Usage:**
```bash
pnpm adoption:storybook-checklist [--phase=1|2|3|4]
```

**Output:**
- `artifacts/adoption/checklist-phaseN.md` — Markdown checklist

**Example:**
```markdown
## Phase 2 Component Parity

- [x] Button: Visual parity confirmed across themes
- [x] Badge: Status mapping 100% coverage
- [ ] DataTable: Pagination needs HC token tuning
```

---

## Storybook Validation Flow

### 1. Launch Storybook

```bash
pnpm storybook
```

### 2. Navigate to Adoption Deck

Go to: **Docs → Brownfield Adoption**

This deck provides:
- Phase-by-phase visual proofs
- Brand/theme switcher integration examples
- Component migration side-by-side comparisons
- Object rendering demos with `<RenderObject>`

### 3. Run Visual Regression

```bash
pnpm local:pr-check
```

This executes:
- Lint checks
- Type checks
- Unit tests
- Accessibility contract (`pnpm a11y:diff`)
- Visual regression dry run (Chromatic or local harness)

---

## Migration Patterns

### Pattern 1: Feature Flag Gradual Rollout

Use feature flags to enable OODS features incrementally:

```typescript
import { useFeatureFlag } from '@/hooks/feature-flags';

function MyComponent() {
  const useOODS = useFeatureFlag('oods-components');

  return useOODS ? <OODSButton /> : <LegacyButton />;
}
```

**Recommended stages:**
1. Internal team (5% traffic)
2. Beta users (10% traffic)
3. General availability (100% traffic)

### Pattern 2: Parallel Component Trees

Run OODS and legacy components side-by-side during migration:

```tsx
<SplitLayout>
  <LegacyPanel />
  <OODSPanel />
</SplitLayout>
```

Compare visually, then deprecate legacy when parity is proven.

### Pattern 3: Adapter Layer for Domain Objects

Wrap legacy data models with OODS object adapters:

```typescript
function adaptLegacyCustomer(legacy: LegacyCustomer): Customer {
  return {
    customerId: legacy.id,
    status: mapLegacyStatus(legacy.state),
    createdAt: legacy.created_timestamp,
    updatedAt: legacy.modified_timestamp,
  };
}
```

Gradually replace legacy models as adoption progresses.

---

## Troubleshooting

### Issue: Token conflicts between legacy and OODS

**Symptom:** CSS variable collisions, unexpected colors

**Fix:** Namespace legacy tokens:
```css
/* Legacy */
:root {
  --legacy-color-primary: #3b82f6;
}

/* OODS */
:root {
  --color-brand-primary-default: oklch(0.55 0.20 250);
}
```

Use feature flags to toggle between namespaces.

### Issue: Components don't render in correct context

**Symptom:** Wrong density, spacing, or typography

**Fix:** Ensure `<ContextProvider>` wraps the component tree:
```tsx
<ContextProvider context="list">
  <MyComponent />
</ContextProvider>
```

### Issue: RBAC permission checks fail

**Symptom:** 403 errors for authorized users

**Fix:** Verify role grants are tenant-scoped:
```typescript
await rbac.grantRole(userId, roleId, grantedBy, tenantId);
```

Check effective roles:
```typescript
const roles = await rbac.listEffectiveRoles(userId, tenantId);
console.log('User roles:', roles);
```

### Issue: Audit log chain integrity fails

**Symptom:** `verifyIntegrity()` returns `valid: false`

**Fix:** This indicates tampering or migration errors. Check:
1. No manual `UPDATE`/`DELETE` on `compliance.audit_log`
2. Migrations did not reset sequence numbers
3. Clock skew if entries span multiple servers

Export logs for forensic review:
```typescript
const logs = await audit.export();
```

---

## Reference Architecture

### Recommended Directory Structure

```
your-app/
├── src/
│   ├── components/
│   │   ├── legacy/          # Phase out gradually
│   │   └── oods/            # OODS components
│   ├── domain/
│   │   ├── objects/         # Trait-composed objects
│   │   └── services/        # RBAC, audit, tenancy
│   ├── hooks/
│   │   ├── useFeatureFlag.ts
│   │   ├── useBrand.ts
│   │   └── useTheme.ts
│   └── styles/
│       ├── legacy.css
│       └── tokens.css       # OODS tokens
├── objects/
│   ├── core/                # Universal Quintet
│   └── custom/              # Your domain objects
├── configs/
│   ├── tenancy.ts
│   └── ui/
│       └── status-map.json
└── stories/
    ├── legacy/
    └── oods/
```

### API Integration Points

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │
       │ API calls with tenant headers
       ↓
┌─────────────┐       ┌──────────────┐
│  API Layer  │──────→│ TenancyContext│
│             │       └──────────────┘
└──────┬──────┘
       │
       │ RBAC checks & audit logs
       ↓
┌─────────────┐       ┌──────────────┐
│  Domain     │──────→│ RBAC Service │
│  Services   │       │ Audit Service│
└──────┬──────┘       └──────────────┘
       │
       │ Database queries
       ↓
┌─────────────┐
│  Database   │
│  (Postgres) │
└─────────────┘
```

---

## Success Metrics

Track these KPIs to measure adoption progress:

### Phase 1: Tokens
- **Token coverage:** % components using semantic tokens (target: 100%)
- **WCAG compliance:** % token pairs passing AA (target: 100%)
- **Brand switch errors:** Count (target: 0)

### Phase 2: Components
- **Component migration:** % components using OODS traits (target: 80%+)
- **Accessibility score:** axe violations (target: <5 serious/critical)
- **Context adoption:** % pages with context wrappers (target: 100%)

### Phase 3: Objects
- **Object coverage:** % domain entities with OODS objects (target: 100%)
- **Validation coverage:** % API endpoints with validation (target: 100%)
- **Type safety:** % generated types with no `any` (target: 100%)

### Phase 4: Compliance
- **RBAC coverage:** % privileged actions gated (target: 100%)
- **Audit completeness:** % critical actions logged (target: 100%)
- **Tenant isolation:** Cross-tenant leak tests passed (target: 100%)

---

## Next Steps

1. **Run the initial audit:**
   ```bash
   pnpm adoption:audit
   ```

2. **Review the gap analysis report:**
   ```
   artifacts/adoption/audit-report.md
   ```

3. **Plan your first phase:**
   - Start with Phase 1 (Tokens) if you need design consistency
   - Start with Phase 4 (Compliance) if you have audit/security requirements
   - Most teams: Phase 1 → 2 → 3 → 4 (linear path)

4. **Open an adoption support request:**
   ```
   .github/ISSUE_TEMPLATE/adoption-support.yml
   ```

5. **Join the internal discussion:**
   - Slack: `#oods-adoption`
   - Weekly office hours (check team calendar)

---

## References

- [Design Quickstart](../getting-started/design.md)
- [Development Quickstart](../getting-started/dev.md)
- [Multi-Brand Theming](../theming/multi-brand.md)
- [Compliance Core](../policies/compliance-core.md)
- [Tenancy Guide](../tenancy/README.md)
- [Component Documentation](../components/)
- [Authoring Objects](../authoring-objects.md)
- [Visual Regression Playbook](../testing/visual-regression.md)

---

## Support

**Questions or blockers?**
- **Issue template:** `.github/ISSUE_TEMPLATE/adoption-support.yml`
- **Slack:** `#oods-adoption`
- **Docs:** `docs/adoption/brownfield-guide.md` (this file)

---

**End of Document**

