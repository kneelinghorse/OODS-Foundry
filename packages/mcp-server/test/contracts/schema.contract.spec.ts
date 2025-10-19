import { describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import brandApplyInputSchema from '../../src/schemas/brand.apply.input.json' assert { type: 'json' };
import genericOutputSchema from '../../src/schemas/generic.output.json' assert { type: 'json' };
import releaseVerifyInputSchema from '../../src/schemas/release.verify.input.json' assert { type: 'json' };
import releaseVerifyOutputSchema from '../../src/schemas/release.verify.output.json' assert { type: 'json' };
import type {
  BrandApplyInput,
  GenericOutput,
  ReleaseVerifyInput,
  ReleaseVerifyOutput,
} from '../../src/schemas/generated.js';

const ajv = getAjv();

const validateBrandApplyInput = ajv.compile<BrandApplyInput>(brandApplyInputSchema);
const validateGenericOutput = ajv.compile<GenericOutput>(genericOutputSchema);
const validateReleaseVerifyInput = ajv.compile<ReleaseVerifyInput>(releaseVerifyInputSchema);
const validateReleaseVerifyOutput = ajv.compile<ReleaseVerifyOutput>(releaseVerifyOutputSchema);

describe('schema contracts', () => {
  it('accepts valid brand.apply input payloads', () => {
    const payload: BrandApplyInput = {
      delta: { typography: { body: { fontSize: 14 } } },
      strategy: 'alias',
      apply: false,
    };

    expect(validateBrandApplyInput(payload)).toBe(true);
    expect(validateBrandApplyInput.errors).toBeNull();
  });

  it('rejects malformed brand.apply input payloads', () => {
    const invalidPayload = {
      delta: 42,
      apply: true,
    } as unknown;

    expect(validateBrandApplyInput(invalidPayload)).toBe(false);
    expect(validateBrandApplyInput.errors).not.toBeNull();
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

  it('rejects outputs missing transcript path', () => {
    const invalidPayload = {
      artifacts: ['/tmp/missing-transcript.json'],
      bundleIndexPath: '/tmp/index.json',
    } as unknown;

    expect(validateGenericOutput(invalidPayload)).toBe(false);
    expect(validateGenericOutput.errors).not.toBeNull();
  });

  it('accepts release.verify input payloads', () => {
    const payload: ReleaseVerifyInput = {
      packages: ['@oods/tokens'],
      fromTag: 'v1.2.3',
      apply: false,
    };

    expect(validateReleaseVerifyInput(payload)).toBe(true);
    expect(validateReleaseVerifyInput.errors).toBeNull();
  });

  it('flags release.verify inputs with empty packages array', () => {
    const invalidPayload = {
      packages: [],
    } as unknown;

    expect(validateReleaseVerifyInput(invalidPayload)).toBe(false);
    expect(validateReleaseVerifyInput.errors).not.toBeNull();
  });

  it('accepts release.verify output payloads', () => {
    const payload: ReleaseVerifyOutput = {
      artifacts: ['/tmp/output/diagnostics.json'],
      diagnosticsPath: '/tmp/output/diagnostics.json',
      transcriptPath: '/tmp/output/transcript.json',
      bundleIndexPath: '/tmp/output/bundle.json',
      results: [
        {
          name: '@oods/tokens',
          version: '1.2.3',
          identical: true,
          sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          sizeBytes: 2048,
          warnings: ['sanity check warning'],
          files: ['dist/index.js'],
        },
      ],
      changelogPath: '/tmp/output/CHANGELOG.md',
      summary: 'Packages verified successfully.',
      warnings: ['Minor warnings recorded.'],
    };

    expect(validateReleaseVerifyOutput(payload)).toBe(true);
    expect(validateReleaseVerifyOutput.errors).toBeNull();
  });

  it('rejects release.verify outputs missing results', () => {
    const invalidPayload = {
      artifacts: ['/tmp/output/diagnostics.json'],
      transcriptPath: '/tmp/output/transcript.json',
      bundleIndexPath: '/tmp/output/bundle.json',
      changelogPath: '/tmp/output/CHANGELOG.md',
      summary: 'Incomplete payload',
    } as unknown;

    expect(validateReleaseVerifyOutput(invalidPayload)).toBe(false);
    expect(validateReleaseVerifyOutput.errors).not.toBeNull();
  });
});
