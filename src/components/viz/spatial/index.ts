/**
 * Spatial Visualization Components
 *
 * Exports for spatial/geographic visualization components.
 */

export { SpatialContainer, type SpatialContainerProps } from './SpatialContainer.js';
export {
  SpatialContextProvider,
  useSpatialContext,
  type SpatialContextValue,
  type GeoFeature,
  type SpatialContextProviderProps,
} from './SpatialContext.js';
export { orderLayers, validateLayerConfig, mergeLayerDefaults, type LayerConfig, type OrderedLayerConfig, type ValidationResult } from './utils/layer-utils.js';
export { createProjection, fitProjectionToFeatures, projectCoordinates } from './utils/projection-utils.js';

