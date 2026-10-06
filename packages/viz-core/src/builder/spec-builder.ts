// Headless rows -> NormalizedVizSpec builder (sprint-109 m02).
//
// Two modes:
//   - EXPLICIT: caller supplies chartType + encodings. ZERO recommender
//     involvement; we just assemble a valid, data-bound spec.
//   - SUGGEST: chartType omitted. A lightweight, clearly-gated field-profile
//     inferencer turns the rows into a count-based SchemaIntent, the existing
//     recommender picks a chartType, and we auto-assign encodings.
//
// In BOTH modes a11y.description is ALWAYS synthesized non-empty (the AJV trap),
// and the result is run through assertNormalizedVizSpec so the builder can never
// return an invalid spec.

import {
  assertNormalizedVizSpec,
  type NormalizedVizSpec,
  type TraitBinding,
} from '../spec/normalized-viz-spec.js';
import { chartPatterns } from '../patterns/index.js';
import type { ChartType, FieldType, IntentGoal } from '../patterns/index.js';
import {
  suggestPatterns,
  type SchemaIntent,
  type PatternSuggestion,
  CORRELATION_RELATIONSHIP_GATE,
  DENSITY_DENSE_ROW_COUNT,
  DENSITY_SPARSE_ROW_COUNT,
  HIGH_CARDINALITY_DIMENSION,
  PART_TO_WHOLE_MAX_CARDINALITY,
} from '../patterns/suggest-chart.js';
import {
  mean,
  pearson,
  populationStdDev,
  round,
  skewness,
  toNumber,
  tukeyOutlierCount,
} from '../analysis/stats.js';
import { detectGeoFields, type GeoFieldDetection } from '../analysis/geo-detection.js';
import {
  everyValueIsTemporal,
  summarizeTemporal,
  type TemporalGranularity,
} from '../analysis/temporal.js';
import { humanize } from '../a11y/format.js';
// s155 m04: the name-hint helpers moved to a shared module so the a11y "Total X" gate derives
// additivity from the SAME token model this profiler uses (one source of truth, no drift).
import {
  AGGREGATE_HEADS,
  fieldNameTokens,
  headToken,
  MEASURE_NAME_TOKENS,
  nameHintsIdentifier,
  nameHintsMeasure,
  nameHintsZip,
} from '../analysis/field-name-hints.js';

// Re-export so the data-aware temporal granularity type is reachable from the
// package root (e.g. the viz.render handler/schema in mcp-server).
export type { TemporalGranularity } from '../analysis/temporal.js';

export type EncodingChannel = 'x' | 'y' | 'color' | 'size' | 'shape' | 'detail';

/** Per-channel binding input. A bare string is shorthand for `{ field }`. */
export interface EncodingInput {
  readonly field: string;
  readonly aggregate?: TraitBinding['aggregate'];
  readonly scale?: TraitBinding['scale'];
  readonly timeUnit?: TraitBinding['timeUnit'];
  readonly sort?: TraitBinding['sort'];
  readonly title?: string;
  /**
   * Force the Vega-Lite/ECharts field type (sprint-125 m02 manual escape hatch).
   * A caller-declared type wins over m01's data-aware profile inference.
   */
  readonly type?: TraitBinding['type'];
  /**
   * Explicit hex colors overriding the baked OODS categorical palette on a
   * nominal/ordinal color scale (sprint-147 F5). Consumed only on the color
   * channel by the cartesian adapter.
   */
  readonly range?: TraitBinding['range'];
  /**
   * s223-m01 (#2527 ruling 2): the label format of this channel's axis or legend, a d3-format specifier (d3-time-format
   * for a temporal field).
   */
  readonly format?: TraitBinding['format'];
  /** s223-m01: the ISO 4217 code of the amounts this channel encodes; "$" in its format prints the code's symbol. */
  readonly currency?: string;
}

export interface BuildVizSpecInput {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  /** Omit to enter suggest mode (infer profiles -> recommender -> chartType). */
  readonly chartType?: ChartType;
  /** Explicit channel bindings. Required in explicit mode (needs at least x + y). */
  readonly encodings?: Partial<Record<EncodingChannel, EncodingInput | string>>;
  readonly id?: string;
  readonly name?: string;
  /** Override the synthesized a11y description. */
  readonly description?: string;
}

/** Geographic role detected from a field's NAME (advisory typing; no rendering). */
export type GeoKind = 'lat' | 'lon' | 'region' | 'none';

/**
 * Inferred per-field profile. `cardinality` is the count of distinct non-null
 * values. The sprint-110 data-aware fields are all OPTIONAL and only present
 * when meaningful for the field's type, so every existing caller stays valid and
 * a profile carries no noise stats it cannot fill.
 */
export interface FieldProfile {
  readonly name: string;
  readonly type: FieldType;
  readonly role: 'measure' | 'dimension';
  readonly cardinality: number;
  /** Distinct-non-null count ÷ present-value count, in [0,1]. */
  readonly distinctRatio?: number;
  // Numeric-field statistics (present when every value is numeric — quantitative
  // or ordinal fields). All rounded to 6dp for cross-platform golden stability.
  readonly min?: number;
  readonly max?: number;
  readonly mean?: number;
  readonly stddev?: number;
  readonly skew?: number;
  readonly outlierCount?: number;
  readonly hasNegative?: boolean;
  readonly hasZero?: boolean;
  readonly isInteger?: boolean;
  // Temporal-field statistics (present when type === 'temporal').
  readonly temporalGranularity?: TemporalGranularity;
  readonly temporalRegular?: boolean;
  /** Detected geographic role; omitted when 'none' (advisory — geo rendering deferred). */
  readonly geoKind?: GeoKind;
}

/** Local mutable view used while assembling a FieldProfile incrementally. */
type MutableFieldProfile = { -readonly [K in keyof FieldProfile]: FieldProfile[K] };

export interface BuildVizSpecResult {
  readonly spec: NormalizedVizSpec;
  readonly chartType: ChartType;
  readonly mode: 'explicit' | 'suggest' | 'intent';
  /**
   * Present in suggest/intent mode only: the recommender pick that drove the
   * chartType, including the scorer's `signals` (the human-readable rationale).
   */
  readonly suggestion?: {
    readonly patternId: string;
    readonly score: number;
    readonly signals: ReadonlyArray<string>;
  };
  /**
   * Present in suggest/intent mode only: the inferred field profiles (the full
   * inferred set in suggest mode; the caller-named selected subset in intent mode).
   */
  readonly inferredFields?: ReadonlyArray<FieldProfile>;
  /**
   * Present in suggest/intent mode only: true when no pattern matched confidently
   * (suggest) or the requested chart family had no positive recommender match
   * (intent) — the chartType is then a low-confidence fallback rather than a
   * positive pick. Makes the previously-silent `bar` default detectable to callers.
   */
  readonly lowConfidence?: boolean;
  /** Present in suggest/intent mode only: the runner-up recommendations (next best picks). */
  readonly alternatives?: ReadonlyArray<{
    readonly patternId: string;
    readonly score: number;
    readonly chartType: ChartType;
  }>;
}

/** A caller-named intent field. `type` is RESERVED in v0.1 (types infer from data). */
export interface IntentField {
  readonly name: string;
  readonly type?: FieldType;
}

/**
 * The chart families the recommender can rank — the 5 TABULAR marks. The 8
 * explicit-only types (treemap/sunburst/sankey/force_graph/choropleth/bubble_map/
 * flow_map/chord) have NO entry in the recommender pool, so an `intent.chartFamily`
 * is constrained to these (schema-enforced in mcp-server; defensively re-asserted
 * in buildFromIntent).
 */
export type IntentChartFamily = 'bar' | 'line' | 'area' | 'scatter' | 'heatmap';

/**
 * A STRUCTURED (typed, NOT free-text) visualization intent — sprint-131 m02, the
 * deterministic half of the NL→viz hand-off. An agent (or, in s132, an LLM that
 * emits this shape — never a raw spec) supplies the analytical goal + the named
 * measures/dimensions that drive ENCODING; the optional `chartFamily` post-filters
 * the recommender's ranking, and the optional governed `measureRef` (read by the
 * viz.render handler, NOT by this builder) lights the s129/s130 narrative overlay.
 */
export interface StructuredIntent {
  /** The analytical goal — the LIVE 7-value IntentGoal union. */
  readonly goal: IntentGoal;
  /** Named measure fields (the metrics to plot); MUST exist among the rows' fields. */
  readonly measures: ReadonlyArray<IntentField>;
  /** Named dimension fields (the breakdowns/axes); MUST exist among the rows' fields. */
  readonly dimensions: ReadonlyArray<IntentField>;
  /** Optional preferred chart family — post-filters the ranking (NOT a scorer term). */
  readonly chartFamily?: IntentChartFamily;
  /** Optional governed-measure reference (`gm.*`); narrative-only, read by viz.render. */
  readonly measureRef?: string;
}

export interface BuildFromIntentInput {
  readonly intent: StructuredIntent;
  /** REQUIRED for v0.1 — the spec embeds data.values from these rows. */
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly id?: string;
  readonly name?: string;
  /** Override the synthesized a11y description. */
  readonly description?: string;
}

export class VizSpecBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VizSpecBuilderError';
  }
}

const ENCODING_TRAIT: Record<EncodingChannel, string> = {
  x: 'EncodingPositionX',
  y: 'EncodingPositionY',
  color: 'EncodingColor',
  size: 'EncodingSize',
  shape: 'EncodingShape',
  detail: 'EncodingDetail',
};

// chartType -> mark trait, matching the adapter MARK_TRAIT_MAP (scatter => point/MarkPoint).
// The network/hierarchy types (treemap/sunburst/sankey) keep these Record<ChartType>
// maps total; they are explicit-only and render through their dedicated adapters,
// never through this builder's assembleSpec, so the entries are for type-exhaustiveness,
// not exercised code paths (sprint-111 m01/m03).
const CHART_TYPE_MARK: Record<ChartType, string> = {
  bar: 'MarkBar',
  line: 'MarkLine',
  area: 'MarkArea',
  scatter: 'MarkPoint',
  heatmap: 'MarkRect',
  treemap: 'MarkTreemap',
  sunburst: 'MarkSunburst',
  sankey: 'MarkSankey',
  force_graph: 'MarkGraph',
  choropleth: 'MarkChoropleth',
  bubble_map: 'MarkBubble',
  flow_map: 'MarkFlow',
  chord: 'MarkChord',
};

const CHART_TYPE_LABEL: Record<ChartType, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  area: 'Area chart',
  scatter: 'Scatter plot',
  heatmap: 'Heatmap',
  treemap: 'Treemap',
  sunburst: 'Sunburst',
  sankey: 'Sankey diagram',
  force_graph: 'Force-directed graph',
  choropleth: 'Choropleth map',
  bubble_map: 'Bubble map',
  flow_map: 'Flow map',
  chord: 'Chord diagram',
};

// --- semantic-type thresholds (literature-defensible, documented — NOT magic) -
// A small, repeated set of integers reads as an ordinal scale (a rank/code), not
// a quantitative measure. The cardinality cap mirrors the common "treat ≤N
// distinct integers as ordinal" practice; the min-rows + distinct-ratio guards
// keep small fixtures and genuine high-distinct measures out of the bucket.
const ORDINAL_MIN_ROWS = 8;
const ORDINAL_MAX_CARDINALITY = 12;
const ORDINAL_MAX_DISTINCT_RATIO = 0.5;
// Plausible 4-digit calendar-year window for the name-gated year → temporal check.
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

// Suggest-mode confidence floor: a confident pick clears the count-shape match
// (a goal match alone is +5, each range match +4). Below this the top pick is a
// weak/fallback recommendation and `lowConfidence` is flagged. m04 surfaces a
// normalized confidence; this is the in-engine "is the bar a real pick?" gate.
const LOW_CONFIDENCE_SCORE = 8;

// The recommender pool ranks ONLY these 5 tabular marks; an intent.chartFamily is
// constrained to this set (the 8 explicit-only types have zero recommender entries).
const TABULAR_FAMILIES: ReadonlySet<ChartType> = new Set<ChartType>([
  'bar',
  'line',
  'area',
  'scatter',
  'heatmap',
]);

// --- public API -------------------------------------------------------------

export function buildVizSpecFromRows(input: BuildVizSpecInput): BuildVizSpecResult {
  const rows = input.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new VizSpecBuilderError('buildVizSpecFromRows requires a non-empty rows array.');
  }

  if (input.chartType) {
    return buildExplicit(input, input.chartType);
  }
  return buildSuggested(input);
}

/**
 * Deterministic STRUCTURED-INTENT → spec builder (sprint-131 m02) — the deterministic
 * half of the NL→viz hand-off. Pure reuse of the existing recommender + encoder +
 * assembler; NO LLM, NO scorer-term change. Sibling to the suggest-mode buildSuggested.
 *
 * The flow (Amendments A–E of the s131 keystone memo):
 *   1. rows are REQUIRED — assembleSpec embeds data.values from them (a rows-less
 *      intent would emit an empty-data chart). (Amendment B)
 *   2. an explicit-only chartFamily is rejected (defense-in-depth; the schema also
 *      rejects it). (Amendment E)
 *   3. every caller-named measure/dimension MUST exist among the profiled rows — else
 *      fail loud (Rule 12).
 *   4. THE INVARIANT (Amendment C): the SchemaIntent is derived from the SELECTED named
 *      profiles via toSchemaIntent, with ONLY the caller's goal spread-overridden — so
 *      the scorer's counts (bucketed by INFERRED type) stay consistent with what
 *      autoAssignEncodings can encode from the same profiles, and the data-aware
 *      carriers (correlation/density/cardinality) survive the merge.
 *   5. the recommender ranks UNCHANGED; an optional chartFamily POST-FILTERS the full
 *      ranking (NOT a scorer term — protects the s110 goldens).
 *
 * measureRef is intentionally NOT read here — it is a narrative overlay the viz.render
 * handler resolves (m03); this builder stays measure-agnostic.
 */
export function buildFromIntent(input: BuildFromIntentInput): BuildVizSpecResult {
  const { intent } = input;
  const rows = input.rows;

  // (Amendment B) rows REQUIRED for v0.1.
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new VizSpecBuilderError(
      'buildFromIntent requires a non-empty rows array (v0.1 intent renders over real rows).',
    );
  }

  // (Amendment E) GEO / explicit-only guard — never route a non-tabular family through
  // the recommender, which ranks none of the 8 explicit-only types.
  if (intent.chartFamily !== undefined && !TABULAR_FAMILIES.has(intent.chartFamily)) {
    throw new VizSpecBuilderError(
      `buildFromIntent chartFamily "${intent.chartFamily}" is not a tabular mark; the recommender ranks only bar/line/area/scatter/heatmap.`,
    );
  }

  // Profile the rows, then SELECT the caller-named subset. Every named field MUST be present.
  const profiles = inferFieldProfile(rows);
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const namedFields = [...intent.measures, ...intent.dimensions];
  const missing = namedFields.map((f) => f.name).filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new VizSpecBuilderError(
      `buildFromIntent: named intent field(s) not present in rows: ${missing.join(', ')}.`,
    );
  }
  const selectedProfiles = namedFields.map((f) => byName.get(f.name) as FieldProfile);

  // (Amendment C — the count/named-field consistency INVARIANT) Derive the SchemaIntent
  // from the SELECTED named profiles so its counts are bucketed by the same inferred types
  // autoAssignEncodings will encode from; spread preserves the data-aware carriers and only
  // the caller's analytical goal wins.
  const base = toSchemaIntent(selectedProfiles, rows);
  const schemaIntent: SchemaIntent = { ...base, goal: intent.goal };

  // Rank with the recommender UNCHANGED (no scorer term). Pull the FULL ranking so a
  // chartFamily post-filter can find its family even when it ranks below the default top-3.
  const ranked = suggestPatterns(schemaIntent, { limit: chartPatterns.length });

  // FAMILY PREFERENCE = POST-FILTER ranked[] by pattern.chartType.
  let chosen: PatternSuggestion | undefined;
  let familyFallback = false;
  if (intent.chartFamily !== undefined) {
    chosen = ranked.find((s) => s.pattern.chartType === intent.chartFamily);
    familyFallback = chosen === undefined;
  } else {
    chosen = ranked[0];
  }

  const chartType: ChartType = chosen?.pattern.chartType ?? intent.chartFamily ?? 'bar';

  const encoding = autoAssignEncodings(selectedProfiles, chartType);
  if (!encoding.x || !encoding.y) {
    // Fail loud (Rule 12): the goal/family the caller asked for resolved to a chartType
    // that needs more fields than were named (a relationship/scatter needs ≥2 measures; a
    // heatmap needs ≥2 dimensions). This is the "deterministic tool validates the intent"
    // half of the NL→viz split — an incoherent intent is rejected, never silently degraded.
    const measureNames = intent.measures.map((m) => m.name);
    const dimensionNames = intent.dimensions.map((d) => d.name);
    throw new VizSpecBuilderError(
      `Intent mode could not assign x and y for a "${chartType}" chart from the named fields ` +
        `(measures: [${measureNames.join(', ')}], dimensions: [${dimensionNames.join(', ')}]). ` +
        `Goal "${intent.goal}"${intent.chartFamily ? ` / family "${intent.chartFamily}"` : ''} resolved to "${chartType}", ` +
        `which needs more fields than were named (a relationship/scatter needs ≥2 measures; a heatmap needs ≥2 dimensions).`,
    );
  }

  // A requested family with no positive recommender match (unreachable for the 5 tabular
  // families — each has ≥1 registry pattern — but kept honest if the registry changes) is a
  // low-confidence fallback, mirroring the suggest-mode geo-honesty signal.
  const familySignal =
    `requested chart family "${intent.chartFamily}" had no positive recommender match — rendered as a low-confidence fallback`;
  const lowConfidence = familyFallback || !chosen || chosen.score < LOW_CONFIDENCE_SCORE;

  const alternatives = ranked
    .filter((s) => s !== chosen)
    .slice(0, 2)
    .map((s) => ({
      patternId: s.pattern.id,
      score: s.score,
      chartType: s.pattern.chartType,
    }));

  const buildInput: BuildVizSpecInput = {
    rows,
    ...(input.id !== undefined ? { id: input.id } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  };
  const spec = assembleSpec(buildInput, chartType, encoding);

  return {
    spec,
    chartType,
    mode: 'intent',
    suggestion: chosen
      ? {
          patternId: chosen.pattern.id,
          score: chosen.score,
          signals: familyFallback ? [...chosen.signals, familySignal] : chosen.signals,
        }
      : undefined,
    inferredFields: selectedProfiles,
    lowConfidence,
    ...(alternatives.length > 0 ? { alternatives } : {}),
  };
}

/**
 * Deterministic, DATA-AWARE per-field profiler (sprint-110 m01). Beyond
 * type/role/cardinality it computes real statistics — numeric range/mean/stddev/
 * skew/outliers/negativity, distinct-ratio, integer-ness, temporal granularity +
 * regularity, and a name-detected geographic role — in a single pass per field.
 *
 * Type inference is hardened against the #686 misclassifications: numeric-looking
 * year/zip/currency-code columns no longer read as quantitative measures, and
 * non-ISO date text (MM/DD/YYYY, "Mar 2024", YYYY-Qn) is recognised as temporal.
 * Determinism is the contract — same rows yield a byte-identical FieldProfile[]
 * (fixed reduction order, 6dp rounding, UTC-pinned date parsing).
 *
 * Drives SUGGEST-mode recommendation AND, since sprint-125 m01, EXPLICIT-mode
 * data-aware channel typing: buildExplicit profiles the rows and stamps each
 * unscaled binding's data-derived FieldType onto it, so an all-distinct-float
 * axis no longer falls to the adapter's ordinal/nominal channel default. A
 * caller-declared scale/aggregate/timeUnit still wins (the deliberate
 * discrete-numeric-axis escape).
 */
export function inferFieldProfile(
  rows: ReadonlyArray<Record<string, unknown>>,
  fieldNames?: ReadonlyArray<string>,
): FieldProfile[] {
  const names = fieldNames ?? collectFieldNames(rows);
  const geo = detectGeoFields(rows);
  return names.map((name) => buildFieldProfile(name, rows, geo));
}

function buildFieldProfile(
  name: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  geo: GeoFieldDetection,
): FieldProfile {
  const present = rows
    .map((row) => row[name])
    .filter((v) => v !== null && v !== undefined && v !== '');
  const type = inferFieldType(name, present);
  const cardinality = new Set(present.map((v) => String(v))).size;
  const role: 'measure' | 'dimension' = type === 'quantitative' ? 'measure' : 'dimension';

  const profile: MutableFieldProfile = { name, type, role, cardinality };

  const geoKind = geoKindFor(name, geo);
  if (geoKind !== 'none') {
    profile.geoKind = geoKind;
  }
  if (present.length > 0) {
    profile.distinctRatio = round(cardinality / present.length);
  }

  if (type === 'temporal') {
    const summary = summarizeTemporal(present);
    if (summary) {
      profile.temporalGranularity = summary.granularity;
      profile.temporalRegular = summary.regular;
    }
    return profile;
  }

  // Numeric statistics for numeric-typed fields (quantitative + ordinal). The
  // values are all numeric by construction of the type decision below.
  if (type === 'quantitative' || type === 'ordinal') {
    const nums = present.map((v) => toNumber(v)).filter((n): n is number => n !== null);
    if (nums.length > 0) {
      const meanValue = mean(nums);
      const stdDev = populationStdDev(nums, meanValue);
      profile.min = round(Math.min(...nums));
      profile.max = round(Math.max(...nums));
      profile.mean = round(meanValue);
      profile.stddev = round(stdDev);
      profile.skew = round(skewness(nums, meanValue, stdDev));
      profile.outlierCount = tukeyOutlierCount(nums);
      profile.hasNegative = nums.some((n) => n < 0);
      profile.hasZero = nums.some((n) => n === 0);
      profile.isInteger = nums.every((n) => Number.isInteger(n));
    }
  }

  return profile;
}

function geoKindFor(name: string, geo: GeoFieldDetection): GeoKind {
  if (geo.latField === name) return 'lat';
  if (geo.lonField === name) return 'lon';
  if (geo.regionField === name) return 'region';
  return 'none';
}

/**
 * Pearson correlation between two fields' numeric values (per-pair, row-aligned —
 * a row contributes only when BOTH cells are numeric). Routes through the single
 * stats.pearson implementation; returns null for <3 paired points or zero
 * variance. m02 consumes this to derive SchemaIntent.correlationStrength.
 */
export function fieldCorrelation(
  rows: ReadonlyArray<Record<string, unknown>>,
  fieldA: string,
  fieldB: string,
): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const x = toNumber(row[fieldA]);
    const y = toNumber(row[fieldB]);
    if (x === null || y === null) {
      continue;
    }
    xs.push(x);
    ys.push(y);
  }
  return pearson(xs, ys);
}

/**
 * Derive the SchemaIntent the recommender consumes from field profiles.
 *
 * sprint-110 m02 makes this DATA-AWARE: it stops discarding the profile and
 * POPULATES the previously-dead scorer fields (density / allowNegative /
 * partToWhole / matrix) plus carriers (cardinality / correlationStrength), and
 * refines goal gating — `trend` requires a regular temporal axis (not just any
 * temporal field), `relationship` requires a measured correlation above the
 * documented gate (an uncorrelated pair is better compared than scatter-plotted).
 *
 * `rows` is OPTIONAL and additive: the count-based behaviour is preserved when
 * it is omitted (so existing callers keep working), while the rows path supplies
 * the real data signals — correlation and density — that need the values.
 */
export function toSchemaIntent(
  profiles: ReadonlyArray<FieldProfile>,
  rows?: ReadonlyArray<Record<string, unknown>>,
): SchemaIntent {
  const measureProfiles = profiles.filter((f) => f.type === 'quantitative');
  const temporalProfiles = profiles.filter((f) => f.type === 'temporal');
  const dimensionProfiles = profiles.filter((f) => f.type === 'nominal' || f.type === 'ordinal');

  const measures = measureProfiles.length;
  const temporals = temporalProfiles.length;
  const dimensions = dimensionProfiles.length;

  // A temporal field drives a TREND only when it is a real, regularly-spaced time
  // axis — an irregular or single-point "temporal" is not a time series.
  const hasRegularTemporal = temporalProfiles.some((f) => f.temporalRegular !== false);

  // |Pearson r| of the primary two-measure pair, when we have rows to measure it.
  let correlationStrength: number | undefined;
  if (measures >= 2 && rows && rows.length > 0) {
    const r = fieldCorrelation(rows, measureProfiles[0].name, measureProfiles[1].name);
    if (r !== null) {
      correlationStrength = Math.abs(r);
    }
  }

  let goal: IntentGoal;
  if (hasRegularTemporal) {
    goal = 'trend';
  } else if (measures >= 2 && dimensions === 0) {
    // RELATIONSHIP only when the pair is actually correlated. When correlation is
    // unmeasurable (no rows / <3 points) fall back to the count-based call so
    // existing profile-only callers keep their relationship result.
    const correlated =
      correlationStrength === undefined || correlationStrength >= CORRELATION_RELATIONSHIP_GATE;
    goal = correlated ? 'relationship' : 'comparison';
  } else {
    goal = 'comparison';
  }

  // Negative values unlock diverging encodings (the scorer weights allowNegative).
  const allowNegative = measureProfiles.some((f) => f.hasNegative === true);

  // Density preference from row count; left undefined in the indeterminate middle.
  let density: SchemaIntent['density'];
  if (rows) {
    if (rows.length >= DENSITY_DENSE_ROW_COUNT) density = 'dense';
    else if (rows.length <= DENSITY_SPARSE_ROW_COUNT) density = 'sparse';
  }

  const nominalCardinalities = dimensionProfiles.map((f) => f.cardinality);
  const maxNominalCardinality =
    nominalCardinalities.length > 0 ? Math.max(...nominalCardinalities) : undefined;
  const hasHighCardinalityDim =
    maxNominalCardinality !== undefined && maxNominalCardinality >= HIGH_CARDINALITY_DIMENSION;

  // Part-to-whole: ≥2 low-cardinality categorical series over an all-positive
  // measure reads as composition. Conservative — gated on small cardinality so a
  // high-cardinality category set never qualifies.
  const lowCardDimensions = dimensionProfiles.filter(
    (f) => f.cardinality >= 2 && f.cardinality <= PART_TO_WHOLE_MAX_CARDINALITY,
  );
  const partToWhole = measures >= 1 && !allowNegative && lowCardDimensions.length >= 2;

  // Matrix (heatmap grid): two categorical dimensions crossed by a measure, dense
  // enough to read as a grid. Gated on density so small data is not over-matrixed.
  const matrix = measures >= 1 && dimensions >= 2 && temporals === 0 && density === 'dense';

  return {
    measures,
    dimensions,
    temporals,
    goal,
    multiMetrics: measures >= 2,
    requiresGrouping: dimensions >= 2,
    allowNegative,
    ...(density ? { density } : {}),
    ...(partToWhole ? { partToWhole } : {}),
    ...(matrix ? { matrix } : {}),
    ...(maxNominalCardinality !== undefined ? { maxNominalCardinality } : {}),
    ...(hasHighCardinalityDim ? { hasHighCardinalityDim } : {}),
    ...(correlationStrength !== undefined ? { correlationStrength } : {}),
  };
}

// --- explicit mode ----------------------------------------------------------

function buildExplicit(input: BuildVizSpecInput, chartType: ChartType): BuildVizSpecResult {
  const encoding = normalizeEncodings(input.encodings ?? {});

  if (!encoding.x || !encoding.y) {
    throw new VizSpecBuilderError(
      `Explicit mode for "${chartType}" requires at least x and y encodings (got: ${Object.keys(encoding).join(', ') || 'none'}).`,
    );
  }

  applyDataAwareTypes(encoding, input.rows);

  const spec = assembleSpec(input, chartType, encoding);
  return { spec, chartType, mode: 'explicit' };
}

/**
 * Explicit-mode data-aware typing (sprint-125 m01, Forge-Demos P0-1). The
 * adapters type an unscaled x/y as ordinal and an unscaled color as nominal from
 * channel defaults alone, so all-distinct floats render on a discrete axis. Here
 * we profile the rows and stamp the data-derived FieldType onto each binding the
 * caller did NOT already constrain with a scale / aggregate / timeUnit — those
 * are deliberate declarations (the discrete-numeric-axis escape) the adapter's
 * existing scale branches must still own. The adapters short-circuit on
 * `binding.type` before their channel defaults, so this corrects the type without
 * touching any scaled/aggregated binding. A caller-declared type (sprint-125 m02
 * escape hatch, threaded through normalizeEncodings) is also left untouched — the
 * manual override wins over the data-aware profile.
 */
function applyDataAwareTypes(
  encoding: Partial<Record<EncodingChannel, TraitBinding>>,
  rows: ReadonlyArray<Record<string, unknown>>,
): void {
  const typeByField = new Map(inferFieldProfile(rows).map((p) => [p.name, p.type]));
  for (const channel of Object.keys(encoding) as EncodingChannel[]) {
    const binding = encoding[channel];
    if (!binding || binding.type || binding.scale || binding.aggregate || binding.timeUnit) {
      continue;
    }
    const inferred = typeByField.get(binding.field);
    if (inferred) {
      binding.type = inferred;
    }
  }
}

// --- suggest mode -----------------------------------------------------------

function buildSuggested(input: BuildVizSpecInput): BuildVizSpecResult {
  const profiles = inferFieldProfile(input.rows);
  const intent = toSchemaIntent(profiles, input.rows);
  const ranked = suggestPatterns(intent, { limit: 3 });
  const top = ranked[0];
  const chartType: ChartType = top?.pattern.chartType ?? 'bar';

  const encoding = autoAssignEncodings(profiles, chartType);
  if (!encoding.x || !encoding.y) {
    throw new VizSpecBuilderError(
      'Suggest mode could not infer at least two usable fields (x and y) from the provided rows.',
    );
  }

  // No top pick (every pattern scored below the filter), or a top whose score is
  // below the confidence floor, means the chartType is a fallback, not a positive
  // recommendation — surface that instead of silently returning a bar.
  // GEO HONESTY (sprint-118 m04): the pattern pool ranks only the 5 tabular marks, so geo-shaped
  // rows get a CONFIDENT bar instead of a map. Coordinate fields (lat/lon) are unambiguous map
  // intent — flag low-confidence and tell the agent to ask for choropleth/bubble_map explicitly.
  // Gate on lat/lon ONLY, NOT 'region': a 'region' column is a common categorical dimension (e.g.
  // region+revenue is a clean bar), so flagging it would wrongly low-confidence a count-shape.
  const geoShaped = profiles.some((p) => p.geoKind === 'lat' || p.geoKind === 'lon');
  const lowConfidence = geoShaped || !top || top.score < LOW_CONFIDENCE_SCORE;
  const alternatives = ranked.slice(1).map((s) => ({
    patternId: s.pattern.id,
    score: s.score,
    chartType: s.pattern.chartType,
  }));

  const geoSignal =
    'geographic coordinate fields detected but the recommender only ranks tabular charts — specify choropleth or bubble_map explicitly';

  const spec = assembleSpec(input, chartType, encoding);
  return {
    spec,
    chartType,
    mode: 'suggest',
    suggestion: top
      ? { patternId: top.pattern.id, score: top.score, signals: geoShaped ? [...top.signals, geoSignal] : top.signals }
      : undefined,
    inferredFields: profiles,
    lowConfidence,
    ...(alternatives.length > 0 ? { alternatives } : {}),
  };
}

function autoAssignEncodings(
  profiles: ReadonlyArray<FieldProfile>,
  chartType: ChartType,
): Partial<Record<EncodingChannel, TraitBinding>> {
  const temporals = profiles.filter((f) => f.type === 'temporal');
  const measures = profiles.filter((f) => f.type === 'quantitative');
  const dimensions = profiles.filter((f) => f.type === 'nominal' || f.type === 'ordinal');

  const out: Partial<Record<EncodingChannel, TraitBinding>> = {};

  if (chartType === 'scatter') {
    const x = measures[0];
    const y = measures[1] ?? measures[0];
    if (x) out.x = binding('x', x);
    if (y && y !== x) out.y = binding('y', y);
    if (dimensions[0]) out.color = binding('color', dimensions[0]);
    return out;
  }

  if (chartType === 'heatmap') {
    const x = dimensions[0] ?? temporals[0];
    const y = dimensions[1];
    const color = measures[0];
    if (x) out.x = binding('x', x);
    if (y) out.y = binding('y', y);
    if (color) out.color = binding('color', color);
    return out;
  }

  // bar / line / area: categorical-or-temporal x, measure y, optional series color
  const x = temporals[0] ?? dimensions[0];
  const y = measures[0];
  if (x) out.x = binding('x', x);
  if (y) out.y = binding('y', y);
  const series = dimensions.find((d) => d !== x);
  if (series) out.color = binding('color', series);
  return out;
}

function binding(channel: EncodingChannel, field: FieldProfile): TraitBinding {
  const scale = scaleForType(field.type);
  return {
    field: field.name,
    trait: ENCODING_TRAIT[channel],
    channel,
    ...(scale ? { scale } : {}),
  };
}

function scaleForType(type: FieldType): TraitBinding['scale'] | undefined {
  switch (type) {
    case 'quantitative':
      return 'linear';
    case 'temporal':
      return 'temporal';
    case 'nominal':
    case 'ordinal':
      return 'band';
    default:
      return undefined;
  }
}

// --- shared assembly --------------------------------------------------------

function assembleSpec(
  input: BuildVizSpecInput,
  chartType: ChartType,
  encoding: Partial<Record<EncodingChannel, TraitBinding>>,
): NormalizedVizSpec {
  // sprint-135 m02 — conformant-BY-CONSTRUCTION. Synthesize the a11y features the
  // equivalence engine (packages/viz-core/src/a11y/equivalence-rules.ts) requires
  // so DEFAULT emissions PASS every error-severity rule: R-05 (axis titles),
  // R-08 (description >= 25 chars), R-09 (aria-label), plus the R-14 (warn)
  // column-order polish. Every synthesized value is a PURE function of chartType +
  // field names + row keys — no Date/random/UUID — so byte-determinism holds. All
  // fields are permitted by normalized-viz-spec.schema.json (title/ariaLabel/
  // portability.tableColumnOrder), so assertNormalizedVizSpec below stays green.

  // R-05: give every present positional/legend binding a non-empty axis title.
  // Mutating in place is safe — `encoding` is freshly built per call (explicit ->
  // normalizeEncodings, suggest/intent -> autoAssignEncodings). Titles reuse the
  // shared `humanize` so axis title == narrative label == table column label.
  for (const channel of ['x', 'y', 'color'] as const) {
    const binding = encoding[channel];
    if (binding && (!binding.title || binding.title.trim() === '')) {
      binding.title = humanize(binding.field);
    }
  }

  // R-08: the resolved a11y.description must be >= 25 chars. A trimmed caller
  // override wins; else synthesizeDescription, which undershoots on short field
  // names ('Scatter plot of b by a.' = 23). When either lands short, append a
  // deterministic, accurate clause (x/y are guaranteed present for every
  // assembleSpec caller, which all throw without both).
  let description = input.description?.trim()
    ? input.description.trim()
    : synthesizeDescription(chartType, encoding);
  if (description.length < 25) {
    description = `${description}${axisContextClause(encoding)}`;
  }

  const spec: NormalizedVizSpec = {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: input.id ?? `viz:${chartType}`,
    name: input.name ?? CHART_TYPE_LABEL[chartType],
    data: { values: input.rows.map((row) => ({ ...row })) },
    marks: [{ trait: CHART_TYPE_MARK[chartType] }],
    encoding: encoding as NormalizedVizSpec['encoding'],
    // R-09: a deterministic aria-label so assistive tech can announce the chart
    // even when a caller passes name:'' (which would otherwise defeat the R-09
    // spec.name fallback).
    a11y: { description, ariaLabel: synthesizeAriaLabel(chartType, encoding) },
    // R-14 (warn): declare a deterministic table column order for >2-column tables
    // (spread empty otherwise). Encoding channels first in [x,y,color,size,shape,
    // detail] order, then remaining first-row keys in encounter order — matching
    // deriveColumns (a11y/table-generator.ts). Re-orders the accessible table to
    // encoding order; that is the point of R-14.
    ...synthesizeTableColumnOrder(encoding, input.rows),
  };

  // The builder's contract is a VALID spec; fail loud rather than emit a spec
  // that AJV would later reject (e.g. an empty a11y.description).
  return assertNormalizedVizSpec(spec);
}

function synthesizeDescription(
  chartType: ChartType,
  encoding: Partial<Record<EncodingChannel, TraitBinding>>,
): string {
  const label = CHART_TYPE_LABEL[chartType];
  const y = encoding.y?.field;
  const x = encoding.x?.field;
  const color = encoding.color?.field;

  if (y && x) {
    const aggregate = encoding.y?.aggregate ? `${encoding.y.aggregate} of ` : '';
    const series = color ? `, split by ${color}` : '';
    return `${label} of ${aggregate}${y} by ${x}${series}.`;
  }
  if (x) {
    return `${label} of ${x}.`;
  }
  return `${label}.`;
}

/**
 * Deterministic padding clause appended to a sub-25-char description so R-08
 * (>=25) passes. Uses humanized axis fields (guaranteed present for every
 * assembleSpec caller); the table-availability fallback is defensive only.
 */
function axisContextClause(encoding: Partial<Record<EncodingChannel, TraitBinding>>): string {
  const x = encoding.x?.field;
  const y = encoding.y?.field;
  if (y && x) {
    return ` Showing ${humanize(y)} against ${humanize(x)}.`;
  }
  if (x) {
    return ` Showing ${humanize(x)}.`;
  }
  return ' Accessible data table available.';
}

/**
 * Deterministic aria-label (R-09) — humanized measure/dimension over the chart
 * type label, e.g. "Bar chart of Revenue by Region". Pure function of chartType +
 * field names.
 */
function synthesizeAriaLabel(
  chartType: ChartType,
  encoding: Partial<Record<EncodingChannel, TraitBinding>>,
): string {
  const label = CHART_TYPE_LABEL[chartType];
  const x = encoding.x?.field;
  const y = encoding.y?.field;
  if (y && x) {
    return `${label} of ${humanize(y)} by ${humanize(x)}`;
  }
  if (x) {
    return `${label} of ${humanize(x)}`;
  }
  return label;
}

/**
 * Deterministic table column order (R-14, warn) for >2-column tables: encoding
 * channel fields in [x,y,color,size,shape,detail] order (deduped), then the
 * remaining first-row keys in encounter order. Mirrors deriveColumns
 * (a11y/table-generator.ts) so the declared order == the rendered order. Returns
 * an empty object (spread to no-op) when the table has <=2 columns, so 2-column
 * specs stay free of the field.
 */
function synthesizeTableColumnOrder(
  encoding: Partial<Record<EncodingChannel, TraitBinding>>,
  rows: ReadonlyArray<Record<string, unknown>>,
): Partial<Pick<NormalizedVizSpec, 'portability'>> {
  const firstRow = rows[0];
  const rowKeys = firstRow ? Object.keys(firstRow) : [];
  if (rowKeys.length <= 2) {
    return {};
  }
  const channelOrder: EncodingChannel[] = ['x', 'y', 'color', 'size', 'shape', 'detail'];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const channel of channelOrder) {
    const field = encoding[channel]?.field;
    if (field && !seen.has(field)) {
      seen.add(field);
      ordered.push(field);
    }
  }
  for (const key of rowKeys) {
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return { portability: { tableColumnOrder: ordered } };
}

function normalizeEncodings(
  encodings: Partial<Record<EncodingChannel, EncodingInput | string>>,
): Partial<Record<EncodingChannel, TraitBinding>> {
  const out: Partial<Record<EncodingChannel, TraitBinding>> = {};
  for (const channel of Object.keys(encodings) as EncodingChannel[]) {
    const raw = encodings[channel];
    if (raw === undefined) {
      continue;
    }
    const value: EncodingInput = typeof raw === 'string' ? { field: raw } : raw;
    if (!value.field || typeof value.field !== 'string') {
      throw new VizSpecBuilderError(`Encoding "${channel}" is missing a string field.`);
    }
    out[channel] = {
      field: value.field,
      trait: ENCODING_TRAIT[channel],
      channel,
      ...(value.aggregate ? { aggregate: value.aggregate } : {}),
      ...(value.scale ? { scale: value.scale } : {}),
      ...(value.timeUnit ? { timeUnit: value.timeUnit } : {}),
      ...(value.sort ? { sort: value.sort } : {}),
      ...(value.title ? { title: value.title } : {}),
      ...(value.type ? { type: value.type } : {}),
      ...(value.range ? { range: value.range } : {}),
      ...(value.format ? { format: value.format } : {}),
      ...(value.currency ? { currency: value.currency.toUpperCase() } : {}),
    };
  }
  return out;
}

function collectFieldNames(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
  }
  return order;
}

/**
 * Hardened, name-aware type inference (sprint-110 m01). Precedence:
 *   1. unambiguous date/time formats (bare years excluded) → temporal;
 *   2. a name-hinted, in-range 4-digit-year column → temporal ('year');
 *   3. numeric semantic CODES (zip/postal, currency-code by name) → nominal;
 *   4. a small repeated set of integers → ordinal (the previously-unreachable
 *      FieldType member);
 *   5. otherwise numeric → quantitative;
 *   6. anything else → nominal.
 */
function inferFieldType(name: string, present: ReadonlyArray<unknown>): FieldType {
  if (present.length === 0) {
    return 'nominal';
  }
  // (1) Unambiguous date/time strings (ISO, slash, "Mon YYYY", YYYY-Qn).
  if (everyValueIsTemporal(present)) {
    return 'temporal';
  }
  // (2) Name-gated year-only column. Gated on a year-hinting name AND a plausible
  //     4-digit window so a column of 4-digit counts/codes is not misread.
  if (nameHintsYear(name) && present.every(isBareYearInRange)) {
    return 'temporal';
  }

  const { nums, allNumeric } = numericView(present);
  if (allNumeric) {
    // (3) A currency code (by name) is a categorical dimension, not a measure. Exact-match only
    //     (no compounds), so it never collides with the measure rescue below.
    if (nameHintsCurrencyCode(name)) {
      return 'nominal';
    }
    // (3z) A zip/postal/FIPS code or an identifier column (id/ids/uuid/guid) is a categorical
    //      DIMENSION — summing or gradient-shading a postal code or an ID is meaningless (#895).
    //      The hint helpers match a token ANYWHERE (.some), so a measure word appearing as a
    //      non-head qualifier (sales_id, postal_area) must NOT rescue it — that was the sprint-153
    //      REORDER regression, where the trailing measure rescue promoted sales_id/total_id/... to
    //      summable measures. The sprint-153 review proved no ORDERING of an unordered token-bag
    //      is correct in both directions (id_count wants a measure, id_number a dimension); head
    //      POSITION is the missing axis. So a zip/id column ESCAPES to a real measure only when its
    //      HEAD noun (last token after stripping a trailing all-digit suffix) is aggregate-shaped
    //      (id_count, guid_score) or itself a measure word (postal_revenue), or the name carries a
    //      'per' rate marker (revenue_per_id). Placed BEFORE the (3b) measure rescue so a
    //      non-escaping compound cannot be promoted by a stray measure token. Name-gated only.
    if (nameHintsZip(name) || nameHintsIdentifier(name)) {
      const head = headToken(name);
      const escapes =
        fieldNameTokens(name).includes('per') ||
        (head !== undefined && (AGGREGATE_HEADS.has(head) || MEASURE_NAME_TOKENS.includes(head)));
      if (!escapes) {
        return 'nominal';
      }
      // Escaped — fall through to the measure rescue / value rules below.
    }
    // (3b) A measure-named numeric column is a quantitative measure even when it is a small
    //      repeated integer set — the name disambiguates a real metric from a true ordinal
    //      scale (sprint-118 m04). Conservative tokens; EXCLUDES 'count'/'score' (which are
    //      legitimately ordinal). Only changes columns that rule (4) would otherwise type
    //      ordinal — high-cardinality measures already fall through to (5) quantitative.
    if (nameHintsMeasure(name)) {
      return 'quantitative';
    }
    // (4) A small, repeated set of integers is an ordinal scale.
    const distinct = new Set(nums).size;
    if (
      nums.every((n) => Number.isInteger(n)) &&
      present.length >= ORDINAL_MIN_ROWS &&
      distinct <= ORDINAL_MAX_CARDINALITY &&
      distinct / present.length < ORDINAL_MAX_DISTINCT_RATIO
    ) {
      return 'ordinal';
    }
    // (5) Otherwise a genuine quantitative measure.
    return 'quantitative';
  }
  // (6) Non-numeric, non-temporal → nominal dimension.
  return 'nominal';
}

/** Coerce every present value to a number; `allNumeric` is false on first miss. */
function numericView(present: ReadonlyArray<unknown>): { nums: number[]; allNumeric: boolean } {
  const nums: number[] = [];
  for (const v of present) {
    const n = toNumber(v);
    if (n === null) {
      return { nums: [], allNumeric: false };
    }
    nums.push(n);
  }
  return { nums, allNumeric: present.length > 0 };
}

// s155 m04: fieldNameTokens, headToken, MEASURE_NAME_TOKENS, AGGREGATE_HEADS, nameHintsMeasure,
// nameHintsZip, nameHintsIdentifier moved to ../analysis/field-name-hints.js (imported above) so
// the a11y "Total X" gate shares this exact token model. nameHintsYear / nameHintsCurrencyCode /
// isBareYearInRange stay here (profiler-only; nameHintsYear consumes the imported fieldNameTokens).

function nameHintsYear(name: string): boolean {
  const tokens = fieldNameTokens(name);
  return tokens.includes('year') || tokens.includes('yr') || tokens.includes('fy');
}

function nameHintsCurrencyCode(name: string): boolean {
  const collapsed = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return collapsed === 'currency' || collapsed === 'currencycode' || collapsed === 'isocurrency';
}

function isBareYearInRange(value: unknown): boolean {
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) {
    return false;
  }
  const year = Number(text);
  return year >= YEAR_MIN && year <= YEAR_MAX;
}
