import { describe, it, expect } from 'vitest';
import {
  generateProjectionConfig,
  validateProjectionParams,
  type RendererType,
} from '../../../../src/traits/viz/spatial/projection-config-generator.js';
import type { ProjectionType } from '../../../../src/traits/viz/spatial/HasProjection.trait.js';

describe('HasProjection Trait', () => {
  describe('generateProjectionConfig', () => {
    it('should generate Vega-Lite config with default mercator projection', () => {
      const params = {
        projection_type: 'mercator',
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.type).toBe('mercator');
      expect(config.center).toBeUndefined();
      expect(config.scale).toBeUndefined();
    });

    it('should generate config with all projection types', () => {
      const types: ProjectionType[] = [
        'mercator',
        'albersUsa',
        'equalEarth',
        'orthographic',
        'conicEqualArea',
        'naturalEarth1',
      ];

      for (const type of types) {
        const params = { projection_type: type };
        const config = generateProjectionConfig(params, 'vega-lite');
        expect(config.type).toBe(type);
      }
    });

    it('should include center parameter when provided', () => {
      const params = {
        projection_type: 'mercator',
        projection_center: '[100, 50]',
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.center).toEqual([100, 50]);
    });

    it('should include scale parameter when provided', () => {
      const params = {
        projection_type: 'mercator',
        projection_scale: 500,
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.scale).toBe(500);
    });

    it('should include rotate parameter when provided', () => {
      const params = {
        projection_type: 'mercator',
        projection_rotate: '[10, 20, 30]',
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.rotate).toEqual([10, 20, 30]);
    });

    it('should include clipExtent parameter when provided', () => {
      const params = {
        projection_type: 'mercator',
        projection_clip_extent: '[[0, 0], [800, 600]]',
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.clipExtent).toEqual([
        [0, 0],
        [800, 600],
      ]);
    });

    it('should generate ECharts config with zoom conversion', () => {
      const params = {
        projection_type: 'mercator',
        projection_scale: 400,
      };

      const config = generateProjectionConfig(params, 'echarts');

      expect(config.projection).toBe('mercator');
      expect(config.zoom).toBeDefined();
      expect(typeof config.zoom).toBe('number');
    });

    it('should throw error for invalid projection type', () => {
      const params = {
        projection_type: 'invalid' as ProjectionType,
      };

      expect(() => {
        generateProjectionConfig(params, 'vega-lite');
      }).toThrow(/Invalid projection type: invalid/);
    });

    it('should throw error for unsupported renderer', () => {
      const params = {
        projection_type: 'mercator',
      };

      expect(() => {
        generateProjectionConfig(params, 'unsupported' as RendererType);
      }).toThrow('Unsupported renderer');
    });

    it('should generate complete config with all parameters', () => {
      const params = {
        projection_type: 'albersUsa',
        projection_center: '[-95, 40]',
        projection_scale: 1000,
        projection_rotate: '[0, 0, 0]',
        projection_clip_extent: '[[-180, -90], [180, 90]]',
      };

      const config = generateProjectionConfig(params, 'vega-lite');

      expect(config.type).toBe('albersUsa');
      expect(config.center).toEqual([-95, 40]);
      expect(config.scale).toBe(1000);
      expect(config.rotate).toEqual([0, 0, 0]);
      expect(config.clipExtent).toEqual([
        [-180, -90],
        [180, 90],
      ]);
    });
  });

  describe('validateProjectionParams', () => {
    it('should validate valid projection parameters', () => {
      const params = {
        projection_type: 'mercator',
        projection_center: '[0, 0]',
        projection_scale: 100,
        projection_rotate: '[0, 0, 0]',
        projection_clip_extent: '[[0, 0], [800, 600]]',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid projection type', () => {
      const params = {
        projection_type: 'invalid',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid projection type');
    });

    it('should reject malformed center array', () => {
      const params = {
        projection_type: 'mercator',
        projection_center: 'invalid',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_center'))).toBe(true);
    });

    it('should reject center array with wrong length', () => {
      const params = {
        projection_type: 'mercator',
        projection_center: '[0, 0, 0]',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_center'))).toBe(true);
    });

    it('should reject invalid scale value', () => {
      const params = {
        projection_type: 'mercator',
        projection_scale: 0,
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_scale'))).toBe(true);
    });

    it('should reject malformed rotate array', () => {
      const params = {
        projection_type: 'mercator',
        projection_rotate: 'invalid',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_rotate'))).toBe(true);
    });

    it('should reject rotate array with wrong length', () => {
      const params = {
        projection_type: 'mercator',
        projection_rotate: '[0, 0]',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_rotate'))).toBe(true);
    });

    it('should reject malformed clip extent', () => {
      const params = {
        projection_type: 'mercator',
        projection_clip_extent: 'invalid',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('projection_clip_extent'))).toBe(true);
    });

    it('should validate with missing optional parameters', () => {
      const params = {
        projection_type: 'mercator',
      };

      const result = validateProjectionParams(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
