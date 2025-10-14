/**
 * Tests for ValidationPipeline orchestration.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  ValidationPipeline,
  ValidationIssue,
  ErrorCodes,
  CompositionValidator,
} from '../../src/validation/index.js';
import { createEmptyComposedObject } from '../../src/core/composed-object.js';
import type { ComposedObject } from '../../src/core/composed-object.js';

function buildValidComposedObject(): ComposedObject {
  const composed = createEmptyComposedObject('demo', 'Demo Object');
  composed.schema = {
    title: { type: 'string', required: true },
    status: { type: 'string', required: true },
  };
  composed.semantics = {
    title: {
      semantic_type: 'text.title',
      token_mapping: 'tokenMap(text.title.primary)',
    },
    status: {
      semantic_type: 'status.state',
      token_mapping: 'tokenMap(status.state.draft)',
    },
  };
  composed.tokens = {
    text: { title: { primary: '#111111' } },
    status: { state: { draft: '#cccccc' } },
  };
  composed.viewExtensions = {
    detail: [
      { component: 'TitleBlock', props: { field: 'title' } },
      { component: 'StatusBadge', props: { field: 'status' } },
    ],
  };
  composed.actions = [];
  composed.traits = [
    {
      trait: { name: 'TitleTrait', version: '1.0.0' },
      schema: {
        title: { type: 'string', required: true },
      },
      semantics: composed.semantics,
    } as any,
  ];
  composed.metadata.traitOrder = ['TitleTrait'];
  composed.metadata.traitCount = 1;
  composed.metadata.collisions = [];
  composed.metadata.warnings = [];
  composed.metadata.provenance.set('title', {
    fieldName: 'title',
    source: 'TitleTrait',
    layer: 'trait',
    order: 0,
  });

  return composed;
}

describe('ValidationPipeline', () => {
  it('validates data against registered JSON schema', () => {
    const pipeline = new ValidationPipeline();
    pipeline.registerSchema('trait', {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    });

    const result = pipeline.validateWithSchema('trait', {}, { filePath: 'traits/example.yaml' });
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
    expect(result.issues[0].code).toBe(ErrorCodes.MISSING_REQUIRED_PARAMETER);
  });

  it('runs registered validators and respects allErrors flag', () => {
    const pipeline = new ValidationPipeline();

    pipeline.registerValidator('first', (): ValidationIssue[] => [
      {
        code: ErrorCodes.INVALID_TRAIT_FORMAT,
        message: 'First validator failure',
        location: { file: 'test.yaml', path: '/' },
        fixHint: 'Fix the structure',
        severity: 'error',
      },
    ]);

    let secondInvocations = 0;
    pipeline.registerValidator('second', (): ValidationIssue[] => {
      secondInvocations += 1;
      return [];
    });

    const result = pipeline.validateAll(
      [
        () => pipeline.validateWithCustom('first', {}, {}),
        () => pipeline.validateWithCustom('second', {}, {}),
      ],
      { allErrors: false }
    );

    expect(result.summary.errors).toBe(1);
    expect(secondInvocations).toBe(0);
  });

  it('supports async validators', async () => {
    const pipeline = new ValidationPipeline();
    pipeline.registerAsyncValidator('async-check', async (): Promise<ValidationIssue[]> => [
      {
        code: ErrorCodes.INVALID_PARAMETER_VALUE,
        message: 'Async validator detected invalid value',
        location: { file: 'test.yaml', path: '/field' },
        fixHint: 'Adjust the parameter value',
        severity: 'warning',
      },
    ]);

    const result = await pipeline.validateWithCustomAsync('async-check', {}, {});
    expect(result.summary.warnings).toBe(1);
    expect(result.summary.errors).toBe(0);
  });

  it('validates composition layer with default validator', () => {
    const pipeline = new ValidationPipeline();
    const composed = buildValidComposedObject();

    const result = pipeline.validateComposition(composed);

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
    expect(pipeline.getCompositionValidator()).toBeDefined();
  });

  it('allows custom composition validator injection', () => {
    const composed = buildValidComposedObject();
    const stub = new CompositionValidator();
    const spy = vi.spyOn(stub, 'validate').mockReturnValue({
      valid: false,
      issues: [
        {
          code: ErrorCodes.PROPERTY_COLLISION,
          message: 'collision',
          location: { file: 'demo', path: '/' },
          fixHint: null,
          severity: 'error',
        },
      ],
      summary: { errors: 1, warnings: 0, info: 0 },
    });

    const pipeline = new ValidationPipeline({ compositionValidator: stub });
    const result = pipeline.validateComposition(composed);

    expect(spy).toHaveBeenCalledWith(composed, {});
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
  });

  it('integrates Zod schemas via validateWithZod', () => {
    const pipeline = new ValidationPipeline();
    const schema = z.object({
      size: z.number().max(10),
    });

    const result = pipeline.validateWithZod(schema, { size: 20 }, { filePath: 'traits/example.yaml' });
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
    expect(result.issues[0].code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
  });

  it('produces correct exit codes based on severity', () => {
    const pipeline = new ValidationPipeline();

    expect(
      pipeline.getExitCode({
        valid: true,
        issues: [],
        summary: { errors: 0, warnings: 0, info: 0 },
      })
    ).toBe(0);

    expect(
      pipeline.getExitCode({
        valid: true,
        issues: [
          {
            code: ErrorCodes.INVALID_PARAMETER_VALUE,
            message: 'Warning message',
            location: { file: 'test.yaml', path: '/' },
            fixHint: null,
            severity: 'warning',
          },
        ],
        summary: { errors: 0, warnings: 1, info: 0 },
      })
    ).toBe(2);

    expect(
      pipeline.getExitCode({
        valid: false,
        issues: [
          {
            code: ErrorCodes.INVALID_TRAIT_FORMAT,
            message: 'Fatal error',
            location: { file: 'test.yaml', path: '/' },
            fixHint: 'Fix issue',
            severity: 'error',
          },
        ],
        summary: { errors: 1, warnings: 0, info: 0 },
      })
    ).toBe(1);
  });
});
