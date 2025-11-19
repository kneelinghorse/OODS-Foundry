# AuthZ Membership Pattern

> **Source:** R21.2 Part 2.2 *"The SaaS Imperative: The Membership Pattern"*

## Why Membership Beats `user_roles`
| Naïve `user_roles` | Membership Junction |
| --- | --- |
| `user_id` + `role_id` only | `user_id`, `organization_id`, `role_id` triple |
| Cannot scope roles per tenant | Enables Admin in Org A and Viewer in Org B |
| No cascade on tenant deletion | FK chain enforces `ON DELETE CASCADE` |

Membership is the canonical junction for RBAC in multi-tenant systems. Each record carries:
- **user_id** → `core.users(id)` FK
- **organization_id** → `core.organizations(id)` FK
- **role_id** → `authz.roles(id)` FK
- **UNIQUE(user_id, organization_id, role_id)** constraint

## Query Patterns
Get a user's roles in one tenant:
```sql
SELECT r.name
FROM authz.memberships m
JOIN authz.roles r ON r.id = m.role_id
WHERE m.user_id = :user_id
  AND m.organization_id = :organization_id;
```

Get every user holding a role across tenants:
```sql
SELECT m.organization_id, u.email
FROM authz.memberships m
JOIN core.users u ON u.id = m.user_id
WHERE m.role_id = :role_id;
```

## Diagram (textual)
```
core.users (id) ---┐
                   │  authz.memberships (user_id, organization_id, role_id)
core.organizations (id) ---┤
                   │
authz.roles (id) ---┘
```

## Runtime Guidance
- Always validate membership payloads with `validateMembership` (Zod + JSON Schema).
- Favor deterministic clocks when batch-importing so audit logs remain ordered.
- Use the trait helper to enforce uniqueness before persisting to SQL.
