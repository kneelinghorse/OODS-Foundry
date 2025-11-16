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

describe('Layout parity', () => {
  it('keeps panel counts consistent between Vega-Lite and ECharts adapters', () => {
    const spec = loadSpec('facet-layout');
    const vlSpec = toVegaLiteSpec(spec);
    const option = toEChartsOption(spec);

    const facet = (vlSpec as { facet?: { row?: unknown; column?: unknown } }).facet;
    expect(facet).toBeDefined();
    const panelCount = option.series.length / spec.marks.length;

    expect(Number.isInteger(panelCount)).toBe(true);
    expect(panelCount).toBeGreaterThan(1);
    expect(option.usermeta?.oods.layoutRuntime?.panelCount).toBe(panelCount);
  });

  it('preserves shared scale declarations across adapters', () => {
    const spec = loadSpec('facet-layout');
    const vlSpec = toVegaLiteSpec(spec);
    const option = toEChartsOption(spec);

    const resolve = (vlSpec as { resolve?: { scale?: Record<string, string> } }).resolve;
    expect(resolve?.scale?.color).toBe('shared');
    expect(option.usermeta?.oods.layoutRuntime?.shareColor).toBe(true);
  });
});
