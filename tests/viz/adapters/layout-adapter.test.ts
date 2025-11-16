import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from '../../../src/viz/adapters/vega-lite-adapter.js';
import { toEChartsOption } from '../../../src/viz/adapters/echarts-adapter.js';
import type { NormalizedVizSpec } from '../../../src/viz/spec/normalized-viz-spec.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const EXAMPLES_DIR = path.join(ROOT, 'examples', 'viz');

function loadSpec(name: string): NormalizedVizSpec {
  const raw = readFileSync(path.join(EXAMPLES_DIR, `${name}.spec.json`), 'utf8');
  return JSON.parse(raw) as NormalizedVizSpec;
}

describe('Layout adapters', () => {
  it('maps LayoutFacet metadata to Vega-Lite facet specifications', () => {
    const spec = loadSpec('facet-layout');
    const vlSpec = toVegaLiteSpec(spec);

    expect('facet' in vlSpec).toBe(true);
    const facet = (vlSpec as { facet?: { row?: { field?: string }; column?: { field?: string } } }).facet;
    expect(facet?.row?.field).toBe('region');
    expect(facet?.column?.field).toBe('segment');

    const resolve = (vlSpec as { resolve?: { scale?: Record<string, string> } }).resolve;
    expect(resolve?.scale?.x).toBe('shared');
    expect(resolve?.scale?.y).toBe('shared');

    const innerSpec = (vlSpec as { spec?: { width?: number; height?: number } }).spec;
    expect(innerSpec?.width).toBe(360);
    expect(innerSpec?.height).toBe(260);
  });

  it('creates multi-grid ECharts options with derived datasets for each facet cell', () => {
    const spec = loadSpec('facet-layout');
    const option = toEChartsOption(spec);

    expect(Array.isArray(option.grid)).toBe(true);
    const grids = option.grid as readonly unknown[];
    expect(grids).toHaveLength(4);

    expect(option.series).toHaveLength(spec.marks.length * 4);
    expect(option.dataset.length).toBeGreaterThan(1);

    const derivedDataset = option.dataset[1];
    expect(derivedDataset.fromDatasetId).toBe(option.dataset[0]?.id);
    expect(derivedDataset.transform?.[0]?.config).toMatchObject({ field: 'region' });

    const layoutMeta = option.usermeta?.oods.layoutRuntime;
    expect(layoutMeta?.trait).toBe('LayoutFacet');
    expect(layoutMeta?.panelCount).toBe(4);
    expect(layoutMeta?.shareX).toBe(true);
  });
});
