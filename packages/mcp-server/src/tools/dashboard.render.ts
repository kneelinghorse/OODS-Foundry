// dashboard.render — the Phase-2 dashboard composition handler (sprint-113 m05).
//
// Composes a declarative DashboardSpec IR into a renderable metric-overview
// dashboard. It calls the viz.render handle() PER PANEL in-process (no MCP-wire
// re-marshalling, no double AJV — the server validates the dashboard IR at the
// boundary, viz.render's handle() is a pure in-process fn), then runs the headless
// @oods/viz-core dashboard primitives: the m02 auto-layout resolver, the m03 KPI
// compute, and the m03/m04 cross-filter resolver. Per-chart specs (viz.render) are
// UNCHANGED — this composes them (Option C).
//
// Per-panel viz.render specRefs are SUPPRESSED (only their spec/echartsSpec/
// a11yDescription payloads are kept); ONE dashboard-level specRef is minted over
// the composed output. Geo panels preserve their echartsSpec.__registration.

import {
  applyCrossFilter,
  computeKpi,
  KpiComputeError,
  finestGranularity,
  describeMeasureContext,
  parseTemporalValue,
  resolveCrossFilter,
  resolveDashboardLayout,
  resolveDashboardNarrative,
  type DashboardKpiSummary,
  type KpiPanel,
  type MeasureNarrativeContext,
  type Panel,
  type SelectionState,
  type TemporalGranularity,
} from '@oods/viz-core';
import { canonicalize, sha256 } from '@oods/artifacts';
import { ToolError } from '../errors/tool-error.js';
import type { DashboardRenderInput, DashboardRenderOutput, VizRenderInput } from '../schemas/generated.js';
import { handle as vizRenderHandle } from './viz.render.js';
import { createValueRef, describeSchemaRef } from './schema-ref.js';
import {
  composeDashboardHtml,
  resolveBrandTokens,
  scanBrandContrast,
  type ChartTableData,
  type ContrastScanResult,
  type ExportBrand,
} from './dashboard.render.html.js';
import { loadMeasureRegistry, MalformedMeasureRegistryError } from './measure-registry.js';
import { resolveMeasurePanel } from './measure-resolver.js';
import { absentFields, referencedEncodingFields } from './field-presence.js';

type Row = Record<string, unknown>;
type PanelResult = DashboardRenderOutput['panels'][number];
type Issue = NonNullable<DashboardRenderOutput['warnings']>[number];

const TABULAR_TYPES = new Set(['bar', 'line', 'area', 'scatter', 'heatmap']);

/**
 * Project a contrast scan into the opt-in a11yContrast output block (sprint-119 m03).
 * Every finding is a failing pair (ratio < threshold), so each becomes a 'warning'-severity
 * row mirroring its OODS-V135 warning. Pure + exported so the populated mapping is
 * unit-testable (the default brand passes contrast, so a non-empty block never arises
 * end-to-end).
 *
 * s169 m04 adds `summary.gradedPairs` — the ONE chartered golden movement of this sprint.
 * `failing: 0` alone is ambiguous between "checked four pairs, all passed" and "checked
 * nothing", and for three sprints it silently meant the second. A consumer reading this
 * block can now tell those apart without trusting a comment.
 */
export function toA11yContrastBlock(scan: ContrastScanResult): NonNullable<DashboardRenderOutput['a11yContrast']> {
  return {
    findings: scan.findings.map((finding) => ({ ...finding, severity: 'warning' as const })),
    summary: { failing: scan.findings.length, gradedPairs: scan.graded },
  };
}

export async function handle(input: DashboardRenderInput): Promise<DashboardRenderOutput> {
  const compact = input.output?.compact ?? true;
  const wantEcharts = input.output?.echarts ?? false;
  const wantNormalizedSpec = input.output?.includeNormalizedSpec ?? false;
  const wantA11y = input.output?.includeA11y ?? false;
  const wantHtml = input.output?.html ?? false;
  // A11y equivalence CERTIFY-AT-EMISSION (sprint-134 m03): top-level flag (NOT under output,
  // mirroring strictFields/strictDatasets). When on, each cartesian chart panel's viz.render call
  // runs the equivalence engine; the per-panel OODS-A11Y-* warnings (silently dropped by
  // buildChartResult) are folded into the dashboard warnings[] prefixed with the panel id. Default-on
  // (sprint-135 m03); the builder is conformant-by-construction (m02), so generated panels surface no
  // findings. Set a11yEquivalence:false to opt out for agent-supplied non-conformant panels.
  const wantA11yEquivalence = input.a11yEquivalence ?? true;
  const brand = input.brand as ExportBrand | undefined;
  const theme = input.theme ?? 'light';
  const exportTokens = resolveBrandTokens(brand, theme);
  // A11y completeness (sprint-118 m07) — all default-off so the absent path is byte-identical.
  const wantDataTable = input.output?.dataTable ?? false;
  const wantContrastScan = input.output?.contrastScan ?? false;
  const dataQualityField = input.output?.dataQualityField;
  const ignoreSelfSource = input.crossFilter?.ignoreSelfSource ?? true;
  const onPanelError = input.onPanelError ?? 'placeholder';
  // s194-m05: resolve governed references by default. Explicit false opts out.
  // Inputs without a reference retain their previous rendered bytes.
  const resolveMeasures = input.resolveMeasures ?? true;
  // Field-presence strict check (sprint-118 m05) — gated, default OFF so the absent/false
  // path is byte-identical (the frozen-D6 silent-empty asymmetry preserved).
  const strictFields = input.strictFields ?? false;
  // D6 unknown-datasetId STRICT switch (sprint-122 m03) — gated, default OFF so the absent/false
  // path is byte-identical to the frozen-D6 silent value:0. Lifts ONLY a KPI panel whose datasetId
  // is absent from datasets[] to a fail-loud V139 (a KNOWN dataset cross-filtered to [] still
  // renders value:0; chart panels keep their own V123 path).
  const strictDatasets = input.strictDatasets ?? false;
  const selection = (input.selection ?? undefined) as SelectionState | undefined;
  const crossFiltered = selection !== undefined && Object.keys(selection).length > 0;

  const datasetRows = new Map<string, Row[]>();
  for (const dataset of input.datasets) {
    datasetRows.set(dataset.id, dataset.rows as Row[]);
  }

  // Cross-filter a tabular panel's rows by the active selection (skip-self,
  // AND-across-sources). Non-tabular panels carry their own inline data branch
  // and are cross-filter SOURCES, not targets, in v1.
  const filterRows = (panelId: string, rows: Row[]): Row[] =>
    crossFiltered ? applyCrossFilter(rows, resolveCrossFilter(selection as SelectionState, panelId, { ignoreSelfSource })) : rows;

  const panelResults: PanelResult[] = [];
  const placedPanels: Panel[] = [];
  const warnings: Issue[] = [];
  // Panel identity receipts are deliberately held beside panelResults. buildChartResult's
  // returned objects belong to the dashboard's hashed {panels, layout} projection, so adding
  // either field there would move the existing dashboard contentHash/specRef payload.
  const panelContentHashes = new Map<string, string>();
  const panelNormalizedSpecs = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof vizRenderHandle>>['normalizedSpec']>
  >();
  let errorPanelCount = 0;
  // Governed-measure narrative projection (sprint-129 m02), keyed by KPI panel id. Populated
  // ONLY when resolveMeasures is on AND a measure resolved — the absent path leaves this empty,
  // so the measure narrative is byte-identical-absent for the default/flag-off path.
  const measureProjections = new Map<string, KpiMeasureProjection>();

  // Panel ids key the per-panel identity receipts below. Reject duplicates before any
  // panel work so a later panel cannot overwrite an earlier panel's receipt and make
  // both output rows claim the same content identity.
  const panelIds = new Set<string>();
  const duplicatePanelIds = new Set<string>();
  for (const panel of input.panels) {
    if (panelIds.has(panel.id)) duplicatePanelIds.add(panel.id);
    panelIds.add(panel.id);
  }
  if (duplicatePanelIds.size > 0) {
    throw new ToolError('OODS-C003', 'Duplicate panel id', { ids: [...duplicatePanelIds] });
  }

  for (const panel of input.panels as Panel[]) {
    if (panel.kind === 'kpi') {
      // Resolve a governed measureRef -> field/aggregate BEFORE compute when the
      // flag is on AND the panel carries one; otherwise pass through untouched
      // (the `resolveMeasures && panel.measureRef` guard keeps the default path
      // byte-identical to s116).
      let kpiPanel = panel;
      // M2 (sprint-122): a resolved governed measure may declare an expectedGrain. Hoisted OUT
      // of the resolveMeasures block (where `entry` is in scope) because the grain check needs
      // `rows`, fetched AFTER the block closes. Stays undefined on the default/unresolved path.
      let expectedGrain: TemporalGranularity | undefined;
      if (resolveMeasures && panel.measureRef) {
        let registry;
        try {
          registry = loadMeasureRegistry();
        } catch (err) {
          if (!(err instanceof MalformedMeasureRegistryError)) throw err;
          // V132 (sprint-118 m03): the registry artifact is present but malformed. FAIL
          // CLOSED through the SAME partial-panel seam — never a silent empty Map, which
          // would masquerade as a V130 unknown-measure miss and hide the config rot.
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V132',
              message: `KPI panel "${panel.id}" omitted: the governed-measure registry is malformed.`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V132',
              message: `KPI panel "${panel.id}" cannot resolve "${panel.measureRef}": the governed-measure registry is malformed.`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: the governed-measure registry is malformed.`,
          });
          placedPanels.push(panel);
          continue;
        }
        const entry = registry.get(panel.measureRef);
        if (!entry) {
          // Unresolvable governed measure = a provenance failure, NOT a silent
          // value:0. Route through the SAME partial-panel seam the chart branch
          // uses (NOT a thrown ToolError, which would void sibling panels).
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V130',
              message: `KPI panel "${panel.id}" omitted: references unknown governed measure "${panel.measureRef}".`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V130',
              message: `KPI panel "${panel.id}" references unknown governed measure "${panel.measureRef}".`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: unknown governed measure "${panel.measureRef}".`,
          });
          placedPanels.push(panel);
          continue;
        }
        if (entry.additive === false && entry.aggregate === 'sum') {
          // V133 (sprint-118 m03): a non-additive measure asked for a `sum` rollup. A
          // summed ratio/price (e.g. value/quantity) is meaningless — block it instead of
          // silently summing. ONLY summation is blocked; average/latest/min/max/distinct/
          // count are fine. (The registry aggregate OVERRIDES the author's per D4, so the
          // effective aggregate is entry.aggregate.) Route through the SAME seam.
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V133',
              message: `KPI panel "${panel.id}" omitted: non-additive measure "${panel.measureRef}" cannot be summed.`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V133',
              message: `KPI panel "${panel.id}" blocks a non-additive rollup: measure "${panel.measureRef}" cannot be summed.`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: non-additive measure "${panel.measureRef}" cannot be summed.`,
          });
          placedPanels.push(panel);
          continue;
        }
        // The entry passed the V132/V130/V133 gates — capture its optional declared time-grain
        // for the post-rows V138 check (entry goes OUT of scope when this block closes).
        expectedGrain = entry.expectedGrain;
        // m02: capture the governed measure-context for the KPI narrative surfaces. The
        // unit/format/threshold.value come from the registry ENTRY; the comparison-basis
        // 'vs target N' clause (s130-m02) reads the RESOLVED comparison off kpiPanel AFTER
        // resolveMeasurePanel (author-override-wins) so it names what computeKpi actually
        // compared against (s130-m01 fix A; kpi.ts:152-153) — hence read post-assignment, not
        // off the entry. Read at buildKpiResult (a11yDescription, unit-only) + collectKpiSummaries
        // (cross-panel a11y.narrative, the 'vs target' surface). entry/kpiPanel go out of scope
        // when this block closes, so stash it now keyed by panel id.
        const measureContext: MeasureNarrativeContext = {
          ...(entry.unit !== undefined ? { unit: entry.unit } : {}),
          ...(entry.format !== undefined ? { format: entry.format } : {}),
          ...(entry.defaultThreshold?.value !== undefined ? { thresholdValue: entry.defaultThreshold.value } : {}),
          // s130-m04: governed threshold DIRECTION — NOT verbalized; carried only for the V142 drift guard.
          ...(entry.defaultThreshold?.direction !== undefined ? { thresholdDirection: entry.defaultThreshold.direction } : {}),
        };
        kpiPanel = resolveMeasurePanel(panel, registry);
        const resolvedComparison = kpiPanel.comparison;
        measureProjections.set(panel.id, {
          displayName: entry.displayName,
          context: {
            ...measureContext,
            ...(resolvedComparison?.basis !== undefined ? { comparisonBasis: resolvedComparison.basis } : {}),
            ...(resolvedComparison?.value !== undefined ? { comparisonValue: resolvedComparison.value } : {}),
          },
        });
      }
      // V137 (sprint-122 m01): a KPI panel resolved to NO field — a measureRef-only panel with
      // resolveMeasures OFF (the block above is skipped so field is never filled), or otherwise
      // field-less. The IR cast at the loop head types `field` as string, but a tool-input panel
      // that drops it (schema A no longer requires `field`) is `undefined` at RUNTIME. Fail loud
      // through the SAME onPanelError seam instead of letting computeKpi silently aggregate a
      // missing field to value:0. Fires UNCONDITIONALLY (NOT gated by strictFields).
      if (!kpiPanel.field) {
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V137',
            message: `KPI panel "${panel.id}" omitted: no resolvable field (measureRef unresolved).`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          error: {
            code: 'OODS-V137',
            message: `KPI panel "${panel.id}" has no resolvable field: a measureRef-only panel requires resolveMeasures and a known governed measure.`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: no resolvable field (measureRef unresolved).`,
        });
        placedPanels.push(panel);
        continue;
      }
      // V139 (sprint-122 m03): under strictDatasets, a KPI panel referencing a datasetId NOT in
      // datasets[] fails LOUD (matching how chart panels fail via V123) instead of the frozen-D6
      // silent value:0. Read .has() on the RAW pre-filter Map BEFORE the `?? []` collapse below so
      // an UNKNOWN id (.has()===false) is distinguished from a KNOWN dataset cross-filtered to []
      // (which keeps .has()===true and STILL renders value:0 — the ratified unknown-id-ONLY
      // scope). kpiPanel.datasetId === panel.datasetId (resolveMeasurePanel never touches it).
      if (strictDatasets && !datasetRows.has(kpiPanel.datasetId)) {
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V139',
            message: `KPI panel "${panel.id}" omitted: references unknown dataset "${kpiPanel.datasetId}".`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          error: {
            code: 'OODS-V139',
            message: `KPI panel "${panel.id}" references unknown dataset "${kpiPanel.datasetId}".`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: references unknown dataset "${kpiPanel.datasetId}".`,
        });
        placedPanels.push(panel);
        continue;
      }
      const rows = filterRows(kpiPanel.id, datasetRows.get(kpiPanel.datasetId) ?? []);
      if (strictFields) {
        // V131: a referenced field (the resolved field + optional periodField) absent from
        // every NON-empty row is a typo, NOT a silent value:0. Route through the SAME seam.
        const refs = kpiPanel.periodField ? [kpiPanel.field, kpiPanel.periodField] : [kpiPanel.field];
        const missing = absentFields(rows, refs);
        if (missing.length > 0) {
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V131',
              message: `KPI panel "${panel.id}" omitted: field(s) absent from the dataset: ${missing.join(', ')}.`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V131',
              message: `KPI panel "${panel.id}" references field(s) absent from the dataset: ${missing.join(', ')}.`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: field(s) absent from the dataset: ${missing.join(', ')}.`,
          });
          placedPanels.push(panel);
          continue;
        }
      }
      // V138 (sprint-122 m02): when the resolved governed measure declares an expectedGrain,
      // validate the panel's ACTUAL period data against it. The finest observed granularity of
      // the periodField cells must equal the declared grain, else the measure is being read at
      // the wrong cadence — route through the SAME onPanelError seam. Fires ONLY when a measure
      // resolved an expectedGrain (the default/unseeded path is byte-untouched). temporal parsing
      // is UTC-pinned/deterministic (golden-safe); rows are params (consumer-model clean).
      if (expectedGrain) {
        if (!kpiPanel.periodField) {
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V138',
              message: `KPI panel "${panel.id}" omitted: measure expects time-grain "${expectedGrain}" but the panel declares no periodField.`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V138',
              message: `KPI panel "${panel.id}" measure expects time-grain "${expectedGrain}" but the panel declares no periodField to check.`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: measure expects time-grain "${expectedGrain}" but no periodField is set.`,
          });
          placedPanels.push(panel);
          continue;
        }
        const periodField = kpiPanel.periodField;
        const parsed = rows
          .map((r) => parseTemporalValue(r[periodField], true))
          .filter((p): p is NonNullable<typeof p> => p !== null);
        const observed = finestGranularity(parsed);
        if (observed !== expectedGrain) {
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V138',
              message: `KPI panel "${panel.id}" omitted: measure expects time-grain "${expectedGrain}" but the period data is "${observed}".`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V138',
              message: `KPI panel "${panel.id}" measure expects time-grain "${expectedGrain}" but the period data is "${observed}".`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: measure expects time-grain "${expectedGrain}" but the data is "${observed}".`,
          });
          placedPanels.push(panel);
          continue;
        }
      }
      // V141 (sprint-129 m03): MEASURE-NARRATIVE equivalence. Fires ONLY when the measure narrative
      // will be surfaced (wantHtml || wantA11y) AND the resolved measure governs a defaultThreshold
      // that the narrative verbalizes. If the panel's RESOLVED threshold (measure-resolver output —
      // author-overridable per D4: panel.threshold ?? entry.defaultThreshold) DIVERGES from that
      // governed value, the verbalized "threshold X breached" would misrepresent the threshold the
      // breach was computed against. Fail CLOSED through the SAME onPanelError seam rather than emit
      // a misleading governed narrative. Non-tautological (governed registry default vs resolved
      // panel — two sources), reachable (author override), chained AFTER V130/V132/V133/V137/V138/V139.
      if (wantHtml || wantA11y) {
        const governedThreshold = measureProjections.get(kpiPanel.id)?.context.thresholdValue;
        const effectiveThreshold = kpiPanel.threshold?.value;
        if (governedThreshold !== undefined && effectiveThreshold !== undefined && governedThreshold !== effectiveThreshold) {
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V141',
              message: `KPI panel "${panel.id}" omitted: measure-narrative governed threshold ${governedThreshold} disagrees with the resolved threshold ${effectiveThreshold}.`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V141',
              message: `KPI panel "${panel.id}" measure-narrative is inconsistent: the governed measure threshold ${governedThreshold} disagrees with the panel's resolved threshold ${effectiveThreshold}.`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: measure-narrative governed threshold ${governedThreshold} disagrees with the resolved threshold ${effectiveThreshold}.`,
          });
          placedPanels.push(panel);
          continue;
        }
        // V142 (sprint-130 m04): the DIRECTION sibling of the V141 value check. resolveMeasurePanel
        // replaces the WHOLE threshold object, so an author override can keep the value (V141 silent)
        // yet flip the direction — the breach computes against the flipped direction while the narrative
        // names the governed one. Same registry-vs-rendered drift, same seam. Chained AFTER V141 (value
        // first short-circuits via the continue above), so a panel reaching here passed the value check.
        const governedDirection = measureProjections.get(kpiPanel.id)?.context.thresholdDirection;
        const effectiveDirection = kpiPanel.threshold?.direction;
        if (governedDirection !== undefined && effectiveDirection !== undefined && governedDirection !== effectiveDirection) {
          if (onPanelError === 'omit') {
            warnings.push({
              code: 'OODS-V142',
              message: `KPI panel "${panel.id}" omitted: measure-narrative governed threshold direction "${governedDirection}" disagrees with the resolved direction "${effectiveDirection}".`,
              severity: 'warning',
            });
            continue;
          }
          errorPanelCount += 1;
          panelResults.push({
            id: panel.id,
            kind: 'error',
            ...(panel.title ? { title: panel.title } : {}),
            error: {
              code: 'OODS-V142',
              message: `KPI panel "${panel.id}" measure-narrative is inconsistent: the governed measure threshold direction "${governedDirection}" disagrees with the panel's resolved direction "${effectiveDirection}".`,
              severity: 'error',
            },
            a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: measure-narrative governed threshold direction "${governedDirection}" disagrees with the resolved direction "${effectiveDirection}".`,
          });
          placedPanels.push(panel);
          continue;
        }
      }
      // V160 (sprint-175 m05, decision 11): computeKpi now THROWS KpiComputeError when a numeric
      // aggregate (sum/average/median/min/max/latest) meets a field that HAS values but none of
      // them numeric — the case that returned a plausible, silent value:0 before s175 (FD#1).
      // buildKpiResult is its only call site here and it sits OUTSIDE the catches above, so an
      // uncaught throw would escape as a TOOL-level error; route it through the SAME onPanelError
      // seam as V137/V139/V142 instead. count/distinct never throw (defined over any cell type),
      // and an absent field has zero non-null cells, so the ratified s118 typo-field value:0
      // asymmetry is untouched: this is a cell-TYPE gate, not a field-presence gate.
      let kpiResult: PanelResult;
      try {
        kpiResult = buildKpiResult(kpiPanel, rows, measureProjections.get(kpiPanel.id)?.context);
      } catch (err) {
        if (!(err instanceof KpiComputeError)) {
          throw err;
        }
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V160',
            message: `KPI panel "${panel.id}" omitted: aggregate "${err.aggregate}" over field "${err.field}" found no numeric cells.`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          error: {
            code: 'OODS-V160',
            message: `KPI panel "${panel.id}" cannot compute aggregate "${err.aggregate}": field "${err.field}" has values but no numeric cells.`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: aggregate "${err.aggregate}" over field "${err.field}" found no numeric cells.`,
        });
        placedPanels.push(panel);
        continue;
      }
      panelResults.push(kpiResult);
      placedPanels.push(kpiPanel);
      continue;
    }

    // chart panel — under strictFields, a tabular panel's encoding fields must be present in the
    // resolved rows BEFORE rendering, so a typo surfaces as V131 (not a confident-wrong spec).
    if (strictFields && TABULAR_TYPES.has(panel.chartType)) {
      const chartRows = filterRows(panel.id, datasetRows.get(panel.datasetId ?? '') ?? []);
      const missing = absentFields(chartRows, referencedEncodingFields(panel.encodings));
      if (missing.length > 0) {
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V131',
            message: `panel "${panel.id}" omitted: encoding field(s) absent from the dataset: ${missing.join(', ')}.`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          chartType: panel.chartType,
          error: {
            code: 'OODS-V131',
            message: `panel "${panel.id}" references encoding field(s) absent from the dataset: ${missing.join(', ')}.`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: encoding field(s) absent from the dataset: ${missing.join(', ')}.`,
        });
        placedPanels.push(panel);
        continue;
      }
    }

    // s130-m03: EXPLICIT chart-panel governed-measure context (NARRATIVE-ONLY). Unlike the KPI
    // path, resolveMeasurePanel is KpiPanel-typed and rewrites field/aggregate/comparison/threshold
    // which chart panels lack — so this captures ONLY the narrative context (displayName/unit/format/
    // threshold + comparison) and runs NO compute. It reuses the SAME V132 (malformed) / V130
    // (unknown) hard-error gates the KPI branch uses (ratified governance consistency across
    // panel kinds); the V133/V137/V138/V139 compute gates are deliberately skipped. The captured
    // context decorates this chart's PER-PANEL a11y.narrative in buildChartResult (not the rollup).
    let chartMeasure: { displayName?: string; context: MeasureNarrativeContext } | undefined;
    if (resolveMeasures && panel.measureRef) {
      let registry;
      try {
        registry = loadMeasureRegistry();
      } catch (err) {
        if (!(err instanceof MalformedMeasureRegistryError)) throw err;
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V132',
            message: `Chart panel "${panel.id}" omitted: the governed-measure registry is malformed.`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          chartType: panel.chartType,
          error: {
            code: 'OODS-V132',
            message: `Chart panel "${panel.id}" cannot resolve "${panel.measureRef}": the governed-measure registry is malformed.`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: the governed-measure registry is malformed.`,
        });
        placedPanels.push(panel);
        continue;
      }
      const entry = registry.get(panel.measureRef);
      if (!entry) {
        // UNKNOWN chart measureRef = HARD-ERROR mirroring V130 (NOT a silent narrative-less render).
        if (onPanelError === 'omit') {
          warnings.push({
            code: 'OODS-V130',
            message: `Chart panel "${panel.id}" omitted: references unknown governed measure "${panel.measureRef}".`,
            severity: 'warning',
          });
          continue;
        }
        errorPanelCount += 1;
        panelResults.push({
          id: panel.id,
          kind: 'error',
          ...(panel.title ? { title: panel.title } : {}),
          chartType: panel.chartType,
          error: {
            code: 'OODS-V130',
            message: `Chart panel "${panel.id}" references unknown governed measure "${panel.measureRef}".`,
            severity: 'error',
          },
          a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: unknown governed measure "${panel.measureRef}".`,
        });
        placedPanels.push(panel);
        continue;
      }
      // Narrative context ONLY (no resolveMeasurePanel). Charts carry no comparison override, so the
      // basis/value come straight from the registry entry's defaultComparison (the m02 KPI path reads
      // the author-overridable kpiPanel.comparison; charts have no such field).
      chartMeasure = {
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

    // chart panel — render in-process via viz.render
    const vizInput = buildPanelVizInput(
      panel,
      datasetRows,
      filterRows,
      wantEcharts,
      wantNormalizedSpec,
      wantA11y,
      wantA11yEquivalence,
    );
    const out = await vizRenderHandle({ ...vizInput, brand, theme,
      ...(theme === 'hc' && wantHtml ? { output: { ...vizInput.output, svg: true } } : {}),
    });

    if (out.status !== 'ok') {
      const issue = out.errors?.[0] ?? { code: 'OODS-V129', message: 'panel failed to render' };
      if (onPanelError === 'omit') {
        warnings.push({ code: issue.code, message: `panel "${panel.id}" omitted: ${issue.message}`, severity: 'warning' });
        continue;
      }
      // SEAM (b) default: an a11y-described error placeholder, kept in-place.
      errorPanelCount += 1;
      panelResults.push({
        id: panel.id,
        kind: 'error',
        ...(panel.title ? { title: panel.title } : {}),
        chartType: panel.chartType,
        error: { code: issue.code, message: issue.message, severity: 'error' },
        a11yDescription: `Panel "${panel.title ?? panel.id}" could not be rendered: ${issue.message}`,
      });
      placedPanels.push(panel);
      continue;
    }

    if (out.contentHash !== undefined) {
      panelContentHashes.set(panel.id, out.contentHash);
    }
    if (wantNormalizedSpec && out.normalizedSpec !== undefined) {
      panelNormalizedSpecs.set(panel.id, out.normalizedSpec);
    }

    // A11y equivalence fold (sprint-134 m03 wire; sprint-135 m04 gate): buildChartResult copies
    // id/spec/echartsSpec/a11y from the per-panel viz.render output but SILENTLY DROPS out.warnings
    // — there is no other per-panel warnings propagation to ride. So when the dashboard
    // a11yEquivalence flag is on, lift each per-panel warning into the dashboard warnings[],
    // prefixed with the panel id. The per-panel gate (m04) already diverted ERROR-severity a11y
    // failures into an error panel above (the status!=='ok' seam), so the survivors reaching here
    // are warn-severity — PRESERVE w.severity (do NOT force 'warning'). Fold IN ADDITION TO, not
    // instead of, any non-a11y per-panel field warning (none today: buildPanelVizInput forwards
    // the flag but never strictFields, so out.warnings is a11y-only warn-severity by construction —
    // but the pass-through is kept so a future non-a11y warning is not silently dropped). Strictly
    // gated on the flag — an unconditional fold would re-byte warnings[] and break #564.
    if (wantA11yEquivalence) {
      for (const w of out.warnings) {
        warnings.push({
          code: w.code,
          message: `panel "${panel.id}": ${w.message}`,
          severity: w.severity,
        });
      }
    }

    panelResults.push(buildChartResult(panel, out, chartMeasure));
    placedPanels.push(panel);
  }

  // m02 deterministic auto-layout over the panels that produced a result.
  const layout = resolveDashboardLayout(placedPanels, input.layout);
  const panelOrder = readingOrder(placedPanels, input.a11y?.readingOrder, layout);

  // Narrative (m04): COMPUTE a cross-panel narrative from the KPI signals (author-supplied
  // narrative still wins, via the reused override). The computed narrative flows into BOTH the
  // JSON a11y block AND the HTML export (which reads dashboardA11y).
  // GATE LIFT (sprint-129 m02, m01 call B): the compute now fires under (wantHtml || wantA11y),
  // NOT wantHtml alone, so the measure-grounded narrative reaches the JSON a11y.narrative when
  // includeA11y=true — the #525 agent consumes JSON, not HTML, so HTML-only was invisible to it.
  // The flag-OFF path (neither set) keeps the author echo exactly → byte-identical to s114 (seam e).
  const narrative: NonNullable<DashboardRenderOutput['a11y']>['narrative'] = (wantHtml || wantA11y)
    ? toNarrativeOutput(
        resolveDashboardNarrative(input.a11y.narrative, collectKpiSummaries(panelResults, measureProjections), input.a11y.description),
      )
    : input.a11y.narrative;

  const dashboardA11y: DashboardRenderOutput['a11y'] = {
    description: input.a11y.description,
    ...(input.a11y.ariaLabel ? { ariaLabel: input.a11y.ariaLabel } : {}),
    readingOrder: input.a11y.readingOrder ?? 'kpi-first',
    panelOrder,
    ...(narrative ? { narrative } : {}),
  };

  // A11y contrast scan (sprint-118 m07 piece A): when requested, scan the export's resolved
  // brand-token pairs (no fs) and surface failures as OODS-V135 warnings. Default-off ⇒ no-op.
  // sprint-119 m03: ALSO echo the SAME findings as an opt-in structured a11yContrast block
  // (no recompute — scanBrandContrast is called once; its s118 non-hex guard already applies).
  let a11yContrast: DashboardRenderOutput['a11yContrast'];
  if (wantContrastScan) {
    // s169 m04: scan the SAME palette the export inlines. Before brand threading this was
    // always the default brand, so passing the resolved map is what makes `brand: 'B'`
    // grade brand B's colours rather than brand A's while claiming to have graded the export.
    const contrastScan = scanBrandContrast(exportTokens);
    for (const finding of contrastScan.findings) {
      warnings.push({
        code: 'OODS-V135',
        message: `Brand token pair "${finding.pair}" fails WCAG contrast: measured ${finding.ratio}:1, need ≥${finding.threshold}:1.`,
        severity: 'warning',
      });
    }
    a11yContrast = toA11yContrastBlock(contrastScan);
  }

  const result: DashboardRenderOutput = {
    status: 'ok',
    schemaVersion: input.schemaVersion,
    panels: panelResults,
    layout,
    links: (input.links ?? []) as DashboardRenderOutput['links'],
    a11y: dashboardA11y,
    warnings,
    ...(a11yContrast ? { a11yContrast } : {}),
    output: {
      compact,
      ...(wantEcharts ? { echarts: true } : {}),
      ...(wantNormalizedSpec ? { includeNormalizedSpec: true } : {}),
      ...(wantHtml ? { html: true } : {}),
      ...(wantDataTable ? { dataTable: true } : {}),
      ...(wantContrastScan ? { contrastScan: true } : {}),
      ...(wantA11y ? { includeA11y: true } : {}),
      // Echoed ONLY when supplied (the additive-spread pattern every other control here
      // uses), so an absent brand leaves this object byte-identical to s168's.
      ...(brand ? { brand } : {}),
      ...(input.theme ? { theme } : {}),
    },
    meta: {
      panelCount: panelResults.length,
      datasetCount: input.datasets.length,
      crossFiltered,
      errorPanelCount,
    },
  };

  if (compact) {
    result.tokenCssRef = input.tokenCssRef ?? 'tokens.build';
  }

  // Opt-in render-to-SVG export (seam (b)/(e)): compose a self-contained HTML doc
  // ONLY when requested, so the absent path stays byte-identical to s114. Brand-token
  // inlining + the computed narrative land in m04.
  if (wantHtml) {
    // SR data-table (m07 piece B): thread the charted rows per tabular chart panel. Built ONLY
    // under output.dataTable so the default HTML stays byte-identical (no table appended).
    let tableData: Map<string, ChartTableData> | undefined;
    if (wantDataTable) {
      tableData = new Map<string, ChartTableData>();
      for (const panel of input.panels as Panel[]) {
        if (panel.kind === 'chart' && TABULAR_TYPES.has(panel.chartType)) {
          const rows = filterRows(panel.id, datasetRows.get(panel.datasetId ?? '') ?? []);
          tableData.set(panel.id, { columns: referencedEncodingFields(panel.encodings), rows });
        }
      }
    }
    result.html = await composeDashboardHtml({
        links: result.links,
      title: input.title,
      panels: panelResults,
      layout,
      a11y: dashboardA11y,
      columns: input.layout?.columns ?? 12,
      // The same resolved map the scan graded — one brand per render, by construction.
      tokens: exportTokens,
      brand,
      theme,
      ...(tableData ? { tableData } : {}),
      ...(dataQualityField ? { dataQualityField } : {}),
    });
  }

  // ONE dashboard-level specRef over the composed payload (the N per-panel refs
  // viz.render minted are suppressed). Reference the deterministic payload only.
  const record = createValueRef({ panels: panelResults, layout }, 'dashboard.render');
  const ref = describeSchemaRef(record);
  result.specRef = ref.ref;
  result.specRefCreatedAt = ref.createdAt;
  result.specRefExpiresAt = ref.expiresAt;

  // contentHash = the deterministic content IDENTITY of the SAME composed payload
  // specRef caches ({panels, layout}). Default-on; stable across calls (sprint-134 m02).
  result.contentHash = sha256(canonicalize({ panels: panelResults, layout }));

  // Attach the per-panel viz.render receipts only AFTER both the cache record and dashboard
  // contentHash are complete. createValueRef structured-clones its operand, so these wire-only
  // additions cannot alias back into the cached/hashed {panels, layout} projection.
  for (const panel of result.panels) {
    if (panel.kind !== 'chart') continue;
    const panelContentHash = panelContentHashes.get(panel.id);
    const normalizedSpec = panelNormalizedSpecs.get(panel.id);
    Object.assign(panel, {
      ...(panelContentHash !== undefined ? { contentHash: panelContentHash } : {}),
      ...(normalizedSpec !== undefined ? { normalizedSpec } : {}),
    });
  }

  // Hash the exact returned HTML bytes. Like the panel receipts, this root-level receipt is
  // attached after the dashboard payload hash and exists only on the opt-in HTML path.
  if (wantHtml && result.html !== undefined) {
    Object.assign(result, { outputHtmlHash: sha256(result.html) });
  }

  return result;
}

// The governed measure-context captured for one KPI panel at resolve time (m02). displayName
// supplies the narrative label fallback (under the author title); context carries the
// unit/format/threshold the narrative surfaces. Both optional — the absent path is byte-identical.
interface KpiMeasureProjection {
  readonly displayName?: string;
  readonly context: MeasureNarrativeContext;
}

// Project the computed KPI panel results into the narrative input (m04). Label falls back to the
// resolved measure displayName then the panel id (m02 — author title still wins); semantic flags
// pass through. m02: when a measure resolved, the captured measure-context rides along so the
// cross-panel narrative can verbalize the governed unit + threshold (absent === byte-identical).
function collectKpiSummaries(
  panels: readonly PanelResult[],
  measureProjections: ReadonlyMap<string, KpiMeasureProjection>,
): DashboardKpiSummary[] {
  return panels
    .filter((p): p is Extract<PanelResult, { kind: 'kpi' }> => p.kind === 'kpi')
    .map((k) => {
      const projection = measureProjections.get(k.id);
      const hasMeasureContext = projection !== undefined && Object.keys(projection.context).length > 0;
      return {
        label: k.title ?? projection?.displayName ?? k.id,
        formatted: k.formatted ?? String(k.value),
        trendDirection: k.trendDirection,
        delta: k.delta ?? null,
        ...(k.thresholdBreached !== undefined ? { thresholdBreached: k.thresholdBreached } : {}),
        ...(k.anomaly !== undefined ? { anomaly: k.anomaly } : {}),
        ...(hasMeasureContext ? { measureContext: projection.context } : {}),
      };
    });
}

function toNarrativeOutput(n: {
  readonly summary: string;
  readonly keyFindings: readonly string[];
}): NonNullable<DashboardRenderOutput['a11y']>['narrative'] {
  return { summary: n.summary, keyFindings: [...n.keyFindings] };
}

function buildKpiResult(panel: KpiPanel, rows: Row[], measureContext?: MeasureNarrativeContext): PanelResult {
  const kpi = computeKpi(panel, rows);
  return {
    id: panel.id,
    kind: 'kpi',
    ...(panel.title ? { title: panel.title } : {}),
    value: kpi.value,
    formatted: kpi.formatted,
    delta: kpi.delta,
    deltaPct: kpi.deltaPct,
    trendDirection: kpi.trendDirection,
    ...(kpi.sparkline ? { sparkline: [...kpi.sparkline] } : {}),
    ...(kpi.thresholdBreached !== undefined ? { thresholdBreached: kpi.thresholdBreached } : {}),
    ...(kpi.anomaly !== undefined ? { anomaly: kpi.anomaly } : {}),
    a11yDescription: kpiA11y(panel, kpi, measureContext),
  };
}

function kpiA11y(panel: KpiPanel, kpi: ReturnType<typeof computeKpi>, measureContext?: MeasureNarrativeContext): string {
  const label = panel.title ?? panel.field;
  // m02: the governed unit annotates the value so the per-panel string reads in the measure's
  // unit. ONLY the unit lands here (the terser per-panel surface); the governed threshold framing
  // lives in the richer cross-panel a11y.narrative. Absent unit (or no resolved measure, e.g.
  // gm.revenue.* which carry none) === byte-identical to the v0.1 string.
  const unit = measureContext?.unit;
  const formatted = unit ? `${kpi.formatted} ${unit}` : kpi.formatted;
  if (kpi.delta === null) {
    return `${label}: ${formatted}.`;
  }
  // periodField ABSENT keeps the EXACT v0.1 string (byte-identical additivity —
  // the comparison there is by ROW, so it must NOT claim a period basis). With an
  // explicit period axis (v0.2) the basis names the period it was measured against.
  const basis = panel.periodField ? periodBasisLabel(panel.comparison) : '';
  const suffix = basis ? ` ${basis}` : '';
  return `${label}: ${formatted} (${kpi.trendDirection}, delta ${kpi.delta}${suffix}).`;
}

// The period-basis phrase for the a11y string, gated to the period-based bases
// (the frozen seam (h) wording). 'target' is not period-relative, so it adds no
// phrase even under an explicit periodField.
function periodBasisLabel(comparison: KpiPanel['comparison']): string {
  if (!comparison) {
    return '';
  }
  if (comparison.basis === 'prior_period') {
    return 'vs prior period';
  }
  if (comparison.basis === 'window') {
    const n = Math.max(1, Math.trunc(comparison.window ?? 1));
    return `over the last ${n} periods`;
  }
  return '';
}

type ChartPanel = Extract<Panel, { kind: 'chart' }>;

function buildChartResult(
  panel: ChartPanel,
  out: Awaited<ReturnType<typeof vizRenderHandle>>,
  measure?: { displayName?: string; context: MeasureNarrativeContext },
): PanelResult {
  const renderer = out.meta?.renderer ?? 'vega-lite';
  const result = {
    id: panel.id,
    kind: 'chart' as const,
    chartType: panel.chartType,
    renderer,
    ...(panel.title ? { title: panel.title } : {}),
    a11yDescription: out.a11yDescription ?? '',
  } as Record<string, unknown>;
  if (out.spec && Object.keys(out.spec).length > 0) {
    result.spec = out.spec;
  }
  if (out.echartsSpec) {
    result.echartsSpec = out.echartsSpec;
  }
  // FD#10 (sprint-128 m03): propagate the per-panel structured a11y (table +
  // narrative) up to the dashboard surface — viz.render only ran the analyzers
  // when includeA11y was threaded into the per-panel input, so this is present
  // exactly when the dashboard output.includeA11y flag is on.
  if (out.a11y) {
    // s130-m03: when an EXPLICIT chart panel resolved a governed measure, prepend the SAME
    // describeMeasureContext leading finding the KPI/single-chart paths emit (no fork) to this
    // panel's per-panel narrative. Gated on out.a11y (includeA11y on) AND a resolved measure, so
    // an absent measureRef or flag-off is byte-identical. PER-PANEL only — never the cross-panel rollup.
    const measureFinding = measure ? describeMeasureContext(measure.displayName, measure.context) : undefined;
    if (measureFinding && out.a11y.narrative) {
      result.a11y = {
        ...out.a11y,
        narrative: {
          ...out.a11y.narrative,
          keyFindings: [measureFinding, ...out.a11y.narrative.keyFindings],
        },
      };
    } else {
      result.a11y = out.a11y;
    }
  }
  return result as unknown as PanelResult;
}

function buildPanelVizInput(
  panel: ChartPanel,
  datasetRows: Map<string, Row[]>,
  filterRows: (panelId: string, rows: Row[]) => Row[],
  wantEcharts: boolean,
  wantNormalizedSpec: boolean,
  wantA11y: boolean,
  wantA11yEquivalence: boolean,
): VizRenderInput {
  const base: Record<string, unknown> = {
    chartType: panel.chartType,
    // Per-panel compact: the dashboard owns the single tokenCssRef; panels never
    // inline token CSS. ECharts opt-in flows from the dashboard output control.
    output: {
      compact: true,
      ...(wantEcharts ? { echarts: true } : {}),
      ...(wantNormalizedSpec ? { includeNormalizedSpec: true } : {}),
      ...(wantA11y ? { includeA11y: true } : {}),
    },
    // sprint-134 m03 / sprint-135 m03: thread the equivalence flag down so the per-panel
    // cartesian viz.render runs the engine (a no-op on ECharts-primary panels). Forward the
    // EXPLICIT boolean — since viz.render now defaults a11yEquivalence to true (m03), a bare
    // spread would let a dashboard-level opt-out (a11yEquivalence:false) silently re-enable
    // the check at the panel level.
    a11yEquivalence: wantA11yEquivalence,
  };
  if (panel.id) base.id = panel.id;
  if (panel.title) base.name = panel.title;
  if (panel.description) base.description = panel.description;

  if (TABULAR_TYPES.has(panel.chartType)) {
    base.rows = filterRows(panel.id, datasetRows.get(panel.datasetId ?? '') ?? []);
    base.encodings = panel.encodings;
  } else if (panel.chartType === 'treemap' || panel.chartType === 'sunburst') {
    base.hierarchy = panel.hierarchy;
  } else if (panel.chartType === 'sankey') {
    base.sankey = panel.sankey;
  } else if (panel.chartType === 'force_graph') {
    base.network = panel.network;
  } else {
    // choropleth | bubble_map
    base.geo = panel.geo;
  }
  return base as unknown as VizRenderInput;
}

// Reading/focus order (the dashboard-level a11y order). 'declared' keeps the
// authored panel order; 'kpi-first' (default) reuses the m02 layout order, which
// already surfaces the KPI row before charts.
function readingOrder(
  placed: readonly Panel[],
  order: 'kpi-first' | 'declared' | undefined,
  layout: ReadonlyArray<{ id: string }>,
): string[] {
  if (order === 'declared') {
    return placed.map((p) => p.id);
  }
  return layout.map((p) => p.id);
}
