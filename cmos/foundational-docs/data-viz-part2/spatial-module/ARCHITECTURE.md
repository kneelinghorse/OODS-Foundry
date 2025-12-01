# OODS Spatial Module Architecture

**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Target Release:** v1.1  
**Last Updated:** November 2025

## Executive Summary

The Spatial module extends the OODS visualization system with first-class geospatial support. This module addresses the ~15-20% gap identified in RV.03's taxonomy mapping and enables coverage in domains where location is the primary analytical key (Logistics, Healthcare surveillance, Energy grid operations).

Both target renderers (ECharts and Vega-Lite) support geospatial visualization natively via compatible paradigms—no server-side transformation required. This makes Spatial a "pass-through" implementation suitable for immediate rollout.

---

## 1. Architectural Position

### 1.1 Module Classification

```
┌─────────────────────────────────────────────────────────────┐
│                    OODS Visualization System                 │
├─────────────────────────────────────────────────────────────┤
│  CORE ARCHETYPES (6)           │  EXTENSION MODULES         │
│  ─────────────────             │  ─────────────────         │
│  • Temporal                    │  • Spatial ← THIS MODULE   │
│  • Comparison/Ranking          │  • Network & Flow (v2.0)   │
│  • Part-to-Whole               │                            │
│  • Distribution/Correlation    │                            │
│  • Process/Sequential          │                            │
│  • Cohort/Matrix               │                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Renderer Capability Matrix

| Capability | ECharts | Vega-Lite | Implementation Path |
|------------|---------|-----------|---------------------|
| Choropleth | Native (`series-map`) | Native (`mark: geoshape`) | Pass-through |
| Bubble/Symbol Map | Native (`series-scatter` + geo) | Native (`mark: circle` + projection) | Pass-through |
| Dot Density | Native | Native | Pass-through |
| Route/Flow Map | Native (`lines` series) | Native (`mark: line` + projection) | Pass-through |
| Cartogram | Not native | Not native | Client-side pre-processing |

**Verdict:** No server-side transformation engine required. Both renderers consume GeoJSON/TopoJSON directly.

---

## 2. Schema Extensions

### 2.1 Dataset-Level Types

```yaml
# New dataset type annotation
data:
  type: "data.geo.join"
  source: "sales_by_region.json"
  geoSource: "us-states.topojson"
  joinKey: "state_fips"
  geoKey: "properties.FIPS"
```

### 2.2 Field-Level Types

| Field Type | Description | Example |
|------------|-------------|---------|
| `field.geojson` | Inline GeoJSON geometry | `{ "type": "Polygon", "coordinates": [...] }` |
| `field.topojson` | Reference to TopoJSON topology | `"objects.states"` |
| `field.geopoint` | Lat/lon coordinate pair | `[37.7749, -122.4194]` or `{ "lat": 37.7749, "lon": -122.4194 }` |

### 2.3 Normalized Viz Spec Extensions

```yaml
# Addition to normalized-viz-spec.schema.json
spec:
  type: "spatial"
  projection:
    type: "albersUsa" | "mercator" | "equalEarth" | "orthographic" | ...
    center: [lon, lat]  # optional
    scale: number       # optional
    rotate: [lambda, phi, gamma]  # optional
  
  geo:
    source: "url" | "inline"
    topology: "topojson-object-name"  # if TopoJSON
    feature: "geojson-feature-type"   # if GeoJSON
  
  layers:
    - type: "regionFill"    # choropleth
      encoding:
        color:
          field: "value"
          scale: "quantize" | "quantile" | "threshold"
    
    - type: "symbol"        # bubble/dot map
      encoding:
        longitude: { field: "lon" }
        latitude: { field: "lat" }
        size: { field: "magnitude" }
        color: { field: "category" }
    
    - type: "route"         # flow lines
      encoding:
        start: { field: "origin" }
        end: { field: "destination" }
        strokeWidth: { field: "volume" }
```

---

## 3. Trait Definitions

### 3.1 New Traits

#### `Geocodable`
Indicates the object contains location-resolvable data.

```yaml
trait:
  id: viz.spatial.Geocodable
  family: Encoding
  description: "Data contains geographic identifiers that can be resolved to coordinates or boundaries"
  
  detection:
    # Auto-detect if field names suggest geography
    fieldPatterns:
      - "country|state|province|region|city|zip|postal"
      - "lat|latitude|lon|longitude|lng"
      - "fips|iso|geo_id"
    
    # Or explicit field type
    fieldTypes:
      - "field.geopoint"
      - "field.geojson"
  
  outputs:
    geoResolution: "point" | "boundary" | "both"
    requiresLookup: boolean
```

#### `HasProjection`
Specifies the map projection system.

```yaml
trait:
  id: viz.spatial.HasProjection
  family: Layout
  description: "Visualization uses a geographic projection to map coordinates to screen space"
  
  parameters:
    projectionType:
      type: enum
      values:
        - mercator        # Web standard, conformal
        - albersUsa       # US-centric with insets
        - equalEarth      # Equal-area, modern
        - orthographic    # Globe view
        - conicEqualArea  # Regional maps
      default: "mercator"
    
    center: [number, number]  # [lon, lat]
    scale: number
    clipExtent: [[x0, y0], [x1, y1]]
  
  outputs:
    projectionConfig: object  # Renderer-specific config
```

#### `LayeredOverlay`
Enables composition of multiple geographic layers.

```yaml
trait:
  id: viz.spatial.LayeredOverlay
  family: Layout
  description: "Supports stacking multiple visualization layers on a single map base"
  
  parameters:
    basemap:
      type: enum
      values: ["none", "tile", "boundaries"]
      default: "boundaries"
    
    layers:
      type: array
      items:
        - type: "regionFill" | "symbol" | "route" | "heatmap" | "contour"
          zIndex: number
          opacity: number
  
  interactions:
    - panZoom: boolean
    - layerToggle: boolean
    - featureSelect: boolean
```

### 3.2 Trait Composition

```
┌─────────────────────────────────────────────────────────────┐
│                    Spatial Visualization                     │
├─────────────────────────────────────────────────────────────┤
│  REQUIRED                                                    │
│  ────────                                                    │
│  • Geocodable (data has location)                           │
│  • HasProjection (coordinate → screen mapping)              │
│                                                              │
│  OPTIONAL                                                    │
│  ────────                                                    │
│  • LayeredOverlay (multiple layers on one map)              │
│  • InteractionTooltip (hover details)                       │
│  • InteractionZoom (pan/zoom navigation)                    │
│  • InteractionFilter (click-to-filter by region)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
<SpatialContainer>
  ├── <MapBase>                    # Projection + basemap
  │   ├── <RegionLayer>            # Choropleth fills
  │   ├── <SymbolLayer>            # Points/bubbles
  │   ├── <RouteLayer>             # Flow lines
  │   └── <AnnotationLayer>        # Labels, callouts
  ├── <MapLegend>                  # Color/size legends
  ├── <MapControls>                # Zoom, pan, layer toggles
  └── <AccessibleMapFallback>      # Table + narrative
</SpatialContainer>
```

### 4.2 Component Specifications

#### `<ChoroplethMap>`
```typescript
interface ChoroplethMapProps {
  spec: NormalizedVizSpec;  // type: "spatial", layers: ["regionFill"]
  geoData: GeoJSON | TopoJSON;
  data: DataRecord[];
  
  // Encoding
  valueField: string;
  geoJoinKey: string;
  colorScale?: "quantize" | "quantile" | "threshold";
  colorRange?: string[];  // Token references: --viz-scale-sequential-*
  
  // Projection
  projection?: ProjectionType;
  fitToData?: boolean;
  
  // Interactions
  onRegionClick?: (feature: GeoFeature, datum: DataRecord) => void;
  onRegionHover?: (feature: GeoFeature, datum: DataRecord) => void;
  
  // Accessibility
  a11y: {
    description: string;
    tableFallback: { enabled: boolean; caption: string };
    narrative: { summary: string; keyFindings: string[] };
  };
}
```

#### `<BubbleMap>`
```typescript
interface BubbleMapProps {
  spec: NormalizedVizSpec;
  geoData?: GeoJSON | TopoJSON;  // Optional basemap
  data: DataRecord[];
  
  // Position encoding
  longitudeField: string;
  latitudeField: string;
  
  // Visual encoding
  sizeField?: string;
  colorField?: string;
  sizeRange?: [number, number];
  
  // Projection
  projection?: ProjectionType;
  
  // Interactions
  onPointClick?: (datum: DataRecord) => void;
  onPointHover?: (datum: DataRecord) => void;
  
  // Clustering (for dense data)
  cluster?: {
    enabled: boolean;
    radius: number;
    minPoints: number;
  };
  
  a11y: SpatialA11yConfig;
}
```

### 4.3 Adapter Layer

```typescript
// src/viz/adapters/spatial-adapter.ts

interface SpatialAdapterInput {
  spec: NormalizedVizSpec;
  geoSource: GeoJSON | TopoJSON | string;
  data: DataRecord[];
  renderer: "vega-lite" | "echarts";
}

interface SpatialAdapterOutput {
  vegaLiteSpec?: VegaLiteSpec;
  echartsOption?: EChartsOption;
  geoDataResolved: GeoJSON;
}

function adaptSpatialSpec(input: SpatialAdapterInput): SpatialAdapterOutput {
  // 1. Resolve geo data (fetch if URL, parse if TopoJSON)
  // 2. Join data to geo features
  // 3. Generate renderer-specific config
  // 4. Return unified output
}
```

---

## 5. Token System

### 5.1 New Token Namespaces

```json
{
  "viz": {
    "map": {
      "basemap": {
        "fill": { "value": "{color.neutral.100}" },
        "stroke": { "value": "{color.neutral.300}" },
        "stroke-width": { "value": "0.5px" }
      },
      "region": {
        "stroke": { "value": "{color.neutral.400}" },
        "stroke-width": { "value": "1px" },
        "hover-stroke": { "value": "{color.primary.500}" },
        "hover-stroke-width": { "value": "2px" }
      },
      "symbol": {
        "stroke": { "value": "{color.neutral.0}" },
        "stroke-width": { "value": "1px" },
        "min-radius": { "value": "4px" },
        "max-radius": { "value": "40px" }
      },
      "route": {
        "stroke-opacity": { "value": "0.6" },
        "min-width": { "value": "1px" },
        "max-width": { "value": "10px" }
      }
    }
  }
}
```

### 5.2 Sequential Color Scales for Choropleth

```json
{
  "viz": {
    "scale": {
      "sequential": {
        "blue": {
          "1": { "value": "#f0f9ff" },
          "2": { "value": "#bae6fd" },
          "3": { "value": "#7dd3fc" },
          "4": { "value": "#38bdf8" },
          "5": { "value": "#0ea5e9" },
          "6": { "value": "#0284c7" },
          "7": { "value": "#0369a1" }
        },
        "diverging": {
          "negative": { "value": "#dc2626" },
          "neutral": { "value": "#fafafa" },
          "positive": { "value": "#16a34a" }
        }
      }
    }
  }
}
```

---

## 6. Accessibility Requirements

Per RDV.4 and the accessibility checklist, all Spatial visualizations must:

### 6.1 Mandatory A11y Fields

```yaml
spec:
  a11y:
    description: "Choropleth map showing COVID-19 case rates by US state, with highest rates concentrated in the Southeast"
    
    ariaLabel: "Map of United States showing case rates per 100,000 population"
    
    narrative:
      summary: "Case rates vary significantly by region, with a clear geographic pattern"
      keyFindings:
        - "Mississippi has the highest rate at 4,521 per 100,000"
        - "Vermont has the lowest rate at 1,203 per 100,000"
        - "Southern states average 40% higher rates than Northeast"
    
    tableFallback:
      enabled: true
      caption: "COVID-19 case rates by state"
      columns: ["State", "Cases per 100K", "Total Cases", "Region"]
      sortDefault: "Cases per 100K"
      sortOrder: "desc"
```

### 6.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to map, then between regions/points |
| `Enter` | Select focused region (triggers filter if enabled) |
| `Escape` | Clear selection |
| `+` / `-` | Zoom in/out |
| `Arrow keys` | Pan map |

### 6.3 Screen Reader Announcements

```typescript
// On region focus
announceRegionFocus(feature: GeoFeature, datum: DataRecord): string {
  return `${feature.properties.name}: ${formatValue(datum.value)} ${datum.unit}. 
          Rank ${datum.rank} of ${totalRegions}.`;
}

// On layer change
announceLayerChange(layerName: string, visibleCount: number): string {
  return `Now showing ${layerName} layer with ${visibleCount} features.`;
}
```

---

## 7. View Contexts

### 7.1 Context Definitions

```yaml
view_contexts:
  map.tile:
    description: "Tile-based basemap (street, satellite, terrain)"
    use_when: "Detailed geographic context needed, street-level data"
    renderer_support:
      echarts: "via bmap or custom tile layer"
      vega_lite: "via external tile integration"
    
  map.regionFill:
    description: "Choropleth / filled regions"
    use_when: "Comparing values across geographic boundaries"
    renderer_support:
      echarts: "series-map with visualMap"
      vega_lite: "mark: geoshape with color encoding"
    
  map.symbol:
    description: "Point symbols / bubbles on coordinates"
    use_when: "Showing discrete locations with magnitude"
    renderer_support:
      echarts: "series-scatter with geo coordinate system"
      vega_lite: "mark: circle with longitude/latitude encoding"
```

### 7.2 Dashboard Context Integration

```yaml
# Dashboard embedding spatial viz
context: "dashboard"
layout:
  type: "grid"
  areas:
    - id: "map-primary"
      component: "ChoroplethMap"
      span: { cols: 2, rows: 2 }
      context: "map.regionFill"
      interactions:
        - type: "filter"
          target: ["table-detail", "trend-chart"]
          on: "regionClick"
```

---

## 8. Performance Considerations

### 8.1 Data Volume Thresholds

| Scenario | Points/Features | Recommendation |
|----------|-----------------|----------------|
| Simple choropleth | < 500 regions | Direct render |
| Dense bubble map | < 5,000 points | Direct render |
| High-density points | 5,000 - 50,000 | Client-side clustering |
| Massive datasets | > 50,000 | Server-side aggregation or tiling |

### 8.2 Renderer Selection Heuristics

```typescript
function selectSpatialRenderer(spec: NormalizedVizSpec): "vega-lite" | "echarts" {
  // ECharts preferred for:
  // - Large point counts (better WebGL support)
  // - Real-time streaming updates
  // - Complex animations
  
  // Vega-Lite preferred for:
  // - Static choropleths
  // - Interaction-heavy exploratory views
  // - Specification portability requirements
  
  if (spec.data.length > 10000) return "echarts";
  if (spec.streaming?.enabled) return "echarts";
  if (spec.portability?.priority === "high") return "vega-lite";
  
  return "vega-lite";  // Default
}
```

---

## 9. File Structure

```
src/
├── viz/
│   ├── traits/
│   │   └── spatial/
│   │       ├── Geocodable.ts
│   │       ├── HasProjection.ts
│   │       └── LayeredOverlay.ts
│   ├── adapters/
│   │   ├── spatial/
│   │   │   ├── vega-lite-spatial-adapter.ts
│   │   │   ├── echarts-spatial-adapter.ts
│   │   │   └── geo-data-resolver.ts
│   │   └── renderer-selector.ts  # Updated with spatial heuristics
│   └── hooks/
│       └── useSpatialSpec.ts
├── components/
│   └── viz/
│       └── spatial/
│           ├── SpatialContainer.tsx
│           ├── ChoroplethMap.tsx
│           ├── BubbleMap.tsx
│           ├── RouteMap.tsx
│           ├── MapLegend.tsx
│           ├── MapControls.tsx
│           └── AccessibleMapFallback.tsx
├── schemas/
│   └── viz/
│       └── spatial-spec.schema.json
└── packages/
    └── tokens/
        └── src/
            └── viz-map.json

docs/
└── viz/
    ├── spatial-module.md
    ├── spatial-patterns.md
    └── spatial-accessibility.md

tests/
└── viz/
    └── spatial/
        ├── choropleth.test.tsx
        ├── bubble-map.test.tsx
        ├── spatial-a11y.test.tsx
        └── spatial-adapter-parity.test.ts
```

---

## 10. Dependencies

### 10.1 Runtime Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `topojson-client` | TopoJSON → GeoJSON conversion | Lightweight, tree-shakeable |
| `d3-geo` | Projection calculations | May already be in Vega-Lite |
| `d3-geo-projection` | Extended projections | Optional, for specialized projections |

### 10.2 Dev/Build Dependencies

| Package | Purpose |
|---------|---------|
| `@types/geojson` | GeoJSON type definitions |
| `@types/topojson-specification` | TopoJSON type definitions |

---

## 11. Migration Notes

### 11.1 For Existing Dashboards

If a dashboard currently uses custom map implementations:

1. Audit existing geo data sources
2. Map custom props to new `ChoroplethMap` / `BubbleMap` interfaces
3. Ensure `spec.a11y` fields are populated
4. Replace custom legend with `<MapLegend>`
5. Run `pnpm a11y:diff` to verify accessibility parity

### 11.2 For New Implementations

Use the CLI scaffold:

```bash
pnpm viz:suggest --type spatial --data ./my-geo-data.json
```

This will:
- Detect geo field types
- Recommend `ChoroplethMap` vs `BubbleMap`
- Generate starter spec with a11y fields pre-populated

---

## Appendix A: Representative Charts

| Chart Type | Component | Primary Use Case |
|------------|-----------|------------------|
| Choropleth | `<ChoroplethMap>` | Regional comparisons (sales by state, cases by country) |
| Bubble/Symbol Map | `<BubbleMap>` | Point locations with magnitude (store locations, event intensity) |
| Dot Density | `<BubbleMap>` + clustering disabled | Population distribution, incident locations |
| Proportional Symbol | `<BubbleMap>` | City populations, facility capacity |
| Route/Flow Map | `<RouteMap>` | Shipping lanes, migration paths, network connections |
| Cartogram | Future | Area distorted by value (requires pre-processing) |

---

## Appendix B: Implementation Patterns (Lessons Learned)

> **Added Sprint 32** - Based on ChoroplethMap implementation experience.

### Pattern 1: Use Fitted Projection from Context

**Problem:** ChoroplethMap initially created its own projection, ignoring the fitted projection from `SpatialContainer`. Result: shapes rendered at ~20% of viewport instead of filling the map area.

**Solution:** Spatial components MUST consume `projectionInstance` from `SpatialContext`, not create their own.

```typescript
// CORRECT - use projection from context
const { projectionInstance, features, dimensions } = useSpatialContext();

const projectionObject = useMemo(() => {
  // Copy the fitted projection from context
  const baseProjection = projectionInstance?.copy?.() ?? projectionInstance;
  // Only create new if context doesn't provide one
  return baseProjection ?? createProjection(type, config, dimensions);
}, [projectionInstance, dimensions]);
```

```typescript
// WRONG - creates unfitted projection
const projectionObject = useMemo(() => {
  return createProjection(type, config, dimensions); // Ignores context!
}, [dimensions]);
```

### Pattern 2: Use Real GeoJSON Data in Stories

**Problem:** Initial stories used simplified bounding-box rectangles instead of real geographic boundaries. Made visual validation impossible.

**Solution:** Stories should use real TopoJSON/GeoJSON data (e.g., US states, world countries) to validate that projections, joins, and rendering work correctly.

```typescript
// CORRECT - use real geo data
import usStatesGeo from '@/data/geo/us-states.json';

// WRONG - fake rectangles
const fakeStates = {
  features: [
    { geometry: { coordinates: [[[-124, 42], [-114, 42], [-114, 32], [-124, 32]]] } } // Just a box
  ]
};
```

### Pattern 3: Join Keys Must Match Exactly

**Problem:** Data joins failed silently when GeoJSON `properties.fips` didn't match data `state` field.

**Solution:**
1. Use consistent join keys across GeoJSON and data (e.g., `properties.name` ↔ `name`)
2. Normalize keys (lowercase, trim) before comparison
3. Log warnings when features have no matching data

```typescript
// Ensure join keys align
<ChoroplethMap
  geoJoinKey="name"      // Must match GeoJSON properties.name
  dataJoinKey="region"   // Must match data[].region
/>
```

### Pattern 4: Token References Use `--oods-` Prefix

**Problem:** Components referenced `--viz-scale-sequential-*` but built CSS uses `--oods-viz-scale-sequential-*`.

**Solution:** All design token references must use the `--oods-` prefix:

```typescript
// CORRECT
const DEFAULT_COLORS = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
];

// WRONG
const DEFAULT_COLORS = [
  'var(--viz-scale-sequential-01)', // Missing oods- prefix
];
```

### Checklist for New Spatial Components

- [ ] Consume `projectionInstance` from `SpatialContext`
- [ ] Use `projection.fitToData` flag to auto-fit to features
- [ ] Stories use real GeoJSON/TopoJSON data
- [ ] Join keys match between geo data and tabular data
- [ ] Color tokens use `--oods-` prefix
- [ ] Provide system fallbacks in story color ranges (avoid black bubbles when tokens unavailable)
- [ ] Test renders visible output (not just unit tests)

---

## Appendix C: Research Lineage

This architecture is derived from:

- **RDS.10**: Complex Schema Extension Research Mission (identified geospatial as v1.1 candidate)
- **RV.03**: Taxonomic Mapping (15-20% of FTVV is Spatial category)
- **RV.05**: Statistical Validation (Spatial gap exceeds 5% threshold)
- **RV.05 Final Recommendation**: Proposed Spatial as first extension module
