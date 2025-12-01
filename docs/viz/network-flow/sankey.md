# Sankey

Sankey diagrams visualize flow between nodes, where the width of each link represents the flow magnitude. They excel at showing how quantities split, merge, and transfer through a system.

## When to Use

**Use Sankey diagrams for:**
- Energy flow (production to consumption)
- User conversion funnels (landing page to purchase)
- Budget allocation (sources to destinations)
- Material flow (manufacturing, supply chain)
- Any directional flow with weighted connections

**Consider alternatives when:**
- Flow has cycles (Sankey requires DAG structure)
- You need precise value comparison (use bar charts)
- Relationships are bidirectional (use force graph)
- Hierarchy is more important than flow (use treemap)

## Basic Usage

```tsx
import { Sankey } from '@oods/viz';

function EnergyFlow() {
  return (
    <Sankey
      data={{
        nodes: [
          { name: 'Coal' },
          { name: 'Natural Gas' },
          { name: 'Renewables' },
          { name: 'Electricity' },
          { name: 'Residential' },
          { name: 'Industrial' },
        ],
        links: [
          { source: 'Coal', target: 'Electricity', value: 250 },
          { source: 'Natural Gas', target: 'Electricity', value: 180 },
          { source: 'Renewables', target: 'Electricity', value: 120 },
          { source: 'Electricity', target: 'Residential', value: 300 },
          { source: 'Electricity', target: 'Industrial', value: 250 },
        ],
      }}
      name="Energy Flow"
      width={900}
      height={500}
    />
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `SankeyInput` | required | Flow data (nodes and links) |
| `width` | `number` | `800` | Width in pixels |
| `height` | `number` | `500` | Height in pixels |
| `name` | `string` | `'Sankey'` | Title for the visualization |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Flow direction |
| `nodeAlign` | `'justify' \| 'left' \| 'right'` | `'justify'` | Node alignment |
| `linkColor` | `'gradient' \| 'source' \| 'target'` | `'gradient'` | Link color mode |
| `nodeWidth` | `number` | `20` | Node rectangle width |
| `nodeGap` | `number` | `10` | Gap between nodes |
| `showLabels` | `boolean` | `true` | Show node labels |
| `showTable` | `boolean` | `true` | Show accessible table fallback |
| `onSelect` | `(node) => void` | - | Callback when a node is clicked |
| `onLinkSelect` | `(link) => void` | - | Callback when a link is clicked |
| `description` | `string` | - | Accessibility description |
| `renderer` | `'echarts'` | `'echarts'` | Renderer (v1.0: ECharts only) |

## Data Format

### Sankey Input

```typescript
interface SankeyInput {
  nodes: Array<{
    name: string;         // Required: unique identifier
    [key: string]: any;   // Additional fields preserved
  }>;
  links: Array<{
    source: string;       // Required: source node name
    target: string;       // Required: target node name
    value: number;        // Required: flow magnitude
    [key: string]: any;   // Additional fields preserved
  }>;
}
```

### Example: User Funnel

```typescript
const funnelData: SankeyInput = {
  nodes: [
    { name: 'Landing Page' },
    { name: 'Product List' },
    { name: 'Product Details' },
    { name: 'Add to Cart' },
    { name: 'Checkout' },
    { name: 'Purchase' },
    { name: 'Bounce' },
    { name: 'Cart Abandon' },
  ],
  links: [
    { source: 'Landing Page', target: 'Product List', value: 1000 },
    { source: 'Landing Page', target: 'Bounce', value: 300 },
    { source: 'Product List', target: 'Product Details', value: 700 },
    { source: 'Product Details', target: 'Add to Cart', value: 400 },
    { source: 'Product Details', target: 'Bounce', value: 300 },
    { source: 'Add to Cart', target: 'Checkout', value: 300 },
    { source: 'Add to Cart', target: 'Cart Abandon', value: 100 },
    { source: 'Checkout', target: 'Purchase', value: 250 },
  ],
};
```

**Important:** `value` is required on all links. Links without values will be rejected.

See [Data Formats](./data-formats.md) for validation details.

## Interactions

### Node Selection

```tsx
<Sankey
  data={data}
  onSelect={(node) => {
    console.log('Selected node:', node);
    // { name: 'Electricity', value: 550 }
  }}
/>
```

### Link Selection

```tsx
<Sankey
  data={data}
  onLinkSelect={(link) => {
    console.log('Selected flow:', link);
    // { source: 'Coal', target: 'Electricity', value: 250 }
  }}
/>
```

### Hover Effects

On hover, the selected flow path is highlighted and others are dimmed.

## Layout Options

### Orientation

```tsx
// Horizontal (left to right) - default
<Sankey data={data} orientation="horizontal" />

// Vertical (top to bottom)
<Sankey data={data} orientation="vertical" height={700} width={500} />
```

### Node Alignment

```tsx
// Justify - spread nodes across width
<Sankey data={data} nodeAlign="justify" />

// Left - align source nodes to left
<Sankey data={data} nodeAlign="left" />

// Right - align target nodes to right
<Sankey data={data} nodeAlign="right" />
```

### Node Sizing

```tsx
<Sankey
  data={data}
  nodeWidth={30}   // Thicker node rectangles
  nodeGap={15}     // More space between nodes
/>
```

## Link Coloring

### Gradient (Default)

Links fade from source color to target color:

```tsx
<Sankey data={data} linkColor="gradient" />
```

### Source Color

Links use the source node's color:

```tsx
<Sankey data={data} linkColor="source" />
```

### Target Color

Links use the target node's color:

```tsx
<Sankey data={data} linkColor="target" />
```

## Multi-Level Flows

Sankey handles multi-level flows automatically:

```typescript
const budgetData: SankeyInput = {
  nodes: [
    { name: 'Total Budget' },
    // Level 1
    { name: 'Engineering' },
    { name: 'Marketing' },
    { name: 'Operations' },
    // Level 2
    { name: 'Salaries' },
    { name: 'Cloud' },
    { name: 'Ads' },
    { name: 'Events' },
    { name: 'Office' },
  ],
  links: [
    // Level 0 -> 1
    { source: 'Total Budget', target: 'Engineering', value: 500 },
    { source: 'Total Budget', target: 'Marketing', value: 300 },
    { source: 'Total Budget', target: 'Operations', value: 200 },
    // Level 1 -> 2
    { source: 'Engineering', target: 'Salaries', value: 350 },
    { source: 'Engineering', target: 'Cloud', value: 150 },
    { source: 'Marketing', target: 'Ads', value: 200 },
    { source: 'Marketing', target: 'Events', value: 100 },
    { source: 'Operations', target: 'Office', value: 200 },
  ],
};
```

Nodes are automatically positioned in columns based on flow direction.

## Performance

| Dataset Size | Recommendation |
|--------------|----------------|
| < 50 nodes | Default settings work well |
| 50-200 nodes | Increase dimensions, consider hiding labels |
| > 200 nodes | Aggregate small flows, simplify structure |

Sankey diagrams become hard to read with many nodes due to link overlap.

## Accessibility

Sankey diagrams include built-in accessibility features:

1. **Table Fallback** - Shows nodes and flows as accessible tables
2. **ARIA Labels** - Proper semantic structure
3. **Flow Narration** - Screen readers can announce flow paths

```tsx
<Sankey
  data={data}
  name="User Conversion Funnel"
  description="Sankey diagram showing user journey from landing page to purchase"
  showTable
/>
```

The table fallback presents:
- Nodes table with names and total values
- Links table with source, target, and flow values

## Common Patterns

### Conversion Funnel with Metrics

```tsx
function FunnelWithMetrics({ data }) {
  const [selected, setSelected] = useState(null);

  // Calculate conversion rates
  const metrics = useMemo(() => {
    // ... calculate stage-to-stage conversion
    return stages;
  }, [data]);

  return (
    <div className="space-y-4">
      <Sankey
        data={data}
        onSelect={setSelected}
        width={800}
        height={400}
      />
      <div className="flex justify-around text-center">
        {metrics.map((stage) => (
          <div key={stage.name}>
            <div className="text-2xl font-bold">{stage.rate}%</div>
            <div className="text-sm text-gray-500">{stage.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Budget Allocation with Totals

```tsx
function BudgetSankey({ data }) {
  return (
    <div>
      <Sankey
        data={data}
        name="Budget Allocation"
        nodeAlign="left"
        showLabels
      />
      <p className="text-sm text-gray-600 mt-2">
        Total: ${data.links.reduce((sum, l) => sum + l.value, 0).toLocaleString()}
      </p>
    </div>
  );
}
```

### Vertical Funnel

For conversion funnels, vertical orientation can be more intuitive:

```tsx
<Sankey
  data={funnelData}
  orientation="vertical"
  width={500}
  height={700}
  name="Purchase Funnel"
/>
```

## Cycles and Circular Flows

**Standard Sankey does not support cycles.** Data must form a DAG (Directed Acyclic Graph).

If your data has cycles (e.g., A → B → C → A), you must either:
1. Remove the cycle-creating link
2. Model the cycle differently (e.g., show time periods)
3. Use a force graph instead

The validator will warn about cycles but won't reject the data. ECharts will attempt to render but may produce unexpected results.

## Troubleshooting

**Links not appearing:**
- Ensure all `source` and `target` names exist in the nodes array
- Check that all links have a `value` property

**Nodes in wrong order:**
- Use `nodeAlign="left"` to anchor source nodes
- Review link structure for correct flow direction

**Overlapping links:**
- Increase `nodeGap`
- Increase overall dimensions
- Reduce number of nodes

**Labels cut off:**
- Increase width/height
- Use shorter node names

**Unexpected layout:**
- Check for cycles in your data
- Ensure flow direction is consistent (source → target)

## Related

- [Force Graph](./force-graph.md) - For non-directional relationships
- [Data Formats](./data-formats.md) - Sankey input schema
- [Accessibility](./accessibility.md) - Full a11y guide
