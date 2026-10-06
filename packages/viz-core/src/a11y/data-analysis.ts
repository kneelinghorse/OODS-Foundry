import type { NormalizedVizSpec, TraitBinding } from '../spec/normalized-viz-spec.js';
import { deriveTrend, pearson, toNumber } from '../analysis/stats.js';
import { isProvablyAdditive } from '../analysis/field-name-hints.js';
import { formatDimension, formatNumeric, narrateNumber, type NarratedValueKind } from './format.js';

export type ChartShape = 'bar' | 'line' | 'point' | 'area' | 'mixed' | 'unknown';

export interface DataPoint {
  readonly label: string;
  readonly value: number;
}

export interface VizDataAnalysis {
  readonly mark: ChartShape;
  readonly dimensionField?: string;
  readonly measureField?: string;
  readonly colorField?: string;
  readonly sizeField?: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly dimensionValues: readonly string[];
  readonly numericValues: readonly number[];
  readonly sizeValues: readonly number[];
  readonly colorCategories: readonly string[];
  readonly min?: DataPoint;
  readonly max?: DataPoint;
  readonly first?: DataPoint;
  readonly last?: DataPoint;
  readonly total?: number;
  readonly mean?: number;
  readonly trend?: 'increasing' | 'decreasing' | 'flat';
  readonly trendDelta?: number;
  readonly correlation?: number;
  /**
   * s155 m04: whether summing `measureField` across rows is a PROVABLY meaningful aggregate
   * (isProvablyAdditive). The cartesian analyzeVizSpec sets it (true/false); the input-shaped
   * analyzers (sankey/hierarchy/network) and the pre-built-analysis path leave it UNDEFINED. The
   * narrative Total gate suppresses ONLY on an explicit `false`, so those paths stay byte-identical.
   */
  readonly measureAdditive?: boolean;
}

/**
 * Bindings + pre-built data points for one analysis. The cartesian path
 * (analyzeVizSpec) resolves these from a NormalizedVizSpec; the input-shaped
 * non-cartesian analyzers (analyzeHierarchy/analyzeSankey/analyzeNetwork,
 * sprint-128 m01) build their own rows + data points and pass them here, so
 * every chart type computes its extrema/total/mean through ONE implementation.
 */
export interface VizDataAnalysisInput {
  readonly mark: ChartShape;
  readonly rows: readonly Record<string, unknown>[];
  readonly dataPoints: readonly DataPoint[];
  readonly dimensionField?: string;
  readonly measureField?: string;
  readonly colorField?: string;
  readonly sizeField?: string;
  /**
   * Cartesian-only: derive a first→last trend. Non-cartesian rows have no
   * inherent ordering, so the analyzers leave this off (no spurious trend).
   * s150: analyzeVizSpec ALSO leaves this off for a MarkRect grid (heatmap) — its
   * row-major melt order is arbitrary and X/Y are both dimensions, so a first→last
   * read is a phantom trend (the same class F6b suppressed for KPIs).
   */
  readonly computeTrend?: boolean;
  /** Cartesian-only Pearson r; non-cartesian sources leave this undefined. */
  readonly correlation?: number;
  /**
   * s155 m04: cartesian-only additive-measure verdict (isProvablyAdditive of measureField +
   * the caller's declared aggregate). Non-cartesian sources leave it undefined → the narrative
   * Total is unchanged for them (gate suppresses only on explicit false).
   */
  readonly measureAdditive?: boolean;
}

/**
 * The shared extrema/total/mean/category core. Pure: given the rows, the
 * measure data points, and the field bindings, produce the VizDataAnalysis the
 * table + narrative generators consume. analyzeVizSpec is the cartesian wrapper;
 * the non-cartesian analyzers are the input-shaped wrappers.
 */
// s159 m6: a STABLE summation — sort ascending before reducing so the analysis Total and the guard's
// Σ drawn (the SAME multiset) round IDENTICALLY, closing the summation-order divergence that nulled a
// legit Total at large-magnitude cancellation (1e9 + -1e9 + 0.1 + 0.2 summed in two orders differed by
// ~1e-7). Pure + deterministic; the exposed numericValues array keeps its original order (only the
// scalar sum is order-canonicalized).
function stableSum(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b).reduce((sum, value) => sum + value, 0);
}

export function buildVizDataAnalysis(input: VizDataAnalysisInput): VizDataAnalysis {
  const { mark, rows, dataPoints, dimensionField, measureField, colorField, sizeField } = input;
  const min = findExtreme(dataPoints, 'min');
  const max = findExtreme(dataPoints, 'max');
  const first = dataPoints.at(0);
  const last = dataPoints.at(-1);
  const numericValues = dataPoints.map((point) => point.value);
  const total = numericValues.length > 0 ? stableSum(numericValues) : undefined;
  const mean = numericValues.length > 0 && total !== undefined ? total / numericValues.length : undefined;
  const dimensionValues = dimensionField ? extractDimensions(rows, dimensionField) : [];
  const sizeValues = sizeField ? extractNumericValues(rows, sizeField) : [];
  const colorCategories = colorField ? extractCategories(rows, colorField) : [];
  const trendInfo = input.computeTrend && first && last ? deriveTrend(first.value, last.value) : undefined;

  return {
    mark,
    dimensionField,
    measureField,
    colorField,
    sizeField,
    rows,
    rowCount: rows.length,
    dimensionValues,
    numericValues,
    sizeValues,
    colorCategories,
    min,
    max,
    first,
    last,
    total,
    mean,
    trend: trendInfo?.trend,
    trendDelta: trendInfo?.delta,
    correlation: input.correlation,
    measureAdditive: input.measureAdditive,
  } satisfies VizDataAnalysis;
}

/** s150: a MarkRect grid (heatmap) — X and Y are BOTH dimensions, the melt order is arbitrary. */
export function isMarkRectGrid(spec: NormalizedVizSpec): boolean {
  return spec.marks.length > 0 && spec.marks.every((m) => m.trait === 'MarkRect');
}

// s151 m05/m05b: the scale types that read as a quantitative measure — for a color channel
// (heatmap measure detection) AND for a position channel (point/scatter measure-channel
// detection). A documented local mirror of the cartesian adapter's QUANT_SCALE_TYPES
// (vega-lite-adapter.ts:12) — kept a local copy, not an import, so the a11y measure-detector
// carries no dependency on the adapter module.
const QUANT_SCALE_TYPES = new Set(['linear', 'log', 'sqrt']);

/**
 * s151 m05/m05b: a binding reads as a quantitative MEASURE per the field profiler's stamped
 * type/scale, NOT a coercive raw-cell `toNumber` probe (which mis-read numeric-string
 * categoricals as measures — s150 carry #895). Mirrors the adapter's own color/axis typing
 * (vega-lite-adapter.ts inferFieldType). Both branches are load-bearing: an UNSCALED
 * quantitative binding (the explicit-mode data-aware path stamps `type:'quantitative'`;
 * viz-a11y-equivalence-emission.spec.ts:53 'val') carries only `type`; a pinned binding carries
 * only `scale`. MODULE-LOCAL: the a11y barrel is `export *`, so a bare fn is not re-exported.
 */
function bindingIsQuantitative(binding: TraitBinding | undefined): boolean {
  if (!binding) return false;
  return binding.type === 'quantitative' || (binding.scale !== undefined && QUANT_SCALE_TYPES.has(binding.scale));
}

/**
 * s150 (fixes s149 F6d): a heatmap binds its MEASURE to COLOR only when color is a REAL
 * quantitative measure. Missing/categorical color → false → measure falls back to Y (pre-F6d),
 * the correct measure for a numeric-Y heatmap, which restores A11Y-R-11. ONE predicate,
 * evaluated on the SAME spec at BOTH the binding site (resolvePrimaryBindings) and the label
 * site (narrative-generator.resolveNarrativeInputs), so measure-values and measure-label can
 * never diverge again (the root cause of the s149 mislabel).
 *
 * s151 m05 (closes s150 carry #895): "quantitative" is decided by the field profiler's stamped
 * TYPE/SCALE (bindingIsQuantitative), NOT a coercive raw-cell probe. A numeric-STRING
 * categorical color (years / cluster codes / store IDs) profiles as ordinal → falls back to Y
 * (as the shipped #115 prose promises) instead of SUMMING the codes. Dropping the cell probe
 * STRENGTHENS null-tolerance (never .some()→.every()): a sparse quantitative-scale heatmap with
 * null cells stays a measure, decided purely on its scale/type.
 *
 * s159 m3 (closes the unstamped-color BYPASS the portfolio review reproduced): a DECLARED aggregate
 * on the color channel ALSO reads color as the measure, even when unstamped. Root cause of the bypass:
 * an agent may declare `color:{field:temp, aggregate:'sum'}` WITHOUT a type/scale stamp → the pure
 * bindingIsQuantitative gate said false → the measure fell to the Y DIMENSION and the narrative summed
 * the y labels ("total = Σ hours"). Positive precondition (fail-safe to silence): `aggregate` on a
 * channel is an EXPLICIT agent measure-declaration — you do not aggregate a legend dimension — so it
 * is measure INTENT. This is categorically distinct from the #895 coercive cell probe that was
 * removed (an aggregate marker is authored, not inferred from cell contents), so it does NOT resurrect
 * the sum-the-store-IDs class. Fail-safe: an UNaggregated + unstamped color still falls to Y →
 * byte-identical to today for every non-aggregated heatmap.
 */
export function heatmapColorIsMeasure(spec: NormalizedVizSpec): boolean {
  if (!isMarkRectGrid(spec)) return false;
  const color = getEncodingBinding(spec, 'color');
  return bindingIsQuantitative(color) || color?.aggregate !== undefined;
}

/**
 * s159 m5: the DRAWN heatmap cells for the ECharts render path — ONE row per (x,y) with the color
 * measure reduced by its DECLARED aggregate. Shares reduceAggregate + keyFor with the analysis path
 * (share-the-derivation), so the ECharts dataset + visualMap describe the SAME cells the a11y
 * narrative does (render == narrative == certify) instead of the RAW color extent. undefined unless a
 * MarkRect grid declares a color aggregate → the non-aggregated heatmap dataset stays byte-identical.
 * Keyed by [x,y] — the grid ECharts actually draws (it has no facet/detail axis). Exported from the
 * MODULE for the adapter's RELATIVE import; NOT on the a11y barrel allow-list → off the public surface.
 */
export function aggregateMarkRectCells(spec: NormalizedVizSpec): Record<string, unknown>[] | undefined {
  if (!isMarkRectGrid(spec)) {
    return undefined;
  }
  const color = resolveBinding(spec, 'color');
  const xField = resolveBinding(spec, 'x')?.field;
  const yField = resolveBinding(spec, 'y')?.field;
  if (!color?.field || !color.aggregate || !xField || !yField) {
    return undefined;
  }
  // s160 m2: the SHARED drawn-cell key spine (was a hand-built [x,y] — the s159 review's HIGH
  // regression: faceted cells pooled across panels + panel filters matched nothing + detail
  // collapsed). A heatmap rect never stacks, so stacking is literally false here. The emitted
  // cells CARRY every key field so downstream panel filters / encode.detail keep resolving.
  const keyFields = drawnCellKeyFields(spec, color.field, false);
  const order: string[] = [];
  const groups = new Map<string, { keyVals: Record<string, unknown>; values: unknown[] }>();
  for (const row of collectRows(spec)) {
    const key = keyFor(row, keyFields);
    let group = groups.get(key);
    if (!group) {
      const keyVals: Record<string, unknown> = {};
      for (const field of keyFields) {
        keyVals[field] = row[field as keyof typeof row];
      }
      group = { keyVals, values: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.values.push(row[color.field as keyof typeof row]);
  }
  const cells: Record<string, unknown>[] = [];
  for (const key of order) {
    const group = groups.get(key);
    if (!group) {
      continue;
    }
    const reduced = reduceAggregate(group.values, color.aggregate);
    if (reduced === undefined) {
      continue;
    }
    cells.push({ ...group.keyVals, [color.field]: reduced });
  }
  return cells;
}

/**
 * s151 m05b: a strip plot — a MarkPoint chart with a NOMINAL dimension axis, i.e. exactly ONE
 * of x/y is a quantitative measure (one measure + one categorical dimension). Its points have
 * NO inherent order (row-major ≠ a meaningful sequence) and form no x-vs-y relationship, so a
 * first→last trend and a Pearson correlation are BOTH phantom (the same class F6b/s150 killed
 * for KPIs/heatmaps). A TRUE numeric-numeric scatter (BOTH axes quantitative) is NOT a strip
 * plot → its trend/correlation are preserved. Two nominal axes (no measure) is not a strip plot.
 * MODULE-LOCAL: the a11y barrel is `export *`, so a bare fn is not re-exported (tested via its
 * effects on analyzeVizSpec/the narrative, not as a standalone public predicate).
 */
function isStripPlot(spec: NormalizedVizSpec): boolean {
  const marks = spec.marks.map((m) => normalizeMark(m.trait));
  if (marks.length === 0 || !marks.every((m) => m === 'point')) return false;
  const xq = bindingIsQuantitative(resolveBinding(spec, 'x'));
  const yq = bindingIsQuantitative(resolveBinding(spec, 'y'));
  return xq !== yq; // exactly one quantitative axis = one measure + one nominal dimension
}

/**
 * s154 F3: the ONE derivation of the spec's KNOWN normalized marks — every mark trait mapped
 * through normalizeMark with 'unknown' (MarkRect/MarkRule/…) filtered out. Shared by resolveMark
 * AND isSequenceComposition so the two can never desync again (the s150 share-the-derivation
 * recipe). Before this, isSequenceComposition read the RAW marks (an 'unknown' failed its `.every`)
 * while resolveMark filtered 'unknown', so a line+rect spec collapsed to mark='line' yet had its
 * trend suppressed → the false "remains relatively flat" on rising data (s153 F3 MED).
 */
function knownNormalizedMarks(spec: NormalizedVizSpec): ChartShape[] {
  return spec.marks.map((mark) => normalizeMark(mark.trait)).filter((mark) => mark !== 'unknown');
}

/**
 * s154 F3 (Variant A): a first→last trend is meaningful only when every KNOWN mark is a sequence
 * mark — line or area, whose X is an ordered axis (time/continuum). Filtering 'unknown' (rather
 * than failing `.every` on it) RECONCILES with resolveMark: line+rect (rect→'unknown') is a line
 * composition at BOTH sites, so its honest directional trend is restored (the s153 F3 MED desync).
 * `point` is a KNOWN mark that is DELIBERATELY not line/area, so a point+line combo still fails the
 * `.every` and stays suppressed — a scatter's honest signal is the order-invariant correlation, not
 * a first-vs-last delta. A spec whose marks are ALL unknown (known.length === 0) is not a sequence.
 * MODULE-LOCAL (the a11y barrel is `export *`; tested via analyzeVizSpec/narrative effects).
 */
function isSequenceComposition(spec: NormalizedVizSpec): boolean {
  const known = knownNormalizedMarks(spec);
  return known.length > 0 && known.every((mark) => mark === 'line' || mark === 'area');
}

/**
 * s154 F3: a FACETED layout (small multiples) renders one panel per facet key, but the analyzers
 * walk the FLAT spec.data.values, concatenating every panel's rows. A first→last delta across that
 * concatenation is a guaranteed cross-panel phantom — it sign-inverts vs every real per-panel
 * series (confirmed HIGH: facet-small-multiples-line "Trend decreasing: -33.1%" while all panels
 * rise). rows / columns / rows+columns (matrix) / wrap are all LayoutFacet sub-shapes, so this one
 * predicate covers them all. LayoutLayer (shared axis, a real single series) and LayoutConcat
 * (deliberately out of scope — fork 2) are NOT faceted and keep their trend.
 */
function isFacetedLayout(spec: NormalizedVizSpec): boolean {
  return spec.layout?.trait === 'LayoutFacet';
}

/**
 * s159 m1 (the facet-aware SPINE): the layout FACET fields — spec.layout's rows/columns
 * FacetField.field when the layout is a LayoutFacet. A faceted chart renders one PANEL per facet key,
 * so each drawn mark belongs to a (facet-panel × encoding-cell) group; the facet field is a grouping
 * surface the EncodingMap-keyed role table structurally CANNOT see (spec.layout is not an encoding
 * channel — the s158 CHANNEL_GROUPING_ROLE is `keyof EncodingMap`). Feeding this into BOTH
 * projectionGroupingFields AND drawnMarkValues closes the CRIT cross-panel marginal phantom (High
 * 62/Low 32 over drawn 10/30/54/94) at the projection AND at the independent guard in one move — the
 * spine's coverage claim becomes ENCODING ∪ LAYOUT (marks/transforms explicitly NOT modeled — memo
 * §4 disclosure). Empty for any non-faceted spec, so the non-faceted corpus is byte-identical.
 * LayoutLayer/LayoutConcat are not facets (a shared-axis layer / deliberate concat, no panels).
 * MODULE-LOCAL (the a11y barrel is `export *`; exercised via analyzeVizSpec/narrative effects).
 */
function facetFields(spec: NormalizedVizSpec): string[] {
  if (spec.layout?.trait !== 'LayoutFacet') {
    return [];
  }
  const fields: string[] = [];
  for (const facet of [spec.layout.rows, spec.layout.columns]) {
    if (facet?.field) {
      fields.push(facet.field);
    }
  }
  return fields;
}

/**
 * s155 m03: the fields that SPLIT the flat data walk into multiple ordered series — the color AND
 * detail groupings. resolveBinding reads the top-level encoding FIRST, then marks[].encodings, so
 * both the generated shape (top-level color) and the pattern-fixture shape (per-mark color, e.g.
 * focus-context-line) are covered. s155 m05 (adversarial-verify closure): BOTH channels are
 * returned, not `color ?? detail` — a genuine `detail`-grouped multi-series was slipping through
 * when a constant `color` binding shadowed the detail field. detail is conservative: it only ever
 * SUPPRESSES a genuine multi-series overlay, never invents a claim.
 */
// ── s158 m1: the STRUCTURAL SPINE (replaces the seriesGroupingFields / projectionGroupingFields
// per-channel allow-lists the s150→s157 meta-pattern indicts). ONE classification of every encoding
// channel, COMPILE-EXHAUSTIVE over the CLOSED EncodingMap (`keyof NormalizedVizSpec['encoding']`) —
// adding a 9th channel is a TYPE ERROR here, so a new grouping channel can NEVER silently under-key
// the projection or the trend gate (the recurrence's actual generator). Roles: 'positional' = x/y
// (an axis — contributes a grouping field only as a SECOND dimension: a field that is neither the
// primary dimension nor the measure, e.g. a heatmap y=hour); 'positional-range' = x2/y2 (band
// endpoints, never a grouping field); 'retinal' = color/size/shape (group marks ONLY when
// categorical; shape/size only on the marks Vega-Lite splits — point/line/area, NOT bar/rect);
// 'detail' = a pure series-grouping channel, always categorical.
type ChannelGroupingRole = 'positional' | 'positional-range' | 'retinal' | 'detail';

const CHANNEL_GROUPING_ROLE: Record<keyof NormalizedVizSpec['encoding'], ChannelGroupingRole> = {
  x: 'positional',
  y: 'positional',
  x2: 'positional-range',
  y2: 'positional-range',
  color: 'retinal',
  size: 'retinal',
  shape: 'retinal',
  detail: 'detail',
};

const POSITIONAL_CHANNELS = (
  Object.keys(CHANNEL_GROUPING_ROLE) as (keyof NormalizedVizSpec['encoding'])[]
).filter((channel) => CHANNEL_GROUPING_ROLE[channel] === 'positional');

// color, size, shape, detail — the discrete channels Vega-Lite can split drawn marks by.
const RETINAL_GROUPING_CHANNELS = (
  Object.keys(CHANNEL_GROUPING_ROLE) as (keyof NormalizedVizSpec['encoding'])[]
).filter((channel) => CHANNEL_GROUPING_ROLE[channel] === 'retinal' || CHANNEL_GROUPING_ROLE[channel] === 'detail');

// shape/size split marks into groups only on point/line/area (a symbol / size varies a line into
// multiple series); on bar/rect they are not drawn as separate marks.
function markSplitsByRetina(mark: ChartShape): boolean {
  return mark === 'point' || mark === 'line' || mark === 'area';
}

/**
 * s158 m2 (was the s155/s157 seriesGroupingFields allow-list, now DERIVED off the m1 role table):
 * the discrete channels that SPLIT the flat data walk into multiple ordered/drawn series. color /
 * detail / size preserve the s155/s157 behaviour; SHAPE is now included — Vega-Lite groups lines and
 * areas by shape exactly like color (decision #1255's "shape draws one path" premise was FALSE;
 * verified against the Vega-Lite line docs + equivalence-rules.ts:83, which already treats shape as a
 * series-distinguishing channel), mark-gated to point/line/area. detail/size/shape only ever SUPPRESS
 * a phantom, never invent one. A new EncodingMap channel forces a role above, so it cannot be missed.
 */
function seriesGroupingFields(spec: NormalizedVizSpec): string[] {
  const mark = resolveMark(spec);
  const fields: string[] = [];
  for (const channel of RETINAL_GROUPING_CHANNELS) {
    const field = resolveBinding(spec, channel)?.field;
    if (!field) {
      continue;
    }
    // shape carries series identity only on the marks Vega-Lite draws per-group (point/line/area);
    // on bar/rect it is not a separate drawn mark. (size preserves its prior unconditional handling.)
    if (channel === 'shape' && !markSplitsByRetina(mark)) {
      continue;
    }
    fields.push(field);
  }
  return fields;
}

/**
 * s160 m2 (§5.9 — share the key-FIELD derivation, not just the key builder): THE drawn-cell key
 * derivation, consumed by all three grouping sites — the analyzeVizSpec projection arm,
 * drawnMarkValues (the guard's drawn set), and aggregateMarkRectCells (the ECharts dataset +
 * visualMap cells). s159 shipped the shared keyFor but let aggregateMarkRectCells hand-build its
 * FIELD list as [x,y], so a faceted aggregated heatmap pooled cells across panels while every
 * per-panel dataset filtered to empty, and a detail grouping collapsed (the s159 review's HIGH
 * regression). One derivation means a channel/layout axis can never again be present in the
 * narrative's key and absent from a renderer's.
 * CONTRACT: positional dimension axes ∪ facetFields ∪ (stacking ? ∅ : seriesGroupingFields). A
 * positional channel (x/y) is a DRAWN AXIS and always keys — EXCEPT when it IS the measure channel
 * (a bar/area draws its value on a positional axis; that axis is the measure, not a dimension), in
 * which case it is skipped. The exclusion on positional channels is therefore by CHANNEL (via the
 * shared resolvePrimaryChannels measureChannel), NOT by field-NAME. facet/series fields exclude the
 * measure by NAME (on an aggregated heatmap COLOR IS THE MEASURE and seriesGroupingFields returns
 * color unconditionally — without this a plain heatmap shatters into per-raw-row cells). Deduped,
 * first-appearance order (positional → facet → series). Facet fields key even under stacking (a
 * panel never stacks).
 * s161 m1 (the ONLY true s160 regression): the positional exclusion USED to be by field-name, so a
 * `color={field:x.field, aggregate:'count'}` heatmap (measureField===x.field, but the measure lives
 * on COLOR not x) DROPPED the drawn x axis → cells merged across x (a `count(*) per hour/day` heatmap
 * collapsed to one cell per day). Keying off the measure CHANNEL keeps the colliding dimension axis
 * while still dropping a bar/area's genuine measure axis (the stacked-bar keep-control). Exported
 * from the MODULE for the spine-blind proof probes (relative-path import), deliberately OFF the a11y
 * allow-list barrel — not public API.
 */
export function drawnCellKeyFields(spec: NormalizedVizSpec, measureField: string, stacking: boolean): string[] {
  const fields: string[] = [];
  // The measure CHANNEL (shared derivation) — the positional axis, if any, that draws the value.
  const measureChannel = resolvePrimaryChannels(spec).measureChannel;
  // Facet + series grouping fields exclude the measure by NAME (color-is-measure dedup — without it
  // a plain heatmap shatters into per-raw-row cells).
  const add = (field: string | undefined) => {
    if (field && field !== measureField && !fields.includes(field)) {
      fields.push(field);
    }
  };
  for (const channel of POSITIONAL_CHANNELS) {
    // A positional dimension axis always keys; the measure channel (a bar/area value axis) does not.
    if (channel === measureChannel) {
      continue;
    }
    const field = resolveBinding(spec, channel)?.field;
    if (field && !fields.includes(field)) {
      fields.push(field);
    }
  }
  for (const field of facetFields(spec)) {
    add(field);
  }
  if (!stacking) {
    for (const field of seriesGroupingFields(spec)) {
      add(field);
    }
  }
  return fields;
}

/**
 * s163 m1 (§2-m1): THE narrated value's drawn-cell key — the field list the analyzeVizSpec VALUE path
 * projects `analysisRows` with under a declared aggregate (`drawnCellKeyFields` minus the primary
 * dimension). The SINGLE SOURCE for the value key: the value site (`analyzeVizSpec` projection arm), the
 * guard twin (`expectedNarratableCorrelation`), AND the s163 drift assert all read it, so the "classifier
 * at least as fine as the value" invariant is anchored to the SAME derivation the value uses (no
 * transcription, §5.9). It calls `drawnCellKeyFields` DIRECTLY (NOT via `correlationGroupingFields`), so
 * reverting the classifier's grouping does NOT move it — that asymmetry is what makes the drift assert
 * non-vacuous (the s162 draft's set-equality assert derived both operands from one call → a tautology the
 * wf_3eb9fe92-cd8 critic caught). Module export for the proof spec (relative path), OFF the a11y allow-list
 * barrel — not public API.
 */
export function narratedValueCellKey(spec: NormalizedVizSpec): string[] {
  const bindings = resolvePrimaryBindings(spec);
  if (!bindings.measureField) {
    return [];
  }
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const stacking = declaredAggregate ? isStackTotalAggregate(declaredAggregate) && markStacks(bindings.mark) : false;
  return drawnCellKeyFields(spec, bindings.measureField, stacking).filter((field) => field !== bindings.dimensionField);
}

/**
 * s159 m2 (the §5.3 no-transcription rule made CODE): the ONE composite group-key builder, CALLED by
 * projectAggregatedRows, drawnMarkValues, and distinctGroupCount. Joins the field values with NUL
 * (`\0`) and maps null/undefined to a NUL-prefixed sentinel — NUL cannot appear in a real cell label,
 * so distinct field tuples ALWAYS yield distinct keys. Before this, projectAggregatedRows joined with
 * NUL while drawnMarkValues joined with a LITERAL SPACE (transcribed from the NUL-STRIPPED terminal
 * display — the exact bug §5.3 forbids), so {region:'North', series:'a b'} and {region:'North a',
 * series:'b'} both keyed to `North a b` → the guard collapsed two real cells and NULLED a legit
 * extremum/Total. One function means the projection and its checker can never diverge again. The `\0`
 * ESCAPE (not a raw NUL byte) is deliberate — a raw NUL is invisible in a terminal, which is how the
 * transcription bug hid in the first place.
 *
 * s170 m01: EXPORTED FROM THE MODULE (relative-path import only) so the accuracy pillar's
 * aggregation-collapse rule keys its groups with THIS function rather than re-typing the join
 * — re-typing it is precisely the s159 defect, and here it would UNDER-count groups and so
 * invent a collapse that the data does not contain. Deliberately NOT added to the a11y
 * allow-list barrel below (index.ts is an explicit allow-list since s159 m4, so a module
 * export is not a public-API move); the same treatment `drawnCellKeyFields` already has.
 * NOTE: the pre-s170 tail of this comment said "the a11y barrel is `export *`" — that was
 * true when it was written and stopped being true at s159 m4; corrected rather than left.
 */
export function keyFor(row: Record<string, unknown>, fields: readonly string[]): string {
  return fields
    .map((field) => {
      const value = row[field as keyof typeof row];
      return value === null || value === undefined ? '\0null' : String(value);
    })
    .join('\0');
}

// s155 m05: distinct GROUP count over a field, counting null/undefined as ITS OWN bucket. A color
// field split into null rows (a reference series) + labelled rows (a forecast series) is two series;
// dropping the nulls under-counted it to one and let a phantom trend through. A field that is
// entirely null (or entirely one value) stays a single bucket → not multi-series.
function distinctGroupCount(rows: readonly Record<string, unknown>[], field: string): number {
  const buckets = new Set<string>();
  for (const row of rows) {
    buckets.add(keyFor(row, [field]));
  }
  return buckets.size;
}

/**
 * s155 m03 (CLAIM-ON-POSITIVE-EVIDENCE): a first→last trend is a cross-series PHANTOM unless the
 * spec is provably a SINGLE ordered series. Multi-series ⟺ a FACETED layout (one panel per facet
 * key) OR a color/detail grouping field resolving to MORE THAN ONE distinct group over the rows.
 * This POSITIVE, data-grounded precondition (fail-safe to omission) folds the shipped facet fix +
 * LayoutConcat (fork-2, via its color arm — focus-context-line carries color=region ×3) +
 * color-grouped (fork-4) under ONE gate, replacing the s154 NEGATIVE `!isFacetedLayout`
 * enumeration that was false on every un-named series-concatenation surface. NO concat-structural
 * clause is needed: a real single-series concat has 0/1-distinct color, so it is NOT suppressed
 * and keeps its honest trend.
 */
function isMultiSeriesComposition(spec: NormalizedVizSpec, rows: readonly Record<string, unknown>[]): boolean {
  if (isFacetedLayout(spec)) {
    return true;
  }
  return seriesGroupingFields(spec).some((field) => distinctGroupCount(rows, field) > 1);
}

/**
 * s155 m03 (sort-by-X, memo §5): for a single ordered series, canonicalize the data points by the
 * X binding so the directional claim is a property of the DATA, not the incidental row order in
 * `data.values`. This closes the row-permutation phantom (#910) for LEGIT single lines too — a
 * time series stored newest-first no longer narrates "declines" for rising data. Numeric compare
 * when both cells parse as finite numbers (years / ordinals); else a stable string compare (ISO
 * dates, zero-padded period labels). Pure + stable (Array.sort is stable) for determinism.
 */
function sortRowsByField(
  rows: readonly Record<string, unknown>[],
  field: string,
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => compareCells(a[field as keyof typeof a], b[field as keyof typeof b]));
}

// s157 m05 (V1): a STRING carrying a decimal dot is a version/release axis label
// (1.9 → 1.10 → 1.11), NOT a continuous number — Number('1.10')=1.1 collapses the trailing zero
// and sorts 1.10 BEFORE 1.9, narrating a phantom decline on a rising release series. A genuinely
// continuous value arrives as a NUMBER (1.5), never a dotted string, so gating on string-with-dot
// routes ONLY version labels to the chunk-wise naturalCompare (which reads each dotted part as an
// integer: 1.9 < 1.10 < 1.11 — a TOTAL order, so row-permutation-invariance holds); numeric axes
// keep the exact numeric fast-path.
function isDottedVersionString(value: unknown): boolean {
  return typeof value === 'string' && value.includes('.');
}

// s158 m5 (Fork 1, ratified): the DIMENSION axis is a version/release label (1.9, 1.10, 1.11)
// when any of its values is a dotted-version STRING. deriveCorrelation coerces the dimension via
// toNumber (Number('1.10')=1.1), so a rising release series inverts into a phantom "negative
// relationship" (the s157 dotted-version sibling of V1, in a DIFFERENT function). A version label has
// no continuous magnitude for Pearson, so SUPPRESS the correlation (same posture as the
// isMarkRectGrid / isStripPlot gate) rather than fabricate a coefficient. A genuinely continuous axis
// arrives as a NUMBER (isDottedVersionString(1.5)=false), so it is never suppressed. Reuses V1's
// discriminator; fail-safe to silence.
function isDottedVersionDimension(
  rows: readonly Record<string, unknown>[],
  dimensionField: string | undefined
): boolean {
  if (!dimensionField) {
    return false;
  }
  return rows.some((row) => isDottedVersionString(row[dimensionField as keyof typeof row]));
}

function compareCells(a: unknown, b: unknown): number {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null && !isDottedVersionString(a) && !isDottedVersionString(b)) {
    return na - nb;
  }
  const sa = a === null || a === undefined ? '' : String(a);
  const sb = b === null || b === undefined ? '' : String(b);
  return naturalCompare(sa, sb);
}

// s155 m05 (adversarial-verify closure): a NATURAL-ORDER string comparison — split each label into
// maximal digit / non-digit chunks and compare chunk-wise, digit chunks NUMERICALLY. A plain
// lexical compare mis-ordered every non-zero-padded sequential label ('2021-9' after '2021-10',
// 'v10' before 'v9'), so sort-by-X narrated a DECLINE on rising release/monthly data. Natural order
// fixes it and is a TOTAL ORDER (transitive + deterministic — unlike a naive numeric/lexical mix),
// so the row-permutation invariant holds. Zero-padded/ISO/numeric labels are unaffected.
function naturalCompare(a: string, b: string): number {
  const ax = a.match(/\d+|\D+/g) ?? [];
  const bx = b.match(/\d+|\D+/g) ?? [];
  const n = Math.min(ax.length, bx.length);
  for (let i = 0; i < n; i += 1) {
    const as = ax[i];
    const bs = bx[i];
    if (as === bs) {
      continue;
    }
    if (/^\d/.test(as) && /^\d/.test(bs)) {
      const delta = Number(as) - Number(bs);
      if (delta !== 0) {
        return delta;
      }
    } else {
      return as < bs ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

export function analyzeVizSpec(spec: NormalizedVizSpec): VizDataAnalysis {
  const bindings = resolvePrimaryBindings(spec);
  const rows = collectRows(spec);
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  // s156 m06 (CLAIM-ON-POSITIVE-EVIDENCE): when the measure carries a DECLARED aggregate and a
  // dimension is present, the rendered chart draws ONE reduced value per distinct dimension value
  // (Vega aggregates on the visual side; dashboard.render forwards the raw cross-filtered rows +
  // the aggregate encoding). Project the raw rows to that grouped shape so extrema/total/keyFindings
  // describe the values the chart DRAWS — not the pre-aggregation rows (raw East=60 vs grouped
  // East=110), and so a count/distinct over a NON-numeric measure yields ≥2 dataPoints instead of 0
  // (the false A11Y-R-11). POSITIVE precondition + fail-safe: fires ONLY when an aggregate is
  // declared, so the no-aggregate path is byte-identical (#564 / property P3).
  const analysisRows =
    declaredAggregate && bindings.dimensionField && bindings.measureField
      ? projectAggregatedRows(
          rows,
          bindings.dimensionField,
          bindings.measureField,
          declaredAggregate,
          // s157 m02 (B1/A2) + s158 m2: a stacking aggregate (sum/count) on a mark that ACTUALLY
          // stacks (bar/area) draws a per-dimension stack total — collapse the SERIES groupings. Every
          // other case — non-stacking aggregates (avg/min/max/median/distinct) AND summative
          // aggregates on a non-stacking mark (a color-is-measure heatmap rect) — draws one mark per
          // (dimension × second-positional × grouping) cell → project per drawn cell so extrema/total
          // name a real mark (the s158 heatmap survivor fix). s159 m1: a FACET panel never stacks (each
          // panel is a separate sub-chart), so the facet field STILL keys even under the stack collapse.
          // s160 m2: both arms read the ONE shared drawnCellKeyFields spine (stacking folds the series
          // channels inside it; facet fields always key) — the same derivation the guard's drawn set and
          // the ECharts cell builder consume, minus the primary dimension (already the projection's key
          // head). s163 m1: routed through the shared `narratedValueCellKey` so the value key has ONE
          // source consumed by the value site, the guard twin, AND the correlation drift assert (§5.9).
          narratedValueCellKey(spec),
        )
      : rows;
  // s155 m03: a first→last trend is meaningful only over a SINGLE ordered series. When the marks
  // ARE a sequence (line/area), canonicalize the points by the X binding (sort-by-X) so first/last
  // — and thus the directional claim + narrative sentence — reflect the X axis, not the row order.
  // ORIGINAL `rows` still feed dimensionValues/colorCategories/rowCount (unchanged); only the
  // dataPoints that drive first/last/trend are reordered (min/max/total/mean are order-invariant).
  const sequence = isSequenceComposition(spec);
  const orderedRows =
    sequence && bindings.dimensionField ? sortRowsByField(analysisRows, bindings.dimensionField) : analysisRows;
  const dataPoints = buildDataPoints(orderedRows, bindings);
  // s155 m04 (CLAIM-ON-POSITIVE-EVIDENCE): resolve whether the measure is PROVABLY additive from
  // its raw field name + the caller's declared aggregate — the SAME token model the profiler types
  // with (shared field-name-hints). The narrative "Total X" gate reads this so a sum-the-IDs /
  // sum-the-zips / sum-the-maxes claim (id_max, sales_id, zip) is never emitted; a declared
  // aggregate:'sum'/'count' or an additive head (revenue, id_count) still gets its honest Total.
  const measureAdditive = isProvablyAdditive(bindings.measureField, declaredAggregate);
  const analysis = buildVizDataAnalysis({
    mark: bindings.mark,
    rows,
    dataPoints,
    dimensionField: bindings.dimensionField,
    measureField: bindings.measureField,
    colorField: bindings.colorField,
    sizeField: bindings.sizeField,
    measureAdditive,
    // s155 m03 (CLAIM-ON-POSITIVE-EVIDENCE, replaces the s154 `!isFacetedLayout` negative gate): a
    // directional trend is emitted only when the spec is PROVABLY a single ordered series
    // (isMultiSeriesComposition false) AND the marks are a sequence (line/area). Multi-series —
    // faceted, or a color/detail grouping with >1 distinct value — concatenates every series into
    // one flat walk, so a first→last delta sign-inverts vs each real series (fork-2 concat, fork-4
    // color-group). isSequenceComposition still excludes bar / point / rect / true scatter (their
    // honest signal is extrema or the order-invariant correlation, not a first-vs-last delta;
    // #910). When suppressed, the line/area path (narrative-generator.ts:203-214) emits an
    // order-invariant range sentence. The correlation gate below is UNCHANGED.
    computeTrend: !isMultiSeriesComposition(spec, rows) && sequence,
    // s160 m3 (Shape B): the correlation VALUE reads analysisRows (the drawn cells under a declared
    // aggregate — the complement; identical to rows otherwise) while the sign gate inside
    // deriveCorrelation partitions the RAW rows (they carry the facet/series fields).
    correlation:
      isMarkRectGrid(spec) || isStripPlot(spec) || isDottedVersionDimension(rows, bindings.dimensionField)
        ? undefined
        : deriveCorrelation(spec, analysisRows, rows, bindings, declaredAggregate),
  });
  // s158 m3: the PERMANENT drawn-value fail-safe (Fork 2, ratified). After every derivation, null any
  // narrated extremum / Total that is NOT a real drawn mark — checked against an INDEPENDENTLY-derived
  // drawn set (drawnMarkValueSet, on the raw-rows path) so it bites a future under-key even if the
  // root fix above is one day defeated by a new channel. Inert (byte-identical) when no aggregate is
  // declared. The root fix keeps it quiet; the guard is what survives the NEXT under-enumeration.
  return enforceDrawnValueInvariant(analysis, spec, declaredAggregate);
}

function resolveMark(spec: NormalizedVizSpec): ChartShape {
  const uniqueMarks = [...new Set(knownNormalizedMarks(spec))];
  return uniqueMarks.length === 1 ? uniqueMarks[0] : uniqueMarks.length > 1 ? 'mixed' : 'unknown';
}

/**
 * s151 m05b: the ONE derivation of which CHANNEL carries the measure vs the dimension — shared
 * by BOTH the binding site (resolvePrimaryBindings, which reads the VALUES) AND the label site
 * (narrative-generator.resolveNarrativeInputs, which reads the TITLES). A pure fn on the same
 * spec at both sites can't diverge, so measure-VALUES and measure-LABEL can never mismatch (the
 * s149 F6d root cause; the s150 KEY LEARNING — "share the derivation, don't re-derive"). Cases:
 *  - real heatmap (heatmapColorIsMeasure): measure = COLOR, dimension = X (s150).
 *  - HORIZONTAL strip plot (MarkPoint, quantitative X + nominal Y): measure = X, dimension = Y.
 *  - HORIZONTAL AGGREGATED bar/area (s161 m3, Fork-2=A): mark ∈ {bar, area} with a declared
 *    AGGREGATE on X and none on Y → measure = X, dimension = Y. A horizontal bar draws its value on
 *    the X axis; the pre-s161 point-only horizontal arm left it on the Y default, so the narrative
 *    labelled the category axis (year codes) as the measure and inverted High/Low + summed the codes.
 *  - everything else (vertical bar/line/area, vertical strip, numeric-numeric scatter): measure = Y,
 *    dimension = X (the pre-existing default — behaviour-preserving).
 */
export function resolvePrimaryChannels(spec: NormalizedVizSpec): {
  readonly measureChannel: 'x' | 'y' | 'color';
  readonly dimensionChannel: 'x' | 'y';
  readonly colorIsMeasure: boolean;
} {
  if (heatmapColorIsMeasure(spec)) {
    return { measureChannel: 'color', dimensionChannel: 'x', colorIsMeasure: true };
  }
  const mark = resolveMark(spec);
  const horizontalStrip =
    mark === 'point' &&
    bindingIsQuantitative(resolveBinding(spec, 'x')) &&
    !bindingIsQuantitative(resolveBinding(spec, 'y'));
  if (horizontalStrip) {
    return { measureChannel: 'x', dimensionChannel: 'y', colorIsMeasure: false };
  }
  // s161 m3: a horizontal AGGREGATED bar/area. Keyed on the DECLARED AGGREGATE ("aggregate is
  // intent", s159), NOT on quantitativeness — bindingIsQuantitative is FALSE for an unstamped
  // aggregated field (that path recurs the s159 unstamped-color bypass on X), and a quant-x rule
  // would misfire a legit vertical bar (stamped-quant x dimension + unstamped aggregated y). A
  // vertical bar carries its aggregate on Y, so the `x-aggregate ∧ ¬y-aggregate` guard never fires
  // for it.
  const horizontalAggregatedBar =
    (mark === 'bar' || mark === 'area') &&
    resolveBinding(spec, 'x')?.aggregate !== undefined &&
    resolveBinding(spec, 'y')?.aggregate === undefined;
  if (horizontalAggregatedBar) {
    return { measureChannel: 'x', dimensionChannel: 'y', colorIsMeasure: false };
  }
  // s162 m2: a RAW (pre-computed, un-aggregated) horizontal bar/area — mark ∈ {bar,area}, a
  // STAMPED-quantitative x (the drawn measure = the bar LENGTH) over a band/nominal y (the dimension).
  // The s161 arm above fires only when a declared aggregate sits on x, so a raw horizontal bar fell to
  // the default measure=y and narrated the numeric category codes as the measure (High=shortest bar,
  // Total=Σ category codes). GATE on NEITHER axis carrying a declared aggregate so the s161-warned
  // vertical-bar misfire (a stamped-quant-x DIMENSION + an UNSTAMPED aggregated y) — which carries its
  // aggregate on y — is EXCLUDED (falls through to the m3 aggregate arm / the default measure=y). `!x.bin`
  // excludes a raw binned-x histogram (its x is a binned dimension, not the measure). Keyed on the
  // field's STAMPED type/scale (bindingIsQuantitative), NOT a coercive raw-cell probe — an UNSTAMPED
  // numeric x does NOT fire (measure=y, disclosed §4; fixing it would resurrect the #895 probe).
  const xBinding = resolveBinding(spec, 'x');
  const rawHorizontalBar =
    (mark === 'bar' || mark === 'area') &&
    xBinding?.aggregate === undefined &&
    resolveBinding(spec, 'y')?.aggregate === undefined &&
    !xBinding?.bin &&
    bindingIsQuantitative(xBinding) &&
    !bindingIsQuantitative(resolveBinding(spec, 'y'));
  if (rawHorizontalBar) {
    return { measureChannel: 'x', dimensionChannel: 'y', colorIsMeasure: false };
  }
  return { measureChannel: 'y', dimensionChannel: 'x', colorIsMeasure: false };
}

function resolvePrimaryBindings(spec: NormalizedVizSpec): {
  readonly mark: ChartShape;
  readonly dimensionField?: string;
  readonly measureField?: string;
  readonly colorField?: string;
  readonly sizeField?: string;
} {
  const { measureChannel, dimensionChannel, colorIsMeasure } = resolvePrimaryChannels(spec);

  const dimensionBinding = resolveBinding(spec, dimensionChannel);
  const measureBinding = resolveBinding(spec, measureChannel);
  // COLOR IS the measure on a real heatmap — drop colorField so its values aren't listed as
  // "color category" findings. When color is categorical/absent we keep it as a normal series.
  const colorBinding = colorIsMeasure ? undefined : resolveBinding(spec, 'color');
  const sizeBinding = resolveBinding(spec, 'size');

  return {
    mark: resolveMark(spec),
    dimensionField: dimensionBinding?.field,
    measureField: measureBinding?.field,
    colorField: colorBinding?.field,
    sizeField: sizeBinding?.field,
  };
}

export function getEncodingBinding(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding']
): TraitBinding | undefined {
  return resolveBinding(spec, channel);
}

function resolveBinding(spec: NormalizedVizSpec, channel: keyof NormalizedVizSpec['encoding']): TraitBinding | undefined {
  const topLevel = spec.encoding?.[channel];
  if (topLevel) {
    return topLevel;
  }
  for (const mark of spec.marks) {
    const binding = mark.encodings?.[channel];
    if (binding) {
      return binding;
    }
  }
  return undefined;
}

function normalizeMark(traitId: string | undefined): ChartShape {
  if (!traitId) {
    return 'unknown';
  }
  const normalized = traitId.toLowerCase();
  if (normalized.includes('markbar')) {
    return 'bar';
  }
  if (normalized.includes('markline')) {
    return 'line';
  }
  if (normalized.includes('markpoint')) {
    return 'point';
  }
  if (normalized.includes('markarea')) {
    return 'area';
  }
  return 'unknown';
}

function collectRows(spec: NormalizedVizSpec): Record<string, unknown>[] {
  if (!Array.isArray(spec.data.values)) {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  for (const entry of spec.data.values) {
    if (isRecord(entry)) {
      rows.push(entry);
    }
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// s156 m06: reduce one group's raw measure values to the declared aggregate — mirrors the Vega
// adapter's mapAggregate (average→mean). count = record count; distinct = distinct non-null values;
// sum/average/min/max/median operate on the numeric values and are UNDEFINED for a group with no
// numeric values (you cannot sum/average strings — it drops rather than reporting a phantom 0).
function reduceAggregate(
  values: readonly unknown[],
  aggregate: NonNullable<TraitBinding['aggregate']>
): number | undefined {
  if (aggregate === 'count') {
    return values.length;
  }
  if (aggregate === 'distinct') {
    const seen = new Set<string>();
    for (const value of values) {
      if (value !== null && value !== undefined) {
        seen.add(String(value));
      }
    }
    return seen.size;
  }
  const numeric: number[] = [];
  for (const value of values) {
    const n = toNumber(value);
    if (n !== null) {
      numeric.push(n);
    }
  }
  if (numeric.length === 0) {
    return undefined;
  }
  if (aggregate === 'sum') {
    // s160 m1: canonical (sorted) order — the analysis Total, the guard's Σdrawn, and the ECharts
    // cell values all reduce through here, so one summation order keeps the three bit-identical
    // even on the no-dimension arm where the projection is skipped.
    return stableSum(numeric);
  }
  if (aggregate === 'average') {
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }
  if (aggregate === 'min') {
    return Math.min(...numeric);
  }
  if (aggregate === 'max') {
    return Math.max(...numeric);
  }
  // median
  const sorted = [...numeric].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// s157 m02 (A2, ratified + adapter-verified): the OODS Vega adapter (vega-lite-adapter.ts) emits
// NO explicit stack / xOffset — mapAggregate maps average→mean; sum/count/min/max/median/distinct
// pass through — so stacking is Vega-Lite's DEFAULT: a nominal-color quantitative bar/area STACKS
// only for the SUMMATIVE aggregates. For sum/count the salient DRAWN quantity is the per-dimension
// STACK TOTAL, which is exactly the s156 dimension-level reduction (sum-over-colors == the stack
// height), so keep the projection dimension-level. average/min/max/median draw side-by-side
// (grouped, non-stacked) cells → reduce PER DRAWN CELL. distinct is summative in Vega, BUT summing
// distinct counts across a stack is non-additive (the stack total ≠ distinct-over-the-dimension →
// a value drawn on NO segment), so distinct reduces per cell too — each cell value is a real drawn
// segment height. (Recorded per the A2 verify-and-match mandate.)
function isStackTotalAggregate(aggregate: NonNullable<TraitBinding['aggregate']>): boolean {
  return aggregate === 'sum' || aggregate === 'count';
}

// s158 m2: stacking (a per-dimension total drawn as ONE bar/area height) is a bar/area concept — a
// heatmap rect colours each (x,y) cell by its OWN aggregate, so a summative heatmap draws per cell,
// not a stack total. The stack-total collapse therefore applies only when the mark actually stacks;
// otherwise a sum/count color-is-measure heatmap would collapse its second positional dimension into
// a per-x marginal (the sum-heatmap sibling of the s157 survivor).
function markStacks(mark: ChartShape): boolean {
  return mark === 'bar' || mark === 'area';
}

// s158 m2 (B1 root fix — the s157 heatmap survivor): the SECOND positional dimension the chart draws
// marks over. A heatmap binds x AND y to dimensions with the measure on color, so each (x,y) rect is
// a distinct drawn cell; the primary dimension (x) heads the projection key, but y must ALSO be in it
// or the projection collapses y into a per-x MARGINAL mean drawn on NO rect (the s157 "67.8/22.6"
// survivor). A normal cartesian chart has exactly ONE positional dimension (x=dim, y=measure) → this
// returns undefined → the projection key is byte-identical. x2/y2 are band endpoints (role
// 'positional-range'), never a dimension. Derived off the m1 POSITIONAL_CHANNELS role list.
// s158 m2 → s160 m2: the former secondaryPositionalDimensionField/projectionGroupingFields pair
// collapsed into the shared drawnCellKeyFields spine (one derivation, three consumers — projection,
// guard, ECharts cells); the projection arm passes spine-minus-primary-dimension.

// s156 m06 / s157 m02: group the raw rows by the dimension field PLUS the secondary discrete
// grouping channels (groupingFields — empty for stacking aggregates + the no-secondary-grouping
// case, so the key collapses to the dimension alone = byte-identical grouping to s156), each group
// a DRAWN cell, and emit ONE row per group carrying the declared reduction as the measure field.
// First-appearance order; keys are built by keyFor (NUL join + '\0null' sentinel — never the
// literal string "null"). A group whose reduction is undefined (sum/avg/min/max/median over a
// non-numeric cell) drops out. Deterministic: group order = first-appearance order of the keys.
function projectAggregatedRows(
  rows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  aggregate: NonNullable<TraitBinding['aggregate']>,
  groupingFields: readonly string[]
): Record<string, unknown>[] {
  const keyFields = [dimensionField, ...groupingFields];
  const order: string[] = [];
  const groups = new Map<string, { dimValue: unknown; values: unknown[] }>();
  for (const row of rows) {
    const dimValue = row[dimensionField as keyof typeof row];
    const key = keyFor(row, keyFields);
    let group = groups.get(key);
    if (!group) {
      group = { dimValue, values: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.values.push(row[measureField as keyof typeof row]);
  }
  const projected: Record<string, unknown>[] = [];
  for (const key of order) {
    const group = groups.get(key);
    if (!group) {
      continue;
    }
    const reduced = reduceAggregate(group.values, aggregate);
    if (reduced === undefined) {
      continue;
    }
    projected.push({ [dimensionField]: group.dimValue, [measureField]: reduced });
  }
  return projected;
}

// ── s158 m3: the ORACLE-INDEPENDENT drawn-mark guard (Fork 2 — the PERMANENT fail-safe of record).
// The narrative may name only a value the chart actually DRAWS. drawnMarkValueSet recomputes the set
// of drawn values on the RAW-rows path (collectRows + reduceAggregate), keyed off the m1 role table —
// calling NONE of projectAggregatedRows / projectionGroupingFields / resolvePrimaryChannels' dimension
// resolution (the functions that produced the s157 phantom). So its membership check bites a narrated
// extremum drawn on no mark on a path the projection bug cannot corrupt.

// s159 m3 (share the derivation — the s150 lesson, 3rd occurrence): the measure the chart aggregates
// is the ONE resolvePrimaryChannels resolves (measureChannel), NOT an x-first channel scan. The old
// scan returned the FIRST channel carrying an aggregate, so a dual-aggregate scatter (x-avg + y-avg)
// resolved the measure to X while the analysis measured Y (resolvePrimaryChannels) → the guard's drawn
// set was the wrong metric and it NULLED the honest Y extrema/Total. Sharing resolvePrimaryChannels'
// measure channel makes the guard and the analysis un-divergeable on WHICH field is the measure —
// while drawnMarkValues still keys the DIMENSIONS off the positional channels directly (so the
// heatmap's y is never lost; that was the original scan's stated worry, and it is a dimension concern,
// not a measure one). For a real heatmap / normal bar / line this is byte-identical (the aggregated
// channel already WAS the first-scanned measure).
function findAggregatedMeasure(
  spec: NormalizedVizSpec
): { field: string; aggregate: NonNullable<TraitBinding['aggregate']> } | undefined {
  const binding = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel);
  if (binding?.field && binding.aggregate) {
    return { field: binding.field, aggregate: binding.aggregate };
  }
  return undefined;
}

// The reduced value the chart draws for EACH mark, WITH multiplicity (so a repeated cell value is
// summed honestly into Total), PAIRED with its primary-dimension label (s159 m4 — enables (dim,value)
// pair membership). Key = every positional dimension (≠ measure) plus the facet panel plus, for a
// non-stacking draw, the categorical grouping channels; a stacking draw (sum/count on bar/area) draws
// the per-dimension stack total, so the series channels don't key it (the facet still does). A
// multi-row-per-cell cell is RE-REDUCED (an avg cell reports the cell's average, never a raw row).
// undefined ⇒ no aggregate. The label uses resolvePrimaryChannels' dimension channel — the SAME one
// the analysis labels its data points by (buildDataPoints) — so a legit extremum's (label,value) pair
// can never fail to match its own drawn cell. Label undefined ⇒ no primary dimension (pair check
// degrades to value-only there).
function drawnMarkValues(spec: NormalizedVizSpec): { label: string | undefined; value: number }[] | undefined {
  const measure = findAggregatedMeasure(spec);
  if (!measure) {
    return undefined;
  }
  const stacking = isStackTotalAggregate(measure.aggregate) && markStacks(resolveMark(spec));
  const primaryDimField = resolveBinding(spec, resolvePrimaryChannels(spec).dimensionChannel)?.field;
  // s160 m2: the addKey walk below WAS this exact derivation inline — it is now the shared
  // drawnCellKeyFields spine (byte-identical field list by construction). NOTE the honesty scope:
  // after m2 the guard shares the KEY-FIELD ENUMERATION with the projection (and the renderer), so
  // it protects against call-site drift, not against a spine-level under-enumeration — that
  // evidence lives in the hand-oracle harness (zero product classification imports) plus the
  // standing spine-blind probes in the guard proof spec.
  const keyFields = drawnCellKeyFields(spec, measure.field, stacking);
  const order: string[] = [];
  const groups = new Map<string, { label: string | undefined; values: unknown[] }>();
  for (const row of collectRows(spec)) {
    const key = keyFields.length === 0 ? '∅' : keyFor(row, keyFields);
    let group = groups.get(key);
    if (!group) {
      const label = primaryDimField ? formatDimension(row[primaryDimField as keyof typeof row]) : undefined;
      group = { label, values: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.values.push(row[measure.field as keyof typeof row]);
  }
  const drawn: { label: string | undefined; value: number }[] = [];
  for (const key of order) {
    const group = groups.get(key);
    if (!group) {
      continue;
    }
    const reduced = reduceAggregate(group.values, measure.aggregate);
    if (reduced !== undefined) {
      drawn.push({ label: group.label, value: reduced });
    }
  }
  return drawn;
}

// A RELATIVE-only epsilon compare (s159 m6: dropped the max(1,…) absolute floor — the floor made the
// tolerance too tight for a small final Total that carried a large-magnitude cancellation's rounding
// error; the stableSum canonical order is what actually closes that case, and relative-only keeps the
// tolerance proportional to the compared magnitudes). Float aggregates (average) must not spuriously
// miss; distinct drawn values must not be spuriously equated.
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

// s159 m4 (the guard's DETECTION CORE, factored out so a synthetic phantom analysis can exercise it in
// ISOLATION without routing through analyzeVizSpec — the guard-isolation unit + mutation gate + A3
// revert-proof import THIS by RELATIVE PATH). Exported from the module but deliberately NOT re-exported
// by the a11y barrel (src/a11y/index.ts is an explicit allow-list, so this is off the public
// @oods/viz-core surface — the s158 findNonDrawnNarrativeValues deviation resolved: no public export).
// Reports which narrated values are NOT backed by a drawn mark: an extremum whose value is on no drawn
// cell, or a Total ≠ Σ drawn (INV2). All-false ⇒ fully drawn-backed. No declared aggregate / no drawn
// cells ⇒ all-false (byte-identical pass-through).
export function findNonDrawnNarrativeValues(
  analysis: VizDataAnalysis,
  spec: NormalizedVizSpec,
  declaredAggregate: TraitBinding['aggregate'] | undefined
): { maxPhantom: boolean; minPhantom: boolean; totalPhantom: boolean; correlationPhantom: boolean } {
  // s160 m3 — the correlation arm has its OWN positive precondition (analysis.correlation defined):
  // it must NOT sit behind the declaredAggregate early-return below, which skips every scatter (the
  // exact class the CRIT phantom lived in). Fires when the narrated r has no honest recompute
  // (recompute-null-while-narrated) or drifts from it beyond the 3-decimal rounding grain (|Δ| >
  // 0.001 — pearson is toFixed(3)-rounded, so a tighter epsilon would false-fire on double-rounding).
  const correlationPhantom =
    analysis.correlation !== undefined &&
    (() => {
      const expected = expectedNarratableCorrelation(spec);
      return expected === undefined || Math.abs(expected - analysis.correlation) > 0.001;
    })();
  const none = { maxPhantom: false, minPhantom: false, totalPhantom: false, correlationPhantom };
  if (!declaredAggregate) {
    return none;
  }
  const drawn = drawnMarkValues(spec);
  if (!drawn || drawn.length === 0) {
    return none;
  }
  // s159 m4 (dim,value) PAIR membership: a cell backs an extremum only when its value matches AND its
  // primary-dimension label matches — closing the marginal-coincides-with-some-drawn-value blessing
  // (min/max/median). A cell with no primary-dim label (a no-dimension aggregate) degrades to
  // value-only, byte-identical to the pre-m4 guard.
  const isDrawn = (point: DataPoint | undefined): boolean =>
    point !== undefined &&
    drawn.some(
      (cell) => approxEqual(cell.value, point.value) && (cell.label === undefined || cell.label === point.label)
    );
  const drawnSum = stableSum(drawn.map((cell) => cell.value));
  return {
    maxPhantom: analysis.max !== undefined && !isDrawn(analysis.max),
    minPhantom: analysis.min !== undefined && !isDrawn(analysis.min),
    totalPhantom: analysis.total !== undefined && !approxEqual(analysis.total, drawnSum),
    correlationPhantom,
  };
}

// s158 m3 (the guard): null ONLY the offending narrated value (never couple max/min) when it is not a
// drawn mark; null Total when it ≠ Σ drawn (INV2, relative epsilon). Positive precondition = a declared
// aggregate (else byte-identical pass-through); on no violation, returns the analysis unchanged
// (byte-identical). Never re-derives or relabels — honest silence, never a fabricated value; never
// touches analysis.rows. Detection is findNonDrawnNarrativeValues (shared with the isolation/gate tests
// so the checker and the enforcer can never diverge).
export function enforceDrawnValueInvariant(
  analysis: VizDataAnalysis,
  spec: NormalizedVizSpec,
  declaredAggregate: TraitBinding['aggregate'] | undefined
): VizDataAnalysis {
  const phantom = findNonDrawnNarrativeValues(analysis, spec, declaredAggregate);
  if (!phantom.maxPhantom && !phantom.minPhantom && !phantom.totalPhantom && !phantom.correlationPhantom) {
    return analysis;
  }
  return {
    ...analysis,
    max: phantom.maxPhantom ? undefined : analysis.max,
    min: phantom.minPhantom ? undefined : analysis.min,
    total: phantom.totalPhantom ? undefined : analysis.total,
    // s160 m3: a phantom r is nulled the same honest-silence way — both narrative emission sites
    // (point summary + the mark-independent keyFindings line) gate on undefined.
    correlation: phantom.correlationPhantom ? undefined : analysis.correlation,
  };
}

function buildDataPoints(
  rows: readonly Record<string, unknown>[],
  bindings: ReturnType<typeof resolvePrimaryBindings>
): DataPoint[] {
  if (!bindings.measureField) {
    return [];
  }
  const points: DataPoint[] = [];
  rows.forEach((row, index) => {
    const rawValue = row[bindings.measureField as keyof typeof row];
    const numericValue = toNumber(rawValue);
    if (numericValue === null) {
      return;
    }
    const label = bindings.dimensionField
      ? formatDimension(row[bindings.dimensionField as keyof typeof row])
      : undefined;
    points.push({ label: label ?? `Row ${index + 1}`, value: numericValue });
  });
  return points;
}

function extractDimensions(rows: readonly Record<string, unknown>[], field: string): string[] {
  const values: string[] = [];
  rows.forEach((row) => {
    const label = formatDimension(row[field as keyof typeof row]);
    if (label) {
      values.push(label);
    }
  });
  return values;
}

function extractNumericValues(rows: readonly Record<string, unknown>[], field: string): number[] {
  const values: number[] = [];
  rows.forEach((row) => {
    const numeric = toNumber(row[field as keyof typeof row]);
    if (numeric !== null) {
      values.push(numeric);
    }
  });
  return values;
}

function extractCategories(rows: readonly Record<string, unknown>[], field: string): string[] {
  const set = new Set<string>();
  rows.forEach((row) => {
    const value = row[field as keyof typeof row];
    if (value === null || value === undefined) {
      return;
    }
    set.add(String(value));
  });
  return [...set];
}

function findExtreme(points: readonly DataPoint[], kind: 'min' | 'max'): DataPoint | undefined {
  if (points.length === 0) {
    return undefined;
  }
  return points.reduce((extreme, current) => {
    if (kind === 'min') {
      return current.value < extreme.value ? current : extreme;
    }
    return current.value > extreme.value ? current : extreme;
  }, points[0]);
}

function pearsonOverRows(
  rows: readonly Record<string, unknown>[],
  xField: string,
  yField: string
): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  rows.forEach((row) => {
    const x = toNumber(row[xField as keyof typeof row]);
    const y = toNumber(row[yField as keyof typeof row]);
    if (x === null || y === null) {
      return;
    }
    xs.push(x);
    ys.push(y);
  });
  // The single Pearson implementation lives in analysis/stats. Null for <3 paired points or zero
  // variance — "computable" throughout the Shape-B gate means exactly this contract.
  return pearson(xs, ys);
}

/**
 * s160 m3 (Fork-1 = Shape B, ratified): the fields that partition a chart's rows into the
 * (facet-panel × categorical-series) groups a narrated correlation must not contradict. Facet fields
 * plus the CATEGORICAL retinal channels — the channel ENUMERATION is the m1 role table
 * (RETINAL_GROUPING_CHANNELS), so a new grouping channel cannot silently skip this gate; the filter
 * is m3's own semantic: a QUANTITATIVE retinal binding (bubble size, a color ramp) is a per-point
 * MAGNITUDE, not a partition — letting it key would shred every group to n=1 and vacuate the gate
 * (critic-caught: size binds THE MEASURE in 2 of the 6 correlation-emitting corpus fixtures). The
 * primary dimension and the measure never partition (they are the correlation's own axes).
 */
function correlationPartitionFields(
  spec: NormalizedVizSpec,
  dimensionField: string,
  measureField: string
): string[] {
  const fields: string[] = [];
  const add = (field: string | undefined) => {
    if (field && field !== dimensionField && field !== measureField && !fields.includes(field)) {
      fields.push(field);
    }
  };
  for (const field of facetFields(spec)) {
    add(field);
  }
  const mark = resolveMark(spec);
  for (const channel of RETINAL_GROUPING_CHANNELS) {
    const binding = resolveBinding(spec, channel);
    if (!binding?.field || bindingIsQuantitative(binding)) {
      continue;
    }
    if (channel === 'shape' && !markSplitsByRetina(mark)) {
      continue;
    }
    add(binding.field);
  }
  return fields;
}

/**
 * s163 m1 (§2-m1, §8 Fork-1 — design A): the classifier's per-group re-projection key = the narrated
 * value's drawn-cell key (`drawnCellKeyFields` minus the dimension) MINUS the partition fields. Keying
 * each partition group's re-projection by these makes the direction classifier read cells AT LEAST AS
 * FINE as the value pools (`narratedValueCellKey ⊆ partitionFields ∪ correlationGroupingFields`): every
 * drawn-cell key axis the value keeps but `correlationPartitionFields` skips — a quantitative retinal
 * `size`/color-ramp — is re-absorbed here, so the classifier can never be COARSER than the value. Coarser-
 * than-value was the s162 size-collapse survivor's exact mechanism (it re-projected with `[]`). SINGLE
 * SOURCE: `deriveCorrelation` (runtime), `correlationGroupDirections`, and `correlationClassifierActualKey`
 * (the drift-assert capture) all call this, so reverting it to `[]` (the s162 bug) moves BOTH the runtime
 * classifier AND the assert's captured key → the drift assert bites (non-vacuous). Under stacking the value
 * drops the series so this returns `∅`, but `deriveCorrelation` still partitions by the FULL
 * `partitionFields` → the s162 per-segment suppression is PRESERVED (design A, NOT the rejected design B
 * whose intersection collapsed the partition and narrated the stack-total phantom).
 */
function correlationGroupingFields(
  spec: NormalizedVizSpec,
  dimensionField: string,
  measureField: string,
  partitionFields: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined
): string[] {
  const stacking = declaredAggregate ? isStackTotalAggregate(declaredAggregate) && markStacks(resolveMark(spec)) : false;
  return drawnCellKeyFields(spec, measureField, stacking).filter(
    (field) => field !== dimensionField && !partitionFields.includes(field)
  );
}

/**
 * s165 m1 (§3.1 A5): every DISTINCT binding a channel carries across the WHOLE spec — the top-level
 * `spec.encoding` PLUS every `spec.marks[i].encodings` — deduped by field, first-appearance order.
 * This mirrors the cartesian adapter's per-layer merge (`toVegaLiteSpec` compiles ONE LAYER PER MARK
 * and merges the top-level encoding into each), which `resolveBinding` does NOT: it returns the FIRST
 * mark carrying the channel and stops. That short-circuit is survivor D's exact mechanism — a
 * `[MarkLine{color:seg}, MarkPoint{color:grp}]` spec draws BOTH color fields (verified: compiled layer
 * colors `["seg","grp"]`) while every s164 gate saw only `seg`. MODULE-LOCAL.
 */
function bindingsUnion(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding']
): TraitBinding[] {
  const bindings: TraitBinding[] = [];
  const seen = new Set<string>();
  const add = (binding: TraitBinding | undefined) => {
    if (!binding?.field || seen.has(binding.field)) {
      return;
    }
    seen.add(binding.field);
    bindings.push(binding);
  };
  add(spec.encoding?.[channel]);
  for (const mark of spec.marks) {
    add(mark.encodings?.[channel]);
  }
  return bindings;
}

/**
 * s165 m1 (§3.1, §5 RULE 15 — the fail-safe SUPERSET; the CORRELATION gate only). Every field that
 * COULD split the drawn marks into a visually separable sub-series. Derived so the enumeration can only
 * be a SUPERSET of render truth: an over-inclusion silences an honest coefficient (disclosed, §6.1),
 * an under-inclusion ships a phantom. Every s159→s164 error fell toward NARRATION; this inverts the
 * direction of error for the FIELD DERIVATION — rule 15's entire scope. (The decision-level direction of
 * error is NOT asserted here; it is machine-proven by the m2 monotonicity oracle.)
 *
 * FOUR deliberate departures from the s164 derivations, one per confirmed survivor of the s164
 * genuine-close review (PS-2026-07-24-002):
 *  - PER-LAYER UNION (`bindingsUnion`, NEVER `resolveBinding`) — survivor D, above.
 *  - `shape` is UNCONDITIONALLY separable, with NO mark gate. `markSplitsByRetina(resolveMark(spec))`
 *    is FALSE for any 2-distinct-mark spec (`resolveMark` collapses it to `'mixed'`), which dropped
 *    shape from BOTH s164 gates and narrated 0.79 over two shape bands at pearson −1.0 (survivor A).
 *    Any mark-shaped predicate here re-opens that class — including the rejected
 *    `knownNormalizedMarks.some(markSplitsByRetina)` draft, which is false for exactly the 'unknown'
 *    marks it was meant to admit.
 *  - `color` keys even when QUANTITATIVE. A color RAMP is visually separable (distinct fills + a
 *    legend); `correlationPartitionFields`' quantitative skip is a partition-ARITY concern (it would
 *    shred every group to n=1), which is a different question from separability (survivor B).
 *  - STACKING DROPS NOTHING. `drawnCellKeyFields` drops the series fields under a stack total because
 *    the narrated VALUE pools them into the stack height; the segments are still DRAWN, so they can
 *    still contradict (survivor B).
 * `size`/`detail` always key — `detail` over-suppresses on the ECharts adapter, which routes it to
 * tooltip only (an error toward SILENCE, §6.6 renderer divergence). Facet rows/columns always key
 * (panels). A positional axis keys only as a SECOND dimension: never the measure CHANNEL, and never the
 * primary dimension or measure FIELD — those are the correlation's own axes. Deterministic
 * first-appearance order (positional → facet → retinal) so the m3 subset cap is argued, not incidental.
 * Module export for the proof specs + the §4 compiled-superset oracle (relative path), OFF the a11y
 * allow-list barrel — not public API.
 */
export function separableFields(
  spec: NormalizedVizSpec,
  dimensionField: string,
  measureField: string
): string[] {
  const fields: string[] = [];
  const measureChannel = resolvePrimaryChannels(spec).measureChannel;
  const add = (field: string | undefined) => {
    if (field && field !== dimensionField && field !== measureField && !fields.includes(field)) {
      fields.push(field);
    }
  };
  for (const channel of POSITIONAL_CHANNELS) {
    // The value axis is not a separator; a SECOND positional dimension (a heatmap y) is.
    if (channel === measureChannel) {
      continue;
    }
    for (const binding of bindingsUnion(spec, channel)) {
      add(binding.field);
    }
  }
  for (const field of facetFields(spec)) {
    add(field);
  }
  // color / size / shape / detail — every one, unconditionally: no quantitativeness filter, no mark
  // gate, no stacking drop. The channel ENUMERATION is still the s158 m1 role table, so a 9th encoding
  // channel is a compile error there before it can be missed here.
  for (const channel of RETINAL_GROUPING_CHANNELS) {
    for (const binding of bindingsUnion(spec, channel)) {
      add(binding.field);
    }
  }
  return fields;
}

/**
 * s165 m1 (§3.5 — ratified fork F2: stay SILENT on a layered spec whose drawn marks the row walk
 * structurally cannot model). Two cases, neither reachable by ANY field-list derivation:
 *  - a mark carrying its own `from` dataset: `collectRows` (:838) reads `spec.data.values` ONLY, so
 *    that layer's marks are drawn from rows the analysis never sees. The missing rows cannot be
 *    enumerated, so no separable-field superset can cover them.
 *  - marks binding MORE THAN ONE distinct measure field: the "pooled r over (dimension, measure)" the
 *    narrative emits is then not a statistic of any single drawn series — a second layer draws a
 *    different measure on the same axis.
 * Both SUPPRESS the correlation. No exception is carved into the §7 closeout claim.
 * Module export for the proof spec (relative path), OFF the a11y allow-list barrel — not public API.
 */
export function layeredCorrelationUnsupported(spec: NormalizedVizSpec): boolean {
  if (spec.marks.some((mark) => mark.from !== undefined)) {
    return true;
  }
  return bindingsUnion(spec, resolvePrimaryChannels(spec).measureChannel).length > 1;
}

const signOf = (r: number): -1 | 0 | 1 => (r > 0 ? 1 : r < 0 ? -1 : 0);

// s161 m2 — a per-group DIRECTION class. A DIRECTIONAL vote is a sign in {−1,0,+1} (0 = FLAT, a
// genuine "no relationship"); UNKNOWN is a group that carries NO slope evidence (fewer than 2 finite
// pairs, or a vertical line — zero x-variance). UNKNOWN groups are DROPPED from the evidence set; a
// FLAT(0) group VOTES (it is real evidence that within that group nothing rises/falls).
type GroupDirection = -1 | 0 | 1 | 'unknown';

/**
 * s161 m2 (c1+c2 — the load-bearing fix; SSOT §2-m2): classify ONE group's within-group DIRECTION.
 * This is NOT `pearson`: pearson's null contract collapses n<3 AND zero-variance into one "not
 * computable" answer, so a small (n=2) but real slope carried NO vote (the B1 mixed-computability
 * phantom) and a zero-variance FLAT group vacated instead of counting as flat (the all-flat phantom).
 * The classifier splits those apart over the group's FINITE (dim, measure) pairs:
 *  - the finite-filter + `n < 2` short-circuit run BEFORE any mean/covariance math, so signOf never
 *    sees NaN (a NaN/Infinity/non-numeric measure cell is dropped → its group can only be UNKNOWN).
 *  - `n < 2` → UNKNOWN (no slope).
 *  - zero x-variance (`denomX === 0`, tested DIRECTLY before any covariance — catches a vertical line
 *    including an n=2 same-x pair) → UNKNOWN (direction undefined).
 *  - `n === 2` (with x-variance) → sign of the raw covariance == the 2-point SLOPE sign (pearson is
 *    degenerate at n=2, but a 2-point slope carries the Simpson-relevant direction).
 *  - `n >= 3` (with x-variance) → sign of the ROUNDED pearson; a group rounding to 0.000 → FLAT(0)
 *    (magnitude-symmetric with the pooled side, which pearson also rounds). pearson returns null here
 *    only when the Y axis has zero variance (a horizontal line) → also FLAT(0).
 */
function classifyGroupDirection(
  rows: readonly Record<string, unknown>[],
  xField: string,
  yField: string
): GroupDirection {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const x = toNumber(row[xField as keyof typeof row]);
    const y = toNumber(row[yField as keyof typeof row]);
    if (x === null || y === null) {
      continue;
    }
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (n < 2) {
    return 'unknown';
  }
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  let denomX = 0;
  for (const x of xs) {
    denomX += (x - meanX) * (x - meanX);
  }
  if (denomX === 0) {
    return 'unknown'; // vertical line — no direction (incl. a same-x n=2 pair)
  }
  if (n === 2) {
    const meanY = (ys[0] + ys[1]) / 2;
    let cov = 0;
    for (let i = 0; i < 2; i += 1) {
      cov += (xs[i] - meanX) * (ys[i] - meanY);
    }
    return signOf(cov); // slope sign (cov sign == slope sign when x-variance ≠ 0)
  }
  const r = pearson(xs, ys);
  return r === null ? 0 : signOf(r); // null with x-variance ≠ 0 ⇒ zero Y-variance ⇒ FLAT
}

/**
 * s161 m2 — the CONTRADICTION-FIRST narratability predicate (SSOT §2-m2; the ORDER is load-bearing,
 * §1a). A narrated pooled correlation must not contradict the per-group DIRECTION evidence.
 *  (1) evidence = the signs of all non-UNKNOWN groups. EMPTY (every group n<2 or vertical) → NARRATE
 *      (the pinned vacuous-pass — keeps bubble/no-partition distributions; the disclosed
 *      all-unknown escape narrows to exactly this).
 *  (2) evidence spans MORE THAN ONE sign → SUPPRESS. Contradiction FIRST (before any pooled-sign
 *      branch) so a Simpson sign-cancellation whose pooled rounds to 0/−0 cannot slip through as a
 *      "weak" narration (the §1a regression the critic caught). Kills B1 {+1,−1}, opposing-pooled-0
 *      {+1,−1}, and keeps P4 {0,+1} suppressed — one edit, no new disclosure.
 *  (3) a single common sign `s`:
 *      - s === 0 (all groups FLAT): a directional pooled r is a pure between-group artifact →
 *        SUPPRESS unless the pooled also rounds to 0 (kills the all-flat 0.95 CORR-EDGE-2).
 *      - s ≠ 0: the pooled agrees (or is itself 0) → NARRATE; a pooled of the OPPOSITE sign is a
 *        Simpson reversal → SUPPRESS (kills F-SIMPSON).
 * pooled is already the 3-decimal-rounded statistic the narrative emits (pearson rounds it).
 */
function narratableCorrelation(pooled: number, classes: readonly GroupDirection[]): boolean {
  const evidence = classes.filter((c): c is -1 | 0 | 1 => c !== 'unknown');
  if (evidence.length === 0) {
    return true; // vacuous-pass (pinned): no directional evidence to contradict
  }
  if (new Set(evidence).size > 1) {
    return false; // groups disagree — SUPPRESS (contradiction-first)
  }
  const s = evidence[0];
  const pooledSign = signOf(pooled);
  if (s === 0) {
    return pooledSign === 0; // all-flat groups: only a flat pooled may narrate
  }
  return pooledSign === 0 || pooledSign === s; // Simpson-reversal guard
}

// s164 m1 (§10, §5 rule 14 — the DIMENSIONLESS opposition floor, LOCKED ρ=0.5). An n>=3 drawn
// sub-series counts as DIRECTIONAL only when its OWN |pearson| >= ρ — a scale-invariant signal (unlike
// the v2 magnitude/Δ proxy the between-group separation could inflate without bound). An n=2 sub-series
// votes its slope UNCONDITIONALLY (|r|=1 is degenerate at two points). ρ is a two-sided separator: a
// visible cliff/stepped opposing band (|r|~0.65) suppresses; a scattered opposing band (|r|~0.3)
// narrates (the disclosed bounded n>=3 [0,ρ) gray-zone, §4 residual-1).
const CORRELATION_OPPOSITION_RHO = 0.5;

// s164 m1 (§10): every subset of the grouping fields, for the full-lattice COLLECT-EVERY scan. |k|<=4
// in practice (size/shape/detail/second-positional), so 2^k is small.
function subsetsOf<T>(items: readonly T[]): T[][] {
  const out: T[][] = [[]];
  for (const item of items) {
    const len = out.length;
    for (let i = 0; i < len; i += 1) {
      out.push([...out[i], item]);
    }
  }
  return out;
}

/**
 * s164 m1 (§10 (G1) — the dimensionless direction vote for ONE drawn sub-series). Same finite-filter +
 * n<2 / zero-x-variance -> 'unknown' + n=2 covariance-slope contract as `classifyGroupDirection` (which
 * G0 keeps UNGATED — the byte-identical s163 path), but the n>=3 vote is gated on |pearson| >= ρ so a
 * scattered opposing band below the floor reads as FLAT(0), not a real opposite. `pearson` is already the
 * 3-decimal-rounded statistic the narrative emits, so the sign and the magnitude read the SAME r.
 */
function classifyDrawnSeriesDirection(xs: readonly number[], ys: readonly number[]): GroupDirection {
  const n = xs.length;
  if (n < 2) {
    return 'unknown';
  }
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  let denomX = 0;
  for (const x of xs) {
    denomX += (x - meanX) * (x - meanX);
  }
  if (denomX === 0) {
    return 'unknown'; // vertical line — no direction
  }
  if (n === 2) {
    const meanY = (ys[0] + ys[1]) / 2;
    let cov = 0;
    for (let i = 0; i < 2; i += 1) {
      cov += (xs[i] - meanX) * (ys[i] - meanY);
    }
    return signOf(cov); // n=2 votes its slope unconditionally (no ρ gate)
  }
  const r = pearson(xs, ys);
  if (r === null) {
    return 0; // n>=3 with x-variance ⇒ zero Y-variance ⇒ FLAT
  }
  return Math.abs(r) >= CORRELATION_OPPOSITION_RHO ? signOf(r) : 0; // dimensionless ρ gate (n>=3 only)
}

/**
 * s164 m1 (§10): the DRAWN sub-series at grouping granularity `keyFields` inside a partition group.
 * Under a declared aggregate the marks are the per-(dimension ∪ keyFields) reduced cells — but
 * `projectAggregatedRows` strips the key from its output, so re-derive the sub key here and bucket the
 * cells by it; without a declared aggregate the marks are the raw rows keyed the same way. Returns one
 * (xs, ys) series per distinct keyFields value.
 */
function drawnSubSeries(
  rows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  keyFields: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined
): { xs: number[]; ys: number[] }[] {
  const bySub = new Map<string, { xs: number[]; ys: number[] }>();
  const push = (sub: string, x: number, y: number) => {
    let series = bySub.get(sub);
    if (!series) {
      series = { xs: [], ys: [] };
      bySub.set(sub, series);
    }
    series.xs.push(x);
    series.ys.push(y);
  };
  if (declaredAggregate) {
    const cells = new Map<string, { sub: string; dim: unknown; values: unknown[] }>();
    for (const row of rows) {
      const key = keyFor(row, [dimensionField, ...keyFields]);
      let cell = cells.get(key);
      if (!cell) {
        cell = { sub: keyFor(row, keyFields), dim: row[dimensionField as keyof typeof row], values: [] };
        cells.set(key, cell);
      }
      cell.values.push(row[measureField as keyof typeof row]);
    }
    for (const cell of cells.values()) {
      const reduced = reduceAggregate(cell.values, declaredAggregate);
      const x = toNumber(cell.dim);
      if (reduced === undefined || x === null) {
        continue;
      }
      push(cell.sub, x, reduced);
    }
  } else {
    for (const row of rows) {
      const x = toNumber(row[dimensionField as keyof typeof row]);
      const y = toNumber(row[measureField as keyof typeof row]);
      if (x === null || y === null) {
        continue;
      }
      push(keyFor(row, keyFields), x, y);
    }
  }
  return [...bySub.values()];
}

// s164 m1 (§10 (G1)): the collected evidence — non-flat sub-series votes E, plus the flags the
// contradiction-first decision reads. Captured off the runtime so the drift assert can inspect it.
type CorrelationOppositionEvidence = {
  votes: (-1 | 1)[];
  anyVotable: boolean;
  sharesPooled: boolean;
  pooledSign: -1 | 0 | 1;
  suppresses: boolean;
};

/**
 * s164 m1 (§10 (G1) — DIMENSIONLESS "any real opposite", contradiction-first, full-lattice
 * COLLECT-EVERY; SSOT §10, §5 rule 14). The s163 gate POOLED each partition group's grouping axis into
 * ONE direction (`classifyGroupDirection` over the whole re-projected cell set), so a Simpson on a
 * QUANTITATIVE grouping axis — size / color-ramp / detail — narrated positive over drawn sub-series that
 * fall (the s163 review's CRIT survivor). This DECOMPOSES it: for every subset S of `groupingFields`, key
 * each partition group's drawn marks by (P ∪ S) and collect the vote of EVERY (P ∪ S)-keyed sub-series
 * with n>=2 distinct x — union over ALL P and ALL S, NO coarser-ancestor skip (a coarser falling band
 * whose finer slices rise is exactly the nested-Simpson the coarsest-S reading misses).
 *  - Opposition is DIMENSIONLESS (`classifyDrawnSeriesDirection`): n>=3 votes only if |pearson| >= ρ.
 *  - MANUFACTURED-VOTE GUARD: the S=∅ whole-group over-x aggregate casts a between-band-offset vote ONLY
 *    when the group has NO votable finer band (|S|>=1) — else its "trend" is a pure between-band artifact,
 *    not a drawn sub-series (a continuous ramp, whose finer bands all shred to n=1, keeps its S=∅ vote and
 *    narrates via the no-opposition path; §4 residual-2).
 *  - Contradiction-first: SUPPRESS if the non-flat votes E span >1 sign, OR any equals −pooledSign, OR
 *    (pooledSign≠0 AND no admitted band genuinely shares pooledSign — the all-flat-offset / disjoint-x
 *    artifact, generalized from the dead "Set(E)={0}" clause).
 * NO-OP (suppresses=false) when `groupingFields=[]` — the no-grouping decision defers to the unchanged G0
 * (byte-identical to s163). FALLBACK to narrate only when NO sub-series is votable (<2-distinct-x
 * everywhere). Runs on the RAW rows (they carry the facet/series fields the value projection drops).
 */
function correlationOppositionEvidenceOf(
  rawRows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  partitionFields: readonly string[],
  groupingFields: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined,
  pooled: number
): CorrelationOppositionEvidence {
  const pooledSign = signOf(pooled);
  const votes: (-1 | 1)[] = [];
  let anyVotable = false;
  let sharesPooled = false;
  if (groupingFields.length === 0) {
    return { votes, anyVotable, sharesPooled, pooledSign, suppresses: false }; // no-op → defer to G0
  }
  const record = (dir: GroupDirection) => {
    if (dir === 'unknown') {
      return;
    }
    anyVotable = true;
    if (dir !== 0) {
      votes.push(dir);
    }
    if (dir !== 0 && dir === pooledSign) {
      sharesPooled = true;
    }
  };
  const subsets = subsetsOf(groupingFields);
  // partition the RAW rows (whole chart is one group when partitionFields=[])
  const partitionGroups = new Map<string, Record<string, unknown>[]>();
  for (const row of rawRows) {
    const key = partitionFields.length === 0 ? '*' : keyFor(row, partitionFields);
    const group = partitionGroups.get(key);
    if (group) {
      group.push(row);
    } else {
      partitionGroups.set(key, [row]);
    }
  }
  for (const groupRows of partitionGroups.values()) {
    let hasVotableFineBand = false;
    let emptyVote: GroupDirection | null = null;
    for (const subset of subsets) {
      for (const series of drawnSubSeries(groupRows, dimensionField, measureField, subset, declaredAggregate)) {
        if (new Set(series.xs).size < 2) {
          continue; // n<2 distinct x → not votable
        }
        const dir = classifyDrawnSeriesDirection(series.xs, series.ys);
        if (dir === 'unknown') {
          continue;
        }
        if (subset.length === 0) {
          emptyVote = dir; // defer S=∅ (manufactured-vote guard)
          continue;
        }
        hasVotableFineBand = true;
        record(dir);
      }
    }
    if (!hasVotableFineBand && emptyVote !== null) {
      record(emptyVote);
    }
  }
  let suppresses: boolean;
  if (!anyVotable) {
    suppresses = false; // FALLBACK: <2-distinct-x everywhere → narrate (defer to G0)
  } else if (new Set(votes).size > 1) {
    suppresses = true; // (a) drawn sub-series disagree
  } else if (votes.some((v) => v === -pooledSign)) {
    suppresses = true; // (b) a real opposite
  } else {
    suppresses = pooledSign !== 0 && !sharesPooled; // (c) no drawn band shows the pooled trend
  }
  return { votes, anyVotable, sharesPooled, pooledSign, suppresses };
}

// s165 m3 (§3.6): the deterministic cap on |separableFields|. The subset lattice is 2^k, so an unbounded
// field list is an unbounded scan. `separableFields` emits in an argued order (positional → facet →
// color/size/shape/detail), and the whole shipped corpus tops out at 3, so 8 (=256 subsets) is far above
// anything reachable by a real spec while still bounding the cost. ABOVE THE CAP THE GATE SUPPRESSES — see
// correlationSeparabilityEvidenceOf; dropping fields instead would be fail-safe in the wrong direction.
const MAX_SEPARABLE_FIELDS = 8;

/**
 * s165 m3 (§3.6 — bucket ONCE, merge upward): the FINEST drawn-cell buckets, keyed by the full
 * `separable` tuple, each carrying its per-dimension-value RAW measure values. ONE pass over the rows;
 * every subset band in `correlationSeparabilityEvidenceOf` is then assembled by MERGING buckets, so the
 * 2^k lattice never re-walks the row array (the draft measured 4.4× s164 at 20k rows and 2,184 ms at 50k
 * with a high-cardinality detail).
 *
 * Semantics preserved exactly from the m2 row-walk it replaces:
 *  - under a declared aggregate the drawn marks are the per-(dimension ∪ S) REDUCED cells, so the buckets
 *    hold RAW values and the reduction happens once per merged cell (an average of averages is not the
 *    average — merging pre-reduced values would silently change every coarse band's direction);
 *  - without one, each row is its own drawn mark, so the bucket holds the finite y values per dimension
 *    value and the band expands them back to one (x,y) point each;
 *  - a row whose dimension does not coerce to a finite number can only ever land in a cell that the m2
 *    code skipped (`toNumber(cell.dim) === null`), so filtering those rows here is equivalent; without a
 *    declared aggregate a non-finite measure was also dropped per-row, which the finite filter keeps.
 * `sep` is the bucket's tuple of separable values, positionally aligned with `separable`.
 */
function finestSeparableBuckets(
  rows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  separable: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined
): Map<string, { sep: string[]; byDim: Map<string, { x: number; values: unknown[] }> }> {
  const buckets = new Map<string, { sep: string[]; byDim: Map<string, { x: number; values: unknown[] }> }>();
  for (const row of rows) {
    const x = toNumber(row[dimensionField as keyof typeof row]);
    if (x === null) {
      continue;
    }
    const rawMeasure = row[measureField as keyof typeof row];
    let value: unknown;
    if (declaredAggregate) {
      value = rawMeasure; // reduceAggregate handles non-numerics (count/distinct read any cell)
    } else {
      const y = toNumber(rawMeasure);
      if (y === null) {
        continue;
      }
      value = y;
    }
    const sepKey = keyFor(row, separable);
    let bucket = buckets.get(sepKey);
    if (!bucket) {
      bucket = {
        sep: separable.map((field) => {
          const cell = row[field as keyof typeof row];
          return cell === null || cell === undefined ? '\0null' : String(cell);
        }),
        byDim: new Map(),
      };
      buckets.set(sepKey, bucket);
    }
    const dimKey = keyFor(row, [dimensionField]);
    const cell = bucket.byDim.get(dimKey);
    if (cell) {
      cell.values.push(value);
    } else {
      bucket.byDim.set(dimKey, { x, values: [value] });
    }
  }
  return buckets;
}

// s165 m2 (§3.2): the G1′ evidence. Deliberately NARROWER than CorrelationOppositionEvidence — there is
// no `sharesPooled` and no `anyVotable`, because G1′ carries clauses (a) and (b) ONLY.
type CorrelationSeparabilityEvidence = {
  votes: (-1 | 1)[];
  pooledSign: -1 | 0 | 1;
  suppresses: boolean;
};

/**
 * s165 m2 (§3.2 — G1′, the UNPREFIXED union suppressor; the single most important correction in this
 * sprint). Final composition in `deriveCorrelation`:
 *
 *     narrate iff G0 narrates AND NOT G1_s164 AND NOT G1′
 *
 * G1_s164 stays EXACTLY as shipped (partition-prefixed, subsets of `groupingFields`, all three clauses,
 * per-group manufactured-vote guard). G1′ is ADDED, never substituted — and that is what makes the whole
 * thing MONOTONE BY CONSTRUCTION rather than by argument (a disjunction of suppressors can only suppress
 * more). The pre-lock critic (wf_381797c9-7a5, 5 lenses, 4 fixtures) falsified the draft's REPLACE design:
 * clause (c) (`pooledSign!==0 && !sharesPooled`) is NEGATIVE evidence and therefore ANTI-monotone, so an
 * UNPREFIXED scan carrying it promotes s164's deferred `S=∅` vote to a real vote (|S|>=1 escapes the
 * manufactured-vote guard, whose `subset.length===0` marker is purely syntactic), sets `sharesPooled`,
 * DISARMS clause (c) — and the shipped s164 RED-first fixture `rowsDisjointFlat` goes `undefined` →
 * narrates 0.894, a self-inflicted 11th phantom.
 *
 * So G1′ carries:
 *  - (a) the non-flat votes span MORE THAN ONE sign, or
 *  - (b) any vote equals −pooledSign (a real opposite).
 *  - NO clause (c), and G1′ votes NEVER feed `sharesPooled` (there is no such flag here). Clause (c) is an
 *    artifact detector calibrated to the VALUE's own cell decomposition; it stays in the retained s164 arm.
 *
 * INCOHERENT-BAND RULE (A6, G1′ only): a band keyed by `S` whose members disagree on some field in
 * `separableFields \ S` must have >=3 distinct x AND clear the ρ floor to vote — i.e. the n=2
 * unconditional-slope rule is DROPPED for such bands. Those manufactured cross-series n=2 votes are what
 * silenced 52–80% of honest bubble charts in the draft. A/B/C/D all have n>=3 opposing COHERENT bands, so
 * none of them depends on this. The n=2 rule stays fully intact in the prefixed s164 arm and for coherent
 * bands here. DISCLOSED COST (§6.2): an n=2 cross-partition opposite is now un-votable in G1′ — an error
 * toward NARRATION, named not hidden.
 *
 * NO-OP (`suppresses=false`) when `separableFields=[]`, so a plain single-series chart is byte-identical.
 * Runs on the RAW rows (they carry the facet/series fields the value projection drops).
 */
function correlationSeparabilityEvidenceOf(
  rawRows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  separable: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined,
  pooled: number
): CorrelationSeparabilityEvidence {
  const pooledSign = signOf(pooled);
  const votes: (-1 | 1)[] = [];
  if (separable.length === 0) {
    return { votes, pooledSign, suppresses: false }; // no-op → defer to G0 + the s164 arm
  }
  // s165 m3 (§3.6): above the cap SUPPRESS unconditionally. Dropping fields to shrink the lattice would
  // be fail-safe in the WRONG direction (a dropped field is an un-scanned separator = a phantom); refusing
  // to narrate is fail-safe in the right one. The cap bounds the 2^k subset lattice at 256.
  if (separable.length > MAX_SEPARABLE_FIELDS) {
    return { votes, pooledSign, suppresses: true };
  }
  // s165 m3 (§3.6) — MEMOIZATION DELIBERATELY NOT IMPLEMENTED, and this is the reason. The memo asks for
  // `deriveCorrelation` to be memoized per (spec, rows) because it runs up to 4× per render
  // (analyzeVizSpec is called by both the table and the narrative generator, and each call re-runs the
  // whole decision a second time through `expectedNarratableCorrelation` inside
  // `enforceDrawnValueInvariant`). Both possible keys fail:
  //  - keyed on the ROW ARRAYS: every call site rebuilds them (`collectRows` + `projectAggregatedRows`
  //    return fresh arrays), so identity never matches and the cache is inert.
  //  - keyed on the SPEC alone: the guard call would be served the analysis call's cached answer, so
  //    `expected === analysis.correlation` becomes true BY CONSTRUCTION and the drawn-value guard's
  //    correlation arm goes VACUOUS — it exists precisely to bite a call-site drift that "re-feeds raw
  //    rows", which a spec-keyed cache would make undetectable. That is the mirrored-oracle failure mode
  //    the standing rules forbid, traded for a micro-optimization.
  // The bucket-once merge below is what pays for the widened scan instead: measured 1.27–2.08× s164
  // (10k–50k rows) against the draft's 4.4× at 20k, and 383 ms at 50k against the draft's 2,184 ms.
  // s165 m3 (§3.6): BUCKET ONCE at the finest key and MERGE UPWARD — never 2^k walks over the rows. One
  // pass builds the finest buckets (keyed by the FULL separable tuple, each holding its per-dimension RAW
  // measure values); each subset then merges buckets, so the per-subset cost is O(#finest buckets), not
  // O(#rows). Merging RAW value lists (not pre-reduced cell values) is load-bearing: an average of
  // averages is not the average, so a coarser band must reduce the underlying rows exactly once.
  const buckets = finestSeparableBuckets(rawRows, dimensionField, measureField, separable, declaredAggregate);
  for (const subset of subsetsOf(separable)) {
    const inSubset = separable.map((field) => subset.includes(field));
    // band key = the bucket's projection onto S; "others" = its projection onto separableFields \ S, which
    // is what the A6 coherence test reads (a band pooling >1 distinct other-projection is incoherent).
    const bands = new Map<string, { others: Set<string>; byDim: Map<string, { x: number; values: unknown[] }> }>();
    for (const bucket of buckets.values()) {
      const bandKey = bucket.sep.filter((_, index) => inSubset[index]).join('\0');
      const otherKey = bucket.sep.filter((_, index) => !inSubset[index]).join('\0');
      let band = bands.get(bandKey);
      if (!band) {
        band = { others: new Set<string>(), byDim: new Map() };
        bands.set(bandKey, band);
      }
      band.others.add(otherKey);
      for (const [dimKey, cell] of bucket.byDim) {
        const merged = band.byDim.get(dimKey);
        if (merged) {
          merged.values.push(...cell.values);
        } else {
          band.byDim.set(dimKey, { x: cell.x, values: [...cell.values] });
        }
      }
    }
    for (const band of bands.values()) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const cell of band.byDim.values()) {
        if (declaredAggregate) {
          const reduced = reduceAggregate(cell.values, declaredAggregate);
          if (reduced === undefined) {
            continue;
          }
          xs.push(cell.x);
          ys.push(reduced);
        } else {
          // no declared aggregate → each row is its own drawn mark (values are the finite y's)
          for (const value of cell.values) {
            xs.push(cell.x);
            ys.push(value as number);
          }
        }
      }
      const distinctX = new Set(xs).size;
      if (distinctX < 2) {
        continue; // not votable — no slope
      }
      if (band.others.size > 1 && distinctX < 3) {
        continue; // A6: an incoherent band needs >=3 distinct x (the ρ floor then applies below)
      }
      const dir = classifyDrawnSeriesDirection(xs, ys);
      if (dir === 'unknown' || dir === 0) {
        continue; // no slope evidence, or below the dimensionless ρ floor → not a real opposite
      }
      votes.push(dir);
    }
  }
  const suppresses =
    new Set(votes).size > 1 || // (a) drawn bands disagree
    votes.some((vote) => vote === -pooledSign); // (b) a real opposite
  return { votes, pooledSign, suppresses };
}

/**
 * s160 m3: the narrated correlation. VALUE = pooled Pearson over `valueRows` — the rows whose pairs
 * the chart DRAWS (under a declared aggregate the call site passes the projected per-cell rows, the
 * declared-aggregate complement: r no longer describes pre-projection raw rows; without one,
 * valueRows === rawRows, byte-identical to pre-s160). SCOPE = the Shape-B sign gate: partition `rawRows`
 * by correlationPartitionFields (raw rows carry the facet/series fields the projection drops), then —
 * s162 m1 — classify each group's DIRECTION over its DRAWN cells (re-projected under `declaredAggregate`
 * inside classifyCorrelationGroups), NOT the count-weighted raw group rows, so the classifier and the
 * pooled value read the SAME cells (closes S1). Suppression is fail-safe-to-silence: both narrative
 * emission sites gate on undefined.
 */
function deriveCorrelation(
  spec: NormalizedVizSpec,
  valueRows: readonly Record<string, unknown>[],
  rawRows: readonly Record<string, unknown>[],
  bindings: ReturnType<typeof resolvePrimaryBindings>,
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined
): number | undefined {
  if (!bindings.dimensionField || !bindings.measureField) {
    return undefined;
  }
  // s165 m1 (§3.5, fork F2): a second dataset's rows are never read and a second measure field makes the
  // pooled r a statistic of no single drawn series — fail-safe SILENCE, before any derivation.
  if (layeredCorrelationUnsupported(spec)) {
    return undefined;
  }
  const pooled = pearsonOverRows(valueRows, bindings.dimensionField, bindings.measureField);
  if (pooled === null) {
    return undefined;
  }
  const partitionFields = correlationPartitionFields(spec, bindings.dimensionField, bindings.measureField);
  // s162 m1: classify each group's DIRECTION over the DRAWN cells the viewer sees (each raw partition
  // group re-projected to its cells under the declared aggregate) — NOT the count-weighted raw rows —
  // closing the raw-vs-drawn asymmetry that let a declared-aggregate Simpson sign-phantom through (S1).
  // s163 m1: re-project over the FULL drawn-cell key (`correlationGroupingFields` = value key minus the
  // dimension and the partition) so the classifier keys AT LEAST AS FINE as the value — a quantitative
  // retinal `size` the value keeps but `correlationPartitionFields` skips is now re-absorbed as a grouping
  // field, closing the size-axis reopening (S1-size). The contradiction-first predicate then decides.
  const groupingFields = correlationGroupingFields(
    spec,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    declaredAggregate
  );
  // s164 m1 (§10): pooled narrates ONLY when there is neither a categorical partition NOR a grouping axis
  // (one facet×series group — the pooled r IS the group r). A grouping axis with NO categorical partition
  // (size-only Simpson) NO LONGER early-returns — G1 below decomposes it (defect 5).
  // s165 m1 (§3.2b — the pre-lock critic's P1 blocker, caught on 3 lenses): this return runs BEFORE BOTH
  // gates and was TRUE for survivors A and B (shape on a 'mixed' mark → both s164 derivations empty; a
  // quantitative color ramp under stacking → both empty), so it SHORT-CIRCUITED the new G1′ and the draft
  // would have shipped A and B unchanged. The third conjunct is what makes G1′ reachable at all.
  // BEHAVIOUR-PRESERVING for G0: when `partitionFields=∅` then `groupingFields === narratedValueCellKey`,
  // so both are empty together and the single-group re-projection pools exactly the cells the value pools
  // → `classes=[sign(pooled)]` → G0 narrates. RULE 13b — the three classes newly falling through are
  // enumerated and fixture-pinned in correlation-render-truth-separability-s165.spec.ts: (a) shape on a
  // non-splitting/collapsed mark, (b) a stacking aggregate with no facet and no categorical retinal,
  // (c) a quantitative-only retinal under stacking.
  const separable = separableFields(spec, bindings.dimensionField, bindings.measureField);
  if (partitionFields.length === 0 && groupingFields.length === 0 && separable.length === 0) {
    return pooled;
  }
  // s164 m1 (§10): SUPPRESS iff EITHER gate suppresses (narrate iff BOTH narrate). (G0) the UNCHANGED
  // s163 per-partition-group direction gate — catches between-partition Simpsons and keeps the s162
  // stacking + defect-4 continuous-size suppression. (G1) the new DIMENSIONLESS full-lattice decomposition
  // — catches the within-partition Simpson on a QUANTITATIVE grouping axis the pooled G0 direction masked
  // (the s163 CRIT survivor). G1 no-ops when groupingFields=[], so the no-grouping decision is byte-
  // identical to s163.
  const classes = classifyCorrelationGroups(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    groupingFields,
    declaredAggregate
  );
  const g0Narrates = narratableCorrelation(pooled, classes);
  const g1Suppresses = correlationOppositionEvidenceOf(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    groupingFields,
    declaredAggregate,
    pooled
  ).suppresses;
  // s165 m2 (§3.2): G1′ is a THIRD, INDEPENDENT suppression term — a UNION, never a replacement. The s164
  // arm above is untouched, so `s164_undefined ⇒ s165_undefined` holds BY CONSTRUCTION (a disjunction of
  // suppressors is monotone); the m2 monotonicity oracle MEASURES that against the recorded HEAD decision
  // rather than trusting the argument.
  const g1PrimeSuppresses = correlationSeparabilityEvidenceOf(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    separable,
    declaredAggregate,
    pooled
  ).suppresses;
  return g0Narrates && !g1Suppresses && !g1PrimeSuppresses ? pooled : undefined;
}

/**
 * s162 m1 (the S1 fix — classify over the DRAWN cells; SSOT §2-m1 Fork-1). Partition the RAW rows (they
 * carry the facet/series fields the projection drops) by `partitionFields`, then for EACH group classify
 * its within-group DIRECTION over the cells the chart DRAWS: under a declared aggregate the group is
 * re-projected (the same reduction `projectAggregatedRows` performs) so the classifier reads the cells the
 * pooled value pools. Under a declared aggregate with uneven per-x counts the raw within-group direction
 * (count-weighted) inverts vs this drawn-cell direction — the S1 phantom. Without a declared aggregate the
 * per-group projection is the IDENTITY (byte-identical to pre-s162; the corpus is unaffected).
 *
 * s163 m1 (S1-size — SSOT §2-m1 design A): the re-projection keys by `groupingFields` = the value's
 * drawn-cell key minus the dimension and the partition (`correlationGroupingFields`), NOT `[]`. The s162
 * `[]` collapsed every non-partition drawn-cell key axis (a quantitative retinal `size` that
 * `drawnCellKeyFields` keys but `correlationPartitionFields` skips), making the classifier COARSER than the
 * value → it voted a direction the size-keyed drawn cells do not have (the S1-size phantom). Keying by
 * `groupingFields` restores `narratedValueCellKey ⊆ partitionFields ∪ groupingFields` (classifier at least
 * as fine as the value). The caller partitions by the FULL `partitionFields` even under stacking (where the
 * value drops the series), so the s162 per-segment suppression is preserved — the rejected design B
 * intersected the partition and narrated the stack-total phantom.
 */
function classifyCorrelationGroups(
  rawRows: readonly Record<string, unknown>[],
  dimensionField: string,
  measureField: string,
  partitionFields: readonly string[],
  groupingFields: readonly string[],
  declaredAggregate: NonNullable<TraitBinding['aggregate']> | undefined
): GroupDirection[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rawRows) {
    const key = keyFor(row, partitionFields);
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  const classes: GroupDirection[] = [];
  for (const groupRows of groups.values()) {
    // s163 m1: re-project each partition group over `groupingFields` (the value's extra drawn-cell key
    // axes beyond the partition — e.g. a quantitative `size`), NOT `[]`, so the classifier reads cells
    // AT LEAST AS FINE as the value. Without a declared aggregate the re-projection is the identity.
    const cells = declaredAggregate
      ? projectAggregatedRows(groupRows, dimensionField, measureField, declaredAggregate, groupingFields)
      : groupRows;
    classes.push(classifyGroupDirection(cells, dimensionField, measureField));
  }
  return classes;
}

/**
 * s162 m1 (the machine-assert surface; SSOT §2-m1): the per-group DIRECTION classes the SUT feeds
 * narratableCorrelation, recomputed from the spec alone. The S1 proof spec asserts `classes.length > 1`
 * (2 real groups A,B, both FALLING → [-1,-1]) — a regression to the rejected `valueRows`-partition
 * primary collapses this to a single group and turns the assert RED. Module export for the proof spec
 * (relative path), OFF the a11y allow-list barrel — not public API.
 */
export function correlationGroupDirections(spec: NormalizedVizSpec): GroupDirection[] {
  const bindings = resolvePrimaryBindings(spec);
  if (!bindings.dimensionField || !bindings.measureField) {
    return [];
  }
  const rawRows = collectRows(spec);
  const partitionFields = correlationPartitionFields(spec, bindings.dimensionField, bindings.measureField);
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const groupingFields = correlationGroupingFields(
    spec,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    declaredAggregate
  );
  return classifyCorrelationGroups(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    groupingFields,
    declaredAggregate
  );
}

/**
 * s163 m1 (§2-m1, §5 rule 13a — the drift-assert capture surface): the ACTUAL cell-key fields the
 * correlation classifier partitions AND groups by, via the SAME `correlationPartitionFields` +
 * `correlationGroupingFields` the runtime `deriveCorrelation` uses (SINGLE SOURCE — reverting
 * `correlationGroupingFields` moves this too). The proof spec asserts `narratedValueCellKey(spec) ⊆
 * partitionFields ∪ groupingFields`; because `narratedValueCellKey` is sourced from `drawnCellKeyFields`
 * DIRECTLY (a path the classifier revert does NOT touch), that assertion goes RED under a revert-to-`[]`
 * — it is NOT the by-construction tautology the s162 draft shipped. Module export for the proof spec
 * (relative path), OFF the a11y allow-list barrel — not public API.
 */
export function correlationClassifierActualKey(spec: NormalizedVizSpec): {
  partitionFields: string[];
  groupingFields: string[];
} {
  const bindings = resolvePrimaryBindings(spec);
  if (!bindings.dimensionField || !bindings.measureField) {
    return { partitionFields: [], groupingFields: [] };
  }
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const partitionFields = correlationPartitionFields(spec, bindings.dimensionField, bindings.measureField);
  const groupingFields = correlationGroupingFields(
    spec,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    declaredAggregate
  );
  return { partitionFields, groupingFields };
}

/**
 * s165 m1 (§3.2b capture surface): the THREE field lists the re-gated `deriveCorrelation` early return
 * reads, via the SAME derivations the runtime uses (single source). The proof spec asserts that for each
 * rule-13b fall-through class `partitionFields` and `groupingFields` are BOTH empty while
 * `separableFields` is NOT — i.e. the shipped 2-clause early return would have returned the pooled r
 * before either gate ran (the critic's P1 blocker) and the 3-clause form does not. Also the m4 call-site
 * pin surface: `deriveCorrelation` and `correlationOppositionEvidence` consume `separableFields`, while
 * `correlationGroupDirections` and `correlationClassifierActualKey` keep `correlationGroupingFields` (the
 * s163 value-key fineness invariant). Module export for the proof spec (relative path), OFF the a11y
 * allow-list barrel — not public API.
 */
export function correlationGateFields(spec: NormalizedVizSpec): {
  partitionFields: string[];
  groupingFields: string[];
  separableFields: string[];
} {
  const bindings = resolvePrimaryBindings(spec);
  if (!bindings.dimensionField || !bindings.measureField) {
    return { partitionFields: [], groupingFields: [], separableFields: [] };
  }
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const partitionFields = correlationPartitionFields(spec, bindings.dimensionField, bindings.measureField);
  return {
    partitionFields,
    groupingFields: correlationGroupingFields(
      spec,
      bindings.dimensionField,
      bindings.measureField,
      partitionFields,
      declaredAggregate
    ),
    separableFields: separableFields(spec, bindings.dimensionField, bindings.measureField),
  };
}

/**
 * s164 m1 (§2-m1, §3 — the G1 drift-assert capture surface): the DIMENSIONLESS opposition evidence the
 * runtime `deriveCorrelation` feeds its G1 gate, recomputed from the spec alone via the SAME
 * `correlationOppositionEvidenceOf` (SINGLE SOURCE — reverting the runtime G1, or restricting the scan to
 * the coarsest votable S, moves this too, so the drift assert is non-vacuous). The proof spec cross-checks
 * `suppresses` against an INDEPENDENT test-side full-lattice oracle keyed off `narratedValueCellKey`
 * DIRECTLY — a path this classifier surface does NOT share (§3 charter-diff pin: the oracle imports
 * neither `classifyCorrelationGroups`, `correlationGroupingFields`, nor `correlationClassifierActualKey`).
 * Returns the no-op evidence (empty, suppresses=false) when the pooled r is not computable or there is no
 * grouping axis. Module export for the proof spec (relative path), OFF the a11y allow-list barrel — not
 * public API.
 */
export function correlationOppositionEvidence(spec: NormalizedVizSpec): CorrelationOppositionEvidence {
  const bindings = resolvePrimaryBindings(spec);
  const empty: CorrelationOppositionEvidence = {
    votes: [],
    anyVotable: false,
    sharesPooled: false,
    pooledSign: 0,
    suppresses: false,
  };
  if (!bindings.dimensionField || !bindings.measureField) {
    return empty;
  }
  const rawRows = collectRows(spec);
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const valueRows = declaredAggregate
    ? projectAggregatedRows(
        rawRows,
        bindings.dimensionField,
        bindings.measureField,
        declaredAggregate,
        narratedValueCellKey(spec),
      )
    : rawRows;
  const pooled = pearsonOverRows(valueRows, bindings.dimensionField, bindings.measureField);
  if (pooled === null) {
    return empty;
  }
  const partitionFields = correlationPartitionFields(spec, bindings.dimensionField, bindings.measureField);
  const groupingFields = correlationGroupingFields(
    spec,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    declaredAggregate
  );
  return correlationOppositionEvidenceOf(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    partitionFields,
    groupingFields,
    declaredAggregate,
    pooled
  );
}

/**
 * s165 m2 (§3.2 — the G1′ capture surface): the separability opposition evidence the runtime
 * `deriveCorrelation` feeds its G1′ term, recomputed from the spec alone via the SAME
 * `correlationSeparabilityEvidenceOf` + `separableFields` (SINGLE SOURCE — neutering the runtime G1′, or
 * re-gating shape, or reverting the per-layer union, moves this too). The proof spec uses it for the
 * REACHABILITY assert (§5): `votes` must be NON-EMPTY for each RED-first fixture, so a passing
 * `toBeUndefined()` can never be an `undefined`-vs-`undefined` coincidence hiding behind the early return.
 * Returns the no-op evidence when the pooled r is not computable or nothing is separable.
 * Module export for the proof spec (relative path), OFF the a11y allow-list barrel — not public API.
 */
export function correlationSeparabilityEvidence(spec: NormalizedVizSpec): CorrelationSeparabilityEvidence {
  const bindings = resolvePrimaryBindings(spec);
  const empty: CorrelationSeparabilityEvidence = { votes: [], pooledSign: 0, suppresses: false };
  if (!bindings.dimensionField || !bindings.measureField) {
    return empty;
  }
  const rawRows = collectRows(spec);
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const valueRows = declaredAggregate
    ? projectAggregatedRows(
        rawRows,
        bindings.dimensionField,
        bindings.measureField,
        declaredAggregate,
        narratedValueCellKey(spec)
      )
    : rawRows;
  const pooled = pearsonOverRows(valueRows, bindings.dimensionField, bindings.measureField);
  if (pooled === null) {
    return empty;
  }
  return correlationSeparabilityEvidenceOf(
    rawRows,
    bindings.dimensionField,
    bindings.measureField,
    separableFields(spec, bindings.dimensionField, bindings.measureField),
    declaredAggregate,
    pooled
  );
}

/**
 * s160 m3 (the guard arm's oracle): recompute the ENTIRE narratable-correlation decision from the
 * spec alone — the call-site gates (rect grid / strip plot / dotted version), the declared-aggregate
 * projection of the value rows, and the Shape-B sign gate. DISCLOSED as derivation-SHARED (it calls
 * the same pearson / projection / partition helpers): the guard's correlation arm bites CALL-SITE
 * DRIFT (a future analyzeVizSpec edit that skips a gate or re-feeds raw rows), not an in-helper bug;
 * the SUT-independent VALUE evidence is the hand-computed constants in the harness axis. Module
 * export for the proof spec (relative path), OFF the a11y allow-list barrel — not public API.
 */
export function expectedNarratableCorrelation(spec: NormalizedVizSpec): number | undefined {
  const bindings = resolvePrimaryBindings(spec);
  const rawRows = collectRows(spec);
  if (isMarkRectGrid(spec) || isStripPlot(spec) || isDottedVersionDimension(rawRows, bindings.dimensionField)) {
    return undefined;
  }
  if (!bindings.dimensionField || !bindings.measureField) {
    return undefined;
  }
  const declaredAggregate = resolveBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.aggregate;
  const valueRows = declaredAggregate
    ? projectAggregatedRows(
        rawRows,
        bindings.dimensionField,
        bindings.measureField,
        declaredAggregate,
        // s163 m1: the shared value-key source (§5.9) — same list the analyzeVizSpec value site projects.
        narratedValueCellKey(spec),
      )
    : rawRows;
  return deriveCorrelation(spec, valueRows, rawRows, bindings, declaredAggregate);
}

// s160 m4: the optional `kind` routes the embedded numeric through the tagged emitter so the
// provenance sweep can account for High/Low finding values; omitted (external callers — the param
// is ADDITIVE on this public name) it stays the plain shared formatter, byte-identical.
export function describeDataPoint(
  point: DataPoint | undefined,
  measureLabel?: string,
  kind?: NarratedValueKind
): string | undefined {
  if (!point) {
    return undefined;
  }
  const label = measureLabel ? `${measureLabel}` : 'Value';
  const value = kind ? narrateNumber(point.value, kind) : formatNumeric(point.value);
  return `${label} ${value} (${point.label})`;
}
