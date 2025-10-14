/**
 * Validation Pipeline
 *
 * Orchestrates validation across multiple layers:
 * - Layer 2: Parameter validation (AJV)
 * - Layer 3: Composition validation (Zod)
 *
 * Provides both synchronous (CI) and asynchronous (runtime) validation modes.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ZodSchema } from 'zod';
import type { ComposedObject } from '../core/composed-object.js';
import {
  ValidationResult,
  ValidationOptions,
  ValidationIssue,
} from './types.js';
import {
  formatAjvErrors,
  formatZodIssues,
  createCompositionIssue,
} from './formatter.js';
import {
  CompositionValidator,
  type CompositionValidationOptions,
  type CompositionValidatorOptions,
} from './composition-validator.js';

/**
 * Validation pipeline configuration
 */
export interface PipelineConfig {
  /** Whether to stop on first error or collect all errors */
  allErrors?: boolean;
  /** Whether to remove additional properties not defined in schema */
  removeAdditional?: boolean;
  /** Whether to coerce types (e.g., "123" -> 123) */
  coerceTypes?: boolean;
  /** Optional composition validator instance or options */
  compositionValidator?: CompositionValidator | CompositionValidatorOptions;
}

/**
 * Validator function type for custom validators
 */
export type Validator<T = unknown> = (
  data: T,
  filePath?: string
) => ValidationIssue[];

/**
 * Async validator function type
 */
export type AsyncValidator<T = unknown> = (
  data: T,
  filePath?: string
) => Promise<ValidationIssue[]>;

/**
 * Validation Pipeline
 *
 * Coordinates validation across multiple validators and produces a
 * standardized ValidationResult.
 */
export class ValidationPipeline {
  private ajv: Ajv;
  private validators: Map<string, Validator> = new Map();
  private asyncValidators: Map<string, AsyncValidator> = new Map();
  private compositionValidator?: CompositionValidator;

  constructor(config: PipelineConfig = {}) {
    this.ajv = new Ajv({
      allErrors: config.allErrors ?? true,
      removeAdditional: config.removeAdditional ?? false,
      coerceTypes: config.coerceTypes ?? false,
      strict: true,
    });

    addFormats(this.ajv);

    if (config.compositionValidator instanceof CompositionValidator) {
      this.compositionValidator = config.compositionValidator;
    } else if (config.compositionValidator) {
      this.compositionValidator = new CompositionValidator(
        config.compositionValidator
      );
    }
  }

  /**
   * Register an AJV JSON Schema validator
   */
  registerSchema(name: string, schema: object): void {
    this.ajv.addSchema(schema, name);
  }

  /**
   * Register a custom synchronous validator
   */
  registerValidator(name: string, validator: Validator): void {
    this.validators.set(name, validator);
  }

  /**
   * Register a custom asynchronous validator
   */
  registerAsyncValidator(name: string, validator: AsyncValidator): void {
    this.asyncValidators.set(name, validator);
  }

  /**
   * Validate data against an AJV schema
   */
  validateWithSchema(
    schemaName: string,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult {
    const validate = this.ajv.getSchema(schemaName);

    if (!validate) {
      return this.createErrorResult([
        createCompositionIssue(
          'TE-0101',
          `Schema '${schemaName}' not found`,
          '/',
          options.filePath,
          `Register the schema '${schemaName}' before validation`,
          'error',
          { domain: 'infrastructure', source: 'pipeline' }
        ),
      ]);
    }

    const valid = validate(data);
    const issues = valid
      ? []
      : formatAjvErrors(validate.errors, options.filePath);

    return this.createResult(issues, options);
  }

  /**
   * Validate data with a Zod schema
   */
  validateWithZod<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult {
    const result = schema.safeParse(data);

    if (result.success) {
      return this.createSuccessResult();
    }

    const issues = formatZodIssues(result.error.issues, options.filePath);
    return this.createResult(issues, options);
  }

  /**
   * Validate data with a custom validator
   */
  validateWithCustom(
    validatorName: string,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult {
    const validator = this.validators.get(validatorName);

    if (!validator) {
      return this.createErrorResult([
        createCompositionIssue(
          'TE-0101',
          `Validator '${validatorName}' not found`,
          '/',
          options.filePath,
          `Register the validator '${validatorName}' before use`,
          'error',
          { domain: 'infrastructure', source: 'pipeline' }
        ),
      ]);
    }

    const issues = validator(data, options.filePath);
    return this.createResult(issues, options);
  }

  /**
   * Validate data with an async validator
   */
  async validateWithCustomAsync(
    validatorName: string,
    data: unknown,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const validator = this.asyncValidators.get(validatorName);

    if (!validator) {
      return this.createErrorResult([
        createCompositionIssue(
          'TE-0101',
          `Async validator '${validatorName}' not found`,
          '/',
          options.filePath,
          `Register the async validator '${validatorName}' before use`,
          'error',
          { domain: 'infrastructure', source: 'pipeline' }
        ),
      ]);
    }

    const issues = await validator(data, options.filePath);
    return this.createResult(issues, options);
  }

  /**
   * Provide a custom composition validator implementation.
   */
  useCompositionValidator(validator: CompositionValidator): void {
    this.compositionValidator = validator;
  }

  /**
   * Validate a composed object using the composition layer.
   */
  validateComposition(
    composed: ComposedObject,
    options: CompositionValidationOptions = {}
  ): ValidationResult {
    if (!this.compositionValidator) {
      this.compositionValidator = new CompositionValidator();
    }

    return this.compositionValidator.validate(composed, options);
  }

  /**
   * Access the underlying composition validator.
   */
  getCompositionValidator(): CompositionValidator | undefined {
    return this.compositionValidator;
  }

  /**
   * Run multiple validators in sequence and combine results
   */
  validateAll(
    validators: Array<() => ValidationResult>,
    options: ValidationOptions = {}
  ): ValidationResult {
    const allIssues: ValidationIssue[] = [];

    for (const validate of validators) {
      const result = validate();
      allIssues.push(...result.issues);

      // Stop on first error if allErrors is false
      if (!options.allErrors && result.issues.some((i) => i.severity === 'error')) {
        break;
      }
    }

    return this.createResult(allIssues, options);
  }

  /**
   * Run multiple async validators in parallel and combine results
   */
  async validateAllAsync(
    validators: Array<() => Promise<ValidationResult>>,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const results = await Promise.all(validators.map((v) => v()));
    const allIssues = results.flatMap((r) => r.issues);
    return this.createResult(allIssues, options);
  }

  /**
   * Create a ValidationResult from issues
   */
  private createResult(
    issues: ValidationIssue[],
    options: ValidationOptions
  ): ValidationResult {
    // Filter issues based on options
    let filteredIssues = issues;

    if (options.includeWarnings === false) {
      filteredIssues = filteredIssues.filter((i) => i.severity !== 'warning');
    }

    if (options.includeInfo === false) {
      filteredIssues = filteredIssues.filter((i) => i.severity !== 'info');
    }

    // Calculate summary
    const summary = {
      errors: filteredIssues.filter((i) => i.severity === 'error').length,
      warnings: filteredIssues.filter((i) => i.severity === 'warning').length,
      info: filteredIssues.filter((i) => i.severity === 'info').length,
    };

    return {
      valid: summary.errors === 0,
      issues: filteredIssues,
      summary,
    };
  }

  /**
   * Create a success result
   */
  private createSuccessResult(): ValidationResult {
    return {
      valid: true,
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(issues: ValidationIssue[]): ValidationResult {
    return {
      valid: false,
      issues,
      summary: {
        errors: issues.filter((i) => i.severity === 'error').length,
        warnings: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length,
      },
    };
  }

  /**
   * Get CI exit code based on validation result
   *
   * - 0: Success (no errors)
   * - 1: Errors found
   * - 2: Warnings only (no errors)
   */
  getExitCode(result: ValidationResult): number {
    if (result.summary.errors > 0) {
      return 1;
    }
    if (result.summary.warnings > 0) {
      return 2;
    }
    return 0;
  }
}

/**
 * Create a default validation pipeline instance
 */
export function createPipeline(config?: PipelineConfig): ValidationPipeline {
  return new ValidationPipeline(config);
}
