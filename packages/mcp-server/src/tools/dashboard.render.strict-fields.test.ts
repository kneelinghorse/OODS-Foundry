// Opt-in strictFields field-presence check (sprint-118 m05). A field absent from every row is
// the silent-wrong class: a KPI computes value:0, a chart ships a confident-wrong spec — both
// SILENT. strictFields surfaces it as OODS-V131 at the ingestion boundary (never inside
// computeKpi). Flag OFF is byte-identical to the legacy behavior (the frozen-D6 silent-empty
// asymmetry preserved). CI-wired: this colocated test is appended BY NAME to ci.yml:582.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import type { DashboardRenderInput, VizRenderInput } from '../schemas/generated.js';
import { handle } from './dashboard.render.js';
import { handle as vizHandle } from './viz.render.js';

const inputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.input.json', import.meta.url), 'utf8'));
const outputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.output.json', import.meta.url), 'utf8'));
const validateInput = getAjv().compile(inputSchema);
const validateOutput = getAjv().compile(outputSchema);

const ROWS = [
  { region: 'West', revenue: 100 },
  { region: 'East', revenue: 80 },
];

// A dashboard whose FIRST KPI references a TYPO field ('revenuee') absent from the rows, plus a
// healthy sibling that must keep rendering.
function typoKpi(extra: Record<string, unknown> = {}): DashboardRenderInput {
  return {
    schemaVersion: 'v0.1',
    datasets: [{ id: 'sales', rows: ROWS }],
    panels: [
      { id: 'kpi', kind: 'kpi', title: 'Revenue', datasetId: 'sales', field: 'revenuee', aggregate: 'sum' },
      { id: 'good', kind: 'kpi', title: 'OK', datasetId: 'sales', field: 'revenue', aggregate: 'sum' },
    ],
    a11y: { description: 'strict fields' },
    ...extra,
  } as DashboardRenderInput;
}

// Strip the per-call-unique specRef trio for byte-identity comparison (mirror corePayload).
function stripVolatile(out: Record<string, unknown>): Record<string, unknown> {
  const { specRef: _s, specRefCreatedAt: _c, specRefExpiresAt: _e, ...rest } = out;
  return rest;
}

describe('dashboard.render — strictFields field-presence (sprint-118 m05)', () => {
  it('the input schema accepts strictFields', () => {
    expect(validateInput(typoKpi({ strictFields: true }))).toBe(true);
    expect(validateInput(typoKpi())).toBe(true);
  });

  it('accepts encodings.*.type on a chart panel and threads the override into the panel spec (m02 — both surfaces)', async () => {
    // The dashboard.render surface gets the SAME escape hatch as viz.render: an
    // encoding object carrying `type` was AJV-rejected before m02. revenue is a
    // quantitative measure; forcing nominal proves accept + caller-override flow.
    const chartDash = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [
        {
          id: 'chart',
          kind: 'chart',
          chartType: 'scatter',
          datasetId: 'sales',
          encodings: { x: 'region', y: { field: 'revenue', type: 'nominal' } },
        },
      ],
      a11y: { description: 'type override' },
    } as DashboardRenderInput;

    expect(validateInput(chartDash)).toBe(true);
    const out = await handle(chartDash);
    expect(out.status).toBe('ok');
    const chart = out.panels.find((p) => p.id === 'chart') as Record<string, any>;
    expect(chart.kind).toBe('chart');
    expect((chart.spec as Record<string, any>).encoding.y.type).toBe('nominal');
  });

  it('(1) flag OFF: a typo KPI field stays the legacy silent-empty value:0 — no V131 (frozen D6)', async () => {
    const out = await handle(typoKpi());
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi');
    expect(kpi.value).toBe(0); // numericSeries drops the absent field -> aggregate 0
    expect(out.meta?.errorPanelCount).toBe(0);
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V131')).toBe(false);
  });

  it('(2) strict + typo KPI under placeholder -> OODS-V131 error panel, errorPanelCount 1, siblings render', async () => {
    const out = await handle(typoKpi({ strictFields: true }));
    expect(validateOutput(out)).toBe(true);
    expect(out.status).toBe('ok'); // siblings not voided
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V131');
    expect(err.error.severity).toBe('error');
    expect(err.error.message).toContain('revenuee');
    expect(out.meta?.errorPanelCount).toBe(1);
    const good = out.panels.find((p) => p.id === 'good') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(good.kind).toBe('kpi');
    expect(good.value).toBe(180);
  });

  it('(3) strict + onPanelError:"omit" -> dropped + V131 warning; siblings unaffected', async () => {
    const out = await handle(typoKpi({ strictFields: true, onPanelError: 'omit' }));
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined();
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V131' && w.severity === 'warning' && w.message.includes('kpi'))).toBe(true);
    expect(out.panels.find((p) => p.id === 'good')).toBeDefined();
  });

  it('(4) strict + typo CHART encoding -> V131 error panel, NOT a confident-wrong spec', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'bars', kind: 'chart', chartType: 'bar', datasetId: 'sales', encodings: { x: 'region', y: { field: 'revenuee', aggregate: 'sum' } } }],
      a11y: { description: 'strict chart' },
      strictFields: true,
    } as DashboardRenderInput;
    const out = await handle(ir);
    expect(validateOutput(out)).toBe(true);
    const err = out.panels.find((p) => p.id === 'bars') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V131');
    expect(err.error.message).toContain('revenuee');
    expect((err as Record<string, unknown>).spec).toBeUndefined(); // no confident-wrong spec shipped
  });

  it('(5) flag-off is byte-identical to the no-flag path (inertness, specRef trio aside)', async () => {
    const off = await handle(typoKpi({ strictFields: false }));
    const noFlag = await handle(typoKpi());
    expect(JSON.stringify(stripVolatile(off as Record<string, unknown>))).toBe(
      JSON.stringify(stripVolatile(noFlag as Record<string, unknown>)),
    );
  });

  it('standalone viz.render: strict + typo encoding -> V131 WARNING (WARN-by-default, spec still produced)', async () => {
    // a11yEquivalence:false isolates the strictFields WARN contract: since sprint-135 m04 the a11y
    // gate is default-ON and a typo field (absent from every row) ALSO trips A11Y-R-12 (error), which
    // would BLOCK. strictFields itself still only warns; opting out of the a11y gate keeps this a
    // focused strictFields test. (The gate's block-on-missing-field is covered in the a11y parity specs.)
    const out = await vizHandle({
      chartType: 'bar',
      rows: ROWS,
      encodings: { x: 'region', y: 'revenuee' },
      strictFields: true,
      a11yEquivalence: false,
    } as unknown as VizRenderInput);
    expect(out.status).toBe('ok');
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V131' && w.message.includes('revenuee'))).toBe(true);
  });

  it('strict + all fields present is a no-op (the healthy dashboard renders normally)', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'good', kind: 'kpi', title: 'OK', datasetId: 'sales', field: 'revenue', aggregate: 'sum' }],
      a11y: { description: 'all present' },
      strictFields: true,
    } as DashboardRenderInput;
    const out = await handle(ir);
    const kpi = out.panels.find((p) => p.id === 'good') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.value).toBe(180);
    expect(out.meta?.errorPanelCount).toBe(0);
  });
});
