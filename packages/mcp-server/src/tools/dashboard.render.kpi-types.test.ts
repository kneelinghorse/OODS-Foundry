// KPI cell-type semantics at the dashboard.render boundary (sprint-175 m05, decision 11 —
// Dashboard-demos FD#1). At HEAD 852be47 a KPI `count` over a string field rendered value:0
// with error null and warnings [] (even under strictFields/strictDatasets), and a numeric
// aggregate over an all-string field did the same. Now: count/distinct count non-null cells
// of any type (COUNT(field)); a numeric aggregate over a field with values but no numeric
// cell surfaces as an OODS-V160 error panel through the SAME onPanelError seam as V137
// (placeholder -> error panel, omit -> warning + dropped), caught by the NEW try/catch
// around the KPI branch (buildKpiResult sat outside every catch before this sprint). The
// ratified silent paths are pinned unchanged: absent field + strictFields OFF stays value:0.
// NOTE: this suite resolves @oods/viz-core to DIST — rebuild viz-core before running it.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import type { DashboardRenderInput } from '../schemas/generated.js';
import { handle } from './dashboard.render.js';

const outputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.output.json', import.meta.url), 'utf8'));
const validateOutput = getAjv().compile(outputSchema);

// The FD#1 reproduction rows, verbatim from docs/FORGE-FEEDBACK.md.
const SURFACE = [{ chartType: 'bar' }, { chartType: 'line' }, { chartType: 'bar' }];

function dash(panels: Record<string, unknown>[], extra: Record<string, unknown> = {}): DashboardRenderInput {
  return {
    schemaVersion: 'v0.1',
    datasets: [{ id: 'surface', rows: SURFACE }],
    panels,
    a11y: { description: 'three rows' },
    ...extra,
  } as DashboardRenderInput;
}
const countPanel = { id: 'k', kind: 'kpi', title: 'Chart types', datasetId: 'surface', field: 'chartType', aggregate: 'count' };
const sumPanel = { id: 's', kind: 'kpi', title: 'Sum of types', datasetId: 'surface', field: 'chartType', aggregate: 'sum' };

type KpiOut = Extract<Awaited<ReturnType<typeof handle>>['panels'][number], { kind: 'kpi' }>;
type ErrOut = Extract<Awaited<ReturnType<typeof handle>>['panels'][number], { kind: 'error' }>;

describe('dashboard.render — KPI cell-type semantics (sprint-175 m05, FD#1 + OODS-V160)', () => {
  it('count over string cells -> value 3, a11y "Chart types: 3." (HEAD: 0) for {} and {strictFields:true}', async () => {
    for (const extra of [{}, { strictFields: true }]) {
      const out = await handle(dash([countPanel], extra));
      expect(validateOutput(out)).toBe(true);
      expect(out.status).toBe('ok');
      const k = out.panels.find((p) => p.id === 'k') as KpiOut;
      expect(k.kind).toBe('kpi');
      expect(k.value).toBe(3);
      expect(k.formatted).toBe('3');
      expect(k.a11yDescription).toBe('Chart types: 3.');
      expect(out.warnings ?? []).toEqual([]);
      expect(out.meta?.errorPanelCount).toBe(0);
    }
  });

  it("distinct over ['bar','line','bar'] -> 2", async () => {
    const out = await handle(dash([{ ...countPanel, aggregate: 'distinct' }]));
    expect((out.panels.find((p) => p.id === 'k') as KpiOut).value).toBe(2);
  });

  it('sum over an all-string field -> OODS-V160 error panel (placeholder); the count sibling still renders', async () => {
    const out = await handle(dash([sumPanel, countPanel]));
    expect(validateOutput(out)).toBe(true);
    expect(out.status).toBe('ok'); // the dashboard is not voided
    const err = out.panels.find((p) => p.id === 's') as ErrOut;
    expect(err.kind).toBe('error'); // NOT a kpi with value:0
    expect(err.title).toBe('Sum of types');
    expect(err.error.code).toBe('OODS-V160');
    expect(err.error.severity).toBe('error');
    expect(err.error.message).toContain('"s"');
    expect(err.error.message).toContain('chartType');
    expect(err.error.message).toContain('no numeric cells');
    expect(err.a11yDescription).toContain('could not be rendered');
    expect(out.meta?.errorPanelCount).toBe(1);
    const k = out.panels.find((p) => p.id === 'k') as KpiOut;
    expect(k.kind).toBe('kpi');
    expect(k.value).toBe(3);
    // The error panel keeps its layout slot (mirrors V137's placedPanels.push).
    // `layout` is a FLAT array of placements keyed `id` (dashboard.render.test.ts:118), not
    // {placements:[{panelId}]} — corrected 2026-08-22 when the assertion first ran.
    expect((out.layout ?? []).map((pl) => pl.id)).toEqual(['s', 'k']);
  });

  it('sum over an all-string field + onPanelError:"omit" -> V160 warning + dropped; sibling unaffected', async () => {
    const out = await handle(dash([sumPanel, countPanel], { onPanelError: 'omit' }));
    expect(validateOutput(out)).toBe(true);
    expect(out.panels.find((p) => p.id === 's')).toBeUndefined();
    expect(
      (out.warnings ?? []).some((w) => w.code === 'OODS-V160' && w.severity === 'warning' && w.message.includes('"s"')),
    ).toBe(true);
    expect(out.meta?.errorPanelCount).toBe(0);
    expect((out.panels.find((p) => p.id === 'k') as KpiOut).value).toBe(3);
  });

  it('every numeric aggregate trips V160 over the all-string field; count/distinct never do', async () => {
    for (const aggregate of ['sum', 'average', 'median', 'min', 'max', 'latest']) {
      const out = await handle(dash([{ ...sumPanel, aggregate }]));
      expect((out.panels.find((p) => p.id === 's') as ErrOut).error?.code, aggregate).toBe('OODS-V160');
    }
    for (const aggregate of ['count', 'distinct']) {
      const out = await handle(dash([{ ...sumPanel, aggregate }]));
      expect((out.panels.find((p) => p.id === 's') as KpiOut).kind, aggregate).toBe('kpi');
    }
  });

  it('V160 is a cell-TYPE gate, not a field-presence gate: strictFields OFF + a typo field stays the silent value:0', async () => {
    // The ratified s118 asymmetry (strict-fields.test.ts "(1) flag OFF: typo KPI field stays value:0")
    // is untouched: a field absent from every row has ZERO non-null cells, so computeKpi does not throw.
    const out = await handle(dash([{ ...sumPanel, field: 'chartTypee' }]));
    const s = out.panels.find((p) => p.id === 's') as KpiOut;
    expect(s.kind).toBe('kpi');
    expect(s.value).toBe(0);
    expect(out.warnings ?? []).toEqual([]);
    // And a count over the typo field is ALSO 0 — COUNT(field), never rows.length.
    const c = await handle(dash([{ ...countPanel, field: 'chartTypee' }]));
    expect((c.panels.find((p) => p.id === 'k') as KpiOut).value).toBe(0);
  });

  it('mixed cells keep the numeric-only filter for numeric aggregates (no V160 when >= 1 numeric cell)', async () => {
    const mixed = {
      ...dash([{ ...sumPanel, field: 'revenue' }]),
      datasets: [{ id: 'surface', rows: [{ revenue: 100 }, { revenue: 'n/a' }, { revenue: 80 }, { revenue: null }] }],
    } as DashboardRenderInput;
    const out = await handle(mixed);
    const s = out.panels.find((p) => p.id === 's') as KpiOut;
    expect(s.kind).toBe('kpi');
    expect(s.value).toBe(180);
  });
});
