# Progression Components

## Overview

The progression components provide feedback about system operations and guide users through multi-step workflows. This document covers the **Progress** (linear and circular) and **Stepper** components delivered in Sprint 18.

## Components

### Progress Components

Progress indicators communicate the status of ongoing system operations to users. They come in two visual variants:

- **ProgressLinear**: Horizontal or vertical bar progress indicator
- **ProgressCircular**: Circular/ring progress indicator

#### When to Use

- **Determinate progress**: Use when you can calculate the percentage complete (e.g., file upload, data processing with known duration)
- **Indeterminate progress**: Use when the duration is unknown (e.g., loading data, waiting for external API)

#### Usage Guidelines

**Determinate Progress:**

```tsx
import { ProgressLinear, ProgressCircular } from '@oods/components';

// Linear progress bar
<ProgressLinear value={65} intent="info" label="Upload progress" />

// Circular progress
<ProgressCircular value={75} intent="success" label="Processing" />
```

**Indeterminate Progress:**

```tsx
// Linear indeterminate
<ProgressLinear isIndeterminate intent="info" label="Loading content" />

// Circular spinner
<ProgressCircular isIndeterminate intent="info" label="Loading..." />
```

#### Props Reference

**Common Props (both variants):**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Progress value (0-100). Omit for indeterminate state. |
| `max` | `number` | `100` | Maximum value for progress calculation |
| `intent` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Semantic intent mapped to Statusables tokens |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `label` | `string` | — | Accessible label for screen readers (required) |
| `isIndeterminate` | `boolean` | `false` | Force indeterminate state |

**ProgressCircular-specific:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `diameter` | `number` | `40` | Diameter of the circle in pixels |
| `strokeWidth` | `number` | `4` | Width of the progress stroke in pixels |

#### Intent-to-Token Mapping

All progress components derive their presentation from Statusables tokens surfaced as CSS custom properties:

- The indicator fill resolves to `var(--cmp-status-{tone}-border)` for the chosen intent.
- The track background always maps to `var(--cmp-status-neutral-surface)` to maintain contrast.
- Supported tones: `info`, `success`, `warning`, `critical` (via the `error` intent).

Literal color values are never emitted; tests assert that only Statusables-backed variables are used so theme swaps remain safe.

#### Size Tokens

Linear progress height is controlled via:

- **sm**: `4px`
- **md**: `6px`
- **lg**: `8px`

#### Accessibility

Progress components follow WCAG 2.1 AA requirements:

- `role="progressbar"` on container
- **Determinate**: Must include `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- **Indeterminate**: Omit value attributes (per spec)
- `aria-label` should describe the operation (e.g., "Upload progress", "Loading content")

**Example:**

```tsx
// ✅ Good: Descriptive label
<ProgressLinear value={50} label="Uploading profile photo" />

// ❌ Bad: Missing label
<ProgressLinear value={50} />
```

---

### Stepper Component

The Stepper component guides users through multi-step workflows, providing visual feedback on progress and allowing navigation between steps.

#### When to Use

- Multi-step forms (e.g., account creation, checkout)
- Configuration wizards
- Onboarding flows
- Any sequential process with 3+ discrete steps

#### Usage Guidelines

**Basic Linear Stepper:**

```tsx
import { Stepper } from '@oods/components';

const steps = [
  { id: '1', label: 'Account', status: 'completed' },
  { id: '2', label: 'Billing', status: 'current' },
  { id: '3', label: 'Confirm', status: 'incomplete' },
];

<Stepper
  steps={steps}
  activeStepId="2"
  isLinear={true}
/>
```

**Non-Linear Stepper (with navigation):**

```tsx
const [activeId, setActiveId] = useState('1');

<Stepper
  steps={steps}
  activeStepId={activeId}
  isLinear={false}
  onStepClick={(id) => setActiveId(id)}
/>
```

**Vertical Orientation:**

```tsx
<Stepper
  steps={steps}
  activeStepId="2"
  orientation="vertical"
/>
```

#### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `StepDescriptor[]` | — | Array of step descriptors (required) |
| `activeStepId` | `string` | — | ID of the currently active step (required) |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `isLinear` | `boolean` | `true` | Enforce sequential progression |
| `onStepClick` | `(stepId: string) => void` | — | Callback when step is clicked |

#### Step Descriptor Schema

```typescript
interface StepDescriptor {
  id: string;                    // Unique identifier
  label: string;                 // Display label
  description?: string;          // Optional subtitle (vertical mode)
  status: StepStatus;            // Current status
  isDisabled?: boolean;          // Prevent interaction
  isOptional?: boolean;          // Mark as skippable
}

type StepStatus =
  | 'incomplete'   // Future step not started
  | 'current'      // Active step
  | 'completed'    // Successfully finished
  | 'error'        // Has validation errors
  | 'disabled'     // Not accessible
  | 'optional';    // Can be skipped
```

#### Token Mapping

Stepper styling is also token-driven. Each step resolves to a Statusables tone (`success`, `info`, `critical`, `neutral`, `accent`) and writes the following variables into the DOM:

- `--stepper-step-border-color` and `--stepper-step-fill-color` → `var(--cmp-status-{tone}-border)`
- `--stepper-step-icon-color` / text color → `var(--cmp-status-{tone}-text)` (with neutral/disabled fallbacks)
- Connectors hydrate `--stepper-connector-color` and `--stepper-connector-active-color` from neutral and info tones.

Tests guard against introducing literal color values so multi-brand themes continue to work without additional QA.

#### Behavior Modes

**Linear Mode (`isLinear={true}`):**
- Users must complete steps sequentially
- Future steps are not clickable
- Only completed and current steps can be navigated to
- Use for tightly controlled processes (e.g., payment flows)

**Non-Linear Mode (`isLinear={false}`):**
- Users can navigate to any step
- All non-disabled steps are clickable
- Use for complex configurations where users may need to jump between sections
- `onStepClick` callback is required

#### Status Visual Indicators

| Status | Icon | Color Token |
|--------|------|-------------|
| `completed` | ✓ (checkmark) | `color.icon.success` |
| `current` | Step number | `color.icon.interactive` |
| `error` | ✕ (error mark) | `color.icon.danger` |
| `incomplete` | Step number | `color.icon.secondary` |
| `disabled` | Step number | `color.icon.disabled` |
| `optional` | Step number | `color.icon.secondary` |

#### Accessibility

Stepper follows ARIA authoring practices:

- Container has `role="list"` and `aria-label="Progress steps"`
- Current step marked with `aria-current="step"`
- Interactive steps have `role="button"` and `tabindex="0"`
- Disabled steps have `aria-disabled="true"`
- Keyboard navigation: Tab to focus, Enter/Space to activate

**Best Practices:**

```tsx
// ✅ Good: Clear labels, descriptions for vertical
const steps = [
  {
    id: '1',
    label: 'Create Account',
    description: 'Enter email and password',
    status: 'completed'
  },
  {
    id: '2',
    label: 'Verify Email',
    description: 'Check your inbox',
    status: 'current'
  },
];

// ❌ Bad: Vague labels
const steps = [
  { id: '1', label: 'Step 1', status: 'current' },
  { id: '2', label: 'Step 2', status: 'incomplete' },
];
```

---

## Token Governance

All progression components enforce token-based theming and **prohibit literal color values**. The build will fail if:

- Literal hex/rgb colors are introduced in component code
- Components bypass the canonical Statusables token map
- CSS variables are not properly scoped

### Enforced by:

- ESLint rule: `no-literal-colors`
- Token validation in CI: `pnpm run validate:tokens`
- VRT baselines in Chromatic

---

## Testing Guidance

### Unit Tests

All components include comprehensive unit tests covering:

- Rendering with all props/variants
- ARIA attribute correctness
- Token-based CSS variable application
- Edge cases (value clamping, missing labels)

Run tests:

```bash
pnpm test tests/components/progress.test.tsx
pnpm test tests/components/stepper.test.tsx
```

### Visual Regression

Storybook stories are tagged for Chromatic VRT:

- All intent variants (info, success, warning, error)
- All size variants
- Determinate/indeterminate states
- Horizontal/vertical orientations
- All step statuses

---

## Migration from Legacy Components

If upgrading from a previous progress/stepper implementation:

1. **Replace progress bars** with `<ProgressLinear>` or `<ProgressCircular>`
2. **Map status colors** to `intent` prop (info/success/warning/error)
3. **Add accessibility labels** via `label` prop
4. **Update step schemas** to use canonical `StepDescriptor` format
5. **Use `isLinear` prop** to control navigation behavior

### Before:

```tsx
<div className="progress-bar" style={{ width: '50%', backgroundColor: '#3b82f6' }} />
```

### After:

```tsx
<ProgressLinear value={50} intent="info" label="Upload progress" />
```

---

## Related Components

- **Toast**: For transient feedback (see B18.6)
- **Badge**: For status indicators (see B15.2)
- **Banner**: For persistent messaging (see B15.2)

---

## References

- Research: `cmos/missions/research/R18.1_Technical-Research-Report-Component-Set-IV.md`
- Mission: `cmos/missions/sprint-18/B18.1_progress-and-stepper.yaml`
- Stories: `stories/components/Progress.stories.tsx`, `stories/components/Stepper.stories.tsx`
- Tests: `tests/components/progress.test.tsx`, `stepper.test.tsx`
