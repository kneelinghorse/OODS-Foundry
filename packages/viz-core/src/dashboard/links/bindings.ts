// Per-cluster selection binding factories (sprint-113 m04). Thin, pure adapters
// translating a chart cluster's raw selection output -> the generic m01
// Selection {sourceWidgetId, dimension, values}. The slim per-cluster input
// shapes are RE-DECLARED here (lean on string ids only) so the dashboard links
// stay free of any @/ or cluster-specific (RegionFilterState / NodeFilterState)
// coupling. v1 is point/categorical only.

import type { Selection, SelectionValue } from '../../spec/dashboard-selection.js';

function toValues(value: SelectionValue | readonly SelectionValue[]): SelectionValue[] {
  return Array.isArray(value) ? [...value] : [value as SelectionValue];
}

/**
 * Categorical/tabular pick — e.g. a clicked bar or pie slice: the encoded field
 * plus the chosen value(s).
 */
export function categoricalSelection(
  sourceWidgetId: string,
  field: string,
  value: SelectionValue | readonly SelectionValue[],
): Selection {
  return { sourceWidgetId, dimension: field, values: toValues(value), kind: 'categorical' };
}

/**
 * Geo pick — e.g. a clicked choropleth region: the join/dimension field plus the
 * region id(s) (the spatial cluster's regionId, re-expressed as a generic value).
 */
export function geoSelection(
  sourceWidgetId: string,
  regionField: string,
  regionId: string | readonly string[],
): Selection {
  return { sourceWidgetId, dimension: regionField, values: toValues(regionId), kind: 'point' };
}

/**
 * Network pick — e.g. a clicked node or its adjacency: the node-id field plus the
 * node id(s) (the network cluster's nodeId / adjacentNodeIds, re-expressed
 * generically).
 */
export function networkSelection(
  sourceWidgetId: string,
  nodeField: string,
  nodeId: string | readonly string[],
): Selection {
  return { sourceWidgetId, dimension: nodeField, values: toValues(nodeId), kind: 'point' };
}
