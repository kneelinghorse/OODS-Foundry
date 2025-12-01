import type { GeoFeature } from '@/components/viz/spatial/SpatialContext.js';
import type { DataRecord } from '@/viz/adapters/spatial/geo-data-joiner.js';

export type SpatialFilterAction =
  | { readonly type: 'FILTER_BY_REGION'; readonly payload: RegionFilterState }
  | { readonly type: 'FILTER_BY_LOCATION'; readonly payload: LocationFilterState }
  | { readonly type: 'CLEAR_SPATIAL_FILTER'; readonly payload?: { readonly sourceWidgetId?: string } };

export interface RegionFilterState {
  readonly sourceWidgetId: string;
  readonly regionId: string;
  readonly featureName?: string;
  readonly featureProperties?: Record<string, unknown>;
  readonly datum?: DataRecord | null;
}

export interface LocationFilterState {
  readonly sourceWidgetId: string;
  readonly coordinates: [number, number];
  readonly radiusKm?: number;
  readonly datum?: DataRecord | null;
}

export interface SpatialFilterState {
  readonly regions: RegionFilterState[];
  readonly locations: LocationFilterState[];
}

export const DEFAULT_SPATIAL_FILTER_STATE: SpatialFilterState = Object.freeze({
  regions: [],
  locations: [],
});

export function createRegionFilterAction(
  sourceWidgetId: string,
  feature: GeoFeature,
  datum: DataRecord | null
): SpatialFilterAction {
  const normalized = normalizeRegion(feature);
  return {
    type: 'FILTER_BY_REGION',
    payload: {
      sourceWidgetId,
      regionId: normalized.id,
      featureName: normalized.label,
      featureProperties: normalized.properties,
      datum,
    },
  };
}

export function createPointFilterAction(
  sourceWidgetId: string,
  datum: DataRecord,
  radiusKm?: number
): SpatialFilterAction {
  const coordinates = extractCoordinates(datum);
  return {
    type: 'FILTER_BY_LOCATION',
    payload: {
      sourceWidgetId,
      coordinates,
      radiusKm,
      datum,
    },
  };
}

export function createClearSpatialFilterAction(sourceWidgetId?: string): SpatialFilterAction {
  return {
    type: 'CLEAR_SPATIAL_FILTER',
    payload: sourceWidgetId ? { sourceWidgetId } : undefined,
  };
}

export function spatialFilterReducer(
  state: SpatialFilterState = DEFAULT_SPATIAL_FILTER_STATE,
  action: SpatialFilterAction
): SpatialFilterState {
  switch (action.type) {
    case 'FILTER_BY_REGION': {
      const filtered = state.regions.filter((entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId);
      return {
        ...state,
        regions: [...filtered, action.payload],
      };
    }
    case 'FILTER_BY_LOCATION': {
      const filtered = state.locations.filter(
        (entry) => entry.sourceWidgetId !== action.payload.sourceWidgetId
      );
      return {
        ...state,
        locations: [...filtered, action.payload],
      };
    }
    case 'CLEAR_SPATIAL_FILTER': {
      if (!action.payload?.sourceWidgetId) {
        return DEFAULT_SPATIAL_FILTER_STATE;
      }
      const predicate = (entry: { sourceWidgetId: string }) =>
        entry.sourceWidgetId !== action.payload?.sourceWidgetId;
      return {
        regions: state.regions.filter(predicate),
        locations: state.locations.filter(predicate),
      };
    }
    default:
      return state;
  }
}

export function summarizeFilters(state: SpatialFilterState): string[] {
  const summaries: string[] = [];

  state.regions.forEach((region) => {
    summaries.push(
      `region:${region.regionId}@${region.sourceWidgetId}${region.featureName ? `(${region.featureName})` : ''}`
    );
  });

  state.locations.forEach((location) => {
    const [lon, lat] = location.coordinates;
    summaries.push(
      `location:${lon.toFixed(2)},${lat.toFixed(2)}@${location.sourceWidgetId}${
        location.radiusKm ? `~${location.radiusKm}km` : ''
      }`
    );
  });

  return summaries;
}

function normalizeRegion(feature: GeoFeature): {
  readonly id: string;
  readonly label?: string;
  readonly properties?: Record<string, unknown>;
} {
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const label =
    (typeof properties.name === 'string' && properties.name.trim()) ||
    (typeof properties.region === 'string' && properties.region.trim()) ||
    (typeof feature.id === 'string' && feature.id.trim()) ||
    undefined;

  const candidates: Array<unknown> = [
    properties.name,
    properties.region,
    properties.fips,
    properties.id,
    properties.abbrev,
    feature.id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIdentifier(candidate);
    if (normalized) {
      return { id: normalized, label: label ?? String(candidate), properties };
    }
  }

  return {
    id: 'unknown-region',
    label: typeof feature.id === 'string' ? feature.id : undefined,
    properties,
  };
}

function normalizeIdentifier(candidate: unknown): string | undefined {
  if (candidate === null || candidate === undefined) {
    return undefined;
  }

  const value = String(candidate).trim();
  if (!value) {
    return undefined;
  }

  return value.toLowerCase();
}

function extractCoordinates(datum: DataRecord): [number, number] {
  const coords = (datum.coordinates ?? datum.coord ?? datum.location) as unknown;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lon = coerceNumber(coords[0]);
    const lat = coerceNumber(coords[1]);
    if (lon !== null && lat !== null) {
      return [lon, lat];
    }
  }

  const lon = coerceNumber(
    (datum.longitude as unknown) ??
      (datum.lon as unknown) ??
      (datum.lng as unknown)
  );
  const lat = coerceNumber((datum.latitude as unknown) ?? (datum.lat as unknown));

  if (lon !== null && lat !== null) {
    return [lon, lat];
  }

  throw new Error('Unable to derive coordinates from datum for spatial filter action.');
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
