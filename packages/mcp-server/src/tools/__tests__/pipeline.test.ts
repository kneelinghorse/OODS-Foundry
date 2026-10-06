import { passedEvidence } from '../../../test/helpers/release-evidence.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineInput, PipelineOutput } from '../pipeline.js';
import { buildGeneratedArtifact } from '../../codegen/artifact-envelope.js';
import {
  ALL_CHECKS,
  RELEASE_EVIDENCE_CLASSES,
  bindReleaseEvidence,
  createValidationReceipt,
  recordValidationChecks,
} from '../../codegen/validation-profile.js';
import type {
  CodegenFramework,
  CodegenReleaseEvidence,
  CodegenValidationProfile,
  CodegenValidationReceipt,
} from '../../codegen/types.js';

// ── Mock dependent tool handlers ────────────────────────────────────

const mockComposeHandle = vi.fn();
const mockValidateHandle = vi.fn();
const mockRenderHandle = vi.fn();
const mockCodeGenerateHandle = vi.fn();
const mockSchemaSaveHandle = vi.fn();

vi.mock('../design.compose.js', () => ({
  handle: (...args: unknown[]) => mockComposeHandle(...args),
}));

vi.mock('../repl.validate.js', () => ({
  handle: (...args: unknown[]) => mockValidateHandle(...args),
}));

vi.mock('../repl.render.js', () => ({
  handle: (...args: unknown[]) => mockRenderHandle(...args),
}));

vi.mock('../code.generate.js', () => ({
  handle: (...args: unknown[]) => mockCodeGenerateHandle(...args),
}));

vi.mock('../schema/save.js', () => ({
  handle: (...args: unknown[]) => mockSchemaSaveHandle(...args),
}));

// ── Test fixtures ───────────────────────────────────────────────────

function composeOk() {
  return {
    status: 'ok',
    layout: 'detail',
    schemaRef: 'ref:test-schema-123',
    objectUsed: { name: 'Subscription' },
    schema: {
      version: '2026.03',
      screens: [
        {
          id: 'screen-root',
          component: 'Stack',
          children: [
            { id: 'btn-1', component: 'Button' },
            { id: 'text-1', component: 'Text' },
          ],
        },
      ],
    },
    errors: [],
    warnings: [],
  };
}

function validateOk() {
  return { status: 'ok', errors: [], warnings: [] };
}

function renderOk() {
  return {
    status: 'ok',
    html: '<div data-oods-component="Stack">...</div>',
    errors: [],
    warnings: [],
    output: { format: 'document', strict: false },
    meta: { validationMeta: {} },
  };
}

function codegenOk(framework: CodegenFramework = 'react') {
  const code = framework === 'html'
    ? '<div></div>'
    : framework === 'vue'
      ? '<template><div /></template>'
      : 'export function Page() { return <div />; }';
  const fileExtension = framework === 'html' ? '.html' : framework === 'vue' ? '.vue' : '.tsx';
  const artifact = buildGeneratedArtifact({
    framework,
    code,
    fileExtension,
    imports: [],
  });
  const validationReceipt = bindReleaseEvidence(
    recordValidationChecks(
      createValidationReceipt(undefined, framework),
      'schema-structure',
      'component-registry',
      'state-contract',
      'target-readiness',
      'normalization-fidelity',
      'binding-contract',
      'props-contract',
      'slots-contract',
      'events-contract',
      'dependency-closure',
      'fallback-policy',
    ),
    undefined,
    artifact.contentHash,
  ).receipt;
  return {
    status: 'ok',
    framework,
    artifact,
    code,
    fileExtension,
    imports: [],
    warnings: [],
    validationReceipt,
  };
}

const buildChecks = ALL_CHECKS.filter((check) => !check.endsWith('-evidence'));

function completeReceipt(
  profile: CodegenValidationProfile,
  target: CodegenFramework,
  artifactContentHash: string,
): CodegenValidationReceipt {
  const receipt = recordValidationChecks(
    createValidationReceipt(profile, target),
    ...buildChecks,
  );
  const releaseEvidence = profile === 'release'
    ? Object.fromEntries(RELEASE_EVIDENCE_CLASSES.map((evidenceClass) => [
      evidenceClass,
      passedEvidence(artifactContentHash, evidenceClass),
    ])) as CodegenReleaseEvidence
    : undefined;
  return bindReleaseEvidence(receipt, releaseEvidence, artifactContentHash).receipt;
}

function releaseCodegenOk() {
  const result = codegenOk();
  return {
    ...result,
    validationReceipt: completeReceipt('release', 'react', result.artifact.contentHash),
  };
}

function saveOk() {
  return { name: 'my-schema', version: 1 };
}

function expectCodegenIntegrityRejection(result: PipelineOutput): void {
  expect(result.error).toMatchObject({ step: 'codegen', code: 'OODS-S009' });
  expect(result.code).toBeUndefined();
  expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
}

// ── Tests ───────────────────────────────────────────────────────────

describe('pipeline orchestration', () => {
  let handle: (input: PipelineInput) => Promise<PipelineOutput>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default happy-path stubs
    mockComposeHandle.mockResolvedValue(composeOk());
    mockValidateHandle.mockResolvedValue(validateOk());
    mockRenderHandle.mockResolvedValue(renderOk());
    mockCodeGenerateHandle.mockImplementation(async (input: { framework: CodegenFramework }) => (
      codegenOk(input.framework)
    ));
    mockSchemaSaveHandle.mockResolvedValue(saveOk());

    // Dynamic import to get the mocked version
    const mod = await import('../pipeline.js');
    handle = mod.handle;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Full pipeline ───────────────────────────────────────────────

  describe('full pipeline flow', () => {
    it('runs compose → validate → render → codegen and returns all sections', async () => {
      const result = await handle({
        object: 'Subscription',
        context: 'detail',
        framework: 'react',
        styling: 'tailwind',
      });

      expect(result.error).toBeUndefined();
      expect(result.compose.object).toBe('Subscription');
      expect(result.compose.layout).toBe('detail');
      expect(result.compose.componentCount).toBeGreaterThan(0);
      expect(result.validation).toBeDefined();
      expect(result.validation!.status).toBe('ok');
      expect(result.render).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.code!.framework).toBe('react');
      expect(result.code!.styling).toBe('tailwind');
      expect(result.code!.artifact.files[0]!.contents).toBeTruthy();
      expect(result.code).not.toHaveProperty('output');
    });

    it('includes pipeline metadata with steps and duration', async () => {
      const result = await handle({
        object: 'Subscription',
        context: 'detail',
        framework: 'react',
      });

      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen']);
      expect(result.pipeline.duration).toBeGreaterThan(0);
    });

    it('defaults framework to react and styling to tokens', async () => {
      const result = await handle({ object: 'Subscription' });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'react',
          options: expect.objectContaining({ styling: 'tokens' }),
        }),
      );
      expect(result.code!.framework).toBe('react');
      expect(result.code!.styling).toBe('tokens');
    });

    it('passes object, intent, context, layout to compose', async () => {
      await handle({
        object: 'User',
        intent: 'manage users',
        context: 'list',
        layout: 'dashboard',
      });

      expect(mockComposeHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'User',
          intent: 'manage users',
          context: 'list',
          layout: 'dashboard',
          options: { validate: false },
        }),
      );
    });

    it('passes componentOverrides through to compose', async () => {
      await handle({
        object: 'Subscription',
        context: 'detail',
        preferences: { componentOverrides: { 'tab-0': 'Card' } },
      });

      expect(mockComposeHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'Subscription',
          context: 'detail',
          preferences: { componentOverrides: { 'tab-0': 'Card' } },
          options: { validate: false },
        }),
      );
    });
  });

  // ── schemaRef TTL propagation ───────────────────────────────────

  describe('schemaRef TTL propagation', () => {
    it('propagates schemaRefCreatedAt and schemaRefExpiresAt from compose', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        schemaRefCreatedAt: '2026-03-05T10:00:00.000Z',
        schemaRefExpiresAt: '2026-03-05T10:30:00.000Z',
      });

      const result = await handle({ object: 'Subscription', framework: 'react' });

      expect(result.schemaRefCreatedAt).toBe('2026-03-05T10:00:00.000Z');
      expect(result.schemaRefExpiresAt).toBe('2026-03-05T10:30:00.000Z');
    });

    it('omits TTL fields when compose does not return them', async () => {
      const result = await handle({ object: 'Subscription', framework: 'react' });

      expect(result.schemaRefCreatedAt).toBeUndefined();
      expect(result.schemaRefExpiresAt).toBeUndefined();
    });
  });

  // ── Skip options ──────────────────────────────────────────────────

  describe('skip options', () => {
    it('skipValidation=true omits validation step', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true },
      });

      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(result.validation).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('validate');
      expect(result.pipeline.steps).toContain('compose');
      expect(result.pipeline.steps).toContain('render');
      expect(result.pipeline.steps).toContain('codegen');
    });

    it('skipRender=true omits render step', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipRender: true },
      });

      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(result.render).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('render');
      expect(result.pipeline.steps).toContain('validate');
    });

    it('both skipValidation and skipRender omit both steps', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true, skipRender: true },
      });

      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    });
  });

  // ── Save option ───────────────────────────────────────────────────

  describe('save option', () => {
    it('saves schema when save name is provided', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'my-schema',
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-schema',
          schemaRef: 'ref:test-schema-123',
          object: 'Subscription',
        }),
      );
      expect(result.saved).toEqual({ name: 'my-schema', version: 1 });
      expect(result.pipeline.steps).toContain('save');
    });

    it('passes compose object name to save handler', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        objectUsed: { name: 'Transaction' },
      });

      await handle({
        object: 'Transaction',
        framework: 'react',
        save: 'txn-receipt',
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'txn-receipt',
          object: 'Transaction',
        }),
      );
    });

    it('saves schema with tags when object form is used', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: { name: 'my-schema', tags: ['receipt', 'billing'] },
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-schema',
          schemaRef: 'ref:test-schema-123',
          tags: ['receipt', 'billing'],
          object: 'Subscription',
        }),
      );
      expect(result.saved).toEqual({ name: 'my-schema', version: 1 });
      expect(result.pipeline.steps).toContain('save');
    });

    it('saves schema with object form without tags', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
        save: { name: 'no-tags-schema' },
      });

      const call = mockSchemaSaveHandle.mock.calls[0][0];
      expect(call.name).toBe('no-tags-schema');
      expect(call.tags).toBeUndefined();
    });

    it('does not save when save is not provided', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
      expect(result.saved).toBeUndefined();
      expect(result.pipeline.steps).not.toContain('save');
    });

    it('trims whitespace-only save names', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: '   ',
      });

      // Empty after trim — should not save
      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
      expect(result.saved).toBeUndefined();
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns error with partial results when compose fails', async () => {
      mockComposeHandle.mockResolvedValue({
        status: 'error',
        layout: 'auto',
        errors: [{ code: 'OBJECT_NOT_FOUND', message: 'Object "FakeObj" not found' }],
        warnings: [],
      });

      const result = await handle({
        object: 'FakeObj',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OBJECT_NOT_FOUND');
      expect(result.error!.message).toContain('FakeObj');
      // No downstream steps executed
      expect(mockValidateHandle).not.toHaveBeenCalled();
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when compose throws an exception', async () => {
      mockComposeHandle.mockRejectedValue(new Error('compose crashed'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OODS-S010');
      expect(result.error!.message).toContain('compose crashed');
    });

    it('returns error when validate fails', async () => {
      mockValidateHandle.mockResolvedValue({
        status: 'invalid',
        errors: [{ code: 'INVALID_SCHEMA', message: 'Schema structure invalid' }],
        warnings: [],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('validate');
      expect(result.error!.code).toBe('INVALID_SCHEMA');
      // compose ran but validation failed — no render/codegen
      expect(mockRenderHandle).not.toHaveBeenCalled();
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when validate throws', async () => {
      mockValidateHandle.mockRejectedValue(new Error('validate exploded'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('validate');
      expect(result.error!.code).toBe('OODS-S011');
    });

    it('returns error when render fails', async () => {
      mockRenderHandle.mockResolvedValue({
        status: 'error',
        errors: [{ code: 'RENDER_FAILED', message: 'Cannot render component X' }],
        warnings: [],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.step).toBe('render');
      expect(result.error!.code).toBe('RENDER_FAILED');
      expect(mockCodeGenerateHandle).not.toHaveBeenCalled();
    });

    it('returns error when render throws', async () => {
      mockRenderHandle.mockRejectedValue(new Error('render boom'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('render');
      expect(result.error!.code).toBe('OODS-S012');
    });

    it('returns error when codegen fails', async () => {
      mockCodeGenerateHandle.mockResolvedValue({
        status: 'error',
        framework: 'react',
        code: '',
        fileExtension: '',
        imports: [],
        warnings: [],
        validationReceipt: createValidationReceipt(undefined, 'react'),
        errors: [{ code: 'EMITTER_CRASH', message: 'React emitter failed' }],
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('codegen');
      expect(result.error!.code).toBe('EMITTER_CRASH');
    });

    it('rejects a codegen response that omits the mandatory validation receipt', async () => {
      const { validationReceipt: _validationReceipt, ...withoutReceipt } = codegenOk();
      mockCodeGenerateHandle.mockResolvedValue(withoutReceipt);

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        profile: 'release',
      });

      expect(result.error).toEqual({
        step: 'codegen',
        code: 'OODS-S009',
        message: 'code.generate returned without its mandatory validation receipt.',
      });
      expect(result.code).toBeUndefined();
      expect(result.validationReceipt.profile).toBe('release');
      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
    });

    it('rejects a child receipt that downgrades a requested release profile to draft', async () => {
      const child = codegenOk();
      mockCodeGenerateHandle.mockResolvedValue({
        ...child,
        validationReceipt: completeReceipt('draft', 'react', child.artifact.contentHash),
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        profile: 'release',
      });

      expectCodegenIntegrityRejection(result);
      expect(result.error!.message).toMatch(/profile "draft" does not match "release"/i);
    });

    it.each([
      {
        mismatch: 'top-level framework',
        mutate: () => ({
          ...codegenOk(),
          framework: 'vue' as const,
        }),
        message: /returned framework "vue".*requested target "react"/i,
      },
      {
        mismatch: 'artifact framework',
        mutate: () => {
          const child = codegenOk();
          return {
            ...child,
            artifact: buildGeneratedArtifact({
              framework: 'vue',
              code: '<template><div /></template>',
              fileExtension: '.vue',
              imports: [],
            }),
          };
        },
        message: /returned an artifact for "vue" instead of "react"/i,
      },
      {
        mismatch: 'receipt target',
        mutate: () => {
          const child = codegenOk();
          return {
            ...child,
            validationReceipt: {
              ...child.validationReceipt,
              axes: {
                ...child.validationReceipt.axes,
                target: { requested: 'vue', resolved: 'vue', source: 'explicit' as const },
              },
            },
          };
        },
        message: /target resolution does not match/i,
      },
    ])('rejects a child $mismatch mismatch', async ({ mutate, message }) => {
      mockCodeGenerateHandle.mockResolvedValue(mutate());

      const result = await handle({ object: 'Subscription', framework: 'react' });

      expectCodegenIntegrityRejection(result);
      expect(result.error!.message).toMatch(message);
    });

    it('rejects a successful artifact with a vacuous receipt check partition', async () => {
      const child = codegenOk();
      mockCodeGenerateHandle.mockResolvedValue({
        ...child,
        validationReceipt: {
          ...child.validationReceipt,
          checks: [],
          notChecked: [],
        },
      });

      const result = await handle({ object: 'Subscription', framework: 'react' });

      expectCodegenIntegrityRejection(result);
      expect(result.error!.message).toMatch(/canonical, complete, disjoint check partition/i);
    });

    it('rejects a receipt whose governed artifact hash differs from the artifact envelope', async () => {
      const child = codegenOk();
      mockCodeGenerateHandle.mockResolvedValue({
        ...child,
        validationReceipt: {
          ...child.validationReceipt,
          evidence: {
            ...child.validationReceipt.evidence,
            artifactContentHash: `sha256:${'0'.repeat(64)}`,
          },
        },
      });

      const result = await handle({ object: 'Subscription', framework: 'react' });

      expectCodegenIntegrityRejection(result);
      expect(result.error!.message).toMatch(/receipt artifact hash does not match/i);
    });

    it.each([
      {
        defect: 'an accepted item bound to another artifact',
        mutate: (receipt: CodegenValidationReceipt) => ({
          ...receipt,
          evidence: {
            ...receipt.evidence,
            accepted: receipt.evidence.accepted.map((item, index) => (
              index === 0
                ? { ...item, artifactContentHash: `sha256:${'0'.repeat(64)}` }
                : item
            )),
          },
        }),
        message: /accepted release evidence is not bound/i,
      },
      {
        defect: 'an incomplete accepted-evidence set',
        mutate: (receipt: CodegenValidationReceipt) => ({
          ...receipt,
          evidence: {
            ...receipt.evidence,
            provided: receipt.evidence.provided.slice(0, -1),
            missing: ['performance' as const],
            accepted: receipt.evidence.accepted.slice(0, -1),
          },
        }),
        message: /does not disclose six satisfied evidence classes/i,
      },
    ])('rejects successful release with $defect', async ({ mutate, message }) => {
      const child = releaseCodegenOk();
      mockCodeGenerateHandle.mockResolvedValue({
        ...child,
        validationReceipt: mutate(child.validationReceipt),
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        profile: 'release',
      });

      expectCodegenIntegrityRejection(result);
      expect(result.error!.message).toMatch(message);
    });

    it('rejects codegen success that omits the mandatory artifact envelope', async () => {
      const { artifact: _artifact, ...withoutArtifact } = codegenOk();
      mockCodeGenerateHandle.mockResolvedValue(withoutArtifact);

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toEqual({
        step: 'codegen',
        code: 'OODS-N017',
        message: 'code.generate returned success without an artifact envelope.',
      });
      expect(result.code).toBeUndefined();
      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
    });

    it('B-15 propagates OODS-N015 as a codegen-stage error without a successful payload', async () => {
      mockCodeGenerateHandle.mockResolvedValue({
        status: 'error',
        framework: 'react',
        code: '',
        fileExtension: '',
        imports: [],
        warnings: [],
        validationReceipt: recordValidationChecks(
          createValidationReceipt(undefined, 'react'),
          'schema-structure',
          'component-registry',
          'state-contract',
          'target-readiness',
        ),
        errors: [
          {
            code: 'OODS-N015',
            message: 'Component ArchiveSummary is not emission-eligible for react; evidence state: unavailable.',
            nodeId: 'archive-summary',
            component: 'ArchiveSummary',
          },
        ],
        meta: { nodeCount: 1, componentCount: 1 },
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error).toEqual({
        step: 'codegen',
        code: 'OODS-N015',
        message: 'Component ArchiveSummary is not emission-eligible for react; evidence state: unavailable.',
      });
      expect(result.code).toBeUndefined();
      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen']);
      expect(mockSchemaSaveHandle).not.toHaveBeenCalled();
    });

    it('returns error when codegen throws', async () => {
      mockCodeGenerateHandle.mockRejectedValue(new Error('codegen kaboom'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('codegen');
      expect(result.error!.code).toBe('OODS-S013');
    });

    it('returns error when save throws', async () => {
      mockSchemaSaveHandle.mockRejectedValue(new Error('disk full'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-save',
      });

      expect(result.error!.step).toBe('save');
      expect(result.error!.code).toBe('OODS-S014');
      // Code was generated before save failed
      expect(result.code).toBeDefined();
    });

    it('returns SCHEMA_REF_MISSING when compose returns no schemaRef', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        schemaRef: undefined,
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.error!.step).toBe('compose');
      expect(result.error!.code).toBe('OODS-C001');
    });

    it('always includes pipeline duration even on error', async () => {
      mockComposeHandle.mockRejectedValue(new Error('fail early'));

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.pipeline.duration).toBeGreaterThan(0);
      expect(result.pipeline.steps).toContain('compose');
    });
  });

  // ── Nested options aliases (s74-m04) ─────────────────────────────

  describe('nested options aliases', () => {
    it('reads framework from options when not at top level', async () => {
      const result = await handle({
        object: 'Subscription',
        options: { framework: 'vue' },
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({ framework: 'vue' }),
      );
      expect(result.code!.framework).toBe('vue');
    });

    it('reads styling from options when not at top level', async () => {
      const result = await handle({
        object: 'Subscription',
        options: { styling: 'tailwind' },
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ styling: 'tailwind' }),
        }),
      );
      expect(result.code!.styling).toBe('tailwind');
    });

    it('top-level framework overrides options.framework', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'html',
        options: { framework: 'vue' },
      });

      expect(result.code!.framework).toBe('html');
    });

    it('passes typescript from options to codegen', async () => {
      await handle({
        object: 'Subscription',
        options: { typescript: false },
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ typescript: false }),
        }),
      );
    });

    it('passes nested framework and typescript together to codegen', async () => {
      const result = await handle({
        object: 'Subscription',
        options: { framework: 'vue', typescript: false },
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'vue',
          options: expect.objectContaining({ typescript: false }),
        }),
      );
      expect(result.code!.framework).toBe('vue');
    });

    it('top-level framework override keeps nested typescript setting', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'html',
        options: { framework: 'vue', typescript: false },
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'html',
          options: expect.objectContaining({ typescript: false }),
        }),
      );
      expect(result.code!.framework).toBe('html');
    });
  });

  // ── Duration tracking ─────────────────────────────────────────────

  describe('duration and steps tracking', () => {
    it('pipeline.duration is always a positive number', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.pipeline.duration).toBeGreaterThan(0);
      expect(typeof result.pipeline.duration).toBe('number');
    });

    it('pipeline.steps lists all executed steps in order', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-schema',
      });

      expect(result.pipeline.steps).toEqual(['compose', 'validate', 'render', 'codegen', 'save']);
    });

    it('pipeline.steps reflects skipped steps', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
        options: { skipValidation: true, skipRender: true },
      });

      expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    });
  });

  // ── schemaRef propagation ─────────────────────────────────────────

  describe('schemaRef propagation', () => {
    it('propagates compose schemaRef to output', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.schemaRef).toBe('ref:test-schema-123');
    });

    it('passes schemaRef to validate', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockValidateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to render', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockRenderHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to codegen', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(mockCodeGenerateHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });

    it('passes schemaRef to save', async () => {
      await handle({
        object: 'Subscription',
        framework: 'react',
        save: 'test-save',
      });

      expect(mockSchemaSaveHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaRef: 'ref:test-schema-123',
        }),
      );
    });
  });

  // ── Component count ───────────────────────────────────────────────

  describe('component counting', () => {
    it('counts unique components from compose result', async () => {
      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      // Fixture has Stack, Button, Text = 3 unique
      expect(result.compose.componentCount).toBe(3);
    });
  });

  it('s216 counts recipe, collection, chart and display-reference bindings without duplicating code', async () => {
    const composed: any = composeOk();
    composed.schema.objectSchema = Object.fromEntries(['amount', 'currency', 'record_id', 'title', 'history', 'series', 'label', 'label_name', 'unused'].map(name => [name, { type: 'string' }]));
    composed.schema.objectSchema.label.displayLabelField = 'label_name';
    composed.schema.screens[0].children = [
      { id: 'price', component: 'PriceBadge', props: { amountField: 'amount', currencyField: 'currency' } },
      { id: 'rows', component: 'Stack', collection: { source: 'rows', keyField: 'record_id', labelField: 'title', historyField: 'history' } },
      { id: 'chart', component: 'VizAreaPreview', chart: { source: 'record-array', dataField: 'series' } },
      { id: 'label', component: 'Text', props: { field: 'label', title: 'unused' } },
    ];
    mockComposeHandle.mockResolvedValue(composed);
    const result = await handle({ object: 'Subscription', options: { skipRender: true } });
    expect(result.error).toBeUndefined();
    expect(result.metrics?.fieldsBound).toBe(8);
    expect(result.metrics?.fieldsOmitted?.map(item => item.field)).toEqual(['unused']);
    expect(result.code).not.toHaveProperty('output');
    expect(result.metrics?.responseBytes).toBe(Buffer.byteLength(JSON.stringify(result)));
  });

  // ── fieldsOmitted metric ─────────────────────────────────────────

  describe('fieldsOmitted metric', () => {
    it('reports omitted fields when objectSchema has unbound fields', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        schema: {
          version: '2026.03',
          objectSchema: {
            name: { type: 'string' },
            email: { type: 'string' },
            status: { type: 'string' },
            featureMatrix: { type: 'object', properties: { a: { type: 'string' } } },
          },
          screens: [
            {
              id: 'screen-root',
              component: 'Stack',
              children: [
                { id: 'field-name', component: 'Text', props: { field: 'name' } },
                { id: 'field-email', component: 'Text', props: { field: 'email' } },
              ],
            },
          ],
        },
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics!.fieldsBound).toBe(2);
      expect(result.metrics!.fieldsOmitted).toBeDefined();
      expect(result.metrics!.fieldsOmitted).toHaveLength(2);

      const omittedFields = result.metrics!.fieldsOmitted!.map((o) => o.field);
      expect(omittedFields).toContain('status');
      expect(omittedFields).toContain('featureMatrix');

      // Complex field gets specific reason
      const featureEntry = result.metrics!.fieldsOmitted!.find((o) => o.field === 'featureMatrix');
      expect(featureEntry!.reason).toContain('Complex');
    });

    it('omits fieldsOmitted when all fields are bound', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        schema: {
          version: '2026.03',
          objectSchema: {
            name: { type: 'string' },
          },
          screens: [
            {
              id: 'screen-root',
              component: 'Stack',
              children: [
                { id: 'field-name', component: 'Text', props: { field: 'name' } },
              ],
            },
          ],
        },
      });

      const result = await handle({
        object: 'Subscription',
        framework: 'react',
      });

      expect(result.metrics!.fieldsBound).toBe(1);
      expect(result.metrics!.fieldsOmitted).toBeUndefined();
    });
  });

  // ── Sprint 88: actionMappings round-trip ──────────────────────────
  describe('actionMappings', () => {
    it('forwards actionMappings[] to compose and surfaces resolvedActions on output', async () => {
      mockComposeHandle.mockResolvedValue({
        ...composeOk(),
        objectUsed: {
          name: 'Subscription',
          resolvedActions: [
            { trait: 'Archivable', verbs: ['archive', 'restore'] },
            { trait: 'Cancellable', verbs: ['cancel'] },
          ],
        },
      });

      const result = await handle({
        object: 'Subscription',
        actionMappings: [
          { verb: 'archive', oodsTrait: 'Archivable' },
          { verb: 'restore', oodsTrait: 'Archivable' },
          { verb: 'cancel', oodsTrait: 'Cancellable' },
        ],
        framework: 'react',
      });

      expect(mockComposeHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          actionMappings: [
            { verb: 'archive', oodsTrait: 'Archivable' },
            { verb: 'restore', oodsTrait: 'Archivable' },
            { verb: 'cancel', oodsTrait: 'Cancellable' },
          ],
        }),
      );
      expect(result.compose.resolvedActions).toEqual([
        { trait: 'Archivable', verbs: ['archive', 'restore'] },
        { trait: 'Cancellable', verbs: ['cancel'] },
      ]);
    });

    it('omits resolvedActions when actionMappings is absent', async () => {
      const result = await handle({ object: 'Subscription', framework: 'react' });
      expect(result.compose.resolvedActions).toBeUndefined();
      expect(mockComposeHandle).toHaveBeenCalledWith(
        expect.not.objectContaining({ actionMappings: expect.anything() }),
      );
    });
  });
});
