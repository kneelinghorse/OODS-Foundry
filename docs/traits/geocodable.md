# Geocodable Trait

The Geocodable trait indicates that data contains location-resolvable information that can be mapped to geographic coordinates or boundaries. It is the foundational trait for spatial visualizations in OODS.

## Overview

| Property | Value |
|----------|-------|
| **Trait ID** | `viz.spatial.Geocodable` |
| **Category** | `viz.spatial` |
| **Family** | Encoding |
| **Version** | 1.0.0 |

## Purpose

The Geocodable trait serves two primary purposes:

1. **Auto-Detection**: Automatically identify geographic fields in datasets based on naming patterns and value analysis
2. **Classification**: Determine whether data represents point coordinates, boundary identifiers, or both

## Use Cases

- **Sales by Region**: Data with country, state, or region identifiers
- **Store Locations**: Data with latitude/longitude coordinates
- **Demographic Analysis**: Data with FIPS codes, ISO codes, or postal codes
- **Fleet Tracking**: Data with coordinate pairs for vehicle positions

## Auto-Detection Behavior

The Geocodable trait automatically detects geographic fields using pattern matching:

### Coordinate Patterns

| Pattern | Examples |
|---------|----------|
| Latitude | `lat`, `latitude`, `user_latitude`, `home.latitude` |
| Longitude | `lon`, `longitude`, `lng`, `user_longitude`, `home.longitude` |
| Generic | `geo_x`, `geo_y` |

### Identifier Patterns

| Pattern | Examples |
|---------|----------|
| Country | `country`, `country_code`, `nation`, `shipping_country` |
| State/Province | `state`, `province`, `region`, `billing_state` |
| City | `city`, `town`, `municipality` |
| Postal | `zip`, `zip_code`, `postal_code` |
| County | `county`, `district`, `prefecture` |

### Code Patterns

| Pattern | Examples |
|---------|----------|
| FIPS | `fips`, `fips_code` |
| ISO | `iso`, `iso_2`, `iso_3`, `iso_code` |
| Generic | `geo_id`, `admin_code`, `place_id` |

### Explicit Field Types

Fields with these types are automatically detected:
- `field.geopoint`
- `field.geojson`
- `field.topojson`

## Output Properties

### `geoResolution`

Type of geographic resolution available:

| Value | Meaning |
|-------|---------|
| `point` | Data contains lat/lon coordinates (direct numeric fields) |
| `boundary` | Data contains region identifiers or geometry (GeoJSON/TopoJSON) |
| `both` | Data contains both coordinates and identifiers |

### `requiresLookup`

Indicates whether a geocoding service is needed:

| Value | Condition |
|-------|-----------|
| `true` | Only identifiers present (no direct coordinates) |
| `false` | Coordinates or geometry already available |

### `detectedFields`

Array of detected geographic fields, each containing:

```typescript
{
  field: string;      // Field name
  type: 'coordinate' | 'identifier' | 'geometry';
  confidence: number; // 0-1 confidence score
  pattern?: string;   // Matched pattern
}
```

## Usage

### Programmatic Detection

```typescript
import { detectGeoFields } from '@oods/traits/viz/spatial';

const data = [
  { id: 1, city: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: 2, city: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
];

const result = detectGeoFields(data);

console.log(result.geoResolution);    // 'both'
console.log(result.requiresLookup);   // false
console.log(result.latitudeField);    // 'latitude'
console.log(result.longitudeField);   // 'longitude'
console.log(result.identifierField);  // 'city'
```

### Quick Check

```typescript
import { hasGeoFields } from '@oods/traits/viz/spatial';

if (hasGeoFields(myData)) {
  // Enable spatial visualization options
}
```

### Detection Options

```typescript
const result = detectGeoFields(data, {
  minConfidence: 0.8,      // Only include fields with 80%+ confidence
  analyzeValues: true,      // Analyze sample values for coordinate detection
  maxSampleSize: 100,       // Number of rows to sample for value analysis
  fieldSchemas: [           // Explicit field type hints
    { name: 'location', type: 'field.geopoint' }
  ]
});
```

## Manual Override

When auto-detection is insufficient, you can explicitly specify geographic fields:

```typescript
const traitConfig = {
  autoDetect: false,
  explicitFields: ['custom_lat', 'custom_lon'],
};
```

## Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `geo_resolution` | string | Yes | Resolution type: point, boundary, both |
| `geo_requires_lookup` | boolean | Yes | Whether geocoding is required |
| `geo_detected_fields` | object[] | No | Array of detected field info |
| `geo_latitude_field` | string | No | Primary latitude field name |
| `geo_longitude_field` | string | No | Primary longitude field name |
| `geo_identifier_field` | string | No | Primary identifier field name |
| `geo_identifier_type` | string | No | Type of identifier (country, state, etc.) |
| `geo_auto_detect_enabled` | boolean | Yes | Whether auto-detection is active |

## Trait Composition

Geocodable is designed to work seamlessly with other traits:

| Companion Trait | Use Case |
|-----------------|----------|
| `HasProjection` | Specify map projection system |
| `LayeredOverlay` | Stack multiple geographic layers |
| `InteractionTooltip` | Show details on hover |
| `InteractionZoom` | Enable pan/zoom navigation |

### Example Composition

```yaml
traits:
  - Geocodable:
      autoDetect: true
  - HasProjection:
      projectionType: albersUsa
  - InteractionTooltip:
      enabled: true
```

## Tokens

The trait defines the following design tokens:

| Token | Purpose |
|-------|---------|
| `viz.spatial.geocodable.icon` | Icon for geocodable data indicator |
| `viz.spatial.geocodable.badge.point` | Badge color for point resolution |
| `viz.spatial.geocodable.badge.boundary` | Badge color for boundary resolution |
| `viz.spatial.geocodable.badge.both` | Badge color for mixed resolution |
| `viz.spatial.geocodable.confidence.high` | High confidence indicator |
| `viz.spatial.geocodable.confidence.medium` | Medium confidence indicator |
| `viz.spatial.geocodable.confidence.low` | Low confidence indicator |

## Accessibility

Geocodable-based visualizations must follow accessibility guidelines:

- **Table Fallback**: Provide data in tabular format
- **Narrative Summary**: Include text description of geographic patterns
- **Keyboard Navigation**: Support arrow keys for region navigation
- **Screen Reader Announcements**: Announce region name and value on focus

See: [Spatial Accessibility Guide](../viz/spatial-accessibility.md)

## Examples

### Sales by State (Boundary Resolution)

```typescript
const salesData = [
  { state: 'California', revenue: 1500000 },
  { state: 'Texas', revenue: 1200000 },
  { state: 'New York', revenue: 1100000 },
];

const detection = detectGeoFields(salesData);
// geoResolution: 'boundary'
// requiresLookup: true
// identifierField: 'state'
// identifierType: 'state'
```

### Store Locations (Point Resolution)

```typescript
const storeData = [
  { store_id: 'S001', lat: 37.7749, lon: -122.4194, sales: 50000 },
  { store_id: 'S002', lat: 34.0522, lon: -118.2437, sales: 75000 },
];

const detection = detectGeoFields(storeData);
// geoResolution: 'point'
// requiresLookup: false
// latitudeField: 'lat'
// longitudeField: 'lon'
```

### Regional Performance (Both Resolution Types)

```typescript
const regionalData = [
  { region: 'West', state: 'CA', lat: 36.7783, lon: -119.4179, metric: 85 },
  { region: 'East', state: 'NY', lat: 40.7128, lon: -74.006, metric: 92 },
];

const detection = detectGeoFields(regionalData);
// geoResolution: 'both'
// requiresLookup: false (has coordinates)
// latitudeField: 'lat'
// longitudeField: 'lon'
// identifierField: 'region' or 'state'
```

## Related

- [HasProjection Trait](./has-projection.md)
- [LayeredOverlay Trait](./layered-overlay.md)
- [Spatial Module Architecture](../../cmos/foundational-docs/data-viz-part2/spatial-module/ARCHITECTURE.md)
- [Spatial Types Reference](../../src/types/viz/spatial.ts)
