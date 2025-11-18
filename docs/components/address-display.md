# AddressDisplay · ValidationStatusBadge

`AddressDisplay` surfaces persisted Addressable entries in list/detail contexts. It pairs the formatter (`formatAddress`) with validation metadata so downstream views can expose role badges, default markers, and geocode hints without rebuilding the pipeline.

## API

```ts
interface AddressDisplayProps {
  entry: AddressableEntry | AddressFormEntry;
  variant?: 'card' | 'inline';
  locale?: string;
  formatOptions?: FormatAddressOptions;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  actions?: React.ReactNode;      // Additional buttons/links
  showRole?: boolean;             // Hide when nested in tables
  showValidation?: boolean;       // Toggle ValidationStatusBadge
  showMapPreview?: boolean;
  mapPreview?: React.ReactNode;   // Custom geocode visual (defaults to lat/lng string)
}
```

At runtime the component:

1. Detects whether `entry` is a fully-normalized `AddressableEntry` or a draft (`AddressFormEntry`). Drafts go through `tryNormalizeDraft`; if a postal address cannot be normalized yet, the component falls back to the raw `addressLines`, locality, and postal code for legibility.
2. Invokes `formatAddress` when a normalized payload exists, ensuring the display stays in sync with UPU S42 templates and locale tweaks.
3. Shows validation posture via `ValidationStatusBadge` (status + provider/timestamp copy) and optional geocode summary (lat/lng + precision) pulled from metadata.
4. Emits action buttons (`Edit`, `Remove`, `Set default`) that downstream view regions can wire into modals or context menus.

`ValidationStatusBadge` is exported separately for list cells and timeline rows. It maps each `AddressValidationStatus` to tone tokens, keeps live text readable under forced colours, and condenses metadata copy when space is limited.

## Usage

```tsx
import { AddressDisplay } from '@/components/addresses';
import { AddressableTrait } from '@/traits/addressable/addressable-trait';

const trait = new AddressableTrait(snapshot, parameters);
const billing = trait.getAddress('billing');

<AddressDisplay
  entry={billing!}
  variant="card"
  onEdit={() => startEditor('billing')}
  onDelete={() => trait.removeAddress('billing')}
  onSetDefault={() => trait.setDefaultRole('billing')}
/>;
```

`AddressDisplay` ships with Chromatic variants (default vs. validation-enriched vs. geocoded) under `stories/components/AddressDisplay.stories.tsx` plus Jest/Vitest coverage inside `tests/components/addresses/address-display.test.tsx`.
