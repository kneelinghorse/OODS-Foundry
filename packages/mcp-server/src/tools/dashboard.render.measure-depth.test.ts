// Phase-3 measure-registry DEPTH (sprint-122) — shared colocated suite for M1/M2/M3.
// Appended BY NAME to ci.yml:582 (the colocated golden run is an explicit file list, not a
// glob — a new file silently never runs otherwise). Each mission appends its own describe block:
//   M1 (OODS-V137) — KpiPanel field→oneOf: a KPI panel may use measureRef INSTEAD of a raw field;
//                     a field-less, unresolved panel fails LOUD (never a silent value:0).
//   M2 (OODS-V138) — measure time-grain validation (expectedGrain) [appended below].
//   M3 (OODS-V139) — gated strictDatasets unknown-datasetId fail-loud [appended below].

import fs, { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getAjv } from '../lib/ajv.js';
import type { DashboardRenderInput } from '../schemas/generated.js';
import { handle } from './dashboard.render.js';
import { resetMeasureRegistryCache } from './measure-registry.js';

const inputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.input.json', import.meta.url), 'utf8'));
const outputSchema = JSON.parse(readFileSync(new URL('../schemas/dashboard.render.output.json', import.meta.url), 'utf8'));
const validateInput = getAjv().compile(inputSchema);
const validateOutput = getAjv().compile(outputSchema);

const ROWS = [
  { region: 'West', revenue: 100 },
  { region: 'East', revenue: 80 },
];

// ───────────────────────────────────────────────────────────────────────────
// M1 — KpiPanel field→oneOf (OODS-V137). A KPI panel may reference a governed
// measure via measureRef INSTEAD of a raw `field`; the "field OR measureRef"
// rule is enforced at RUNTIME (the tool-input schema no longer requires field).
// ───────────────────────────────────────────────────────────────────────────
describe('dashboard.render — M1 KpiPanel field→oneOf (sprint-122, OODS-V137)', () => {
  // A measureRef-only KPI tile (no raw `field`) + a healthy sibling that must keep rendering.
  function measureRefOnly(extra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [
        { id: 'kpi', kind: 'kpi', title: 'Revenue', datasetId: 'sales', measureRef: 'gm.revenue.total' },
        { id: 'good', kind: 'kpi', title: 'OK', datasetId: 'sales', field: 'revenue', aggregate: 'sum' },
      ],
      a11y: { description: 'measureRef-only KPI' },
      ...extra,
    } as DashboardRenderInput;
  }

  it('the input schema accepts a measureRef-only KPI (no field), a field-only KPI, and both-present', () => {
    // measureRef-only (no field) — the M1 relaxation.
    expect(validateInput(measureRefOnly())).toBe(true);
    // field-only (no measureRef) — the legacy shape, still valid.
    expect(
      validateInput({
        schemaVersion: 'v0.1',
        datasets: [{ id: 'sales', rows: ROWS }],
        panels: [{ id: 'kpi', kind: 'kpi', datasetId: 'sales', field: 'revenue', aggregate: 'sum' }],
        a11y: { description: 'field-only' },
      } as DashboardRenderInput),
    ).toBe(true);
    // both present — valid (field is the inert echo; measureRef wins under resolveMeasures).
    expect(
      validateInput({
        schemaVersion: 'v0.1',
        datasets: [{ id: 'sales', rows: ROWS }],
        panels: [{ id: 'kpi', kind: 'kpi', datasetId: 'sales', field: 'revenue', measureRef: 'gm.revenue.total', aggregate: 'sum' }],
        a11y: { description: 'both' },
      } as DashboardRenderInput),
    ).toBe(true);
  });

  it('measureRef-only + resolveMeasures:true + a KNOWN measure renders the RESOLVED value — no V137', async () => {
    const out = await handle(measureRefOnly({ resolveMeasures: true }));
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // NOT an error panel
    expect(kpi.value).toBe(180); // gm.revenue.total -> field 'revenue' / sum (100 + 80)
    expect(out.meta?.errorPanelCount).toBe(0);
    // Resolution stays input-side: neither measureRef nor field is echoed onto the output panel.
    expect((kpi as Record<string, unknown>).measureRef).toBeUndefined();
    expect((kpi as Record<string, unknown>).field).toBeUndefined();
  });

  it('measureRef-only + resolveMeasures OFF -> OODS-V137 error panel (NOT silent value:0); sibling renders', async () => {
    const out = await handle(measureRefOnly({ resolveMeasures: false })); // resolveMeasures defaults OFF -> field never filled
    expect(validateOutput(out)).toBe(true);
    expect(out.status).toBe('ok'); // siblings not voided
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error'); // NOT a kpi with value:0
    expect(err.error.code).toBe('OODS-V137');
    expect(err.error.severity).toBe('error');
    expect(out.meta?.errorPanelCount).toBe(1);
    // The healthy field-only sibling still computes.
    const good = out.panels.find((p) => p.id === 'good') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(good.kind).toBe('kpi');
    expect(good.value).toBe(180);
  });

  it('measureRef-only + resolveMeasures OFF + onPanelError:"omit" -> V137 warning + dropped; sibling unaffected', async () => {
    const out = await handle(measureRefOnly({ resolveMeasures: false, onPanelError: 'omit' }));
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined(); // dropped
    expect(
      (out.warnings ?? []).some((w) => w.code === 'OODS-V137' && w.severity === 'warning' && w.message.includes('kpi')),
    ).toBe(true);
    expect(out.panels.find((p) => p.id === 'good')).toBeDefined();
  });

  it('the V137 guard fires UNCONDITIONALLY — a field-less panel fails even with strictFields OFF', async () => {
    // strictFields is the field-PRESENCE check; V137 is the field-ABSENCE (no field at all) guard.
    // They are distinct: a measureRef-only unresolved panel has no field to even check presence on.
    const out = await handle(measureRefOnly({ resolveMeasures: false, strictFields: false }));
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V137');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// M2 — Measure time-grain validation (OODS-V138). A governed measure may declare
// an optional expectedGrain; under resolveMeasures, the panel's actual period
// data (its periodField cells) is validated against it at resolve time. The
// expectedGrain measure is INJECTED via an fs-mocked registry (the 5 real gm.*
// entries stay unseeded so faostat-e2e/fidelity goldens stay 0-diff).
// ───────────────────────────────────────────────────────────────────────────
describe('dashboard.render — M2 measure time-grain validation (sprint-122, OODS-V138)', () => {
  // A valid registry (passes AJV-validate-at-load) whose measure declares expectedGrain 'month'.
  const GRAIN_REGISTRY = JSON.stringify({
    measures: {
      'gm.grain.monthly': { name: 'Monthly Measure', entityField: 'revenue', aggregate: 'sum', measureRole: 'metric', expectedGrain: 'month' },
    },
  });

  // Run handle() against an INJECTED registry (mirror the V132 fail-closed test pattern): spy the
  // shared node:fs object the loader reads through, reset the memo, restore in finally.
  async function handleWithRegistry(registryJson: string, ir: DashboardRenderInput) {
    const spy = vi.spyOn(fs, 'readFileSync').mockReturnValue(registryJson);
    resetMeasureRegistryCache();
    try {
      return await handle(ir);
    } finally {
      spy.mockRestore();
      resetMeasureRegistryCache(); // restore the real registry for subsequent tests
    }
  }

  it('expectedGrain="month" + monthly periodField data renders normally — no V138', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: [
        { revenue: 100, month: '2024-01' },
        { revenue: 120, month: '2024-02' },
        { revenue: 150, month: '2024-03' },
      ] }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', periodField: 'month', measureRef: 'gm.grain.monthly' }],
      a11y: { description: 'monthly grain' },
      resolveMeasures: true,
    } as DashboardRenderInput;
    const out = await handleWithRegistry(GRAIN_REGISTRY, ir);
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // NOT an error panel
    expect(out.meta?.errorPanelCount).toBe(0);
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V138')).toBe(false);
  });

  it('expectedGrain="month" + DAILY periodField data -> OODS-V138 error panel (wrong cadence)', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: [
        { revenue: 100, day: '2024-01-15' },
        { revenue: 120, day: '2024-01-16' },
      ] }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', periodField: 'day', measureRef: 'gm.grain.monthly' }],
      a11y: { description: 'daily data, monthly measure' },
      resolveMeasures: true,
    } as DashboardRenderInput;
    const out = await handleWithRegistry(GRAIN_REGISTRY, ir);
    expect(validateOutput(out)).toBe(true);
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V138');
    expect(err.error.severity).toBe('error');
    expect(err.error.message).toContain('day'); // the observed grain is named
    expect(out.meta?.errorPanelCount).toBe(1);
  });

  it('expectedGrain set + NO periodField -> OODS-V138 (no period axis to check the grain against)', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: [{ revenue: 100 }, { revenue: 120 }] }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', measureRef: 'gm.grain.monthly' }],
      a11y: { description: 'no periodField' },
      resolveMeasures: true,
    } as DashboardRenderInput;
    const out = await handleWithRegistry(GRAIN_REGISTRY, ir);
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V138');
    expect(err.error.message).toContain('periodField');
  });

  it('a grain mismatch under onPanelError:"omit" -> V138 warning + dropped panel', async () => {
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: [
        { revenue: 100, day: '2024-01-15' },
        { revenue: 120, day: '2024-01-16' },
      ] }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', periodField: 'day', measureRef: 'gm.grain.monthly' }],
      a11y: { description: 'omit grain mismatch' },
      resolveMeasures: true,
      onPanelError: 'omit',
    } as DashboardRenderInput;
    const out = await handleWithRegistry(GRAIN_REGISTRY, ir);
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined();
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V138' && w.severity === 'warning')).toBe(true);
  });

  it('a measure WITHOUT expectedGrain skips the grain check entirely (back-compat, default path)', async () => {
    // gm.revenue.total in the REAL registry carries no expectedGrain -> the grain branch is never
    // entered, even with daily data. Proves the unseeded path is byte-untouched.
    const ir = {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: [
        { revenue: 100, day: '2024-01-15' },
        { revenue: 120, day: '2024-01-16' },
      ] }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', periodField: 'day', measureRef: 'gm.revenue.total' }],
      a11y: { description: 'unseeded measure' },
      resolveMeasures: true,
    } as DashboardRenderInput;
    const out = await handle(ir); // real registry, no mock
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi');
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V138')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// M3 — strictDatasets unknown-datasetId fail-loud (OODS-V139). Closes the D6
// KPI-vs-chart asymmetry under a default-off flag: a KPI panel referencing a
// datasetId NOT in datasets[] fails LOUD (like chart panels via V123). Derek-
// ratified scope = UNKNOWN-ID-ONLY: a KNOWN dataset cross-filtered to zero rows
// STILL renders value:0. Default OFF = byte-identical to the frozen-D6 floor.
// ───────────────────────────────────────────────────────────────────────────
describe('dashboard.render — M3 strictDatasets unknown-datasetId (sprint-122, OODS-V139)', () => {
  // A KPI panel (field present, so V137 passes) on an UNKNOWN datasetId + a healthy sibling.
  function unknownDataset(extra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [
        { id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'nope', field: 'revenue', aggregate: 'sum' },
        { id: 'good', kind: 'kpi', title: 'OK', datasetId: 'sales', field: 'revenue', aggregate: 'sum' },
      ],
      a11y: { description: 'unknown dataset' },
      ...extra,
    } as DashboardRenderInput;
  }

  it('the input schema accepts strictDatasets', () => {
    expect(validateInput(unknownDataset({ strictDatasets: true }))).toBe(true);
    expect(validateInput(unknownDataset())).toBe(true);
  });

  it('strictDatasets OFF (default) + unknown datasetId -> legacy silent value:0, no V139 (frozen-D6 floor)', async () => {
    const out = await handle(unknownDataset());
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi');
    expect(kpi.value).toBe(0); // silent-empty, unchanged
    expect(out.meta?.errorPanelCount).toBe(0);
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V139')).toBe(false);
  });

  it('strictDatasets ON + unknown datasetId -> OODS-V139 error panel; sibling renders', async () => {
    const out = await handle(unknownDataset({ strictDatasets: true }));
    expect(validateOutput(out)).toBe(true);
    expect(out.status).toBe('ok'); // siblings not voided
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V139');
    expect(err.error.severity).toBe('error');
    expect(err.error.message).toContain('nope');
    expect(out.meta?.errorPanelCount).toBe(1);
    const good = out.panels.find((p) => p.id === 'good') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(good.kind).toBe('kpi');
    expect(good.value).toBe(180);
  });

  it('strictDatasets ON + unknown datasetId + onPanelError:"omit" -> V139 warning + dropped; sibling unaffected', async () => {
    const out = await handle(unknownDataset({ strictDatasets: true, onPanelError: 'omit' }));
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined();
    expect(
      (out.warnings ?? []).some((w) => w.code === 'OODS-V139' && w.severity === 'warning' && w.message.includes('kpi')),
    ).toBe(true);
    expect(out.panels.find((p) => p.id === 'good')).toBeDefined();
  });

  it('strictDatasets ON + a KNOWN dataset cross-filtered to [] STILL renders value:0 (unknown-id-ONLY scope)', async () => {
    // A selection from a DIFFERENT source filters the KPI's KNOWN 'sales' rows to zero (region 'Nowhere'
    // matches nothing). datasetRows.has('sales')===true, so V139 does NOT fire — the intentional asymmetry.
    const selection = { other: { sourceWidgetId: 'other', dimension: 'region', values: ['Nowhere'], kind: 'categorical' } };
    const out = await handle({
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Rev', datasetId: 'sales', field: 'revenue', aggregate: 'sum' }],
      a11y: { description: 'known dataset, filtered empty' },
      strictDatasets: true,
      selection,
    } as DashboardRenderInput);
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // NOT a V139 error
    expect(kpi.value).toBe(0); // known-but-cross-filtered-to-[] STILL value:0
    expect(out.meta?.errorPanelCount).toBe(0);
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V139')).toBe(false);
  });

  it('strictDatasets ON does NOT hijack the CHART unknown-datasetId path (keeps its own OODS-V12x, not V139)', async () => {
    const out = await handle({
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'bars', kind: 'chart', chartType: 'bar', datasetId: 'does-not-exist', encodings: { x: 'region', y: 'revenue' } }],
      a11y: { description: 'chart unknown dataset' },
      strictDatasets: true,
    } as DashboardRenderInput);
    const err = out.panels.find((p) => p.id === 'bars') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toMatch(/^OODS-V/);
    expect(err.error.code).not.toBe('OODS-V139'); // chart path unaffected by strictDatasets
  });
});

// ───────────────────────────────────────────────────────────────────────────
// s129-m03 — measure-NARRATIVE equivalence (OODS-V141). NON-TAUTOLOGICAL: the
// measure narrative verbalizes the GOVERNED threshold (the registry entry's
// defaultThreshold); if the panel's RESOLVED threshold (author-overridable per D4)
// DIVERGES from it, the verbalized "threshold X breached" would misrepresent the
// threshold the breach computes against. V141 fail-closes — but ONLY when the
// narrative is actually surfaced (wantHtml || wantA11y). gm.revenue.total (real
// registry) governs defaultThreshold {above, 350}, the wedge for a forge-able drift.
// ───────────────────────────────────────────────────────────────────────────
describe('dashboard.render — measure-narrative equivalence (sprint-129, OODS-V141)', () => {
  function measureNarrativeKpi(thresholdValue: number, extra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Revenue', datasetId: 'sales', measureRef: 'gm.revenue.total', threshold: { direction: 'above', value: thresholdValue } }],
      a11y: { description: 'measure-narrative equivalence' },
      resolveMeasures: true,
      ...extra,
    } as DashboardRenderInput;
  }

  it('V141 fires (error panel) when the narrative is surfaced AND the resolved threshold diverges from the governed default', async () => {
    // author threshold 300 OVERRIDES gm.revenue.total's governed default 350 -> the narrative would
    // verbalize 350 while the breach computes against 300. Registry-vs-rendered drift -> fail closed.
    const out = await handle(measureNarrativeKpi(300, { output: { includeA11y: true } }));
    expect(validateOutput(out)).toBe(true);
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V141');
    expect(err.error.severity).toBe('error');
    expect(err.error.message).toContain('350'); // the governed default
    expect(err.error.message).toContain('300'); // the resolved/effective threshold
    expect(out.meta?.errorPanelCount).toBe(1);
  });

  it('V141 does NOT fire when the narrative is NOT surfaced (no includeA11y / no html) — the panel renders', async () => {
    // The SAME divergence, but no narrative surface: V141 is scoped to the measure-narrative path,
    // so a non-narrative render is byte-identical (the author override still wins for compute, D4).
    const out = await handle(measureNarrativeKpi(300));
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // NOT a V141 error
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V141')).toBe(false);
    expect(out.meta?.errorPanelCount).toBe(0);
  });

  it('V141 does NOT fire when the resolved threshold MATCHES the governed default (no drift) under includeA11y', async () => {
    // author threshold {above, 350} == gm.revenue.total defaultThreshold {above, 350} -> no divergence.
    const out = await handle(measureNarrativeKpi(350, { output: { includeA11y: true } }));
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // renders normally
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V141')).toBe(false);
    // the gate-lifted narrative is present (the additive surface), proving V141 did not suppress it.
    expect((out.a11y as Record<string, unknown>).narrative).toBeDefined();
  });

  it('V141 under onPanelError:"omit" -> warning + dropped panel (the same seam as the other V13x codes)', async () => {
    const out = await handle(measureNarrativeKpi(300, { output: { includeA11y: true }, onPanelError: 'omit' }));
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined(); // dropped
    expect(
      (out.warnings ?? []).some((w) => w.code === 'OODS-V141' && w.severity === 'warning' && w.message.includes('kpi')),
    ).toBe(true);
  });

  // s130-m04 — OODS-V142: the DIRECTION sibling of V141. gm.revenue.total governs {above, 350}; an
  // author override that keeps value 350 but flips direction to 'below' leaves V141 silent (values
  // equal) yet flips the breach while the narrative still names the governed 'above'. resolveMeasurePanel
  // replaces the WHOLE threshold object, so this is reachable.
  function directionKpi(direction: 'above' | 'below', extra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Revenue', datasetId: 'sales', measureRef: 'gm.revenue.total', threshold: { direction, value: 350 } }],
      a11y: { description: 'threshold direction drift' },
      resolveMeasures: true,
      ...extra,
    } as DashboardRenderInput;
  }

  it('V142 fires (error panel) when an author direction-only override flips the governed threshold direction', async () => {
    // value 350 == governed 350 -> V141 silent; direction 'below' != governed 'above' -> V142.
    const out = await handle(directionKpi('below', { output: { includeA11y: true } }));
    expect(validateOutput(out)).toBe(true);
    const err = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V142');
    expect(err.error.message).toContain('above'); // the governed direction
    expect(err.error.message).toContain('below'); // the resolved/effective direction
    expect(out.meta?.errorPanelCount).toBe(1);
  });

  it('V142 does NOT fire when the resolved direction MATCHES the governed default (no drift)', async () => {
    const out = await handle(directionKpi('above', { output: { includeA11y: true } }));
    expect(validateOutput(out)).toBe(true);
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi'); // renders normally
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V142')).toBe(false);
  });

  it('V142 does NOT fire when the narrative is NOT surfaced (no includeA11y / no html)', async () => {
    // Same direction divergence, but no narrative surface -> the guard is scoped to the narrative path.
    const out = await handle(directionKpi('below'));
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.kind).toBe('kpi');
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V142')).toBe(false);
  });

  it('V142 under onPanelError:"omit" -> warning + dropped panel (the same seam as V141)', async () => {
    const out = await handle(directionKpi('below', { output: { includeA11y: true }, onPanelError: 'omit' }));
    expect(out.panels.find((p) => p.id === 'kpi')).toBeUndefined();
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V142' && w.severity === 'warning')).toBe(true);
  });
});

describe('dashboard.render — comparison-basis "vs target" narrative (sprint-130, m02)', () => {
  // gm.revenue.total carries defaultComparison {basis:'target', value:300}; with NO author
  // comparison override the RESOLVED comparison is that governed target, so the cross-panel
  // narrative names what the delta (180 - 300 = -120) was computed against. No threshold
  // override -> the resolved threshold equals the governed default (350) -> no V141 drift.
  function targetKpi(extra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'sales', rows: ROWS }],
      panels: [{ id: 'kpi', kind: 'kpi', title: 'Revenue', datasetId: 'sales', measureRef: 'gm.revenue.total' }],
      a11y: { description: 'comparison-basis narrative' },
      resolveMeasures: true,
      ...extra,
    } as DashboardRenderInput;
  }

  const narrativeOf = (out: Awaited<ReturnType<typeof handle>>) =>
    (out.a11y as Record<string, unknown>).narrative as { summary: string; keyFindings: string[] } | undefined;

  it('the RESOLVED target value reaches the cross-panel a11y.narrative as "vs target N" under includeA11y', async () => {
    const out = await handle(targetKpi({ output: { includeA11y: true } }));
    expect(validateOutput(out)).toBe(true);
    const finding = narrativeOf(out)?.keyFindings.find((f) => f.startsWith('Revenue: 180'));
    expect(finding).toBeDefined();
    expect(finding).toContain('vs target 300'); // names the governed baseline the delta was computed against
  });

  it('the per-panel a11yDescription stays bare — the "vs target" clause is the cross-panel surface ONLY (m01 call B)', async () => {
    const out = await handle(targetKpi({ output: { includeA11y: true } }));
    const kpi = out.panels.find((p) => p.id === 'kpi') as Extract<typeof out.panels[number], { kind: 'kpi' }>;
    expect(kpi.a11yDescription).toContain('Revenue: 180');
    expect(kpi.a11yDescription).not.toContain('vs target'); // frozen seam (h): no comparison clause on the terse string
  });

  it('flag-OFF (no includeA11y) keeps the narrative ABSENT — the clause is gated behind the narrative surface', async () => {
    const out = await handle(targetKpi());
    expect(narrativeOf(out)).toBeUndefined();
  });

  // s130-m04: the FROZEN includeA11y=true, html=false a11y.narrative golden — the #525 JSON surface
  // the agent actually reads (the only prior frozen narrative bytes were html=true in the fidelity
  // snap). Byte-exact so the verbalization (incl. the m02 'vs target' clause) cannot drift silently.
  // No author threshold override -> resolved threshold == governed (350/above) -> no V141/V142.
  it('FROZEN a11y.narrative golden (includeA11y, no html) — byte-exact over the resolved measure narrative', async () => {
    const out = await handle(targetKpi({ output: { includeA11y: true, html: false } }));
    expect(narrativeOf(out)).toEqual({
      summary: '1 key metric tracked.',
      keyFindings: ['Revenue: 180 (decreasing, delta -120 vs target 300)'],
    });
  });
});

describe('dashboard.render — EXPLICIT chart-panel measure narrative (sprint-130, m03)', () => {
  // A bar chart panel may carry an OPTIONAL measureRef. Resolution is NARRATIVE-ONLY — the
  // governed context decorates the per-panel a11y.narrative; the chart's encodings/compute are
  // untouched (resolveMeasurePanel is KPI-typed). gm.export.value.total is unit-bearing ('1000 USD')
  // so it exercises the unit clause (revenue measures carry no unit).
  function chartMeasureDash(extra: Record<string, unknown> = {}, panelExtra: Record<string, unknown> = {}): DashboardRenderInput {
    return {
      schemaVersion: 'v0.1',
      datasets: [{ id: 'exports', rows: [{ region: 'West', value: 100 }, { region: 'East', value: 200 }] }],
      panels: [
        {
          id: 'chart',
          kind: 'chart',
          chartType: 'bar',
          datasetId: 'exports',
          encodings: { x: 'region', y: { field: 'value', aggregate: 'sum' } },
          ...panelExtra,
        },
      ],
      a11y: { description: 'chart measure narrative' },
      ...extra,
    } as DashboardRenderInput;
  }
  const chartOf = (out: Awaited<ReturnType<typeof handle>>) =>
    out.panels.find((p) => p.id === 'chart') as Extract<typeof out.panels[number], { kind: 'chart' }>;

  it('the input schema accepts measureRef on a chart panel', () => {
    expect(validateInput(chartMeasureDash({ resolveMeasures: true }, { measureRef: 'gm.export.value.total' }))).toBe(true);
  });

  it('decorates the chart per-panel a11y.narrative with the governed measure leading finding (unit-bearing)', async () => {
    const out = await handle(chartMeasureDash({ resolveMeasures: true, output: { includeA11y: true } }, { measureRef: 'gm.export.value.total' }));
    expect(validateOutput(out)).toBe(true);
    const chart = chartOf(out);
    // The SAME describeMeasureContext literal the KPI/single-chart paths emit (no fork), prepended.
    expect(chart.a11y?.narrative?.keyFindings?.[0]).toBe('Measure: Total Export Value; unit 1000 USD; format currency');
  });

  it('flag-OFF (resolveMeasures off) is byte-identical — no measure finding even with measureRef + includeA11y', async () => {
    const withRef = await handle(chartMeasureDash({ resolveMeasures: false, output: { includeA11y: true } }, { measureRef: 'gm.export.value.total' }));
    const noRef = await handle(chartMeasureDash({ output: { includeA11y: true } }));
    expect(chartOf(withRef).a11y?.narrative?.keyFindings?.[0]).not.toContain('Measure:');
    expect(chartOf(withRef).a11y?.narrative).toEqual(chartOf(noRef).a11y?.narrative); // narrative byte-identical
  });

  it('UNKNOWN chart measureRef under resolveMeasures = HARD-ERROR (OODS-V130, mirroring the KPI path)', async () => {
    const out = await handle(chartMeasureDash({ resolveMeasures: true, output: { includeA11y: true } }, { measureRef: 'gm.nope.unknown' }));
    const err = out.panels.find((p) => p.id === 'chart') as Extract<typeof out.panels[number], { kind: 'error' }>;
    expect(err.kind).toBe('error');
    expect(err.error.code).toBe('OODS-V130');
    expect(err.error.message).toContain('gm.nope.unknown');
    expect(out.meta?.errorPanelCount).toBe(1);
  });

  it('UNKNOWN chart measureRef under onPanelError:"omit" -> V130 warning + dropped panel (the KPI seam)', async () => {
    const out = await handle(chartMeasureDash({ resolveMeasures: true, output: { includeA11y: true }, onPanelError: 'omit' }, { measureRef: 'gm.nope.unknown' }));
    expect(out.panels.find((p) => p.id === 'chart')).toBeUndefined();
    expect((out.warnings ?? []).some((w) => w.code === 'OODS-V130' && w.severity === 'warning')).toBe(true);
  });
});
