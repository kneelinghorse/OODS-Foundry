# Treemap

Treemaps display hierarchical data as nested rectangles, where each rectangle's size represents a quantitative value. They excel at showing part-to-whole relationships and spotting outliers in large hierarchies.

## When to Use

**Use treemaps for:**
- Revenue breakdown by region/product
- Disk usage or file system visualization
- Portfolio allocation (market cap, budget)
- Organizational structure with numeric metrics

**Consider alternatives when:**
- You need to compare exact values (use bar charts)
- The hierarchy is very deep (>4 levels) - consider sunburst
- Values are similar in magnitude (hard to distinguish)

## Basic Usage

```tsx
import { Treemap } from '@oods/viz';

function RevenueBreakdown() {
  return (
    <Treemap
      data={{
        type: 'nested',
        data: {
          name: 'Revenue',
          value: 1000,
          children: [
            {
              name: 'North America',
              value: 400,
              children: [
                { name: 'Enterprise', value: 220 },
                { name: 'SMB', value: 180 },
              ],
            },
            {
              name: 'EMEA',
              value: 350,
              children: [
                { name: 'Enterprise', value: 200 },
                { name: 'SMB', value: 150 },
              ],
            },
            { name: 'APAC', value: 250 },
          ],
        },
      }}
      name="Revenue by Region"
      width={700}
      height={500}
      drilldown
      breadcrumb
    />
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `HierarchyInput` | required | Hierarchy data (nested or adjacency list) |
| `width` | `number` | `640` | Width in pixels |
| `height` | `number` | `400` | Height in pixels |
| `name` | `string` | `'Treemap'` | Title for the visualization |
| `drilldown` | `boolean` | `true` | Enable drill-down on click |
| `breadcrumb` | `boolean` | `true` | Show breadcrumb navigation |
| `zoom` | `boolean` | `false` | Enable zoom/pan |
| `showTable` | `boolean` | `true` | Show accessible table fallback |
| `onSelect` | `(node) => void` | - | Callback when a node is clicked |
| `onDrillDown` | `(path) => void` | - | Callback when drilling down |
| `description` | `string` | - | Accessibility description |
| `renderer` | `'echarts'` | `'echarts'` | Renderer (v1.0: ECharts only) |

## Data Formats

Treemap accepts two input formats that are automatically detected:

### Nested JSON

Best for API responses and hand-crafted data:

```typescript
const nestedData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Root',
    value: 1000,  // optional for non-leaf nodes
    children: [
      { name: 'Child A', value: 600 },
      { name: 'Child B', value: 400 },
    ],
  },
};
```

### Adjacency List

Best for database exports and CSV data:

```typescript
const adjacencyData: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 1000, name: 'All Products' },
    { id: 'electronics', parentId: 'root', value: 600, name: 'Electronics' },
    { id: 'clothing', parentId: 'root', value: 400, name: 'Clothing' },
  ],
};
```

See [Data Formats](./data-formats.md) for complete schema details.

## Interactions

### Drill-Down Navigation

When `drilldown={true}`, clicking a node zooms into that subtree:

```tsx
<Treemap
  data={data}
  drilldown
  breadcrumb
  onDrillDown={(path) => {
    console.log('Current path:', path.join(' > '));
    // ["Revenue", "North America", "Enterprise"]
  }}
/>
```

The breadcrumb shows the current path and allows clicking to navigate back.

### Node Selection

```tsx
<Treemap
  data={data}
  onSelect={(node) => {
    console.log('Selected:', node);
    // { name: 'Enterprise', value: 220, depth: 2, path: ['Revenue', 'North America', 'Enterprise'] }
  }}
/>
```

### Zoom and Pan

For large treemaps, enable zoom:

```tsx
<Treemap
  data={largeHierarchy}
  zoom
  width={800}
  height={600}
/>
```

## Styling

Treemap colors are automatically assigned based on depth and category. To customize:

```tsx
// Colors follow the OODS viz token palette
// --viz-scale-categorical-01 through --viz-scale-categorical-08

// For custom colors, use the underlying adapter:
import { adaptTreemapToECharts } from '@oods/viz/adapters';
```

## Performance

| Dataset Size | Recommendation |
|--------------|----------------|
| < 500 nodes | Default settings work well |
| 500-2000 nodes | Consider `zoom={false}` to reduce interaction overhead |
| > 2000 nodes | Aggregate data, show only top N categories |

For large datasets:

```tsx
<Treemap
  data={aggregatedData}
  zoom={false}
  drilldown  // Use drill-down instead of showing all at once
/>
```

## Accessibility

Treemaps include built-in accessibility features:

1. **Table Fallback** - `showTable={true}` renders a data table below the chart
2. **ARIA Labels** - Proper `role="figure"` and `aria-label`
3. **Keyboard Navigation** - Tab through interactive elements

```tsx
<Treemap
  data={data}
  name="Q4 Revenue Distribution"
  description="Treemap showing revenue breakdown by region and segment for Q4 2024"
  showTable
/>
```

The table fallback presents the hierarchy as a structured table with indentation for depth.

## Common Patterns

### With Loading State

```tsx
function TreemapWithLoader({ isLoading, data }) {
  if (isLoading) {
    return <Skeleton width={700} height={500} />;
  }
  return <Treemap data={data} />;
}
```

### Responsive Width

```tsx
function ResponsiveTreemap({ data }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      <Treemap data={data} width={width} height={500} />
    </div>
  );
}
```

### Cross-Filter Integration

See [Cross-Filter Patterns](./cross-filter.md) for dashboard integration.

## Troubleshooting

**Chart not rendering:**
- Ensure ECharts is installed: `pnpm add echarts`
- Check that data has at least one node with a value

**Layout looks wrong:**
- Verify all leaf nodes have `value` properties
- Parent values should be sum of children (or omitted to auto-calculate)

**Performance issues:**
- Reduce node count by aggregating small values
- Disable zoom for static views

## Related

- [Sunburst](./sunburst.md) - Alternative radial hierarchy visualization
- [Data Formats](./data-formats.md) - Input schema reference
- [Accessibility](./accessibility.md) - Full a11y guide
