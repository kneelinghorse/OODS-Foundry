import { createRequire } from 'node:module';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateScaffold } from '@/viz/patterns/scaffold-generator.js';
import { recommendInteractions } from '@oods/viz-core';
import { scoreLayoutForPattern } from '@oods/viz-core';
import { suggestPatterns, type SchemaIntent } from '@oods/viz-core';

describe('scaffold generator', () => {
  it('produces JSON spec + component shell for chart suggestion', () => {
    const schema: SchemaIntent = {
      measures: 1,
      dimensions: 2,
      goal: 'comparison',
      requiresGrouping: true,
    };
    const [suggestion] = suggestPatterns(schema, { limit: 1 });
    expect(suggestion).toBeDefined();
    const layout = scoreLayoutForPattern(suggestion.pattern.id, schema);
    const interactions = recommendInteractions(suggestion.pattern.id, schema);
    const artifacts = generateScaffold({ suggestion, schema, layout, interactions });
    expect(artifacts.spec).toContain('"$schema"');
    expect(artifacts.component).toContain('export function');
    // s191-m03 C: emitted imports must resolve from a consumer, beyond a string match.
    expect(artifacts.component).toContain("from '@oods/viz-core'");
    expect(artifacts.component).not.toContain('@/viz/spec/normalized-viz-spec');
    expect(createRequire(import.meta.url).resolve('@oods/viz-core')).toBeTruthy();
    const fixtures = ['areaChartSpec', 'barChartSpec', 'facetGridSpec', 'heatmapSpec', 'layeredViewSpec', 'lineChartSpec', 'mergeSpec', 'scatterChartSpec'].map(name => `tests/components/viz/__fixtures__/${name}.ts`);
    const program = ts.createProgram(fixtures, { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true });
    expect(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
  });
});
