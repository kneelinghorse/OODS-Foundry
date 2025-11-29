import { describe, it, expect } from 'vitest';
import {
  composeLayers,
  validateLayers,
  getDefaultZIndex,
  VALID_LAYER_TYPES,
} from '../../../../src/traits/viz/spatial/layer-compositor.js';
import type { LayerType } from '../../../../src/traits/viz/spatial/LayeredOverlay.trait.js';

describe('LayeredOverlay Trait', () => {
  describe('composeLayers', () => {
    it('should compose empty layers array', () => {
      const result = composeLayers('[]', 'boundaries');

      expect(result.basemap).toBe('boundaries');
      expect(result.layers).toHaveLength(0);
    });

    it('should compose single layer', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 0,
          opacity: 1.0,
        },
      ]);

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].type).toBe('regionFill');
      expect(result.layers[0].zIndex).toBe(0);
      expect(result.layers[0].opacity).toBe(1.0);
    });

    it('should sort layers by zIndex (ascending)', () => {
      const layersJson = JSON.stringify([
        {
          type: 'symbol',
          zIndex: 10,
          opacity: 1.0,
        },
        {
          type: 'regionFill',
          zIndex: 0,
          opacity: 1.0,
        },
        {
          type: 'route',
          zIndex: 20,
          opacity: 1.0,
        },
      ]);

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers).toHaveLength(3);
      expect(result.layers[0].type).toBe('regionFill');
      expect(result.layers[0].zIndex).toBe(0);
      expect(result.layers[1].type).toBe('symbol');
      expect(result.layers[1].zIndex).toBe(10);
      expect(result.layers[2].type).toBe('route');
      expect(result.layers[2].zIndex).toBe(20);
    });

    it('should preserve order for layers with same zIndex', () => {
      const layersJson = JSON.stringify([
        {
          type: 'symbol',
          zIndex: 5,
          opacity: 1.0,
        },
        {
          type: 'regionFill',
          zIndex: 5,
          opacity: 1.0,
        },
      ]);

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers).toHaveLength(2);
      // First layer should remain first when zIndex is equal
      expect(result.layers[0].type).toBe('symbol');
      expect(result.layers[1].type).toBe('regionFill');
    });

    it('should apply default opacity when not specified', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 0,
        },
      ]);

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers[0].opacity).toBe(1.0);
    });

    it('should apply default zIndex when not specified', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          opacity: 0.8,
        },
      ]);

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers[0].zIndex).toBe(0);
    });

    it('should handle all valid layer types', () => {
      const layerTypes: LayerType[] = ['regionFill', 'symbol', 'route', 'heatmap', 'contour'];
      const layersJson = JSON.stringify(
        layerTypes.map((type, index) => ({
          type,
          zIndex: index,
          opacity: 1.0,
        }))
      );

      const result = composeLayers(layersJson, 'boundaries');

      expect(result.layers).toHaveLength(layerTypes.length);
      layerTypes.forEach((type, index) => {
        expect(result.layers[index].type).toBe(type);
      });
    });

    it('should throw error for invalid layer type', () => {
      const layersJson = JSON.stringify([
        {
          type: 'invalid',
          zIndex: 0,
          opacity: 1.0,
        },
      ]);

      expect(() => {
        composeLayers(layersJson, 'boundaries');
      }).toThrow('Invalid layer configurations');
    });

    it('should throw error for missing type field', () => {
      const layersJson = JSON.stringify([
        {
          zIndex: 0,
          opacity: 1.0,
        },
      ]);

      expect(() => {
        composeLayers(layersJson, 'boundaries');
      }).toThrow('Invalid layer configurations');
    });

    it('should throw error for invalid zIndex', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 'invalid',
          opacity: 1.0,
        },
      ]);

      expect(() => {
        composeLayers(layersJson, 'boundaries');
      }).toThrow('Invalid layer configurations');
    });

    it('should throw error for invalid opacity', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 0,
          opacity: 1.5, // Invalid: > 1
        },
      ]);

      expect(() => {
        composeLayers(layersJson, 'boundaries');
      }).toThrow('Invalid layer configurations');
    });

    it('should handle different basemap types', () => {
      const layersJson = JSON.stringify([]);

      expect(composeLayers(layersJson, 'none').basemap).toBe('none');
      expect(composeLayers(layersJson, 'tile').basemap).toBe('tile');
      expect(composeLayers(layersJson, 'boundaries').basemap).toBe('boundaries');
    });

    it('should handle undefined layersJson', () => {
      const result = composeLayers(undefined, 'boundaries');

      expect(result.layers).toHaveLength(0);
      expect(result.basemap).toBe('boundaries');
    });

    it('should handle invalid JSON gracefully', () => {
      // Invalid JSON returns empty array (graceful handling)
      const result = composeLayers('invalid json', 'boundaries');
      expect(result.layers).toHaveLength(0);
      expect(result.basemap).toBe('boundaries');
    });
  });

  describe('validateLayers', () => {
    it('should validate valid layer configurations', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 0,
          opacity: 1.0,
        },
        {
          type: 'symbol',
          zIndex: 10,
          opacity: 0.8,
        },
      ]);

      const result = validateLayers(layersJson);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid layer type', () => {
      const layersJson = JSON.stringify([
        {
          type: 'invalid',
          zIndex: 0,
          opacity: 1.0,
        },
      ]);

      const result = validateLayers(layersJson);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('invalid type');
    });

    it('should reject missing type field', () => {
      const layersJson = JSON.stringify([
        {
          zIndex: 0,
          opacity: 1.0,
        },
      ]);

      const result = validateLayers(layersJson);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("missing required 'type'"))).toBe(true);
    });

    it('should reject invalid zIndex', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 'not a number',
          opacity: 1.0,
        },
      ]);

      const result = validateLayers(layersJson);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('zIndex'))).toBe(true);
    });

    it('should reject invalid opacity', () => {
      const layersJson = JSON.stringify([
        {
          type: 'regionFill',
          zIndex: 0,
          opacity: 2.0, // Invalid: > 1
        },
      ]);

      const result = validateLayers(layersJson);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('opacity'))).toBe(true);
    });

    it('should validate empty layers array', () => {
      const result = validateLayers('[]');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle undefined layersJson', () => {
      const result = validateLayers(undefined);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getDefaultZIndex', () => {
    it('should return default z-index for each layer type', () => {
      const defaults: Record<LayerType, number> = {
        regionFill: 0,
        symbol: 10,
        route: 20,
        heatmap: 5,
        contour: 15,
      };

      for (const [type, expectedZIndex] of Object.entries(defaults)) {
        expect(getDefaultZIndex(type as LayerType)).toBe(expectedZIndex);
      }
    });

    it('should return 0 for unknown layer type', () => {
      // TypeScript won't allow this, but test runtime behavior
      expect(getDefaultZIndex('unknown' as LayerType)).toBe(0);
    });
  });

  describe('VALID_LAYER_TYPES', () => {
    it('should contain all expected layer types', () => {
      const expectedTypes: LayerType[] = ['regionFill', 'symbol', 'route', 'heatmap', 'contour'];

      for (const type of expectedTypes) {
        expect(VALID_LAYER_TYPES).toContain(type);
      }
    });

    it('should have correct length', () => {
      expect(VALID_LAYER_TYPES).toHaveLength(5);
    });
  });
});

