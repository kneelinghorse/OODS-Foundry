/**
 * Tests for Trait Composer
 *
 * Validates multi-trait composition functionality:
 * - Parameter analysis across multiple traits
 * - Conflict detection
 * - Parameter merging
 * - Composed type generation
 */

import { describe, it, expect } from 'vitest';
import type { TraitDefinition, TraitParameter } from '../../src/core/trait-definition.ts';
import {
  analyzeComposition,
  composeParameterValues,
  generateComposedParameterType,
  generateComposedTypes,
  areParametersCompatible,
  mergeParameters,
} from '../../src/generators/composer.ts';

describe('Trait Composer', () => {
  describe('analyzeComposition', () => {
    it('should analyze parameters from multiple traits', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'published'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'priority',
            type: 'enum',
            required: false,
            enumValues: ['low', 'high'],
          },
        ],
        schema: {},
      };

      const analysis = analyzeComposition([trait1, trait2]);

      expect(analysis.allParameterNames).toHaveLength(2);
      expect(analysis.allParameterNames).toContain('status');
      expect(analysis.allParameterNames).toContain('priority');
      expect(analysis.conflicts.size).toBe(0);
    });

    it('should detect parameter conflicts', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'published'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['active', 'inactive'], // Different values
          },
        ],
        schema: {},
      };

      const analysis = analyzeComposition([trait1, trait2]);

      expect(analysis.conflicts.size).toBe(1);
      expect(analysis.conflicts.has('status')).toBe(true);

      const statusConflict = analysis.conflicts.get('status');
      expect(statusConflict).toHaveLength(2);
      expect(statusConflict![0].traitName).toBe('Trait1');
      expect(statusConflict![1].traitName).toBe('Trait2');
    });

    it('should not flag identical parameters as conflicts', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'published'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'published'], // Same values
          },
        ],
        schema: {},
      };

      const analysis = analyzeComposition([trait1, trait2]);

      expect(analysis.conflicts.size).toBe(0);
    });

    it('should handle traits with no parameters', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft'],
          },
        ],
        schema: {},
      };

      const analysis = analyzeComposition([trait1, trait2]);

      expect(analysis.allParameterNames).toHaveLength(1);
      expect(analysis.allParameterNames).toContain('status');
    });
  });

  describe('composeParameterValues', () => {
    it('should compose values from multiple arrays', () => {
      const values1 = ['draft', 'published'] as const;
      const values2 = ['archived', 'deleted'] as const;

      const composed = composeParameterValues(values1, values2);

      expect(composed).toHaveLength(4);
      expect(composed).toContain('draft');
      expect(composed).toContain('published');
      expect(composed).toContain('archived');
      expect(composed).toContain('deleted');
    });

    it('should deduplicate values', () => {
      const values1 = ['draft', 'published'] as const;
      const values2 = ['published', 'archived'] as const;

      const composed = composeParameterValues(values1, values2);

      expect(composed).toHaveLength(3);
      expect(composed.filter((v) => v === 'published')).toHaveLength(1);
    });

    it('should handle numeric values', () => {
      const values1 = [1, 2, 3] as const;
      const values2 = [3, 4, 5] as const;

      const composed = composeParameterValues(values1, values2);

      expect(composed).toHaveLength(5);
      expect(composed).toContain(1);
      expect(composed).toContain(5);
    });

    it('should handle empty arrays', () => {
      const values1 = [] as const;
      const values2 = ['a', 'b'] as const;

      const composed = composeParameterValues(values1, values2);

      expect(composed).toHaveLength(2);
      expect(composed).toContain('a');
      expect(composed).toContain('b');
    });
  });

  describe('generateComposedParameterType', () => {
    it('should generate composed type from multiple sources', () => {
      const sources = [
        {
          traitName: 'Trait1',
          parameter: {
            name: 'status',
            type: 'enum' as const,
            required: true,
          },
          values: ['draft', 'published'] as const,
        },
        {
          traitName: 'Trait2',
          parameter: {
            name: 'status',
            type: 'enum' as const,
            required: true,
          },
          values: ['archived', 'deleted'] as const,
        },
      ];

      const result = generateComposedParameterType('status', sources, {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(result.code).toContain('Composed_Trait1_Trait2_Status');
      expect(result.code).toContain('"draft"');
      expect(result.code).toContain('"published"');
      expect(result.code).toContain('"archived"');
      expect(result.code).toContain('"deleted"');
      expect(result.code).toContain('as const');
      expect(result.code).toContain('Sources: Trait1, Trait2');
    });

    it('should deduplicate values in composed type', () => {
      const sources = [
        {
          traitName: 'Trait1',
          parameter: {
            name: 'status',
            type: 'enum' as const,
            required: true,
          },
          values: ['draft', 'published'] as const,
        },
        {
          traitName: 'Trait2',
          parameter: {
            name: 'status',
            type: 'enum' as const,
            required: true,
          },
          values: ['published', 'archived'] as const,
        },
      ];

      const result = generateComposedParameterType('status', sources);

      // Count occurrences of 'published' in the generated code
      const matches = result.code.match(/"published"/g);
      expect(matches).toHaveLength(1); // Should appear only once
    });
  });

  describe('generateComposedTypes', () => {
    it('should generate composed types for multiple traits', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Stateful', version: '1.0.0' },
        parameters: [
          {
            name: 'states',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'published'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Colorized', version: '1.0.0' },
        parameters: [
          {
            name: 'colorScheme',
            type: 'enum',
            required: false,
            enumValues: ['default', 'primary'],
          },
        ],
        schema: {},
      };

      const result = generateComposedTypes([trait1, trait2], {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(result.code).toContain('Composed types for: Stateful + Colorized');
      expect(result.code).toContain('DO NOT EDIT');
      expect(result.code).toContain('"draft"');
      expect(result.code).toContain('"default"');
      expect(result.typeNames.length).toBeGreaterThan(0);
    });

    it('should include conflict warnings when present', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['draft'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'string',
            required: true,
          },
        ],
        schema: {},
      };

      const result = generateComposedTypes([trait1, trait2]);

      expect(result.code).toContain('WARNING: Parameter conflicts detected');
    });
  });

  describe('areParametersCompatible', () => {
    it('should return true for identical parameters', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      expect(areParametersCompatible(p1, p2)).toBe(true);
    });

    it('should return false for different types', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'string',
        required: true,
      };

      expect(areParametersCompatible(p1, p2)).toBe(false);
    });

    it('should return false for different enum values', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['active', 'inactive'],
      };

      expect(areParametersCompatible(p1, p2)).toBe(false);
    });

    it('should return true for same enum values in different order', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published', 'archived'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['published', 'archived', 'draft'],
      };

      expect(areParametersCompatible(p1, p2)).toBe(true);
    });

    it('should return true for compatible non-enum types', () => {
      const p1: TraitParameter = {
        name: 'label',
        type: 'string',
        required: true,
      };

      const p2: TraitParameter = {
        name: 'label',
        type: 'string',
        required: false,
      };

      expect(areParametersCompatible(p1, p2)).toBe(true);
    });
  });

  describe('mergeParameters', () => {
    it('should merge compatible enum parameters', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      const merged = mergeParameters([p1, p2]);

      expect(merged).not.toBeNull();
      expect(merged!.type).toBe('enum');
      expect(merged!.enumValues).toContain('draft');
      expect(merged!.enumValues).toContain('published');
    });

    it('should return null for incompatible parameters', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'string',
        required: true,
      };

      const merged = mergeParameters([p1, p2]);

      expect(merged).toBeNull();
    });

    it('should return the parameter if only one provided', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft'],
      };

      const merged = mergeParameters([p1]);

      expect(merged).toEqual(p1);
    });

    it('should return null for empty array', () => {
      const merged = mergeParameters([]);

      expect(merged).toBeNull();
    });

    it('should deduplicate enum values when merging', () => {
      const p1: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published'],
      };

      const p2: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['published', 'archived'],
      };

      const merged = mergeParameters([p1, p2]);

      expect(merged).not.toBeNull();
      expect(merged!.enumValues).toHaveLength(3);
      expect(merged!.enumValues).toContain('draft');
      expect(merged!.enumValues).toContain('published');
      expect(merged!.enumValues).toContain('archived');
    });
  });

  describe('Composition integration', () => {
    it('should preserve literal types through composition', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          {
            name: 'values',
            type: 'enum',
            required: true,
            enumValues: ['a', 'b'],
          },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          {
            name: 'values',
            type: 'enum',
            required: true,
            enumValues: ['c', 'd'],
          },
        ],
        schema: {},
      };

      const result = generateComposedTypes([trait1, trait2]);

      // Should use 'as const' pattern
      expect(result.code).toContain('] as const');
      expect(result.code).toContain('[number]');
    });

    it('should preserve literal types through 3+ layer composition', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        parameters: [
          { name: 'values', type: 'enum', required: true, enumValues: ['a', 'b'] },
        ],
        schema: {},
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        parameters: [
          { name: 'values', type: 'enum', required: true, enumValues: ['b', 'c'] },
        ],
        schema: {},
      };

      const trait3: TraitDefinition = {
        trait: { name: 'Trait3', version: '1.0.0' },
        parameters: [
          { name: 'values', type: 'enum', required: true, enumValues: ['d'] },
        ],
        schema: {},
      };

      const result = generateComposedTypes([trait1, trait2, trait3]);

      // Should use 'as const' pattern and include all literal values exactly once
      expect(result.code).toContain('] as const');
      ['"a"', '"b"', '"c"', '"d"'].forEach(v => expect(result.code).toContain(v));
      const bMatches = result.code.match(/"b"/g) ?? [];
      expect(bMatches.length).toBe(1);
    });
  });
});
