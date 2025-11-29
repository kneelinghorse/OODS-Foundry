import type { TraitDefinition } from '../../../src/core/trait-definition.js';
import {
  GEO_FIELD_PATTERNS,
  GEO_FIELD_TYPES,
} from '../../../src/traits/viz/spatial/geo-field-detector.js';

// Re-export types from geo-field-detector for convenience
export type {
  GeoFieldType,
  GeoResolutionType,
  DetectedGeoField,
  GeocodableOutput,
} from '../../../src/traits/viz/spatial/geo-field-detector.js';

export { GEO_FIELD_PATTERNS, GEO_FIELD_TYPES };

const GeocodableTrait = {
  trait: {
    name: 'Geocodable',
    version: '1.0.0',
    description:
      'Indicates that data contains location-resolvable information that can be mapped to coordinates or geographic boundaries.',
    category: 'viz.spatial',
    tags: ['viz', 'spatial', 'geo', 'location', 'map'],
  },

  parameters: [
    {
      name: 'autoDetect',
      type: 'boolean',
      required: false,
      description: 'Enable automatic detection of geo fields based on naming patterns.',
      default: true,
    },
    {
      name: 'explicitFields',
      type: 'string[]',
      required: false,
      description: 'Explicitly specify which fields contain geographic data.',
      default: [],
    },
    {
      name: 'minConfidence',
      type: 'number',
      required: false,
      description: 'Minimum confidence threshold for auto-detected fields (0-1).',
      default: 0.7,
      validation: {
        minimum: 0,
        maximum: 1,
      },
    },
  ] as const,

  schema: {
    geo_resolution: {
      type: 'string',
      required: true,
      description:
        'Type of geographic resolution available: point (coordinates), boundary (regions), or both.',
      default: 'point',
      validation: {
        enum: ['point', 'boundary', 'both'],
      },
    },
    geo_requires_lookup: {
      type: 'boolean',
      required: true,
      description:
        'Whether geographic identifiers require lookup to resolve to coordinates or boundaries.',
      default: false,
    },
    geo_detected_fields: {
      type: 'object[]',
      required: false,
      description: 'Array of detected geo fields with type and confidence information.',
      default: [],
    },
    geo_latitude_field: {
      type: 'string',
      required: false,
      description: 'Field name containing latitude values (for point resolution).',
    },
    geo_longitude_field: {
      type: 'string',
      required: false,
      description: 'Field name containing longitude values (for point resolution).',
    },
    geo_identifier_field: {
      type: 'string',
      required: false,
      description: 'Primary field name containing geographic identifiers (for boundary resolution).',
    },
    geo_identifier_type: {
      type: 'string',
      required: false,
      description: 'Type of geographic identifier (e.g., country, state, fips).',
    },
    geo_auto_detect_enabled: {
      type: 'boolean',
      required: true,
      description: 'Whether auto-detection of geo fields is enabled.',
      default: true,
    },
  },

  detection: {
    fieldPatterns: [
      /country|state|province|region|city|zip|postal/i,
      /lat|latitude|lon|longitude|lng/i,
      /fips|iso|geo_?id/i,
    ],
    fieldTypes: [...GEO_FIELD_TYPES],
  },

  outputs: {
    geoResolution: ['point', 'boundary', 'both'] as const,
    requiresLookup: 'boolean',
    detectedFields: [] as { field: string; type: 'coordinate' | 'identifier' | 'geometry' }[],
  },

  semantics: {
    geo_resolution: {
      semantic_type: 'viz.spatial.resolution',
      token_mapping: 'tokenMap(viz.spatial.resolution)',
      ui_hints: {
        component: 'GeoResolutionBadge',
      },
    },
    geo_requires_lookup: {
      semantic_type: 'viz.spatial.lookup',
      token_mapping: 'tokenMap(viz.spatial.lookup)',
      ui_hints: {
        component: 'BooleanIndicator',
        label_when_true: 'Requires geocoding',
        label_when_false: 'Direct coordinates',
      },
    },
    geo_detected_fields: {
      semantic_type: 'viz.spatial.detected_fields',
      ui_hints: {
        component: 'GeoFieldList',
      },
    },
    geo_latitude_field: {
      semantic_type: 'viz.spatial.coordinate.lat',
      ui_hints: {
        component: 'FieldSelector',
        filter: 'numeric',
      },
    },
    geo_longitude_field: {
      semantic_type: 'viz.spatial.coordinate.lon',
      ui_hints: {
        component: 'FieldSelector',
        filter: 'numeric',
      },
    },
    geo_identifier_field: {
      semantic_type: 'viz.spatial.identifier',
      ui_hints: {
        component: 'FieldSelector',
        filter: 'string',
      },
    },
    geo_identifier_type: {
      semantic_type: 'viz.spatial.identifier_type',
      ui_hints: {
        component: 'GeoIdentifierTypeSelector',
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'GeocodablePreview',
        position: 'top',
        priority: 70,
        props: {
          resolutionField: 'geo_resolution',
          requiresLookupField: 'geo_requires_lookup',
          detectedFieldsField: 'geo_detected_fields',
        },
      },
    ],
    form: [
      {
        component: 'GeoFieldMappingForm',
        position: 'top',
        props: {
          latitudeField: 'geo_latitude_field',
          longitudeField: 'geo_longitude_field',
          identifierField: 'geo_identifier_field',
          autoDetectField: 'geo_auto_detect_enabled',
        },
      },
    ],
    list: [
      {
        component: 'GeoResolutionBadge',
        props: {
          resolutionField: 'geo_resolution',
        },
      },
    ],
  },

  tokens: {
    'viz.spatial.geocodable.icon': 'var(--cmp-viz-spatial-geocodable-icon)',
    'viz.spatial.geocodable.badge.point': 'var(--cmp-viz-spatial-badge-point)',
    'viz.spatial.geocodable.badge.boundary': 'var(--cmp-viz-spatial-badge-boundary)',
    'viz.spatial.geocodable.badge.both': 'var(--cmp-viz-spatial-badge-both)',
    'viz.spatial.geocodable.confidence.high': 'var(--cmp-viz-spatial-confidence-high)',
    'viz.spatial.geocodable.confidence.medium': 'var(--cmp-viz-spatial-confidence-medium)',
    'viz.spatial.geocodable.confidence.low': 'var(--cmp-viz-spatial-confidence-low)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-29',
    owners: ['viz@oods.systems', 'spatial@oods.systems'],
    maturity: 'alpha',
    conflicts_with: [],
    accessibility: {
      rule_reference: 'A11Y-R-04',
      notes: 'Spatial visualizations require table fallback with region/coordinate data.',
    },
    regionsUsed: ['detail', 'form', 'list'],
    examples: ['SalesByState', 'StoreLocations', 'PopulationByCountry'],
      references: [
        'cmos/foundational-docs/data-viz-part2/spatial-module/ARCHITECTURE.md',
        'cmos/research/data-viz-oods/RV.03_Gap Analysis',
      ],
    },
} as const satisfies TraitDefinition & {
  detection: {
    fieldPatterns: readonly RegExp[];
    fieldTypes: readonly string[];
  };
  outputs: {
    geoResolution: readonly ['point', 'boundary', 'both'];
    requiresLookup: 'boolean';
    detectedFields: readonly { field: string; type: 'coordinate' | 'identifier' | 'geometry' }[];
  };
};

export default GeocodableTrait;
