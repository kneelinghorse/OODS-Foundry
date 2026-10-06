// s180 m02 — dashboard.render Shape-B identity lifts.
//
// These rows pin the WHY of the additive wire fields, not just their presence:
//   R-A proves each panel identity is viz.render's identity for the identical call,
//       and that one panel's data cannot contaminate a sibling's identity.
//   R-C proves the lifted NormalizedVizSpec is a live artifact.certify hand-off:
//       cartesian IR needs {spec} only, while ECharts-primary IR needs exactly its
//       matching data branch. Mutants break parity or the typed branch coupling.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import type { DashboardRenderInput } from '../../src/schemas/generated.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as dashboardRender } from '../../src/tools/dashboard.render.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';

const dashboardInputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/dashboard.render.input.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const dashboardOutputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/dashboard.render.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateDashboardInput = getAjv().compile(dashboardInputSchema);
const validateDashboardOutput = getAjv().compile(dashboardOutputSchema);

const WEST_ROWS = [
  { region: 'Coast', revenue: 10 },
  { region: 'Mountain', revenue: 20 },
];
const EAST_ROWS = [
  { region: 'Atlantic', revenue: 30 },
  { region: 'Lakes', revenue: 40 },
];
const SANKEY = {
  nodes: [{ name: 'Inputs' }, { name: 'Outputs' }],
  links: [{ source: 'Inputs', target: 'Outputs', value: 7 }],
};

const BAR_ENCODINGS = {
  x: { field: 'region', scale: 'band' },
  y: { field: 'revenue', aggregate: 'sum' },
};

function twoBarDashboard(includeNormalizedSpec: boolean): DashboardRenderInput {
  return {
    schemaVersion: 'v0.1',
    datasets: [
      { id: 'west', rows: structuredClone(WEST_ROWS) },
      { id: 'east', rows: structuredClone(EAST_ROWS) },
    ],
    panels: [
      {
        id: 'west-bars',
        kind: 'chart',
        title: 'West revenue',
        chartType: 'bar',
        datasetId: 'west',
        encodings: BAR_ENCODINGS,
      },
      {
        id: 'east-bars',
        kind: 'chart',
        title: 'East revenue',
        chartType: 'bar',
        datasetId: 'east',
        encodings: BAR_ENCODINGS,
      },
    ],
    a11y: { description: 'Two independently bound revenue panels.' },
    output: { includeNormalizedSpec },
  } as unknown as DashboardRenderInput;
}

function roundTripDashboard(): DashboardRenderInput {
  return {
    schemaVersion: 'v0.1',
    datasets: [{ id: 'revenue', rows: structuredClone(WEST_ROWS) }],
    panels: [
      {
        id: 'revenue-bars',
        kind: 'chart',
        title: 'Revenue bars',
        chartType: 'bar',
        datasetId: 'revenue',
        encodings: BAR_ENCODINGS,
      },
      {
        id: 'flow',
        kind: 'chart',
        title: 'Flow',
        chartType: 'sankey',
        sankey: structuredClone(SANKEY),
      },
    ],
    a11y: { description: 'Cartesian and ECharts identity round-trip.' },
    output: { includeNormalizedSpec: true },
  } as unknown as DashboardRenderInput;
}

function panel(out: Awaited<ReturnType<typeof dashboardRender>>, id: string): Record<string, any> {
  const found = out.panels.find((candidate) => candidate.id === id);
  expect(found, `dashboard output is missing panel "${id}"`).toBeDefined();
  return found as unknown as Record<string, any>;
}

describe('dashboard.render Shape-B identity lifts (s180 m02)', () => {
  it('R-A: the call-level flag emits one viz.render identity per successful chart and opt-out emits neither lift', async () => {
    const optedIn = twoBarDashboard(true);
    expect(validateDashboardInput(optedIn)).toBe(true);
    const misplacedFlag = structuredClone(optedIn) as unknown as Record<string, any>;
    misplacedFlag.panels[0].includeNormalizedSpec = true;
    expect(validateDashboardInput(misplacedFlag)).toBe(false);

    const dashboard = await dashboardRender(optedIn);
    expect(validateDashboardOutput(dashboard)).toBe(true);
    expect(dashboard.output).toMatchObject({ compact: true, includeNormalizedSpec: true });

    const west = panel(dashboard, 'west-bars');
    const east = panel(dashboard, 'east-bars');
    expect(west.normalizedSpec).toBeDefined();
    expect(east.normalizedSpec).toBeDefined();
    expect(west.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(east.contentHash).toMatch(/^[a-f0-9]{64}$/);

    // Reconstruct dashboard.render's per-panel calls exactly. Equality here makes
    // the dashboard hash a lift of viz.render identity, not a second hash dialect.
    const standaloneWest = await vizRender({
      id: 'west-bars',
      name: 'West revenue',
      chartType: 'bar',
      rows: structuredClone(WEST_ROWS),
      encodings: BAR_ENCODINGS,
      output: { compact: true, includeNormalizedSpec: true },
      a11yEquivalence: true,
    } as never);
    const standaloneEast = await vizRender({
      id: 'east-bars',
      name: 'East revenue',
      chartType: 'bar',
      rows: structuredClone(EAST_ROWS),
      encodings: BAR_ENCODINGS,
      output: { compact: true, includeNormalizedSpec: true },
      a11yEquivalence: true,
    } as never);
    expect(standaloneWest.status).toBe('ok');
    expect(standaloneEast.status).toBe('ok');
    expect(west.contentHash).toBe(standaloneWest.contentHash);
    expect(east.contentHash).toBe(standaloneEast.contentHash);
    expect(west.normalizedSpec).toEqual(standaloneWest.normalizedSpec);
    expect(east.normalizedSpec).toEqual(standaloneEast.normalizedSpec);

    const optedOut = await dashboardRender(twoBarDashboard(false));
    expect(validateDashboardOutput(optedOut)).toBe(true);
    expect(optedOut.output).toMatchObject({ compact: true });
    expect(optedOut.output).not.toHaveProperty('includeNormalizedSpec');
    expect(panel(optedOut, 'west-bars')).not.toHaveProperty('normalizedSpec');
    expect(panel(optedOut, 'east-bars')).not.toHaveProperty('normalizedSpec');
    // Panel content identity is default-on and independent of normalizedSpec emission.
    expect(panel(optedOut, 'west-bars').contentHash).toBe(west.contentHash);
    expect(panel(optedOut, 'east-bars').contentHash).toBe(east.contentHash);

    // Use a fresh fixture: the viz normalization path is not specified as an
    // immutable-input API, so this row must not depend on reusing a prior call's input.
    const partialInput = twoBarDashboard(true);
    (partialInput.panels as Array<Record<string, unknown>>).push({
      id: 'broken',
      kind: 'chart',
      chartType: 'bar',
      datasetId: 'missing',
      encodings: BAR_ENCODINGS,
    });
    expect(validateDashboardInput(partialInput), JSON.stringify(validateDashboardInput.errors)).toBe(true);
    const partial = await dashboardRender(partialInput);
    const broken = panel(partial, 'broken');
    expect(broken.kind).toBe('error');
    expect(broken).not.toHaveProperty('contentHash');
    expect(broken).not.toHaveProperty('normalizedSpec');
  });

  it('R-A mutant: changing one dataset moves only its panel identity and the dashboard identity', async () => {
    const baselineInput = twoBarDashboard(true);
    const mutatedInput = structuredClone(baselineInput) as DashboardRenderInput;
    (mutatedInput.datasets[0]!.rows[0] as Record<string, unknown>).revenue = 11;

    const baseline = await dashboardRender(baselineInput);
    const mutated = await dashboardRender(mutatedInput);
    const baselineWest = panel(baseline, 'west-bars');
    const baselineEast = panel(baseline, 'east-bars');
    const mutatedWest = panel(mutated, 'west-bars');
    const mutatedEast = panel(mutated, 'east-bars');

    expect(mutatedWest.contentHash).not.toBe(baselineWest.contentHash);
    expect(mutatedWest.normalizedSpec).not.toEqual(baselineWest.normalizedSpec);
    expect(mutatedEast.contentHash).toBe(baselineEast.contentHash);
    expect(mutatedEast).toEqual(baselineEast);
    expect(mutated.contentHash).not.toBe(baseline.contentHash);
  });

  it('R-C: lifted cartesian and ECharts IR certify with the required operand shape and preserve contentHash parity', async () => {
    const dashboard = await dashboardRender(roundTripDashboard());
    expect(validateDashboardOutput(dashboard)).toBe(true);

    const cartesianPanel = panel(dashboard, 'revenue-bars');
    const echartsPanel = panel(dashboard, 'flow');

    // Cartesian rows live inside the IR. Supplying a data branch would be dead
    // input, so the live hand-off is exactly {spec}.
    const cartesianOperand = { spec: cartesianPanel.normalizedSpec };
    expect(Object.keys(cartesianOperand)).toEqual(['spec']);
    const cartesianVerdict = await certify(cartesianOperand);
    expect(cartesianVerdict.status).toBe('ok');
    expect(cartesianVerdict.determinism?.contentHash).toBe(cartesianPanel.contentHash);

    // ECharts-primary IR is metadata-only; exactly the mark-coupled data branch
    // must travel with it for certify to rebuild the same projected option.
    const echartsOperand = {
      spec: echartsPanel.normalizedSpec,
      data: { sankey: structuredClone(SANKEY) },
    };
    expect(Object.keys(echartsOperand.data)).toEqual(['sankey']);
    const echartsVerdict = await certify(echartsOperand);
    expect(echartsVerdict.status).toBe('ok');
    expect(echartsVerdict.determinism?.contentHash).toBe(echartsPanel.contentHash);

    // Branch-coupling mutant: a shape-compatible but semantically wrong branch
    // must fail loud rather than produce a misleading parity result.
    const wrongBranch = await certify({
      spec: echartsPanel.normalizedSpec,
      data: { chord: structuredClone(SANKEY) },
    });
    expect(wrongBranch.status).toBe('error');
    expect(wrongBranch.errors?.[0]?.code).toBe('OODS-V123');
  });

  it('R-C projected-paint mutant: changing the lifted IR breaks certify hash parity', async () => {
    const dashboard = await dashboardRender(roundTripDashboard());
    const cartesianPanel = panel(dashboard, 'revenue-bars');
    const projectedPaintMutant = structuredClone(cartesianPanel.normalizedSpec) as Record<string, any>;
    projectedPaintMutant.encoding.color = {
      field: 'region',
      trait: 'EncodingColor',
      channel: 'color',
      range: ['#123456', '#abcdef'],
    };

    const mutantVerdict = await certify({ spec: projectedPaintMutant });
    expect(mutantVerdict.status).toBe('ok');
    expect(mutantVerdict.determinism?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mutantVerdict.determinism?.contentHash).not.toBe(cartesianPanel.contentHash);
  });
});
