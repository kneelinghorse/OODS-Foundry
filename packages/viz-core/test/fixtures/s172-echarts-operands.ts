// The 8 ECharts-primary (chartType, data-branch) operands the s172 cross-tool proofs run
// on. ONE definition shared by the determinism parity spec, the mutation spec and the
// accuracy spec, so every s172 claim is made about the same charts.
//
// The geo fixtures are the ones viz.render's own geo-fidelity goldens use (US_STATES /
// SALES_BY_STATE / CITIES / TRADE_FLOWS), so the parity assertions run on shapes the
// render path already treats as representative rather than on a minimal stub built to
// make the assertion easy.

export const US_STATES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      properties: { region: 'CA', state_name: 'California' },
      geometry: { type: 'Polygon', coordinates: [[[-124, 32], [-114, 32], [-114, 42], [-124, 42], [-124, 32]]] },
    },
    {
      type: 'Feature',
      id: 'NV',
      properties: { region: 'NV', state_name: 'Nevada' },
      geometry: { type: 'Polygon', coordinates: [[[-120, 35], [-114, 35], [-114, 42], [-120, 42], [-120, 35]]] },
    },
  ],
};

export const SALES_BY_STATE = [
  { state: 'CA', sales: 580 },
  { state: 'NV', sales: 96 },
];
export const CITIES = [
  { city: 'San Francisco', lng: -122.4, lat: 37.8, pop: 874 },
  { city: 'Las Vegas', lng: -115.1, lat: 36.2, pop: 646 },
];
export const TRADE_FLOWS = [
  { from: 'CA', to: 'NV', oLng: -120, oLat: 37, dLng: -116, dLat: 39, volume: 540 },
  { from: 'NV', to: 'CA', oLng: -116, oLat: 39, dLng: -120, dLat: 37, volume: 210 },
];

// The root carries an EXPLICIT value equal to its children's sum (40+35+25) so that BOTH
// hierarchy rules resolve on this operand: without it V155's precondition is absent and the
// clean-operand case would silently only exercise V154.
export const HIERARCHY_BRANCH = {
  type: 'nested' as const,
  data: {
    name: 'Total',
    value: 100,
    children: [
      { name: 'Alpha', value: 40 },
      { name: 'Beta', value: 35 },
      { name: 'Gamma', value: 25 },
    ],
  },
};

export const SANKEY_BRANCH = {
  nodes: [{ name: 'Source' }, { name: 'Middle' }, { name: 'Sink' }],
  links: [
    { source: 'Source', target: 'Middle', value: 60 },
    { source: 'Middle', target: 'Sink', value: 60 },
  ],
};

export const CHORD_BRANCH = {
  nodes: [{ name: 'North' }, { name: 'South' }, { name: 'East' }],
  links: [
    { source: 'North', target: 'South', value: 12 },
    { source: 'South', target: 'East', value: 8 },
    { source: 'East', target: 'North', value: 5 },
  ],
};

export const NETWORK_BRANCH = {
  nodes: [
    { id: 'a', group: 'core' },
    { id: 'b', group: 'core' },
    { id: 'c', group: 'edge' },
  ],
  links: [
    { source: 'a', target: 'b', value: 3 },
    { source: 'b', target: 'c', value: 1 },
  ],
};

export const GEO_CHOROPLETH_BRANCH = {
  geojson: US_STATES,
  rows: SALES_BY_STATE,
  join: { dataKey: 'state', featureProperty: 'region' },
  valueField: 'sales',
  colorScale: 'linear' as const,
};

/** A choropleth whose join key matches NO feature — the adapter attaches __joinDiagnostics. */
export const GEO_CHOROPLETH_UNMATCHED_BRANCH = {
  geojson: US_STATES,
  rows: [
    { state: 'CA', sales: 580 },
    { state: 'ZZ', sales: 11 },
  ],
  join: { dataKey: 'state', featureProperty: 'region' },
  valueField: 'sales',
  colorScale: 'linear' as const,
};

export const GEO_BUBBLE_BRANCH = {
  geojson: US_STATES,
  rows: CITIES,
  longitudeField: 'lng',
  latitudeField: 'lat',
  sizeField: 'pop',
  colorField: 'pop',
  colorScale: 'linear' as const,
};

/** bubble_map WITHOUT inline geometry — allowed (the client may register a base map). */
export const GEO_BUBBLE_NO_GEOMETRY_BRANCH = {
  rows: CITIES,
  longitudeField: 'lng',
  latitudeField: 'lat',
  sizeField: 'pop',
};

export const GEO_FLOW_BRANCH = {
  geojson: US_STATES,
  rows: TRADE_FLOWS,
  originLongitudeField: 'oLng',
  originLatitudeField: 'oLat',
  destinationLongitudeField: 'dLng',
  destinationLatitudeField: 'dLat',
  strengthField: 'volume',
  curvature: 0.3,
};

export interface EChartsOperandCase {
  readonly chartType: string;
  readonly trait: string;
  readonly branch: 'hierarchy' | 'sankey' | 'chord' | 'network' | 'geo';
  readonly branchData: unknown;
  /** viz.render input `name`, so both tools build the same IR. */
  readonly name: string;
}

export const ECHARTS_OPERAND_CASES: readonly EChartsOperandCase[] = [
  { chartType: 'treemap', trait: 'MarkTreemap', branch: 'hierarchy', branchData: HIERARCHY_BRANCH, name: 'Revenue split' },
  { chartType: 'sunburst', trait: 'MarkSunburst', branch: 'hierarchy', branchData: HIERARCHY_BRANCH, name: 'Revenue split' },
  { chartType: 'sankey', trait: 'MarkSankey', branch: 'sankey', branchData: SANKEY_BRANCH, name: 'Pipeline flow' },
  { chartType: 'chord', trait: 'MarkChord', branch: 'chord', branchData: CHORD_BRANCH, name: 'Regional trade' },
  { chartType: 'force_graph', trait: 'MarkGraph', branch: 'network', branchData: NETWORK_BRANCH, name: 'Service graph' },
  { chartType: 'choropleth', trait: 'MarkChoropleth', branch: 'geo', branchData: GEO_CHOROPLETH_BRANCH, name: 'State sales' },
  { chartType: 'bubble_map', trait: 'MarkBubble', branch: 'geo', branchData: GEO_BUBBLE_BRANCH, name: 'City population' },
  { chartType: 'flow_map', trait: 'MarkFlow', branch: 'geo', branchData: GEO_FLOW_BRANCH, name: 'Trade corridors' },
];

/** The viz.render input for a case, with the IR echoed back so certify gets the real thing. */
export function renderInputFor(operand: EChartsOperandCase): Record<string, unknown> {
  return {
    chartType: operand.chartType,
    [operand.branch]: operand.branchData,
    name: operand.name,
    output: { echarts: true, includeNormalizedSpec: true },
  };
}
