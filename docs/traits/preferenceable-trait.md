# Preferenceable Trait

> Canonical user preferences capability derived from research mission R21.5. Preferenceable isolates the *User Preference Service* portion of the three-service model (Enterprise Config ➝ User Prefs ➝ Feature Flags) and codifies JSONB storage, schema governance, and runtime helpers into a single trait.

## Scope & Intent

- **Included** – User-level settings such as theme, notification channel × event toggles, display density, and accessibility affordances.
- **Excluded** – Tenant-wide enterprise configuration and feature flag orchestration. Those services feed into Preferenceable via override calculations but are not authored inside the trait. Details live in [`preference-scope-boundaries.md`](./preference-scope-boundaries.md).
- **Storage** – PostgreSQL JSONB column with semver versioning baked into every document.
- **Governance** – JSON Schema registry drives validation + react-jsonschema-form UI generation. Preferenceable only accepts writes that match registry-defined namespaces.

## Canonical Schemas

### `PreferenceDocument`

Defined in [`src/schemas/preferences/preference-document.ts`](../../src/schemas/preferences/preference-document.ts) and exported for tooling through [`generated/types/preferences.d.ts`](../../generated/types/preferences.d.ts).

| Field | Description |
| --- | --- |
| `version` | SemVer tracking preference evolution (`1.0.0`, `1.1.0`, …) |
| `preferences` | Arbitrary JSON object constrained to registered namespaces |
| `metadata` | `PreferenceMetadata` structure with schemaVersion + migration history |

### `PreferenceMetadata`

Located at [`src/schemas/preferences/preference-metadata.ts`](../../src/schemas/preferences/preference-metadata.ts). Tracks:

- `schemaVersion` – registry version currently enforced
- `lastUpdated` / `updatedBy` / `source`
- `migrationApplied[]` – ordered lazy/eager migration records with timestamps

The schemas expose helpers (`normalizePreferenceDocument`, `normalizePreferenceMetadata`) to guarantee deep clones, trimmed values, and deterministic timestamps.

## Trait Definition

- YAML: [`traits/core/Preferenceable.trait.yaml`](../../traits/core/Preferenceable.trait.yaml)
- TypeScript: [`traits/core/Preferenceable.trait.ts`](../../traits/core/Preferenceable.trait.ts)
- Parameter Schema: [`schemas/traits/preferenceable.parameters.schema.json`](../../schemas/traits/preferenceable.parameters.schema.json)

**Parameters**

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `namespaces` | `string[]` | `['theme','notifications','display']` | Allowed top-level keys |
| `schemaVersion` | `string` | `1.0.0` | Registry schema version |
| `allowUnknownNamespaces` | `boolean` | `false` | Escape hatch for migrations |
| `registryNamespace` | `string` | `user-preferences` | Registry lookup key |

**Schema fields**

- `preference_document` – JSONB payload with version + metadata
- `preference_metadata` – denormalized metadata for diagnostics dashboards
- `preference_version` – mirrored SemVer for indexing/analytics
- `preference_namespaces` – hydrated namespace list for UI chips + audit logs
- `preference_mutations` – counter used to bust caches/Redis entries

## Runtime Helper API

`src/traits/preferenceable/preferenceable-trait.ts` wraps `PreferenceStore` to expose a concise API:

```ts
import { PreferenceableTrait } from '@/traits/preferenceable/preferenceable-trait';

const trait = new PreferenceableTrait(
  {
    document: {
      version: '1.0.0',
      preferences: { theme: { mode: 'system' } },
      metadata: { schemaVersion: '1.0.0', lastUpdated: '2025-11-18T00:00:00Z', source: 'user', migrationApplied: [] },
    },
  },
  {
    namespaces: ['theme', 'notifications'],
    defaults: { theme: { mode: 'system' } },
  }
);

trait.setPreference('notifications.mention.email', true);
trait.getPreference('theme.mode'); // => "system"
trait.bumpVersion('1.1.0', { strategy: 'eager', id: 'pref-1-1-0' });
trait.resetToDefaults();
```

**Key methods**

- `getPreference(path)` / `setPreference(path, value)` – dot-notation access with namespace guardrails
- `getPreferences()` – immutable snapshot for serialization
- `resetToDefaults()` – reinstates defaults passed through `options.defaults`
- `bumpVersion(nextVersion, options)` – records migration metadata + updates semver
- `toDocument()` – exports canonical `PreferenceDocument` for persistence/registry sync

## Testing & Guardrails

- Schema tests: [`tests/schemas/preferences.test.ts`](../../tests/schemas/preferences.test.ts) cover normalization and metadata validation.
- Trait tests: [`tests/traits/preferenceable.test.ts`](../../tests/traits/preferenceable.test.ts) exercise YAML parsing, parameter validation (`ParameterValidator`), namespace enforcement, and runtime version bumps.
- Docs: [`docs/traits/preference-scope-boundaries.md`](./preference-scope-boundaries.md) spells out what belongs in this trait vs. enterprise config + feature flags.

Combined, these artifacts hit every success criterion from Mission B27.1: documented scope boundaries, canonical schema, runtime helpers, generated types, and comprehensive unit tests.
