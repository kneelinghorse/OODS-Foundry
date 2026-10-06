import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VIZ_RECIPES } from '@oods/viz-core';
import { canonical, collectChartPlacements, measureVizCensus } from '../../../../scripts/product-reality/s190-viz-census.js';

const root = new URL('../../../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');

describe('one executable visualization registry (s190 m05)', () => {
  it('measures through public contracts only; no private implementation/registry imports', () => {
    const imports = [...read('scripts/product-reality/s190-viz-census.ts').matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
    // s223-m03 (#2527 ruling 17): git and a hash only write the census's stamp (its head, version and registry SHA-256);
    // the measurement itself still goes through the four public tool handlers.
    expect(imports).toEqual([
      'node:assert/strict', 'node:child_process', 'node:crypto', 'node:fs', 'node:path', 'node:url', 'ajv/dist/2020.js',
      '../../packages/mcp-server/src/tools/viz.render.js',
      '../../packages/mcp-server/src/tools/dashboard.render.js',
      '../../packages/mcp-server/src/tools/artifact.certify.js',
      '../../packages/mcp-server/src/tools/design.compose.js',
    ]);
    expect(read('scripts/product-reality/s190-viz-census.ts')).not.toMatch(/import\s*\(|require\s*\(/);
  });

  it('inventories actual chart nodes and preserves the public request without mistaking source metadata for runtime proof', () => {
    const chart = { chartType: 'line', source: 'record-array', dataField: 'samples' };
    const schema = { metadata: { chart }, screens: [{ children: [{ id: 'trend', component: 'VizLinePreview', chart }] }] };
    expect(collectChartPlacements(schema, { object: 'Usage', layout: 'dashboard' })).toEqual([
      { object: 'Usage', context: null, layout: 'dashboard', nodeId: 'trend', component: 'VizLinePreview', chartType: 'line', chartSource: 'record-array', dataField: 'samples', evidence: 'composed-declaration' },
    ]);
    expect(collectChartPlacements({ metadata: { chart }, id: 'empty', component: 'VizLinePreview', props: { chart } }, { object: 'Usage', context: 'detail' })).toEqual([]);
    expect(() => collectChartPlacements({ component: 'VizLinePreview', chart }, { object: 'Usage', context: 'detail' })).toThrow('node identity');
  });

  it('the exported registry equals every live census cell after canonicalization', async () => {
    const source = JSON.parse(read('packages/viz-core/src/registry/viz-recipes.v1.json'));
    const result = await measureVizCensus();
    expect(canonical(source)).toBe(canonical(result.registry));
    expect(canonical(VIZ_RECIPES)).toBe(canonical(source));
    expect(result.placementCompositions).toBe(88);
    expect(result.placements.map(({ object, context, layout, component, chartType, dataField }) => [object, context, layout, component, chartType, dataField ?? null])).toEqual([
      ['Invoice', 'detail', null, 'VizMarkPreview', 'bar', 'line_items'],
      ['Invoice', 'workflow', null, 'VizMarkPreview', 'bar', 'line_items'],
      ['Invoice', null, 'dashboard', 'VizMarkPreview', 'bar', 'line_items'],
      ['Relationship', 'detail', null, 'VizGraphPreview', 'force_graph', 'neighborhood'],
      ['Relationship', 'workflow', null, 'VizGraphPreview', 'force_graph', 'neighborhood'],
      // s220-m01: the Subscription payment chart is bars; MarkBar also projects it into the dashboard.
      ['Subscription', 'detail', null, 'VizMarkPreview', 'bar', null],
      ['Subscription', 'workflow', null, 'VizMarkPreview', 'bar', null],
      ['Subscription', null, 'dashboard', 'VizMarkPreview', 'bar', null],
      ['Usage', 'detail', null, 'VizLinePreview', 'line', 'samples'],
      ['Usage', 'workflow', null, 'VizLinePreview', 'line', 'samples'],
      ['Usage', null, 'dashboard', 'VizLinePreview', 'line', 'samples'],
    ]);
    expect([...new Set(result.placements.map(place => place.chartType))].sort()).toEqual(['bar', 'force_graph', 'line']);
    expect(result.placements.every(place => place.evidence === 'composed-declaration')).toBe(true);
    expect(source).toHaveLength(13);
    expect(result.observations.flatMap(row => row.scopes)).toHaveLength(78);
    // s195-m04: the declared data operand profile certifies the eight ECharts types.
    // Coverage records the exercised profile; each scope retains its real boolean.
    expect(source.filter((row: any) => row.certifyCoverage === 'certified')).toHaveLength(13);
    expect(source.filter((row: any) => row.dashboardDrawn === true)).toHaveLength(11);
    for (const row of result.observations) for (const scope of row.scopes) {
      if (scope.status === 'typed-deferred') {
        expect(scope.theme).toBe('hc');
        expect(scope.errors.length).toBeGreaterThan(0);
        continue;
      }
      if (scope.coverage === 'uncertified') expect(scope.conformant).toBeNull();
      else expect(typeof scope.conformant).toBe('boolean');
      expect(scope.contrast).toMatchObject({ theme: scope.theme, brand: scope.brand });
      if (scope.theme === 'hc') {
        expect(scope.pillars.contrast).toBe('exempt');
        expect(JSON.stringify(scope.contrast)).toContain('forced-colors');
      }
    }
    for (const row of result.registry) {
      expect(row.certifyProfile).toBe(row.specEngine === 'echarts' ? 'echarts-data' : 'cartesian');
      if (row.chartInApp === 'not-placed') {
        expect(row.notes.join(' ')).toContain('Not placed:');
        if (row.specEngine === 'echarts') {
          expect(row.notes.join(' ')).toContain(`${row.chartType} requires`);
          expect(row.chartType).not.toBe('force_graph');
        }
      } else expect(row.notes.join(' ')).toContain('runtime proof is retained separately');
      expect(row.certifyScopes).toEqual(result.observations.find(observation => observation.chartType === row.chartType).scopes.filter((scope: any) => scope.status === 'rendered')
        .map(({ theme, brand, coverage, conformant, pillars, accuracySummary }: any) => ({ theme, brand, coverage, conformant, pillars, accuracySummary })));
      expect(row.renderScopes).toHaveLength(6);
      expect(row.certifyScopes.length).toBe(row.renderScopes.filter((scope: any) => scope.status === 'rendered').length);
      expect(row.themes.hc).toBe(row.renderScopes.filter((scope: any) => scope.theme === 'hc').every((scope: any) => scope.status === 'rendered'));
      expect(row.renderScopes.filter((scope: any) => scope.theme !== 'hc').every((scope: any) => scope.status === 'rendered')).toBe(true);
      for (const scope of row.certifyScopes) expect(scope.accuracySummary.rulesEvaluated).toBeGreaterThan(0);
      const exempt = ['heatmap', 'choropleth', 'bubble_map', 'flow_map'].includes(row.chartType);
      expect(row.contrastPassed).toEqual(exempt ? [] : ['light', 'dark']);
      if (exempt) expect(row.notes.join(' ')).toContain('exempt');
    }
    const contrastMutant = structuredClone(source); contrastMutant[0].contrastPassed = [];
    expect(canonical(contrastMutant)).not.toBe(canonical(result.registry));
    // A stale advertised cell must be rejected even when all other cells are right.
    const mutant = structuredClone(source); mutant[0].publicSvg = false;
    expect(canonical(mutant)).not.toBe(canonical(result.registry));
    expect(result.accuracyControls.map(control => control.expectedCode)).toEqual(['OODS-V168', 'OODS-V171']);
    for (const control of result.accuracyControls) {
      expect(control.grade.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: control.expectedCode })]));
      expect(control.grade).toMatchObject({ conformant: false, pillars: { accuracy: 'fail' } });
    }
  }, 60_000);
});
