/**
 * Parameter Validator
 *
 * Provides synchronous and asynchronous APIs for validating trait parameters
 * against JSON Schema definitions powered by AJV. Compiled validators are
 * cached for performance-critical CI workflows.
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import type {
  ValidationIssue,
  ValidationOptions,
  ValidationResult,
} from './types.js';
import { ErrorCodes } from './types.js';
import { SchemaLoader, normalizeTraitName } from './schema-loader.js';
import { transformAjvErrors } from './ajv-transformer.js';

export interface ParameterValidatorOptions {
  /** Override schema directory (defaults to `<cwd>/schemas/traits`) */
  schemaDir?: string;
  /** Supply a pre-configured AJV instance (mostly for testing) */
  ajvInstance?: Ajv;
}

export interface ParameterValidationOptions extends ValidationOptions {
  /** Optional override for trait name when reporting issues */
  traitLabel?: string;
}

export class ParameterValidator {
  private readonly ajv: Ajv;
  private readonly loader: SchemaLoader;
  private readonly validatorCache = new Map<string, ValidateFunction>();
  private readonly pendingCompilations = new Map<string, Promise<ValidateFunction>>();

  constructor(options: ParameterValidatorOptions = {}) {
    this.ajv =
      options.ajvInstance ??
      new Ajv({
        strict: false,
        allErrors: true,
        allowUnionTypes: true,
        $data: true,
      });

    if (!options.ajvInstance) {
      addFormats(this.ajv);
    }

    this.loader = new SchemaLoader({ schemaDir: options.schemaDir });
  }

  /**
   * Validate parameters synchronously.
   */
  validate(
    traitName: string,
    parameters: unknown,
    options: ParameterValidationOptions = {}
  ): ValidationResult {
    let validator: ValidateFunction;

    try {
      validator = this.ensureValidatorSync(traitName);
    } catch (error) {
      return this.schemaMissingResult(traitName, error, options);
    }

    const valid = validator(parameters);
    const issues = valid
      ? []
      : transformAjvErrors(validator.errors, {
          filePath: options.filePath,
          traitName: options.traitLabel ?? traitName,
        });

    return this.buildResult(issues, options);
  }

  /**
   * Validate parameters asynchronously.
   */
  async validateAsync(
    traitName: string,
    parameters: unknown,
    options: ParameterValidationOptions = {}
  ): Promise<ValidationResult> {
    let validator: ValidateFunction;

    try {
      validator = await this.ensureValidatorAsync(traitName);
    } catch (error) {
      return this.schemaMissingResult(traitName, error, options);
    }

    const valid = validator(parameters);
    const issues = valid
      ? []
      : transformAjvErrors(validator.errors, {
          filePath: options.filePath,
          traitName: options.traitLabel ?? traitName,
        });

    return this.buildResult(issues, options);
  }

  /**
   * Returns the number of cached validators (used for testing / diagnostics).
   */
  getCachedValidatorCount(): number {
    return this.validatorCache.size;
  }

  /**
   * Clears compiled validator cache (useful when schemas change during tests).
   */
  clearCache(): void {
    this.validatorCache.clear();
    this.loader.clearCache();
  }

  private ensureValidatorSync(traitName: string): ValidateFunction {
    const key = normalizeTraitName(traitName);
    const cached = this.validatorCache.get(key);
    if (cached) {
      return cached;
    }

    const schema = this.loader.loadSync(traitName);
    return this.compileSchema(key, schema);
  }

  private async ensureValidatorAsync(traitName: string): Promise<ValidateFunction> {
    const key = normalizeTraitName(traitName);
    const cached = this.validatorCache.get(key);
    if (cached) {
      return cached;
    }

    const pending = this.pendingCompilations.get(key);
    if (pending) {
      return pending;
    }

    const loadPromise = this.loader
      .load(traitName)
      .then((schema) => this.compileSchema(key, schema))
      .finally(() => {
        this.pendingCompilations.delete(key);
      });

    this.pendingCompilations.set(key, loadPromise);
    return loadPromise;
  }

  private compileSchema(
    cacheKey: string,
    schema: Record<string, unknown>
  ): ValidateFunction {
    const validate = this.ajv.compile(schema);
    this.validatorCache.set(cacheKey, validate);
    return validate;
  }

  private schemaMissingResult(
    traitName: string,
    error: unknown,
    options: ParameterValidationOptions
  ): ValidationResult {
    const issue: ValidationIssue = {
      code: ErrorCodes.INVALID_TRAIT_FORMAT,
      message: `Parameter schema for trait "${traitName}" was not found.`,
      location: {
        file: options.filePath ?? traitName,
        path: '/',
      },
      fixHint: `Add a schema file for '${traitName}' under schemas/traits or correct the trait name.`,
      severity: 'error',
      details: error instanceof Error ? error.message : String(error),
      source: 'ajv',
      domain: 'infrastructure',
      related: [traitName],
    };

    return this.buildResult([issue], options);
  }

  private buildResult(
    issues: ValidationIssue[],
    options: ParameterValidationOptions
  ): ValidationResult {
    let filtered = issues;

    if (!options.includeWarnings) {
      filtered = filtered.filter((issue) => issue.severity !== 'warning');
    }

    if (!options.includeInfo) {
      filtered = filtered.filter((issue) => issue.severity !== 'info');
    }

    const summary = {
      errors: filtered.filter((issue) => issue.severity === 'error').length,
      warnings: filtered.filter((issue) => issue.severity === 'warning').length,
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
 * Convenience singleton for callers that do not need their own instance.
 */
const defaultValidator = new ParameterValidator();

export function validateTraitParameters(
  traitName: string,
  parameters: unknown,
  options: ParameterValidationOptions = {}
): ValidationResult {
  return defaultValidator.validate(traitName, parameters, options);
}

export async function validateTraitParametersAsync(
  traitName: string,
  parameters: unknown,
  options: ParameterValidationOptions = {}
): Promise<ValidationResult> {
  return defaultValidator.validateAsync(traitName, parameters, options);
}
