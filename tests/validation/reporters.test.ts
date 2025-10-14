/**
 * Tests for validation reporters.
 */

import { describe, expect, it } from 'vitest';

import {
  formatAsJson,
  formatAsGitHubAnnotations,
  formatAsText,
  ValidationResult,
  ErrorCodes,
} from '../../src/validation/index.js';

const sampleResult: ValidationResult = {
  valid: false,
  summary: {
    errors: 1,
    warnings: 1,
    info: 0,
  },
  issues: [
    {
      code: ErrorCodes.INVALID_TRAIT_FORMAT,
      message: 'Trait file must deserialize to an object',
      location: { file: 'traits/example.yaml', path: '/' },
      fixHint: 'Ensure the YAML file contains a top-level object',
      severity: 'error',
    },
    {
      code: ErrorCodes.INVALID_PARAMETER_VALUE,
      message: 'Parameters array is empty',
      location: { file: 'traits/example.yaml', path: '/parameters' },
      fixHint: 'Add at least one parameter definition or remove the section',
      severity: 'warning',
    },
  ],
};

describe('formatAsJson', () => {
  it('returns pretty JSON by default', () => {
    const json = formatAsJson(sampleResult);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain('"errors": 1');
  });
});

describe('formatAsText', () => {
  it('produces readable text output with hints', () => {
    const text = formatAsText(sampleResult, {
      color: false,
      showHints: true,
      showCodes: true,
      showDetails: false,
    });

    expect(text).toContain('error');
    expect(text).toContain('[TE-0101]');
    expect(text).toContain('hint');
    expect(text).toContain('1 error');
    expect(text).toContain('1 warning');
  });
});

describe('formatAsGitHubAnnotations', () => {
  it('renders GitHub Actions commands for each issue', () => {
    const output = formatAsGitHubAnnotations(sampleResult);
    expect(output).toContain('::error');
    expect(output).toContain('::warning');
    expect(output).toContain('::notice::Validation completed');
  });
});
