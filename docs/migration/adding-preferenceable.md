# Migration Guide: Adding Preferenceable to Canonical User Objects

Sprint 27 integrates the Preferenceable trait with the canonical User definition so profile settings, notification matrices, and privacy controls share a single JSONB-backed document. This guide walks downstream teams through the change and references the new CLI utilities that ship with the sprint.

## Summary of Changes

- **User** composes `core/Preferenceable` with namespaces `theme`, `notifications`, `display`, and `privacy`.
- Generated definitions (`generated/objects/User.d.ts`) now expose:
  - `preference_document: PreferenceDocument`
  - `preference_metadata: PreferenceMetadata`
  - `preference_version: string`
  - `preference_namespaces: string[]`
  - `preference_mutations?: number`
- Sample fixtures (`src/fixtures/user/*.json`) and examples now include populated preference payloads.
- A CLI (`pnpm user:prefs <command>`) provides basic get/set/reset/export workflows for local testing.
- Storybook contains a `UserPreferences` story that mirrors the profile settings page built in this mission.

## Data Model Impact

| Field | Type | Notes |
|-------|------|-------|
| `preference_document` | `PreferenceDocument` | Canonical JSON document (versioned + metadata) stored alongside User. Required. |
| `preference_metadata` | `PreferenceMetadata` | Materialized metadata block used for auditing and context-aware rendering. Required. |
| `preference_version` | `string` | Mirrors `preference_document.version` so analytics queries avoid JSON extraction. Required. |
| `preference_namespaces` | `string[]` | Snapshot of allowed namespaces resolved from trait parameters. Required; defaults include `privacy`. |
| `preference_mutations` | `number` | Optional monotonic counter used by caches and notification fan-out. |

All additions are backward compatible: defaults hydrate `preference_document` for legacy rows and optional fields remain nullable.

## Migration Steps

1. **Schema regeneration** – Run `pnpm generate:objects` (already checked in) so downstream packages pick up the updated User interface.
2. **Storage updates** – Ensure persistence layers add JSON columns (or JSONB) for `preference_document` + `preference_metadata`. Nullable columns are acceptable while adoption ramps.
3. **API contracts** – Surface the new fields through GraphQL/REST payloads. Consumers that ignore unknown properties continue to work.
4. **Preference mutations** – Increment `preference_mutations` whenever a write occurs. Cache invalidation should key off this field.
5. **CLI validation** – Use the shipped CLI to rehearse flows locally:
   ```bash
   pnpm user:prefs get usr_1001
   pnpm user:prefs set usr_1001 notifications.channels.sms.enabled true
   pnpm user:prefs reset usr_2042
   pnpm user:prefs export usr_1001 > prefs.json
   ```
6. **UI updates** – Integrate the `UserProfileSettings` page (or reuse patterns) so editing surfaces rely on the registry-driven form + preview.

## Testing Checklist

- [x] `pnpm vitest run tests/integration/preferenceable-composition.test.ts`
- [x] `pnpm user:prefs get usr_1001` (sanity check CLI wiring)
- [ ] Run product-specific regression suites that consume User payloads containing preferences.

## Operational Guidance

- Treat `preference_document` as the source of truth. Thin read models or caches should subscribe to `preference_mutations` for invalidation.
- Namespace guardrails default to `theme`, `notifications`, `display`, and `privacy`. If a domain requires additional namespaces, extend the trait parameters at the object definition level rather than bypassing validation in service code.
- Use the CLI or `PreferenceStore` helper when modifying documents so metadata timestamps and schema versions stay consistent.
- The Storybook story under `Objects/User/UserPreferences` documents layout expectations (form + preview) and can be embedded in adoption guides for downstream teams.
