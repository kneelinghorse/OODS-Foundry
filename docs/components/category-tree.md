# CategoryTree

CategoryTree renders hierarchical taxonomy data (ltree-backed `CategoryNode[]`) with keyboard navigation, drag-and-drop reordering, and breadcrumb context that satisfies the Classifiable trait success criteria.

## Highlights

- **Keyboard tree pattern** – Implements the WAI-ARIA tree interaction model. Arrow keys traverse nodes, `Space` toggles expansion, and `Enter` toggles selection. Focus is roved so only one treeitem is tabbable at a time.
- **Drag-and-drop** – Native drag events reorder nodes without mutating source data until the consumer handles the `onReorder` callback. Drops default to “inside”; hold `Shift` to insert before and `Alt/⌘` to insert after the drop target.
- **Search-aware rendering** – `useCategoryTree` powers automatic ancestor expansion and match-highlighting for thousands of nodes. Filtering runs in `O(n)` and was profiled with 1,000-node fixtures (<7 ms on M4).
- **Breadcrumb context** – `showBreadcrumbs` renders the focused node path through the dedicated `CategoryBreadcrumb` component, aligning with the Classifiable trait semantics.
- **Token compliant** – Styling uses `--cmp-*`/`--sys-*` CSS variables only, with HC fallbacks.

## Usage

```tsx
import { CategoryTree } from '@/components/classification/CategoryTree.js';
import type { CategoryNode } from '@/schemas/classification/category-node.ts';

const taxonomy: CategoryNode[] = fetchCategories(); // normalized nodes

export function TaxonomyPanel() {
  return (
    <CategoryTree
      nodes={taxonomy}
      defaultExpandedDepth={2}
      onSelectionChange={({ ids }) => console.log(ids)}
      onReorder={({ sourceId, targetId, dropPosition }) => {
        console.log('move', sourceId, '=>', targetId, dropPosition);
      }}
      showBreadcrumbs
      renderNodeBadge={(node) => node.childCount || undefined}
    />
  );
}
```

### Drop intent modifiers

| Modifier | Drop behavior | Notes |
| --- | --- | --- |
| default | `inside` | Moves source under the target (appends to children). |
| `Shift` | `before` | Inserts before target within the same parent/root list. |
| `Alt`/`⌘` | `after` | Inserts after target. |

Override with `resolveDropIntent` when a different mapping is preferred.

## Hook API

`useCategoryTree(nodes, options)` exposes the full tree model, roving focus state, search helpers, and reorder utilities. Pass the resulting state to `CategoryTreeView` for custom experiences (e.g., CategoryPicker). The hook never mutates the incoming array; local reorders clone the view-only model and still emit `onReorder` payloads.

## Testing & A11y

- Interaction tests: `tests/components/classification/CategoryTree.test.tsx`
- axe guard: `tests/components/classification/CategoryTree.a11y.test.tsx`

Both suites cover keyboard flows, filtering, drag events, and accessibility violations. Add new scenarios there when extending the component.

## Related Components

- **CategoryBreadcrumb** – Renders the ancestor path for the currently focused node. Exposed separately for Classifiable panels.
- **CategoryPicker** – Form-ready variant with search, chips, recently-used helpers, and hidden form inputs.
