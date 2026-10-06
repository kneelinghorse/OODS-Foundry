import { tokenCssReference } from '../lib/token-build.js';
// viz.render — the Phase-0 "reconnect" handler (sprint-109 m04).
//
// Turns inline rows (or a cached datasetRef) into a REAL, data-bound Vega-Lite
// spec (ECharts opt-in) via the headless @oods/viz-core engine. This replaces
// the retired field-names-only scaffold: it imports ONLY from
// @oods/viz-core and never touches the placeholder compose/viz-trait-resolver.
//
// Input is AJV-validated against viz.render.input.json before dispatch; output
// is validated against viz.render.output.json after return (so the shape here
// must stay additionalProperties-clean).

import { assertHcSvgPaints } from './hc-svg-paints.js';
import {
  adaptChordToECharts,
  adaptGraphToECharts,
  adaptSankeyToECharts,
  adaptSunburstToECharts,
  adaptTreemapToECharts,
  applyPatternPresentation,
  buildFromIntent,
  buildVizSpecFromRows,
  convertToEChartsTreeData,
  describeMeasureContext,
  generateAccessibleTable,
  generateNarrativeSummary,
  toEChartsOption,
  toVegaLiteSpec,
  translatePattern,
  validateVizEquivalenceRules,
  withCappedYTicks,
  withRenderWidthLabels,
  type AccessibleTableResult,
  type BuildVizSpecInput,
  type BuildVizSpecResult,
  type HierarchyInput,
  type MeasureNarrativeContext,
  type NarrativeResult,
  type NetworkInput,
  type NormalizedVizSpec,
  type PatternPresentation,
  type SankeyInput,
  type StructuredIntent,
} from '@oods/viz-core';
import { canonicalize, sha256 } from '@oods/artifacts';
import { isHexColor } from '@oods/a11y-tools';
import { ECHARTS_SSR_DIMENSIONS, normalizeEChartsSvg, renderEChartsToSvg, renderVegaLiteToSvg, renderVegaLiteWithSpec, type VegaLiteSpec } from '@oods/viz-render';
import type { VizRenderInput, VizRenderOutput } from '../schemas/generated.js';
import {
  ECHARTS_PRIMARY,
  isEChartsPrimaryType,
  type EChartsPrimaryConfig,
  type EChartsPrimaryType,
} from './echarts-primary.js';
// Geo option building + F4 link integrity were lifted to their own modules in
// sprint-172 m01 so artifact.certify drives the SAME builder and the SAME V147 check
// (see each file's header). viz.render's behaviour is unchanged by the lift — its geo
// goldens are the proof.
import { renderGeoOption, type GeoBranch } from './echarts-geo-option.js';
import { buildEChartsA11yContext } from './echarts-a11y-analysis.js';
import { danglingLinkError, findDuplicateLinks, type LinkRef } from './echarts-link-integrity.js';
import { createValueRef, describeSchemaRef, resolveValueRef, unavailableRefWords } from './schema-ref.js';
import { absentFields, referencedEncodingFields } from './field-presence.js';
import { loadMeasureRegistry, MalformedMeasureRegistryError } from './measure-registry.js';

type Issue = VizRenderOutput['warnings'][number];

// ---- F5 explicit color range (sprint-147) validation helpers ----
// A color binding may be a bare string (shorthand for { field }) or an object; an
// explicit `range` is valid only on the object variant (colorEncodingBinding, m02).

/** The explicit color `range` (hex[]), if the color encoding carries one. */
function extractColorRange(encodings: VizRenderInput['encodings']): string[] | undefined {
  const color = encodings?.color;
  if (color && typeof color === 'object' && Array.isArray((color as { range?: unknown }).range)) {
    return (color as { range: string[] }).range;
  }
  return undefined;
}

/** The field name bound to the color channel (bare-string or object binding). */
function colorFieldName(encodings: VizRenderInput['encodings']): string | undefined {
  const color = encodings?.color;
  if (typeof color === 'string') {
    return color;
  }
  if (color && typeof color === 'object') {
    return (color as { field?: string }).field;
  }
  return undefined;
}

// Cartesian color-range warnings (F5). All WARN — the chart still renders; each is a
// declared-intent-vs-outcome mismatch the agent should see rather than have silently
// swallowed. `compiledColorRange` is scale.range read off the compiled Vega-Lite spec,
// so "applied" is measured from the real output, not re-inferred.
// Exported for unit testing (s149 #853b): the empty-range early-return closes the
// misattribution coupled with #853a, but `range: []` is AJV-unreachable through `handle`
// (schema minItems:2), so it can only be exercised by calling this pure fn directly.
export function cartesianColorRangeWarnings(
  range: string[],
  colorField: string | undefined,
  rows: ReadonlyArray<Record<string, unknown>>,
  compiledColorRange: unknown,
): VizRenderOutput['warnings'] {
  const warnings: VizRenderOutput['warnings'] = [];

  // s149 #853b (coupled with #853a): an EMPTY range is a no-op override — the bake
  // step-aside is now length-based, so `range: []` bakes the default OODS palette
  // normally. Return before the rangeApplied check: with the palette baked,
  // compiledColorRange (6 slots) !== range.length (0) would make rangeApplied false and
  // fire V145, FALSELY blaming a "continuous scale" for a categorical one. There is
  // nothing to warn about when no colors were actually supplied. (AJV minItems:2 makes
  // range:[] unreachable over MCP; this guards the direct-handler / viz-core path.)
  if (range.length === 0) {
    return warnings;
  }

  // V144 (belt-and-suspenders to the schema pattern): a non-hex entry. AJV is the
  // primary gate; this defends the direct-handler path so a non-hex range that would
  // make certify's hexToRgb throw -> contrast 'unchecked' -> a silent conformant:true
  // is surfaced instead.
  const badColors = range.filter((color) => !isHexColor(color));
  if (badColors.length > 0) {
    warnings.push({
      code: 'OODS-V144',
      message: `Color range contains ${badColors.length} non-hex value(s): ${badColors.join(', ')}. Use #RGB or #RRGGBB hex colors.`,
      severity: 'warning',
    });
  }

  const rangeApplied =
    Array.isArray(compiledColorRange) &&
    compiledColorRange.length === range.length &&
    compiledColorRange.every((color, i) => color === range[i]);

  if (!rangeApplied) {
    // The color channel resolved to a continuous (quantitative/temporal) scale, so
    // the categorical range was dropped (gradient shown instead). Never silent — V145
    // as a warning (the surface can't consume a categorical range; here it degrades
    // gracefully rather than the fail-loud ECharts-primary variant).
    warnings.push({
      code: 'OODS-V145',
      message:
        'Color range was ignored: an explicit range applies only to a categorical (nominal/ordinal) color scale, but this color channel resolved to a continuous scale. Set encodings.color.type to "nominal" or "ordinal" to use the range.',
      severity: 'warning',
    });
  } else if (colorField) {
    // V143: the applied range is shorter than the distinct series count, so Vega
    // recycles domain[i]->range[i] mod len (two+ series share a color).
    const distinctCount = new Set(rows.map((row) => row[colorField])).size;
    if (range.length < distinctCount) {
      warnings.push({
        code: 'OODS-V143',
        message: `Color range has ${range.length} colors but "${colorField}" has ${distinctCount} distinct series; colors will recycle (domain[i]->range[i] mod ${range.length}). Provide at least ${distinctCount} colors for an unambiguous encoding.`,
        severity: 'warning',
      });
    }
  }

  return warnings;
}

// F3 never-cycle WARN (sprint-148 m03, OODS-V146). A categorical ECharts-primary
// chart colors each distinct group by palette[index % palette.length]; when the
// distinct-group count exceeds the baked palette, two+ groups silently share a color
// (CIEDE2000 = 0 between two arcs) — invisible to certify's s141 data-independent
// palette-constant grade. Emit ONE V146 WARN. Mirrors cartesianColorRangeWarnings
// (F5): all WARN, the chart still renders. READ-ONLY on echartsOption, so contentHash
// (:609) / specRef (:600) stay byte-unchanged.
function neverCycleWarnings(
  chartType: EChartsPrimaryType,
  branchData: unknown,
  echartsOption: Record<string, unknown>,
): VizRenderOutput['warnings'] {
  // Geo (choropleth/bubble_map/flow_map) has no categorical palette cycling: it colors
  // via visualMap and carries NO top-level color:palette. Guard by chartType FIRST and
  // bail BEFORE reading echartsOption.color — an unconditional (echartsOption.color as
  // string[]).length on geo is undefined.length and would throw (amendment 2).
  if (chartType === 'choropleth' || chartType === 'bubble_map' || chartType === 'flow_map') {
    return [];
  }

  // The distinct-color-slot count is NOT the pre-computed nodeCount (viz.render.ts:488)
  // for 3 of 5 types — it is the per-type cardinality the ADAPTER actually colors by
  // (memo §2).
  let count: number;
  if (chartType === 'chord' || chartType === 'sankey') {
    // chord/sankey color every node by index (chord buildNodes / sankey transformNodes).
    count = (branchData as SankeyInput).nodes.length;
  } else if (chartType === 'force_graph') {
    // force_graph colors by distinct GROUP (graph-adapter buildCategories over
    // extractCategoryNames — a Set of non-empty strings), NOT node count; replicated
    // inline (memo m01: zero viz-core churn). No groups -> the adapter applies no
    // per-category palette color, so there is nothing to recycle: skip.
    const groups = new Set<string>();
    for (const node of (branchData as NetworkInput).nodes) {
      const group = node.group;
      if (typeof group === 'string' && group.length > 0) {
        groups.add(group);
      }
    }
    if (groups.size === 0) {
      return [];
    }
    count = groups.size;
  } else {
    // treemap/sunburst color the FIRST-VISIBLE LEVEL (assignColorsToData): a single root
    // with children colors the children; otherwise it colors each top-level node. Count
    // that same level over the exported convertToEChartsTreeData — drift-safe (the count
    // tracks whatever the adapter builds), NOT the total descendant count.
    const tree = convertToEChartsTreeData(branchData as HierarchyInput);
    count =
      tree.length === 1 && Array.isArray(tree[0].children) && (tree[0].children as unknown[]).length > 0
        ? (tree[0].children as unknown[]).length
        : tree.length;
  }

  // Threshold = the palette the adapter actually baked onto option.color (6 in prod;
  // the no-token fallback cycles at 8/9). Reading the applied length is robust to both
  // (NOT a hardcoded 6, NOT getVizScaleTokens('categorical').length — amendment 4).
  const palette = echartsOption.color;
  const threshold = Array.isArray(palette) ? palette.length : 0;
  if (threshold > 0 && count > threshold) {
    return [
      {
        code: 'OODS-V146',
        message: `Categorical palette recycles: ${count} distinct color groups exceed the ${threshold}-slot OODS palette, so palette[i % ${threshold}] repeats a color (two+ groups become indistinguishable). Reduce the categories to ${threshold} or fewer, or expect colliding colors.`,
        severity: 'warning',
      },
    ];
  }
  return [];
}

// F4 link integrity (sprint-148 m04, chord + force_graph) now lives in
// ./echarts-link-integrity.ts (sprint-172 m01) so certify replays the SAME V147 check.

export async function handle(input: VizRenderInput): Promise<VizRenderOutput> {
  let presentation: PatternPresentation | undefined;
  let scene: BuildVizSpecResult | undefined;
  if (Object.hasOwn(input, 'pattern')) {
    const conflicts = ['chartType', 'encodings', 'rows', 'datasetRef', 'intent', 'hierarchy', 'sankey', 'chord', 'network', 'geo', 'id', 'name', 'description', 'opacity']
      .filter(field => Object.hasOwn(input, field));
    if (conflicts.length) return errorOut('OODS-V166', `viz.render: pattern cannot be combined with ${conflicts.join(', ')}; the source identity, data and presentation must remain intact.`, input.output?.compact ?? true, input.output?.echarts ?? false);
    let translated: ReturnType<typeof translatePattern>;
    try { translated = translatePattern(input.pattern!); }
    catch (error) { return errorOut('OODS-V123', `viz.render: ${error instanceof Error ? error.message : String(error)}`, input.output?.compact ?? true, input.output?.echarts ?? false); }
    if (translated.status === 'authoring-only') return errorOut('OODS-V167', `viz.render: pattern "${input.pattern}" is authoring-only: ${translated.reasons.join('; ')}`, input.output?.compact ?? true, input.output?.echarts ?? false);
    if (translated.status === 'retired') return errorOut('OODS-V174', `viz.render: pattern "${input.pattern}" is retired: ${translated.reasons.join('; ')}`, input.output?.compact ?? true, input.output?.echarts ?? false);
    const { pattern: _pattern, ...controls } = input;
    if (translated.status === 'scene') {
      scene = { spec: translated.spec, chartType: translated.baseChartType, mode: 'explicit' };
      input = { ...controls, chartType: translated.baseChartType, rows: translated.spec.data.values } as VizRenderInput;
    } else {
    input = { ...controls, ...translated.explicitInput } as VizRenderInput;
    presentation = translated.presentation;
    }
  }
  const out = await renderSpec(input, presentation, scene);
  if (out.status !== 'ok' || (!input.output?.svg && !(input.output?.includeVegaSpec && !isEChartsPrimaryType(input.chartType)))) return out;

  try {
    const { width, height } = input.output;
    const engine = isEChartsPrimaryType(input.chartType) ? 'echarts' : 'vega-lite';
    // The public bytes use the same render legs as certification. Cartesian
    // defaults are intrinsic dimensions; ECharts returns normalized bytes so
    // svgHash always hashes exactly the payload cached by svgRef.
    // s222-m02 (#2502 ruling 12): size the labels and cap y ticks before compiling the spec to be drawn.
    const renderSpec = engine === 'vega-lite' ? (width !== undefined || height !== undefined
      ? withCappedYTicks(width !== undefined ? withRenderWidthLabels(out.spec!, width) : out.spec!)
      : out.spec) as unknown as VegaLiteSpec : undefined;
    const rendered = engine === 'echarts'
      ? { svg: normalizeEChartsSvg(await renderEChartsToSvg(out.echartsSpec!, {
          width: width ?? ECHARTS_SSR_DIMENSIONS.width,
          height: height ?? ECHARTS_SSR_DIMENSIONS.height,
        })) }
      : input.output?.includeVegaSpec
        ? await renderVegaLiteWithSpec(renderSpec!, { width, height })
        : { svg: await renderVegaLiteToSvg(renderSpec!, { width, height }) };
    const { svg } = rendered;
    assertHcSvgPaints(svg, input);
    if (input.output?.includeVegaSpec && 'vegaSpec' in rendered) {
      out.vegaSpec = rendered.vegaSpec as Record<string, unknown>;
      out.output = { ...out.output!, includeVegaSpec: true };
    }
    if (!input.output?.svg) return out;
    const root = /^<svg\b[^>]*>/.exec(svg)?.[0];
    const renderedWidth = Number(root?.match(/\bwidth="([\d.]+)"/)?.[1]);
    const renderedHeight = Number(root?.match(/\bheight="([\d.]+)"/)?.[1]);
    if (!root || !(renderedWidth > 0) || !(renderedHeight > 0)) {
      throw new Error('Renderer returned an SVG without readable positive dimensions.');
    }
    out.svg = svg;
    out.svgHash = sha256(svg);
    out.svgBytes = Buffer.byteLength(svg, 'utf8');
    out.svgRef = describeSchemaRef(createValueRef(svg, 'viz.render')).ref;
    out.render = { engine, width: renderedWidth, height: renderedHeight, theme: input.theme ?? 'light', brand: input.brand ?? 'A' };
    out.output = { ...out.output!, svg: true, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) };
    return out;
  } catch (error) {
    return errorOut('OODS-V165', `SVG rendering failed: ${error instanceof Error ? error.message : String(error)}`, input.output?.compact ?? true, input.output?.echarts ?? false);
  }
}

async function renderSpec(input: VizRenderInput, presentation?: PatternPresentation, scene?: BuildVizSpecResult): Promise<VizRenderOutput> {
  const compact = input.output?.compact ?? true;
  const wantEcharts = input.output?.echarts ?? false;
  const includeNormalized = input.output?.includeNormalizedSpec ?? false;
  const includeA11y = input.output?.includeA11y ?? false;

  if (input.opacity !== undefined && (!Number.isFinite(input.opacity) || input.opacity < 0 || input.opacity > 1 || isEChartsPrimaryType(input.chartType))) {
    return errorOut('OODS-V123', 'opacity must be a finite number between 0 and 1 and is supported only for Cartesian charts.', compact, wantEcharts);
  }

  // intent ⊕ chartType (sprint-131 m03): a structured intent carries its own
  // `chartFamily`, not the explicit-render `chartType`; the two are mutually
  // exclusive dispatch modes. Fail loud (Rule 12) rather than silently letting the
  // explicit-render branch below swallow the intent.
  if (input.intent && input.chartType) {
    return errorOut(
      'OODS-V123',
      'viz.render: `intent` and `chartType` are mutually exclusive — `intent` carries `chartFamily`, not the explicit-render `chartType`.',
      compact,
      wantEcharts,
    );
  }

  // ---- hierarchy/network branch (sprint-111): treemap/sunburst/sankey (force
  // lands in m04) are EXPLICIT-ONLY and DECOUPLED — each carries a dedicated data
  // branch (hierarchy or sankey, not rows) and has no Vega-Lite equivalent, so the
  // ECharts option is the PRIMARY payload. The schema couples each chartType with
  // its data branch, so the chartType check is sufficient to dispatch. ----
  if (isEChartsPrimaryType(input.chartType)) {
    return renderEChartsPrimary(input, input.chartType, compact, includeNormalized, includeA11y);
  }

  // ---- resolve data: inline rows (primary) or a cached datasetRef ----
  let rows: Array<Record<string, unknown>>;
  if (Array.isArray(input.rows) && input.rows.length > 0) {
    rows = input.rows as Array<Record<string, unknown>>;
  } else if (typeof input.datasetRef === 'string' && input.datasetRef.length > 0) {
    const resolved = resolveValueRef(input.datasetRef);
    if (!resolved.ok) {
      return errorOut(
        resolved.reason === 'missing' ? 'OODS-V123' : 'OODS-V124',
        `Dataset reference "${input.datasetRef}" ${unavailableRefWords(resolved.reason)}; references live only in the server that issued them, for a limited time. Pass the rows inline in the rows field.`,
        compact,
        wantEcharts,
      );
    }
    if (!Array.isArray(resolved.value) || resolved.value.length === 0) {
      return errorOut(
        'OODS-V125',
        `Dataset reference "${input.datasetRef}" did not resolve to a non-empty rows array.`,
        compact,
        wantEcharts,
      );
    }
    rows = resolved.value as Array<Record<string, unknown>>;
  } else {
    // AJV oneOf guarantees exactly one of rows/datasetRef; defensive fallback.
    return errorOut('OODS-V123', 'Provide either inline rows or a datasetRef.', compact, wantEcharts);
  }

  // strictFields (sprint-118 m05): surface a tabular encoding field that is absent from every
  // row as OODS-V131 (WARN) instead of a silent confident-wrong spec. Scoped to the tabular
  // rows+encodings path (the hierarchy/sankey/geo branches returned earlier). Default false ⇒
  // warnings stays []. The dashboard.render strict check escalates V131 to an error panel.
  const fieldWarnings: VizRenderOutput['warnings'] = input.strictFields
    ? absentFields(rows, referencedEncodingFields(input.encodings)).map((field) => ({
        code: 'OODS-V131',
        message: `Referenced field "${field}" is absent from the data rows.`,
        severity: 'warning' as const,
      }))
    : [];

  // ---- governed-measure overlay (sprint-131 m03): resolve intent.measureRef ----
  // measureRef is NARRATIVE-ONLY (it does NOT drive encoding — buildFromIntent is
  // measure-agnostic). Resolution + the unknown-ref hard-error fire whenever a
  // measureRef is present (a bad ref is a caller error regardless of includeA11y —
  // Rule 12, fail loud); only the VERBALIZATION below is includeA11y-gated. Mirrors
  // the dashboard.render CHART path (governance consistency across the two tools):
  // V132 (malformed registry, fail-closed) and V130 (unknown measure) are the same
  // hard-error seam KPI/chart panels use — never a silent narrative-less render.
  let measureProjection: { displayName?: string; context: MeasureNarrativeContext } | undefined;
  if (input.intent?.measureRef) {
    let registry: ReturnType<typeof loadMeasureRegistry>;
    try {
      registry = loadMeasureRegistry();
    } catch (err) {
      if (err instanceof MalformedMeasureRegistryError) {
        return errorOut('OODS-V132', err.message, compact, wantEcharts);
      }
      throw err;
    }
    const entry = registry.get(input.intent.measureRef);
    if (!entry) {
      return errorOut(
        'OODS-V130',
        `Unknown governed measure "${input.intent.measureRef}" (no such entry in the measure registry).`,
        compact,
        wantEcharts,
      );
    }
    measureProjection = {
      ...(entry.displayName !== undefined ? { displayName: entry.displayName } : {}),
      context: {
        ...(entry.unit !== undefined ? { unit: entry.unit } : {}),
        ...(entry.format !== undefined ? { format: entry.format } : {}),
        ...(entry.defaultThreshold?.value !== undefined ? { thresholdValue: entry.defaultThreshold.value } : {}),
        ...(entry.defaultComparison?.basis !== undefined ? { comparisonBasis: entry.defaultComparison.basis } : {}),
        ...(entry.defaultComparison?.value !== undefined ? { comparisonValue: entry.defaultComparison.value } : {}),
      },
    };
  }

  // ---- build the NormalizedVizSpec + compile to the renderer payload ----
  try {
    // intent dispatch (sprint-131 m03): a structured intent routes through the
    // deterministic buildFromIntent (recommender pick under the named fields + goal);
    // intent-absent is the byte-identical pre-s131 buildVizSpecFromRows path.
    const rawBuilt = scene ?? (input.intent
      ? buildFromIntent({
          intent: input.intent as StructuredIntent,
          rows,
          id: input.id,
          name: input.name,
          description: input.description,
        })
      : buildVizSpecFromRows({
          rows,
          chartType: input.chartType,
          encodings: input.encodings as BuildVizSpecInput['encodings'],
          id: input.id,
          name: input.name,
          description: input.description,
        }));

    // The source presentation is applied to fresh builder IR and validated by
    // viz-core before adapters, a11y gates, hashes and certification observe it.
    const built = presentation ? { ...rawBuilt, spec: applyPatternPresentation(rawBuilt.spec, presentation) } : rawBuilt;
    // A placed chart's name belongs to the figure heading: the IR records the placement so the SVG carries no
    // painted title and artifact.certify, replaying the normalized spec, renders the same bytes.
    if (input.output?.titlePlacement === 'figure') built.spec.config = { ...(built.spec.config ?? {}), title: { placement: 'figure' } };

    // Public heatmap defaults are explicit in the normalized IR so certify replays
    // the same sequential palette. Authored pattern presentation remains authoritative.
    if (!presentation && !scene && built.chartType === 'heatmap') {
      for (const mark of built.spec.marks) mark.options = { ...mark.options, colorScheme: 'sequential' };
    }

    if (input.opacity !== undefined) {
      for (const mark of built.spec.marks) {
        mark.options = {
          ...mark.options,
          opacity: input.opacity,
          itemStyle: { ...mark.options?.itemStyle as Record<string, unknown>, opacity: input.opacity },
          ...(mark.trait === 'MarkLine' || mark.trait === 'MarkArea' ? { lineStyle: { ...mark.options?.lineStyle as Record<string, unknown>, opacity: input.opacity } } : {}),
          ...(mark.trait === 'MarkArea' ? { areaStyle: { ...mark.options?.areaStyle as Record<string, unknown>, opacity: input.opacity } } : {}),
        };
      }
    }
    const spec = toVegaLiteSpec(built.spec, input) as unknown as VizRenderOutput['spec'];

    // F5 explicit color range warnings (sprint-147 m03): all WARN, never blocking.
    // Measured against the COMPILED scale.range so "applied vs dropped" reflects reality.
    const colorRange = extractColorRange(input.encodings);
    const rangeWarnings: VizRenderOutput['warnings'] = colorRange
      ? cartesianColorRangeWarnings(
          colorRange,
          colorFieldName(input.encodings),
          rows,
          (spec as Record<string, unknown> as { encoding?: { color?: { scale?: { range?: unknown } } } })
            .encoding?.color?.scale?.range,
        )
      : [];

    // OODS-V161 (sprint-176 m03a): the DEFAULT baked palette warns on recycling. The F5
    // family covers only an AGENT-SUPPLIED colorRange (V143's message says "provide at
    // least N colors"), so the default six-hex baked range could exhaust silently — the
    // §0 defect's viz.render half: 10 series compile to a domainless 6-hex scale.range
    // and Vega recycles range[i mod 6] with warnings:[]. Fires only when the agent
    // supplied NO explicit range; reads the color field + APPLIED range off the COMPILED
    // spec exactly as F5 does (threshold = the applied palette length, never a hardcoded
    // 6). Read-only on the spec: contentHash/specRef stay byte-unchanged. Message
    // mirrors V146's count+threshold shape.
    const neverCycleWarnings161: VizRenderOutput['warnings'] = [];
    if (!colorRange) {
      const compiledColor = (
        spec as Record<string, unknown> as {
          encoding?: { color?: { field?: unknown; scale?: { range?: unknown } } };
        }
      ).encoding?.color;
      const appliedRange = compiledColor?.scale?.range;
      const compiledField = compiledColor?.field;
      if (
        typeof compiledField === 'string' &&
        Array.isArray(appliedRange) &&
        appliedRange.length > 0 &&
        appliedRange.every((hex) => typeof hex === 'string')
      ) {
        const distinct = new Set(rows.map((row) => row[compiledField])).size;
        const threshold = appliedRange.length;
        if (distinct > threshold) {
          neverCycleWarnings161.push({
            code: 'OODS-V161',
            message: `Baked categorical palette recycles: ${distinct} distinct "${compiledField}" series exceed the ${threshold}-slot baked OODS palette, so scale.range[i % ${threshold}] repeats a color (two+ series become indistinguishable, and certify fails the collision). Reduce the series to ${threshold} or fewer, or supply an explicit colorRange with at least ${distinct} colors.`,
            severity: 'warning',
          });
        }
      }
    }

    // A11y equivalence CERTIFY-AT-EMISSION (sprint-134 m03): when a11yEquivalence is on,
    // run the 16-rule accessible-equivalence engine over the SAME built.spec the chart
    // renders from and surface every failing rule as a SOFT WARNING — never assertVizEquivalence
    // (which throws on error-severity), never a gate. severity is FORCED to 'warning' regardless
    // of the rule's intrinsic 'error'|'warn' (the gate-flip is a future slice; warn-mode is the
    // instrument that measures how often the engine fires on real emissions). Cartesian-only:
    // this is the Vega path; the ECharts-primary path (empty-data scaffold) is intentionally excluded.
    // Default-on (sprint-135 m03) ⇒ the engine runs on every cartesian emission; the
    // builder is conformant-by-construction (m02) so generated specs surface no findings.
    // Set a11yEquivalence:false to opt out for agent-supplied non-conformant specs.
    const wantA11yEquivalence = input.a11yEquivalence ?? true;
    const a11yRuleFailures = wantA11yEquivalence
      ? validateVizEquivalenceRules(built.spec).filter((rule) => !rule.passed)
      : [];
    // Partition by the rule TABLE severity (NOT the forced-'warning' the s134 wire used, and NOT
    // assertVizEquivalence which throws → caught below → coerced to OODS-V129, losing per-rule
    // codes): warn-severity failures surface in warnings[]; error-severity failures BLOCK
    // (sprint-135 m04). Each issue keeps its own OODS-<rule.id> code.
    const a11yEquivalenceWarnings: VizRenderOutput['warnings'] = a11yRuleFailures
      .filter((rule) => rule.severity !== 'error')
      .map((rule) => ({
        code: `OODS-${rule.id}`,
        message: rule.message ?? rule.summary,
        severity: 'warning' as const,
      }));
    const a11yEquivalenceErrors: Issue[] = a11yRuleFailures
      .filter((rule) => rule.severity === 'error')
      .map((rule) => ({
        code: `OODS-${rule.id}`,
        message: rule.message ?? rule.summary,
        severity: 'error' as const,
      }));
    if (a11yEquivalenceErrors.length > 0) {
      // BLOCKED: an accessible-equivalence error rule failed. The builder is conformant-by-
      // construction (m02), so this only fires on agent-supplied data/encoding problems the
      // builder cannot fix (e.g. R-12 an encoding field absent from the rows). Preserve every
      // per-rule code + the warn-severity a11y findings + field warnings; omit contentHash.
      return a11yErrorOut(
        a11yEquivalenceErrors,
        [...fieldWarnings, ...a11yEquivalenceWarnings, ...rangeWarnings],
        compact,
        wantEcharts,
      );
    }

    const out: VizRenderOutput = {
      status: 'ok',
      chartType: built.chartType,
      // The intent path is recommender-driven, so it reports the existing 'suggest' wire
      // mode (the chart was SUGGESTED under the named-field constraints) — keeping the
      // output schema's mode enum unchanged (#564 / the memo's zero-output-schema-change
      // commitment). The agent's full visibility into the pick rides the suggestion +
      // lowConfidence channel below; the internal builder mode ('intent') is a viz-core detail.
      mode: built.mode === 'intent' ? 'suggest' : built.mode,
      spec,
      a11yDescription: built.spec.a11y.description,
      warnings: [...fieldWarnings, ...a11yEquivalenceWarnings, ...rangeWarnings, ...neverCycleWarnings161, ...(scene?.spec.interactions?.length ? [{ code: 'OODS-V175', message: 'Static SVG shows the default selection state; interactive behavior requires a client renderer.', severity: 'warning' as const }] : [])],
      output: {
        compact,
        ...(wantEcharts ? { echarts: true } : {}),
        ...(includeNormalized ? { includeNormalizedSpec: true } : {}),
        ...(includeA11y ? { includeA11y: true } : {}),
      },
      meta: {
        renderer: 'vega-lite',
        mark: built.spec.marks[0]?.trait,
        rowCount: rows.length,
        fields: collectFieldNames(rows),
        ...(built.inferredFields
          ? {
              // Project the full data-aware profile (every key is enumerated in
              // the output schema's inferredFields item; FieldProfile carries no
              // extra keys, so the spread stays additionalProperties-clean).
              inferredFields: built.inferredFields.map((f) => ({ ...f })),
            }
          : {}),
      },
    };

    if (built.suggestion) {
      // Map explicitly (NOT a spread of built.suggestion) so the engine's
      // internal `signals` is surfaced as `rationale` and never leaks an
      // unschema'd key; attach the normalized confidence + runner-up alternatives.
      out.suggestion = {
        patternId: built.suggestion.patternId,
        score: built.suggestion.score,
        rationale: [...built.suggestion.signals],
        confidence: normalizeConfidence(built.suggestion.score),
        ...(built.alternatives && built.alternatives.length > 0
          ? { alternatives: built.alternatives.map((a) => ({ ...a })) }
          : {}),
      };
    }
    if (built.lowConfidence !== undefined) {
      out.lowConfidence = built.lowConfidence;
    }
    if (includeNormalized) {
      out.normalizedSpec = built.spec as unknown as VizRenderOutput['normalizedSpec'];
    }
    if (wantEcharts) {
      out.echartsSpec = toEChartsOption(built.spec, input) as unknown as VizRenderOutput['echartsSpec'];
    }
    if (compact) {
      out.tokenCssRef = tokenCssReference();
    }
    if (includeA11y) {
      // Structured a11y from the SAME spec the chart renders from (cartesian path
      // unchanged: the generators run analyzeVizSpec on built.spec, byte-identical).
      out.a11y = toWireA11y(generateAccessibleTable(built.spec), generateNarrativeSummary(built.spec));
      // Governed-measure overlay (sprint-131 m03): when the intent named a governed
      // measureRef, PREPEND the s130 measure-context clause ('unit …', 'vs target …') as the
      // leading keyFinding — mirroring the dashboard.render chart path (dashboard.render.ts
      // measure prepend). measureRef-absent leaves this call byte-identical to today (#564).
      if (measureProjection && out.a11y.narrative) {
        const measureFinding = describeMeasureContext(measureProjection.displayName, measureProjection.context);
        if (measureFinding) {
          out.a11y = {
            ...out.a11y,
            narrative: {
              ...out.a11y.narrative,
              keyFindings: [measureFinding, ...out.a11y.narrative.keyFindings],
            },
          };
        }
      }
    }

    // specRef for downstream pipeline reuse.
    const record = createValueRef(spec, 'viz.render');
    const ref = describeSchemaRef(record);
    out.specRef = ref.ref;
    out.specRefCreatedAt = ref.createdAt;
    out.specRefExpiresAt = ref.expiresAt;

    // contentHash = the deterministic content IDENTITY of exactly what specRef
    // caches (the compiled Vega-Lite spec). Default-on; stable across calls
    // (sprint-134 m02). specRef is the random/expiring handle; this is the hash.
    out.contentHash = sha256(canonicalize(spec));

    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : 'Error';
    const code =
      name === 'VizSpecBuilderError'
        ? 'OODS-V126'
        : name === 'VegaLiteAdapterError'
          ? 'OODS-V127'
          : name === 'EChartsAdapterError'
            ? 'OODS-V128'
            : 'OODS-V129';
    return errorOut(code, message, compact, wantEcharts);
  }
}

// ---- ECharts-primary render path (sprint-111 m02 treemap; m03 sunburst+sankey) -
// The type table + classifier were lifted to ./echarts-primary.ts (sprint-136 m02)
// so artifact.certify shares the same source of truth (see that file's header).

function renderEChartsPrimary(
  input: VizRenderInput,
  chartType: EChartsPrimaryType,
  compact: boolean,
  includeNormalized: boolean,
  includeA11y: boolean,
): VizRenderOutput {
  const config = ECHARTS_PRIMARY[chartType];

  // The registered schema couples each chartType with its required data branch (AJV
  // runs before dispatch); this guard is defensive for direct callers.
  const branchData = (input as Record<string, unknown>)[config.dataBranch];
  if (!branchData) {
    return errorOut(
      'OODS-V123',
      `chartType "${chartType}" requires a "${config.dataBranch}" data branch.`,
      compact,
      false,
    );
  }

  // V145 (sprint-147 m03, Fork D): an explicit color `range` is a CARTESIAN-only
  // capability. None of the ECharts-primary types consume encodings.color.range —
  // their adapters build from a dedicated data branch, not the color channel, so the
  // range would be silently dropped. Fail loud (never silently ignore an agent's
  // declared range) with the allowed surfaces named (actionable failure guidance).
  if (extractColorRange(input.encodings)) {
    return errorOut(
      'OODS-V145',
      `Color range is not supported on chartType "${chartType}". An explicit \`encodings.color.range\` overrides the categorical palette on the CARTESIAN color channel only (bar, line, area, scatter, heatmap). Remove the range or use a cartesian chartType.`,
      compact,
      false,
    );
  }

  // F4 link integrity (sprint-148 m04): chord + force_graph ONLY, PRE-DISPATCH. A link
  // naming a non-existent node FAILS LOUD (V147 — never build an option over a broken
  // ref); an exact duplicate directed link WARNs (V148, surfaced below on the combined
  // warnings). chord keys nodes by `name`, force_graph by `id`. sankey is OUT of F4
  // scope (memo §6): it keeps its adapter throw -> V126 (:617) and emits NO V148.
  let duplicateLinkWarnings: VizRenderOutput['warnings'] = [];
  if (chartType === 'chord' || chartType === 'force_graph') {
    const graph = branchData as { nodes?: unknown; links?: unknown };
    const links = (Array.isArray(graph.links) ? graph.links : []) as LinkRef[];
    const dangling = danglingLinkError(chartType, branchData);
    if (dangling) {
      return errorOut(dangling.code, dangling.message, compact, false);
    }
    // Surviving links (no dangling ref reached here): duplicate directed pairs WARN.
    duplicateLinkWarnings = findDuplicateLinks(links).map((dup) => ({
      code: 'OODS-V148',
      message: `Duplicate link "${dup.source}" -> "${dup.target}" appears ${dup.count} times. A directed (source, target) pair must be unique — duplicates double-count the ${chartType === 'chord' ? 'ribbon' : 'edge'}. Merge them into one link.`,
      severity: 'warning' as const,
    }));
  }

  try {
    const spec = buildEChartsPrimarySpec(input, chartType, config);
    // The placed-chart placement applies to the ECharts-primary families too: the figure heading names the chart.
    if (input.output?.titlePlacement === 'figure') spec.config = { ...(spec.config ?? {}), title: { placement: 'figure' } };

    let option: ReturnType<typeof adaptTreemapToECharts>;
    let nodeCount: number;
    if (chartType === 'sankey') {
      const sankey = branchData as unknown as SankeyInput;
      option = adaptSankeyToECharts(spec, sankey, input);
      nodeCount = sankey.nodes.length;
    } else if (chartType === 'chord') {
      // chord rides the dedicated 'chord' branch (sankey-shaped: required
      // source/target/value); the IR reuses SankeyInput. Ribbon width = edge.value.
      const chord = branchData as unknown as SankeyInput;
      option = adaptChordToECharts(spec, chord, input);
      nodeCount = chord.nodes.length;
    } else if (chartType === 'force_graph') {
      const network = branchData as unknown as NetworkInput;
      option = adaptGraphToECharts(spec, network, input);
      nodeCount = network.nodes.length;
    } else if (chartType === 'sunburst') {
      const hierarchy = branchData as unknown as HierarchyInput;
      option = adaptSunburstToECharts(spec, hierarchy, input);
      nodeCount = hierarchyNodeCount(hierarchy);
    } else if (chartType === 'choropleth' || chartType === 'bubble_map' || chartType === 'flow_map') {
      // Geo dispatch: build a SpatialSpec from the 'geo' branch and render via the
      // ported spatial adapter. The adapter attaches the FeatureCollection on
      // option.__registration (the not-self-contained escape hatch); the JSON
      // projection below preserves it while dropping the tooltip-formatter closure.
      //
      // `id` is passed UNCONDITIONALLY — not through a truthiness spread. renderGeoOption
      // defaults with `identity.id ?? \`viz:${chartType}\``, which is exactly the pre-lift
      // code's `input.id ?? …`; a truthiness spread instead DROPPED an empty-string id and
      // silently changed the derived mapName (`custom-geo` → `map-viz:choropleth`). That
      // was the s172 lift's one behaviour change (s173 m01, defects 1+2): it broke the
      // render↔certify byte parity the lift existed to guarantee, since
      // certify-echarts-emit.ts has always passed `id` unconditionally. Standing rule B:
      // when a private function is lifted to a shared module, compare the CALLERS'
      // argument guarding, not just the function body.
      const result = renderGeoOption(
        { id: input.id, ...(input.name ? { name: input.name } : {}) },
        chartType,
        branchData as GeoBranch,
        spec.a11y.description,
        input,
      );
      option = result.option;
      nodeCount = result.count;
    } else {
      const hierarchy = branchData as unknown as HierarchyInput;
      option = adaptTreemapToECharts(spec, hierarchy, input);
      nodeCount = hierarchyNodeCount(hierarchy);
    }

    // The adapters embed a tooltip `formatter` FUNCTION for client-side rendering;
    // functions are not JSON-transmittable (they are dropped over the MCP wire) and
    // are not structured-cloneable (the specRef cache). Project the option to its
    // transmittable JSON form so the returned echartsSpec matches what a consumer
    // actually receives — and so the specRef can cache it. (ECharts falls back to
    // its default tooltip; a future adapter pass could emit a string-template
    // formatter to preserve the custom tooltip across JSON transport.)
    const echartsOption = JSON.parse(JSON.stringify(option)) as Record<string, unknown>;

    // Geo-join surfacing (sprint-118 m06): the choropleth adapter attaches __joinDiagnostics when a
    // corridor's join key had no matching map feature. Read it, then STRIP it from echartsSpec so the
    // default (flag-off) path is byte-identical to today (silent drop preserved — geo goldens unchanged).
    // Under strictFields, emit OODS-V134 per unmatched corridor onto warnings[].
    const joinDiagnostics = echartsOption.__joinDiagnostics as { unmatchedData?: string[] } | undefined;
    delete echartsOption.__joinDiagnostics;
    const geoWarnings: VizRenderOutput['warnings'] =
      input.strictFields && joinDiagnostics?.unmatchedData?.length
        ? joinDiagnostics.unmatchedData.map((key) => ({
            code: 'OODS-V134',
            message: `Geo join: corridor "${key}" has no matching map feature.`,
            severity: 'warning' as const,
          }))
        : [];

    // F3 never-cycle WARN (sprint-148 m03): one V146 when the distinct color-group
    // count exceeds the palette the adapter baked onto echartsOption.color. Read-only
    // on echartsOption, so contentHash/specRef below stay byte-identical.
    const cycleWarnings = neverCycleWarnings(chartType, branchData, echartsOption);

    const out: VizRenderOutput = {
      status: 'ok',
      chartType,
      mode: 'explicit',
      // ECharts is the only renderable payload for this family; omit Vega-Lite spec.
      echartsSpec: echartsOption as unknown as VizRenderOutput['echartsSpec'],
      a11yDescription: spec.a11y.description,
      warnings: [...geoWarnings, ...cycleWarnings, ...duplicateLinkWarnings],
      output: {
        compact,
        echarts: true,
        reason: 'echarts-primary-family',
        ...(includeNormalized ? { includeNormalizedSpec: true } : {}),
        ...(includeA11y ? { includeA11y: true } : {}),
      },
      meta: {
        renderer: 'echarts',
        mark: config.mark,
        rowCount: nodeCount,
        fields: [],
      },
    };

    if (includeA11y) {
      // Structured a11y derived DIRECTLY from the non-cartesian input branch
      // (FD#10): treemap/sunburst via analyzeHierarchy, sankey/chord via
      // analyzeSankey, force_graph via analyzeNetwork, geo via analyzeSpatial —
      // routed through the SAME generators every type uses.
      //
      // LIFTED to ./echarts-a11y-analysis.ts in s174 m01 so artifact.certify evaluates the
      // 16-rule engine over the SAME operand-built table + narrative. viz.render's output is
      // unchanged by the lift — its fidelity snapshots are the proof.
      const { table, narrative } = buildEChartsA11yContext(spec, chartType, branchData);
      out.a11y = toWireA11y(table, narrative);
    }

    if (includeNormalized) {
      // Metadata-only IR for these charts (the data lives in the data branch +
      // echartsSpec, not the IR) — emitted as a debug aid.
      out.normalizedSpec = spec as unknown as VizRenderOutput['normalizedSpec'];
    }
    if (compact) {
      out.tokenCssRef = tokenCssReference();
    }

    // specRef references the PRIMARY payload (the JSON-safe ECharts option) for pipeline reuse.
    const record = createValueRef(echartsOption, 'viz.render');
    const ref = describeSchemaRef(record);
    out.specRef = ref.ref;
    out.specRefCreatedAt = ref.createdAt;
    out.specRefExpiresAt = ref.expiresAt;

    // contentHash over the JSON-PROJECTED ECharts option (post-__joinDiagnostics
    // strip) — the same payload specRef caches, hashed for stable identity
    // (sprint-134 m02). NOT the raw adapter option (its formatter closure is dropped).
    out.contentHash = sha256(canonicalize(echartsOption));

    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : 'Error';
    // SankeyValidationError / GeoInputError = invalid input data (like
    // VizSpecBuilderError -> V126); EChartsAdapterError -> V128; else -> V129.
    const code =
      name === 'SankeyValidationError' || name === 'GeoInputError'
        ? 'OODS-V126'
        : name === 'EChartsAdapterError'
          ? 'OODS-V128'
          : 'OODS-V129';
    return errorOut(code, message, compact, false);
  }
}

// Minimal NormalizedVizSpec scaffolding for the ECharts-primary adapters. The
// adapters read only metadata (name/id/a11y/config/interactions) — the chart data
// is the SEPARATE input branch — so this carries no encoding/marks data of its own.
function buildEChartsPrimarySpec(
  input: VizRenderInput,
  chartType: EChartsPrimaryType,
  config: EChartsPrimaryConfig,
): NormalizedVizSpec {
  const description = input.description?.trim()
    ? input.description.trim()
    : `${config.label} of ${input.name ?? config.noun}.`;
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: input.id ?? `viz:${chartType}`,
    ...(input.name ? { name: input.name } : {}),
    data: { values: [] },
    marks: [{ trait: config.mark }],
    encoding: {},
    a11y: { description, ...(!input.name ? { ariaLabel: config.label } : {}) },
  } as NormalizedVizSpec;
}

// ---- geo render path (sprint-112 m02) -----------------------------------------
// LIFTED to ./echarts-geo-option.ts in sprint-172 m01 (GeoInputError,
// DEFAULT_GEO_DIMENSIONS, resolveFeatureCollection, renderGeoOption) so
// artifact.certify re-emits the geo option through the SAME builder. The only change
// was renderGeoOption's signature (identity record instead of the whole VizRenderInput);
// the guards, messages, SpatialSpec shapes and adapter calls are unchanged, and the geo
// goldens prove it.

// ---- structured a11y projection (sprint-128 m03, FD#10) -----------------------
// Project the engine's table + narrative results onto the additive wire shape, and
// pick the right input-shaped analyzer per non-cartesian type so the structured
// a11y derives from the SAME data source the chart renders from.
type WireA11y = NonNullable<VizRenderOutput['a11y']>;

function toWireA11y(table: AccessibleTableResult, narrative: NarrativeResult): WireA11y {
  const wire: WireA11y = {
    narrative: { summary: narrative.summary, keyFindings: [...narrative.keyFindings] },
  };
  if (table.status === 'ready') {
    wire.table = {
      caption: table.caption,
      columns: table.columns.map((column) => ({
        field: column.field,
        label: column.label,
        isNumeric: column.isNumeric,
      })),
      rows: table.rows.map((row) => ({
        cells: row.cells.map((cell) => ({ field: cell.field, text: cell.text })),
      })),
    };
  }
  return wire;
}

// Count of hierarchy nodes bound into the chart (surfaced as meta.rowCount — the
// hierarchy analog of tabular row count).
function hierarchyNodeCount(input: HierarchyInput): number {
  if (input.type === 'adjacency_list') {
    return input.data.length;
  }
  const count = (node: { children?: ReadonlyArray<unknown> }): number =>
    1 +
    (Array.isArray(node.children)
      ? node.children.reduce(
          (sum: number, child) => sum + count(child as { children?: ReadonlyArray<unknown> }),
          0,
        )
      : 0);
  return count(input.data);
}

// Confidence normalization (s110-m04 design call; default per decision #698:
// score / max-possible). MAX_MATCH_SCORE is the empirical strong-canonical-match
// ceiling — three range matches (+4 each), a goal match (+5), ~two attribute
// matches (+2 each), plus the canonical nudge. A pick at/above it is fully
// confident; weaker picks scale down linearly, clamped to [0,1].
const MAX_MATCH_SCORE = 25;

function normalizeConfidence(score: number): number {
  return Math.max(0, Math.min(1, score / MAX_MATCH_SCORE));
}

function errorOut(code: string, message: string, compact: boolean, wantEcharts: boolean): VizRenderOutput {
  const errors: Issue[] = [{ code, message, severity: 'error' }];
  return {
    status: 'error',
    spec: {},
    warnings: [],
    errors,
    output: { compact, ...(wantEcharts ? { echarts: true } : {}) },
  };
}

// Error output for the a11y-equivalence gate (sprint-135 m04). Unlike errorOut (a single code,
// empty warnings), this preserves EVERY failing error-rule's OODS-<rule.id> code and carries
// the warn-severity a11y findings + field warnings. Omits contentHash (the error path never sets it).
function a11yErrorOut(
  errors: Issue[],
  warnings: VizRenderOutput['warnings'],
  compact: boolean,
  wantEcharts: boolean,
): VizRenderOutput {
  return {
    status: 'error',
    spec: {},
    warnings,
    errors,
    output: { compact, ...(wantEcharts ? { echarts: true } : {}) },
  };
}

function collectFieldNames(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          order.push(key);
        }
      }
    }
  }
  return order;
}
