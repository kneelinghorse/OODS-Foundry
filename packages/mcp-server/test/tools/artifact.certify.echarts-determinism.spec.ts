// s172 m02 — the determinism pillar for the 8 ECharts-primary types.
//
// The claim: given the SAME (spec, data) pair, certify's contentHash equals viz.render's.
// That can only hold if certify replays the render path's emission exactly — same adapter,
// same JSON projection, same __joinDiagnostics strip, __registration kept. So the parity
// assertion is LIVE and CROSS-TOOL: both hashes are computed in-test from the two real
// handlers on every run. Nothing is pinned, so no golden regen elsewhere in the sprint
// (m06 moves bubble_map's option) can stale these.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalize, sha256 } from '@oods/artifacts';
import { buildVizSpecFromRows, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import {
  emitRawEChartsOption,
  projectEChartsOption,
} from '../../src/tools/certify-echarts-emit.js';
import {
  ECHARTS_OPERAND_CASES,
  GEO_BUBBLE_NO_GEOMETRY_BRANCH,
  GEO_CHOROPLETH_UNMATCHED_BRANCH,
  renderInputFor,
  type EChartsOperandCase,
} from './s172-echarts-operands.js';
import { RENDERED_IR_A11Y_FINDINGS } from './s174-a11y-warnfirst-expectations.js';
import type { EChartsPrimaryType } from '../../src/tools/echarts-primary.js';

const outputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateOutput = getAjv().compile(outputSchema);

/** Render the case, hand certify the IR viz.render emitted plus the SAME data branch. */
async function renderThenCertify(operand: EChartsOperandCase) {
  const rendered = await vizRender(renderInputFor(operand) as never);
  const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
  const certified = await certify({ spec: ir, data: { [operand.branch]: operand.branchData } as never });
  return { rendered, ir, certified };
}

describe('artifact.certify — live cross-tool contentHash parity, same (spec, data) (s172 m02)', () => {
  it.each(ECHARTS_OPERAND_CASES.map((c) => [c.chartType, c] as const))(
    '%s: certify.determinism.contentHash === viz.render.contentHash',
    async (_label, operand) => {
      const { rendered, certified } = await renderThenCertify(operand);
      expect(rendered.status).toBe('ok');
      expect(rendered.contentHash).toBeTypeOf('string');
      expect(certified.status).toBe('ok');
      expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
      expect(certified.determinism?.stable).toBe(true);
      expect(certified.pillars?.determinism).toBe('pass');
      expect(validateOutput(certified)).toBe(true);
    },
  );

  it('the parity assertion is not vacuous: a one-value change to the operand moves BOTH hashes together', async () => {
    const base = ECHARTS_OPERAND_CASES.find((c) => c.chartType === 'sankey')!;
    const mutated: EChartsOperandCase = {
      ...base,
      branchData: {
        nodes: [{ name: 'Source' }, { name: 'Middle' }, { name: 'Sink' }],
        links: [
          { source: 'Source', target: 'Middle', value: 61 },
          { source: 'Middle', target: 'Sink', value: 60 },
        ],
      },
    };
    const a = await renderThenCertify(base);
    const b = await renderThenCertify(mutated);
    expect(a.certified.determinism?.contentHash).not.toBe(b.certified.determinism?.contentHash);
    expect(b.certified.determinism?.contentHash).toBe(b.rendered.contentHash);
  });

  it('the hash is a pure function of (spec, data): two certify calls agree byte-for-byte', async () => {
    const operand = ECHARTS_OPERAND_CASES.find((c) => c.chartType === 'choropleth')!;
    const first = await renderThenCertify(operand);
    const second = await renderThenCertify(operand);
    expect(first.certified.determinism?.contentHash).toBe(second.certified.determinism?.contentHash);
  });
});

describe('artifact.certify — the ECharts determinism verdict SHAPE (s172 m02)', () => {
  it.each(ECHARTS_OPERAND_CASES.map((c) => [c.chartType, c] as const))(
    '%s: the declared operand profile preserves option and render evidence',
    async (_label, operand) => {
      const { certified } = await renderThenCertify(operand);
      expect(certified.coverage).toBe('certified');
      expect(certified.conformant).toBe(true);
      const accuracyFindings: Array<{ code: string; severity: string }> = [];
      expect(certified.findings?.map((f) => ({ code: f.code, severity: f.severity }))).toEqual(
        [...accuracyFindings, ...RENDERED_IR_A11Y_FINDINGS[operand.chartType as EChartsPrimaryType]],
      );
      expect(certified.pillars).toEqual({
        a11yEquivalence: 'pass', determinism: 'pass',
        contrast: operand.branch === 'geo' ? 'exempt' : 'pass',
        accuracy: 'pass',
      });
      expect(certified.accuracySummary?.failing).toBe(0);
    },
  );

  it.each(ECHARTS_OPERAND_CASES.map((c) => [c.chartType, c] as const))(
    '%s: WITHOUT data the pillar is unchecked, there is NO determinism block, and the note says the operand is what is missing',
    async (_label, operand) => {
      const rendered = await vizRender(renderInputFor(operand) as never);
      const out = await certify({ spec: rendered.normalizedSpec as unknown as NormalizedVizSpec });
      expect(out.pillars?.determinism).toBe('unchecked');
      expect(out.determinism).toBeUndefined();
      const note = (out.notes ?? []).find((n) => n.startsWith('Determinism is unchecked'));
      expect(note).toBeDefined();
      expect(note).toContain(operand.trait);
      expect(note).toContain('metadata-only');
      expect(note).toContain('`data` branch');
    },
  );
});

describe('artifact.certify — the render-backed determinism note scopes the claim (s179 m05)', () => {
  it.each(ECHARTS_OPERAND_CASES.map((c) => [c.chartType, c] as const))(
    '%s: the scope note binds both identities to independent projections and the certified matrix',
    async (_label, operand) => {
      const { certified } = await renderThenCertify(operand);
      const note = (certified.notes ?? []).find((n) => n.includes('determinism verdict covers the emitted'));
      expect(note).toBeDefined();
      expect(note).toContain('two independently emitted projected options');
      expect(note).toContain('contentHash identifies the first projected option');
      expect(note).toContain('renderHash identifies the first normalized SVG');
      expect(note).toContain('packages/viz-render/certified-matrix.json');
    },
  );

  it('retires the option-only force-physics caveat now that force participates in the rendered proof', async () => {
    const PHYSICS = 'runtime force physics';
    for (const operand of ECHARTS_OPERAND_CASES) {
      const { certified } = await renderThenCertify(operand);
      const mentions = (certified.notes ?? []).some((n) => n.includes(PHYSICS));
      expect(mentions).toBe(false);
    }
  });
});

// ---- the RED-first replay mutations -------------------------------------------------
//
// Both mutations act on the output of the SHIPPED emit + SHIPPED projection, then re-hash.
// Each is proved BOTH directions in the same test: the unmutated projection matches
// viz.render's hash, the mutated one does not. That makes the retention/strip decisions
// demonstrably load-bearing rather than incidental.

describe('artifact.certify — replay mutation (i): dropping __registration breaks parity (s172 m02)', () => {
  const GEO_CASES = ECHARTS_OPERAND_CASES.filter((c) => c.branch === 'geo');

  it.each(GEO_CASES.map((c) => [c.chartType, c] as const))(
    '%s: __registration IS present in the served bytes, and a projection without it hashes differently',
    async (_label, operand) => {
      const rendered = await vizRender(renderInputFor(operand) as never);
      const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
      const projected = projectEChartsOption(
        emitRawEChartsOption(ir, operand.chartType as never, operand.branchData),
      );

      // The mutation is only meaningful if the key is actually there.
      expect(Object.prototype.hasOwnProperty.call(projected, '__registration')).toBe(true);

      // GREEN: the shipped projection reproduces viz.render's hash.
      expect(sha256(canonicalize(projected))).toBe(rendered.contentHash);

      // RED: the same projection with __registration deleted does not.
      const mutated = { ...projected };
      delete mutated.__registration;
      expect(sha256(canonicalize(mutated))).not.toBe(rendered.contentHash);
    },
  );

  it('bubble_map WITHOUT inline geometry carries no __registration, so this mutation is a NO-OP there — stated, not claimed', async () => {
    const operand: EChartsOperandCase = {
      chartType: 'bubble_map',
      trait: 'MarkBubble',
      branch: 'geo',
      branchData: GEO_BUBBLE_NO_GEOMETRY_BRANCH,
      name: 'City population',
    };
    const rendered = await vizRender(renderInputFor(operand) as never);
    const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
    const projected = projectEChartsOption(emitRawEChartsOption(ir, 'bubble_map', operand.branchData));
    expect(Object.prototype.hasOwnProperty.call(projected, '__registration')).toBe(false);
    const mutated = { ...projected };
    delete mutated.__registration;
    expect(sha256(canonicalize(mutated))).toBe(sha256(canonicalize(projected)));
    // Parity still holds for this shape — the no-op mutation is not a parity failure.
    const certified = await certify({ spec: ir, data: { geo: operand.branchData } as never });
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });
});

describe('artifact.certify — replay mutation (ii): skipping the __joinDiagnostics strip breaks parity (s172 m02)', () => {
  const operand: EChartsOperandCase = {
    chartType: 'choropleth',
    trait: 'MarkChoropleth',
    branch: 'geo',
    branchData: GEO_CHOROPLETH_UNMATCHED_BRANCH,
    name: 'State sales',
  };

  it('an UNMATCHED-JOIN choropleth really produces __joinDiagnostics, and keeping it hashes differently', async () => {
    const rendered = await vizRender(renderInputFor(operand) as never);
    const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
    const raw = emitRawEChartsOption(ir, 'choropleth', operand.branchData) as Record<string, unknown>;

    // The fixture must genuinely trip the diagnostics, or the mutation proves nothing.
    expect(Object.prototype.hasOwnProperty.call(raw, '__joinDiagnostics')).toBe(true);

    // GREEN: the shipped projection (which strips it) reproduces viz.render's hash.
    const stripped = projectEChartsOption(raw as never);
    expect(sha256(canonicalize(stripped))).toBe(rendered.contentHash);

    // RED: the same projection WITHOUT the strip does not.
    const unstripped = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    expect(sha256(canonicalize(unstripped))).not.toBe(rendered.contentHash);
  });

  it('the strip is a NO-OP for the other two geo types — the mutation is not claimed to bite them', async () => {
    for (const geo of ECHARTS_OPERAND_CASES.filter((c) => c.branch === 'geo' && c.chartType !== 'choropleth')) {
      const rendered = await vizRender(renderInputFor(geo) as never);
      const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
      const raw = emitRawEChartsOption(ir, geo.chartType as never, geo.branchData) as Record<string, unknown>;
      expect(Object.prototype.hasOwnProperty.call(raw, '__joinDiagnostics')).toBe(false);
    }
  });

  it('an unmatched-join choropleth still certifies with parity end-to-end through the handler', async () => {
    const rendered = await vizRender(renderInputFor(operand) as never);
    const certified = await certify({
      spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
      data: { geo: operand.branchData } as never,
    });
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });
});

describe('artifact.certify — a re-emit THROW is rejection parity, never a quiet unchecked (s172 m02)', () => {
  // The geo guards live inside the shared builder, so for the 3 geo types the RE-EMIT is
  // what rejects bad input. m01 removed certify's separate validate-and-discard call, so
  // this V126 comes out of certify-echarts-emit.ts's throw partition — the same partition
  // viz.render's own catch uses.
  it('a choropleth with no valueField errors from the RE-EMIT with the SAME code+message viz.render returns', async () => {
    const bad = { geojson: (ECHARTS_OPERAND_CASES.find((c) => c.chartType === 'choropleth')!.branchData as { geojson: unknown }).geojson, rows: [{ state: 'CA' }] };
    const rendered = await vizRender({ chartType: 'choropleth', geo: bad } as never);
    const ir = {
      $schema: 'https://oods-foundry.com/viz-spec/v1',
      id: 'viz:choropleth',
      data: { values: [] },
      marks: [{ trait: 'MarkChoropleth' }],
      encoding: {},
      a11y: { description: 'Choropleth map of regional values.' },
    } as unknown as NormalizedVizSpec;
    const certified = await certify({ spec: ir, data: { geo: bad } as never });
    expect(rendered.status).toBe('error');
    expect(certified.status).toBe('error');
    expect(certified.errors?.[0]?.code).toBe('OODS-V126');
    expect(certified.errors?.[0]?.code).toBe(rendered.errors?.[0]?.code);
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
    // And it is an ERROR, not a degraded pillar — the operand was refused, not unreadable.
    expect(certified.pillars).toBeUndefined();
  });

  // Measured, not assumed: an adjacency list whose parent is missing is DOCUMENTED as
  // becoming its own root (viz.render.input.json's hierarchy description), so it is not a
  // throw case. Both tools tolerate it identically and reach hash parity. Recording it
  // here stops a future reader from mistaking the absence of a hierarchy V128 test for an
  // untested path: no primary adapter throws EChartsAdapterError today (it is raised only
  // by the CARTESIAN toEChartsOption, echarts-adapter.ts:312), so the V128 arm of the emit
  // partition is defensive on both tools, and viz.render's catch has the same property.
  it('a hierarchy with a missing parentId is tolerated by BOTH tools identically (documented root-promotion, not a throw)', async () => {
    const orphan = { type: 'adjacency_list' as const, data: [{ id: 'a', parentId: 'ghost', value: 1 }] };
    const rendered = await vizRender({
      chartType: 'treemap',
      hierarchy: orphan,
      output: { echarts: true, includeNormalizedSpec: true },
    } as never);
    expect(rendered.status).toBe('ok');
    const certified = await certify({
      spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
      data: { hierarchy: orphan } as never,
    });
    expect(certified.status).toBe('ok');
    expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
  });
});

describe('artifact.certify — the cartesian determinism path is untouched (s172 m02)', () => {
  it('a cartesian IR still proves determinism through the Vega-Lite compile, with no operand involved', async () => {
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
    expect(out.pillars?.determinism).toBe('pass');
    expect(out.determinism?.contentHash).toBeTypeOf('string');
    // The ECharts scope note must NOT leak onto the cartesian path.
    expect((out.notes ?? []).some((n) => n.includes('@oods/tokens bundle version'))).toBe(false);
  });
});
