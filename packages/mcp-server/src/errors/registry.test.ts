import { describe, it, expect } from 'vitest';
import {
  createError,
  isRetryable,
  getDefinition,
  allCodes,
  LEGACY_CODE_MAP,
  type StructuredError,
  type ErrorDefinition,
} from './registry.js';

describe('Error Registry', () => {
  it.each([
    ['OODS-V168', 'size is negative or non-finite'],
    ['OODS-V169', 'radius rather than area'],
    ['OODS-V170', 'conflicting encoded values'],
    ['OODS-V171', 'strength is negative or non-finite'],
    ['OODS-V172', 'directed geographic flow'],
    ['OODS-V173', 'force-graph directed edge'],
  ])('%s keeps its distinct operand-profile accuracy meaning and names the tool', (code, meaning) => {
    expect(getDefinition(code)).toMatchObject({ code, category: 'validation', retryable: true });
    expect(getDefinition(code)?.message).toContain('artifact.certify:');
    expect(getDefinition(code)?.message).toContain(meaning);
  });


  // ── Registry integrity ─────────────────────────────────────────────────
  it('contains at least 40 registered error codes', () => {
    expect(allCodes().length).toBeGreaterThanOrEqual(40);
  });

  it('every definition has its stable identity and actionable glossary metadata', () => {
    for (const def of allCodes()) {
      expect(def.code).toMatch(/^OODS-(?:[VNCSRW]\d{3}|(?:FP|BM|BA|WF|REV)-\d{3})$/);
      expect(['validation', 'not_found', 'conflict', 'server_error', 'rate_limit']).toContain(def.category);
      expect(typeof def.message).toBe('string');
      expect(def.message.length).toBeGreaterThan(0);
      expect(typeof def.retryable).toBe('boolean');
      expect(['error', 'warning', 'error-or-warning']).toContain(def.severity);
      expect(def.cause.trim().length).toBeGreaterThan(0);
      expect(def.fix.trim().length).toBeGreaterThan(0);
    }
  });

  it('code prefixes match categories', () => {
    const prefixMap: Record<string, string[]> = {
      V: ['validation'],
      FP: ['validation'], BM: ['validation'], BA: ['validation'], WF: ['validation'], REV: ['validation'],
      // Sprint194 fragment warnings are validation diagnostics, not failures.
      W: ['validation'],
      N: ['not_found'],
      C: ['conflict'],
      S: ['server_error'],
      R: ['rate_limit'],
    };
    for (const def of allCodes()) {
      const prefix = def.code.slice(5).match(/^[A-Z]+/)![0];
      const expected = prefixMap[prefix];
      expect(expected).toBeDefined();
      expect(expected).toContain(def.category);
    }
  });

  it('no duplicate codes', () => {
    const codes = allCodes().map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // ── getDefinition ──────────────────────────────────────────────────────
  it('returns definition for known code', () => {
    const def = getDefinition('OODS-V001');
    expect(def).toBeDefined();
    expect(def!.category).toBe('validation');
    expect(def!.message).toBe('Input validation failed');
  });

  it('returns undefined for unknown code', () => {
    expect(getDefinition('OODS-Z999')).toBeUndefined();
  });

  it('registers every generated-artifact closure failure used on the wire', () => {
    expect(getDefinition('OODS-N016')).toMatchObject({
      code: 'OODS-N016',
      category: 'not_found',
      message: 'Generated artifact dependency closure is invalid',
      retryable: false,
    });
    expect(getDefinition('OODS-N017')).toMatchObject({
      code: 'OODS-N017',
      category: 'not_found',
      message: 'Generated artifact envelope missing',
      retryable: false,
    });
  });

  it('registers unknown UI workflow state as a retryable validation error', () => {
    expect(getDefinition('OODS-V164')).toMatchObject({
      code: 'OODS-V164',
      category: 'validation',
      message: 'Unknown UI workflow state',
      retryable: true,
    });
  });

  it('distinguishes fixable viz.render pattern conflicts from authoring-only structural limits', () => {
    expect(getDefinition('OODS-V166')).toMatchObject({
      code: 'OODS-V166', category: 'validation',
      message: 'viz.render pattern conflicts with explicit data or source identity/presentation overrides',
      retryable: true,
    });
    expect(getDefinition('OODS-V167')).toMatchObject({
      code: 'OODS-V167', category: 'validation',
      message: 'viz.render pattern is authoring-only because its source structure is not supported by the public renderer',
      retryable: false,
    });
  });

  it('describes OODS-N013 as the unavailable HTML target, preserving the N-code category', () => {
    expect(getDefinition('OODS-N013')).toMatchObject({
      code: 'OODS-N013', category: 'not_found',
      message: 'HTML renderer unavailable; fallback output is forbidden at build or release confidence',
      retryable: false,
    });
  });

  it('registers unavailable HTML Tailwind output as a non-retryable target gap', () => {
    expect(getDefinition('OODS-N018')).toMatchObject({
      code: 'OODS-N018',
      category: 'not_found',
      message: 'HTML Tailwind styling unavailable',
      retryable: false,
    });
  });

  it('distinguishes canonical brand source absence from transient token build failures', () => {
    expect(getDefinition('OODS-N020')).toMatchObject({
      code: 'OODS-N020', category: 'not_found',
      message: 'brand.apply: canonical brand source is not shipped in this runtime',
      retryable: false,
    });
    expect(getDefinition('OODS-N011')).toMatchObject({ category: 'not_found', retryable: false });
    expect(getDefinition('OODS-S019')).toMatchObject({ category: 'server_error' });
  });

  // ── isRetryable ────────────────────────────────────────────────────────
  it('returns true for retryable codes', () => {
    expect(isRetryable('OODS-R001')).toBe(true);   // rate limit
    expect(isRetryable('OODS-R002')).toBe(true);   // concurrency
    expect(isRetryable('OODS-S002')).toBe(true);   // timeout
    expect(isRetryable('OODS-N003')).toBe(true);   // schemaRef not found
    expect(isRetryable('OODS-N004')).toBe(true);   // schemaRef expired
  });

  it('returns false for non-retryable codes', () => {
    expect(isRetryable('OODS-S001')).toBe(false);  // policy denied
    expect(isRetryable('OODS-N001')).toBe(false);  // unknown tool
    expect(isRetryable('OODS-V101')).toBe(false);  // unsafe path
  });

  it('returns false for unknown codes', () => {
    expect(isRetryable('OODS-Z999')).toBe(false);
  });

  // ── createError ────────────────────────────────────────────────────────
  it('creates structured error from registered code', () => {
    const err = createError('OODS-V001', { details: { field: 'name' } });
    expect(err.code).toBe('OODS-V001');
    expect(err.category).toBe('validation');
    expect(err.message).toBe('Input validation failed');
    expect(err.retryable).toBe(true);
    expect(err.details).toEqual({ field: 'name' });
    expect(err.incidentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('allows message override', () => {
    const err = createError('OODS-V001', { message: 'Custom message' });
    expect(err.message).toBe('Custom message');
    expect(err.code).toBe('OODS-V001');
  });

  it('creates fallback error for unknown code', () => {
    const err = createError('OODS-Z999');
    expect(err.code).toBe('OODS-Z999');
    expect(err.category).toBe('server_error');
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('Unknown error code');
  });

  it('every error has unique incidentId', () => {
    const a = createError('OODS-V001');
    const b = createError('OODS-V001');
    expect(a.incidentId).not.toBe(b.incidentId);
  });

  // ── Legacy bridge ──────────────────────────────────────────────────────
  it('maps all legacy ERROR_CODES to OODS codes', () => {
    const expected = ['SCHEMA_INPUT', 'SCHEMA_OUTPUT', 'UNKNOWN_TOOL', 'POLICY_DENIED', 'TIMEOUT', 'BAD_REQUEST', 'RATE_LIMIT', 'CONCURRENCY'];
    for (const key of expected) {
      expect(LEGACY_CODE_MAP[key]).toBeDefined();
      expect(LEGACY_CODE_MAP[key]).toMatch(/^OODS-/);
      expect(getDefinition(LEGACY_CODE_MAP[key])).toBeDefined();
    }
  });

  // ── Category coverage ──────────────────────────────────────────────────
  it('has codes in every category', () => {
    const categories = new Set(allCodes().map((d) => d.category));
    expect(categories).toContain('validation');
    expect(categories).toContain('not_found');
    expect(categories).toContain('conflict');
    expect(categories).toContain('server_error');
    expect(categories).toContain('rate_limit');
  });
});
