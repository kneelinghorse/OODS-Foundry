# PreferenceForm

PreferenceForm renders the Preferenceable trait schemas through [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) with the OODS theme. The component automatically resolves the active preference schema from the registry, maps widgets to the tokenised `form-field` styles, and emits structured change payloads that include the schema version so persistence layers can dual-write safely.

## Features

- **JSON Schema-driven UI** – schema + uiSchema definitions from `data/preference-schemas/registry.json` determine the complete surface area (theme, notifications, privacy, display, etc.). Conditional `if/then/else` definitions are honoured automatically.
- **RJSF theme** – `src/components/preferences/oods-rjsf-theme.tsx` replaces the default widgets with token-aware controls so every generated input inherits the same focus, density, and validation treatments as hand-authored components.
- **Form context integration** – the component sets `data-context="form"`, propagates context metadata through `formContext`, and respects density overrides so FormView rhythm stays intact.
- **Live validation** – `liveValidate` is enabled by default and `onValidationChange` returns a flattened `issues[]` array for inline messaging and analytics.
- **Preview pipeline** – combine `PreferenceForm`, `usePreferenceForm`, and `PreferencePreview` to show a read-only summary alongside the live form.

## Usage

```tsx
import { PreferenceForm, PreferencePreview } from '@/components/preferences/index.js';
import { usePreferenceForm } from '@/hooks/usePreferenceForm.js';

export function PreferencesPanel() {
  const preferenceForm = usePreferenceForm();

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <PreferenceForm {...preferenceForm.formProps} />

      <aside className="sticky top-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wide text-[--sys-text-muted]">
            Current selections
          </h3>
          <button type="button" className="text-sm font-medium" onClick={preferenceForm.resetToDefaults}>
            Reset to defaults
          </button>
        </div>
        <PreferencePreview
          document={preferenceForm.document}
          sections={preferenceForm.previewSections}
        />
      </aside>
    </div>
  );
}
```

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `version` | `string` | Optional schema version. Omit to use the latest registry entry. |
| `document` | `PreferenceDocument` | Overrides the hydrated document (defaults to the schema metadata example). |
| `schema` / `uiSchema` | `RJSFSchema` / `UiSchema` | Optional overrides when a view needs to hide/show specific groups. |
| `density` | `'comfortable' \| 'compact'` | Overrides the density enforced by the Form context metadata. |
| `onDocumentChange` | `(payload) => void` | Receives `{ document, version }` every time the form changes. |
| `onValidationChange` | `(state) => void` | Receives `{ document, version, issues[] }` so telemetry layers can persist error counts. |

All other `FormProps` from `@rjsf/core` are forwarded via `...rest`.

### PreferencePreview

`PreferencePreview` flattens `document.preferences` into readable cards so reviewers can scan the entire payload before persisting. Pass a custom `sections` array to control grouping, or rely on the default behaviour which creates one section per top-level preference key.

```tsx
<PreferencePreview
  document={document}
  sections={buildPreferencePreviewSections(document)}
  className="mt-4"
/>
```

### usePreferenceForm

`usePreferenceForm` coordinates local state, change propagation, reset buttons, and preview data:

```ts
const preferenceForm = usePreferenceForm({
  version: '2.0.0',
  initialDocument: existingPreferences,
  onChange: ({ document }) => persist(document),
});

preferenceForm.resetToDefaults();
preferenceForm.resetToInitial();
preferenceForm.validationIssues; // flattened list derived from onValidationChange
```

Returned fields:

- `schema` – resolved definition from the registry (includes metadata + migrations)
- `document` – current form data, kept in sync with RJSF
- `formProps` – spread directly onto `<PreferenceForm>`
- `previewSections` – pre-built array suitable for `<PreferencePreview>`
- `isDirty` – compares against the initial document snapshot
- `resetToDefaults` / `resetToInitial` – convenience helpers for UI buttons

## Accessibility & theming

- Every widget inherits tokenised classes so focus rings, validation states, and forced-colour support match the `forms.css` contract.
- `liveValidate` keeps errors in sync with axe guidance (role="alert" for critical states, polite announcements for help text).
- `data-context="form"` ensures context-specific spacing/typography apply automatically when rendered inside `FormView`.
- `PreferencePreview` uses semantic headings + definition lists so screen-readers can navigate each section.

## Files

- `src/components/preferences/PreferenceForm.tsx`
- `src/components/preferences/oods-rjsf-theme.tsx`
- `src/components/preferences/PreferencePreview.tsx`
- `src/hooks/usePreferenceForm.ts`
- `tests/components/preferences/*`
