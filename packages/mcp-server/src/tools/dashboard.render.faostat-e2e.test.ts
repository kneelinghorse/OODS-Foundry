// FAOSTAT agent-pipeline E2E + the red baseline for sprint-118 (Demo 01 "Follow your
// breakfast"). An agent drives viz.render (suggest → explicit charts → choropleth) and
// dashboard.render (KPI measureRef + resolveMeasures + a geo cross-filter source +
// output.html) end-to-end on a real FAOSTAT TradeFlow slice — the ROWS and the inline
// geometry arrive as PARAMETERS (Forge never reads a filesystem).
//
// ── THE RED BASELINE (what makes this the durable seed of the Phase-4 eval harness) ──
// The SIX deliberate bug-shakers in the fixture each define what "fixed" means for a later
// mission. They are RED today and each flips GREEN when its mission lands. They are written
// as `it.fails(...)`: the assertion states the DESIRED (fixed) behavior, which currently
// throws — so the test PASSES today (CI stays green; pure-additive floor holds) while
// documenting the not-yet-true contract. When the owning mission implements the fix, the
// desired assertion starts passing, `it.fails` itself goes RED, and that mission converts
// the test to a plain `it(...)` (removing `.fails`, wiring any new opt-in flag). This is a
// DELIBERATE departure from the package norm (no other test here uses `.fails`); it is the
// precise vitest idiom for a backlog-proof red→green gate and is the mission's explicit ask.
//   #1 → m05 (OODS-V131 field-presence)       #4 → m07 (a11y data-quality, E/I/X flags)
//   #2 → m03 (OODS-V133 non-additive-rollup)  #5 → m04 (recommender honesty)
//   #3 → m06 (OODS-V134 geo-join-unmatched)   #6 → m04 (numeric→ordinal inference)
//
// CI TRAP (s113): this colocated src/tools/*.test.ts is NOT auto-discovered by the CI
// goldens step — it runs ONLY because it is appended BY NAME to the `vitest run <files>`
// list at .github/workflows/ci.yml (the "Run colocated viz.render + dashboard.render
// goldens" step). Do not remove it from that line.
//
// ADDITIVE FLOOR: structural assertions only — NO toMatchSnapshot here, so the 31KB
// METRIC_OVERVIEW golden and the 4 geo/network/fidelity snaps are never touched.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import type { DashboardRenderInput, VizRenderInput } from '../schemas/generated.js';
import { handle as renderDashboard } from './dashboard.render.js';
import { handle as renderViz } from './viz.render.js';
import {
  CPC_HIERARCHY,
  EXPORT_VALUE_TIMESERIES,
  GEO_BUBBLE_ROWS,
  GEO_VALUE_ROWS,
  ORDINAL_TRAP_FIELD,
  SANKEY_FLOWS,
  TRADEFLOW_ROWS,
  TYPO_FIELD,
  WORLD_FEATURES,
} from './__fixtures__/faostat-tradeflow.fixture.js';

// Reconstruct the server boundary in-test: compile the SAME schema JSONs the dispatch loop
// uses (getAjv()) and call handle() directly with the raw input IR.
const vizInputSchema = JSON.parse(readFileSync(new URL('../schemas/viz.render.input.json', import.meta.url), 'utf8'));
const vizOutputSchema = JSON.parse(readFileSync(new URL('../schemas/viz.render.output.json', import.meta.url), 'utf8'));
const dashInputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.input.json', import.meta.url), 'utf8'));
const dashOutputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.output.json', import.meta.url), 'utf8'));
const validateVizInput = getAjv().compile(vizInputSchema);
const validateVizOutput = getAjv().compile(vizOutputSchema);
const validateDashInput = getAjv().compile(dashInputSchema);
const validateDashOutput = getAjv().compile(dashOutputSchema);

const viz = (input: Record<string, unknown>) => renderViz(input as unknown as VizRenderInput);
const dash = (input: Record<string, unknown>) => renderDashboard(input as unknown as DashboardRenderInput);

// All OODS codes an output surfaced — warnings + (for dashboards) error-panel codes.
function outputCodes(out: Record<string, unknown>): string[] {
  const warnings = (out.warnings as Array<{ code: string }> | undefined) ?? [];
  const panels = (out.panels as Array<Record<string, unknown>> | undefined) ?? [];
  const errorPanelCodes = panels
    .filter((p) => p.kind === 'error')
    .map((p) => (p.error as { code: string }).code);
  const errors = (out.errors as Array<{ code: string }> | undefined) ?? [];
  return [...warnings.map((w) => w.code), ...errors.map((e) => e.code), ...errorPanelCodes];
}

const EXPECTED_TOTAL = TRADEFLOW_ROWS.reduce((sum, r) => sum + r.value, 0);

describe('FAOSTAT agent pipeline — viz.render + dashboard.render run end-to-end on a real slice', () => {
  it('viz.render suggest mode infers field profiles and resolves a chart type', async () => {
    const input = { rows: TRADEFLOW_ROWS };
    expect(validateVizInput(input)).toBe(true);
    const out = await viz(input);
    expect(validateVizOutput(out)).toBe(true);
    expect(out.status).toBe('ok');
    expect(out.mode).toBe('suggest');
    expect((out.meta?.inferredFields ?? []).length).toBeGreaterThan(0);
  });

  it('viz.render renders the explicit tabular charts (line over a year axis, scatter value×quantity)', async () => {
    const line = { chartType: 'line', rows: EXPORT_VALUE_TIMESERIES, encodings: { x: 'year', y: { field: 'value', aggregate: 'sum' } } };
    const scatter = { chartType: 'scatter', rows: TRADEFLOW_ROWS, encodings: { x: 'quantity', y: 'value' } };
    expect(validateVizInput(line)).toBe(true);
    expect(validateVizInput(scatter)).toBe(true);
    const lineOut = await viz(line);
    const scatterOut = await viz(scatter);
    expect(lineOut.status).toBe('ok');
    expect(lineOut.chartType).toBe('line');
    expect(scatterOut.status).toBe('ok');
    expect(scatterOut.chartType).toBe('scatter');
  });

  it('viz.render renders the explicit hierarchy/flow charts (treemap, sunburst, sankey)', async () => {
    const treemap = { chartType: 'treemap', hierarchy: { type: 'nested', data: CPC_HIERARCHY } };
    const sunburst = { chartType: 'sunburst', hierarchy: { type: 'nested', data: CPC_HIERARCHY } };
    const sankey = { chartType: 'sankey', sankey: SANKEY_FLOWS };
    for (const input of [treemap, sunburst, sankey]) {
      expect(validateVizInput(input)).toBe(true);
      const out = await viz(input);
      expect(out.status).toBe('ok');
      expect(out.echartsSpec).toBeDefined();
    }
  });

  it('viz.render renders an explicit choropleth from inline geometry and rides __registration back', async () => {
    const input = {
      chartType: 'choropleth',
      geo: { geojson: WORLD_FEATURES, rows: GEO_VALUE_ROWS, join: { dataKey: 'partner_m49', featureProperty: 'm49' }, valueField: 'value', colorScale: 'linear' },
    };
    expect(validateVizInput(input)).toBe(true);
    const out = await viz(input);
    expect(validateVizOutput(out)).toBe(true);
    expect(out.status).toBe('ok');
    expect(out.chartType).toBe('choropleth');
    // Geo specs are NOT self-contained: the resolved FeatureCollection rides back so the
    // client can re-register the map by name before rendering.
    expect((out.echartsSpec as Record<string, unknown>).__registration).toBeDefined();
  });

  it('dashboard.render composes the KPI + geo source + HTML export pipeline on FAOSTAT rows', async () => {
    // KPI computes the additive export-value total from a plain field (governed-measure
    // RESOLUTION of the fixture measures is exercised by bug-shaker #2; those measures are
    // not in the production registry until m03). The choropleth is a non-tabular cross-filter
    // SOURCE, so its link MUST carry an explicit sourceField (frozen seam ii).
    const ir = {
      schemaVersion: 'v0.1',
      title: 'FAOSTAT Trade Flows',
      datasets: [{ id: 'flows', rows: TRADEFLOW_ROWS }],
      panels: [
        { id: 'kpi-total', kind: 'kpi', title: 'Total Export Value', datasetId: 'flows', field: 'value', aggregate: 'sum' },
        { id: 'by-partner', kind: 'chart', chartType: 'bar', datasetId: 'flows', encodings: { x: 'partner', y: { field: 'value', aggregate: 'sum' } } },
        { id: 'geo', kind: 'chart', chartType: 'choropleth', geo: { geojson: WORLD_FEATURES, valueField: 'value', join: { dataKey: 'partner_m49', featureProperty: 'm49' }, rows: GEO_VALUE_ROWS } },
      ],
      links: [{ source: 'geo', target: 'by-partner', sourceField: 'partner', operator: 'in' }],
      a11y: { description: 'FAOSTAT trade-flow overview dashboard.' },
      output: { html: true },
    };
    expect(validateDashInput(ir)).toBe(true);
    const out = await dash(ir);
    expect(validateDashOutput(out)).toBe(true);
    expect(out.status).toBe('ok');

    const byId = Object.fromEntries(out.panels.map((p) => [p.id, p]));
    const kpi = byId['kpi-total'] as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi');
    expect(kpi.value).toBe(EXPECTED_TOTAL);

    const geo = byId['geo'] as Extract<typeof out.panels[number], { kind: 'chart' }>;
    expect(geo.renderer).toBe('echarts');
    expect((geo.echartsSpec as Record<string, unknown>).__registration).toBeDefined();

    // The opt-in HTML export is a self-contained document.
    const html = out.html as string;
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Total Export Value');
  });
});

describe('FAOSTAT red baseline — six bug-shakers (it.fails: RED today, each flips GREEN when its mission lands)', () => {
  // FLIPPED GREEN by m05 (was it.fails): the opt-in strictFields flag surfaces the absent 'valuee'
  // encoding field as OODS-V131 (WARN) instead of a silent confident-wrong spec. AJV cannot catch
  // it (encoding fields are free strings), so the gap is downstream — strictFields closes it.
  it('bug-shaker #1 (m05, OODS-V131): a typo encoding field "valuee" surfaces a field-absence error under strictFields', async () => {
    const input = { chartType: 'bar', rows: TRADEFLOW_ROWS, encodings: { x: 'partner', y: TYPO_FIELD }, strictFields: true };
    expect(validateVizInput(input)).toBe(true);
    const out = await viz(input);
    expect(outputCodes(out as Record<string, unknown>)).toContain('OODS-V131');
  });

  // FLIPPED GREEN by m03 (was it.fails): gm.export.unit_price is now registered (additive:false)
  // and the resolver's additivity gate blocks the `sum` rollup with OODS-V133.
  it('bug-shaker #2 (m03, OODS-V133): summing the NON-additive unit_price measure is blocked', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'flows', rows: TRADEFLOW_ROWS }],
      panels: [{ id: 'kpi-price', kind: 'kpi', title: 'Export Unit Price', datasetId: 'flows', field: 'unit_price', aggregate: 'sum', measureRef: 'gm.export.unit_price' }],
      a11y: { description: 'non-additive rollup gate' },
      resolveMeasures: true,
    };
    const out = await dash(ir);
    expect(outputCodes(out as Record<string, unknown>)).toContain('OODS-V133');
  });

  // FLIPPED GREEN by m06 (was it.fails): under strictFields, the unmatched India→Kazakhstan
  // corridor (partner_m49 '398', absent from WORLD_FEATURES) surfaces as OODS-V134 instead of a
  // silent drop. Flag OFF stays byte-identical (silent drop preserved, no __joinDiagnostics leak).
  it('bug-shaker #3 (m06, OODS-V134): an unmatched choropleth corridor surfaces under strictFields, not a silent drop', async () => {
    const geo = { geojson: WORLD_FEATURES, rows: GEO_VALUE_ROWS, join: { dataKey: 'partner_m49', featureProperty: 'm49' }, valueField: 'value', colorScale: 'linear' };
    const out = await viz({ chartType: 'choropleth', geo, strictFields: true });
    expect(outputCodes(out as Record<string, unknown>)).toContain('OODS-V134');

    const off = await viz({ chartType: 'choropleth', geo });
    expect((off.warnings ?? []).some((w) => w.code === 'OODS-V134')).toBe(false);
    expect((off.echartsSpec as Record<string, unknown>).__joinDiagnostics).toBeUndefined();
  });

  // FLIPPED GREEN by m07 (was it.fails): under output.dataTable + output.dataQualityField, the SR
  // data-table caption tallies the FAOSTAT E/I/X quality flags instead of silently dropping them.
  // (m07 surfaces E/I/X in the SR data-table caption, NOT a warning — so this gate probes the HTML.)
  it('bug-shaker #4 (m07, a11y data-quality): FAOSTAT E/I/X quality flags surface in the SR data-table caption', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'flows', rows: TRADEFLOW_ROWS }],
      panels: [{ id: 'by-partner', kind: 'chart', chartType: 'bar', datasetId: 'flows', encodings: { x: 'partner', y: { field: 'value', aggregate: 'sum' } } }],
      a11y: { description: 'FAOSTAT trade-flow bars by partner.' },
      output: { html: true, dataTable: true, dataQualityField: 'flag' },
    };
    const out = await dash(ir);
    const html = (out.html ?? '') as string;
    expect(html).toContain('oods-chart-data'); // the SR data-table is present
    expect(html).toMatch(/<caption>Data quality:/); // E/I/X tally caption
    expect(html).toMatch(/estimated/);
    expect(html).toMatch(/imputed/);
  });

  // FLIPPED GREEN by m04 (was it.fails): GEO_BUBBLE_ROWS carries lat/lon coordinates, so the
  // recommender now flags lowConfidence + a geo rationale instead of a confident bar.
  it('bug-shaker #5 (m04, recommender honesty): geo-shaped (lat/lon) data fed to suggest flags lowConfidence, not a confident bar', async () => {
    const out = await viz({ rows: GEO_BUBBLE_ROWS });
    expect(out.mode).toBe('suggest');
    expect(out.lowConfidence).toBe(true);
    // the rationale points the agent at the explicit geo charts.
    expect((out.suggestion?.rationale ?? []).some((r) => /choropleth|bubble_map/.test(r))).toBe(true);
  });

  // FLIPPED GREEN by m04 (was it.fails): nameHintsMeasure keeps the measure-named ('qty')
  // low-cardinality integer column quantitative instead of misinferring it 'ordinal'.
  it('bug-shaker #6 (m04, numeric→ordinal): the measure-named low-cardinality integer column infers as a quantitative measure', async () => {
    const out = await viz({ rows: TRADEFLOW_ROWS });
    const sc = (out.meta?.inferredFields ?? []).find((f) => f.name === ORDINAL_TRAP_FIELD);
    expect(sc).toBeDefined();
    expect(sc?.type).toBe('quantitative');
  });
});
