import { performance } from 'node:perf_hooks';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ErrorCodes,
  ParameterValidator,
  validateTraitParametersAsync,
} from '../../src/validation/index.js';

describe('ParameterValidator', () => {
  let validator: ParameterValidator;

  beforeEach(() => {
    validator = new ParameterValidator();
  });

  it('validates parameter contracts for core traits', () => {
    const stateful = validator.validate('Stateful', {
      states: ['draft', 'active', 'archived'],
      initialState: 'draft',
    });
    expect(stateful.valid).toBe(true);

    const colorized = validator.validate('Colorized', {
      colorStates: ['neutral', 'info', 'success'],
    });
    expect(colorized.valid).toBe(true);

    const taggable = validator.validate('Taggable', {
      maxTags: 8,
      allowCustomTags: false,
      allowedTags: ['priority', 'design', 'finance'],
    });
    expect(taggable.valid).toBe(true);
  });

  it('provides actionable errors for invalid configurations', () => {
    const result = validator.validate(
      'Colorized',
      {
        colorStates: ['neutral', 'neutral'],
      },
      { filePath: 'traits/colorized.yaml' }
    );

    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
    const issue = result.issues[0];
    expect(issue.code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
    expect(issue.location.file).toBe('traits/colorized.yaml');
    expect(issue.message).toContain('Each color state must be unique');
    expect(issue.fixHint).toContain('Provide unique colorStates entries');
    expect(issue.related).toContain('Colorized');
  });

  it('returns a clear error when a schema is missing', () => {
    const result = validator.validate('NonExistentTrait', {});
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
    const issue = result.issues[0];
    expect(issue.code).toBe(ErrorCodes.INVALID_TRAIT_FORMAT);
    expect(issue.message).toContain('Parameter schema for trait "NonExistentTrait" was not found.');
  });

  it('caches compiled validators to avoid recompilation', () => {
    expect(validator.getCachedValidatorCount()).toBe(0);
    validator.validate('Stateful', {
      states: ['draft', 'active'],
      initialState: 'draft',
    });
    expect(validator.getCachedValidatorCount()).toBe(1);

    validator.validate('Stateful', {
      states: ['draft', 'active'],
      initialState: 'active',
    });
    expect(validator.getCachedValidatorCount()).toBe(1);

    validator.validate('Taggable', {
      maxTags: 5,
      allowCustomTags: true,
    });
    expect(validator.getCachedValidatorCount()).toBe(2);
  });

  it('meets the 20ms performance target for cached validators', () => {
    const params = {
      maxTags: 10,
      allowCustomTags: true,
    };

    // Warm up to compile and cache the schema.
    validator.validate('Taggable', params);

    const start = performance.now();
    for (let i = 0; i < 100; i += 1) {
      const result = validator.validate('Taggable', params);
      if (!result.valid) {
        throw new Error('Unexpected validation failure during performance test');
      }
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
  });

  it('supports asynchronous validation workflow', async () => {
    const result = await validator.validateAsync('Archivable', {
      gracePeriodDays: 14,
      retainHistory: true,
      restoreWindowDays: 30,
    });

    expect(result.valid).toBe(true);
    expect(validator.getCachedValidatorCount()).toBe(1);

    const asyncInvalid = await validateTraitParametersAsync('Cancellable', {
      requireReason: true,
    });

    expect(asyncInvalid.valid).toBe(false);
    expect(asyncInvalid.summary.errors).toBe(2);
    expect(asyncInvalid.issues[0].code).toBe(ErrorCodes.MISSING_REQUIRED_PARAMETER);
  });
});
