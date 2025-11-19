# JSON Schema UI Patterns for Preferenceable

The Preferenceable trait now ships with an end-to-end UI pipeline: schemas live in the registry, `PreferenceForm` renders them via RJSF, `usePreferenceForm` manages state + validation, and `PreferencePreview` explains the final payload. This document captures the recommended pattern so missions can extend Sprint 27 without re-learning RJSF internals.

## Architecture

1. **Schema registry** – `data/preference-schemas/registry.json` stores `schema`, `uiSchema`, metadata, migrations, and realistic examples for each version.
2. **Runtime APIs** – `resolvePreferenceSchema(version)` resolves the versioned definition, `getPreferenceExample(version)` returns hydrated samples.
3. **UI layer** – `PreferenceForm` + `oodsRjsfTheme` translate schema definitions into token-aware controls (radios, toggles, select, checkbox matrices, nested objects, arrays, etc.).
4. **State hooks** – `usePreferenceForm` abstracts controlled form state, reset workflows, preview data, and flattened validation issues so the page shell remains declarative.
5. **Preview** – `PreferencePreview` renders the pending document in a scannable card. It is intentionally schema-agnostic; new versions continue to work without additional code.

## Implementation pattern

```tsx
const preferenceForm = usePreferenceForm({ version: '2.0.0' });

return (
  <ViewContextProvider value="form">
    <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <PreferenceForm {...preferenceForm.formProps} />

      <aside>
        <header className="flex items-center justify-between">
          <h2>Summary</h2>
          <button onClick={preferenceForm.resetToDefaults}>Reset to defaults</button>
        </header>
        <PreferencePreview
          document={preferenceForm.document}
          sections={preferenceForm.previewSections}
        />
      </aside>
    </section>
  </ViewContextProvider>
);
```

### Conditional logic

- JSON Schema `if/then/else` definitions (e.g., *require `notifications.sms.phoneNumber` when SMS is enabled*) work out of the box because `@rjsf/validator-ajv8` runs in `liveValidate` mode.
- Use the provided validation payload (`onValidationChange`) to surface the condensed issue list in toolbars, progress indicators, or analytics dashboards:

```ts
const handleValidationChange = ({ issues }) => {
  const blocking = issues.filter((issue) => issue.path.includes('notifications'));
  setNotificationErrors(blocking.length);
};
```

### Theming guardrails

- Widgets reuse `form-field` classes and `--cmp-*` tokens; never inject custom colours or spacing.
- `formContext` always includes `density`, `viewContext`, and `metadata` so bespoke widgets can read context constraints.
- Forced colours and HC are satisfied by reusing the existing CSS variables (see `forms.css`).

### Preview heuristics

`buildPreferencePreviewSections(document)` flattens nested paths into human readable labels. It converts booleans to `Enabled/Disabled`, arrays to comma-separated lists, and leaves nested records expanded (no more bespoke string builders per sprint).

### Testing guidelines

- **Rendering** – `tests/components/preferences/PreferenceForm.test.tsx` interacts with radios, checkboxes, and conditional logic to ensure the RJSF theme stays wired up.
- **Accessibility** – `tests/components/preferences/PreferenceForm.a11y.test.tsx` runs `axe` against the generated form to guard label + focus regressions.
- **Integration** – `tests/traits/preferenceable/rjsf-integration.test.tsx` verifies older schema versions still render and emit the correct version identifiers.

### Storybook coverage

`stories/components/PreferenceForm.stories.tsx` documents six scenarios:

1. Default layout with live preview + reset button
2. Theme-only configuration (radio + density select)
3. Notification matrix (channel × policy)
4. Conditional SMS enforcement
5. Nested display + privacy fields
6. Compact density demonstration for read-only contexts

Chromatic snapshots cover light/dark/HC automatically because the widgets use CSS variables.

## When to extend

- New schema versions only require updates to the registry JSON. The UI automatically reflects the new structure.
- If the uiSchema adds bespoke widgets, create them inside `oods-rjsf-theme.tsx` so they participate in the same accessibility + token guardrails.
- When integrating PreferenceForm into product surfaces, wrap the area in `ViewContextProvider` (`value="form"`) or drop it inside `FormView` so spacing/typography stay aligned.
