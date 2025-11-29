/**
 * Tests for layer utilities.
 */

import { describe, it, expect } from 'vitest';
import { orderLayers, validateLayerConfig, mergeLayerDefaults } from '../../../../src/components/viz/spatial/utils/layer-utils.js';
import type { SpatialLayer } from '../../../../src/types/viz/spatial.js';

describe('layer-utils', () => {
  describe('orderLayers', () => {
    it('should order layers by z-index', () => {
      const layers: SpatialLayer[] = [
        {
          type: 'regionFill',
          encoding: { color: { field: 'value' } },
          zIndex: 2,
        },
        {
          type: 'symbol',
          encoding: { longitude: { field: 'lon' }, latitude: { field: 'lat' } },
          zIndex: 0,
        },
        {
          type: 'regionFill',
          encoding: { color: { field: 'value2' } },
          zIndex: 1,
        },
      ];

      const ordered = orderLayers(layers);

      expect(ordered[0].zIndex).toBe(0);
      expect(ordered[1].zIndex).toBe(1);
      expect(ordered[2].zIndex).toBe(2);
    });

    it('should use stable sort for same z-index', () => {
      const layers: SpatialLayer[] = [
        {
          type: 'regionFill',
          encoding: { color: { field: 'a' } },
          zIndex: 0,
        },
        {
          type: 'regionFill',
          encoding: { color: { field: 'b' } },
          zIndex: 0,
        },
        {
          type: 'regionFill',
          encoding: { color: { field: 'c' } },
          zIndex: 0,
        },
      ];

      const ordered = orderLayers(layers);

      expect(ordered[0].layer.encoding.color.field).toBe('a');
      expect(ordered[1].layer.encoding.color.field).toBe('b');
      expect(ordered[2].layer.encoding.color.field).toBe('c');
    });

    it('should default z-index to 0', () => {
      const layers: SpatialLayer[] = [
        {
          type: 'regionFill',
          encoding: { color: { field: 'value' } },
        },
      ];

      const ordered = orderLayers(layers);

      expect(ordered[0].zIndex).toBe(0);
    });
  });

  describe('validateLayerConfig', () => {
    it('should validate regionFill layer', () => {
      const layer: SpatialLayer = {
        type: 'regionFill',
        encoding: {
          color: { field: 'value' },
        },
      };

      const result = validateLayerConfig(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject regionFill without color encoding', () => {
      const layer = {
        type: 'regionFill',
        encoding: {},
      } as unknown as SpatialLayer;

      const result = validateLayerConfig(layer);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate symbol layer', () => {
      const layer: SpatialLayer = {
        type: 'symbol',
        encoding: {
          longitude: { field: 'lon' },
          latitude: { field: 'lat' },
        },
      };

      const result = validateLayerConfig(layer);

      expect(result.valid).toBe(true);
    });

    it('should validate route layer', () => {
      const layer: SpatialLayer = {
        type: 'route',
        encoding: {
          start: { field: 'start' },
          end: { field: 'end' },
        },
      };

      const result = validateLayerConfig(layer);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid z-index', () => {
      const layer = {
        type: 'regionFill',
        encoding: { color: { field: 'value' } },
        zIndex: NaN,
      } as unknown as SpatialLayer;

      const result = validateLayerConfig(layer);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('zIndex'))).toBe(true);
    });
  });

  describe('mergeLayerDefaults', () => {
    it('should apply default z-index', () => {
      const layer: SpatialLayer = {
        type: 'regionFill',
        encoding: { color: { field: 'value' } },
      };

      const merged = mergeLayerDefaults(layer);

      expect(merged.zIndex).toBe(0);
    });

    it('should preserve existing z-index', () => {
      const layer: SpatialLayer = {
        type: 'regionFill',
        encoding: { color: { field: 'value' } },
        zIndex: 5,
      };

      const merged = mergeLayerDefaults(layer);

      expect(merged.zIndex).toBe(5);
    });
  });
});

