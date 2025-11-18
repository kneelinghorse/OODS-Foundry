# CategoryPicker

CategoryPicker composes `useCategoryTree` with form affordances: search, multi-select chips, recently-used shortcuts, and hidden inputs for submit-friendly payloads. It satisfies the Sprint 26 Classifiable requirements for Form context.

## Highlights

- **Typeahead search** – Debounced-less search writes into the shared tree state so results stay in sync with the tree rendering and breadcrumbs.
- **Multi-select chips** – Primary selections surface as dismissible chips; clicking a chip toggles the node through the shared tree state, keeping summaries and the tree in lockstep.
- **Recently used** – Pass `recentlyUsedIds` to render quick chips above the tree. Chip clicks toggle membership and emit `onRecentlyUsedSelect` for custom analytics.
- **Form integration** – Provide a `name` to emit hidden `<input>` elements for each selected category, ensuring the picker works inside native `<form>` submissions.
- **Validation ready** – Leverages existing `form-field` tokens so density, validation states, and required indicators match other base inputs.

## Usage

```tsx
import { CategoryPicker } from '@/components/classification/CategoryPicker.js';
import type { CategoryNode } from '@/schemas/classification/category-node.ts';

const taxonomy: CategoryNode[] = loadTaxonomy();

export function ClassificationEditor() {
  return (
    <CategoryPicker
      id="product-categories"
      name="categories[]"
      nodes={taxonomy}
      label="Categories"
      description="Pick every taxonomy node that applies to the SKU."
      recentlyUsedIds={['electronics', 'mobile-phones']}
      onSelectionChange={({ ids }) => console.log('Selected:', ids)}
      onReorder={({ sourceId, targetId }) => console.log('Reorder', sourceId, targetId)}
    />
  );
}
```

### Props cheatsheet

| Prop | Purpose |
| --- | --- |
| `recentlyUsedIds` | Highlights a chip row for fast re-selection. |
| `enableReorder` | Wires drag-and-drop back to taxonomy editing flows. Defaults to `false` to avoid accidental hierarchy edits in forms. |
| `summaryLabel` | Customizes the chip container heading. |
| `maxHeight` | Constrains the tree viewport for layout needs. |

## Tests & Guardrails

- Logic/interaction coverage: `tests/components/classification/CategoryPicker.test.tsx`
- A11y inherits from CategoryTree axe coverage, plus jest-dom assertions in the picker spec for label associations and hidden input wiring.

## Implementation Notes

- All styling uses component/system tokens. There are no literal colors.
- Drag intent shortcuts mirror CategoryTree (`Shift` before, `Alt/⌘` after, default inside) when `enableReorder` is `true`.
- Search input + tree share ARIA wiring through `resolveFieldMetadata`, so validation status and descriptions are consistent with other base form controls.
