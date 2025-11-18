# TagList & TagPill

TagList renders canonical tags as pills that can display usage counts, fire filter/remove callbacks, and collapse into a “+N more” affordance when folksonomies explode. `TagPill` exports the underlying primitive so dashboards can embed stand-alone pills.

## Highlights

- **Overflow-aware chips** – Show the first `maxVisible` tags inline, then expose a toggle button that reveals the remaining tags (`+3 more`). The button shifts to “Show fewer” when expanded to comply with mission B26.6.
- **Interactive + passive modes** – Set `interactive` to true to emit `onTagClick` (for filter/search). Provide `onRemoveTag` to surface inline dismissal buttons that reuse TagInput’s remove affordance.
- **Usage telemetry** – `showUsage` renders `usageCount` next to each pill so analysts can see canonical load (“JavaScript · 18,234”).
- **Token-pure styling** – Pills only reference `--cmp-*` / `--sys-*` variables with focus rings that pass high contrast guardrails.

## Usage

```tsx
import * as React from 'react';
import { TagList } from '@/components/classification/TagList.js';
import type { Tag } from '@/schemas/classification/tag.js';

const trendingTags: Tag[] = fetchTrendingTags();

export function TagFacetPanel() {
  const [filters, setFilters] = React.useState<string[]>([]);

  return (
    <TagList
      tags={trendingTags}
      interactive
      showUsage
      maxVisible={8}
      onTagClick={(tag) => {
        setFilters((current) =>
          current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id]
        );
      }}
      onRemoveTag={(tag) => console.log('remove', tag.slug)}
      ariaLabel="Top folksonomy tags"
    />
  );
}
```

Use `TagPill` directly when you need to embed a single tag badge (e.g., dashboards, cards, or audit logs). It exposes `interactive`, `selected`, `removable`, and `showUsage` props so it mirrors TagInput’s chips.

## Testing & Stories

- Stories: `stories/components/classification/TagList.stories.tsx`
- TagInput tests cover TagPill removal/focus flows (`tests/components/classification/TagInput.test.tsx`).

## Related APIs

- **TagInput** – Uses the same pill styles for inline entry.
- **useTagSuggestions** – Generates the contextual suggestions that TagList can visualize in detail contexts.
