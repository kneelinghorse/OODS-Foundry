// s172 m01 — the OPERAND path: artifact.certify's optional `data` input.
//
// Three things are under test, and they are the three ways this could ship a lie:
//   1. The MIRRORED branch schemas really are the viz.render ones (the keep-in-step
//      mechanism, stronger than the $comment that names the source).
//   2. The wire contract: exactly one branch, closed to anything else, `spec`-only still
//      valid.
//   3. REJECTION PARITY: certify refuses what viz.render refuses, with the same code and
//      the SAME MESSAGE — because both call the same validator, not because both were
//      typed to say the same thing. Each rejection case is asserted against viz.render's
//      own response for the equivalent input, so a divergence in either tool reds this.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVizSpecFromRows, type NormalizedVizSpec } from '@oods/viz-core';
import { getAjv } from '../../src/lib/ajv.js';
import { handle } from '../../src/tools/artifact.certify.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import { echartsPrimaryIr } from './s172-spec-only-cases.js';

const certifyInputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.input.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const vizRenderInputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/viz.render.input.json', import.meta.url), 'utf8'),
) as Record<string, any>;
const certifyOutputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/artifact.certify.output.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const validateInput = getAjv().compile(certifyInputSchema);
const validateOutput = getAjv().compile(certifyOutputSchema);

// ---- operands -----------------------------------------------------------------

const HIERARCHY = {
  type: 'nested' as const,
  data: { name: 'root', children: [{ name: 'a', value: 4 }, { name: 'b', value: 6 }] },
};
const SANKEY = {
  nodes: [{ name: 'A' }, { name: 'B' }],
  links: [{ source: 'A', target: 'B', value: 5 }],
};
const CHORD = {
  nodes: [{ name: 'A' }, { name: 'B' }],
  links: [{ source: 'A', target: 'B', value: 5 }],
};
const NETWORK = {
  nodes: [{ id: 'A' }, { id: 'B' }],
  links: [{ source: 'A', target: 'B' }],
};
const GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { code: 'AA', metric: 3 },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    },
  ],
};
const GEO_CHOROPLETH = { geojson: GEOJSON, valueField: 'metric', rows: [{ code: 'AA', metric: 3 }] };

const irFor = (trait: string, chartType: string): NormalizedVizSpec => echartsPrimaryIr(trait, chartType);

const cartesianIr = (): NormalizedVizSpec =>
  buildVizSpecFromRows({
    rows: [{ region: 'North', revenue: 100 }],
    chartType: 'bar',
    encodings: { x: { field: 'region' }, y: { field: 'revenue' } } as never,
  }).spec;

// ---- 1. the mirrored branch schemas -------------------------------------------

describe('artifact.certify input schema — the mirrored branch $defs (s172 m01)', () => {
  const BRANCHES = ['hierarchy', 'sankey', 'chord', 'network', 'geo'] as const;

  it.each(BRANCHES)(
    '$defs.%sBranch is deep-equal to viz.render.input.json properties.%s (a copy, not a paraphrase)',
    (branch) => {
      const mirrored = (certifyInputSchema as any).$defs[`${branch}Branch`];
      const source = vizRenderInputSchema.properties[branch];
      expect(mirrored).toEqual(source);
    },
  );

  it('$defs.hierarchyNode is deep-equal to viz.render.input.json $defs.hierarchyNode (the recursive $ref target comes along)', () => {
    expect((certifyInputSchema as any).$defs.hierarchyNode).toEqual(vizRenderInputSchema.$defs.hierarchyNode);
  });

  it('the $comment names the source file, so the copy is DECLARED and not silent', () => {
    const comment = String((certifyInputSchema as any).properties.data.$comment);
    expect(comment).toContain('viz.render.input.json');
    expect(comment).toContain('MIRRORED COPY');
  });

  it('the keep-in-step check can discriminate: a mutated copy is NOT deep-equal to the source', () => {
    const mutated = JSON.parse(JSON.stringify((certifyInputSchema as any).$defs.sankeyBranch));
    mutated.properties.links.minItems = 99;
    expect(mutated).not.toEqual(vizRenderInputSchema.properties.sankey);
  });
});

// ---- 2. the wire contract ------------------------------------------------------

describe('artifact.certify input schema — the `data` wire contract (s172 m01)', () => {
  const spec = { $schema: 'x', id: 'y' } as Record<string, unknown>;

  it('{spec} alone is still valid — `data` is OPTIONAL', () => {
    expect(validateInput({ spec })).toBe(true);
  });

  it('exactly one branch is valid', () => {
    expect(validateInput({ spec, data: { sankey: SANKEY } })).toBe(true);
    expect(validateInput({ spec, data: { geo: GEO_CHOROPLETH } })).toBe(true);
  });

  it('TWO branches are rejected at the wire (maxProperties) — a chart has one operand', () => {
    expect(validateInput({ spec, data: { sankey: SANKEY, chord: CHORD } })).toBe(false);
  });

  it('an EMPTY data object is rejected at the wire (minProperties) — no dead input', () => {
    expect(validateInput({ spec, data: {} })).toBe(false);
  });

  it('an unknown branch name is rejected (data is closed)', () => {
    expect(validateInput({ spec, data: { rows: [] } })).toBe(false);
  });

  it('the TOP-LEVEL input is still closed (additionalProperties:false survived the edit)', () => {
    expect(validateInput({ spec, inventedScope: 'A' })).toBe(false);
    expect(validateInput({ spec, brand: 'A', theme: 'dark' })).toBe(true);
  });

  it('the mirrored branch shape really validates content, not just the key (a valueless sankey link is refused)', () => {
    expect(
      validateInput({ spec, data: { sankey: { nodes: [{ name: 'A' }], links: [{ source: 'A', target: 'A' }] } } }),
    ).toBe(false);
  });
});

// ---- 3. rejection parity with viz.render --------------------------------------

describe('artifact.certify — the operand is validated by the RENDER path validators (s172 m01)', () => {
  it('sankey: a non-finite link value is refused with viz.render’s own SankeyValidationError message (OODS-V126)', async () => {
    const bad = { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: Number.NaN }] };
    const certified = await handle({ spec: irFor('MarkSankey', 'sankey'), data: { sankey: bad } });
    const rendered = await vizRender({ chartType: 'sankey', sankey: bad } as never);
    expect(certified.status).toBe('error');
    expect(certified.errors?.[0]?.code).toBe('OODS-V126');
    expect(rendered.status).toBe('error');
    // SAME message, because it is the SAME validator — not two transcriptions.
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
  });

  it('chord: a dangling link ref is refused with viz.render’s own V147 message', async () => {
    const bad = { nodes: [{ name: 'A' }], links: [{ source: 'A', target: 'ghost', value: 2 }] };
    const certified = await handle({ spec: irFor('MarkChord', 'chord'), data: { chord: bad } });
    const rendered = await vizRender({ chartType: 'chord', chord: bad } as never);
    expect(certified.errors?.[0]?.code).toBe('OODS-V147');
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
    // The message is keyed to chord's NODE KEY ('name'), so it is genuinely the chord form.
    expect(certified.errors?.[0]?.message).toContain('must match a node name');
  });

  it('force_graph: a dangling link ref is refused with the force_graph node key (id), same message as render', async () => {
    const bad = { nodes: [{ id: 'A' }], links: [{ source: 'A', target: 'ghost' }] };
    const certified = await handle({ spec: irFor('MarkGraph', 'force_graph'), data: { network: bad } });
    const rendered = await vizRender({ chartType: 'force_graph', network: bad } as never);
    expect(certified.errors?.[0]?.code).toBe('OODS-V147');
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
    expect(certified.errors?.[0]?.message).toContain('must match a node id');
  });

  it('geo: a choropleth with no valueField is refused with viz.render’s own GeoInputError message (OODS-V126)', async () => {
    const bad = { geojson: GEOJSON, rows: [{ code: 'AA' }] };
    const certified = await handle({ spec: irFor('MarkChoropleth', 'choropleth'), data: { geo: bad } });
    const rendered = await vizRender({ chartType: 'choropleth', geo: bad } as never);
    expect(certified.errors?.[0]?.code).toBe('OODS-V126');
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
  });

  it('geo: a bubble_map with no rows is refused with viz.render’s own message', async () => {
    const bad = { longitudeField: 'lng', latitudeField: 'lat', rows: [] };
    const certified = await handle({ spec: irFor('MarkBubble', 'bubble_map'), data: { geo: bad } });
    const rendered = await vizRender({ chartType: 'bubble_map', geo: bad } as never);
    expect(certified.errors?.[0]?.code).toBe('OODS-V126');
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
  });

  it('geo: a flow_map missing its origin/destination fields is refused with viz.render’s own message', async () => {
    const bad = { geojson: GEOJSON, rows: [{ a: 1 }] };
    const certified = await handle({ spec: irFor('MarkFlow', 'flow_map'), data: { geo: bad } });
    const rendered = await vizRender({ chartType: 'flow_map', geo: bad } as never);
    expect(certified.errors?.[0]?.code).toBe('OODS-V126');
    expect(certified.errors?.[0]?.message).toBe(rendered.errors?.[0]?.message);
  });

  // The parity assertions above would be vacuous if BOTH tools returned the same thing on
  // a VALID operand too. They do not: a valid operand is accepted by certify.
  it.each([
    ['MarkTreemap', 'treemap', { hierarchy: HIERARCHY }],
    ['MarkSunburst', 'sunburst', { hierarchy: HIERARCHY }],
    ['MarkSankey', 'sankey', { sankey: SANKEY }],
    ['MarkChord', 'chord', { chord: CHORD }],
    ['MarkGraph', 'force_graph', { network: NETWORK }],
    ['MarkChoropleth', 'choropleth', { geo: GEO_CHOROPLETH }],
  ] as const)('%s: a VALID operand is accepted (status ok, schema-valid)', async (trait, chartType, data) => {
    const out = await handle({ spec: irFor(trait, chartType), data: data as never });
    expect(out.status).toBe('ok');
    expect(validateOutput(out)).toBe(true);
  });
});

describe('artifact.certify — operand/trait coupling (s172 m01)', () => {
  it('a branch that does not match the trait is a structured error naming both', async () => {
    const out = await handle({ spec: irFor('MarkSankey', 'sankey'), data: { hierarchy: HIERARCHY } as never });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('"sankey" data branch');
    expect(out.errors?.[0]?.message).toContain('"hierarchy" was supplied');
  });

  it('`data` on a CARTESIAN spec is a structured error — dead input is refused, never ignored', async () => {
    const out = await handle({ spec: cartesianIr(), data: { sankey: SANKEY } as never });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('MarkBar');
    expect(out.errors?.[0]?.message).toContain('dead input');
  });

  it('`data` on an UNMODELED trait is the same structured error', async () => {
    const cartesian = cartesianIr() as unknown as { marks: Array<{ trait: string }> };
    const unmodeled = { ...cartesian, marks: [{ ...cartesian.marks[0], trait: 'MarkTrellis' }] };
    const out = await handle({ spec: unmodeled as never, data: { sankey: SANKEY } as never });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('MarkTrellis');
  });

  it('a direct-caller `data:{}` (AJV bypassed) is refused rather than silently treated as absent', async () => {
    const out = await handle({ spec: irFor('MarkSankey', 'sankey'), data: {} });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('no branch');
  });

  it('a direct-caller two-branch `data` (AJV bypassed) is refused', async () => {
    const out = await handle({
      spec: irFor('MarkSankey', 'sankey'),
      data: { sankey: SANKEY, chord: CHORD } as never,
    });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
    expect(out.errors?.[0]?.message).toContain('2 branches');
  });

  it('the coupling check reads the ALIAS-normalized trait: MarkHeatmap is cartesian, so data is refused', async () => {
    const cartesian = cartesianIr() as unknown as { marks: Array<{ trait: string }> };
    const heatmap = { ...cartesian, marks: [{ ...cartesian.marks[0], trait: 'MarkHeatmap' }] };
    const out = await handle({ spec: heatmap as never, data: { sankey: SANKEY } as never });
    expect(out.status).toBe('error');
    expect(out.errors?.[0]?.code).toBe('OODS-V123');
  });
});
