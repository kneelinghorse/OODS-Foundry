/**
 * Error Formatter
 *
 * Transforms raw validation errors from AJV and Zod into standardized
 * ValidationIssue payloads with error codes, actionable fix hints, and
 * precise location information.
 */

import type { ErrorObject } from 'ajv';
import type { ZodIssue } from 'zod';
import {
  ValidationIssue,
  ValidationLocation,
  ValidationSeverity,
  ErrorCodes,
} from './types.js';

/**
 * Maps AJV error keywords to error codes and generates fix hints
 */
const AJV_ERROR_MAP: Record<
  string,
  {
    code: string;
    generateMessage: (error: ErrorObject) => string;
    generateHint: (error: ErrorObject) => string | null;
  }
> = {
  required: {
    code: ErrorCodes.MISSING_REQUIRED_PARAMETER,
    generateMessage: (error) =>
      `Missing required property '${error.params.missingProperty}'`,
    generateHint: (error) =>
      `Add the required '${error.params.missingProperty}' property to the parameters object`,
  },
  type: {
    code: ErrorCodes.INVALID_PARAMETER_TYPE,
    generateMessage: (error) =>
      `Invalid type: expected ${error.params.type}, received ${typeof error.data}`,
    generateHint: (error) =>
      `Change the value to type '${error.params.type}'`,
  },
  additionalProperties: {
    code: ErrorCodes.UNKNOWN_PARAMETER,
    generateMessage: (error) =>
      `Unknown property '${error.params.additionalProperty}'`,
    generateHint: (error) =>
      `Remove '${error.params.additionalProperty}' or check if it's a typo`,
  },
  enum: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value must be one of: ${error.params.allowedValues.join(', ')}`,
    generateHint: (error) =>
      `Use one of the allowed values: ${error.params.allowedValues.join(', ')}`,
  },
  minLength: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `String must be at least ${error.params.limit} characters`,
    generateHint: (error) =>
      `Provide a value with at least ${error.params.limit} characters`,
  },
  maxLength: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `String must not exceed ${error.params.limit} characters`,
    generateHint: (error) =>
      `Shorten the value to ${error.params.limit} characters or less`,
  },
  minimum: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value must be >= ${error.params.limit}`,
    generateHint: (error) =>
      `Increase the value to at least ${error.params.limit}`,
  },
  maximum: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value must be <= ${error.params.limit}`,
    generateHint: (error) =>
      `Decrease the value to at most ${error.params.limit}`,
  },
  pattern: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value does not match required pattern: ${error.params.pattern}`,
    generateHint: (error) =>
      `Ensure the value matches the pattern: ${error.params.pattern}`,
  },
  minItems: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Array must contain at least ${error.params.limit} item(s)`,
    generateHint: (error) =>
      `Add more items until the array has at least ${error.params.limit} element(s)`,
  },
  maxItems: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Array must not contain more than ${error.params.limit} item(s)`,
    generateHint: (error) =>
      `Remove items so the array has at most ${error.params.limit} element(s)`,
  },
  uniqueItems: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Array items must be unique (duplicate at index ${error.params.j})`,
    generateHint: () =>
      'Ensure every array item is unique or remove duplicates',
  },
  minProperties: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Object must define at least ${error.params.limit} propert${error.params.limit === 1 ? 'y' : 'ies'}`,
    generateHint: (error) =>
      `Add more properties until there are ${error.params.limit} defined`,
  },
  maxProperties: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Object must not define more than ${error.params.limit} propert${error.params.limit === 1 ? 'y' : 'ies'}`,
    generateHint: (error) =>
      `Remove properties until there are no more than ${error.params.limit} defined`,
  },
  format: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value must match format '${error.params.format}'`,
    generateHint: (error) =>
      `Update the value to satisfy the '${error.params.format}' format`,
  },
  multipleOf: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (error) =>
      `Value must be a multiple of ${error.params.multipleOf}`,
    generateHint: (error) =>
      `Adjust the value so it is divisible by ${error.params.multipleOf}`,
  },
};

/**
 * Maps Zod error codes to ValidationIssue codes and generates fix hints
 */
const ZOD_ERROR_MAP: Record<
  string,
  {
    code: string;
    generateMessage: (issue: ZodIssue) => string;
    generateHint: (issue: ZodIssue) => string | null;
  }
> = {
  invalid_type: {
    code: ErrorCodes.INVALID_PARAMETER_TYPE,
    generateMessage: (issue) => {
      if ('expected' in issue && 'received' in issue) {
        return `Invalid type: expected ${issue.expected}, received ${issue.received}`;
      }
      return issue.message || 'Invalid type';
    },
    generateHint: (issue) => {
      if ('expected' in issue) {
        return `Change the value to type '${issue.expected}'`;
      }
      return null;
    },
  },
  invalid_literal: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (issue) => issue.message || 'Invalid literal value',
    generateHint: (issue) => {
      if ('expected' in issue) {
        return `Use the exact value: ${issue.expected}`;
      }
      return null;
    },
  },
  unrecognized_keys: {
    code: ErrorCodes.UNKNOWN_PARAMETER,
    generateMessage: (issue) => {
      if ('keys' in issue && Array.isArray(issue.keys)) {
        const keys = (issue.keys as PropertyKey[]).map(k => String(k));
        return `Unrecognized key(s): ${keys.join(', ')}`;
      }
      return issue.message || 'Unrecognized keys';
    },
    generateHint: (issue) => {
      if ('keys' in issue && Array.isArray(issue.keys)) {
        const keys = (issue.keys as PropertyKey[]).map(k => String(k));
        return `Remove the following keys: ${keys.join(', ')}`;
      }
      return null;
    },
  },
  invalid_union: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (issue) =>
      issue.message || 'Value does not match any of the expected types',
    generateHint: () => 'Check the allowed types and provide a valid value',
  },
  too_small: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (issue) => {
      if ('minimum' in issue && 'type' in issue) {
        return `${issue.type} must be at least ${issue.minimum}`;
      }
      return issue.message || 'Value too small';
    },
    generateHint: (issue) => {
      if ('minimum' in issue) {
        const noun =
          'type' in issue && typeof issue.type === 'string'
            ? issue.type
            : 'value';
        return `Increase the ${noun} to at least ${issue.minimum}`;
      }
      return 'Increase the value to meet the minimum requirement';
    },
  },
  too_big: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (issue) => {
      if ('maximum' in issue && 'type' in issue) {
        return `${issue.type} must be at most ${issue.maximum}`;
      }
      return issue.message || 'Value too big';
    },
    generateHint: (issue) => {
      if ('maximum' in issue) {
        const noun =
          'type' in issue && typeof issue.type === 'string'
            ? issue.type
            : 'value';
        return `Decrease the ${noun} to at most ${issue.maximum}`;
      }
      return 'Decrease the value to satisfy the maximum constraint';
    },
  },
  custom: {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (issue) => issue.message || 'Custom validation failed',
    generateHint: (issue) => {
      // Custom errors from .superRefine() should include their own hints
      return 'params' in issue && typeof issue.params === 'object' && issue.params !== null && 'hint' in issue.params
        ? String(issue.params.hint)
        : null;
    },
  },
};

/**
 * Resolve severity override values into a ValidationSeverity
 */
function resolveSeverity(value: unknown): ValidationSeverity {
  if (value === 'warning' || value === 'info' || value === 'error') {
    return value;
  }
  return 'error';
}

/**
 * Converts an AJV instancePath to a JSON Pointer
 */
function normalizeAjvPath(instancePath: string): string {
  // AJV uses JSON Pointer format already (e.g., "/parameters/initialState")
  return instancePath || '/';
}

/**
 * Converts a Zod path array to a JSON Pointer
 */
function normalizeZodPath(path: (string | number | symbol)[]): string {
  if (path.length === 0) return '/';
  return '/' + path.map(p => String(p)).join('/');
}

/**
 * Transforms an AJV error into a ValidationIssue
 */
export function formatAjvError(
  error: ErrorObject,
  filePath: string = 'unknown'
): ValidationIssue {
  const mapping = AJV_ERROR_MAP[error.keyword] || {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (e: ErrorObject) => e.message || 'Validation failed',
    generateHint: () => null,
  };

  const location: ValidationLocation = {
    file: filePath,
    path: normalizeAjvPath(error.instancePath),
  };

  const severityOverride =
    typeof error.params === 'object' && error.params !== null
      ? (error.params as { severity?: ValidationSeverity }).severity
      : undefined;

  return {
    code: mapping.code,
    message: mapping.generateMessage(error),
    location,
    fixHint: mapping.generateHint(error),
    severity: resolveSeverity(severityOverride),
    details: error.schemaPath,
    source: 'ajv',
    domain: 'parameters',
    at: error.schemaPath,
  };
}

/**
 * Transforms a Zod issue into a ValidationIssue
 */
export function formatZodIssue(
  issue: ZodIssue,
  filePath: string = 'unknown'
): ValidationIssue {
  const mapping = ZOD_ERROR_MAP[issue.code] || {
    code: ErrorCodes.INVALID_PARAMETER_VALUE,
    generateMessage: (i: ZodIssue) => i.message || 'Validation failed',
    generateHint: () => null,
  };

  const location: ValidationLocation = {
    file: filePath,
    path: normalizeZodPath(issue.path),
  };

  const params =
    'params' in issue && typeof issue.params === 'object' && issue.params !== null
      ? (issue.params as Record<string, unknown>)
      : undefined;

  // Determine severity based on issue code or custom params
  let severity: ValidationSeverity = 'error';
  if (params && typeof params.severity === 'string') {
    severity = resolveSeverity(params.severity);
  }

  // Allow custom error codes and hints via params
  let code = mapping.code;
  if (params && typeof params.code === 'string') {
    code = params.code;
  }

  let fixHint = mapping.generateHint(issue);
  if (params && typeof params.hint === 'string') {
    fixHint = params.hint;
  } else if (params && params.hint === null) {
    fixHint = null;
  }

  const domain =
    params && typeof params.domain === 'string'
      ? params.domain
      : 'composition';

  const source =
    params && typeof params.source === 'string'
      ? params.source
      : 'zod';

  const docsUrl =
    params && typeof params.docsUrl === 'string'
      ? params.docsUrl
      : undefined;

  const related =
    params && Array.isArray(params.related)
      ? params.related.map((value) => String(value))
      : undefined;

  const traitPath =
    params && Array.isArray(params.traitPath)
      ? params.traitPath.map((value) => String(value))
      : undefined;

  const impactedTraits =
    params && Array.isArray(params.impactedTraits)
      ? params.impactedTraits.map((value) => String(value))
      : undefined;

  return {
    code,
    message: mapping.generateMessage(issue),
    location,
    fixHint,
    severity,
    source,
    domain,
    docsUrl,
    related,
    at: issue.path.length ? issue.path.join('.') : undefined,
    traitPath,
    impactedTraits,
  };
}

/**
 * Formats a batch of AJV errors
 */
export function formatAjvErrors(
  errors: ErrorObject[] | null | undefined,
  filePath?: string
): ValidationIssue[] {
  if (!errors) return [];
  return errors.map((error) => formatAjvError(error, filePath));
}

/**
 * Formats a batch of Zod issues
 */
export function formatZodIssues(
  issues: ZodIssue[],
  filePath?: string
): ValidationIssue[] {
  return issues.map((issue) => formatZodIssue(issue, filePath));
}

/**
 * Creates a custom ValidationIssue for composition errors
 */
export function createCompositionIssue(
  code: string,
  message: string,
  path: string,
  filePath: string = 'unknown',
  fixHint: string | null = null,
  severity: ValidationSeverity = 'error',
  extras: Partial<Pick<ValidationIssue, 'domain' | 'source' | 'docsUrl' | 'related' | 'details' | 'traitPath' | 'impactedTraits'>> = {}
): ValidationIssue {
  return {
    code,
    message,
    location: {
      file: filePath,
      path,
    },
    fixHint,
    severity,
    domain: extras.domain ?? 'composition',
    source: extras.source ?? 'custom',
    docsUrl: extras.docsUrl,
    related: extras.related,
    details: extras.details,
    traitPath: extras.traitPath,
    impactedTraits: extras.impactedTraits,
  };
}
