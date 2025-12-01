/**
 * Spatial Visualization Components
 *
 * Exports for spatial/geographic visualization components.
 */

export { SpatialContainer, type SpatialContainerProps } from './SpatialContainer.js';
export {
  SpatialContextProvider,
  useSpatialContext,
  useOptionalSpatialContext,
  type SpatialContextValue,
  type GeoFeature,
  type SpatialContextProviderProps,
} from './SpatialContext.js';
export { orderLayers, validateLayerConfig, mergeLayerDefaults, type LayerConfig, type OrderedLayerConfig, type ValidationResult } from './utils/layer-utils.js';
export { createProjection, fitProjectionToFeatures, projectCoordinates } from './utils/projection-utils.js';
export { BubbleMap, type BubbleMapProps } from './BubbleMap.js';
export { BubbleMapPoint, type BubbleMapPointProps } from './BubbleMapPoint.js';
export { BubbleMapCluster, type BubbleMapClusterProps } from './BubbleMapCluster.js';
export { MapLegend, type MapLegendProps } from './MapLegend.js';
export { MapControls, type MapControlsProps } from './MapControls.js';
export { AccessibleMapFallback, type AccessibleMapFallbackProps } from './AccessibleMapFallback.js';
export {
  setupKeyboardNav,
  handleArrowKeys,
  announceFeatureFocus,
  announceLayerChange,
  type KeyboardNavHandlers,
} from './utils/keyboard-nav-utils.js';
export {
  createLiveRegion,
  announce as announceToLiveRegion,
  announceRegionFocus,
  announceLayerChange as announceLayerChangeMessage,
  type LivePriority,
} from './utils/screen-reader-utils.js';
