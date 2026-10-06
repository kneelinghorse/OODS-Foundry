// s173 m01 — the geo IDENTITY parity proof (s172 review, defects 1 + 2).
//
// s172 m01 lifted renderGeoOption out of viz.render into echarts-geo-option.ts so that
// viz.render and artifact.certify could not drift. The lift changed the signature — from a
// whole VizRenderInput to a small {id, name} record — and the two call sites came out of it
// guarding that record DIFFERENTLY:
//
//   pre-lift viz.render:  renderGeoOption(input, …)                → `input.id ?? 'viz:<type>'`
//   post-lift viz.render: { ...(input.id ? { id: input.id } : {}) } → an EMPTY-STRING id was
//                                                                     DROPPED, so the same
//                                                                     input defaulted instead
//   certify:              { id: spec.id, … }                       → '' passed through
//
// `??` keeps an empty string and a truthiness spread does not, so `id: ''` — a value both
// schemas accept, neither having minLength — took two different paths through one shared
// builder. Downstream, deriveMapName truthiness-guards `spec.id` before falling through to
// `spec.name` and then to 'custom-geo', so certify emitted the PRE-LIFT map name while
// viz.render emitted 'map-viz:<type>'. The parity the lift existed to guarantee was broken
// by the lift itself, and s172's "behaviour byte-identical; its goldens prove it" claim was
// false: no golden supplies an empty id, so nothing was watching.
//
// STANDING RULE B (adopted with this sprint): when a private function is LIFTED to a shared
// module, compare the CALLERS' ARGUMENT GUARDING, not just the function body. This spec is
// that comparison, and it is done by ENUMERATION rather than by eye: the identity argument is
// an optional string, so the values on which two guards can disagree are exactly {absent,
// falsy-but-present, truthy}. All three run, on all three geo types, through BOTH real
// handlers.

import { describe, expect, it } from 'vitest';
import type { NormalizedVizSpec } from '@oods/viz-core';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import { emitRawEChartsOption, projectEChartsOption } from '../../src/tools/certify-echarts-emit.js';
import { renderGeoOption } from '../../src/tools/echarts-geo-option.js';
import { GEO_BUBBLE_BRANCH, GEO_CHOROPLETH_BRANCH, GEO_FLOW_BRANCH } from './s172-echarts-operands.js';

const GEO_CASES = [
  { chartType: 'choropleth', branchData: GEO_CHOROPLETH_BRANCH, name: 'State sales' },
  { chartType: 'bubble_map', branchData: GEO_BUBBLE_BRANCH, name: 'City population' },
  { chartType: 'flow_map', branchData: GEO_FLOW_BRANCH, name: 'Trade corridors' },
] as const;

/**
 * The three values an optional string identity can take, and the map name each MUST produce
 * when NO name is supplied — so the id is the only identity in play and deriveMapName's
 * chain reduces to `id → 'custom-geo'`.
 *
 * The expectations are the PRE-LIFT semantics restated as data (`id ?? 'viz:<type>'` into
 * deriveMapName's truthiness chain), written out per case rather than computed, so a future
 * change to either guard has to disagree with a literal instead of with a formula that moved
 * along with it.
 */
const ID_CASES = [
  { label: 'absent', id: undefined, mapNameFor: (chartType: string) => `map-viz:${chartType}` },
  // The defect's own value: falsy, but present and schema-valid on both surfaces.
  { label: "empty string ('')", id: '', mapNameFor: () => 'custom-geo' },
  { label: 'a caller-supplied id', id: 'atlas-2026', mapNameFor: () => 'map-atlas-2026' },
] as const;

/** The map name the option actually carries — geo.map for choropleth/flow, series[].map. */
function mapNameOf(option: unknown): string | undefined {
  const record = option as Record<string, unknown>;
  const geo = record.geo as { map?: string } | undefined;
  if (geo?.map) {
    return geo.map;
  }
  const series = record.series as Array<{ map?: string }> | undefined;
  return series?.find((entry) => typeof entry.map === 'string')?.map;
}

function renderInput(chartType: string, branchData: unknown, id: string | undefined, name?: string) {
  return {
    chartType,
    geo: branchData,
    ...(name === undefined ? {} : { name }),
    ...(id === undefined ? {} : { id }),
    output: { echarts: true, includeNormalizedSpec: true },
  };
}

/** Exactly how artifact.certify builds the identity record (certify-echarts-emit.ts). */
const identityFromCertify = (spec: NormalizedVizSpec) => ({
  id: spec.id,
  ...(spec.name ? { name: spec.name } : {}),
});

/** How viz.render built it BEFORE this fix — reconstructed as the mutant, not as production. */
const identityFromRenderPreFix = (spec: NormalizedVizSpec) => ({
  ...(spec.id ? { id: spec.id } : {}),
  ...(spec.name ? { name: spec.name } : {}),
});

describe('geo identity parity — viz.render and artifact.certify emit the SAME option (s173 m01)', () => {
  const matrix = GEO_CASES.flatMap((geo) => ID_CASES.map((idCase) => [geo.chartType, idCase.label, geo, idCase] as const));

  it.each(matrix)(
    '%s with id %s: certify re-emits viz.render\'s served bytes exactly',
    async (_type, _idLabel, geo, idCase) => {
      const rendered = await vizRender(renderInput(geo.chartType, geo.branchData, idCase.id) as never);
      expect(rendered.status).toBe('ok');

      const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
      // The IR carries the id the caller gave, empty string included — neither schema
      // constrains minLength, which is why this input reaches the builder at all.
      expect(ir.id).toBe(idCase.id ?? `viz:${geo.chartType}`);

      const reEmitted = projectEChartsOption(
        emitRawEChartsOption(ir, geo.chartType as never, geo.branchData),
      );
      // BYTE comparison of the served option against certify's re-emission — the property
      // the lift was for, on the argument the two callers used to disagree about.
      expect(JSON.stringify(reEmitted)).toBe(JSON.stringify(rendered.echartsSpec));

      // And the identity actually LANDED, rather than both paths defaulting together.
      expect(mapNameOf(reEmitted)).toBe(idCase.mapNameFor(geo.chartType));
    },
  );

  it.each(matrix)(
    '%s with id %s: the certify VERDICT agrees with the render hash (live, both handlers)',
    async (_type, _idLabel, geo, idCase) => {
      const rendered = await vizRender(renderInput(geo.chartType, geo.branchData, idCase.id) as never);
      const certified = await certify({
        spec: rendered.normalizedSpec as unknown as NormalizedVizSpec,
        data: { geo: geo.branchData } as never,
      });
      expect(certified.status).toBe('ok');
      expect(certified.determinism?.contentHash).toBe(rendered.contentHash);
      expect(certified.pillars?.determinism).toBe('pass');
    },
  );

  it('the empty-string case is DISTINCT from the absent case — it is carried, not defaulted', async () => {
    // Without this, the id:'' rows above could pass while '' was being silently swallowed:
    // both paths would agree on the DEFAULT and the parity assertion would still hold. Two
    // callers agreeing on the wrong thing is indistinguishable from two callers agreeing on
    // the right thing unless the right thing is named.
    const empty = await vizRender(renderInput('choropleth', GEO_CHOROPLETH_BRANCH, '') as never);
    const absent = await vizRender(renderInput('choropleth', GEO_CHOROPLETH_BRANCH, undefined) as never);

    expect(mapNameOf(empty.echartsSpec)).toBe('custom-geo');
    expect(mapNameOf(absent.echartsSpec)).toBe('map-viz:choropleth');
    expect(empty.contentHash).not.toBe(absent.contentHash);
  });

  it('with a NAME present, id:"" falls through to the name — the full deriveMapName chain, both tools', async () => {
    // The third link of the chain, and the shape a real caller hits: an empty id does not
    // mean "no identity", it means "skip to the next one". Pre-fix this rendered
    // 'map-viz:choropleth' — the id that was never supplied.
    const rendered = await vizRender(renderInput('choropleth', GEO_CHOROPLETH_BRANCH, '', 'State sales') as never);
    const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
    const reEmitted = projectEChartsOption(emitRawEChartsOption(ir, 'choropleth' as never, GEO_CHOROPLETH_BRANCH));

    expect(mapNameOf(rendered.echartsSpec)).toBe('state sales');
    expect(mapNameOf(rendered.echartsSpec)).not.toBe('map-viz:choropleth');
    expect(JSON.stringify(reEmitted)).toBe(JSON.stringify(rendered.echartsSpec));
  });
});

describe('standing rule B — the two callers guard the identity argument identically (s173 m01)', () => {
  // The rule is about CALL SITES, so the check drives the shared builder the way each caller
  // drives it and compares. The pre-fix viz.render guard is reconstructed here as the MUTANT:
  // this is the bite proof for the one-line fix, and it reds loudly if the fix is reverted,
  // without needing an empty-id golden that nobody would have thought to add.
  it.each(GEO_CASES.map((geo) => [geo.chartType, geo] as const))(
    '%s: certify\'s guard and the PRE-FIX render guard disagree on id:"" — that disagreement WAS the defect',
    (_label, geo) => {
      const spec = { id: '', a11y: { description: 'd' } } as unknown as NormalizedVizSpec;
      const viaCertify = renderGeoOption(identityFromCertify(spec), geo.chartType as never, geo.branchData as never, 'd');
      const viaOldRender = renderGeoOption(identityFromRenderPreFix(spec), geo.chartType as never, geo.branchData as never, 'd');

      expect(mapNameOf(viaCertify.option)).toBe('custom-geo');
      expect(mapNameOf(viaOldRender.option)).toBe(`map-viz:${geo.chartType}`);
      expect(JSON.stringify(viaCertify.option)).not.toBe(JSON.stringify(viaOldRender.option));
    },
  );

  it.each(GEO_CASES.map((geo) => [geo.chartType, geo] as const))(
    '%s: the SHIPPED render path now matches certify\'s guard on id:"" — the guards are aligned',
    async (_label, geo) => {
      const rendered = await vizRender(renderInput(geo.chartType, geo.branchData, '', geo.name) as never);
      const ir = rendered.normalizedSpec as unknown as NormalizedVizSpec;
      const viaCertify = projectEChartsOption(
        renderGeoOption(identityFromCertify(ir), geo.chartType as never, geo.branchData as never, ir.a11y.description).option,
      );
      expect(JSON.stringify(rendered.echartsSpec)).toBe(JSON.stringify(viaCertify));

      // …and NOT by both having defaulted: the pre-fix guard still produces different bytes.
      const viaOldRender = projectEChartsOption(
        renderGeoOption(identityFromRenderPreFix(ir), geo.chartType as never, geo.branchData as never, ir.a11y.description).option,
      );
      expect(JSON.stringify(rendered.echartsSpec)).not.toBe(JSON.stringify(viaOldRender));
    },
  );
});
