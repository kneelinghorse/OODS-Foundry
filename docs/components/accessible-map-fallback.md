# AccessibleMapFallback Component

Semantic table and narrative fallback for spatial visualizations. Ensures WCAG 2.1 AA equivalence when the visual map is unavailable or inaccessible.

## When to Use
- Provide a data table and narrative alongside a map
- Offer a toggle to show/hide the accessible view
- Meet keyboard and screen reader requirements for spatial visualizations

## Props
- `data`: array of joined records (optional if provided by `SpatialContext`)
- `features`: GeoJSON features (optional if provided by `SpatialContext`)
- `joinedData`: `Map<string, DataRecord>` (optional)
- `table`: `{ caption, columns, sortDefault?, sortOrder? }`
- `narrative`: `{ summary, keyFindings[] }`
- `alwaysVisible`: show table without a toggle
- `triggerLabel`: text for the toggle button

## Usage
```tsx
import { AccessibleMapFallback } from '@/components/viz/spatial/AccessibleMapFallback';

const table = {
  caption: 'Case rates by state',
  columns: [
    { field: 'value', label: 'Cases per 100k', format: (v) => Number(v).toLocaleString() },
    { field: 'total', label: 'Total Cases', format: (v) => Number(v).toLocaleString() },
  ],
  sortDefault: 'value',
  sortOrder: 'desc' as const,
};

<AccessibleMapFallback
  data={joinedDataArray}
  features={geoFeatures}
  joinedData={joinedDataMap}
  table={table}
  narrative={{
    summary: 'Highest rates in the Southeast; Northeast lowest.',
    keyFindings: ['Mississippi has the highest rate', 'Vermont has the lowest rate'],
  }}
  alwaysVisible
/>;
```

## Accessibility
- Semantic table with `<caption>`, `<th scope="col">`, and `aria-sort`
- Toggle button exposes `aria-expanded` and controls table region
- Narrative section provides text equivalent to visual insight
- Sorting is keyboard accessible (Enter/Space on headers)

## Testing
- Table renders rows for all features with caption and column headers
- Sorting toggles asc/desc on header click
- Narrative summary and key findings render when provided
- Toggle shows/hides table content when `alwaysVisible` is false
