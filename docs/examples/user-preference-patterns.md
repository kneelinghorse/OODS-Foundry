# User Preference Patterns

Reference implementations that show how the Preferenceable trait flows through storage, CLI tooling, and UI surfaces.

## Data Access Patterns

1. **PreferenceStore helper** – Use `PreferenceStore` (or the higher-level `PreferenceableTrait`) whenever you persist or mutate preferences. The store enforces namespaces and bumps metadata timestamps automatically.
   ```ts
   import { PreferenceStore } from '@/traits/preferenceable/preference-store.js';

   const store = new PreferenceStore(
     { document: user.preference_document },
     {
       namespaces: user.preference_namespaces,
       schemaVersion: user.preference_metadata.schemaVersion,
     }
   );

   store.setPreference(['notifications', 'channels', 'sms', 'enabled'], true);
   const snapshot = store.toDocument();
   await persist({
     preference_document: snapshot,
     preference_metadata: snapshot.metadata,
     preference_version: snapshot.version,
     preference_mutations: user.preference_mutations + 1,
   });
   ```

2. **CLI workflows** – The repo ships with `pnpm user:prefs <command>` for local development. Combine with the `--data <path>` flag to experiment without touching canonical fixtures:
   ```bash
   pnpm user:prefs --data tmp/test-preferences.json set usr_1001 theme.density compact
   pnpm user:prefs reset usr_2042
   pnpm user:prefs export usr_1001 | jq '.preferences.privacy'
   ```

3. **Export/import** – Treat CLI exports as transport-friendly snapshots. Downstream services can ingest the JSON directly and run `PreferenceStore` validation before writing to their stores.

## UI Patterns

- **Form + preview pairing** – `src/pages/UserProfileSettings.tsx` demonstrates how to pair the schema-driven form (`PreferenceForm`) with the summary component (`PreferencePreview`). Persisting state outside the form component keeps autosave + diff visualisations straightforward.
- **Namespace badges** – Display `preference_namespaces` as tokens so users understand which capability sets exist in the current tenant/brand. The story at `Objects/User/UserPreferences` contains a production-ready layout.
- **Validation ladder** – Mirror the story’s validation block: show inline validation inside the form (AJV), then surface aggregated issues in a compact panel at the bottom. This pattern keeps settings pages accessible and predictable.

## Reference Assets

| Asset | Description |
|-------|-------------|
| `examples/objects/user-with-preferences.ts` | Serializable User payload with populated preference document (privacy namespace included). |
| `stories/objects/UserPreferences.stories.tsx` | Storybook demo for profile settings + preview. |
| `scripts/preferences/preference-cli.ts` | Source for the CLI helper (get, set, reset, export). |
| `docs/migration/adding-preferenceable.md` | Adopt Preferenceable in downstream services with schema + testing guidance. |

Re-use these patterns when wiring additional objects (Subscription, Organization, etc.) into Preferenceable so that APIs, CLI tooling, and Storybook remain aligned.
