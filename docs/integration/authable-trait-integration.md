# Authable Trait Integration Guide

Mission B28.7 wires the Authable trait into the canonical **User** and **Organization** objects. This document explains how to compose the trait, invoke helper methods, and run the new entitlement export + audit CLIs.

## Composing Authable Into User & Organization

1. Update the object definitions (`objects/core/User.object.yaml`, `objects/core/Organization.object.yaml`) to include `core/Authable`.
2. Regenerate types via `pnpm tsx src/cli/generate-objects.ts` so `generated/objects/*.d.ts` include Authable fields **and** helper methods:
   - `getRolesInOrg(organizationId)` → returns `AuthzRoleDocument[]`
   - `hasPermission(organizationId, permission)` → boolean (UUID or `resource:action`)
   - `exportEntitlements(organizationId)` → `{ roles, permissions }` snapshot for downstream IAM systems
3. Hydrate the trait state (roles, permissions, hierarchy, memberships) when serializing `User` or `Organization` data so the helpers can operate deterministically.

### Example Payloads

Reference objects:

- `examples/objects/user-with-authable.ts` – User composed with Addressable + Preferenceable + Authable, showcasing multi-org memberships.
- `examples/objects/organization-with-authable.ts` – Organization carrying Addressable locations plus Authable membership inventory.

Both examples reuse the sample dataset from `src/data/authz/sample-entitlements.ts`, ensuring parity across docs, stories, and tests.

## CLI Tools

### Entitlement Export (`src/cli/authz-export.ts`)

Exports normalized JSON for either a single user or an entire organization.

```bash
# User export
pnpm tsx src/cli/authz-export.ts user \
  --user 0f0fa0a0-aaaa-4aaa-8aaa-aaaaaaaaaaaa \
  --org 7aa0b813-eca4-4e14-9f3c-9b98b16d6c91 \
  --pretty

# Organization export
pnpm tsx src/cli/authz-export.ts org \
  --org 7aa0b813-eca4-4e14-9f3c-9b98b16d6c91
```

**Output contract**

```json
{
  "userId": "…",
  "subject": { "name": "…", "email": "…" },
  "organization": { "id": "…", "name": "…", "membershipCount": 2 },
  "roles": [{ "id": "…", "name": "Owner" }],
  "permissions": [{ "id": "…", "name": "document:approve" }],
  "sessionRoles": ["Owner", "Approver"],
  "memberships": 2,
  "generatedAt": "2025-11-20T03:10:00.000Z",
  "source": "authable-trait"
}
```

Use `--dataset <path>` to point at a custom JSON snapshot when exporting from production stores.

### Entitlement Audit (`src/cli/authz-audit.ts`)

Runs anomaly detectors on Authable state.

```bash
# User posture audit
pnpm tsx src/cli/authz-audit.ts user --user 0f0fc0c0-cccc-4ccc-8ccc-cccccccccccc --pretty

# Organization audit
pnpm tsx src/cli/authz-audit.ts org --org 7aa0b813-eca4-4e14-9f3c-9b98b16d6c91
```

Issues reported:
- `no_memberships` – user claims org access but has zero assignments
- `orphaned_membership` – membership references an unknown role or user
- `user_without_role` – dataset user scoped to org lacks memberships

Statuses:
- `pass` – no warnings/errors
- `review` – warnings only
- `action_required` – at least one error (blocks downstream provisioning)

## Storybook Scenarios

Two new stories visualize Authable data:
- `UserWithAuthable` – multi-org role panel + live permission checker
- `OrganizationMembers` – member list snapshot + interactive `MembershipManager`

Run with `pnpm storybook` and open the *Objects* section to review interactive states.

## Migration Notes

1. Compose Authable trait before enabling export/audit CLIs to ensure helper methods exist on the generated interfaces.
2. Populate `role_catalog`, `permission_catalog`, `role_permissions`, and `membership_records` whenever serializing User/Organization APIs so downstream clients can hydrate the trait without extra queries.
3. Use the provided dataset module (`src/data/authz/sample-entitlements.ts`) as a reference harness when writing new tests or fixtures.
4. Prior to shipping, execute:
   ```bash
   pnpm test tests/integration/authable-composition.test.ts
   pnpm test tests/integration/entitlement-export.test.ts
   ```
   These cover composition, helper generation, export contracts, and audit detection.
5. Keep Authable + Preferenceable interactions under regression by cloning the example user and adapting the preference document when onboarding new brands/regions.

## Entitlement Export Use Cases

- **IAM sync** – Feed JSON payloads into downstream identity providers or SCIM bridges without bespoke transforms.
- **Diagnostics** – Combine `PermissionChecker` UI with `authz-export` output to verify membership changes pre-provisioning.
- **Audit prep** – Run `authz-audit` before shipping migrations to surface orphaned memberships or missing user-role mappings.
