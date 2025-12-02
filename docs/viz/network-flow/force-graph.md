# Force Graph

Force-directed graphs display network data as nodes and links, using physics simulation to position nodes. Connected nodes attract each other while all nodes repel, creating natural clusters.

## When to Use

**Use force graphs for:**
- Social networks and relationships
- Service/system architecture diagrams
- Knowledge graphs and concept maps
- Organizational relationships (non-hierarchical)
- Any data with many-to-many relationships

**Consider alternatives when:**
- Data is strictly hierarchical (use treemap/sunburst)
- Network has >200 nodes (performance degrades)
- You need precise positioning (use manual layout tools)
- Flow direction is important (use Sankey)

## Basic Usage

```tsx
import { ForceGraph } from '@oods/viz';

function TeamCollaboration() {
  return (
    <ForceGraph
      data={{
        nodes: [
          { id: 'alice', group: 'engineering' },
          { id: 'bob', group: 'engineering' },
          { id: 'charlie', group: 'design' },
          { id: 'diana', group: 'product' },
        ],
        links: [
          { source: 'alice', target: 'bob', value: 10 },
          { source: 'alice', target: 'charlie', value: 5 },
          { source: 'charlie', target: 'diana', value: 8 },
          { source: 'diana', target: 'bob', value: 3 },
        ],
      }}
      name="Team Collaboration"
      width={800}
      height={600}
      colorField="group"
      showLabels
      showLegend
    />
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `NetworkInput` | required | Network data (nodes and links) |
| `width` | `number` | `800` | Width in pixels |
| `height` | `number` | `600` | Height in pixels |
| `name` | `string` | `'Force Graph'` | Title for the visualization |
| `colorField` | `string` | `'group'` | Field for color encoding |
| `zoom` | `boolean` | `true` | Enable zoom/pan |
| `draggable` | `boolean` | `true` | Enable node dragging |
| `showLabels` | `boolean` | `true` | Show node labels |
| `showEdgeLabels` | `boolean` | `false` | Show link labels |
| `showLegend` | `boolean` | `true` | Show color legend |
| `showTable` | `boolean` | `true` | Show accessible table fallback |
| `force` | `ForceParams` | - | Force layout parameters |
| `onSelect` | `(node) => void` | - | Callback when a node is clicked |
| `onLinkSelect` | `(link) => void` | - | Callback when a link is clicked |
| `description` | `string` | - | Accessibility description |
| `renderer` | `'echarts'` | `'echarts'` | Renderer (v1.0: ECharts only) |

### Force Parameters

```typescript
interface ForceParams {
  repulsion?: number;   // Node repulsion strength (default: 50)
  gravity?: number;     // Center gravity (default: 0.1)
  edgeLength?: number;  // Preferred link length (default: 50)
  friction?: number;    // Simulation friction (default: 0.6)
}
```

## Data Format

### Network Input

```typescript
interface NetworkInput {
  nodes: Array<{
    id: string;           // Required: unique identifier
    group?: string;       // Optional: for color encoding
    radius?: number;      // Optional: node size
    fixed?: boolean;      // Optional: pin position
    x?: number;           // Optional: initial/fixed x position
    y?: number;           // Optional: initial/fixed y position
    [key: string]: any;   // Additional fields preserved
  }>;
  links: Array<{
    source: string;       // Required: source node id
    target: string;       // Required: target node id
    value?: number;       // Optional: edge weight
    [key: string]: any;   // Additional fields preserved
  }>;
}
```

### Example: Service Architecture

```typescript
const serviceData: NetworkInput = {
  nodes: [
    { id: 'gateway', group: 'infrastructure' },
    { id: 'auth', group: 'core' },
    { id: 'users', group: 'core' },
    { id: 'orders', group: 'business' },
    { id: 'payments', group: 'business' },
    { id: 'database', group: 'infrastructure' },
  ],
  links: [
    { source: 'gateway', target: 'auth', value: 100 },
    { source: 'gateway', target: 'users', value: 80 },
    { source: 'auth', target: 'users', value: 50 },
    { source: 'users', target: 'orders', value: 40 },
    { source: 'orders', target: 'payments', value: 35 },
    { source: 'users', target: 'database', value: 90 },
    { source: 'orders', target: 'database', value: 70 },
  ],
};
```

See [Data Formats](./data-formats.md) for validation and edge cases.

## Interactions

### Node Selection

```tsx
<ForceGraph
  data={data}
  onSelect={(node) => {
    console.log('Selected node:', node);
    // { id: 'alice', name: 'alice', group: 'engineering', value: undefined }
  }}
/>
```

### Link Selection

```tsx
<ForceGraph
  data={data}
  onLinkSelect={(link) => {
    console.log('Selected link:', link);
    // { source: 'alice', target: 'bob', value: 10 }
  }}
/>
```

### Node Dragging

When `draggable={true}`, users can drag nodes to rearrange the layout:

```tsx
<ForceGraph
  data={data}
  draggable  // Nodes can be repositioned
/>
```

Dragged nodes become "fixed" and won't move during simulation updates.

### Zoom and Pan

```tsx
<ForceGraph
  data={data}
  zoom  // Enable zoom/pan with mouse wheel and drag
/>
```

## Customizing the Force Layout

Adjust the physics simulation for different visual effects:

### Tight Clusters

```tsx
<ForceGraph
  data={data}
  force={{
    repulsion: 30,    // Lower = nodes closer together
    gravity: 0.2,     // Higher = nodes pulled to center
    edgeLength: 40,   // Shorter links
  }}
/>
```

### Spread Out

```tsx
<ForceGraph
  data={data}
  force={{
    repulsion: 200,   // Higher = nodes push apart
    gravity: 0.05,    // Lower = less center pull
    edgeLength: 100,  // Longer links
  }}
/>
```

### Quick Settling

```tsx
<ForceGraph
  data={data}
  force={{
    friction: 0.8,    // Higher = faster settling
  }}
/>
```

## Fixed Nodes

Pin specific nodes to fixed positions:

```typescript
const dataWithFixed: NetworkInput = {
  nodes: [
    { id: 'gateway', group: 'infra', fixed: true, x: 400, y: 50 },
    { id: 'auth', group: 'core' },
    { id: 'users', group: 'core' },
  ],
  links: [
    { source: 'gateway', target: 'auth' },
    { source: 'gateway', target: 'users' },
  ],
};
```

Fixed nodes won't move during simulation but can still be connected to.

## Styling

### Color by Group

```tsx
<ForceGraph
  data={data}
  colorField="group"  // Uses node.group for color
  showLegend          // Shows legend for groups
/>
```

Groups are automatically mapped to the OODS categorical palette.

### Node Labels

```tsx
<ForceGraph
  data={data}
  showLabels      // Show node IDs as labels
  showEdgeLabels  // Show link values on edges
/>
```

## Performance

| Dataset Size | Recommendation |
|--------------|----------------|
| < 100 nodes | Default settings work well |
| 100-200 nodes | Consider `zoom={true}` for exploration |
| 200-500 nodes | Disable `showLabels`, increase `repulsion` |
| > 500 nodes | Aggregate nodes or use different visualization |

### Large Network Optimization

```tsx
<ForceGraph
  data={largeNetwork}
  showLabels={false}      // Hide labels
  showEdgeLabels={false}  // Hide edge labels
  force={{
    friction: 0.9,        // Quick settling
    repulsion: 100,       // Spread nodes out
  }}
/>
```

## Accessibility

Force graphs include built-in accessibility features:

1. **Table Fallback** - Shows nodes and links as accessible tables
2. **ARIA Labels** - Proper semantic structure
3. **Keyboard Support** - Tab through interactive elements

```tsx
<ForceGraph
  data={data}
  name="Service Architecture"
  description="Network diagram showing service dependencies and data flow"
  showTable
/>
```

The table fallback presents two tables:
- Nodes table with id, group, and any additional fields
- Links table with source, target, and value

## Common Patterns

### Highlighted Subgraph

```tsx
function HighlightedGraph({ data, selectedNode }) {
  // Filter links to/from selected node
  const highlightedLinks = data.links.filter(
    (l) => l.source === selectedNode || l.target === selectedNode
  );

  return (
    <ForceGraph
      data={data}
      onSelect={(node) => setSelectedNode(node.id)}
      // Highlighting is handled by ECharts focus effect
    />
  );
}
```

### With Detail Panel

```tsx
function GraphWithDetails({ data }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="flex gap-4">
      <ForceGraph
        data={data}
        width={600}
        height={500}
        onSelect={setSelected}
      />
      {selected && (
        <aside className="w-64 p-4 border rounded">
          <h3>{selected.name}</h3>
          <p>Group: {selected.group}</p>
          <p>Connections: {countConnections(data, selected.id)}</p>
        </aside>
      )}
    </div>
  );
}
```

### Directed vs Undirected

Force graphs in OODS are undirected by default. For directed relationships, consider:

1. Using edge labels to show direction
2. Using Sankey for flow relationships
3. Custom adapter configuration for arrows

## Troubleshooting

**Nodes clustered too tightly:**
- Increase `force.repulsion`
- Decrease `force.gravity`
- Increase `force.edgeLength`

**Layout looks chaotic:**
- Increase `force.friction` for faster settling
- Reduce number of nodes
- Add `fixed` positions for key nodes

**Links not visible:**
- Check that `source` and `target` reference existing node IDs
- Validator will reject broken links

**Performance issues:**
- Reduce node count
- Disable `showLabels` and `showEdgeLabels`
- Consider static layout (disable `draggable`)

## Related

- [Sankey](./sankey.md) - For directional flow data
- [Data Formats](./data-formats.md) - Network input schema
- [Accessibility](./accessibility.md) - Full a11y guide
