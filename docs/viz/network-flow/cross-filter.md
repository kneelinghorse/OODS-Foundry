# Cross-Filter Patterns

Cross-filtering allows selections in one visualization to filter data in others, creating interactive dashboards where users can explore relationships across multiple views.

## Basic Concept

When a user clicks a treemap node, other charts on the page update to show only data related to that selection:

```
┌─────────────────┐     ┌─────────────────┐
│   Treemap       │────>│   Bar Chart     │
│ (click "EMEA")  │     │ (shows EMEA)    │
└─────────────────┘     └─────────────────┘
         │
         v
┌─────────────────┐
│   Line Chart    │
│ (shows EMEA)    │
└─────────────────┘
```

## Dashboard Context

Network & Flow components integrate with the OODS Dashboard Context:

```tsx
import { DashboardProvider, useDashboardContext } from '@oods/dashboard';
import { Treemap, ForceGraph, Sankey } from '@oods/viz';

function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardLayout>
        <TreemapWithCrossFilter />
        <ConnectedBarChart />
        <ConnectedLineChart />
      </DashboardLayout>
    </DashboardProvider>
  );
}
```

## Treemap Cross-Filter

### Broadcasting Selection

```tsx
import { useDashboardContext } from '@oods/dashboard';
import { Treemap } from '@oods/viz';

function TreemapWithCrossFilter({ data }) {
  const { setFilter, clearFilter } = useDashboardContext();

  return (
    <Treemap
      data={data}
      name="Revenue by Region"
      onSelect={(node) => {
        if (node.depth === 0) {
          // Root selected = clear filter
          clearFilter('region');
        } else {
          // Broadcast filter to other charts
          setFilter('region', {
            field: 'region',
            value: node.path[1], // First level = region
            source: 'treemap',
          });
        }
      }}
    />
  );
}
```

### Receiving Filter

```tsx
import { useDashboardContext } from '@oods/dashboard';
import { BarChart } from '@oods/viz';

function ConnectedBarChart({ data }) {
  const { filters } = useDashboardContext();
  const regionFilter = filters['region'];

  const filteredData = useMemo(() => {
    if (!regionFilter) return data;
    return data.filter((d) => d.region === regionFilter.value);
  }, [data, regionFilter]);

  return (
    <BarChart
      data={filteredData}
      name={regionFilter ? `Revenue: ${regionFilter.value}` : 'Revenue: All'}
    />
  );
}
```

## Sunburst Cross-Filter

Sunburst provides path-based filtering:

```tsx
function SunburstWithCrossFilter({ data }) {
  const { setFilter, clearFilter } = useDashboardContext();

  return (
    <Sunburst
      data={data}
      onSelect={(node) => {
        // Multi-level filter from path
        setFilter('hierarchy', {
          path: node.path,
          depth: node.depth,
          source: 'sunburst',
        });
      }}
    />
  );
}
```

### Handling Multi-Level Filters

```tsx
function ConnectedTable({ data }) {
  const { filters } = useDashboardContext();
  const hierarchyFilter = filters['hierarchy'];

  const filteredData = useMemo(() => {
    if (!hierarchyFilter) return data;

    // Filter by path match
    return data.filter((row) => {
      // Check if row matches the selected path
      return hierarchyFilter.path.every((segment, i) => {
        const field = ['category', 'subcategory', 'item'][i];
        return !field || row[field] === segment;
      });
    });
  }, [data, hierarchyFilter]);

  return <DataTable data={filteredData} />;
}
```

## ForceGraph Cross-Filter

Filter by selected node or connected nodes:

```tsx
function ForceGraphWithCrossFilter({ data }) {
  const { setFilter, clearFilter } = useDashboardContext();

  return (
    <ForceGraph
      data={data}
      onSelect={(node) => {
        // Find connected nodes
        const connectedIds = data.links
          .filter((l) => l.source === node.id || l.target === node.id)
          .flatMap((l) => [l.source, l.target]);

        setFilter('network', {
          selectedNode: node.id,
          connectedNodes: [...new Set(connectedIds)],
          source: 'force-graph',
        });
      }}
      onLinkSelect={(link) => {
        setFilter('network', {
          selectedLink: { source: link.source, target: link.target },
          connectedNodes: [link.source, link.target],
          source: 'force-graph',
        });
      }}
    />
  );
}
```

### Consuming Network Filters

```tsx
function ConnectedList({ items }) {
  const { filters } = useDashboardContext();
  const networkFilter = filters['network'];

  const filteredItems = useMemo(() => {
    if (!networkFilter) return items;

    // Show items related to connected nodes
    return items.filter((item) =>
      networkFilter.connectedNodes.includes(item.nodeId)
    );
  }, [items, networkFilter]);

  return (
    <ul>
      {filteredItems.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

## Sankey Cross-Filter

Filter by flow path or node:

```tsx
function SankeyWithCrossFilter({ data }) {
  const { setFilter } = useDashboardContext();

  return (
    <Sankey
      data={data}
      onSelect={(node) => {
        // Filter to flows through this node
        const inflows = data.links.filter((l) => l.target === node.name);
        const outflows = data.links.filter((l) => l.source === node.name);

        setFilter('flow', {
          node: node.name,
          inflows: inflows.map((l) => l.source),
          outflows: outflows.map((l) => l.target),
          source: 'sankey',
        });
      }}
      onLinkSelect={(link) => {
        // Filter to specific flow
        setFilter('flow', {
          link: { source: link.source, target: link.target, value: link.value },
          source: 'sankey',
        });
      }}
    />
  );
}
```

## Bidirectional Filtering

Components can both send and receive filters:

```tsx
function BidirectionalTreemap({ data }) {
  const { filters, setFilter } = useDashboardContext();
  const externalFilter = filters['category'];

  // Apply external filter to highlight matching nodes
  const highlightedPath = externalFilter?.value;

  return (
    <Treemap
      data={data}
      // Highlight externally filtered path
      highlightPath={highlightedPath ? [highlightedPath] : undefined}
      // Broadcast own selections
      onSelect={(node) => {
        setFilter('category', { value: node.name, source: 'treemap' });
      }}
    />
  );
}
```

## Filter Coordination Patterns

### Master-Detail

One chart controls, others follow:

```tsx
function MasterDetailDashboard() {
  return (
    <DashboardProvider>
      <div className="grid grid-cols-3 gap-4">
        {/* Master: Treemap controls everything */}
        <div className="col-span-1">
          <TreemapWithCrossFilter data={hierarchyData} />
        </div>

        {/* Detail views react to selection */}
        <div className="col-span-2 space-y-4">
          <ConnectedTimeSeriesChart />
          <ConnectedDataTable />
        </div>
      </div>
    </DashboardProvider>
  );
}
```

### Linked Views

All charts can filter each other:

```tsx
function LinkedViewsDashboard() {
  return (
    <DashboardProvider>
      <div className="grid grid-cols-2 gap-4">
        <BidirectionalTreemap data={data1} filterKey="selection" />
        <BidirectionalForceGraph data={data2} filterKey="selection" />
        <BidirectionalSankey data={data3} filterKey="selection" />
        <BidirectionalBarChart data={data4} filterKey="selection" />
      </div>
    </DashboardProvider>
  );
}
```

### Filter Groups

Separate filter namespaces for independent interactions:

```tsx
<DashboardProvider>
  {/* Group A: Region filtering */}
  <TreemapWithCrossFilter filterGroup="region" />
  <BarChartRegion filterGroup="region" />

  {/* Group B: Time filtering (independent) */}
  <TimelineSelector filterGroup="time" />
  <LineChartTemporal filterGroup="time" />
</DashboardProvider>
```

## Clear Filters

Provide clear filter affordances:

```tsx
function DashboardHeader() {
  const { filters, clearAllFilters } = useDashboardContext();
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <header className="flex justify-between items-center">
      <h1>Revenue Dashboard</h1>
      {hasFilters && (
        <button onClick={clearAllFilters}>
          Clear all filters
        </button>
      )}
    </header>
  );
}
```

## Filter State Display

Show active filters to users:

```tsx
function ActiveFilters() {
  const { filters, clearFilter } = useDashboardContext();

  if (Object.keys(filters).length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4">
      {Object.entries(filters).map(([key, filter]) => (
        <span
          key={key}
          className="px-2 py-1 bg-blue-100 rounded flex items-center gap-1"
        >
          {filter.value || filter.node || 'Selected'}
          <button onClick={() => clearFilter(key)} aria-label="Remove filter">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
```

## Performance Considerations

1. **Memoize filtered data** - Use `useMemo` to avoid recalculating on every render
2. **Debounce rapid selections** - Prevent flicker during drill-down
3. **Batch filter updates** - Update multiple charts in single render cycle

```tsx
// Good: Memoized filter
const filteredData = useMemo(() => {
  return applyFilter(data, filter);
}, [data, filter]);

// Good: Debounced selection
const debouncedSetFilter = useMemo(
  () => debounce((f) => setFilter('key', f), 100),
  [setFilter]
);
```

## Related

- [Dashboard Integration Guide](../../contexts/quickstart.md)
- [Treemap](./treemap.md)
- [ForceGraph](./force-graph.md)
- [Sankey](./sankey.md)
