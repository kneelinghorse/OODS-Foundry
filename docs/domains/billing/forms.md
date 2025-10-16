# Billing Form Patterns

Billing form surfaces share a single token-driven contract so subscription and invoice workflows look identical regardless of provider data. Patterns ship in Storybook under `Billing/Subscription.Form-Scenarios` and `Billing/Invoice.Form-Scenarios`.

## Validation states

- `FieldGroup` exposes legend-level tone controls (`valid`, `invalid`, `warning`, `info`, `disabled`) while keeping inputs component-pure.
- Group messages inherit tone defaults, so success and warning callouts render without inline color overrides.
- Disabled groups apply both `fieldset[disabled]` and `data-disabled` so nested components and CSS respect governance locks.

## Computed fields

- Proration previews derive from canonical renewal amounts; the helper converts billing cadence to day rates and returns rounded minor units.
- Inputs remain read-only with `tone="info"` and `data-selected` for emphasis—no imperative styling.
- Credit memo scenarios in invoice forms reuse the same helpers, exposing both minor-unit entry and formatted currency guidance.

## Accessibility

- `ValidationBanner` now accepts a `status` flag; `pending` surfaces async states with `aria-busy`, while `error` and `warning` map to alerts.
- Group `aria-describedby` chains legend help, inline guidance, and error copy, ensuring screen readers announce context once.
- Required vs optional text stays in `RequiredOptional`, so HC and screen reader signals align with tokens.
