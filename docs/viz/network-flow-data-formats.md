# Network & Flow Data Formats

Canonical data contracts for hierarchy (treemap/sunburst), network (force), and flow (Sankey) visualizations. Schemas live in `schemas/viz`, with runtime validators in `src/viz/validation/network-flow-validators.ts`.

- Hierarchy input: `schemas/viz/hierarchy-input.schema.json`
- Network input: `schemas/viz/network-input.schema.json`
- Sankey input: `schemas/viz/sankey-input.schema.json`
- Transform outputs: `schemas/viz/treemap-output.schema.json`, `schemas/viz/sunburst-output.schema.json`, `schemas/viz/force-output.schema.json`, `schemas/viz/sankey-output.schema.json`
- Types: `src/types/viz/network-flow.ts`
- Samples: `tests/fixtures/network-flow/*.json`

## Hierarchy Inputs (Treemap/Sunburst)

Two supported formats with automatic detection (`detectHierarchyFormat`):

**Adjacency list (flat)** – best for CSV/database exports.

```json
{
  "type": "adjacency_list",
  "data": [
    { "id": "root", "parentId": null, "value": 100, "name": "Root" },
    { "id": "src", "parentId": "root", "value": 60 },
    { "id": "tests", "parentId": "root", "value": 40 }
  ]
}
```

Rules:
- `id` required and unique
- `parentId` required (`null` for the root)
- `value` required for size calculation
- Validator rejects orphans (unknown `parentId`) and missing root

**Nested JSON** – best for API payloads and d3 examples.

```json
{
  "type": "nested",
  "data": {
    "name": "CEO",
    "value": 58,
    "children": [
      { "name": "Engineering", "value": 30 },
      { "name": "Sales", "value": 20 }
    ]
  }
}
```

## Network Input (Force Graph)

```json
{
  "nodes": [
    { "id": "web-1", "group": "web", "radius": 8 },
    { "id": "db-1", "group": "db", "fixed": true, "x": 100, "y": 50 }
  ],
  "links": [
    { "source": "web-1", "target": "db-1", "value": 20 }
  ]
}
```

Rules:
- Nodes require unique `id`
- Links must reference existing node IDs
- Optional fields (`group`, `radius`, `fixed`, `x`, `y`) pass through to renderers

## Sankey Input (Flow)

```json
{
  "nodes": [{ "name": "Coal" }, { "name": "Electricity" }, { "name": "Homes" }],
  "links": [
    { "source": "Coal", "target": "Electricity", "value": 100 },
    { "source": "Electricity", "target": "Homes", "value": 70 }
  ]
}
```

Rules:
- `value` is required on every link (flows without values are rejected)
- Links must reference existing node names
- Circular flows are allowed (validated in tests)

## Transform Outputs

- Treemap: nodes with `x0/y0/x1/y1`, `depth`, `value`
- Sunburst: nodes with `startAngle/endAngle`, `innerRadius/outerRadius`, `depth`, `value`
- Force: nodes with solved `x/y`, links with `x1/y1/x2/y2`
- Sankey: nodes with positioned rectangles, links with `width`, `y0/y1`, and `svgPath`

See `tests/schemas/viz/transform-outputs.test.ts` for concrete samples validated against the schemas.
