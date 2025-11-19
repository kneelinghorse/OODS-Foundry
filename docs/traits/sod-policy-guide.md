# SoD Policy Builder & Validator

Sprint 28 · Mission B28.4 delivers the policy tooling required to operationalise the Separation of Duty (SoD) research from R28.1. This guide summaries the taxonomy, API surface, and validation approach for engineers wiring static (role-based) and dynamic (action-based) controls into OODS runtimes.

## Taxonomy

| Pattern | Definition | Storage Source | Enforcement |
|---------|------------|----------------|-------------|
| **Static SoD** | Mutually exclusive role pair (e.g., Accountant ≠ Auditor) | `authz.sod_role_conflicts` | DB trigger `enforce_sod_on_membership` (blocking) + validator pre-check |
| **Dynamic SoD** | Instance-level conflict (e.g., creator cannot approve same PO) | `authz.action_log` | Application detector (audit-only in v1.0) |
| **Quorum SoD (v2.0)** | N-of-M approvals | *Deferred* | Planned for Sprint 29 |

## Policy Builder API

Module: `@/traits/authz/sod-policy-builder`

| Function | Description |
|----------|-------------|
| `createRoleConflict(roleAId, roleBId, reason, orgId?)` | Adds a SoD policy (global when `orgId` omitted). Rejects if any user already holds both roles within the target scope. |
| `updateRoleConflict(policyId, updates)` | Allows changing reason, org scope, or `active` flag. Duplicate / membership guardrails remain active. |
| `deleteRoleConflict(policyId)` | Removes the policy row and telemetry trail. |
| `listConflicts(orgId?)` | Returns global conflicts plus any scoped to the provided org. |

### Guardrails

1. **Duplicate detection** – role pairs are normalised (sorted) before persistence. Builder rejects any attempt to reintroduce an existing pair within the same scope (global or org-specific).
2. **Existing membership check** – before inserts/reactivations, the builder scans `authz.memberships` for users who already have both roles. If found, policy creation is halted to avoid trapping live users behind the trigger.
3. **Audit logging** – actions surface as structured debug logs (`sod_policy_created|updated|deleted`) so missions such as B28.5 can warm caches or propagate to downstream services.

## Validator API

Module: `@/traits/authz/sod-validator`

| Function | Description |
|----------|-------------|
| `validateMembershipAssignment(userId, orgId, roleId)` | Mirrors the Postgres trigger logic and returns `{ valid, violations[] }`. Violations list the policy ID, reason, conflicting role, and scope to aid UI messaging. |
| `detectDynamicSoDViolation(userId, action, resourceType, resourceId)` | Queries `authz.action_log` and determines whether the same user already executed a conflicting action on the same resource (Creator vs Approver, Submitter vs Approver). Returns `{ violation, auditOnly: true, conflict?, history }`. |

### Dynamic Detection Defaults

The validator ships with the canonical rules from **R28.1 Section 1.2**:

- Applies to resource types `purchase_order` and `expense` (plus wildcard `*`).
- Flags when the same user performs `approve` after either `create` or `submit` on the same resource ID.
- Audit-only in v1.0: callers should log / notify but continue processing to satisfy mission constraint "detection (no blocking)".

Rules are configurable through `createSodValidator(executor, { dynamicRules, historyLimit })` so future missions can plug in additional pairs (e.g., `release` vs `approve`).

## Example Policies

```ts
const builder = createSodPolicyBuilder(executor);

await builder.createRoleConflict(
  roles.accountant,
  roles.auditor,
  'SOX: bookkeeping and auditing must be separate'
);

await builder.createRoleConflict(
  roles.requester,
  roles.approver,
  'Procurement requester cannot approve own PO',
  organizations.finance
);
```

```ts
const validator = createSodValidator(executor);
const staticResult = await validator.validateMembershipAssignment(userId, orgId, roles.approver);
if (!staticResult.valid) {
  throw new Error(staticResult.violations[0]?.reason ?? 'SoD violation');
}

const dynamicResult = await validator.detectDynamicSoDViolation(userId, 'approve', 'expense', expenseId);
if (dynamicResult.violation) {
  auditLogger.warn('sod_dso_d violation', dynamicResult);
}
```

## v1.0 vs v2.0

| Capability | v1.0 (B28.4) | Planned v2.0 |
|------------|--------------|---------------|
| Static policies | ✅ CRUD + trigger guard | ✅ (no change) |
| Dynamic detection | ✅ Audit-only detections | ✅ Blocking enforcement w/ policy config |
| Quorum policies | ❌ Deferred | ✅ JSON policies + approval tracker |
| Cache priming | ❌ (manual) | ✅ B28.5 policy cache service |

## Testing Checklist

1. `pnpm test tests/traits/authz/sod-policy.test.ts`
2. `pnpm test tests/traits/authz/sod-validator.test.ts`
3. Ensure DSoD_001/DSoD_002 scenarios from `cmos/research/R28.1_sod-test-cases.md` pass (creator ≠ approver, multi-user approval).

Use these references when wiring UI/CLI flows so we stay aligned with the research deliverables and maintain deterministic SoD enforcement.
