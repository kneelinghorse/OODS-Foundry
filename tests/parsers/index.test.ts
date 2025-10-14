/**
 * Tests for Unified Parser
 */

import { describe, it, expect } from 'vitest';
import { detectTraitFormat, parseTraitFromString } from '../../src/parsers/index.ts';

describe('Unified Parser', () => {
  describe('detectTraitFormat', () => {
    it('should detect YAML files', () => {
      expect(detectTraitFormat('trait.yaml')).toBe('yaml');
      expect(detectTraitFormat('trait.yml')).toBe('yaml');
      expect(detectTraitFormat('/path/to/trait.yaml')).toBe('yaml');
    });

    it('should detect TypeScript files', () => {
      expect(detectTraitFormat('trait.ts')).toBe('typescript');
      expect(detectTraitFormat('trait.mts')).toBe('typescript');
      expect(detectTraitFormat('trait.cts')).toBe('typescript');
      expect(detectTraitFormat('/path/to/trait.ts')).toBe('typescript');
    });

    it('should detect unknown formats', () => {
      expect(detectTraitFormat('trait.json')).toBe('unknown');
      expect(detectTraitFormat('trait.js')).toBe('unknown');
      expect(detectTraitFormat('trait.txt')).toBe('unknown');
    });
  });

  describe('parseTraitFromString', () => {
    it('should parse YAML from string', async () => {
      const yaml = `
trait:
  name: StringTest
  version: 1.0.0

schema:
  field:
    type: string
`;

      const result = await parseTraitFromString(yaml, 'yaml', 'string-test.yaml');

      expect(result.success).toBe(true);
      expect(result.data?.trait.name).toBe('StringTest');
    });

    it('should not support TypeScript from string', async () => {
      const ts = 'export default { trait: { name: "Test" } }';

      const result = await parseTraitFromString(ts, 'typescript');

      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('UNSUPPORTED_OPERATION');
    });
  });
});
