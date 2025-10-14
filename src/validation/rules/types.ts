import type { ValidationSeverity, ErrorCode } from '../types.js';

/**
 * Normalized issue format returned by composition rules.
 */
export interface RuleIssue {
  code: ErrorCode | string;
  message: string;
  path: (string | number)[];
  hint?: string | null;
  severity?: ValidationSeverity;
  related?: string[];
  docsUrl?: string;
}

/**
 * Shared signature for composition validation rules.
 */
export type RuleValidator<T> = (data: T) => RuleIssue[];
