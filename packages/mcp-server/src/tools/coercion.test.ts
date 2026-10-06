import { describe, it, expect } from 'vitest';
import { coerce, normalizeCoercion, CoercionError } from './coercion.js';
import type { CoercionDef } from './map.shared.js';

describe('coerce()', () => {
  describe('identity', () => {
    it('passes through any value unchanged', () => {
      expect(coerce('hello', { type: 'identity' })).toBe('hello');
      expect(coerce(42, { type: 'identity' })).toBe(42);
      expect(coerce(true, { type: 'identity' })).toBe(true);
      expect(coerce(null, { type: 'identity' })).toBe(null);
    });
  });

  describe('enum', () => {
    const coercion: CoercionDef = {
      type: 'enum',
      mapping: { primary: 'filled', secondary: 'outlined', error: 'danger' },
    };

    it('maps a known key to its target value', () => {
      expect(coerce('primary', coercion)).toBe('filled');
      expect(coerce('secondary', coercion)).toBe('outlined');
      expect(coerce('error', coercion)).toBe('danger');
    });

    it('throws CoercionError for unknown key', () => {
      expect(() => coerce('unknown', coercion)).toThrow(CoercionError);
      expect(() => coerce('unknown', coercion)).toThrow(/No mapping for value 'unknown'/);
    });

    it('coerces non-string values to string keys', () => {
      const numCoercion: CoercionDef = {
        type: 'enum',
        mapping: { '1': 'one', '2': 'two' },
      };
      expect(coerce(1, numCoercion)).toBe('one');
    });
  });

  describe('boolean_to_string', () => {
    const coercion: CoercionDef = {
      type: 'boolean_to_string',
      trueValue: 'enabled',
      falseValue: 'disabled',
    };

    it('converts true to trueValue', () => {
      expect(coerce(true, coercion)).toBe('enabled');
    });

    it('converts false to falseValue', () => {
      expect(coerce(false, coercion)).toBe('disabled');
    });

    it('throws CoercionError for non-boolean input', () => {
      expect(() => coerce('true', coercion)).toThrow(CoercionError);
      expect(() => coerce('true', coercion)).toThrow(/Expected boolean, got string/);
      expect(() => coerce(1, coercion)).toThrow(CoercionError);
    });
  });

  describe('template', () => {
    it('interpolates {{value}} placeholder', () => {
      const coercion: CoercionDef = { type: 'template', pattern: '{{value}}px' };
      expect(coerce(16, coercion)).toBe('16px');
      expect(coerce('auto', coercion)).toBe('autopx');
    });

    it('handles multiple {{value}} occurrences', () => {
      const coercion: CoercionDef = { type: 'template', pattern: '{{value}} of {{value}}' };
      expect(coerce('best', coercion)).toBe('best of best');
    });

    it('returns pattern unchanged when no placeholder', () => {
      const coercion: CoercionDef = { type: 'template', pattern: 'static-value' };
      expect(coerce('anything', coercion)).toBe('static-value');
    });
  });

  describe('exhaustive check', () => {
    it('throws on unknown coercion type', () => {
      const bad = { type: 'nonexistent' } as any;
      expect(() => coerce('x', bad)).toThrow('Unknown coercion type');
    });
  });
});

describe('normalizeCoercion()', () => {
  it('converts null to identity', () => {
    expect(normalizeCoercion(null)).toEqual({ type: 'identity' });
  });

  it('converts undefined to identity', () => {
    expect(normalizeCoercion(undefined)).toEqual({ type: 'identity' });
  });

  it('passes through existing CoercionDef unchanged', () => {
    const def: CoercionDef = { type: 'enum', mapping: { a: 'b' } };
    expect(normalizeCoercion(def)).toBe(def);
  });
});
