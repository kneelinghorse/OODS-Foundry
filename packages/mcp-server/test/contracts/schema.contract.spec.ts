import { describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import { formatValidationErrors } from '../../src/security/errors.js';
import { formatSchemaInputError } from '../../src/security/schema-errors.js';
import { knownBrands } from '../../src/lib/brand-registry.js';
import brandApplyInputSchema from '../../src/schemas/brand.apply.input.json' assert { type: 'json' };
import tokensBuildInputSchema from '../../src/schemas/tokens.build.input.json' assert { type: 'json' };
import genericOutputSchema from '../../src/schemas/generic.output.json' assert { type: 'json' };
import replValidateInputSchema from '../../src/schemas/repl.validate.input.json' assert { type: 'json' };
import type {
  BrandApplyInput,
  GenericOutput,
} from '../../src/schemas/generated.js';

const ajv = getAjv();

const validateBrandApplyInput = ajv.compile<BrandApplyInput>(brandApplyInputSchema);
const validateTokensBuildInput = ajv.compile(tokensBuildInputSchema);
const validateGenericOutput = ajv.compile<GenericOutput>(genericOutputSchema);

describe('schema contracts', () => {
  it('accepts valid brand.apply input payloads', () => {
    const payload: BrandApplyInput = {
      delta: { typography: { body: { fontSize: 14 } } },
      strategy: 'alias',
      apply: false,
      preview: { verbosity: 'compact' },
    };

    expect(validateBrandApplyInput(payload)).toBe(true);
    expect(validateBrandApplyInput.errors).toBeNull();
  });

  it('accepts patch strategy payloads with RFC 6902 operations', () => {
    const payload: BrandApplyInput = {
      strategy: 'patch',
      delta: [{ op: 'replace', path: '/color/brand/A/text/primary/$value', value: 'oklch(0.5 0.05 86)' }],
      apply: false,
    };

    expect(validateBrandApplyInput(payload)).toBe(true);
    expect(validateBrandApplyInput.errors).toBeNull();
  });

  it('rejects patch payloads when delta is not an array', () => {
    const invalidPayload: BrandApplyInput = {
      strategy: 'patch',
      delta: { typography: { body: { fontSize: 14 } } },
      apply: false,
    };

    expect(validateBrandApplyInput(invalidPayload)).toBe(false);
    expect(validateBrandApplyInput.errors).not.toBeNull();
  });

  it('rejects alias payloads when delta is an array', () => {
    const invalidPayload: BrandApplyInput = {
      strategy: 'alias',
      delta: [{ op: 'replace', path: '/color/brand/A/text/primary/$value', value: 'oklch(0.5 0.05 86)' }],
      apply: false,
    };

    expect(validateBrandApplyInput(invalidPayload)).toBe(false);
    expect(validateBrandApplyInput.errors).not.toBeNull();
  });

  it('rejects malformed brand.apply input payloads', () => {
    const invalidPayload = {
      delta: 42,
      apply: true,
    } as unknown;

    expect(validateBrandApplyInput(invalidPayload)).toBe(false);
    expect(validateBrandApplyInput.errors).not.toBeNull();
  });

  // s168-m01 — the wire enum is the boundary an MCP caller actually hits (index.ts:257
  // compiles this exact schema before handle() runs). Before this sprint NONE of the six
  // brand.apply test files asserted it, so deleting the enum outright broke no test.
  const BRANDS_ON_DISK = ['A', 'B'];

  // s213-m04: the brands are the brand registry's, checked at call time (format oods-brand), not an enum pinned here:
  // a brand the token build adds is accepted with no schema edit, and anything else is still refused below.
  it('checks the brand.apply brand against the brand registry, which holds the brands on disk', () => {
    expect((brandApplyInputSchema as any).properties.brand).toMatchObject({ type: 'string', format: 'oods-brand' });
    expect((brandApplyInputSchema as any).properties.brand.enum).toBeUndefined();
    expect(knownBrands()).toEqual(BRANDS_ON_DISK);
  });

  it('accepts every supported brand and rejects everything else at the wire boundary', () => {
    for (const brand of BRANDS_ON_DISK) {
      expect(validateBrandApplyInput({ brand, delta: {} })).toBe(true);
    }
    for (const brand of ['C', 'a', '', '.', '..', 'A/', 'A/../B', '../../../../../../etc']) {
      expect(validateBrandApplyInput({ brand, delta: {} })).toBe(false);
    }
  });

  it('checks the tokens.build brand against the same registry', () => {
    expect((tokensBuildInputSchema as any).properties.brand).toMatchObject({ type: 'string', format: 'oods-brand' });
    for (const brand of BRANDS_ON_DISK) {
      expect(validateTokensBuildInput({ brand })).toBe(true);
    }
    expect(validateTokensBuildInput({ brand: 'C' })).toBe(false);
  });

  it('accepts canonical generic output payloads', () => {
    const payload: GenericOutput = {
      artifacts: ['/tmp/artifacts/output.json'],
      diagnosticsPath: '/tmp/artifacts/diagnostics.json',
      transcriptPath: '/tmp/artifacts/transcript.json',
      bundleIndexPath: '/tmp/artifacts/bundle.json',
      preview: {
        summary: 'Applied billing updates',
        notes: ['Diff generated for billing fixtures'],
        diffs: [
          {
            path: 'billing/review-kit/subscription.json',
            status: 'modified',
            summary: { additions: 1, deletions: 0 },
            hunks: [
              {
                header: '@@ -1,2 +1,3 @@',
                changes: [
                  { type: 'context', value: '--- before' },
                  { type: 'add', value: '+++ after' },
                ],
              },
            ],
            structured: {
              type: 'json',
              before: { previous: 'value' },
              after: { previous: 'value', next: 'new' },
            },
          },
        ],
        specimens: ['subscription.stripe'],
      },
      artifactsDetail: [
        {
          path: '/tmp/artifacts/output.json',
          name: 'output.json',
          purpose: 'Primary operation output',
          sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          sizeBytes: 1024,
        },
      ],
    };

    expect(validateGenericOutput(payload)).toBe(true);
    expect(validateGenericOutput.errors).toBeNull();
  });

  it('accepts generic outputs with no artifacts', () => {
    const payload: GenericOutput = {
      artifacts: [],
      transcriptPath: '/tmp/artifacts/transcript.json',
      bundleIndexPath: '/tmp/artifacts/bundle.json',
    };

    expect(validateGenericOutput(payload)).toBe(true);
    expect(validateGenericOutput.errors).toBeNull();
  });





});

// ---------------------------------------------------------------------------
// Agent-friendly validation error formatting
// ---------------------------------------------------------------------------

const validateReplValidateInput = ajv.compile(replValidateInputSchema);

describe('formatValidationErrors', () => {
  it('formats enum errors with allowed values', () => {
    // mode: 'document' is invalid — only 'full' | 'patch' are allowed
    const payload = { mode: 'document' };
    validateReplValidateInput(payload);
    const result = formatValidationErrors(validateReplValidateInput.errors as any);

    expect(result.message).toContain('must be one of');
    expect(result.message).toContain('full');
    expect(result.message).toContain('patch');

    const enumDetail = result.details.find((d) => d.keyword === 'enum');
    expect(enumDetail).toBeDefined();
    expect(enumDetail!.message).toContain('full, patch');
  });

  it('formats required field errors with field name', () => {
    // brand.apply requires 'delta' — omit it to trigger required error
    const payload = { strategy: 'alias' } as unknown;
    validateBrandApplyInput(payload);
    const result = formatValidationErrors(validateBrandApplyInput.errors as any);

    expect(result.message).toContain('missing required field');
    expect(result.message).toContain('delta');

    const reqDetail = result.details.find((d) => d.keyword === 'required');
    expect(reqDetail).toBeDefined();
    expect(reqDetail!.field).toBe('delta');
  });

  it('formats type mismatch errors', () => {
    // delta should be object or array, not a number
    const payload = { delta: 42, apply: true } as unknown;
    validateBrandApplyInput(payload);
    const result = formatValidationErrors(validateBrandApplyInput.errors as any);

    // Should mention type constraint
    expect(result.details.length).toBeGreaterThan(0);
    expect(result.message).toContain('Input validation failed');
  });

  it('handles null/undefined errors gracefully', () => {
    const resultNull = formatValidationErrors(null);
    expect(resultNull.message).toBe('Input validation failed');
    expect(resultNull.details).toEqual([]);

    const resultUndefined = formatValidationErrors(undefined);
    expect(resultUndefined.message).toBe('Input validation failed');
    expect(resultUndefined.details).toEqual([]);
  });

  it('supports custom output prefixes', () => {
    const payload = { delta: 42, apply: true } as unknown;
    validateBrandApplyInput(payload);
    const result = formatValidationErrors(validateBrandApplyInput.errors as any, {
      prefix: 'Output validation failed',
    });

    expect(result.message).toContain('Output validation failed');
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('formats additionalProperties errors', () => {
    // repl.validate has additionalProperties: false
    const payload = { mode: 'full', schema: { version: '1.0', screens: [] }, bogusField: true };
    validateReplValidateInput(payload);
    const result = formatValidationErrors(validateReplValidateInput.errors as any);

    const apDetail = result.details.find((d) => d.keyword === 'additionalProperties');
    expect(apDetail).toBeDefined();
    expect(apDetail!.message).toContain('bogusField');
    expect(apDetail!.message).toContain('not allowed');
  });

  it('produces combined summary message', () => {
    // Multiple errors: missing mode and has extra field
    const payload = { bogusField: true } as unknown;
    validateReplValidateInput(payload);
    const result = formatValidationErrors(validateReplValidateInput.errors as any);

    // Should combine multiple errors with semicolons
    expect(result.details.length).toBeGreaterThan(1);
    expect(result.message).toContain(';');
  });
});

describe('formatSchemaInputError', () => {
  it('adds patch hints for repl (validate) patch errors', () => {
    const errors = [
      {
        keyword: 'required',
        instancePath: '',
        params: { missingProperty: 'patch' },
        message: "must have required property 'patch'",
      },
    ];

    // s107-m01b: the framework dispatches the grouped `repl` tool (action=validate).
    const result = formatSchemaInputError('repl', errors as any);
    expect(result.hint).toContain('Valid patch examples');
    expect(result.expected?.patch).toContain('JSON Patch');
  });

  it('does not add patch hints for other tools', () => {
    const errors = [
      {
        keyword: 'type',
        instancePath: '/patch',
        params: { type: 'array' },
        message: 'must be array',
      },
    ];

    const result = formatSchemaInputError('catalog.list', errors as any);
    expect(result.hint).toBeUndefined();
    expect(result.expected).toBeUndefined();
  });
});
