/**
 * JSON Reporter
 *
 * Outputs validation results in JSON format for programmatic consumption.
 */

import type { ValidationResult, ValidationIssue } from '../types.js';

/**
 * JSON report format
 */
export interface JsonReport {
  valid: boolean;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: ValidationIssue[];
}

/**
 * Generate a JSON report from validation results
 */
export function generateJsonReport(result: ValidationResult): JsonReport {
  return {
    valid: result.valid,
    summary: result.summary,
    issues: result.issues,
  };
}

/**
 * Format validation result as JSON string
 */
export function formatAsJson(result: ValidationResult, pretty = true): string {
  const report = generateJsonReport(result);
  return JSON.stringify(report, null, pretty ? 2 : 0);
}
