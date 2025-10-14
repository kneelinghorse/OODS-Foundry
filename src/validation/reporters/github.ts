/**
 * GitHub Actions Reporter
 *
 * Outputs validation results in GitHub Actions annotation format.
 * See: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 */

import type { ValidationResult, ValidationIssue } from '../types.js';

/**
 * GitHub Actions annotation command format:
 * ::error file={name},line={line},col={col},endColumn={endColumn},title={title}::{message}
 */

/**
 * Escape special characters for GitHub Actions commands
 */
function escapeData(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

/**
 * Escape property values for GitHub Actions commands
 */
function escapeProperty(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

/**
 * Convert ValidationIssue severity to GitHub annotation type
 */
function getAnnotationType(severity: string): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'notice';
  }
}

/**
 * Format a single issue as a GitHub Actions annotation
 */
function formatIssueAsAnnotation(issue: ValidationIssue): string {
  const type = getAnnotationType(issue.severity);
  const properties: string[] = [];

  // File property
  if (issue.location.file) {
    properties.push(`file=${escapeProperty(issue.location.file)}`);
  }

  // Line property
  if (issue.location.line !== undefined) {
    properties.push(`line=${issue.location.line}`);
  }

  // Column property
  if (issue.location.column !== undefined) {
    properties.push(`col=${issue.location.column}`);
  }

  // Title includes error code
  const title = `${issue.code}: ${issue.message}`;
  properties.push(`title=${escapeProperty(title)}`);

  // Message includes fix hint if available
  let message = issue.message;
  if (issue.fixHint) {
    message += `\n\nFix hint: ${issue.fixHint}`;
  }
  if (issue.details) {
    message += `\n\nDetails: ${issue.details}`;
  }

  const propertiesStr = properties.length > 0 ? ` ${properties.join(',')}` : '';
  return `::${type}${propertiesStr}::${escapeData(message)}`;
}

/**
 * Format validation result as GitHub Actions annotations
 */
export function formatAsGitHubAnnotations(result: ValidationResult): string {
  const lines: string[] = [];

  // Output each issue as an annotation
  result.issues.forEach((issue) => {
    lines.push(formatIssueAsAnnotation(issue));
  });

  // Add summary
  if (result.summary.errors > 0 || result.summary.warnings > 0) {
    const summaryParts: string[] = [];
    if (result.summary.errors > 0) {
      summaryParts.push(
        `${result.summary.errors} error${result.summary.errors !== 1 ? 's' : ''}`
      );
    }
    if (result.summary.warnings > 0) {
      summaryParts.push(
        `${result.summary.warnings} warning${result.summary.warnings !== 1 ? 's' : ''}`
      );
    }
    lines.push(`::notice::Validation completed: ${summaryParts.join(', ')}`);
  } else {
    lines.push('::notice::Validation passed successfully');
  }

  return lines.join('\n');
}
