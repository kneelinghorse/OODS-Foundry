/**
 * Tests for Type Generator
 *
 * Validates the core type generation functionality, including:
 * - Const array generation with 'as const' pattern
 * - Union type derivation
 * - Parameter extraction
 * - Complete trait type generation
 */

import { describe, it, expect } from 'vitest';
import type { TraitDefinition, TraitParameter } from '../../src/core/trait-definition.ts';
import {
  extractParameters,
  hasGeneratableParameters,
  generateConstantName,
  generateTypeName,
  generateConstArray,
  generateUnionType,
  generateParameterType,
  generateTraitTypes,
  generateDeclarationFile,
} from '../../src/generators/type-generator.ts';

describe('Type Generator', () => {
  describe('extractParameters', () => {
    it('should extract parameters from a trait definition', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
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

      const params = extractParameters(trait);
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('status');
    });

    it('should return empty array when no parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
        schema: {},
      };

      const params = extractParameters(trait);
      expect(params).toHaveLength(0);
    });
  });

  describe('hasGeneratableParameters', () => {
    it('should return true for traits with enum parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
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

      expect(hasGeneratableParameters(trait)).toBe(true);
    });

    it('should return false for traits without generatable parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
        parameters: [
          {
            name: 'count',
            type: 'number',
            required: false,
          },
        ],
        schema: {},
      };

      expect(hasGeneratableParameters(trait)).toBe(false);
    });

    it('should return false for traits with no parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
        schema: {},
      };

      expect(hasGeneratableParameters(trait)).toBe(false);
    });
  });

  describe('generateConstantName', () => {
    it('should generate proper constant name', () => {
      const name = generateConstantName('Stateful', 'states');
      expect(name).toBe('StatefulStates');
    });

    it('should capitalize parameter name', () => {
      const name = generateConstantName('MyTrait', 'myParameter');
      expect(name).toBe('MyTraitMyParameter');
    });

    it('should support namespace prefix', () => {
      const name = generateConstantName('Stateful', 'states', 'App');
      expect(name).toBe('App_StatefulStates');
    });
  });

  describe('generateTypeName', () => {
    it('should generate proper type name', () => {
      const name = generateTypeName('Stateful', 'states');
      expect(name).toBe('StatefulStates');
    });

    it('should support namespace prefix', () => {
      const name = generateTypeName('Stateful', 'states', 'App');
      expect(name).toBe('App_StatefulStates');
    });
  });

  describe('generateConstArray', () => {
    it('should generate formatted const array with string values', () => {
      const code = generateConstArray('StatusValues', ['draft', 'published'], {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(code).toContain('export const StatusValues = [');
      expect(code).toContain('"draft"');
      expect(code).toContain('"published"');
      expect(code).toContain('] as const;');
      expect(code).toContain('/**');
    });

    it('should generate compact const array', () => {
      const code = generateConstArray('StatusValues', ['draft', 'published'], {
        formatted: false,
        exportTypes: true,
        includeComments: false,
      });

      expect(code).toBe('export const StatusValues = ["draft", "published"] as const;');
    });

    it('should generate const array with number values', () => {
      const code = generateConstArray('Priorities', [1, 2, 3], {
        formatted: true,
        exportTypes: true,
        includeComments: false,
      });

      expect(code).toContain('export const Priorities = [');
      expect(code).toContain('  1');
      expect(code).toContain('  2');
      expect(code).toContain('  3');
      expect(code).toContain('] as const;');
    });

    it('should respect exportTypes option', () => {
      const code = generateConstArray('StatusValues', ['draft'], {
        exportTypes: false,
      });

      expect(code).not.toContain('export ');
      expect(code).toContain('const StatusValues =');
    });
  });

  describe('generateUnionType', () => {
    it('should generate union type from const array', () => {
      const code = generateUnionType('Status', 'StatusValues', {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(code).toContain('export type Status = (typeof StatusValues)[number];');
      expect(code).toContain('/**');
    });

    it('should generate compact union type', () => {
      const code = generateUnionType('Status', 'StatusValues', {
        formatted: false,
        exportTypes: true,
        includeComments: false,
      });

      expect(code).toBe('export type Status = (typeof StatusValues)[number];');
    });

    it('should respect exportTypes option', () => {
      const code = generateUnionType('Status', 'StatusValues', {
        exportTypes: false,
        includeComments: false,
      });

      expect(code).not.toContain('export ');
      expect(code).toContain('type Status =');
    });
  });

  describe('generateParameterType', () => {
    it('should generate type for enum parameter', () => {
      const trait: TraitDefinition = {
        trait: { name: 'Stateful', version: '1.0.0' },
        schema: {},
      };

      const parameter: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: ['draft', 'published', 'archived'],
      };

      const result = generateParameterType(trait, parameter, {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(result).not.toBeNull();
      expect(result!.code).toContain('StatefulStatus');
      expect(result!.code).toContain('"draft"');
      expect(result!.code).toContain('"published"');
      expect(result!.code).toContain('"archived"');
      expect(result!.code).toContain('as const');
      expect(result!.typeNames).toEqual(['StatefulStatus']);
      expect(result!.constantNames).toEqual(['StatefulStatus']);
    });

    it('should return null for non-generatable parameter types', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
        schema: {},
      };

      const parameter: TraitParameter = {
        name: 'count',
        type: 'number',
        required: false,
      };

      const result = generateParameterType(trait, parameter);
      expect(result).toBeNull();
    });

    it('should return null for enum without values', () => {
      const trait: TraitDefinition = {
        trait: { name: 'TestTrait', version: '1.0.0' },
        schema: {},
      };

      const parameter: TraitParameter = {
        name: 'status',
        type: 'enum',
        required: true,
        enumValues: [],
      };

      const result = generateParameterType(trait, parameter);
      expect(result).toBeNull();
    });
  });

  describe('generateTraitTypes', () => {
    it('should generate complete types for a trait', () => {
      const trait: TraitDefinition = {
        trait: {
          name: 'Colorized',
          version: '1.0.0',
          description: 'Adds color properties',
        },
        parameters: [
          {
            name: 'colorScheme',
            type: 'enum',
            required: false,
            enumValues: ['default', 'primary', 'secondary'],
          },
        ],
        schema: {},
      };

      const result = generateTraitTypes(trait, {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      expect(result.code).toContain('Generated types for Colorized trait');
      expect(result.code).toContain('DO NOT EDIT');
      expect(result.code).toContain('ColorizedColorScheme');
      expect(result.code).toContain('"default"');
      expect(result.code).toContain('"primary"');
      expect(result.code).toContain('"secondary"');
      expect(result.typeNames).toContain('ColorizedColorScheme');
      expect(result.constantNames).toContain('ColorizedColorScheme');
    });

    it('should handle traits with multiple parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'MultiParam', version: '1.0.0' },
        parameters: [
          {
            name: 'status',
            type: 'enum',
            required: true,
            enumValues: ['active', 'inactive'],
          },
          {
            name: 'priority',
            type: 'enum',
            required: false,
            enumValues: ['low', 'medium', 'high'],
          },
        ],
        schema: {},
      };

      const result = generateTraitTypes(trait);

      expect(result.typeNames).toHaveLength(2);
      expect(result.typeNames).toContain('MultiParamStatus');
      expect(result.typeNames).toContain('MultiParamPriority');
      expect(result.code).toContain('"active"');
      expect(result.code).toContain('"low"');
    });

    it('should generate empty types for trait with no generatable parameters', () => {
      const trait: TraitDefinition = {
        trait: { name: 'Simple', version: '1.0.0' },
        parameters: [
          {
            name: 'label',
            type: 'string',
            required: true,
          },
        ],
        schema: {},
      };

      const result = generateTraitTypes(trait);

      expect(result.typeNames).toHaveLength(0);
      expect(result.constantNames).toHaveLength(0);
      expect(result.code).toContain('Generated types for Simple trait');
    });
  });

  describe('generateDeclarationFile', () => {
    it('should generate complete .d.ts file content', () => {
      const trait: TraitDefinition = {
        trait: {
          name: 'Stateful',
          version: '1.0.0',
          description: 'State management trait',
        },
        parameters: [
          {
            name: 'states',
            type: 'enum',
            required: true,
            enumValues: ['draft', 'active', 'archived'],
          },
        ],
        schema: {},
      };

      const code = generateDeclarationFile(trait);

      expect(code).toContain('/**');
      expect(code).toContain('Generated types for Stateful trait');
      expect(code).toContain('DO NOT EDIT');
      expect(code).toContain('export const StatefulStates');
      expect(code).toContain('export type StatefulStates');
      expect(code).toContain('"draft"');
      expect(code).toContain('as const');
    });
  });

  describe('Type preservation validation', () => {
    it('should preserve exact literal types through generation', () => {
      const trait: TraitDefinition = {
        trait: { name: 'Test', version: '1.0.0' },
        parameters: [
          {
            name: 'values',
            type: 'enum',
            required: true,
            enumValues: ['exact', 'literal', 'types'],
          },
        ],
        schema: {},
      };

      const result = generateParameterType(trait, trait.parameters![0]);

      // The generated code should use 'as const' which preserves literal types
      expect(result!.code).toContain('] as const');
      expect(result!.code).toContain('(typeof');
      expect(result!.code).toContain('[number]');
    });

    it('should generate readonly tuples', () => {
      const code = generateConstArray('Values', ['a', 'b', 'c']);

      // 'as const' creates a readonly tuple
      expect(code).toContain('] as const');
    });
  });
});
