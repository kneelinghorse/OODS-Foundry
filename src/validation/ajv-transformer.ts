/**
 * AJV Transformer
 *
 * Bridges raw AJV validation errors to the shared ValidationIssue format with
 * trait-aware enhancements and fix hints.
 */

import type { ErrorObject } from 'ajv';
import { formatAjvError } from './formatter.js';
import type { ValidationIssue } from './types.js';

export interface AjvTransformOptions {
  /** Path of the file being validated (for diagnostics) */
  filePath?: string;
  /** Human-readable trait name for context (e.g., Stateful) */
  traitName?: string;
}

/**
 * Enhances base ValidationIssue objects with trait-aware hints.
 */
function enhanceIssue(
  issue: ValidationIssue,
  error: ErrorObject,
  options: AjvTransformOptions
): ValidationIssue {
  const params = error.params as Record<string, unknown> | undefined;
  const missingProperty =
    typeof params?.missingProperty === 'string' ? (params.missingProperty as string) : undefined;

  const traits = options.traitName ? [options.traitName] : undefined;
  const related = issue.related
    ? options.traitName
      ? Array.from(new Set([...issue.related, options.traitName]))
      : issue.related
    : traits;

  const enhanced: ValidationIssue = {
    ...issue,
    related,
  };

  if (options.traitName === 'Stateful' && error.keyword === 'enum') {
    return {
      ...enhanced,
      message: 'Initial state must match one of the declared states.',
      fixHint:
        enhanced.fixHint ??
        'Add the initialState value to the states array or adjust initialState.',
    };
  }

  if (options.traitName === 'Colorized' && error.keyword === 'uniqueItems') {
    return {
      ...enhanced,
      message: 'Each color state must be unique.',
      fixHint: 'Provide unique colorStates entries or remove duplicates.',
    };
  }

  if (options.traitName === 'Taggable' && error.keyword === 'if') {
    return {
      ...enhanced,
      message: 'Configuration for allowCustomTags is invalid.',
      fixHint:
        enhanced.fixHint ??
        'When allowCustomTags is false, provide an allowedTags array.',
    };
  }

  if (
    options.traitName === 'Taggable' &&
    error.keyword === 'required' &&
    missingProperty === 'allowedTags'
  ) {
    return {
      ...enhanced,
      message: 'Configuration for allowCustomTags is invalid.',
      fixHint:
        enhanced.fixHint ??
        'When allowCustomTags is false, provide an allowedTags array.',
    };
  }

  if (options.traitName === 'Archivable' && error.keyword === 'else') {
    return {
      ...enhanced,
      message: 'restoreWindowDays is not allowed when retainHistory is false.',
      fixHint:
        enhanced.fixHint ??
        'Remove restoreWindowDays or set retainHistory to true.',
    };
  }

  if (options.traitName === 'Archivable' && error.keyword === 'not') {
    return {
      ...enhanced,
      message: 'restoreWindowDays is not allowed when retainHistory is false.',
      fixHint:
        enhanced.fixHint ??
        'Remove restoreWindowDays or set retainHistory to true.',
    };
  }

  if (options.traitName === 'Cancellable' && error.keyword === 'if') {
    return {
      ...enhanced,
      message: 'Cancellation reason configuration is incomplete.',
      fixHint:
        enhanced.fixHint ??
        'Provide a non-empty allowedReasons array when requireReason is true.',
    };
  }

  if (
    options.traitName === 'Cancellable' &&
    error.keyword === 'required' &&
    missingProperty === 'allowedReasons'
  ) {
    return {
      ...enhanced,
      message: 'Cancellation reason configuration is incomplete.',
      fixHint:
        enhanced.fixHint ??
        'Provide a non-empty allowedReasons array when requireReason is true.',
    };
  }

  return enhanced;
}

/**
 * Converts AJV errors into ValidationIssue objects using existing formatter logic.
 */
export function transformAjvErrors(
  errors: ErrorObject[] | null | undefined,
  options: AjvTransformOptions = {}
): ValidationIssue[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) =>
    enhanceIssue(formatAjvError(error, options.filePath), error, options)
  );
}
