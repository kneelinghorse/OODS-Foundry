import { describe, expect, it } from 'vitest';
import type { GeoFeature } from '../../../src/components/viz/spatial/SpatialContext.js';
import {
  DEFAULT_SPATIAL_FILTER_STATE,
  createClearSpatialFilterAction,
  createPointFilterAction,
  createRegionFilterAction,
  spatialFilterReducer,
  summarizeFilters,
} from '../../../src/viz/interactions/spatial-filter-actions.js';

const SAMPLE_FEATURE: GeoFeature = {
  type: 'Feature',
  id: 'CA',
  properties: { name: 'California', abbrev: 'CA', fips: '06' },
  geometry: { type: 'Polygon', coordinates: [] },
};

describe('Spatial cross-filter actions', () => {
  it('creates a region filter action with normalized identifiers', () => {
    const action = createRegionFilterAction('widget:map', SAMPLE_FEATURE, { value: 42 });
    expect(action.type).toBe('FILTER_BY_REGION');
    expect(action.payload.regionId).toBe('california');
    expect(action.payload.featureName).toBe('California');
  });

  it('reduces region filter actions into state', () => {
    const action = createRegionFilterAction('widget:map', SAMPLE_FEATURE, { value: 42 });
    const state = spatialFilterReducer(DEFAULT_SPATIAL_FILTER_STATE, action);
    expect(state.regions).toHaveLength(1);
    expect(state.regions[0]?.sourceWidgetId).toBe('widget:map');
  });

  it('creates point filter actions using inferred coordinates', () => {
    const action = createPointFilterAction('widget:bubble', {
      city: 'Seattle',
      longitude: -122.3321,
      latitude: 47.6062,
    });
    expect(action.type).toBe('FILTER_BY_LOCATION');
    expect(action.payload.coordinates).toEqual([-122.3321, 47.6062]);
  });

  it('keeps multiple spatial filters from different widgets', () => {
    const regionAction = createRegionFilterAction('widget:map', SAMPLE_FEATURE, null);
    const locationAction = createPointFilterAction('widget:bubble', {
      lon: -90,
      lat: 32,
    });

    const stateAfterRegion = spatialFilterReducer(DEFAULT_SPATIAL_FILTER_STATE, regionAction);
    const combined = spatialFilterReducer(stateAfterRegion, locationAction);

    expect(combined.regions).toHaveLength(1);
    expect(combined.locations).toHaveLength(1);
    expect(summarizeFilters(combined)).toContain('region:california@widget:map(California)');
  });

  it('clears filters by widget id without touching others', () => {
    const actions = [
      createRegionFilterAction('widget:map', SAMPLE_FEATURE, null),
      createPointFilterAction('widget:bubble', { lon: -80, lat: 35 }),
      createClearSpatialFilterAction('widget:map'),
    ];

    const finalState = actions.reduce(spatialFilterReducer, DEFAULT_SPATIAL_FILTER_STATE);
    expect(finalState.regions).toHaveLength(0);
    expect(finalState.locations).toHaveLength(1);
  });
});
