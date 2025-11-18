# AddressForm · AddressFieldSet · RoleSelector

Sprint 25 introduces Address UI primitives that pair the Addressable trait with the international formatting + validation engine. `AddressForm` composes three exported pieces:

- **RoleSelector** – Deterministic role dropdown with optional dynamic-role creation that enforces the trait's slug rules (`normalizeAddressRole`).
- **AddressFieldSet** – Template-driven field group that reorders inputs based on the active UPU S42 format, injects required flags from template tokens, and surfaces inline correction/status messages from validation metadata.
- **AddressForm** – High-level orchestrator that wires the role selector, country/template selector, validation status badge, `AddressFieldSet`, and call-to-action buttons together.

`src/components/addresses/address-form.tsx` exports all of these along with conversion helpers in `address-types.ts`.

## Key Props

```ts
interface AddressFormProps {
  entry: AddressFormEntry;               // role + editable AddressDraft + metadata
  roles?: readonly string[];            // allowed roles (mirrors trait parameter)
  allowCustomRoles?: boolean;           // opt-in dynamic role entry
  onEntryChange?: (next: AddressFormEntry) => void;
  onValidate?: (entry, normalized: Address | null) => void;
  validationComponents?: ComponentValidationResult[]; // provider verdict details
  locale?: string;                      // forwarded to Intl.DisplayNames + formatter
  countryOptions?: AddressCountryOption[]; // override default template list
  templateKey?: string;                 // force a template (e.g., editing archived data)
  density?: 'comfortable' | 'compact';  // threads into TextField/Select primitives
  disabled?: boolean;
  isBusy?: boolean;                     // flips CTA label to "Validating…"
  actions?: React.ReactNode;            // inject save/reset buttons next to Validate
}
```

`AddressFormEntry` intentionally mirrors `AddressableEntry` (role, metadata, `isDefault`). Helpers in `address-types.ts` convert between the two so domain objects can hydrate the form without bespoke glue.

## Template + Validation Awareness

- Country selector uses `listTemplates()` + `Intl.DisplayNames` to present human-readable options. Selecting a country updates `address.countryCode` _and_ the backing `formatTemplateKey`, which in turn reflows the `AddressFieldSet` ordering.
- Template tokens flagged with `| required` propagate directly to `TextField` `required` props so the browser, screen readers, and the trait engine share the same expectations.
- Validation metadata (`AddressMetadata.correctedAddress` + `validation_provider` details) flows into two channels:
  - `ValidationStatusBadge` (badge + provider/timestamp copy)
  - Inline helper messages for each component when the provider returns corrected values or `ComponentValidationResult` statuses (`missing`, `unconfirmed`, `inferred`).
- `AddressFieldSet` exposes `autoComplete` hints (`address-line1`, `address-level2`, `postal-code`, etc.) to satisfy the "autocomplete support" acceptance criterion.

## Usage

```tsx
import { AddressForm, toAddressFormEntry, type AddressFormEntry } from '@/components/addresses';
import type { AddressableEntry } from '@/traits/addressable/address-entry';

const entry: AddressableEntry = trait.getAddress('billing')!;
const [formEntry, setFormEntry] = useState<AddressFormEntry>(() => toAddressFormEntry(entry));

<AddressForm
  entry={formEntry}
  roles={['billing', 'shipping', 'warehouse']}
  allowCustomRoles
  onEntryChange={setFormEntry}
  onValidate={(payload, normalized) => {
    if (!normalized) return;
    queueValidation(normalized);
  }}
  validationComponents={providerVerdict?.components}
  locale="en-US"
/>;
```

The component is controlled by default but falls back to internal state when `onEntryChange` is omitted (used by Storybook demos). Guardrails:

- Max three address lines (`ADDRESS_MAX_LINES`) with explicit add/remove affordances.
- Country + template selectors are keyboard navigable and merge validation messages with the shared `FieldValidation` contract from `base/forms`.
- CTA button disables itself when `onValidate` is missing or the draft cannot be normalized yet (country/line gaps).

## Diagnostics & Testing

- `tests/components/addresses/address-form.test.tsx` exercises template switching, field propagation, and role additions.
- `tests/components/addresses/address-form.a11y.test.tsx` runs `axe` to ensure the composed form meets accessibility guardrails (focus order, live regions, required cues).
- Storybook (`stories/components/AddressForm.stories.tsx`) includes US/UK/JP variants plus validation states for Chromatic regression.
