# Migration Guide: Adding Addressable to Canonical Objects

Sprint 25 introduces the Addressable trait to the Universal Quintet so User and Organization records can expose multiple location roles with validation metadata. This document outlines the steps required for downstream teams to adopt the change safely.

## Summary of Changes

- **User** now composes the `core/Addressable` trait with roles `home`, `billing`, and `shipping`.
- **Organization** composes the same trait with roles `headquarters`, `office`, `warehouse`, and `branch`.
- Generated TypeScript interfaces (`generated/objects/*.d.ts`) include the following new fields for both objects:
  - `address_roles: string[]`
  - `default_address_role?: <role-union>`
  - `addresses?: AddressableEntry[]`
- Storybook stories, integration tests, and usage examples demonstrate the canonical view-models.

## Data Model Impact

| Field | Type | Notes |
|-------|------|-------|
| `address_roles` | `string[]` | Ordered roles with data; default empty array keeps payloads backward compatible. |
| `default_address_role` | string union per object | Optional. Falls back to the first populated role when omitted. |
| `addresses` | `AddressableEntry[]` | Each entry contains `{ role, address, metadata, isDefault, updatedAt }`. Metadata includes validation + geocode signals. |

Existing consumers that ignore unknown properties remain unaffected. All additions are backwards compatible and optional except `address_roles`, which defaults to `[]` for legacy objects without addresses.

## Migration Steps

1. **Schema regeneration** – Run `pnpm generate:objects` (already committed) to pick up the new trait fields.
2. **API contract review** – Surface the new address arrays in downstream DTOs or filter them explicitly if the receiving service cannot handle extra data.
3. **Storage migration** –
   - If User or Organization records are persisted in relational stores, add nullable JSON columns for `addresses` and `address_roles`.
   - Seed existing rows with `address_roles = []` to preserve NOT NULL constraints.
4. **Validation** –
   - Use `AddressableTrait` helpers when constructing payloads to guarantee normalized roles.
   - For manual authoring, run `pnpm test tests/integration/addressable-composition.test.ts` to verify canonical behavior.
5. **View integration** – Update context-aware renderers (list/detail/form) to hydrate `AddressCollectionPanel` using the new fields. Storybook stories under `Objects/*` show the expected layout and token usage.

## Testing Checklist

- [x] `pnpm generate:objects`
- [x] `pnpm vitest run tests/integration/universal-quintet-objects.integration.test.ts`
- [x] `pnpm vitest run tests/integration/addressable-composition.test.ts`
- [ ] Run any domain-specific regression suites (billing, fulfillment) once new address data is propagated downstream.

## Operational Guidance

- Continue to treat `addresses` as source of truth for location metadata. `address_roles` can be used for lightweight contexts where only role names are required.
- `default_address_role` should power badges, summary pills, and default selections in editing surfaces. Fall back to the first populated role when not provided.
- When migrating legacy data, start by populating a single role (e.g., `home` for User, `headquarters` for Organization). The Addressable trait will automatically add the role to `address_roles`.
- Avoid writing raw strings to `addresses`. Use `AddressableTrait.setAddress` to benefit from schema validation, geocode normalization, and deterministic `updatedAt` values.

Reach out to `platform@oods.systems` for adoption support or to request new role definitions.
