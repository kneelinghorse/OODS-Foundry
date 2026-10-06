import * as echarts from 'echarts';
import { describe, expect, it } from 'vitest';
import {
  adaptGraphToECharts,
  adaptSankeyToECharts,
  type NetworkInput,
  type NormalizedVizSpec,
  type SankeyInput,
} from '@oods/viz-core';
import { sparseForceDefaults } from '../src/adapters/echarts/graph-adapter.js';

// Sprint 201 m06 — the two chart titles from the Sprint 199 review (#2060): the sankey title
// overlapped its first node column in every theme, and the placed Relationship graph carried an
// oversized title over crowded labels. Both adapters now share one title band (centred, 14px/600)
// and the sankey insets its flow below it; sparse graphs spread to the canvas so labels have room.

const spec = (id: string, trait: string, name?: string): NormalizedVizSpec => ({
  $schema: 'https://oods-foundry.com/viz-spec/v1', id, ...(name ? { name } : {}), data: { values: [] }, marks: [{ trait }], encoding: {},
  a11y: { description: 'Test chart.' },
} as NormalizedVizSpec);

const FLOW: SankeyInput = {
  nodes: [{ name: 'Source' }, { name: 'Middle' }, { name: 'Sink' }],
  links: [{ source: 'Source', target: 'Middle', value: 10 }, { source: 'Middle', target: 'Sink', value: 6 }, { source: 'Source', target: 'Sink', value: 4 }],
};
const NETWORK: NetworkInput = {
  nodes: [{ id: 'example-document' }, { id: 'example-project' }, { id: 'example-team' }],
  links: [{ source: 'example-document', target: 'example-project' }, { source: 'example-project', target: 'example-team' }, { source: 'example-document', target: 'example-team' }],
};

function renderSvg(option: Record<string, unknown>, width = 720, height = 400): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  try {
    chart.setOption({ ...option, animation: false } as never);
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

const TITLE_BAND = { left: 'center', top: 8, textStyle: expect.objectContaining({ fontSize: 14, fontWeight: 600 }) };

/** Every rendered text element with its style and absolute translate position. */
function texts(svg: string): Array<{ style: string; x: number; y: number; text: string }> {
  return [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(match => {
    const attrs = match[1]!;
    const translate = /transform="translate\(([\d.-]+) ([\d.-]+)\)"/.exec(attrs);
    return { style: /style="([^"]*)"/.exec(attrs)?.[1] ?? '', x: Number(translate?.[1] ?? NaN), y: Number(translate?.[2] ?? NaN), text: match[2]! };
  });
}

describe('sankey title band', () => {
  it('centres a 14px/600 title and insets the flow below it only when the chart is named', () => {
    const named = adaptSankeyToECharts(spec('viz:sankey', 'MarkSankey', 'Pipeline flow'), FLOW) as Record<string, any>;
    expect(named.title).toMatchObject({ text: 'Pipeline flow', ...TITLE_BAND });
    expect(named.series[0].top).toBe(40);
    const unnamed = adaptSankeyToECharts(spec('viz:sankey', 'MarkSankey'), FLOW) as Record<string, any>;
    expect(unnamed.title).toBeUndefined();
    expect(unnamed.series[0]).not.toHaveProperty('top');
  });

  it('renders every node and link below the title band', () => {
    const svg = renderSvg(adaptSankeyToECharts(spec('viz:sankey', 'MarkSankey', 'Pipeline flow'), FLOW) as Record<string, unknown>, 600, 400);
    expect(svg).toContain('Pipeline flow');
    const title = texts(svg).find(entry => entry.text === 'Pipeline flow');
    expect(title, 'rendered title').toBeTruthy();
    const titleBottom = title!.y + 7 + 7;
    // Sankey nodes and links are chart paths that start at their top edge (path M plus the series translate): none may start inside the title band.
    const starts = [...svg.matchAll(/<path[^>]*\bd="M\s*([\d.-]+)[ ,]([\d.-]+)[^"]*"[^>]*transform="translate\(([\d.-]+) ([\d.-]+)\)"[^>]*ecmeta_ssr_type="chart"/g)].map(match => Number(match[2]) + Number(match[4]));
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(40);
    expect(Math.min(...starts)).toBeGreaterThan(titleBottom);
  });
});

describe('graph title band and sparse layout', () => {
  it('uses the shared title band and spreads sparse graphs to the canvas', () => {
    const option = adaptGraphToECharts(spec('viz:graph', 'MarkGraph', 'Example connected relationships'), NETWORK) as Record<string, any>;
    expect(option.title).toMatchObject({ text: 'Example connected relationships', ...TITLE_BAND });
    expect(option.series[0].force).toMatchObject(sparseForceDefaults(3));
    expect(sparseForceDefaults(3).edgeLength).toBeGreaterThan(100);
    // Explicit force parameters still win.
    const explicit = adaptGraphToECharts({ ...spec('viz:graph', 'MarkGraph', 'Named'), layout: { force: { repulsion: 12, edgeLength: 34 } } } as NormalizedVizSpec, NETWORK) as Record<string, any>;
    expect(explicit.series[0].force).toMatchObject({ repulsion: 12, edgeLength: 34 });
  });

  // The rendered graph assertion lives in viz-render/test/chart-titles.s207.spec.ts,
  // where it exercises the shipped seeded force renderer instead of ambient Math.random.

});
