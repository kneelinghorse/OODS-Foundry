# Authorization Schema Guide (Sprint 28 · Mission B28.2)

This guide documents the RBAC data layer introduced in Sprint 28. The schema translates
R21.2 Part 4.2's canonical model plus R28.1 segregation-of-duties (SoD) research into a
PostgreSQL implementation under the `authz` schema. All objects inherit tenant context
from `core.users` and `core.organizations` via cascading foreign keys.

## Entity-Relationship Overview

```
 core.users ─┐
            ├── authz.memberships ─── authz.roles ─── authz.role_permissions ─── authz.permissions
 core.organizations ─┘                │                           │
                                      └── authz.role_hierarchy ───┘
```

- **authz.roles** (R21.2 TABLE 1) — Global role catalog. Unique `name` column ensures the
  SoD registry can refer to roles without additional namespace fields.
- **authz.permissions** (R21.2 TABLE 2) — Atomic operations in `resource:action` format.
  Optional `resource_type` powers UI grouping and enforcement scripts.
- **authz.role_permissions** (R21.2 TABLE 3) — Junction table mapping roles to permissions.
  Composite PK `(role_id, permission_id)` blocks duplicate grants.
- **authz.memberships** (R21.2 TABLE 4) — Multi-tenant junction linking `core.users`,
  `core.organizations`, and `authz.roles`. Enforces unique `(user_id, organization_id, role_id)`
  assignments plus cascading deletes for safe tenant cleanup.
- **authz.role_hierarchy** (R21.2 TABLE 5) — Adjacency list describing parent/child
  inheritance. `CHECK (parent_role_id <> child_role_id)` prevents loops at the database layer.
- **authz.sod_role_conflicts** (R28.1 Static SoD) — Configuration table enumerating mutually
  exclusive roles. `organization_id` is nullable to support global conflicts.
- **authz.action_log** (R28.1 Dynamic SoD) — Low-level audit rail capturing user actions
  for future anomaly detection.

## Table Details

| Table | Key Columns | Notes |
| --- | --- | --- |
| `authz.roles` | `id`, `name`, `description`, timestamps | Comment documents that roles stay global in v1.0. |
| `authz.permissions` | `name`, `resource_type`, `description` | `CHECK (position(':' in name) > 0)` enforces canonical format. |
| `authz.role_permissions` | `role_id`, `permission_id`, `granted_at` | Foreign keys cascade so deleting a role removes related grants. |
| `authz.memberships` | `user_id`, `organization_id`, `role_id` | All FKs point to `core` schema tables; indexes support lookups described in R21.2 Part 3.1. |
| `authz.role_hierarchy` | `parent_role_id`, `child_role_id`, `depth` | Depth enables optimized graph traversals in B28.3 entitlement runtime. |
| `authz.sod_role_conflicts` | `role_a_id`, `role_b_id`, `organization_id`, `reason` | `UNIQUE(role_a_id, role_b_id, organization_id)` avoids duplicate SoD entries. |
| `authz.action_log` | `user_id`, `organization_id`, `action`, `resource_type`, `resource_id` | Timestamped feed for dynamic SoD heuristics. |

## Index Strategy

- `idx_memberships_user_org` — Optimizes "fetch every role for user X in org Y" queries.
- `idx_memberships_org_role` — Optimizes "list all users assigned to role Z in org Y" queries.
- `idx_role_permissions_role` — Supports fast role-to-permission traversal when caching entitlements.
- `idx_action_log_lookup` — Backed by R28.1 dynamic SoD research for resource-level investigations.

These indexes align with Preferenceable cache guidance (R21.2 Part 3.1) to keep queries under
10 ms at 95th percentile.

## Static SoD Trigger

`authz.prevent_conflicting_roles()` enforces the R28.1 Static SoD pattern by inspecting
`authz.sod_role_conflicts` before every insert/update on `authz.memberships`.

- Rejects assignments where a user already holds a conflicting role in the same organization.
- Works with global (`organization_id IS NULL`) and tenant-specific conflict definitions.
- Emits descriptive `RAISE EXCEPTION 'SoD violation: ...'` messages for observability and CLI UX.

## Next Steps

- Mission B28.3 consumes these tables to power entitlement resolution and caching.
- Mission B28.4 will build UI scaffolding referencing this schema guide for documentation links.
