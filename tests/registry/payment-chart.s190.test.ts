import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TraitLoader } from '../../src/registry/trait-loader.js';
import { TraitResolver } from '../../src/registry/resolver.js';

const chart = { chartType: 'area', source: 'payment-events', dateFields: ['last_payment_at', 'next_payment_due_at'], amountField: 'amount', minorUnits: 100, currencyField: 'currency' };
const resolver = () => new TraitResolver({ loader: new TraitLoader({ roots: [path.resolve('traits')] }) });

describe('canonical payment-chart trait projection', () => {
  it('projects existing fields and detail only, without requiring standalone encoding traits', async () => {
    const [bound] = await resolver().resolveReferences([{ name: 'viz/MarkArea', parameters: { chart } }]);
    expect(bound.definition.schema).toEqual({});
    expect(bound.definition.semantics).toEqual({});
    expect(bound.definition.dependencies).toEqual([]);
    expect(Object.keys(bound.definition.view_extensions!)).toEqual(['detail']);
    // s223-m01 (#2527 ruling 5): MarkArea's default description is neutral; it was Subscription's payment sentence.
    expect(bound.definition.view_extensions!.detail).toEqual([{ component: 'VizAreaPreview', position: 'top', priority: 55, props: { chart, title: 'Payment amounts', description: 'Values recorded for this record.' } }]);
    const [standalone] = await resolver().resolveReferences([{ name: 'viz/MarkArea' }]);
    expect(standalone.definition.schema.viz_mark_type).toBeDefined();
    expect(standalone.definition.dependencies).toEqual(expect.arrayContaining(['EncodingPositionX', 'EncodingPositionY']));
    expect(standalone.definition.view_extensions!.form).toBeDefined();
  });

  it('validates the same chart declaration as the public compose schema', async () => {
    const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
    const publicDeclaration = read('packages/mcp-server/src/schemas/repl.ui.schema.json').$defs.chartDeclaration;
    const areaDeclaration = structuredClone(publicDeclaration);
    areaDeclaration.title = 'MarkAreaChartDeclaration';
    // The graph-only edge source must never become a valid area declaration.
    areaDeclaration.oneOf = areaDeclaration.oneOf.filter((branch: any) => branch.properties.source.const !== 'edge-array');
    expect(areaDeclaration.oneOf.map((branch: any) => branch.properties.source.const)).toEqual(['payment-events', 'record-array']);
    for (const branch of areaDeclaration.oneOf) branch.properties.chartType = { const: 'area' };
    expect(read('schemas/traits/mark-area.parameters.schema.json').properties.chart).toEqual(areaDeclaration);
    await expect(resolver().resolveReferences([{ name: 'viz/MarkArea', parameters: { chart: { ...chart, minorUnits: 0 } } }])).rejects.toThrow('TE-0203: must be > 0');
  });

  // s223-m02 (#2527 ruling 13 f): scripts/product-reality/s195-chart-declaration-schema.ts wrote these six copies
  // from its own hard-coded declaration. Nothing ran it after s213-m04, and running it reverted s213-m04's brand
  // format and dropped s223-m01's money fields, so it was retired. The public compose schema is the one source; an
  // edit that reaches some Mark copies and not others fails here.
  it('gives every Mark trait the public chart declaration, narrowed to its chart type', () => {
    const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
    const publicDeclaration = read('packages/mcp-server/src/schemas/repl.ui.schema.json').$defs.chartDeclaration;
    const sources = { area: ['payment-events', 'record-array'], bar: ['payment-events', 'record-array'], line: ['record-array'], point: ['record-array'], rect: ['record-array'], graph: ['edge-array'] };
    const chartTypes = { area: 'area', bar: 'bar', line: 'line', point: 'scatter', rect: 'heatmap', graph: 'force_graph' };
    for (const [mark, admitted] of Object.entries(sources)) {
      const declaration = structuredClone(publicDeclaration);
      declaration.title = `Mark${mark[0]!.toUpperCase()}${mark.slice(1)}ChartDeclaration`;
      declaration.oneOf = declaration.oneOf.filter((branch: any) => admitted.includes(branch.properties.source.const));
      for (const branch of declaration.oneOf) branch.properties.chartType = { const: chartTypes[mark as keyof typeof chartTypes] };
      expect(read(`schemas/traits/mark-${mark}.parameters.schema.json`).properties.chart, mark).toEqual(declaration);
    }
  });
});
