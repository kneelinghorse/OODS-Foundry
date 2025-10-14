/**
 * Tests for the validation CLI helper.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { validateTraits } from '../../src/cli/validate.js';
import { ErrorCodes } from '../../src/validation/index.js';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'validation-cli-'));
}

function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe('validateTraits CLI helper', () => {
  it('returns info issue when directory contains no trait files', () => {
    const dir = createTempDir();

    try {
      const result = validateTraits({ path: dir });
      expect(result.valid).toBe(true);
      expect(result.summary.info).toBe(1);
      expect(result.issues[0].code).toBe(ErrorCodes.NO_TRAIT_FILES);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('returns error when directory does not exist', () => {
    const dir = join(tmpdir(), `validation-missing-${Date.now()}`);

    const result = validateTraits({ path: dir });
    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBe(1);
    expect(result.issues[0].code).toBe(ErrorCodes.INVALID_TRAIT_FORMAT);
  });

  it('reports parse errors for malformed YAML', () => {
    const dir = createTempDir();
    const filePath = join(dir, 'invalid.trait.yaml');
    writeFileSync(filePath, 'trait: [invalid');

    try {
      const result = validateTraits({ path: dir });
      expect(result.valid).toBe(false);
      expect(result.summary.errors).toBe(1);
      expect(result.issues[0].code).toBe(ErrorCodes.INVALID_TRAIT_FORMAT);
      expect(result.issues[0].severity).toBe('error');
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('passes validation for a well-formed trait file', () => {
    const dir = createTempDir();
    const filePath = join(dir, 'valid.trait.yaml');
    writeFileSync(
      filePath,
      `
trait:
  name: SampleTrait
  version: 1.0.0

schema:
  field:
    type: string
    required: true

parameters:
  - name: sample
    type: string
    required: true
    description: Sample parameter
`
    );

    try {
      const result = validateTraits({ path: dir });
      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(0);
      expect(result.summary.info).toBe(0);
    } finally {
      cleanupTempDir(dir);
    }
  });
});
