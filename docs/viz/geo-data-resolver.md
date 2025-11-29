# Geo Data Resolver

The Geo Data Resolver is a utility that fetches, parses, and joins geographic data from various sources (URL, inline GeoJSON, TopoJSON) with tabular data for visualization.

## Overview

The resolver handles the complexity of:
- **Format detection**: Automatically detects GeoJSON vs TopoJSON
- **Format conversion**: Converts TopoJSON to GeoJSON for consistent processing
- **Remote fetching**: Fetches geo data from URLs with caching support
- **Data joining**: Merges tabular data with geo features by matching keys
- **Error handling**: Provides actionable error messages for common failure cases

## Installation

The resolver requires the `topojson-client` package for TopoJSON conversion:

```bash
pnpm add -D topojson-client @types/geojson @types/topojson-specification
```

## Basic Usage

### Resolving Inline GeoJSON

```typescript
import { resolveGeoData } from '@/viz/adapters/spatial/geo-data-resolver';

const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: 'Test' },
    },
  ],
};

const result = await resolveGeoData({
  geoSource: JSON.stringify(geojson),
});

console.log(result.features); // Array of GeoJSON features
console.log(result.metadata.featureCount); // 1
```

### Fetching from URL

```typescript
const result = await resolveGeoData({
  geoSource: 'https://example.com/data.geojson',
  fetchOptions: {
    timeout: 30000, // 30 seconds
    cache: true, // Enable caching (default)
    forceRefresh: false, // Use cache if available
  },
});
```

### Joining with Tabular Data

```typescript
const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'California', abbrev: 'CA' },
      geometry: { type: 'Polygon', coordinates: [...] },
    },
  ],
};

const data = [
  { state: 'California', population: 39538223, gdp: 3.1 },
];

const result = await resolveGeoData({
  geoSource: geojson,
  data,
  joinConfig: {
    geoKey: 'name', // Key in geo feature properties
    dataKey: 'state', // Key in data records
    caseSensitive: false, // Default: false
  },
});

// Joined data is available in result.joinedData
// Unmatched items are reported in result.metadata
// If multiple data records share the same key, joinedData will store an array and the merged feature will
// include a __joinedRecords property to preserve all matches.
console.log(result.metadata.unmatchedFeatures); // Features without matching data
console.log(result.metadata.unmatchedData); // Data records without matching features
```

### Handling TopoJSON

```typescript
const topojson = {
  type: 'Topology',
  objects: {
    states: { /* ... */ },
    counties: { /* ... */ },
  },
  arcs: [...],
};

// When multiple objects exist, specify which one to use
const result = await resolveGeoData({
  geoSource: topojson,
  topoObjectName: 'states', // Required if multiple objects
});

// Or let it auto-detect if only one object exists
const result2 = await resolveGeoData({
  geoSource: topojson, // Will use the only object if single
});
```

## API Reference

### `resolveGeoData(input: GeoResolverInput): Promise<GeoResolverOutput>`

Main resolver function.

#### Input

```typescript
interface GeoResolverInput {
  geoSource: string | ParsedGeoData; // URL, inline JSON string, or parsed object
  data?: DataRecord[]; // Optional tabular data to join
  joinConfig?: JoinConfig; // Required if data is provided
  topoObjectName?: string; // Required if TopoJSON has multiple objects
  fetchOptions?: {
    timeout?: number; // Default: 30000ms
    cache?: boolean; // Default: true
    forceRefresh?: boolean; // Default: false
  };
}

interface JoinConfig {
  geoKey: string; // Key in geo feature properties
  dataKey: string; // Key in data records
  caseSensitive?: boolean; // Default: false
}
```

#### Output

```typescript
interface GeoResolverOutput {
  features: GeoJSONFeature[]; // Always normalized to GeoJSON
  joinedData?: Map<string, DataRecord | DataRecord[]>; // Data keyed by feature ID (arrays when multiple records match)
  metadata: {
    featureCount: number;
    hasJoinedData: boolean;
    unmatchedFeatures: string[];
    unmatchedData: string[];
    format: 'geojson' | 'topojson';
    source: 'url' | 'inline' | 'parsed';
  };
}
```

## Supported Input Formats

### GeoJSON

- **FeatureCollection**: Full collection of features
- **Feature**: Single feature
- **Geometry**: Single geometry object

### TopoJSON

- **Topology**: Complete topology with objects and arcs
- Requires `topojson-client` package for conversion

## Error Handling

The resolver provides specific error messages for common failure cases:

### Invalid JSON

```
Failed to parse geo data: invalid JSON at position 123
```

### Unknown Format

```
Unrecognized geo format. Expected GeoJSON or TopoJSON.
```

### Missing TopoJSON Object

```
TopoJSON object 'states' not found. Available objects: [counties, boundaries]
```

### Network Errors

```
Failed to fetch geo data from URL: HTTP 404 Not Found
Failed to fetch geo data from URL: timeout after 30000ms
```

### Join Key Missing

```
Join key 'name' not found in geo feature properties. Available: [id, abbrev, ...]
```

### No Matches

```
Warning: No data records matched geo features. Check join keys (geo: 'name', data: 'state').
```

## Caching

The resolver includes built-in caching for fetched URLs:

- **TTL**: 15 minutes
- **Scope**: Global (shared across all resolver calls)
- **Control**: Use `cache: false` to disable, `forceRefresh: true` to bypass

```typescript
import { clearGeoCache, isCached } from '@/viz/adapters/spatial/geo-fetch';

// Check if URL is cached
if (isCached('https://example.com/data.geojson')) {
  console.log('Data is cached');
}

// Clear all cached data
clearGeoCache();
```

## Performance Considerations

- **Small datasets** (< 50 features): < 10ms
- **Medium datasets** (50-200 features): < 100ms
- **Large datasets** (200+ features): < 500ms

The resolver is optimized for typical use cases (US states ~50 features, world countries ~200 features).

## Examples

### Example 1: US States Choropleth

```typescript
import { resolveGeoData } from '@/viz/adapters/spatial/geo-data-resolver';

// Fetch US states TopoJSON
const result = await resolveGeoData({
  geoSource: 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
  topoObjectName: 'states',
  data: statePopulationData,
  joinConfig: {
    geoKey: 'name',
    dataKey: 'state',
  },
});

// Use result.features for rendering
renderChoropleth(result.features);
```

### Example 2: World Countries with Economic Data

```typescript
const result = await resolveGeoData({
  geoSource: worldCountriesGeoJSON,
  data: gdpData,
  joinConfig: {
    geoKey: 'iso_a3',
    dataKey: 'countryCode',
    caseSensitive: false,
  },
});

// Check for unmatched items
if (result.metadata.unmatchedFeatures.length > 0) {
  console.warn('Some countries have no GDP data:', result.metadata.unmatchedFeatures);
}
```

### Example 3: Custom Error Handling

```typescript
try {
  const result = await resolveGeoData({
    geoSource: userProvidedGeoData,
    data: userProvidedData,
    joinConfig: {
      geoKey: 'name',
      dataKey: 'state',
    },
  });
} catch (error) {
  if (error.message.includes('not found in geo feature properties')) {
    // Help user fix the join key
    showError('The join key does not exist in the geo data. Available keys: ...');
  } else if (error.message.includes('Failed to fetch')) {
    // Handle network errors
    showError('Unable to load geo data. Please check your internet connection.');
  } else {
    // Generic error
    showError('Failed to process geo data: ' + error.message);
  }
}
```

## Testing

The resolver includes comprehensive tests covering:

- Format detection and conversion
- URL fetching with caching
- Data joining with various key types
- Error handling
- Performance benchmarks

Run tests with:

```bash
pnpm test tests/viz/spatial/geo-*.test.ts
```

## Related Documentation

- [Spatial Visualization Types](../../../src/types/viz/spatial.ts)
- [Spatial Module Architecture](../../../cmos/foundational-docs/data-viz-part2/spatial-module/ARCHITECTURE.md)
