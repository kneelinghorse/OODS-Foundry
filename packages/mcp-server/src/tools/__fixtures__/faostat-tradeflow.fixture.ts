// FAOSTAT TradeFlow fixture — the durable seed of the Phase-4 eval harness (sprint-118 m01).
//
// A HAND-AUTHORED real-FAOSTAT-slice modeled on Demo 01 ("Follow your breakfast"
// in the sibling forge-data-viz-demos project). Corridor values
// reproduce the real 2023 export-value numbers in
//   demos/01-trade-flows/proof/sample-2023-validation.json
// (Canada→USA 5,379,734 / Russia→Brazil 3,971,308.5 / Russia→India 2,628,127.1 /
//  China→India 2,572,192.2 — element 5922 "Export value", unit "1000 USD").
//
// This is the RAW per-corridor row shape (one record = one directed corridor, one
// commodity, one year), NOT a copy of extract_slice.py's AGGREGATED top_flows/top_items
// output. CONSUMER MODEL: an agent reads/shapes the data and passes these ROWS (and the
// inline geometry) to Forge as PARAMETERS — Forge never reads a filesystem.
//
// ── SIX deliberate bug-shakers (each a red→green gate owned by a later mission) ──
//   #1 (m05, OODS-V131 field-presence): a typo encoding field 'valuee' (the rows carry
//       'value') must surface a field-absence error, not silently render empty. The typo
//       is supplied by the test's encoding; the rows expose the correct 'value' field.
//   #2 (m03, OODS-V133 non-additive-rollup): `value` + `quantity` → a per-row
//       `unit_price` (= value/quantity). GOVERNED_MEASURES carries an ADDITIVE positive
//       case (export-value total) and a NON-ADDITIVE negative case (unit_price): summing
//       a price across rows is meaningless and must be blocked.
//   #3 (m06, OODS-V134 geo-join-unmatched): the India→Kazakhstan corridor's partner_m49
//       '398' has NO matching feature in WORLD_FEATURES — a choropleth join silently
//       drops it today; m06 surfaces the unmatched key.
//   #4 (m07, a11y data-quality): FAOSTAT quality flags E/I/X/A/'' across rows must be
//       surfaced (SR data-table / warning), not silently dropped.
//   #5 (m04, recommender honesty): GEO_BUBBLE_ROWS carries lat/lon coordinates (a bubble_map
//       shape). The pattern pool ranks only tabular marks, so the recommender confidently
//       bars it instead of being honest (lowConfidence) about geographic data. NOTE m04 ships
//       GEO-only honesty (lat/lon coordinates); the hierarchy/network honesty signal is
//       DEFERRED — so the #5 bug-shaker is geo-shaped, not the (deferred) CPC hierarchy.
//   #6 (m04, numeric→ordinal): `shipment_qty` is a DELIBERATE low-cardinality integer
//       measure-named column. Realistic dollar values are all-distinct (ratio 1.0) and will
//       NOT trip inferFieldType rule 4 (present>=8 ∧ distinct<=12 ∧ distinct/present<0.5);
//       this column is authored on purpose to trip it (misinferred 'ordinal'). The name uses
//       a token in m04's conservative measure set ('qty') — 'count'/'score' are EXCLUDED.
//
// NOTE on GOVERNED_MEASURES.additive: the CURRENT production measure-registry.json entry
// shape (measure-registry.ts) has NO `additive` field — only `measureRole`. The `additive`
// flag below is ANTICIPATORY fixture data: m03 formalizes it in the registry schema +
// AJV-validate-at-load + the additivity-sum gate (OODS-V132/V133). Until m03 lands these
// measures are NOT in the production registry, so resolveMeasures resolves them to V130.

export interface TradeFlowRow {
  /** Reporting (exporting) country name. */
  reporter: string;
  /** Reporter UN M49 area code (zero-padded string). */
  reporter_m49: string;
  /** Partner (importing) country name. */
  partner: string;
  /** Partner UN M49 area code (zero-padded string). */
  partner_m49: string;
  /** Commodity (FAOSTAT Item) name. */
  commodity: string;
  /** Commodity CPC code (string, leading-zero significant). */
  commodity_cpc: string;
  /** FAOSTAT element label. */
  element: string;
  /** FAOSTAT element code ('5922' = Export value). */
  element_code: string;
  /** Reference year. */
  year: number;
  /** Export value (the additive measure), unit "1000 USD". */
  value: number;
  /** Export quantity in tonnes (element 5910), joined in by the agent. */
  quantity: number;
  /** Derived per-corridor unit price = value / quantity — the NON-additive measure (#2). */
  unit_price: number;
  /** Value unit. */
  unit: string;
  /** FAOSTAT data-quality flag: E=estimated, I=imputed, X=intl-org, A=official, ''=official/blank (#4). */
  flag: string;
  /** DELIBERATE low-cardinality integer measure-named column (#6) — trips inferFieldType rule 4. */
  shipment_qty: number;
}

// Raw hand-authored corridors (unit_price derived below). Values are real 2023 export
// values where anchored (rows 1-4), realistic elsewhere. `flag` spans E/I/X/A/'' (#4);
// `shipment_qty` draws from {1,2,3,4} (#6).
const RAW_ROWS: ReadonlyArray<Omit<TradeFlowRow, 'unit_price'>> = [
  { reporter: 'Canada', reporter_m49: '124', partner: 'United States of America', partner_m49: '840', commodity: 'Wheat', commodity_cpc: '01111', element: 'Export value', element_code: '5922', year: 2023, value: 5379734.0, quantity: 12450000, unit: '1000 USD', flag: '', shipment_qty: 4 },
  { reporter: 'Russian Federation', reporter_m49: '643', partner: 'Brazil', partner_m49: '076', commodity: 'Wheat', commodity_cpc: '01111', element: 'Export value', element_code: '5922', year: 2023, value: 3971308.5, quantity: 9870000, unit: '1000 USD', flag: 'E', shipment_qty: 3 },
  { reporter: 'Russian Federation', reporter_m49: '643', partner: 'India', partner_m49: '356', commodity: 'Wheat', commodity_cpc: '01111', element: 'Export value', element_code: '5922', year: 2023, value: 2628127.1, quantity: 6540000, unit: '1000 USD', flag: 'I', shipment_qty: 3 },
  { reporter: 'China, mainland', reporter_m49: '156', partner: 'India', partner_m49: '356', commodity: 'Maize (corn)', commodity_cpc: '01112', element: 'Export value', element_code: '5922', year: 2023, value: 2572192.2, quantity: 7120000, unit: '1000 USD', flag: 'X', shipment_qty: 2 },
  { reporter: 'Brazil', reporter_m49: '076', partner: 'China, mainland', partner_m49: '156', commodity: 'Soya beans', commodity_cpc: '01411', element: 'Export value', element_code: '5922', year: 2023, value: 4830221.7, quantity: 8950000, unit: '1000 USD', flag: '', shipment_qty: 4 },
  { reporter: 'United States of America', reporter_m49: '840', partner: 'Germany', partner_m49: '276', commodity: 'Maize (corn)', commodity_cpc: '01112', element: 'Export value', element_code: '5922', year: 2023, value: 1882450.3, quantity: 5230000, unit: '1000 USD', flag: 'E', shipment_qty: 2 },
  { reporter: 'Brazil', reporter_m49: '076', partner: 'Germany', partner_m49: '276', commodity: 'Coffee, green', commodity_cpc: '01610', element: 'Export value', element_code: '5922', year: 2023, value: 1466933.8, quantity: 612000, unit: '1000 USD', flag: '', shipment_qty: 2 },
  { reporter: 'Brazil', reporter_m49: '076', partner: 'United States of America', partner_m49: '840', commodity: 'Coffee, green', commodity_cpc: '01610', element: 'Export value', element_code: '5922', year: 2023, value: 1322004.5, quantity: 540000, unit: '1000 USD', flag: 'E', shipment_qty: 3 },
  { reporter: 'India', reporter_m49: '356', partner: 'Russian Federation', partner_m49: '643', commodity: 'Rice', commodity_cpc: '01121', element: 'Export value', element_code: '5922', year: 2023, value: 989455.2, quantity: 1870000, unit: '1000 USD', flag: 'I', shipment_qty: 1 },
  { reporter: 'France', reporter_m49: '250', partner: 'China, mainland', partner_m49: '156', commodity: 'Wheat', commodity_cpc: '01111', element: 'Export value', element_code: '5922', year: 2023, value: 1145820.6, quantity: 3420000, unit: '1000 USD', flag: '', shipment_qty: 2 },
  { reporter: 'United States of America', reporter_m49: '840', partner: 'China, mainland', partner_m49: '156', commodity: 'Soya beans', commodity_cpc: '01411', element: 'Export value', element_code: '5922', year: 2023, value: 3402889.1, quantity: 6280000, unit: '1000 USD', flag: 'A', shipment_qty: 4 },
  { reporter: 'Germany', reporter_m49: '276', partner: 'France', partner_m49: '250', commodity: 'Wheat', commodity_cpc: '01111', element: 'Export value', element_code: '5922', year: 2023, value: 712339.4, quantity: 2010000, unit: '1000 USD', flag: '', shipment_qty: 1 },
  // #3 geo-join-unmatched: partner_m49 '398' (Kazakhstan) has NO matching WORLD_FEATURES feature.
  { reporter: 'India', reporter_m49: '356', partner: 'Kazakhstan', partner_m49: '398', commodity: 'Tea', commodity_cpc: '01620', element: 'Export value', element_code: '5922', year: 2023, value: 145882.0, quantity: 92000, unit: '1000 USD', flag: 'X', shipment_qty: 1 },
  { reporter: 'China, mainland', reporter_m49: '156', partner: 'Russian Federation', partner_m49: '643', commodity: 'Tea', commodity_cpc: '01620', element: 'Export value', element_code: '5922', year: 2023, value: 233190.7, quantity: 121000, unit: '1000 USD', flag: 'E', shipment_qty: 1 },
  { reporter: 'Brazil', reporter_m49: '076', partner: 'India', partner_m49: '356', commodity: 'Sugar (raw centrifugal)', commodity_cpc: '23512', element: 'Export value', element_code: '5922', year: 2023, value: 1987552.3, quantity: 5410000, unit: '1000 USD', flag: '', shipment_qty: 3 },
  { reporter: 'United States of America', reporter_m49: '840', partner: 'Canada', partner_m49: '124', commodity: 'Maize (corn)', commodity_cpc: '01112', element: 'Export value', element_code: '5922', year: 2023, value: 2899410.6, quantity: 7640000, unit: '1000 USD', flag: 'I', shipment_qty: 4 },
];

/**
 * The canonical TradeFlow rows (raw per-corridor granularity) with the derived
 * `unit_price` column. The non-additive measure (#2) targets `unit_price`; the
 * additive measure targets `value`.
 */
export const TRADEFLOW_ROWS: ReadonlyArray<TradeFlowRow> = RAW_ROWS.map((r) => ({
  ...r,
  unit_price: Number((r.value / r.quantity).toFixed(6)),
}));

/**
 * Nested CPC commodity hierarchy — fed to the EXPLICIT treemap/sunburst happy path. The leaf
 * values are the agent's per-commodity export-value aggregates ("1000 USD"). (Recommender
 * honesty #5 is GEO-shaped via GEO_BUBBLE_ROWS — hierarchy honesty is deferred past m04.)
 */
export interface CpcNode {
  name: string;
  value?: number;
  children?: CpcNode[];
}

export const CPC_HIERARCHY: CpcNode = {
  name: 'All commodities',
  children: [
    {
      name: 'Cereals',
      children: [
        { name: 'Wheat', value: 13837330 },
        { name: 'Maize (corn)', value: 7354053 },
        { name: 'Rice', value: 989455 },
      ],
    },
    {
      name: 'Oilseeds',
      children: [{ name: 'Soya beans', value: 8233111 }],
    },
    {
      name: 'Beverage crops',
      children: [
        { name: 'Coffee, green', value: 2788938 },
        { name: 'Tea', value: 379073 },
      ],
    },
    {
      name: 'Sugar crops',
      children: [{ name: 'Sugar (raw centrifugal)', value: 1987552 }],
    },
  ],
};

/**
 * A geo-shaped flat slice (#5) — per-partner import value plotted at the partner-country
 * CENTROID (lat/lon; the demo's derived *_centroid fields). This is a bubble_map shape, but
 * the tabular suggest path has no geo pattern, so it confidently bars it. The honest answer
 * (m04) is lowConfidence + a rationale pointing the agent at choropleth/bubble_map. m04 gates
 * geo-honesty on COORDINATES (lat/lon), NOT a bare 'region'/country name (which is a common
 * categorical dimension), so this slice carries real coordinates.
 */
export interface GeoBubbleRow {
  partner: string;
  lat: number;
  lon: number;
  value: number;
}

export const GEO_BUBBLE_ROWS: ReadonlyArray<GeoBubbleRow> = [
  { partner: 'United States of America', lat: 38, lon: -97, value: 5379734 },
  { partner: 'Brazil', lat: -10, lon: -55, value: 3971308 },
  { partner: 'India', lat: 22, lon: 79, value: 5200319 },
  { partner: 'China, mainland', lat: 35, lon: 103, value: 2572192 },
  { partner: 'Germany', lat: 51, lon: 10, value: 3349384 },
  { partner: 'France', lat: 46, lon: 2, value: 1145820 },
];

/**
 * Inline world geometry (a GeoJSON FeatureCollection) passed to Forge as a PARAMETER —
 * the geometry is never read from a filesystem. Boxy placeholder polygons (render-faithful
 * geometry is the demo's job, not the fixture's). Join key: properties.m49.
 * DELIBERATELY OMITS Kazakhstan ('398') so the India→Kazakhstan corridor is the
 * geo-join-unmatched bug-shaker (#3).
 */
function box(x: number, y: number): GeoJsonFeatureGeometry {
  return { type: 'Polygon', coordinates: [[[x, y], [x + 4, y], [x + 4, y + 4], [x, y + 4], [x, y]]] };
}

interface GeoJsonFeatureGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface WorldFeature {
  type: 'Feature';
  id: string;
  properties: { name: string; m49: string; iso: string };
  geometry: GeoJsonFeatureGeometry;
}

export interface WorldFeatureCollection {
  type: 'FeatureCollection';
  features: WorldFeature[];
}

export const WORLD_FEATURES: WorldFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'USA', properties: { name: 'United States of America', m49: '840', iso: 'USA' }, geometry: box(-100, 35) },
    { type: 'Feature', id: 'CAN', properties: { name: 'Canada', m49: '124', iso: 'CAN' }, geometry: box(-100, 50) },
    { type: 'Feature', id: 'RUS', properties: { name: 'Russian Federation', m49: '643', iso: 'RUS' }, geometry: box(40, 55) },
    { type: 'Feature', id: 'BRA', properties: { name: 'Brazil', m49: '076', iso: 'BRA' }, geometry: box(-55, -10) },
    { type: 'Feature', id: 'CHN', properties: { name: 'China, mainland', m49: '156', iso: 'CHN' }, geometry: box(100, 35) },
    { type: 'Feature', id: 'IND', properties: { name: 'India', m49: '356', iso: 'IND' }, geometry: box(75, 20) },
    { type: 'Feature', id: 'DEU', properties: { name: 'Germany', m49: '276', iso: 'DEU' }, geometry: box(8, 50) },
    { type: 'Feature', id: 'FRA', properties: { name: 'France', m49: '250', iso: 'FRA' }, geometry: box(2, 46) },
    // NOTE: Kazakhstan ('398') is INTENTIONALLY absent — the #3 unmatched corridor.
  ],
};

/**
 * Per-partner aggregated import value, the choropleth's tabular rows (joined into
 * WORLD_FEATURES by m49). Includes the Kazakhstan ('398') row whose key has no feature (#3).
 */
export interface GeoValueRow {
  partner: string;
  partner_m49: string;
  value: number;
}

export const GEO_VALUE_ROWS: ReadonlyArray<GeoValueRow> = Object.values(
  TRADEFLOW_ROWS.reduce<Record<string, GeoValueRow>>((acc, r) => {
    const k = r.partner_m49;
    if (!acc[k]) acc[k] = { partner: r.partner, partner_m49: r.partner_m49, value: 0 };
    acc[k].value += r.value;
    return acc;
  }, {}),
);

/**
 * A small cycle-free corridor flow for the EXPLICIT sankey happy path (the targets are
 * importer-only, so there is no directed cycle for the ECharts sankey layout).
 */
export interface SankeyFlows {
  nodes: Array<{ name: string }>;
  links: Array<{ source: string; target: string; value: number }>;
}

export const SANKEY_FLOWS: SankeyFlows = {
  nodes: [
    { name: 'Canada' },
    { name: 'Russian Federation' },
    { name: 'China, mainland' },
    { name: 'United States of America' },
    { name: 'Brazil' },
    { name: 'India' },
  ],
  links: [
    { source: 'Canada', target: 'United States of America', value: 5379734.0 },
    { source: 'Russian Federation', target: 'Brazil', value: 3971308.5 },
    { source: 'Russian Federation', target: 'India', value: 2628127.1 },
    { source: 'China, mainland', target: 'India', value: 2572192.2 },
  ],
};

/**
 * A small multi-year export-value series for the EXPLICIT line/scatter happy path
 * (the canonical rows are all 2023, so a real time axis lives here). Canada→USA wheat.
 */
export interface ExportValuePoint {
  year: number;
  value: number;
  quantity: number;
}

export const EXPORT_VALUE_TIMESERIES: ReadonlyArray<ExportValuePoint> = [
  { year: 2019, value: 3987210.0, quantity: 10120000 },
  { year: 2020, value: 4321980.5, quantity: 10890000 },
  { year: 2021, value: 4710335.2, quantity: 11240000 },
  { year: 2022, value: 5012664.8, quantity: 11870000 },
  { year: 2023, value: 5379734.0, quantity: 12450000 },
];

/**
 * Anticipatory governed-measure entries (the m03 shape). The production
 * measure-registry.json does NOT yet carry `additive` (only `measureRole`); m03 adds the
 * field + the AJV-validate-at-load + the additivity-sum gate (OODS-V132/V133). Until then
 * these keys are unknown to the resolver (resolveMeasures → OODS-V130).
 */
export interface GovernedMeasure {
  name: string;
  entityField: string;
  aggregate: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'distinct' | 'latest';
  measureRole: 'metric' | 'dimension';
  /** m03 reads this: false → a `sum` rollup is blocked with OODS-V133. */
  additive: boolean;
  displayName?: string;
  format?: string;
  unit?: string;
  provenance?: string;
}

export const GOVERNED_MEASURES: Record<string, GovernedMeasure> = {
  // POSITIVE (additive): summing export value across corridors/commodities is meaningful.
  'gm.export.value.total': {
    name: 'Total Export Value',
    entityField: 'value',
    aggregate: 'sum',
    measureRole: 'metric',
    additive: true,
    displayName: 'Total Export Value',
    format: 'currency',
    unit: '1000 USD',
    provenance: 'FAOSTAT TradeFlow export value (element 5922); additive across corridors/commodities.',
  },
  // NEGATIVE (non-additive): a per-corridor price ratio. SUM(unit_price) is meaningless —
  // the m03 additivity gate must block a `sum` rollup with OODS-V133 (#2).
  'gm.export.unit_price': {
    name: 'Export Unit Price',
    entityField: 'unit_price',
    aggregate: 'sum',
    measureRole: 'metric',
    additive: false,
    displayName: 'Export Unit Price',
    format: 'number',
    unit: '1000 USD/t',
    provenance: 'value / quantity, a per-corridor ratio — NON-additive: a summed price is meaningless; m03 blocks the sum rollup (OODS-V133).',
  },
};

/** The encoding-field typo for bug-shaker #1 (the rows carry 'value', not 'valuee'). */
export const TYPO_FIELD = 'valuee';

/** The correct value field the typo (#1) shadows. */
export const VALUE_FIELD = 'value';

/** The deliberate low-cardinality integer measure-named column for #6. */
export const ORDINAL_TRAP_FIELD = 'shipment_qty';
