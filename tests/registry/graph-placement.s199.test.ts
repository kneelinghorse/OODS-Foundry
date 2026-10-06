import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { TraitLoader } from '../../src/registry/trait-loader.js';
import { TraitResolver } from '../../src/registry/resolver.js';
import { applyTraitParameters } from '../../src/registry/parameter-applier.js';
import graph from '../../traits/viz/mark-graph.trait.js';
import type { ObjectDefinition } from '../../src/registry/object-definition.js';

describe('Relationship graph source registry boundary', () => {
  it('projects the declared edge operand only into detail without adding graph controls or fields', async () => {
    const object = load(fs.readFileSync('objects/core/Relationship.object.yaml', 'utf8')) as ObjectDefinition;
    const reference = object.traits!.find(trait => trait.name === 'viz/MarkGraph')!;
    const [bound] = await new TraitResolver({ loader: new TraitLoader({ roots: [path.resolve('traits')] }) }).resolveReferences([reference]);
    // s222-m03 retitled the chart to the record's own neighbourhood; s223-m01 (#2527 ruling 5): no chart title says Example.
    expect(bound.parameters.title).toBe('Connected relationships');
    expect(bound.parameters.description).toBe('This relationship and the others that share one of its endpoints.');
    expect(bound.parameters.description).not.toMatch(/example|synthetic/i);
    expect(bound.parameters.chart).toMatchObject({ source: 'edge-array', dataField: 'neighborhood', edges: { source: 'source_id', target: 'target_id', bidirectionalField: 'is_bidirectional' } });
    expect(Object.keys(bound.definition.view_extensions!)).toEqual(['detail']);
    expect(bound.definition.view_extensions!.detail![0]).toMatchObject({ component: 'VizGraphPreview', props: { chart: bound.parameters.chart, title: bound.parameters.title } });
    expect(bound.definition.schema).toEqual({});
    expect(bound.definition.semantics).toEqual({});
    expect(bound.definition.dependencies).toEqual([]);
    expect(object.schema!.neighborhood).toMatchObject({ type: 'array', required: false });
  });
  it('rejects an invented value channel or a Cartesian source and keeps the authored trait intact', () => {
    const before = structuredClone(graph);
    const chart = { chartType: 'force_graph', source: 'edge-array', dataField: 'neighborhood', edges: { source: 'from', target: 'to' }, sampleRows: [{ from: 'a', to: 'b' }] };
    expect(() => applyTraitParameters(graph, { chart })).not.toThrow();
    expect(() => applyTraitParameters(graph, { chart: { ...chart, source: 'record-array' } })).toThrow();
    expect(() => applyTraitParameters(graph, { chart: { ...chart, edges: { ...chart.edges, value: 'strength' } } })).toThrow();
    expect(graph).toEqual(before);
  });
});
