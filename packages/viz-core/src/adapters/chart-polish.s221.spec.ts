/**
 * s221-m03 (#2482 ruling 13; the Sprint 218 m02 chart reservations, next-step 1647), fixed at the producer:
 *
 * 1. A facet's headings (the panel labels and the facet title) were Vega-Lite's default black, which all but vanishes
 *    on a dark background (drill-down, small multiples, target-band facets, the sparkline grid). A faceted chart's
 *    chrome now names its heading colours from the same text tokens as its axes and legend; an unfaceted chart's
 *    chrome is unchanged.
 * 2. Points were Vega-Lite's default hollow rings at 0.7 opacity and lines its 1.5px strokes, so series read as
 *    subdued. OODS marks now default to filled points and 2.5px lines; a spec's own mark options still win.
 *    Filled points left a size legend's symbols Vega's default black, so a chart that encodes size now draws them in
 *    the neutral text colour.
 * 3. The grouped-bar pattern drew its segments stacked (the normalized spec has no offset channel, and a colour split
 *    on a bar stacks by default). It is now faceted by quarter with the segments side by side.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toVegaLiteSpec } from './vega-lite-adapter.js';
import { resolveOodsVegaConfig } from '../tokens/oods-vega-config.js';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const pattern = (name: string) => JSON.parse(fs.readFileSync(path.join(root, 'examples/viz/patterns-v2', `${name}.spec.json`), 'utf8')) as NormalizedVizSpec;
const luminance = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
const markOf = (spec: Record<string, any>): Record<string, any> => spec.mark ?? spec.spec?.mark ?? spec.layer?.[0]?.mark;

describe('facet headings read on every theme (s221-m03)', () => {
  it.each(['light', 'dark'] as const)('%s: the headings use the text tokens and clear 4.5:1 on the background', theme => {
    const config = resolveOodsVegaConfig(pattern('facet-small-multiples-line'), { theme, brand: 'A' }) as unknown as Record<string, any>;
    expect(config.header).toMatchObject({ titleColor: config.title.color, labelColor: config.axis.labelColor, titleFont: config.font, labelFont: config.font });
    expect(contrast(config.header.titleColor, config.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(config.header.labelColor, config.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves an unfaceted chart\'s chrome as it was', () => {
    expect(resolveOodsVegaConfig(pattern('multi-series-line'), { theme: 'dark', brand: 'A' })).not.toHaveProperty('header');
  });
});

describe('series marks are not subdued (s221-m03)', () => {
  it('points default to filled, larger and nearly opaque; lines to 2.5px', () => {
    expect(markOf(toVegaLiteSpec(pattern('correlation-scatter'), { theme: 'light', brand: 'A' }))).toMatchObject({ type: 'point', filled: true, size: 60, opacity: 0.85 });
    expect(markOf(toVegaLiteSpec(pattern('multi-series-line'), { theme: 'light', brand: 'A' }))).toMatchObject({ type: 'line', strokeWidth: 2.5 });
  });

  it('keeps a spec\'s own mark options', () => {
    const scatter = pattern('correlation-scatter');
    const hollow = { ...scatter, marks: [{ ...scatter.marks[0]!, options: { fill: 'hollow', size: 20 } }] } as NormalizedVizSpec;
    expect(markOf(toVegaLiteSpec(hollow, { theme: 'light', brand: 'A' }))).toMatchObject({ filled: false, size: 20 });
    const line = pattern('multi-series-line');
    const fine = { ...line, marks: [{ ...line.marks[0]!, options: { ...line.marks[0]!.options, strokeWidth: 1 } }] } as NormalizedVizSpec;
    expect(markOf(toVegaLiteSpec(fine, { theme: 'light', brand: 'A' }))).toMatchObject({ strokeWidth: 1 });
  });
});

describe('a size legend reads on a dark background (s221-m03)', () => {
  it.each(['light', 'dark'] as const)('%s: a chart that encodes size draws its legend symbols in the neutral text colour', theme => {
    const config = resolveOodsVegaConfig(pattern('bubble-distribution'), { theme, brand: 'A' }) as unknown as Record<string, any>;
    expect(config.legend).toMatchObject({ symbolFillColor: config.axis.labelColor, symbolStrokeColor: config.axis.labelColor });
    // Filled points left the size legend's symbols Vega's default black, which vanished on the dark canvas.
    expect(contrast(config.legend.symbolFillColor, config.background)).toBeGreaterThanOrEqual(3);
  });

  it('leaves a chart with no size encoding as it was', () => {
    expect(resolveOodsVegaConfig(pattern('correlation-scatter'), { theme: 'dark', brand: 'A' }).legend).not.toHaveProperty('symbolFillColor');
  });
});

describe('the grouped bar draws its segments side by side (s221-m03)', () => {
  it('facets by quarter with one bar per segment in each panel, so nothing stacks', () => {
    const spec = pattern('grouped-bar');
    expect(spec.layout).toMatchObject({ trait: 'LayoutFacet', columns: { field: 'quarter' } });
    const vegaLite = toVegaLiteSpec(spec, { theme: 'light', brand: 'A' }) as Record<string, any>;
    // The adapter facets on its computed panel key, one panel per quarter in quarter order.
    expect(vegaLite.facet).toMatchObject({ title: 'Quarter', sort: ['Q1', 'Q2', 'Q3', 'Q4'] });
    expect(vegaLite.columns).toBe(4);
    const encoding = vegaLite.spec?.encoding ?? vegaLite.encoding;
    expect(encoding.x.field).toBe('segment');
    expect(encoding.color.field).toBe('segment');
    // One bar per (quarter, segment): the rows never share an x within a panel, so the default stack has nothing to stack.
    const rows = (spec.data as { values: Array<Record<string, unknown>> }).values;
    expect(new Set(rows.map(row => `${row.quarter}|${row.segment}`)).size).toBe(rows.length);
  });
});
