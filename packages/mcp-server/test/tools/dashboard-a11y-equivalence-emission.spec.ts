import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VIZ_EQUIVALENCE_ERROR_DEFINITIONS } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import type { DashboardRenderInput } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/dashboard.render.js';

// Dashboard coverage-parity for the a11y equivalence GATE + fold (sprint-135 m04), mirroring
// test/tools/viz-a11y-equivalence-emission.spec.ts. Root-included via packages/mcp-server/
// vitest.config.ts (`test/**/*.spec.ts`) — NOT colocated, so no ci.yml/golden-guard touch.
//
// Dashboard specifics:
//  - An error-severity a11y failure on a cartesian PANEL diverts to a kind:'error' PANEL via the
//    existing status!=='ok' seam, so dashboard.render.handle ALWAYS returns status:'ok' AND still
//    emits a contentHash — the OPPOSITE of viz.render's omit-on-error (asymmetry, documented below).
//  - Warn-severity per-panel a11y findings fold into dashboard.warnings[] prefixed with the panel id,
//    severity PRESERVED (m04 stopped forcing 'warning').
//  - Default-ON; a11yEquivalence:false opts out byte-identically (#564).

const inputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/dashboard.render.input.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/dashboard.render.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateInput = getAjv().compile(inputSchema);
const validateOutput = getAjv().compile(outputSchema);

const SALES = [
  { region: 'West', month: 'Jan', revenue: 100 },
  { region: 'East', month: 'Jan', revenue: 80 },
  { region: 'West', month: 'Feb', revenue: 120 },
  { region: 'East', month: 'Feb', revenue: 90 },
];
// A bar panel whose measure field is present in every row but NON-NUMERIC → the analysis
// finds no numeric insights → A11Y-R-11 (warn, <2 key findings) while every ERROR rule passes.
// The fold fixture. (Was a heatmap self-tripping R-11 before s149 F6d made heatmaps read
// their COLOR channel as the measure, so a heatmap now surfaces findings and passes R-11.)
const WARN_ROWS = [
  { region: 'North', grade: 'low' }, { region: 'South', grade: 'mid' }, { region: 'East', grade: 'high' },
];
const GEO = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'West' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
    { type: 'Feature', properties: { name: 'East' }, geometry: { type: 'Polygon', coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]] } },
  ],
};

const CONFORMANT_PANELS = [
  { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'sales', encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } } },
  { id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } } },
];
// A y encoding whose field is ABSENT from every row → A11Y-R-12 (error) → error PANEL.
const BAD_PANEL = { id: 'bad', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'nonexistent' } } };
// ECharts-primary (choropleth) — the RENDER-SIDE GATE is cartesian-only, so it is never gated here
// (certify evaluates the rules warn-first for it when the `data` operand is supplied).
const GEO_PANEL = { id: 'geo', kind: 'chart', chartType: 'choropleth', geo: { geojson: GEO, valueField: 'revenue', join: { dataKey: 'region', featureProperty: 'name' }, rows: [{ region: 'West', revenue: 220 }, { region: 'East', revenue: 170 }] } };

const dash = (
  panels: unknown[],
  extra: Record<string, unknown> = {},
  datasets: unknown[] = [{ id: 'sales', rows: SALES }],
): DashboardRenderInput =>
  ({
    schemaVersion: 'v0.1',
    title: 'A11y Parity Dashboard',
    datasets,
    panels,
    a11y: { description: 'Parity dashboard.', readingOrder: 'kpi-first' },
    ...extra,
  }) as DashboardRenderInput;

const render = (input: DashboardRenderInput) => handle(input);
const errorPanels = (out: Awaited<ReturnType<typeof handle>>) => out.panels.filter((p) => p.kind === 'error');
const a11yWarnings = (out: Awaited<ReturnType<typeof handle>>) =>
  (out.warnings ?? []).filter((w) => w.code.startsWith('OODS-A11Y-'));

describe('dashboard.render a11yEquivalence GATE + fold (default-ON, m04)', () => {
  it('default-ON: conformant cartesian panels render with NO error panels, NO a11y warnings, a contentHash', async () => {
    const input = dash(CONFORMANT_PANELS);
    expect(validateInput(input)).toBe(true);
    const out = await render(input);
    expect(out.status).toBe('ok');
    expect(errorPanels(out)).toEqual([]);
    expect(a11yWarnings(out)).toEqual([]);
    expect((out as Record<string, unknown>).contentHash).toBeTypeOf('string');
    expect(validateOutput(out)).toBe(true);
  });

  it('a11y FOLD: a warn-severity panel finding folds into warnings[] prefixed with the panel id, severity PRESERVED', async () => {
    const out = await render(dash(
      [{ id: 'hm', kind: 'chart', chartType: 'bar', datasetId: 'warn', encodings: { x: 'region', y: 'grade' } }],
      {},
      [{ id: 'warn', rows: WARN_ROWS }],
    ));
    expect(out.status).toBe('ok');
    expect(errorPanels(out)).toEqual([]);
    const folded = a11yWarnings(out).filter((w) => w.code === 'OODS-A11Y-R-11');
    expect(folded.length).toBeGreaterThan(0);
    expect(folded[0].message).toContain('panel "hm": '); // panel-id prefix
    expect(folded.every((w) => w.severity === 'warning')).toBe(true); // severity preserved, not forced
  });

  it('an error-severity panel failure becomes an ERROR PANEL carrying the OODS-A11Y code', async () => {
    const out = await render(dash([BAD_PANEL]));
    const errs = errorPanels(out);
    expect(errs.length).toBe(1);
    expect((errs[0] as { error?: { code?: string } }).error?.code).toBe('OODS-A11Y-R-12');
    expect(validateOutput(out)).toBe(true);
  });

  it('an omitted rule-error panel returns a warning, while the rule keeps its intrinsic severity (s225)', async () => {
    const out = await render(dash([BAD_PANEL], { onPanelError: 'omit' }));
    expect(out.panels).toEqual([]);
    expect(a11yWarnings(out)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OODS-A11Y-R-12', severity: 'warning' }),
    ]));
    expect(VIZ_EQUIVALENCE_ERROR_DEFINITIONS.find(rule => rule.code === 'OODS-A11Y-R-12'))
      .toMatchObject({ ruleSeverity: 'error', severity: 'error-or-warning' });
    expect(VIZ_EQUIVALENCE_ERROR_DEFINITIONS.filter(rule => rule.ruleSeverity === 'error')).toHaveLength(11);
    expect(VIZ_EQUIVALENCE_ERROR_DEFINITIONS.filter(rule => rule.ruleSeverity === 'warning')).toHaveLength(5);
  });

  it('an ECharts-primary (choropleth) panel is NOT gated even with the flag ON (the RENDER-SIDE GATE is cartesian-only)', async () => {
    const out = await render(dash([GEO_PANEL], {}, [{ id: 'sales', rows: SALES }]));
    expect(out.status).toBe('ok');
    expect(errorPanels(out)).toEqual([]);
    expect(a11yWarnings(out)).toEqual([]);
  });

  it('flag OFF keeps warnings[] empty AND contentHash byte-identical to flag ON for a conformant dashboard (#564)', async () => {
    const on = await render(dash(CONFORMANT_PANELS, { a11yEquivalence: true }));
    const off = await render(dash(CONFORMANT_PANELS, { a11yEquivalence: false }));
    expect(off.warnings ?? []).toEqual([]);
    expect((off as Record<string, unknown>).contentHash).toBe((on as Record<string, unknown>).contentHash);
  });

  it('a11yEquivalence:false OPTS OUT — a non-conformant panel renders with NO error panel', async () => {
    const out = await render(dash([BAD_PANEL], { a11yEquivalence: false }));
    expect(out.status).toBe('ok');
    expect(errorPanels(out)).toEqual([]);
  });
});

describe('dashboard.render contentHash (determinism identity + error-path asymmetry, m02/m04)', () => {
  it('same input → identical contentHash', async () => {
    const a = await render(dash(CONFORMANT_PANELS));
    const b = await render(dash(CONFORMANT_PANELS));
    expect((a as Record<string, unknown>).contentHash).toBeTypeOf('string');
    expect((a as Record<string, unknown>).contentHash).toBe((b as Record<string, unknown>).contentHash);
  });

  it('a one-field payload mutation → different contentHash', async () => {
    const a = await render(dash(CONFORMANT_PANELS));
    const mutated = [{ ...SALES[0], revenue: 999 }, ...SALES.slice(1)];
    const b = await render(dash(CONFORMANT_PANELS, {}, [{ id: 'sales', rows: mutated }]));
    expect((a as Record<string, unknown>).contentHash).not.toBe((b as Record<string, unknown>).contentHash);
  });

  it('ERROR-PATH ASYMMETRY: an error-panel dashboard is status:ok AND carries a contentHash (opposite of viz.render omit-on-error)', async () => {
    // viz.render OMITS contentHash on status:'error' (see viz-a11y-equivalence-emission.spec.ts).
    // dashboard.render.handle NEVER returns status:'error' — a per-panel error becomes a kind:'error'
    // panel and the dashboard STILL emits a contentHash. Documented so it is not "fixed" into a
    // viz-style omit-on-error.
    const out = await render(dash([BAD_PANEL]));
    expect(out.status).toBe('ok');
    expect(out.panels.some((p) => p.kind === 'error')).toBe(true);
    expect((out as Record<string, unknown>).contentHash).toBeTypeOf('string');
  });
});
