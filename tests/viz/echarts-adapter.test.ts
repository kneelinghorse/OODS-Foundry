import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toEChartsOption, EChartsAdapterError } from '../../src/viz/adapters/echarts-adapter.js';
import type { NormalizedVizSpec } from '../../src/viz/spec/normalized-viz-spec.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const EXAMPLES_DIR = path.join(ROOT, 'examples', 'viz');

function loadSpec(name: string): NormalizedVizSpec {
  const raw = readFileSync(path.join(EXAMPLES_DIR, `${name}.spec.json`), 'utf8');
  return JSON.parse(raw) as NormalizedVizSpec;
}

describe('ECharts adapter', () => {
  it('converts the curated bar chart spec', () => {
    const spec = loadSpec('bar-chart');
    const option = toEChartsOption(spec);

    expect(option.dataset[0].source).toHaveLength(4);
    expect(option.series[0]).toMatchObject({
      type: 'bar',
      encode: { x: 'region', y: 'mrr' },
    });
    expect(option.xAxis).toMatchObject({ type: 'category', name: 'Region' });
    expect(option.yAxis).toMatchObject({ type: 'value', name: 'MRR (USD)' });
    expect(option.legend?.show).toBe(true);
    expect(option.aria?.description).toBe(spec.a11y.description);
    expect(option.tooltip).toMatchObject({ trigger: 'item' });
    expect(option.usermeta?.oods?.interactions).toHaveLength(2);
    const formatter = option.tooltip?.formatter as ((params: unknown) => string) | undefined;
    expect(formatter?.({ data: { region: 'North', mrr: 120000 } })).toContain('North');
  });

  it('passes spec transforms through to dataset entries', () => {
    const spec = loadSpec('line-chart');
    const option = toEChartsOption(spec);
    const [dataset] = option.dataset;

    expect(dataset.transform).toBeDefined();
    expect(dataset.transform?.[0]).toMatchObject({
      type: 'calculate',
      config: { field: 'month', format: '%Y-%m' },
    });
    expect(option.xAxis).toMatchObject({ type: 'time' });
    expect(option.series[0].smooth).toBe(true);
  });

  it('creates a series per mark when layering is requested', () => {
    const scatter = loadSpec('scatter-chart');
    const layeredSpec: NormalizedVizSpec = {
      ...scatter,
      marks: [
        scatter.marks[0],
        {
          trait: 'MarkLine',
          encodings: {
            x: scatter.encoding.x,
            y: scatter.encoding.y,
          },
          options: {
            curve: 'linear',
          },
        },
      ],
    };

    const option = toEChartsOption(layeredSpec);
    expect(option.series).toHaveLength(2);
    expect(option.series[0].type).toBe('scatter');
    expect(option.series[1].type).toBe('line');
  });

  it('throws when an unknown mark type is encountered', () => {
    const spec = loadSpec('bar-chart');
    const invalidSpec: NormalizedVizSpec = {
      ...spec,
      marks: [{ ...spec.marks[0], trait: 'MarkUnknown' }],
    };

    expect(() => toEChartsOption(invalidSpec)).toThrow(EChartsAdapterError);
  });

  it('falls back to axis tooltips when no interaction is defined', () => {
    const spec = loadSpec('line-chart');
    const option = toEChartsOption(spec);

    expect(option.tooltip).toMatchObject({ trigger: 'axis' });
  });

  it('adds dataZoom components for interval filter interactions', () => {
    const spec = loadSpec('bar-chart');
    const interactive: NormalizedVizSpec = {
      ...spec,
      interactions: [
        {
          id: 'filter-range',
          select: { type: 'interval', on: 'drag', encodings: ['x'] },
          rule: { bindTo: 'filter' },
        },
      ],
    };

    const option = toEChartsOption(interactive);
    expect(option.dataZoom).toBeDefined();
    expect(option.dataZoom).toEqual(
      expect.arrayContaining([expect.objectContaining({ filterMode: 'filter' })])
    );
  });

  it('enables brush configuration when both axes are filtered', () => {
    const spec = loadSpec('scatter-chart');
    const interactive: NormalizedVizSpec = {
      ...spec,
      interactions: [
        {
          id: 'brush',
          select: { type: 'interval', on: 'drag', encodings: ['x', 'y'] },
          rule: { bindTo: 'filter' },
        },
      ],
    };

    const option = toEChartsOption(interactive);
    expect(option.brush).toBeDefined();
    expect(option.brush).toMatchObject({ brushMode: 'single' });
  });

  it('creates zoom dataZoom entries without filtering data', () => {
    const spec = loadSpec('line-chart');
    const interactive: NormalizedVizSpec = {
      ...spec,
      interactions: [
        {
          id: 'zoom-axis',
          select: { type: 'interval', on: 'wheel', encodings: ['x'] },
          rule: { bindTo: 'zoom' },
        },
      ],
    };

    const option = toEChartsOption(interactive);
    expect(option.dataZoom).toEqual(
      expect.arrayContaining([expect.objectContaining({ filterMode: 'none' })])
    );
  });
});
