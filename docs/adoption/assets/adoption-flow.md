# OODS Foundry Brownfield Adoption Flow

## Four-Phase Model (ASCII Diagram)

```
┌──────────────────────────────────────────────────────────────────┐
│                    Brownfield Adoption Journey                    │
└──────────────────────────────────────────────────────────────────┘

Phase 1: Tokens & Theming (1-2 weeks)
┌─────────────────────────────────────────────────┐
│  1. Export baseline tokens from Figma           │
│  2. Introduce brand/theme switcher              │
│  3. Validate 100% semantic coverage             │
│                                                 │
│  ✅ CLI: pnpm adoption:audit --focus=tokens    │
└────────────┬────────────────────────────────────┘
             │
             ▼
Phase 2: Components & Contexts (2-4 weeks)
┌─────────────────────────────────────────────────┐
│  1. Migrate statusables (Badge, Banner, Toast)  │
│  2. Layer in context wrappers (list/detail)     │
│  3. Validate component parity                   │
│                                                 │
│  ✅ CLI: pnpm adoption:storybook-checklist     │
└────────────┬────────────────────────────────────┘
             │
             ▼
Phase 3: Objects & Domain Logic (2-3 weeks)
┌─────────────────────────────────────────────────┐
│  1. Map domain entities to OODS objects         │
│  2. Compose custom objects with traits          │
│  3. Integrate validation pipeline               │
│                                                 │
│  ✅ CLI: pnpm adoption:audit --focus=objects   │
└────────────┬────────────────────────────────────┘
             │
             ▼
Phase 4: Compliance & Governance (3-4 weeks)
┌─────────────────────────────────────────────────┐
│  1. Enable RBAC service for permissions         │
│  2. Enable audit logging with hash chain        │
│  3. Configure tenant isolation                  │
│                                                 │
│  ✅ CLI: pnpm adoption:audit --focus=compliance│
└─────────────────────────────────────────────────┘
             │
             ▼
          ✅ COMPLETE
```

## Validation Gates

Each phase includes validation steps that gate progression to the next:

### Phase 1 → Phase 2
- ✅ Token coverage: 100% components using semantic tokens
- ✅ WCAG compliance: 100% token pairs passing AA
- ✅ Brand switch errors: 0

### Phase 2 → Phase 3
- ✅ Component migration: 80%+ using OODS traits
- ✅ Accessibility: <5 serious/critical violations
- ✅ Context adoption: 100% pages with wrappers

### Phase 3 → Phase 4
- ✅ Object coverage: 100% domain entities mapped
- ✅ Validation: 100% API endpoints integrated
- ✅ Type safety: 100% no `any` types

### Phase 4 → Production
- ✅ RBAC coverage: 100% privileged actions gated
- ✅ Audit completeness: 100% critical actions logged
- ✅ Tenant isolation: 100% leak tests passed

## Rollback Safety

Each phase supports rollback via feature flags:

```typescript
// Example: Component migration rollback
const Component = useFeatureFlag('oods-components')
  ? OODSButton
  : LegacyButton;

// Example: Token rollback
const bgColor = useFeatureFlag('oods-tokens')
  ? 'var(--color-surface-bg-default)'
  : 'var(--legacy-bg-color)';

// Example: Compliance rollback
export OODS_RBAC_ENABLED=false
export OODS_AUDIT_ENABLED=false
```

## Success Metrics Dashboard

Track these KPIs throughout adoption:

| Phase | Metric                  | Target | Current |
|-------|-------------------------|--------|---------|
| 1     | Token coverage          | 100%   | ___%    |
| 1     | WCAG AA compliance      | 100%   | ___%    |
| 2     | Component migration     | 80%+   | ___%    |
| 2     | Accessibility score     | <5     | ___     |
| 3     | Object coverage         | 100%   | ___%    |
| 3     | Validation coverage     | 100%   | ___%    |
| 4     | RBAC coverage           | 100%   | ___%    |
| 4     | Audit completeness      | 100%   | ___%    |
| 4     | Tenant isolation        | 100%   | ___%    |

---

**Reference:** See [brownfield-guide.md](../brownfield-guide.md) for detailed instructions.

