/**
 * Text Reporter
 *
 * Outputs validation results in human-readable text format,
 * inspired by Rust compiler error messages.
 */

import type { ValidationResult, ValidationIssue } from '../types.js';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Format options for text output
 */
export interface TextFormatOptions {
  /** Whether to use color in output */
  color?: boolean;
  /** Whether to show fix hints */
  showHints?: boolean;
  /** Whether to show error codes */
  showCodes?: boolean;
  /** Whether to show details */
  showDetails?: boolean;
}

/**
 * Get the color for a severity level
 */
function getSeverityColor(severity: string, useColor: boolean): string {
  if (!useColor) return '';

  switch (severity) {
    case 'error':
      return colors.red;
    case 'warning':
      return colors.yellow;
    case 'info':
      return colors.blue;
    default:
      return colors.reset;
  }
}

/**
 * Get the label for a severity level
 */
function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'unknown';
  }
}

/**
 * Format a single validation issue as text
 */
function formatIssue(
  issue: ValidationIssue,
  options: TextFormatOptions
): string {
  const { color = true, showHints = true, showCodes = true, showDetails = false } = options;
  const lines: string[] = [];

  // Header line: [severity][code]: message
  const severityColor = getSeverityColor(issue.severity, color);
  const resetColor = color ? colors.reset : '';
  const boldColor = color ? colors.bold : '';
  const dimColor = color ? colors.dim : '';

  let header = '';
  header += `${severityColor}${getSeverityLabel(issue.severity)}${resetColor}`;

  if (showCodes) {
    header += `${dimColor}[${issue.code}]${resetColor}`;
  }

  header += `: ${boldColor}${issue.message}${resetColor}`;
  lines.push(header);

  // Location line
  const location = `  ${dimColor}-->${resetColor} ${issue.location.file}${issue.location.path}`;
  lines.push(location);

  // Details (optional)
  if (showDetails && issue.details) {
    lines.push(`  ${dimColor}${issue.details}${resetColor}`);
  }

  // Fix hint (optional)
  if (showHints && issue.fixHint) {
    const hintColor = color ? colors.cyan : '';
    lines.push(
      `  ${hintColor}hint${resetColor}: ${issue.fixHint}`
    );
  }

  return lines.join('\n');
}

/**
 * Format validation result as human-readable text
 */
export function formatAsText(
  result: ValidationResult,
  options: TextFormatOptions = {}
): string {
  const { color = true } = options;
  const lines: string[] = [];

  // Format each issue
  result.issues.forEach((issue, index) => {
    lines.push(formatIssue(issue, options));
    // Add blank line between issues (except after last one)
    if (index < result.issues.length - 1) {
      lines.push('');
    }
  });

  // Summary line
  if (result.issues.length > 0) {
    lines.push('');
    const summaryParts: string[] = [];

    if (result.summary.errors > 0) {
      const errorColor = color ? colors.red : '';
      const resetColor = color ? colors.reset : '';
      summaryParts.push(
        `${errorColor}${result.summary.errors} error${result.summary.errors !== 1 ? 's' : ''}${resetColor}`
      );
    }

    if (result.summary.warnings > 0) {
      const warningColor = color ? colors.yellow : '';
      const resetColor = color ? colors.reset : '';
      summaryParts.push(
        `${warningColor}${result.summary.warnings} warning${result.summary.warnings !== 1 ? 's' : ''}${resetColor}`
      );
    }

    if (result.summary.info > 0) {
      const infoColor = color ? colors.blue : '';
      const resetColor = color ? colors.reset : '';
      summaryParts.push(
        `${infoColor}${result.summary.info} info${resetColor}`
      );
    }

    lines.push(summaryParts.join(', '));
  } else {
    const successColor = color ? colors.blue : '';
    const resetColor = color ? colors.reset : '';
    lines.push(`${successColor}✓ Validation passed${resetColor}`);
  }

  return lines.join('\n');
}

/**
 * Format validation result as plain text (no colors)
 */
export function formatAsPlainText(
  result: ValidationResult,
  options: Omit<TextFormatOptions, 'color'> = {}
): string {
  return formatAsText(result, { ...options, color: false });
}
