import { describe, expect, it } from 'vitest';
import { adaptGraphToECharts, type NetworkInput, type NormalizedVizSpec } from '@oods/viz-core';
import { renderEChartsToSvg } from '../src/echarts-renderer.js';

// Keep Sprint 201's title/label geometry regression on the shipped renderer. A raw
// ECharts setOption uses ambient randomness before force settling and can hide a label.
const spec: NormalizedVizSpec = {
  $schema: 'https://oods-foundry.com/viz-spec/v1', id: 'viz:graph', name: 'Example connected relationships',
  data: { values: [] }, marks: [{ trait: 'MarkGraph' }], encoding: {},
  a11y: { description: 'Test chart.' },
} as NormalizedVizSpec;
const NETWORK: NetworkInput = {
  nodes: [{ id: 'example-document' }, { id: 'example-project' }, { id: 'example-team' }],
  links: [{ source: 'example-document', target: 'example-project' }, { source: 'example-project', target: 'example-team' }, { source: 'example-document', target: 'example-team' }],
};

/** Every rendered text element with its style and absolute translate position. */
function texts(svg: string): Array<{ style: string; x: number; y: number; text: string }> {
  return [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(match => {
    const attrs = match[1]!;
    const translate = /transform="translate\(([\d.-]+) ([\d.-]+)\)"/.exec(attrs);
    return { style: /style="([^"]*)"/.exec(attrs)?.[1] ?? '', x: Number(translate?.[1] ?? NaN), y: Number(translate?.[2] ?? NaN), text: match[2]! };
  });
}

describe('shipped graph title and sparse layout', () => {
  it('renders the three placed labels without any two overlapping and keeps the title at 14px', async () => {
    const option = JSON.parse(JSON.stringify(adaptGraphToECharts(spec, NETWORK)));
    const svg = await renderEChartsToSvg(option, { width: 720, height: 400 });
    expect(await renderEChartsToSvg(option, { width: 720, height: 400 })).toBe(svg);
    const rendered = texts(svg);
    const title = rendered.find(entry => entry.text === 'Example connected relationships');
    expect(title?.style).toMatch(/font-size:14px/);
    expect(title?.style).toMatch(/font-weight:600/);
    const labels = rendered.filter(entry => NETWORK.nodes.some(node => node.id === entry.text));
    expect(labels.map(label => label.text).sort()).toEqual(NETWORK.nodes.map(node => node.id).sort());
    const box = (label: { x: number; y: number; text: string }) => ({ left: label.x, right: label.x + label.text.length * 7, top: label.y - 7, bottom: label.y + 7 });
    for (const [index, a] of labels.entries()) for (const b of labels.slice(index + 1)) {
      const A = box(a), B = box(b);
      const overlap = A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom;
      expect(overlap, `${a.text} overlaps ${b.text}`).toBe(false);
    }
  });
});
