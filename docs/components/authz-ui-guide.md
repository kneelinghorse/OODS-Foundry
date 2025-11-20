# Authorization UI Surface Guide

The Authorization UI surface ships four composable building blocks that mirror the RBAC runtime shipped in Sprint 28:

- **RolePermissionMatrix** – Admin grid for mapping permissions to roles
- **MembershipManager** – Org-scoped membership CRUD with SoD hints
- **SoDPolicyEditor** – Create/update static SoD conflicts
- **PermissionChecker** – Diagnostic widget for entitlement checks

Each component is framework-agnostic (React 19) and enforces the OODS token guardrails (no raw colors, keyboard semantics baked in).

## RolePermissionMatrix

```tsx
import { RolePermissionMatrix } from '@/components/authz/RolePermissionMatrix';
import { useRolePermissions } from '@/hooks/useRolePermissions';

const { matrix, toggleAssignment, busyCells } = useRolePermissions({
  client: rolePermissionClient,
  organizationId: 'org-prod',
});

<RolePermissionMatrix
  matrix={matrix}
  onToggle={toggleAssignment}
  busyCells={busyCells}
  conflictHighlights={conflicts}
/>;
```

- Rows = roles, columns = permissions. Keyboard navigation uses arrow keys + Space.
- `conflictHighlights` allows UI warnings sourced from SoD validators.
- Provide an `emptyState` prop for orgs without seeded data.

## MembershipManager

```tsx
const memberships = useMemberships({
  organizationId: org.id,
  client: membershipClient,
  validator: sodValidator,
});

<MembershipManager
  organization={org}
  members={memberships.memberships}
  roles={roleOptions}
  users={userDirectory}
  onAssignRole={memberships.assignRole}
  onRevokeRole={(member) => memberships.revokeRole(member.userId, member.roleId)}
  onValidateAssignment={memberships.validateAssignment}
  validationState={memberships.validationState}
  pendingMembers={memberships.pendingMembers}
/>;
```

- Shows live SoD warnings before submission when `validator` rejects an assignment.
- Designed for keyboard-only flows – every control carries visible focus states.
- Org-specific stats (member count, roles in use) help ops triage blast radius.

## SoDPolicyEditor

```tsx
<SoDPolicyEditor
  roles={roleOptions}
  organizationOptions={orgOptions}
  policies={policies}
  onCreatePolicy={(draft) => builder.createRoleConflict(draft.roleAId, draft.roleBId, draft.reason, draft.organizationId ?? undefined)}
  onUpdatePolicy={(id, updates) => builder.updateRoleConflict(id, updates)}
  onDeletePolicy={(id) => builder.deleteRoleConflict(id)}
/>;
```

- Scope selector enforces explicit choice between global and org-specific policies.
- Table footer exposes quick “Activate/Deactivate/Delete” actions with audit timestamps.

## PermissionChecker

```tsx
<PermissionChecker
  client={entitlementDiagnosticsClient}
  defaultOrganizationId={org.id}
  defaultUserId={user.id}
/>
```

- Form posts to any client implementing `check({ userId, organizationId, permission })`.
- Results show granting roles + textual reason from the entitlement runtime.

## Hooks Overview

### useRolePermissions

- Fetches matrix snapshots via pluggable `RolePermissionClient`
- Optimistic assignment toggles with automatic rollback on failure
- Built-in TTL cache (`createRolePermissionMatrixCache`) matches B28.5 semantics

### useMemberships

- Fetch/list user memberships scoped by org ID
- `assignRole` + `revokeRole` expose SoD validation hooks before mutation
- Tracks pending operations per `(userId, roleId)` for UI disablement

## Accessibility & QA

| Component             | Expectation                                                               |
|-----------------------|----------------------------------------------------------------------------|
| RolePermissionMatrix  | Role=grid, arrow-key traversal, announce conflict notes via `role="note"` |
| MembershipManager     | All form fields labeled, SoD warnings use `role="alert"`                  |
| SoDPolicyEditor       | Radio-group for scope, selects accessible, action buttons focus visible   |
| PermissionChecker     | Uses `aria-live="polite"` for results                                     |

### Testing Checklist

1. Run unit + a11y tests:
   ```bash
   pnpm vitest run tests/components/authz/RolePermissionMatrix.test.tsx
   pnpm vitest run tests/components/authz/MembershipManager.a11y.test.tsx
   ```
2. Exercise stories under `Authz/` in Storybook (light/dark + keyboard)
3. For CLI work, dry-run via `pnpm tsx src/cli/authz-admin.ts assign-role --user usr --org org --role role --dry-run`

### Integration Tips

- Client adapters should bridge to the B28.3 entitlement service and B28.4 policy builder.
- Prefer returning snapshots from API mutations to keep hooks in sync with server truth.
- Use Chromatic to capture a baseline for Admin vs Read-only vs Conflict scenarios.
