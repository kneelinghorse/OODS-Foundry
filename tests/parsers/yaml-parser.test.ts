/**
 * Tests for YAML Trait Parser
 */

import { describe, it, expect } from 'vitest';
import { parseYamlTrait, extractParameters } from '../../src/parsers/yaml-parser.ts';

describe('YAML Trait Parser', () => {
  describe('parseYamlTrait', () => {
    it('should parse a valid minimal trait definition', () => {
      const yaml = `
trait:
  name: Testable
  version: 1.0.0

schema:
  test_field:
    type: string
    required: true
`;

      const result = parseYamlTrait(yaml, 'test.yaml');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.trait.name).toBe('Testable');
      expect(result.data?.trait.version).toBe('1.0.0');
      expect(result.data?.schema.test_field).toBeDefined();
      expect(result.data?.schema.test_field.type).toBe('string');
    });

    it('should parse a trait with all optional fields', () => {
      const yaml = `
trait:
  name: Complete
  version: 1.0.0
  description: A complete trait example
  category: testing

parameters:
  - name: color
    type: string
    required: true
    description: The color to use

schema:
  status:
    type: string
    required: true

semantics:
  status:
    semantic_type: status_enum
    token_mapping: test-status-*

view_extensions:
  list:
    - badge:
        text: Active
        color: success

  detail:
    - component: StatusDisplay
      position: top

tokens:
  test-status-active: "#10b981"
  test-status-inactive: "#6b7280"

dependencies:
  - Statusable

actions:
  - name: activate
    label: Activate
    confirmation: true

state_machine:
  states: [draft, active, archived]
  initial: draft
  transitions:
    - from: draft
      to: active
    - from: active
      to: archived

metadata:
  created: "2025-01-01"
`;

      const result = parseYamlTrait(yaml, 'complete.yaml');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.trait.name).toBe('Complete');
      expect(result.data?.parameters).toHaveLength(1);
      expect(result.data?.parameters?.[0].name).toBe('color');
      expect(result.data?.semantics?.status.semantic_type).toBe('status_enum');
      expect(result.data?.view_extensions?.list).toHaveLength(1);
      expect(result.data?.view_extensions?.detail).toHaveLength(1);
      expect(result.data?.tokens).toBeDefined();
      expect(result.data?.dependencies).toHaveLength(1);
      expect(result.data?.actions).toHaveLength(1);
      expect(result.data?.state_machine?.states).toEqual(['draft', 'active', 'archived']);
      expect(result.data?.state_machine?.initial).toBe('draft');
    });

    it('should fail when trait field is missing', () => {
      const yaml = `
schema:
  test_field:
    type: string
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain('Missing required field: "trait"');
      expect(result.errors?.[0].code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should fail when schema field is missing', () => {
      const yaml = `
trait:
  name: Invalid
  version: 1.0.0
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain('Missing required field: "schema"');
    });

    it('should fail when trait.name is missing', () => {
      const yaml = `
trait:
  version: 1.0.0

schema:
  test_field:
    type: string
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.field === 'trait.name')).toBe(true);
    });

    it('should fail when trait.version is missing', () => {
      const yaml = `
trait:
  name: Invalid

schema:
  test_field:
    type: string
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.field === 'trait.version')).toBe(true);
    });

    it('should fail with invalid YAML syntax', () => {
      const yaml = `
trait:
  name: Invalid
  version: 1.0.0
  bad indent
schema:
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('YAML_PARSE_ERROR');
    });

    it('should validate state_machine structure', () => {
      const yaml = `
trait:
  name: StateMachineTrait
  version: 1.0.0

schema:
  status:
    type: string

state_machine:
  states: []
  initial: active
  transitions: []
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'state_machine.states')).toBe(true);
    });

    it('should validate state_machine requires initial state', () => {
      const yaml = `
trait:
  name: StateMachineTrait
  version: 1.0.0

schema:
  status:
    type: string

state_machine:
  states: [active, inactive]
  transitions: []
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'state_machine.initial')).toBe(true);
    });

    it('should validate that arrays are arrays', () => {
      const yaml = `
trait:
  name: InvalidArrays
  version: 1.0.0

schema:
  test:
    type: string

parameters: "not an array"
`;

      const result = parseYamlTrait(yaml, 'invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.field === 'parameters')).toBe(true);
    });
  });

  describe('extractParameters', () => {
    it('should extract parameter names from parameterized trait', () => {
      const definition = {
        trait: {
          name: 'Colorized',
          version: '1.0.0',
        },
        schema: {},
        parameters: [
          { name: 'primaryColor', type: 'string' as const, required: true },
          { name: 'secondaryColor', type: 'string' as const, required: false },
        ],
      };

      const params = extractParameters(definition);

      expect(params).toEqual(['primaryColor', 'secondaryColor']);
    });

    it('should return empty array for non-parameterized trait', () => {
      const definition = {
        trait: {
          name: 'Simple',
          version: '1.0.0',
        },
        schema: {},
      };

      const params = extractParameters(definition);

      expect(params).toEqual([]);
    });
  });
});
