# TagInput

TagInput renders the folksonomy entry point for the Classifiable trait. It exposes an ARIA-compliant combobox that supports autocomplete, synonym resolution, contextual suggestions, inline creation with spam detection, and pill management so Form contexts can reuse the same component across Product, Content, or Subscription objects.

## Highlights

- **Combobox a11y pattern** – Implements the WAI-ARIA 1.2 combobox with `aria-controls`, `aria-activedescendant`, keyboard navigation (`↑/↓`, `Enter`, `Esc`), and multi-select chip management that meets WCAG 2.2 AA.
- **Synonym + canonical resolution** – Uses the folksonomy `SynonymMapper` to collapse aliases (`js`) into canonical tags (`javascript`). The suggestion list labels the canonical outcome so admins understand where synonyms route.
- **Spam-aware creation** – Inline `create tag` suggestions run through `SpamDetector` heuristics before they invoke `onCreateTag`. Blocked attempts surface validation copy and never emit the callback.
- **Contextual intelligence** – Pass `contextSignals` or pre-computed `contextualSuggestions` to blend “other similar records use…” hints with literal matches. Signals are scored (weight × similarity × recency) via `useTagSuggestions`.
- **Form integration** – Ships as a `.form-field` block with hidden inputs (`name[index] = slug`) so it falls straight into `FormView`/HTML forms.

## Usage

```tsx
import * as React from 'react';
import { TagInput } from '@/components/classification/TagInput.js';
import type { TagUsageSignal } from '@/hooks/useTagSuggestions.js';

const canonicalTags = fetchCanonicalTags();
const contextSignals: TagUsageSignal[] = [
  {
    objectId: 'content-2188',
    tags: ['javascript', 'react', 'hooks'],
    similarity: 0.82,
    lastSeenAt: '2025-11-10T19:14:00Z',
  },
];

export function FolksonomyField() {
  const [value, setValue] = React.useState(canonicalTags.slice(0, 2));

  return (
    <TagInput
      id="content-tags"
      label="Content tags"
      description="Use 3–5 tags to make search + dashboards smarter."
      availableTags={canonicalTags}
      selectedTags={value}
      onChange={setValue}
      contextSignals={contextSignals}
      onCreateTag={async (label) => ({
        tag: {
          id: label,
          slug: label.toLowerCase(),
          name: label,
          usageCount: 0,
          state: 'active',
          synonyms: [],
          isCanonical: true,
        },
      })}
      spamContext={{ userId: 'taxonomy-admin', userReputation: 95, recentCreations: [] }}
    />
  );
}
```

## Hooks

- `useTagAutocomplete(options)` – Produces scored `TagSuggestion[]` (matches, synonyms, contextual, create). `TagInput` consumes it automatically, but export it when building custom drawers.
- `useTagSuggestions(options)` – Aggregates `TagUsageSignal[]` (similar object telemetry) into ranked contextual hints. Accepts `weight/similarity/lastSeenAt` to bias the scoring.

Both hooks are pure and memoized so they can run inside Suspense data loaders or domain-specific components.

## Testing & Stories

- Unit interactions: `tests/components/classification/TagInput.test.tsx`
- axe guard: `tests/components/classification/TagInput.a11y.test.tsx`
- Stories: `stories/components/classification/TagInput.stories.tsx`

## Related Components

- **TagList / TagPill** – Display tags in List/Detail contexts with usage counts and overflow toggles.
- **TagGovernanceDashboard** – Admin module that pairs with TagInput when presenting synonym approvals or merge operations.
