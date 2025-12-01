import {
  DEFAULT_SPATIAL_FILTER_STATE,
  spatialFilterReducer,
  type SpatialFilterAction,
  type SpatialFilterState,
} from './spatial-filter-actions.js';

export { DEFAULT_SPATIAL_FILTER_STATE, spatialFilterReducer };
export type { SpatialFilterAction, SpatialFilterState };

/**
 * Applies a list of spatial filter actions to the provided state.
 * Useful for tests and deterministic reducer pipelines.
 */
export function reduceSpatialFilters(
  state: SpatialFilterState,
  actions: readonly SpatialFilterAction[]
): SpatialFilterState {
  return actions.reduce<SpatialFilterState>((acc, action) => spatialFilterReducer(acc, action), state);
}

/**
 * Provides an immutable reset to the default filter state.
 */
export function resetSpatialFilters(): SpatialFilterState {
  return DEFAULT_SPATIAL_FILTER_STATE;
}
