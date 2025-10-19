# Forms (TextField · Select · Checkbox)

Form primitives share a common validation contract (`FieldValidation`) and surface semantic tokens for focus, validation states, and high-contrast fallbacks. Inputs automatically thread `aria-describedby`, `aria-invalid`, and `data-validation-state` so assistive tech receives the same cues as the visual system.

## Components

- **TextField** – Standard text-like input that accepts any native `type`. Optional `description` and `validation` objects flow into assistive descriptions; status-aware CSS variables (`--form-field-*`) style borders, rings, and message copy without literal colour usage.
- **Select** – Native `<select>` wrapper with focus/HC styling and the same validation plumbing. Background arrow is expressed with CSS gradients and is disabled automatically under forced-colors.
- **Checkbox** – Inline control with shared validation handling. Uses `accent-color` tokens for brand parity and guards focus rings for HC users.

## Contract

- `FieldValidation` accepts `{ state: 'info' | 'success' | 'error', message?: ReactNode, id?: string }`. When present, components derive tone tokens via `getToneTokenSet`, expose `data-validation-state`, and emit live-region semantics (`role="status"` or `role="alert"`).
- `density` toggles between `comfortable` and `compact`, adjusting padding and vertical rhythm via CSS custom properties.
- Required indicators render automatically when `required` is true; custom markers can be passed with `requiredIndicator`.

## Usage

```tsx
import {
  TextField,
  Select,
  Checkbox,
  type FieldValidation,
} from '@/components/base';

const validation: FieldValidation = {
  state: 'info',
  message: 'Use a monitored inbox for incident alerts.',
};

<TextField
  id="email"
  label="Email address"
  description="Receives receipts and incident updates."
  validation={validation}
  required
/>;

<Select
  id="plan"
  label="Plan"
  validation={{ state: 'success', message: 'Provisioning synced.' }}
  required
>
  <option value="starter">Starter</option>
  <option value="growth">Growth</option>
</Select>;

<Checkbox
  id="policies"
  label="Agree to billing policies"
  description="Acknowledges dunning cadence."
  validation={{ state: 'error', message: 'Accept the policies to continue.' }}
  required
/>;
```

## Accessibility & Diagnostics

- Components merge `description` and `validation` IDs into `aria-describedby`, ensuring screen readers announce both body copy and state messaging. Errors propagate `aria-invalid="true"` and assertive live regions.
- CSS variables (`--form-field-border`, `--form-field-validation-color`, `--form-field-focus-*`) enable Chromatic audits and brand swaps. Forced-colors overrides in `src/styles/forms.css` keep outlines and text legible without custom media queries per component.
- Storybook under **Forms/** contains density grids, validation states, and the combined **FormExample** used by Playwright to tab through fields and confirm assistive text.
