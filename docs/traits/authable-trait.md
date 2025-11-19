# Authable Trait (RBAC Extension Pack)

> **References:** R21.2 Part 2.2 (Membership pattern), Part 3.1 (Hierarchical roles), Part 4.2 TABLE 1-4 (Canonical RBAC tables)

## Overview
The Authable trait introduces tenant-aware RBAC to OODS by composing the five canonical tables outlined in R21.2: roles, permissions, role_permissions, memberships, and role_hierarchy. Roles remain global across tenants in v1.0, while memberships bind each user to an organization + role triple. This mirrors successful SaaS models where a user may be Admin in Org A but Viewer in Org B.

## Parameters
| Name | Type | Description |
| --- | --- | --- |
| `defaultRoleId` | `string` | Applied when provisioning users without explicit role assignments (R21.2 §2.3). |
| `hierarchyDepthLimit` | `number` | Caps recursive traversal when resolving inherited permissions. |

## Schema Fields
| Field | Description |
| --- | --- |
| `role_catalog` | Canonical role rows (R21.2 Part 4.2 TABLE 1). |
| `permission_catalog` | Atomic `resource:action` permissions (TABLE 2). |
| `role_permissions` | Junction mapping role → permissions (TABLE 3). |
| `membership_records` | User ↔ Organization ↔ Role triple enforcing UNIQUE(user_id, organization_id, role_id) (TABLE 4). |
| `role_hierarchy_edges` | Adjacency list for inheritance (Part 3.1). |
| `session_roles` | Materialized roles for the current request context. |

## Composition Example
```ts
import { User } from '@/objects/User';
import { AuthableTrait } from '@/traits/authz/authz-trait';

const AuthorizedUser = composeTraits(User, [AuthableTrait]);

const user = new AuthorizedUser({
  roleCatalog: [
    { id: 'admin-role', name: 'Admin' },
    { id: 'viewer-role', name: 'Viewer' }
  ],
  permissionCatalog: [
    { id: 'perm-share', name: 'document:share' },
    { id: 'perm-read', name: 'document:read' }
  ],
  memberships: [
    {
      id: 'membership-1',
      user_id: 'user-1',
      organization_id: 'org-1',
      role_id: 'admin-role',
      created_at: '2025-11-19T00:00:00Z',
      updated_at: '2025-11-19T00:00:00Z'
    }
  ],
  rolePermissions: {
    'admin-role': ['perm-share', 'perm-read'],
    'viewer-role': ['perm-read']
  }
});

user.assignMembership({
  user_id: 'user-2',
  organization_id: 'org-1',
  role_id: 'viewer-role'
});

user.linkRolePermission('viewer-role', 'perm-share');
```

## Guardrails
- JSON Schema + Zod dual validation ensures payloads remain compatible with generated DTOs.
- Membership helper enforces uniqueness and timestamp freshness.
- Hierarchy traversals are capped by the `hierarchyDepthLimit` parameter to avoid runaway recursion.
