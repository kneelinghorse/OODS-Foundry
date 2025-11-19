# AuthZ Schema Registry Guide

> **References:** R21.2 Part 4.2 TABLE 1-4, R21.2 Part 3.1 (hierarchy)

The registry at `data/authz-schemas/registry.json` mirrors the canonical RBAC objects published in R21.2. It powers three workflows:
1. **Runtime Zod/AJV validation** via `schema-registry.ts` and `schema-validator.ts`.
2. **DTO generation** through `pnpm authz:generate-types` (writes `generated/types/authz.d.ts`).
3. **CLI diagnostics** that verify schema compatibility before shipping migrations.

## Schema IDs
| ID | Description | Citation |
| --- | --- | --- |
| `role` | System-wide roles | Part 4.2 TABLE 1 |
| `permission` | `resource:action` permissions | Part 4.2 TABLE 2 |
| `membership` | User ↔ Org ↔ Role junction | Part 2.2 & TABLE 4 |
| `role-hierarchy` | Parent → child adjacency edge | Part 3.1 |

## Usage
```ts
import { schemaRegistry } from '@/traits/authz/schema-registry';
import { validateRole } from '@/traits/authz/schema-validator';

const role = validateRole({ id: '...', name: 'Admin' });
if (!role.success) {
  throw new Error(role.errors[0]?.message ?? 'Invalid role');
}

const schemas = schemaRegistry.listSchemas();
```

Run the generator whenever `registry.json` changes:
```bash
pnpm authz:generate-types
```

## Compatibility
`schemaRegistry.assertVersionCompatible(id, version)` ensures that downstream services pin to the same registry version (`1.0.0` for Sprint 28). Add this check to migrations so future extension packs can introduce new versions without breaking old consumers.
