/**
 * Tests for TypeScript Trait Parser
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTypeScriptTraitSync, extractTypeScriptParameters } from '../../src/parsers/ts-parser.ts';

const fixturesDir = join(__dirname, '..', 'fixtures', 'ts');

describe('TypeScript Trait Parser (sync require path)', () => {
  it('parses a valid CommonJS JS module via require fallback', () => {
    const file = join(fixturesDir, 'valid-trait.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(true);
    expect(result.data?.trait.name).toBe('JsColorized');
    expect(result.data?.schema).toBeDefined();
  });

  it('validates missing required trait field', () => {
    const file = join(fixturesDir, 'missing-trait.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'trait')).toBe(true);
  });

  it('validates missing required schema field', () => {
    const file = join(fixturesDir, 'missing-schema.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'schema')).toBe(true);
  });

  it('validates state_machine structure', () => {
    const file = join(fixturesDir, 'invalid-state-machine.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'state_machine.states')).toBe(true);
    expect(result.errors?.some(e => e.field === 'state_machine.initial')).toBe(true);
    expect(result.errors?.some(e => e.field === 'state_machine.transitions')).toBe(true);
  });

  it('validates array-typed fields are arrays', () => {
    const file = join(fixturesDir, 'invalid-arrays.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'parameters')).toBe(true);
    expect(result.errors?.some(e => e.field === 'dependencies')).toBe(true);
    expect(result.errors?.some(e => e.field === 'actions')).toBe(true);
  });

  it('validates object-typed fields are objects', () => {
    const file = join(fixturesDir, 'invalid-objects.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'semantics')).toBe(true);
    expect(result.errors?.some(e => e.field === 'view_extensions')).toBe(true);
    expect(result.errors?.some(e => e.field === 'tokens')).toBe(true);
    expect(result.errors?.some(e => e.field === 'state_machine')).toBe(true);
    expect(result.errors?.some(e => e.field === 'metadata')).toBe(true);
  });

  it("extracts parameters using 'as const' style definition", () => {
    const file = join(fixturesDir, 'valid-trait.cjs');
    const result = parseTypeScriptTraitSync(file);

    expect(result.success).toBe(true);
    const params = extractTypeScriptParameters(result.data!);
    expect(params).toEqual(['colorScheme', 'allowCustomColors']);
  });
});

