# Sunburst

Sunburst charts display hierarchical data as concentric rings, where each ring represents a level in the hierarchy. The angle of each segment represents its proportional value within its parent.

## When to Use

**Use sunburst charts for:**
- Budget/allocation breakdowns with clear parent-child relationships
- Organizational hierarchies with numeric weights
- File system or category trees (disk usage, taxonomy)
- Showing proportions at multiple levels simultaneously

**Consider alternatives when:**
- The hierarchy has many siblings (>10) at one level - hard to read
- Exact value comparison is important (use bar charts)
- Data is flat without hierarchy (use pie/donut)
- Hierarchy is very shallow (<2 levels) - treemap may be simpler

## Basic Usage

```tsx
import { Sunburst } from '@oods/viz';

function BudgetAllocation() {
  return (
    <Sunburst
      data={{
        type: 'nested',
        data: {
          name: 'Budget 2024',
          value: 10000,
          children: [
            {
              name: 'Operations',
              value: 4500,
              children: [
                { name: 'Salaries', value: 2800 },
                { name: 'Infrastructure', value: 1200 },
                { name: 'Utilities', value: 500 },
              ],
            },
            {
              name: 'Marketing',
              value: 2500,
              children: [
                { name: 'Digital', value: 1200 },
                { name: 'Events', value: 800 },
                { name: 'Print', value: 500 },
              ],
            },
            { name: 'R&D', value: 3000 },
          ],
        },
      }}
      name="2024 Budget Allocation"
      width={550}
      height={550}
      drilldown
    />
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HierarchyInput` | required | Hierarchy data (nested or adjacency list) |
| `width` | `number` | `500` | Width in pixels |
| `height` | `number` | `500` | Height in pixels (ideally equal to width) |
| `name` | `string` | `'Sunburst'` | Title for the visualization |
| `drilldown` | `boolean` | `true` | Enable drill-down on click |
| `showTable` | `boolean` | `true` | Show accessible table fallback |
| `onSelect` | `(node) => void` | - | Callback when a segment is clicked |
| `description` | `string` | - | Accessibility description |
| `renderer` | `'echarts'` | `'echarts'` | Renderer (v1.0: ECharts only) |

## Data Formats

Sunburst uses the same hierarchy input formats as Treemap:

### Nested JSON

```typescript
const budgetData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Total Budget',
    value: 100000,
    children: [
      {
        name: 'Engineering',
        value: 50000,
        children: [
          { name: 'Frontend', value: 20000 },
          { name: 'Backend', value: 25000 },
          { name: 'DevOps', value: 5000 },
        ],
      },
      {
        name: 'Sales',
        value: 30000,
        children: [
          { name: 'Enterprise', value: 20000 },
          { name: 'SMB', value: 10000 },
        ],
      },
      { name: 'Support', value: 20000 },
    ],
  },
};
```

### Adjacency List

```typescript
const diskUsage: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 500, name: 'Total Disk' },
    { id: 'system', parentId: 'root', value: 120, name: 'System' },
    { id: 'user', parentId: 'root', value: 280, name: 'User Data' },
    { id: 'temp', parentId: 'root', value: 100, name: 'Temporary' },
    { id: 'docs', parentId: 'user', value: 100, name: 'Documents' },
    { id: 'photos', parentId: 'user', value: 80, name: 'Photos' },
    { id: 'videos', parentId: 'user', value: 100, name: 'Videos' },
  ],
};
```

See [Data Formats](./data-formats.md) for complete schema reference.

## Interactions

### Drill-Down

Click any segment to zoom into that subtree:

```tsx
<Sunburst
  data={data}
  drilldown
  onSelect={(node) => {
    console.log('Selected:', node);
    // { name: 'Engineering', value: 50000, depth: 1, path: ['Budget', 'Engineering'] }
  }}
/>
```

Click the center to zoom back out.

### Ancestor Highlighting

When hovering, ancestor segments are highlighted to show the path to root:

```tsx
// Ancestor highlighting is enabled by default
// Hover over "Frontend" to see "Engineering" and root highlighted
```

## Sizing

Sunburst works best as a square. If width and height differ, the chart uses the smaller dimension:

```tsx
// Recommended: equal dimensions
<Sunburst width={550} height={550} data={data} />

// If container is rectangular, chart will be centered
<Sunburst width={800} height={500} data={data} />
// Renders as 500x500 centered in 800x500 container
```

## Styling

Colors are assigned per depth level using the OODS categorical palette:

- Level 1: Primary colors
- Level 2: Variations of parent colors
- Level 3+: Continued variations

```tsx
// Default color scheme follows OODS viz tokens
// For custom colors, use the adapter directly:
import { adaptSunburstToECharts } from '@oods/viz/adapters';
```

## Performance

| Dataset Size | Recommendation |
|--------------|----------------|
| < 300 nodes | Default settings work well |
| 300-1000 nodes | Consider aggregating small segments |
| > 1000 nodes | Aggregate or use treemap instead |

Sunburst is more visually dense than treemap, so smaller datasets are recommended.

## Accessibility

Sunburst includes built-in accessibility features:

1. **Table Fallback** - `showTable={true}` renders hierarchical data as a table
2. **ARIA Labels** - Proper semantic structure
3. **Path Narration** - Screen readers announce the full path to selected segments

```tsx
<Sunburst
  data={data}
  name="Department Budget Distribution"
  description="Sunburst chart showing budget allocation across departments and teams"
  showTable
/>
```

## Common Patterns

### Partial Circle

For emphasis, show only a portion of the full circle:

```tsx
// This requires direct adapter configuration
// Contact the OODS team if you need this feature
```

### Deep Hierarchy Navigation

For hierarchies with 5+ levels, combine drill-down with breadcrumb-style tracking:

```tsx
function DeepHierarchySunburst({ data }) {
  const [path, setPath] = useState<string[]>([]);

  return (
    <div>
      <nav aria-label="Current location">
        {path.map((segment, i) => (
          <span key={i}>
            {i > 0 && ' > '}
            {segment}
          </span>
        ))}
      </nav>
      <Sunburst
        data={data}
        drilldown
        onSelect={(node) => setPath(node.path)}
      />
    </div>
  );
}
```

### With Summary Statistics

```tsx
function SunburstWithStats({ data }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="flex gap-4">
      <Sunburst
        data={data}
        width={450}
        height={450}
        onSelect={setSelected}
      />
      {selected && (
        <aside className="p-4">
          <h3>{selected.name}</h3>
          <p>Value: {selected.value.toLocaleString()}</p>
          <p>Depth: {selected.depth}</p>
          <p>Path: {selected.path.join(' > ')}</p>
        </aside>
      )}
    </div>
  );
}
```

## Sunburst vs Treemap

| Aspect | Sunburst | Treemap |
|--------|----------|---------|
| **Layout** | Radial (rings) | Rectangular (nested boxes) |
| **Best for** | Seeing hierarchy levels clearly | Seeing all data at once |
| **Space efficiency** | Less efficient (center empty) | More efficient |
| **Comparison** | Easy within same ring | Easy at all levels |
| **Max nodes** | ~300 | ~2000 |
| **Drill-down** | Intuitive (click to zoom) | Intuitive (click to zoom) |

**Choose Sunburst when:**
- The number of hierarchy levels is important
- You want clear parent-child visual relationships
- The dataset is moderately sized

**Choose Treemap when:**
- You need to show more data
- Space efficiency matters
- Comparing sizes across the entire hierarchy

## Troubleshooting

**Center appears empty:**
- This is intentional - the center represents the root
- Click any segment to drill down

**Segments too small to see:**
- Aggregate small values into "Other" category
- Increase chart size

**Labels overlapping:**
- Reduce number of segments per level
- Use shorter names or abbreviations

## Related

- [Treemap](./treemap.md) - Alternative rectangular hierarchy visualization
- [Data Formats](./data-formats.md) - Input schema reference
- [Accessibility](./accessibility.md) - Full a11y guide
