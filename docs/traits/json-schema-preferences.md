# Preferenceable JSON Schema Registry

The Preferenceable trait now exposes a JSON Schema-driven workflow that keeps backend validation, generated types, and UI rendering aligned. Three authoritative schema versions live under `data/preference-schemas/registry.json`:

- **1.0.0** – Baseline theme + notification schema.
- **1.1.0** – Adds digest cadence plus contrast toggles (backward compatible).
- **2.0.0** – Introduces privacy controls and the keyed notification-channel map (breaking).

Each entry stores the schema, uiSchema, migration metadata, and an example document that downstream tools can hydrate automatically.

## Runtime APIs

```ts
import {
  getPreferenceSchema,
  listPreferenceSchemas,
  getPreferenceExample,
} from '@/traits/preferenceable/schema-registry.js';
import {
  validatePreferenceDocument,
} from '@/traits/preferenceable/schema-validator.js';
import {
  analyzeSchemaCompatibility,
  generateMigrationPlan,
} from '@/traits/preferenceable/compatibility-checker.js';
import {
  generatePreferenceTypes,
} from '@/traits/preferenceable/type-generator.js';
```

- **Registry** – `listPreferenceSchemas()` surfaces human-readable summaries, while `getPreferenceSchema(version)` returns the full schema/uiSchema pair plus metadata and migration hints.
- **Validation** – `validatePreferenceDocument(document, { version })` compiles an Ajv validator per version and returns structured `ValidationIssue[]` payloads that match the rest of the trait engine.
- **Compatibility** – `analyzeSchemaCompatibility(from, to)` flattens both schemas and highlights added, removed, or type-reflowed paths. `generateMigrationPlan(from, to)` replays the curated migration steps baked into the registry metadata.
- **Type generation** – `generatePreferenceTypes({ version })` wraps `json-schema-to-typescript`, emitting ready-to-commit DTOs such as `PreferenceDocumentV1_1_0` to eliminate drift between JSON Schema contracts and TypeScript consumers.

## RJSF-Powered UI

`src/components/preferences/PreferenceForm.tsx` is a thin wrapper around `react-jsonschema-form`:

```tsx
<PreferenceForm
  version="1.1.0"
  document={document}
  onDocumentChange={({ document: next }) => setDocument(next)}
/>
```

- The component resolves the matching schema/uiSchema from the registry, defaults the validator to `@rjsf/validator-ajv8`, and emits structured change payloads containing both the updated document and the resolved schema version.
- `src/components/preferences/oods-rjsf-theme.tsx` overrides the default FieldTemplate so that generated forms inherit OODS typography, spacing, and tokenized colors without duplicating component styles.

## Examples & Migration Aids

- Realistic sample documents for each schema version live in `examples/preferences/schema-v{1,1.1,2}.json`.
- `data/preference-schemas/registry.json` stores migration steps (`lazy` vs `eager`) that downstream services can replay to keep JSONB snapshots synchronized with new schema releases.

Use this document as the canonical reference whenever a mission touches preference schemas, UI generation, or migration planning in Sprint 27.
