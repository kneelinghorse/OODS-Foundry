import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DashboardRenderInput, DashboardRenderOutput } from '../schemas/generated.js';
import { handle } from './dashboard.render.js';

// Dashboard render-fidelity goldens (sprint-113 m06), layer 2 of 2 — the
// mcp-server BOUNDARY. Pins the composed metric-overview payload so any drift in
// the per-panel composition (layout + KPI + chart specs + geo registration) must
// update a committed snapshot, with a run-twice byte-identity sibling. The
// per-call-unique specRef trio is REDACTED before snapshotting (per
// viz.render.geo-fidelity.test.ts). NOTE: this file is colocated under src/tools/**,
// which the root core/coverage vitest projects EXCLUDE — it is wired into CI by
// name at .github/workflows/ci.yml or it would silently never run.

const GEO = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'West' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
    { type: 'Feature', properties: { name: 'East' }, geometry: { type: 'Polygon', coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]] } },
  ],
};

const METRIC_OVERVIEW: DashboardRenderInput = {
  schemaVersion: 'v0.1',
  title: 'Revenue Overview',
  datasets: [
    {
      id: 'sales',
      rows: [
        { region: 'West', month: 'Jan', revenue: 100 },
        { region: 'East', month: 'Jan', revenue: 80 },
        { region: 'West', month: 'Feb', revenue: 120 },
        { region: 'East', month: 'Feb', revenue: 90 },
      ],
    },
  ],
  panels: [
    { id: 'kpi-rev', kind: 'kpi', title: 'Total Revenue', datasetId: 'sales', field: 'revenue', aggregate: 'sum', comparison: { basis: 'target', value: 300 }, threshold: { direction: 'above', value: 350 } },
    { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'sales', encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } } },
    { id: 'breakdown', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'revenue', aggregate: 'sum' } } },
    { id: 'geo', kind: 'chart', chartType: 'choropleth', geo: { geojson: GEO, valueField: 'revenue', join: { dataKey: 'region', featureProperty: 'name' }, rows: [{ region: 'West', revenue: 220 }, { region: 'East', revenue: 170 }] } },
  ],
  layout: { columns: 12, placements: [{ panelId: 'kpi-rev', gridSpan: 3 }] },
  links: [{ source: 'breakdown', target: 'trend', sourceField: 'region', operator: 'in' }],
  a11y: { description: 'Revenue overview dashboard.', readingOrder: 'kpi-first' },
} as DashboardRenderInput;

// Strip the per-call-unique specRef trio so the committed golden is stable.
function redact(out: DashboardRenderOutput): Omit<DashboardRenderOutput, 'specRef' | 'specRefCreatedAt' | 'specRefExpiresAt'> {
  const { specRef: _r, specRefCreatedAt: _c, specRefExpiresAt: _e, ...rest } = out;
  return rest;
}

// Period-axis variant (sprint-114 m05): an explicit periodField drives the KPI
// onto a parsed + sorted time axis. Rows are intentionally out of period order
// so the snapshot locks the SORTED compute (latest = max period) + the period-
// gated a11y wording, distinct from the row-order METRIC_OVERVIEW above.
const PERIOD_OVERVIEW: DashboardRenderInput = {
  schemaVersion: 'v0.1',
  title: 'Monthly Revenue (period axis)',
  datasets: [
    {
      id: 'sales',
      rows: [
        { region: 'West', month: '2024-03', revenue: 120 },
        { region: 'West', month: '2024-01', revenue: 100 },
        { region: 'West', month: '2024-02', revenue: 110 },
      ],
    },
  ],
  panels: [
    { id: 'kpi-rev', kind: 'kpi', title: 'Latest Revenue', datasetId: 'sales', field: 'revenue', periodField: 'month', aggregate: 'latest', comparison: { basis: 'prior_period' } },
    { id: 'trend', kind: 'chart', chartType: 'line', datasetId: 'sales', encodings: { x: 'month', y: { field: 'revenue', aggregate: 'sum' } } },
  ],
  a11y: { description: 'Monthly revenue with an explicit period axis.' },
} as DashboardRenderInput;

describe('dashboard.render render-fidelity goldens (sprint-113 m06)', () => {
  it('the metric-overview composed payload matches the committed golden', async () => {
    const out = await handle(METRIC_OVERVIEW);
    expect(out.status).toBe('ok');
    expect(redact(out)).toMatchSnapshot();
  });

  it('same input -> byte-identical composed payload (determinism gate)', async () => {
    const a = redact(await handle(METRIC_OVERVIEW));
    const b = redact(await handle(METRIC_OVERVIEW));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the period-axis composed payload matches the committed golden (v0.2)', async () => {
    const out = await handle(PERIOD_OVERVIEW);
    expect(out.status).toBe('ok');
    const kpi = out.panels.find((p) => p.id === 'kpi-rev') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.value).toBe(120); // max period (2024-03)
    expect(kpi.delta).toBe(10); // vs prior period (2024-02 = 110)
    expect(kpi.a11yDescription).toBe('Latest Revenue: 120 (increasing, delta 10 vs prior period).');
    expect(redact(out)).toMatchSnapshot();
  });

  it('period-axis: same input -> byte-identical composed payload (determinism gate)', async () => {
    const a = redact(await handle(PERIOD_OVERVIEW));
    const b = redact(await handle(PERIOD_OVERVIEW));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// Sprint-115 m05 — the net-new RENDERED-OUTPUT (HTML) golden harness + the opt-in
// additivity parity proof. The METRIC_OVERVIEW golden above is the s114 byte-level
// baseline (its snapshot must show 0 deletions); these add the export-path goldens.
const METRIC_OVERVIEW_HTML: DashboardRenderInput = { ...METRIC_OVERVIEW, output: { html: true } } as DashboardRenderInput;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function chartHashes(out: DashboardRenderOutput): Record<string, string | undefined> {
  return Object.fromEntries(
    out.panels
      .filter((panel) => panel.kind === 'chart')
      .map((panel) => [panel.id, (panel as typeof panel & { contentHash?: string }).contentHash]),
  );
}

describe('dashboard.render output.html export goldens (sprint-115 m05)', () => {
  it('the output.html=true HTML export matches the committed golden (SVG panels + KPI + geo chart + inlined tokens + narrative)', async () => {
    const out = await handle(METRIC_OVERVIEW_HTML);
    expect(out.status).toBe('ok');
    expect(typeof out.html).toBe('string');
    expect(out.html).toMatchSnapshot();
  });

  it('output.html=true -> byte-identical HTML run-to-run (rendered-output determinism gate)', async () => {
    const a = await handle(METRIC_OVERVIEW_HTML);
    const b = await handle(METRIC_OVERVIEW_HTML);
    expect(a.html).toBe(b.html);
  });

  it('R-B: outputHtmlHash identifies the exact HTML bytes and is stable across a no-op rerender', async () => {
    const a = await handle(METRIC_OVERVIEW_HTML);
    const b = await handle(METRIC_OVERVIEW_HTML);
    const aWithHtmlHash = a as DashboardRenderOutput & { outputHtmlHash?: string };
    const bWithHtmlHash = b as DashboardRenderOutput & { outputHtmlHash?: string };

    expect(a.html).toBeTypeOf('string');
    expect(aWithHtmlHash.outputHtmlHash).toBe(sha256(a.html!));
    expect(bWithHtmlHash.outputHtmlHash).toBe(aWithHtmlHash.outputHtmlHash);
  });

  it('R-B: outputHtmlHash is absent without HTML output', async () => {
    const out = await handle(METRIC_OVERVIEW) as DashboardRenderOutput & { outputHtmlHash?: string };
    expect(out.html).toBeUndefined();
    expect(out.outputHtmlHash).toBeUndefined();
  });

  it('R-B: brand changes HTML scope and, since s222-m02, every chart panel with it', async () => {
    const brandA = await handle({ ...METRIC_OVERVIEW_HTML, brand: 'A' } as DashboardRenderInput);
    const brandB = await handle({ ...METRIC_OVERVIEW_HTML, brand: 'B' } as DashboardRenderInput);
    const brandAWithHtmlHash = brandA as DashboardRenderOutput & { outputHtmlHash?: string };
    const brandBWithHtmlHash = brandB as DashboardRenderOutput & { outputHtmlHash?: string };
    const brandAPanelHashes = chartHashes(brandA);

    expect(brandAWithHtmlHash.outputHtmlHash).not.toBe(brandBWithHtmlHash.outputHtmlHash);
    expect(Object.values(brandAPanelHashes)).toHaveLength(3);
    for (const hash of Object.values(brandAPanelHashes)) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(brandA.html).toContain('data-brand="A"');
    expect(brandB.html).toContain('data-brand="B"');
    // s222-m02 (#2502 ruling 12): charts follow the brand's recipe, so each panel's chart identity moves with the brand;
    // under the s197 shared palette the three were identical across brands. One brand's charts stay deterministic.
    const brandBPanelHashes = chartHashes(brandB);
    expect(Object.keys(brandBPanelHashes)).toEqual(Object.keys(brandAPanelHashes));
    for (const [panel, hash] of Object.entries(brandAPanelHashes)) expect(brandBPanelHashes[panel]).not.toBe(hash);
    expect(chartHashes(await handle({ ...METRIC_OVERVIEW_HTML, brand: 'A' }))).toEqual(brandAPanelHashes);
  });

  it('R-B: a panel-data edit moves HTML identity', async () => {
    const edited = {
      ...METRIC_OVERVIEW_HTML,
      datasets: METRIC_OVERVIEW.datasets.map((dataset) => ({
        ...dataset,
        rows: dataset.rows.map((row, index) => index === 0 ? { ...row, revenue: 101 } : row),
      })),
    } as DashboardRenderInput;
    const baseline = await handle(METRIC_OVERVIEW_HTML) as DashboardRenderOutput & { outputHtmlHash?: string };
    const changed = await handle(edited) as DashboardRenderOutput & { outputHtmlHash?: string };

    expect(changed.outputHtmlHash).not.toBe(baseline.outputHtmlHash);
  });

  it('ECharts-primary HTML draws normalized SVG with an accessible figure', async () => {
    const out = await handle(METRIC_OVERVIEW_HTML);
    expect(out.html).not.toContain('oods-placeholder-geo');
    // Each chart panel has a native narrow render, including ECharts; the KPI adds one sparkline.
    // Narrow containers select their authored variant rather than shrinking desktop labels.
    expect(out.html?.match(/<svg/g)).toHaveLength(7);
    expect(out.html?.match(/<div class="oods-chart-size-0"[^>]*><svg/g)).toHaveLength(3);
    expect(out.html?.match(/class="oods-kpi-sparkline"/g)).toHaveLength(1);
    expect(out.html).toContain('aria-label="Choropleth map of regional values."');
    expect(out.html).not.toContain('<canvas');
  });

  it('additivity parity: output.html ABSENT is byte-identical to the s114 baseline (no leaked export surface)', async () => {
    const out = await handle(METRIC_OVERVIEW);
    // No export field, no output echo, no computed narrative leaked onto the default path.
    expect(out.html).toBeUndefined();
    expect(out.output).toEqual({ compact: true });
    expect((out.a11y as Record<string, unknown>).narrative).toBeUndefined();
    // Numbers AND the existing a11y string match the s114 baseline (the byte-level proof,
    // alongside the unchanged METRIC_OVERVIEW snapshot = 0 deletions above).
    const kpi = out.panels.find((p) => p.id === 'kpi-rev') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.value).toBe(390);
    expect(kpi.delta).toBe(90);
    expect(kpi.thresholdBreached).toBe(true);
    expect(kpi.a11yDescription).toBe('Total Revenue: 390 (increasing, delta 90).');
  });

  it('additivity parity: resolveMeasures=false leaves the inert KPI measureRef payload byte-identical (sprint-116)', async () => {
    // Clone METRIC_OVERVIEW (NEVER mutate the shared constant — it backs the
    // golden above) and add the governed-measure tag to the KPI panel. The ENTIRE
    // composed payload must stay byte-identical to the baseline: measureRef is
    // unread by compute with resolveMeasures=false and never echoed onto the output. This is the byte-level
    // proof that the descriptor re-bakes no golden.
    const withRef = {
      ...METRIC_OVERVIEW,
      resolveMeasures: false,
      panels: METRIC_OVERVIEW.panels.map((p, i) =>
        i === 0
          ? { ...(p as Record<string, unknown>), measureRef: 'gm.revenue' }
          : { ...(p as Record<string, unknown>) }),
    } as DashboardRenderInput;
    const baseline = redact(await handle(METRIC_OVERVIEW));
    const withRefOut = redact(await handle(withRef));
    expect(JSON.stringify(withRefOut)).toBe(JSON.stringify(baseline));
  });

  it('additivity parity: resolveMeasures=true + a KNOWN measureRef ("gm.revenue.total") leaves the composed payload byte-identical to the baseline (sprint-117)', async () => {
    // gm.revenue.total resolves to the SAME field/aggregate the golden panel already
    // declares, and injects no comparison/threshold the author didn't already supply,
    // so the ENTIRE composed payload must stay byte-identical to METRIC_OVERVIEW. This
    // is the RESOLVED-but-identical proof (the flag-ON sibling of the inert clone
    // above) — no toMatchSnapshot, so the committed METRIC_OVERVIEW snapshot is
    // untouched (0 deletions).
    const resolved = {
      ...METRIC_OVERVIEW,
      resolveMeasures: true,
      panels: METRIC_OVERVIEW.panels.map((p, i) =>
        i === 0
          ? { ...(p as Record<string, unknown>), measureRef: 'gm.revenue.total' }
          : { ...(p as Record<string, unknown>) }),
    } as DashboardRenderInput;
    const baseline = redact(await handle(METRIC_OVERVIEW));
    const resolvedOut = redact(await handle(resolved));
    expect(JSON.stringify(resolvedOut)).toBe(JSON.stringify(baseline));
  });
});

// Sprint-119 m03 — the opt-in structured a11yContrast block. Default-off is
// byte-identical (the block is ABSENT, the METRIC_OVERVIEW golden above shows 0
// deletions); contrastScan=true echoes the SAME findings the OODS-V135 warnings
// carry, as a machine-readable mirror under a new snapshot key.
const METRIC_OVERVIEW_CONTRAST: DashboardRenderInput = {
  ...METRIC_OVERVIEW,
  output: { contrastScan: true },
} as DashboardRenderInput;

describe('dashboard.render a11yContrast output block (sprint-119 m03)', () => {
  it('additivity: contrastScan ABSENT leaves a11yContrast undefined + output echo unchanged (byte-identical)', async () => {
    const out = await handle(METRIC_OVERVIEW);
    expect(out.a11yContrast).toBeUndefined();
    expect(out.output).toEqual({ compact: true });
  });

  it('contrastScan=true emits a structured block whose findings mirror the OODS-V135 warning pairs', async () => {
    const out = await handle(METRIC_OVERVIEW_CONTRAST);
    expect(out.status).toBe('ok');
    expect(out.a11yContrast).toBeDefined();
    const block = out.a11yContrast!;
    const v135 = (out.warnings ?? []).filter((w) => w.code === 'OODS-V135');
    // The block is the machine-readable mirror of the V135 warnings: same count, same
    // pairs, every finding a 'warning'-severity row, and the summary counts the failures.
    expect(block.findings).toHaveLength(v135.length);
    for (const finding of block.findings) {
      expect(finding.severity).toBe('warning');
      expect(v135.some((w) => w.message.includes(`"${finding.pair}"`))).toBe(true);
    }
    // s169 m04 — `gradedPairs` is the ONE chartered golden movement of this sprint, and it
    // is asserted as a LITERAL 4, not as `block.summary.gradedPairs`. The whole defect this
    // field exists to expose was a scan that measured nothing while reporting `failing: 0`;
    // a self-referential assertion would have been just as green then as now.
    expect(block.summary).toEqual({ failing: block.findings.length, gradedPairs: 4 });
    expect(block).toMatchSnapshot();
  });

  it('contrastScan=true -> byte-identical a11yContrast block run-to-run (determinism gate)', async () => {
    const a = await handle(METRIC_OVERVIEW_CONTRAST);
    const b = await handle(METRIC_OVERVIEW_CONTRAST);
    expect(JSON.stringify(a.a11yContrast)).toBe(JSON.stringify(b.a11yContrast));
  });
});
