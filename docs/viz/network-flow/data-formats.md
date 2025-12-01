# Data Formats

This document defines the canonical data contracts for Network & Flow visualizations. All input schemas are validated at runtime before rendering.

## Schema Files

| Schema | Path | Used By |
|--------|------|---------|
| Hierarchy Input | `schemas/viz/hierarchy-input.schema.json` | Treemap, Sunburst |
| Network Input | `schemas/viz/network-input.schema.json` | ForceGraph |
| Sankey Input | `schemas/viz/sankey-input.schema.json` | Sankey |
| TypeScript Types | `src/types/viz/network-flow.ts` | All components |

## Hierarchy Input (Treemap, Sunburst)

Two formats are supported with automatic detection via `detectHierarchyFormat()`.

### Nested JSON Format

Best for API responses and hand-crafted data:

```typescript
interface HierarchyNestedInput {
  type: 'nested';
  data: {
    name: string;
    value?: number;           // Required for leaf nodes, optional for parents
    children?: HierarchyNode[];
    [key: string]: unknown;   // Additional fields preserved
  };
}

// Example
const nested: HierarchyNestedInput = {
  type: 'nested',
  data: {
    name: 'Revenue',
    value: 1000,
    children: [
      {
        name: 'North America',
        value: 600,
        children: [
          { name: 'Enterprise', value: 400 },
          { name: 'SMB', value: 200 },
        ],
      },
      { name: 'EMEA', value: 400 },
    ],
  },
};
```

**Rules:**
- Root node is the `data` object
- `name` is required at every level
- `value` required for leaf nodes (nodes without children)
- Parent `value` can be omitted (calculated as sum of children)
- Additional fields are preserved and passed to callbacks

### Adjacency List Format

Best for database exports, CSV imports, and flat data:

```typescript
interface HierarchyAdjacencyInput {
  type: 'adjacency_list';
  data: Array<{
    id: string;                 // Required: unique identifier
    parentId: string | null;    // Required: parent reference, null for root
    value: number;              // Required: numeric value
    name?: string;              // Optional: display name (defaults to id)
    [key: string]: unknown;     // Additional fields preserved
  }>;
}

// Example
const adjacency: HierarchyAdjacencyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 1000, name: 'All Products' },
    { id: 'electronics', parentId: 'root', value: 600, name: 'Electronics' },
    { id: 'clothing', parentId: 'root', value: 400, name: 'Clothing' },
    { id: 'phones', parentId: 'electronics', value: 350, name: 'Phones' },
    { id: 'laptops', parentId: 'electronics', value: 250, name: 'Laptops' },
  ],
};
```

**Rules:**
- Every row must have `id`, `parentId`, and `value`
- Exactly one row must have `parentId: null` (the root)
- All `parentId` values must reference existing `id` values
- `id` values must be unique

### Validation Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `HIERARCHY_MISSING_ROOT` | No node with `parentId: null` | Add a root node |
| `HIERARCHY_MULTIPLE_ROOTS` | Multiple nodes with `parentId: null` | Keep only one root |
| `HIERARCHY_ORPHAN_NODE` | `parentId` references non-existent `id` | Fix parent reference |
| `HIERARCHY_CYCLE_DETECTED` | Circular parent-child references | Break the cycle |
| `HIERARCHY_MISSING_VALUE` | Leaf node without `value` | Add value to leaves |

## Network Input (ForceGraph)

For nodes-and-links network data:

```typescript
interface NetworkInput {
  nodes: Array<{
    id: string;               // Required: unique identifier
    group?: string;           // Optional: for color encoding
    radius?: number;          // Optional: node size (pixels)
    fixed?: boolean;          // Optional: pin position
    x?: number;               // Optional: x position (if fixed)
    y?: number;               // Optional: y position (if fixed)
    [key: string]: unknown;   // Additional fields preserved
  }>;
  links: Array<{
    source: string;           // Required: source node id
    target: string;           // Required: target node id
    value?: number;           // Optional: edge weight
    [key: string]: unknown;   // Additional fields preserved
  }>;
}

// Example
const network: NetworkInput = {
  nodes: [
    { id: 'gateway', group: 'infrastructure' },
    { id: 'auth', group: 'core' },
    { id: 'users', group: 'core' },
    { id: 'database', group: 'infrastructure', fixed: true, x: 500, y: 300 },
  ],
  links: [
    { source: 'gateway', target: 'auth', value: 100 },
    { source: 'gateway', target: 'users', value: 80 },
    { source: 'auth', target: 'database', value: 50 },
    { source: 'users', target: 'database', value: 90 },
  ],
};
```

**Rules:**
- Every node must have a unique `id`
- Every link `source` and `target` must reference existing node `id`
- Links are undirected (order doesn't imply direction)
- `fixed` nodes require both `x` and `y`

### Validation Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `NETWORK_DUPLICATE_ID` | Multiple nodes with same `id` | Use unique identifiers |
| `NETWORK_BROKEN_LINK` | Link references non-existent node | Fix source/target |
| `NETWORK_MISSING_POSITION` | Fixed node without x/y | Add coordinates or remove fixed |

## Sankey Input

For directional flow data:

```typescript
interface SankeyInput {
  nodes: Array<{
    name: string;             // Required: unique identifier
    [key: string]: unknown;   // Additional fields preserved
  }>;
  links: Array<{
    source: string;           // Required: source node name
    target: string;           // Required: target node name
    value: number;            // Required: flow magnitude
    [key: string]: unknown;   // Additional fields preserved
  }>;
}

// Example
const sankey: SankeyInput = {
  nodes: [
    { name: 'Coal' },
    { name: 'Natural Gas' },
    { name: 'Electricity' },
    { name: 'Residential' },
    { name: 'Industrial' },
  ],
  links: [
    { source: 'Coal', target: 'Electricity', value: 250 },
    { source: 'Natural Gas', target: 'Electricity', value: 180 },
    { source: 'Electricity', target: 'Residential', value: 280 },
    { source: 'Electricity', target: 'Industrial', value: 150 },
  ],
};
```

**Rules:**
- Every node must have a unique `name`
- Every link `source` and `target` must reference existing node `name`
- Every link must have a numeric `value` (required!)
- Data should form a DAG (directed acyclic graph) - cycles produce warnings

### Validation Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `SANKEY_DUPLICATE_NAME` | Multiple nodes with same `name` | Use unique names |
| `SANKEY_BROKEN_LINK` | Link references non-existent node | Fix source/target |
| `SANKEY_MISSING_VALUE` | Link without `value` | Add value to all links |
| `SANKEY_CYCLE_WARNING` | Circular flow detected | Remove cycle or accept warning |

## TypeScript Types

Import types from the viz module:

```typescript
import type {
  HierarchyInput,
  HierarchyNestedInput,
  HierarchyAdjacencyInput,
  NetworkInput,
  SankeyInput,
} from '@oods/viz/types';

// Or from the explicit path
import type { HierarchyInput } from '~/src/types/viz/network-flow';
```

## Validation Functions

Validate data before passing to components:

```typescript
import {
  validateHierarchyInput,
  validateNetworkInput,
  validateSankeyInput,
  detectHierarchyFormat,
} from '@oods/viz/validation';

// Validate and get result
const result = validateHierarchyInput(data);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Detect hierarchy format
const format = detectHierarchyFormat(data); // 'nested' | 'adjacency_list' | 'unknown'
```

## Data Transformation

### Converting CSV to Adjacency List

```typescript
import { csvToAdjacencyList } from '@oods/viz/transforms';

// CSV with columns: id, parent_id, value, label
const csv = `id,parent_id,value,label
root,,1000,All
electronics,root,600,Electronics
clothing,root,400,Clothing`;

const data = csvToAdjacencyList(csv, {
  idColumn: 'id',
  parentColumn: 'parent_id',
  valueColumn: 'value',
  nameColumn: 'label',
  nullParentValue: '',  // How empty parent is represented
});
```

### Converting Nested to Adjacency List

```typescript
import { flattenHierarchy } from '@oods/viz/transforms';

const nested = { name: 'Root', children: [...] };
const flat = flattenHierarchy(nested);
// Returns adjacency list format
```

### Aggregating Small Values

```typescript
import { aggregateSmallNodes } from '@oods/viz/transforms';

const simplified = aggregateSmallNodes(data, {
  threshold: 0.02,        // Aggregate nodes < 2% of total
  otherLabel: 'Other',    // Label for aggregated node
  maxNodes: 50,           // Maximum nodes to keep
});
```

## Test Fixtures

Sample data files are available in `tests/fixtures/network-flow/`:

```
tests/fixtures/network-flow/
├── hierarchy/
│   ├── nested-revenue.json
│   ├── adjacency-products.json
│   ├── deep-hierarchy.json
│   └── edge-cases/
│       ├── single-node.json
│       ├── two-levels.json
│       └── orphan-node.json (invalid)
├── network/
│   ├── social-graph.json
│   ├── service-architecture.json
│   └── edge-cases/
│       ├── disconnected.json
│       └── broken-link.json (invalid)
└── sankey/
    ├── energy-flow.json
    ├── user-funnel.json
    └── edge-cases/
        ├── circular.json (warning)
        └── missing-value.json (invalid)
```

Use these for testing and as examples:

```typescript
import energyFlow from '@tests/fixtures/network-flow/sankey/energy-flow.json';

<Sankey data={energyFlow} />
```

## Best Practices

1. **Validate early** - Check data before rendering to catch issues
2. **Handle empty states** - Show appropriate UI when data is empty
3. **Aggregate large datasets** - Simplify for better visualization
4. **Preserve additional fields** - Extra properties flow through to callbacks
5. **Use TypeScript** - Import types for compile-time checking
