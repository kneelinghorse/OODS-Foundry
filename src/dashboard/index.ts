/**
 * Dashboard Module
 *
 * Exports for dashboard widget registration and cross-filter functionality.
 */

// Network widgets
export {
  // Types
  type NetworkDashboardWidgetKind,
  type NetworkDataCategory,
  type GridSpan,
  type NetworkWidgetDataRequirements,
  type NetworkDashboardWidget,
  type RegisterNetworkWidgetsOptions,
  // Constants
  DEFAULT_NETWORK_GRID_SPAN,
  NETWORK_WIDGET_DEFAULTS,
  NETWORK_WIDGET_MIN_SIZES,
  NETWORK_WIDGET_CATEGORIES,
  NETWORK_WIDGET_DATA_REQUIREMENTS,
  // Functions
  resolveNetworkGridSpan,
  registerNetworkDashboardWidgets,
  createTreemapWidget,
  createSunburstWidget,
  createForceGraphWidget,
  createSankeyWidget,
  validateWidgetData,
} from './widgets/network-widgets.jsx';

// Network cross-filter handlers
export {
  // Action types
  type NetworkFilterAction,
  // State types
  type NodeFilterState,
  type PathFilterState,
  type LinkFilterState,
  type AdjacencyFilterState,
  type NetworkFilterState,
  // Binding types
  type NetworkInteractionBindings,
  // Constants
  DEFAULT_NETWORK_FILTER_STATE,
  // Action creators
  createNodeFilterAction,
  createPathFilterAction,
  createLinkFilterAction,
  createAdjacencyFilterAction,
  createClearNetworkFilterAction,
  // Reducer
  networkFilterReducer,
  // Bindings factory
  createNetworkInteractionBindings,
  // Utilities
  summarizeNetworkFilters,
  isNodeFiltered,
  isPathFiltered,
  getFilteredNodeIds,
} from './cross-filter/network-handlers.js';
