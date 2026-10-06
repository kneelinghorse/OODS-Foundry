// s172 m03 — the accuracy pillar for the 8 ECharts-primary types, THROUGH the real handler.
//
// echarts-rules.spec.ts (viz-core) proves each rule in isolation. This file proves the
// pillar an agent actually receives: that the rules are wired, that accuracySummary counts
// what it claims, that the two flavours of 'unchecked' are distinguishable, and that a
// firing rule reaches findings[] under its registered code at error severity.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { getDefinition } from '../../src/errors/registry.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor, US_STATES } from './s172-echarts-operands.js';
import { echartsPrimaryIr } from './s172-spec-only-cases.js';
import { a11yFindingsOf, RENDERED_IR_A11Y_FINDINGS } from './s174-a11y-warnfirst-expectations.js';
import type { EChartsPrimaryType } from '../../src/tools/echarts-primary.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

const ir = (trait: string, chartType: string): NormalizedVizSpec => echartsPrimaryIr(trait, chartType);

describe('artifact.certify — the ECharts accuracy pillar is wired (s172 m03)', () => {
  it.each(ECHARTS_OPERAND_CASES.map((c) => [c.chartType, c] as const))(
    '%s: the representative operand reports measured accuracy under the declared rule set',
    async (_label, operand) => {
      const rendered = await vizRender(renderInputFor(operand) as never);
      const out = await certify({
        spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
        data: { [operand.branch]: operand.branchData } as never,
      });
      // Expected rule counts are stated per type rather than derived from the response —
      // an assertion computed from the value under test cannot fail.
      const EXPECTED_RULES: Record<string, number> = {
        treemap: 2,
        sunburst: 2,
        sankey: 3,
        chord: 1,
        force_graph: 1,
        choropleth: 1,
        bubble_map: 3,
        flow_map: 2,
      };
      const expected = EXPECTED_RULES[operand.chartType];
      expect(out.accuracySummary?.rulesEvaluated).toBe(expected);
      expect(out.accuracySummary?.failing).toBe(0);
      expect(out.pillars?.accuracy).toBe('pass');
      // DECLARED MOVER (s174 m01). The clean-operand verdict carries ZERO accuracy findings
      // — the claim this line was making — but findings[] is no longer accuracy-only: the
      // warn-first a11y engine now writes into it. Both halves are pinned exactly.
      expect((out.findings ?? []).filter((f) => /^OODS-V15\d$/.test(f.code))).toEqual([]);
      expect(a11yFindingsOf(out.findings)).toEqual(
        RENDERED_IR_A11Y_FINDINGS[operand.chartType as EChartsPrimaryType],
      );
      expect((out.findings ?? []).length).toBe(
        RENDERED_IR_A11Y_FINDINGS[operand.chartType as EChartsPrimaryType].length,
      );
      expect(validateOutput(out)).toBe(true);
    },
  );

  it.each([
    ['force_graph', ['OODS-V173']],
    ['bubble_map', ['OODS-V168', 'OODS-V169', 'OODS-V170']],
    ['flow_map', ['OODS-V171', 'OODS-V172']],
  ] as const)('%s advertises its exact newly offered rules and retires the empty-set claim', async (chartType, codes) => {
    const operand = ECHARTS_OPERAND_CASES.find(c => c.chartType === chartType)!;
    const rendered = await vizRender(renderInputFor(operand) as never);
    const out = await certify({ spec: rendered.normalizedSpec as unknown as NormalizedVizSpec, data: { [operand.branch]: operand.branchData } as never });
    expect(out.accuracyRules).toEqual(codes);
    expect(out.accuracySummary?.rulesEvaluated).toBe(codes.length);
    expect(out.notes?.some(note => note.includes('offered set is empty'))).toBe(false);
    expect(validateOutput(out)).toBe(true);
  });

  it('no operand is unchecked while the supplied force-graph operand is evaluated', async () => {
    const operand = ECHARTS_OPERAND_CASES.find((c) => c.chartType === 'force_graph')!;
    const rendered = await vizRender(renderInputFor(operand) as never);
    const spec = rendered.normalizedSpec as unknown as NormalizedVizSpec;

    const withoutData = await certify({ spec });
    const withData = await certify({ spec, data: { network: operand.branchData } as never });

    // Without the operand: pillar unchecked, NO accuracySummary, and a note naming the operand.
    expect(withoutData.pillars?.accuracy).toBe('unchecked');
    expect(withoutData.accuracySummary).toBeUndefined();
    expect((withoutData.notes ?? []).some((n) => n.startsWith('Accuracy is unchecked for'))).toBe(true);

    // s195 supplies a real directed-link rule for force_graph. Missing data cannot
    // claim that pass: the populated summary is evidence that a rule actually ran.
    expect(withData.pillars?.accuracy).toBe('pass');
    expect(withData.accuracySummary).toEqual({ rulesEvaluated: 1, failing: 0 });
    expect((withData.notes ?? []).some((n) => n.startsWith('Accuracy is unchecked for'))).toBe(false);
    expect((withData.notes ?? []).some((n) => n.includes('offered set is empty'))).toBe(false);
  });
});

describe('artifact.certify — a firing ECharts accuracy rule reaches the agent (s172 m03)', () => {
  const FIRING: ReadonlyArray<readonly [string, string, string, string, unknown]> = [
    [
      'OODS-V154',
      'MarkTreemap',
      'treemap',
      'hierarchy',
      { type: 'nested', data: { name: 'root', children: [{ name: 'a', value: -40 }, { name: 'b', value: 60 }] } },
    ],
    [
      'OODS-V155',
      'MarkSunburst',
      'sunburst',
      'hierarchy',
      { type: 'nested', data: { name: 'root', value: 90, children: [{ name: 'a', value: 60 }, { name: 'b', value: 40 }] } },
    ],
    [
      'OODS-V156',
      'MarkChord',
      'chord',
      'chord',
      { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: -5 }] },
    ],
    [
      'OODS-V157',
      'MarkSankey',
      'sankey',
      'sankey',
      {
        nodes: [{ name: 'A' }, { name: 'B', value: 100 }, { name: 'C' }],
        links: [
          { source: 'A', target: 'B', value: 60 },
          { source: 'B', target: 'C', value: 60 },
        ],
      },
    ],
    [
      'OODS-V158',
      'MarkSankey',
      'sankey',
      'sankey',
      {
        nodes: [{ name: 'A' }, { name: 'B' }],
        links: [
          { source: 'A', target: 'B', value: 30 },
          { source: 'A', target: 'B', value: 30 },
        ],
      },
    ],
    [
      'OODS-V159',
      'MarkChoropleth',
      'choropleth',
      'geo',
      {
        geojson: US_STATES,
        rows: [
          { state: 'CA', sales: 100 },
          { state: 'CA', sales: 250 },
        ],
        join: { dataKey: 'state', featureProperty: 'region' },
        valueField: 'sales',
      },
    ],
  ];

  it.each(FIRING)(
    '%s fires end-to-end: accuracy:fail, an error-severity finding under the registered code, schema-valid',
    async (code, trait, chartType, branch, branchData) => {
      const out = await certify({ spec: ir(trait, chartType), data: { [branch]: branchData } as never });
      expect(out.status).toBe('ok');
      expect(out.pillars?.accuracy).toBe('fail');
      const finding = (out.findings ?? []).find((f) => f.code === code);
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('error');
      expect(out.accuracySummary?.failing).toBeGreaterThanOrEqual(1);
      // The count in accuracySummary equals the number of OODS-V15x entries in findings[].
      expect(out.accuracySummary?.failing).toBe(
        (out.findings ?? []).filter((f) => /^OODS-V15\d$/.test(f.code)).length,
      );
      expect(validateOutput(out)).toBe(true);
    },
  );

  it.each(FIRING.map((row) => row[0]))('%s is a REGISTERED code, not an ad-hoc string', (code) => {
    const definition = getDefinition(code as string);
    expect(definition).toBeDefined();
    expect(definition?.category).toBe('validation');
    expect(definition?.retryable).toBe(true);
  });

  it('the ECharts findings are ERROR severity even where the render path is silent or only warns (V158)', async () => {
    const duplicated = {
      nodes: [{ name: 'A' }, { name: 'B' }],
      links: [
        { source: 'A', target: 'B', value: 30 },
        { source: 'A', target: 'B', value: 30 },
      ],
    };
    // viz.render renders it happily and emits NO duplicate warning for sankey (s148 F4
    // excluded sankey); certify calls it an error. The escalation is the point.
    const rendered = await vizRender({ chartType: 'sankey', sankey: duplicated } as never);
    expect(rendered.status).toBe('ok');
    expect((rendered.warnings ?? []).some((w) => w.code === 'OODS-V148')).toBe(false);

    const out = await certify({ spec: ir('MarkSankey', 'sankey'), data: { sankey: duplicated } as never });
    expect(out.findings?.find((f) => f.code === 'OODS-V158')?.severity).toBe('error');
  });

  it('an accuracy failure prevents conformance under the declared operand profile', async () => {
    const out = await certify({
      spec: ir('MarkChord', 'chord'),
      data: { chord: { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: -5 }] } } as never,
    });
    expect(out.pillars?.accuracy).toBe('fail');
    expect(out.conformant).toBe(false);
    expect(out.coverage).toBe('certified');
  });

  it('an accuracy fail does NOT disturb the determinism proof — the rules are readers (#110)', async () => {
    const duplicated = {
      nodes: [{ name: 'A' }, { name: 'B' }],
      links: [
        { source: 'A', target: 'B', value: 30 },
        { source: 'A', target: 'B', value: 30 },
      ],
    };
    const rendered = await vizRender({
      chartType: 'sankey',
      sankey: duplicated,
      output: { echarts: true, includeNormalizedSpec: true },
    } as never);
    const out = await certify({
      spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
      data: { sankey: duplicated } as never,
    });
    expect(out.pillars?.accuracy).toBe('fail');
    expect(out.pillars?.determinism).toBe('pass');
    expect(out.determinism?.contentHash).toBe(rendered.contentHash);
  });
});

describe('artifact.certify — the cartesian accuracy path is untouched (s172 m03)', () => {
  it('a cartesian IR still reports the FOUR cartesian rules, with the s170 summary shape', async () => {
    const spec = buildVizSpecFromRows({
      rows: [
        { region: 'North', revenue: 100 },
        { region: 'South', revenue: 120 },
      ],
      chartType: 'bar',
      encodings: { x: { field: 'region' }, y: { field: 'revenue', aggregate: 'sum' } } as never,
    }).spec;
    const out = await certify({ spec });
    expect(out.coverage).toBe('certified');
    expect(out.pillars?.accuracy).toBe('pass');
    expect(out.accuracySummary?.rulesEvaluated).toBeGreaterThan(0);
    expect(out.accuracySummary?.rulesEvaluated).toBeLessThanOrEqual(4);
    // No ECharts rule code can appear on a cartesian verdict.
    expect((out.findings ?? []).some((f) => /^OODS-V15[4-9]$/.test(f.code))).toBe(false);
  });
});
