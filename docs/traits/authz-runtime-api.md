# AuthZ Runtime Services (B28.3)

> Mission B28.3 delivers the runtime layer that sits on top of the Sprint 28
> schema work. The services described below are production-ready helpers for
> querying memberships, traversing the role graph, and resolving entitlements
> with cache-friendly metadata.

## Modules

| Module | Description |
| --- | --- |
| `RoleGraphResolver` | Executes recursive CTEs to walk `authz.role_hierarchy` and materialise role + permission inheritance. |
| `MembershipService` | CRUD helper for `authz.memberships` with strict prepared statements and timestamp management. |
| `EntitlementService` | High-level API for resolving user permissions, performing checks, and emitting cache keys for B28.5. |

## API Reference

### `RoleGraphResolver`

```ts
const resolver = new RoleGraphResolver(pool, { depthLimit: 5 });

const hierarchy = await resolver.resolveRoleHierarchy(roleId);
// → [{ id: 'admin-id', name: 'Admin', depth: 0 }, { id: 'manager-id', depth: 1 }, ...]

const permissions = await resolver.getInheritedPermissions(roleId);
// → PermissionDocument[] sorted by name
```

- Uses `WITH RECURSIVE` query with a cycle guard (`path` array).
- Enforces configurable depth limit (default: 5) to keep traversals bounded.
- Throws `RoleGraphResolverError` when the role does not exist.

### `MembershipService`

```ts
const membership = await membershipService.assignRole(userId, orgId, roleId);
await membershipService.revokeRole(userId, orgId, roleId);
const userMemberships = await membershipService.listUserMemberships(userId, orgId?);
const orgMembers = await membershipService.listOrgMembers(orgId);
```

- Performs UPSERT via `ON CONFLICT (user_id, organization_id, role_id)` to keep audit timestamps accurate.
- All queries use positional parameters (`$1`, `$2`, …) for injection resistance.
- Returns validated `MembershipDocument` objects (Zod schema) so downstream consumers never need to coerce timestamps.

### `EntitlementService`

```ts
const entitlements = await entitlementService.getUserPermissions(userId, orgId);
const hasAccess = await entitlementService.hasPermission(userId, orgId, 'org:manage');
const roles = await entitlementService.getUserRoles(userId, orgId);
const snapshot = await entitlementService.resolveUserPermissions(userId, orgId);
// snapshot.cacheKey → entitlements:<org>:<user>:<sha1>
```

- Internally composes `MembershipService` + `RoleGraphResolver` so callers do not juggle low-level APIs.
- Returns permission snapshots sorted deterministically to stabilise cache keys.
- Interprets permission probes as either UUIDs or `resource:action` names.

## Query & Performance Characteristics

| Operation | SQL Pattern | Target |
| --- | --- | --- |
| Role hierarchy traversal | Recursive CTE with adjacency list join | `<10ms` worst-case depth 5 |
| Entitlement resolution | 1 membership list + N CTE calls (memoized) | `<5ms` p99 (`tests/performance/authz-benchmarks.test.ts`) |
| Permission check | Set membership against cached snapshot | `<2ms` p99 |

- `tests/performance/authz-benchmarks.test.ts` executes 64 iterations and enforces the latency gates above.
- The “100 concurrent users” scenario is represented by concurrent `Promise.all` resolution staying below 50 ms.
- All database access occurs through pooled pg clients; the services accept any implementation that matches `query(text, params)` to simplify wiring.

## Caching Strategy (B28.5 Integration Point)

- `EntitlementService.resolveUserPermissions()` emits `{ permissions, roles, cacheKey, generatedAt }`.
- Cache key format: `entitlements:<orgId>:<userId>:<sha1(roleIds)>`. Deterministic ordering ensures stable invalidation and allows B28.5 to plug into Redis/Preferenceable cache transports.
- The resolution method memoizes per-role permission lookups during a request, making it cheap to attach a thin LRU/redis wrapper in the next mission without rewriting business logic.
- Downstream caches can store the snapshot as-is; invalidation triggers remain the membership CRUD helpers (they centralise assignments and revocations).

## Usage Notes

1. Always call `getUserPermissions` / `hasPermission` with both `userId` **and** `organizationId`. Org isolation is enforced at the query layer and verified by tests.
2. When adding new roles or permissions, prefer updating the seed scripts and re-running `authz:seed`. The runtime services assume canonical tables stay in sync with `authz.roles` / `authz.permissions`.
3. Keep hierarchy depth ≤5 (per success criteria). For deeper trees, pass a custom `depthLimit` to `RoleGraphResolver` and confirm with new benchmarks.

## References

- R21.2 Part 3.1 — Recursive CTE guidance for RBAC hierarchies.
- Mission B28.3 YAML — Full deliverable list including runtime, tests, and docs.
- `docs/database/authz-schema-guide.md` — Column-level schema documentation for all referenced tables.
