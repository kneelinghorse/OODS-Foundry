import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import {
  analyzeVizSpec,
  describeDataPoint,
  getEncodingBinding,
  resolvePrimaryChannels,
  type VizDataAnalysis,
} from './data-analysis.js';
import { formatPercent, humanize, narrateFormatted, narrateNumber } from './format.js';

export interface NarrativeResult {
  readonly status: 'ready' | 'insufficient-data';
  readonly summary: string;
  readonly keyFindings: readonly string[];
  readonly analysis: VizDataAnalysis;
}

interface NarrativeLabels {
  readonly chartLabel: string;
  readonly measureLabel?: string;
  /** High/Low/Total label; count aggregates name the operation, not the counted identity field. */
  readonly findingMeasureLabel?: string;
  readonly dimensionLabel?: string;
  readonly colorLabel?: string;
}

/**
 * Governed-measure context (sprint-129 m01) threaded into the narrative when a KPI
 * signal resolves over the measure registry. The measure's `displayName` maps to the
 * already-present `measureLabel`; this carries the remaining governed fields a resolved
 * registry entry holds (`measure-registry.ts` `MeasureEntry`: `unit` / `format` + the
 * governed `threshold.value`) plus (sprint-130 m01) the RESOLVED comparison basis/value
 * the KPI delta was computed against — `kpiPanel.comparison` AFTER `resolveMeasurePanel`
 * (author-override-wins), so the "vs target N" clause names the ACTUAL baseline, not a
 * governed default an override superseded. ONE shared shape, reused by
 * `AnalysisNarrativeInput`, `AnalysisTableInput`, and (sprint-129 m02) the dashboard KPI
 * summary (`DashboardKpiSummary`) — NOT a parallel metadata type.
 */
export interface MeasureNarrativeContext {
  /** Resolved measure unit label, e.g. '1000 USD'. Mirrors `MeasureEntry.unit`. */
  readonly unit?: string;
  /** Renderer-agnostic number-format hint, e.g. 'currency'. Mirrors `MeasureEntry.format`. */
  readonly format?: string;
  /** Governed threshold value from the resolved registry entry (`threshold.value`). */
  readonly thresholdValue?: number;
  /**
   * Governed threshold DIRECTION from the resolved registry entry (`threshold.direction`),
   * sprint-130 m04. Not verbalized — carried so the mcp-server V142 guard can detect an author
   * direction-only override that flips the computeKpi breach while the narrative still names the
   * governed direction (a registry-vs-rendered drift). Absent-safe across all three consumers.
   */
  readonly thresholdDirection?: 'above' | 'below';
  /**
   * RESOLVED comparison basis (sprint-130 m01) — `kpiPanel.comparison.basis` AFTER
   * `resolveMeasurePanel`. Mirrors `KpiComparison.basis`. Only `'target'` is verbalized
   * this sprint (as "vs target N"); the period bases carry no static value to name.
   */
  readonly comparisonBasis?: 'prior_period' | 'target' | 'window';
  /**
   * RESOLVED comparison value (sprint-130 m01) — `kpiPanel.comparison.value`, the explicit
   * target for basis 'target'. Mirrors `KpiComparison.value`. The N in "vs target N".
   */
  readonly comparisonValue?: number;
}

/**
 * A pre-built-analysis input for the input-shaped (non-cartesian) sources whose
 * data never flows through a NormalizedVizSpec (sprint-128 m01). Carries the
 * VizDataAnalysis plus the labels + author-override knobs the cartesian path
 * otherwise reads off the spec. All optional except the analysis.
 */
export interface AnalysisNarrativeInput {
  readonly analysis: VizDataAnalysis;
  /** Mirrors spec.name ?? spec.a11y.ariaLabel ?? spec.id — default 'This visualization'. */
  readonly chartLabel?: string;
  readonly measureLabel?: string;
  readonly dimensionLabel?: string;
  readonly colorLabel?: string;
  /** Mirrors spec.a11y.narrative (author override). */
  readonly narrative?: ProvidedNarrative;
  /** Mirrors spec.a11y.description (the fallback summary). */
  readonly fallbackSummary?: string;
  /**
   * Governed-measure context (sprint-129 m01). OPTIONAL — absent === the s128 narrative
   * output byte-for-byte. When it carries governed content, a leading measure-context
   * key finding verbalizes the measureLabel/unit/format/threshold the registry governs.
   */
  readonly measureContext?: MeasureNarrativeContext;
}

interface ResolvedNarrativeInputs {
  readonly analysis: VizDataAnalysis;
  readonly labels: NarrativeLabels;
  readonly narrative: ProvidedNarrative | undefined;
  readonly fallbackSummary: string;
  /** Present only on the analysis branch; the cartesian spec path carries no measure context. */
  readonly measureContext?: MeasureNarrativeContext;
}

/**
 * Normalize the two accepted inputs to a single shape. The spec branch is
 * byte-identical to the pre-m01 behavior (same analysis, labels, author override,
 * fallback); the analysis branch supplies those from the input object.
 */
function resolveNarrativeInputs(input: NormalizedVizSpec | AnalysisNarrativeInput): ResolvedNarrativeInputs {
  if ('analysis' in input) {
    return {
      analysis: input.analysis,
      labels: {
        chartLabel: input.chartLabel ?? 'This visualization',
        measureLabel: input.measureLabel,
        dimensionLabel: input.dimensionLabel,
        colorLabel: input.colorLabel,
      },
      narrative: input.narrative,
      fallbackSummary: input.fallbackSummary ?? '',
      measureContext: input.measureContext,
    };
  }
  // s150/s151 m05b: name the SAME channels the binding site read as the measure/dimension — via
  // the ONE shared derivation resolvePrimaryChannels — so label and values can't diverge (the
  // s149 F6d root cause). Covers the real-heatmap (color=measure) AND the horizontal strip plot
  // (x=measure, y=dimension) rebindings; everything else stays measure=Y / dimension=X.
  const { measureChannel, dimensionChannel, colorIsMeasure } = resolvePrimaryChannels(input);
  const measureLabel = resolveFieldLabel(input, measureChannel);
  return {
    analysis: analyzeVizSpec(input),
    labels: {
      chartLabel: input.name ?? input.a11y.ariaLabel ?? input.id ?? 'This visualization',
      measureLabel,
      findingMeasureLabel: resolveFindingMeasureLabel(input, measureChannel, measureLabel),
      dimensionLabel: resolveFieldLabel(input, dimensionChannel),
      colorLabel: colorIsMeasure ? undefined : resolveFieldLabel(input, 'color'),
    },
    narrative: input.a11y.narrative,
    fallbackSummary: input.a11y.description,
  };
}

export function generateNarrativeSummary(input: NormalizedVizSpec | AnalysisNarrativeInput): NarrativeResult {
  const { analysis, labels, narrative, fallbackSummary, measureContext } = resolveNarrativeInputs(input);

  const derived = deriveNarrativeFromData(analysis, labels, measureContext);
  const { summary, keyFindings } = applyNarrativeOverride(narrative, derived, fallbackSummary);

  return {
    status: summary.length > 0 ? 'ready' : 'insufficient-data',
    summary,
    keyFindings,
    analysis,
  } satisfies NarrativeResult;
}

/** An author-supplied narrative override (summary and/or key findings). */
export interface ProvidedNarrative {
  readonly summary?: string;
  readonly keyFindings?: readonly string[];
}

/**
 * The author-override fallback shared by the single-chart narrative
 * (generateNarrativeSummary) and the dashboard narrative (deriveDashboardNarrative):
 * an author-supplied summary/findings WINS, else the data-derived value, else the
 * fallback summary. Extracted so both paths use ONE precedence implementation
 * (sprint-115 m04) — there is no parallel override logic to drift.
 */
export function applyNarrativeOverride(
  provided: ProvidedNarrative | undefined,
  derived: { readonly summary?: string; readonly keyFindings: readonly string[] },
  fallbackSummary: string,
): { summary: string; keyFindings: readonly string[] } {
  const providedSummary = provided?.summary?.trim();
  const providedFindings = provided?.keyFindings?.filter((finding) => finding && finding.trim() !== '') ?? [];

  // s155 m04: `|| ''` guards a latent NPE the Total-suppression newly exposes — when the derived
  // summary is empty (a mixed/unknown mark whose only sentence was a now-omitted false Total) AND
  // the spec carries no a11y.description (fallbackSummary undefined), the chain was `undefined` and
  // `.trim()` threw. Fail-safe to an empty summary (status 'insufficient-data'), never a crash.
  const summary = (providedSummary || derived.summary || fallbackSummary || '').trim();
  const keyFindings = providedFindings.length > 0 ? providedFindings : derived.keyFindings;
  return { summary, keyFindings };
}

function deriveNarrativeFromData(
  analysis: VizDataAnalysis,
  labels: NarrativeLabels,
  measureContext?: MeasureNarrativeContext,
): {
  readonly summary?: string;
  readonly keyFindings: string[];
} {
  const summaryParts: string[] = [];
  switch (analysis.mark) {
    case 'line': {
      if (analysis.trend !== undefined && analysis.first && analysis.last) {
        // Trend is DEFINED (a non-faceted sequence composition): the directional sentence. A
        // genuine 'flat' trend legitimately reads "remains relatively flat" here.
        const directionLabel =
          analysis.trend === 'increasing'
            ? 'rises'
            : analysis.trend === 'decreasing'
              ? 'declines'
              : 'remains relatively flat';
        summaryParts.push(
          `${labels.chartLabel} ${directionLabel} from ${narrateNumber(analysis.first.value, 'first')} (${analysis.first.label}) to ${narrateNumber(analysis.last.value, 'last')} (${analysis.last.label}).`
        );
        if (analysis.trendDelta !== undefined && analysis.first.value !== 0) {
          const percent = analysis.trendDelta / Math.max(Math.abs(analysis.first.value), 1);
          summaryParts.push(`Overall change of ${narrateNumber(percent, 'trend-percent', formatPercent(percent))} across the period.`);
        }
      } else if (analysis.min && analysis.max) {
        // s154 F3: trend is UNDEFINED — the first→last delta was suppressed because this is a
        // FACETED line spec, where a cross-panel first→last is a phantom that sign-inverts vs every
        // real series. Emit an ORDER-INVARIANT range sentence instead of the false directional
        // "remains relatively flat", keeping A11Y-R-10 (non-empty summary for line/area) green
        // without asserting a direction the data does not support.
        summaryParts.push(
          analysis.min.value === analysis.max.value
            ? `${labels.chartLabel} holds steady at ${narrateNumber(analysis.min.value, 'extremum-min')} (${analysis.min.label}).`
            : `${labels.chartLabel} shows ${labels.measureLabel ?? 'values'} ranging from ${narrateNumber(analysis.min.value, 'extremum-min')} (${analysis.min.label}) to ${narrateNumber(analysis.max.value, 'extremum-max')} (${analysis.max.label}).`
        );
      }
      break;
    }
    case 'bar':
    case 'area': {
      if (analysis.max && analysis.min) {
        summaryParts.push(
          `${labels.chartLabel} compares ${labels.dimensionLabel ?? 'categories'}; ${analysis.max.label} leads at ${narrateNumber(analysis.max.value, 'extremum-max')} while ${analysis.min.label} is lowest at ${narrateNumber(analysis.min.value, 'extremum-min')}.`
        );
      }
      break;
    }
    case 'point': {
      if (analysis.correlation !== undefined) {
        summaryParts.push(
          `${labels.chartLabel} shows a ${describeCorrelation(analysis.correlation)} relationship between ${labels.dimensionLabel ?? 'x'} and ${labels.measureLabel ?? 'y'}.`
        );
      } else if (analysis.max && analysis.min && analysis.mean !== undefined) {
        // s151 m05b: a strip plot (one measure across a NOMINAL dimension) has no numeric-numeric
        // correlation to narrate — describe the DISTRIBUTION/SPREAD of the measure instead of
        // leaving the summary empty (which silently fell back to the static a11y.description and
        // gave the analysis no data-derived teeth). Extrema + mean, the honest strip-plot read.
        summaryParts.push(
          `${labels.chartLabel} plots ${labels.measureLabel ?? 'values'} from ${narrateNumber(analysis.min.value, 'extremum-min')} (${analysis.min.label}) to ${narrateNumber(analysis.max.value, 'extremum-max')} (${analysis.max.label}), averaging ${narrateNumber(analysis.mean, 'mean')}.`
        );
      }
      break;
    }
    default: {
      // s155 m04: the default-branch "totaling" summary is a Total claim too — gate it on the same
      // provably-additive precondition, so a non-additive measure (id/zip/max) on a mixed/unknown
      // mark does not narrate a false sum. measureAdditive undefined (non-cartesian) → unchanged.
      if (analysis.total !== undefined && analysis.rowCount > 0 && analysis.measureAdditive !== false) {
        summaryParts.push(
          `${labels.chartLabel} covers ${narrateNumber(analysis.rowCount, 'row-count', String(analysis.rowCount))} data points totaling ${narrateNumber(analysis.total, 'total')}${labels.measureLabel ? ` ${labels.measureLabel}` : ''}.`
        );
      }
    }
  }

  const keyFindings = buildKeyFindings(analysis, labels, measureContext);
  return {
    summary: summaryParts.join(' ').trim() || undefined,
    keyFindings,
  };
}

/**
 * Verbalize the governed measure context (sprint-129 m01) as ONE leading key finding —
 * the measure displayName (the existing `measureLabel`) plus the governed unit / format /
 * threshold the registry holds. Returns undefined when the context carries no governed
 * field beyond the label, so an empty `{}` measureContext stays byte-identical.
 */
export function describeMeasureContext(
  measureLabel: string | undefined,
  ctx: MeasureNarrativeContext,
): string | undefined {
  const parts = [`Measure: ${measureLabel ?? 'value'}`];
  if (ctx.unit) {
    // s161 m4 §1.9: the unit descriptor may carry digits ("1000 USD"); tag it as governed context
    // (disclosed) so the provenance sweep accounts for those digits — they are NOT narrated values.
    parts.push(`unit ${narrateFormatted('governed-unit', ctx.unit)}`);
  }
  if (ctx.format) {
    parts.push(`format ${narrateFormatted('governed-format', ctx.format)}`);
  }
  if (ctx.thresholdValue !== undefined) {
    parts.push(`threshold ${narrateNumber(ctx.thresholdValue, 'governed-threshold')}`);
  }
  // s130-m02: name the RESOLVED comparison baseline the delta was computed against. Only the
  // 'target' basis carries a static value to verbalize (prior_period/window are series-derived);
  // the `vs target N` literal is IDENTICAL to the cross-panel emit site in dashboard-narrative.ts.
  if (ctx.comparisonBasis === 'target' && ctx.comparisonValue !== undefined) {
    parts.push(`vs target ${narrateNumber(ctx.comparisonValue, 'governed-target')}`);
  }
  // Only surface when at least one governed field beyond the label is present.
  return parts.length > 1 ? parts.join('; ') : undefined;
}

function buildKeyFindings(
  analysis: VizDataAnalysis,
  labels: NarrativeLabels,
  measureContext?: MeasureNarrativeContext,
): string[] {
  const findings: string[] = [];
  const measureLabel = labels.findingMeasureLabel ?? labels.measureLabel;
  if (analysis.max) {
    findings.push(`High ${measureLabel ?? 'value'}: ${describeDataPoint(analysis.max, measureLabel, 'extremum-max')}`);
  }
  if (analysis.min && (!analysis.max || analysis.min.label !== analysis.max.label || analysis.min.value !== analysis.max.value)) {
    findings.push(`Low ${measureLabel ?? 'value'}: ${describeDataPoint(analysis.min, measureLabel, 'extremum-min')}`);
  }
  if (analysis.trend && analysis.trendDelta !== undefined) {
    const percent = analysis.first && analysis.first.value !== 0 ? analysis.trendDelta / analysis.first.value : undefined;
    findings.push(
      `Trend ${analysis.trend}: ${percent !== undefined ? narrateNumber(percent, 'trend-percent', formatPercent(percent)) : narrateNumber(analysis.trendDelta, 'trend-delta')}`
    );
  }
  // s151 m05b: a `point` mark's measure is a positional/distributional value (strip-plot font
  // sizes, scatter axes) — summing it is a meaningless aggregate ("Total Font Size Px: 147"), the
  // same phantom class F6b/s150 guarded for KPIs/heatmaps. A Total is meaningful only where the
  // measure is aggregated across a dimension (bar/area and the input-shaped default/sankey paths).
  // s155 m04 (CLAIM-ON-POSITIVE-EVIDENCE): additionally omit the Total when the measure name is not
  // PROVABLY additive (measureAdditive === false) — summing IDs / zips / per-group maxes is a false
  // aggregate (id_max→"Total Id max", sales_id→"Total Sales id"; #895 class). measureAdditive is
  // undefined for the input-shaped/pre-built-analysis paths, so `!== false` leaves them unchanged.
  if (analysis.total !== undefined && analysis.mark !== 'point' && analysis.measureAdditive !== false) {
    findings.push(`Total ${measureLabel ?? 'value'}: ${narrateNumber(analysis.total, 'total')}`);
  }
  if (analysis.colorCategories.length > 0 && labels.colorLabel) {
    findings.push(`${labels.colorLabel}: ${analysis.colorCategories.join(', ')}`);
  }
  if (analysis.correlation !== undefined) {
    // s160 m4: WAS a raw `${analysis.correlation}` template interpolation — the formatter-contract
    // bypass class the provenance sweep exists to catch (3-decimal pearson where the shared
    // formatter emits max-2-fraction). Routed through the tagged emitter; display becomes
    // formatNumeric's 2-fraction form (chartered, disclosed narrative-byte change).
    findings.push(`Correlation coefficient: ${narrateNumber(analysis.correlation, 'correlation-r')}`);
  }
  if (analysis.rowCount > 0 && findings.length === 0) {
    findings.push(`${narrateNumber(analysis.rowCount, 'row-count', String(analysis.rowCount))} rows analysed.`);
  }
  // Measure-context (sprint-129 m01) leads the findings so the governed frame is read
  // first; absent (or governed-content-free) context leaves the s128 output untouched.
  const measureFinding = measureContext
    ? describeMeasureContext(labels.measureLabel, measureContext)
    : undefined;
  const ordered = measureFinding ? [measureFinding, ...findings] : findings;
  return ordered.slice(0, 5);
}

function resolveFieldLabel(spec: NormalizedVizSpec, channel: keyof NormalizedVizSpec['encoding']): string | undefined {
  const binding = getEncodingBinding(spec, channel);
  if (!binding) {
    return undefined;
  }
  if (binding.title && binding.title.trim() !== '') {
    return binding.title;
  }
  if (binding.field && binding.field.trim() !== '') {
    return humanize(binding.field);
  }
  return undefined;
}

function resolveFindingMeasureLabel(
  spec: NormalizedVizSpec,
  channel: keyof NormalizedVizSpec['encoding'],
  measureLabel: string | undefined,
): string | undefined {
  const binding = getEncodingBinding(spec, channel);
  if (binding?.aggregate !== 'count') {
    return measureLabel;
  }
  // The builder synthesizes humanize(field) when no title was authored; that default still names
  // the counted identity, so only a non-default title supplies the grouping-context alternative.
  const authoredTitle = binding.title?.trim();
  const synthesizedFieldTitle = binding.field ? humanize(binding.field) : undefined;
  return authoredTitle && authoredTitle !== synthesizedFieldTitle ? authoredTitle : 'Count';
}

function describeCorrelation(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 0.75) {
    return value >= 0 ? 'strong positive' : 'strong negative';
  }
  if (magnitude >= 0.4) {
    return value >= 0 ? 'moderate positive' : 'moderate negative';
  }
  return value >= 0 ? 'weak positive' : 'weak negative';
}
