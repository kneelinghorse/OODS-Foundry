# FAQ

Frequently asked questions about Network & Flow visualizations.

## General

### Why do I need to install ECharts separately?

ECharts is a peer dependency to give you control over versioning and bundle optimization. See [v1.0 Constraints](./v1-constraints.md) for the full rationale.

```bash
pnpm add echarts
```

### Can I use Vega-Lite instead of ECharts?

Not in v1.0. All Network & Flow visualizations require ECharts. Vega-Lite support is planned for v1.1+ based on user demand. See [v1.0 Constraints](./v1-constraints.md).

### What's the difference between Treemap and Sunburst?

Both show hierarchical data, but with different layouts:

| Aspect | Treemap | Sunburst |
|--------|---------|----------|
| Layout | Nested rectangles | Concentric rings |
| Best for | Dense data, space efficiency | Clear level separation |
| Max nodes | ~2000 | ~300 |
| Center | Used for data | Empty (root) |

Choose based on data density and visual preference.

### When should I use ForceGraph vs Sankey?

| Use Case | ForceGraph | Sankey |
|----------|------------|--------|
| Relationships | Many-to-many | One-to-many flow |
| Direction | Undirected | Directed |
| Weight meaning | Edge strength | Flow quantity |
| Cycles | Allowed | Not recommended |
| Example | Social network | Budget allocation |

## Data

### My data has cycles. What should I do?

**ForceGraph:** Cycles are fine. The force simulation handles them naturally.

**Sankey:** Cycles are problematic. Options:
1. Remove the cycle-creating link
2. Model cycles as separate time periods
3. Accept the warning and see if rendering is acceptable

### How do I convert CSV data to the required format?

For hierarchy data (adjacency list):

```typescript
import { csvToAdjacencyList } from '@oods/viz/transforms';

const data = csvToAdjacencyList(csvString, {
  idColumn: 'id',
  parentColumn: 'parent_id',
  valueColumn: 'amount',
  nameColumn: 'label',
});
```

For network data, parse CSV rows into nodes and links arrays.

### What if my data is missing values?

**Hierarchy:** Leaf nodes require `value`. Parent values can be omitted (calculated as sum of children).

**Network:** `value` is optional on nodes and links.

**Sankey:** `value` is required on all links. Links without values are rejected.

### How do I aggregate small values?

```typescript
import { aggregateSmallNodes } from '@oods/viz/transforms';

const simplified = aggregateSmallNodes(data, {
  threshold: 0.02,      // Aggregate < 2%
  otherLabel: 'Other',
});
```

## Performance

### My chart is slow. What can I do?

1. **Reduce data size** - Aggregate small values, limit depth
2. **Disable features** - `showLabels={false}`, `zoom={false}`
3. **Increase friction** - `force={{ friction: 0.9 }}` for faster settling

See [Performance Guide](../performance-guide.md) for detailed recommendations.

### What's the maximum number of nodes?

| Viz Type | Recommended | Soft Limit | Hard Limit |
|----------|-------------|------------|------------|
| Treemap | 500 | 2,000 | 10,000 |
| Sunburst | 300 | 1,000 | 5,000 |
| ForceGraph | 200 | 500 | 2,000 |
| Sankey | 50 | 200 | 500 |

Beyond soft limits, consider aggregation or different visualization.

### Does ECharts support SSR?

Not directly. ECharts requires a DOM. For SSR:

1. Use dynamic import to load client-side only
2. Show placeholder during SSR
3. Hydrate with chart on client

```tsx
const Treemap = dynamic(() => import('@oods/viz').then(m => m.Treemap), {
  ssr: false,
  loading: () => <Skeleton />,
});
```

## Styling

### How do I customize colors?

Colors follow the OODS viz token palette. For custom colors:

```tsx
// Option 1: Use colorField to encode by category
<ForceGraph data={data} colorField="department" />

// Option 2: Custom adapter (advanced)
import { adaptTreemapToECharts } from '@oods/viz/adapters';
const option = adaptTreemapToECharts(spec, data);
option.color = ['#ff0000', '#00ff00', '#0000ff'];
```

### Can I add custom tooltips?

The built-in tooltips are styled but not fully customizable. For custom tooltips:

```tsx
// Use onSelect to show your own tooltip
function CustomTooltip({ data }) {
  const [tooltip, setTooltip] = useState(null);

  return (
    <div className="relative">
      <Treemap
        data={data}
        onSelect={(node) => setTooltip(node)}
      />
      {tooltip && (
        <div className="absolute ...">
          <CustomTooltipContent node={tooltip} />
        </div>
      )}
    </div>
  );
}
```

### How do I make the chart responsive?

```tsx
function ResponsiveChart({ data }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <Treemap data={data} width={size.width} height={size.height} />
    </div>
  );
}
```

## Interactions

### How do I disable all interactions?

```tsx
<ForceGraph
  data={data}
  zoom={false}
  draggable={false}
  // No onSelect callback
/>
```

### Can I programmatically select a node?

Not directly via props. Use ref to access ECharts instance:

```tsx
// This is an advanced use case
const chartRef = useRef();

// Access ECharts API
chartRef.current.dispatchAction({
  type: 'highlight',
  name: 'NodeName',
});
```

### How do I reset the view after drilling down?

The breadcrumb allows clicking to navigate back. Programmatically:

```tsx
// Track drill state
const [drillPath, setDrillPath] = useState([]);

// Reset button
<button onClick={() => setDrillPath([])}>
  Reset View
</button>

// Pass to component (depends on implementation)
<Treemap
  data={data}
  drillPath={drillPath}  // If supported
  onDrillDown={setDrillPath}
/>
```

## Accessibility

### Is the chart accessible to screen readers?

Yes, via table fallback. Set `showTable={true}` (default) to render an accessible data table alongside the visualization.

### How do I add a description for screen readers?

```tsx
<Treemap
  name="Q4 Revenue"
  description="Treemap showing revenue by region and segment for Q4 2024"
  aria-label="Q4 Revenue visualization"
/>
```

See [Accessibility](./accessibility.md) for full details.

### Does the chart work with keyboard navigation?

Interactive elements (like the drill-down breadcrumb) are keyboard accessible. The canvas-based chart itself requires the table fallback for full keyboard access.

## Integration

### How do I use this with Redux?

```tsx
import { useSelector, useDispatch } from 'react-redux';
import { Treemap } from '@oods/viz';
import { selectNode } from './vizSlice';

function ConnectedTreemap() {
  const data = useSelector(state => state.viz.hierarchyData);
  const dispatch = useDispatch();

  return (
    <Treemap
      data={data}
      onSelect={(node) => dispatch(selectNode(node))}
    />
  );
}
```

### Can I export the chart as an image?

Access the ECharts instance for export:

```tsx
// Get data URL
const dataUrl = echartsInstance.getDataURL({
  type: 'png',
  pixelRatio: 2,
});

// Or download directly
const link = document.createElement('a');
link.href = dataUrl;
link.download = 'chart.png';
link.click();
```

### How do I print the chart?

1. Use `getDataURL()` to get image
2. Open print dialog with image
3. Or use CSS `@media print` to style for printing

## Troubleshooting

### Chart shows blank/white

1. Check ECharts is installed: `pnpm add echarts`
2. Verify data format matches schema
3. Check browser console for errors
4. Ensure container has dimensions

### "Unable to render" error

Check the error message for specifics. Common causes:
- Invalid data format
- Missing required fields
- Circular references in Sankey

### Labels are cut off

1. Increase chart dimensions
2. Use shorter names
3. For Treemap, drill-down shows more detail

### Force graph is chaotic

1. Increase `force.repulsion`
2. Add `fixed` nodes as anchors
3. Reduce node count
4. Increase `force.friction` for faster settling

## Getting Help

### Where can I report bugs?

Open an issue in the OODS repository with:
- Component and version
- Reproduction steps
- Expected vs actual behavior
- Sample data (anonymized)

### Where can I request features?

Open an issue tagged "enhancement" describing:
- Use case
- Proposed API
- Why existing solutions don't work

### How do I contribute?

See the contributing guide in the repository. We welcome:
- Bug fixes
- Documentation improvements
- New examples
- Accessibility improvements
