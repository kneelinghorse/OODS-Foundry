import { describe, expect, it } from 'vitest';
import {
  resolveVizTraits,
  applyScalesToEncodings,
} from './viz-trait-resolver.js';

describe('viz-trait-resolver', () => {
  describe('mark trait resolution', () => {
    it.each([
      ['mark-bar', 'bar'],
      ['mark-line', 'line'],
      ['mark-area', 'area'],
      ['mark-point', 'point'],
      ['mark-scatter', 'scatter'],
      ['mark-heatmap', 'heatmap'],
    ] as const)('resolves %s to %s chart type', (trait, expected) => {
      const result = resolveVizTraits([trait]);
      expect(result.chartType).toBe(expected);
      expect(result.markTraits).toContain(trait);
    });

    it('returns null chartType when no mark traits', () => {
      const result = resolveVizTraits(['encoding-position-x', 'scale-linear']);
      expect(result.chartType).toBeNull();
    });

    it('uses last mark trait when multiple are provided', () => {
      const result = resolveVizTraits(['mark-bar', 'mark-line']);
      expect(result.chartType).toBe('line');
      expect(result.markTraits).toEqual(['mark-bar', 'mark-line']);
    });
  });

  describe('PascalCase normalization', () => {
    it.each([
      ['MarkBar', 'bar'],
      ['MarkLine', 'line'],
      ['MarkArea', 'area'],
      ['MarkPoint', 'point'],
      ['MarkScatter', 'scatter'],
      ['MarkHeatmap', 'heatmap'],
    ] as const)('normalizes %s to matching chart type', (pascal, expected) => {
      const result = resolveVizTraits([pascal]);
      expect(result.chartType).toBe(expected);
    });

    it('strips path prefix from trait names', () => {
      const result = resolveVizTraits(['viz/MarkBar']);
      expect(result.chartType).toBe('bar');
    });

    it('handles encoding PascalCase', () => {
      const result = resolveVizTraits(['EncodingPositionX']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('x');
    });

    it('handles layout PascalCase', () => {
      const result = resolveVizTraits(['LayoutLayer']);
      expect(result.layout.strategy).toBe('layer');
    });

    it('handles interaction PascalCase', () => {
      const result = resolveVizTraits(['InteractionTooltip']);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].type).toBe('tooltip');
    });
  });

  describe('encoding resolution', () => {
    it('resolves encoding-position-x', () => {
      const result = resolveVizTraits(['encoding-position-x']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0]).toEqual({
        channel: 'x',
        traitName: 'encoding-position-x',
        defaultScale: 'linear',
        axisTitle: 'X Axis',
      });
    });

    it('resolves encoding-position-y', () => {
      const result = resolveVizTraits(['encoding-position-y']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('y');
    });

    it('resolves encoding-color', () => {
      const result = resolveVizTraits(['encoding-color']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('color');
    });

    it('resolves encoding-size', () => {
      const result = resolveVizTraits(['encoding-size']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('size');
    });

    it('resolves encoding-opacity', () => {
      const result = resolveVizTraits(['encoding-opacity']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('opacity');
    });

    it('resolves encoding-shape', () => {
      const result = resolveVizTraits(['encoding-shape']);
      expect(result.encodings).toHaveLength(1);
      expect(result.encodings[0].channel).toBe('shape');
    });

    it('resolves all six encodings together', () => {
      const result = resolveVizTraits([
        'encoding-position-x',
        'encoding-position-y',
        'encoding-color',
        'encoding-size',
        'encoding-opacity',
        'encoding-shape',
      ]);
      expect(result.encodings).toHaveLength(6);
      const channels = result.encodings.map((e) => e.channel).sort();
      expect(channels).toEqual(['color', 'opacity', 'shape', 'size', 'x', 'y']);
    });
  });

  describe('layout resolution', () => {
    it.each([
      ['layout-layer', 'layer'],
      ['layout-facet', 'facet'],
      ['layout-concat', 'concat'],
    ] as const)('resolves %s to %s strategy', (trait, expected) => {
      const result = resolveVizTraits([trait]);
      expect(result.layout.strategy).toBe(expected);
      expect(result.layout.traitName).toBe(trait);
    });

    it('defaults to single when no layout trait', () => {
      const result = resolveVizTraits(['mark-bar']);
      expect(result.layout.strategy).toBe('single');
    });
  });

  describe('scale resolution', () => {
    it.each([
      ['scale-linear', 'linear'],
      ['scale-temporal', 'temporal'],
    ] as const)('resolves %s', (trait, expected) => {
      const result = resolveVizTraits([trait]);
      expect(result.scales).toHaveLength(1);
      expect(result.scales[0].type).toBe(expected);
    });
  });

  describe('interaction resolution', () => {
    it('resolves interaction-tooltip', () => {
      const result = resolveVizTraits(['interaction-tooltip']);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0]).toEqual({
        type: 'tooltip',
        traitName: 'interaction-tooltip',
        component: 'VizTooltip',
      });
    });

    it('resolves interaction-highlight', () => {
      const result = resolveVizTraits(['interaction-highlight']);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].type).toBe('highlight');
      expect(result.interactions[0].component).toBe('VizHighlight');
    });
  });

  describe('full trait resolution', () => {
    it('resolves all 19 viz trait types', () => {
      const allTraits = [
        'mark-bar', 'mark-line', 'mark-area', 'mark-point', 'mark-scatter', 'mark-heatmap',
        'encoding-position-x', 'encoding-position-y', 'encoding-color', 'encoding-size', 'encoding-opacity', 'encoding-shape',
        'layout-layer',
        'scale-linear', 'scale-temporal',
        'interaction-tooltip', 'interaction-highlight',
      ];
      const result = resolveVizTraits(allTraits);
      expect(result.allResolved).toHaveLength(17);
      expect(result.unrecognized).toHaveLength(0);
      expect(result.markTraits).toHaveLength(6);
      expect(result.encodings).toHaveLength(6);
      expect(result.scales).toHaveLength(2);
      expect(result.interactions).toHaveLength(2);
    });

    it('tracks non-viz traits as unrecognized', () => {
      const result = resolveVizTraits(['mark-bar', 'lifecycle/Stateful', 'Cancellable']);
      expect(result.allResolved).toHaveLength(1);
      expect(result.unrecognized).toHaveLength(2);
    });
  });

  describe('applyScalesToEncodings', () => {
    it('upgrades x-axis to temporal when temporal scale present', () => {
      const resolution = resolveVizTraits([
        'encoding-position-x',
        'scale-temporal',
      ]);
      const updated = applyScalesToEncodings(resolution);
      const xEnc = updated.encodings.find((e) => e.channel === 'x');
      expect(xEnc?.defaultScale).toBe('temporal');
    });

    it('keeps x-axis as linear when no temporal scale', () => {
      const resolution = resolveVizTraits([
        'encoding-position-x',
        'scale-linear',
      ]);
      const updated = applyScalesToEncodings(resolution);
      const xEnc = updated.encodings.find((e) => e.channel === 'x');
      expect(xEnc?.defaultScale).toBe('linear');
    });

    it('does not affect y-axis scale', () => {
      const resolution = resolveVizTraits([
        'encoding-position-y',
        'scale-temporal',
      ]);
      const updated = applyScalesToEncodings(resolution);
      const yEnc = updated.encodings.find((e) => e.channel === 'y');
      expect(yEnc?.defaultScale).toBe('linear');
    });
  });
});
