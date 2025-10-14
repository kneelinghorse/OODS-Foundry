import { performance } from 'node:perf_hooks';
import type { z } from 'zod';

import type { ComposedObject } from '../core/composed-object.js';
import { createCompositionSchema } from './composition-rules.js';
import { formatZodIssues } from './formatter.js';
import type {
  ValidationIssue,
  ValidationOptions,
  ValidationResult,
} from './types.js';

export interface CompositionValidatorOptions {
  /**
    * Soft performance budget in milliseconds. Validation runs exceeding this threshold
    * can be flagged by consumers via `getLastDurationMs()`.
    */
  performanceTargetMs?: number;
}

export type CompositionValidationOptions = ValidationOptions;

/**
 * CompositionValidator performs cross-trait validation using the Zod-based
 * rule engine defined in `composition-rules.ts`.
 */
export class CompositionValidator {
  private readonly schema: z.ZodType<ComposedObject>;
  private readonly performanceTarget: number;
  private lastDurationMs = 0;

  constructor(options: CompositionValidatorOptions = {}) {
    this.schema = createCompositionSchema();
    this.performanceTarget = options.performanceTargetMs ?? 50;
  }

  /**
   * Execute validation for a composed object.
   */
  validate(
    composed: ComposedObject,
    options: CompositionValidationOptions = {}
  ): ValidationResult {
    const start = performance.now();
    const parseResult = this.schema.safeParse(composed);
    this.lastDurationMs = performance.now() - start;

    const issues = parseResult.success
      ? []
      : formatZodIssues(parseResult.error.issues, options.filePath);

    return this.buildResult(issues, options);
  }

  /**
   * Retrieve the elapsed time for the most recent validation run.
   */
  getLastDurationMs(): number {
    return this.lastDurationMs;
  }

  /**
   * Soft-check against the configured performance budget.
   */
  isWithinPerformanceBudget(): boolean {
    return this.lastDurationMs <= this.performanceTarget;
  }

  private buildResult(
    issues: ValidationIssue[],
    options: CompositionValidationOptions
  ): ValidationResult {
    let filtered = issues;

    if (options.includeWarnings === false) {
      filtered = filtered.filter((issue) => issue.severity !== 'warning');
    }

    if (options.includeInfo === false) {
      filtered = filtered.filter((issue) => issue.severity !== 'info');
    }

    const summary = {
      errors: filtered.filter((issue) => issue.severity === 'error').length,
      warnings: filtered.filter((issue) => issue.severity === 'warning')
        .length,
      info: filtered.filter((issue) => issue.severity === 'info').length,
    };

    return {
      valid: summary.errors === 0,
      issues: filtered,
      summary,
    };
  }
}

/**
 * Convenience helper for one-off composition validation.
 */
export function validateComposition(
  composed: ComposedObject,
  options?: CompositionValidationOptions
): ValidationResult {
  const validator = new CompositionValidator();
  return validator.validate(composed, options);
}
