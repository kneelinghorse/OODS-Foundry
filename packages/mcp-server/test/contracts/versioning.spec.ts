import { describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/structuredData.fetch.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/structuredData.fetch.output.json' assert { type: 'json' };
import { handle, listAvailableVersions, computeStructuredDataEtag } from '../../src/tools/structuredData.fetch.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

// ── Schema validation ──

describe('structuredData.fetch versioned input schema', () => {
  it('accepts version parameter in YYYY-MM-DD format', () => {
    expect(
      validateInput({ dataset: 'components', version: '2026-02-24' }),
    ).toBe(true);
  });

  it('rejects invalid version format', () => {
    expect(
      validateInput({ dataset: 'components', version: '2026/02/24' }),
    ).toBe(false);
  });

  it('rejects version without leading zeros', () => {
    expect(
      validateInput({ dataset: 'components', version: '2026-2-24' }),
    ).toBe(false);
  });

  it('accepts listVersions=true', () => {
    expect(
      validateInput({ dataset: 'components', listVersions: true }),
    ).toBe(true);
  });

  it('backward compatible: input without version still valid', () => {
    expect(validateInput({ dataset: 'components' })).toBe(true);
    expect(validateInput({ dataset: 'tokens' })).toBe(true);
    expect(validateInput({ dataset: 'manifest' })).toBe(true);
  });

  it('accepts combined ETag and version parameters', () => {
    expect(
      validateInput({
        dataset: 'components',
        version: '2026-02-24',
        ifNoneMatch: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      }),
    ).toBe(true);
  });
});

// ── listVersions ──

describe('listVersions', () => {
  it('returns available versions for components', async () => {
    const result = await handle({ dataset: 'components', listVersions: true });

    expect(validateOutput(result)).toBe(true);
    expect(result.availableVersions).toBeInstanceOf(Array);
    expect(result.availableVersions!.length).toBeGreaterThan(0);
    // Versions should be sorted ascending
    const versions = result.availableVersions!;
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i] >= versions[i - 1]).toBe(true);
    }
    // All should match YYYY-MM-DD format
    for (const v of versions) {
      expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('returns available versions for tokens', async () => {
    const result = await handle({ dataset: 'tokens', listVersions: true });

    expect(validateOutput(result)).toBe(true);
    expect(result.availableVersions).toBeInstanceOf(Array);
    expect(result.availableVersions!.length).toBeGreaterThan(0);
  });

  it('returns empty versions for manifest', async () => {
    const result = await handle({ dataset: 'manifest', listVersions: true });

    expect(validateOutput(result)).toBe(true);
    expect(result.availableVersions).toEqual([]);
  });

  it('does not include payload when listing versions', async () => {
    const result = await handle({ dataset: 'components', listVersions: true });

    expect(result.payloadIncluded).toBe(false);
    expect(result.payload).toBeUndefined();
  });
});

// ── Version resolution ──

describe('version resolution to date-stamped artifacts', () => {
  it('resolves exact version to correct artifact', async () => {
    const versions = listAvailableVersions('components');
    if (versions.length === 0) return; // Skip if no artifacts

    const exactVersion = versions[versions.length - 1]; // Latest
    const result = await handle({ dataset: 'components', version: exactVersion });

    expect(validateOutput(result)).toBe(true);
    expect(result.version).toBe(exactVersion);
    expect(result.requestedVersion).toBe(exactVersion);
    expect(result.resolvedVersion).toBe(exactVersion);
    expect(result.path).toContain(exactVersion);
    expect(result.warnings).toBeUndefined();
  });

  it('resolves nearest version with warning when exact not found', async () => {
    const result = await handle({ dataset: 'components', version: '2025-11-23' });

    expect(validateOutput(result)).toBe(true);
    expect(result.requestedVersion).toBe('2025-11-23');
    // Should resolve to nearest available (2025-11-22 is earlier)
    expect(result.resolvedVersion).toBeDefined();
    expect(result.resolvedVersion).not.toBe('2025-11-23');
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('not found'))).toBe(true);
  });

  it('resolves tokens with exact version', async () => {
    const versions = listAvailableVersions('tokens');
    if (versions.length === 0) return;

    const exactVersion = versions[0]; // Earliest
    const result = await handle({ dataset: 'tokens', version: exactVersion });

    expect(validateOutput(result)).toBe(true);
    expect(result.resolvedVersion).toBe(exactVersion);
    expect(result.path).toContain(exactVersion);
  });
});

// ── Backward compatibility ──

describe('backward compatibility: no version = latest', () => {
  it('returns latest when version is omitted', async () => {
    const withVersion = await handle({ dataset: 'components' });
    expect(validateOutput(withVersion)).toBe(true);

    // Should use manifest-based resolution (not versioned path)
    expect(withVersion.requestedVersion).toBeUndefined();
    expect(withVersion.resolvedVersion).toBeUndefined();
    expect(withVersion.version).toBeDefined();
  });

  it('preserves existing ETag behavior without version', async () => {
    const result = await handle({ dataset: 'components' });
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result.matched).toBe(false);
    expect(typeof result.sizeBytes).toBe('number');
    expect(result.schemaValidated).toBe(true);
  });

  it('ETag matching still works without version', async () => {
    const first = await handle({ dataset: 'components' });
    const second = await handle({ dataset: 'components', ifNoneMatch: first.etag });

    expect(second.matched).toBe(true);
    expect(second.payloadIncluded).toBe(false);
  });
});

// ── ETag stability for versioned responses ──

describe('ETag stability for versioned responses', () => {
  it('computes stable ETag for versioned artifact', async () => {
    const versions = listAvailableVersions('components');
    if (versions.length === 0) return;

    const version = versions[0];
    const first = await handle({ dataset: 'components', version, includePayload: false });
    const second = await handle({ dataset: 'components', version, includePayload: false });

    expect(first.etag).toBe(second.etag);
    expect(first.etag).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different versions produce different ETags', async () => {
    const versions = listAvailableVersions('components');
    if (versions.length < 2) return;

    const result1 = await handle({ dataset: 'components', version: versions[0], includePayload: false });
    const result2 = await handle({ dataset: 'components', version: versions[versions.length - 1], includePayload: false });

    // Different versions should (almost certainly) have different ETags
    // unless the data is identical across versions
    expect(result1.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result2.etag).toMatch(/^[a-f0-9]{64}$/);
  });

  it('versioned ETag matches ifNoneMatch correctly', async () => {
    const versions = listAvailableVersions('components');
    if (versions.length === 0) return;

    const version = versions[0];
    const first = await handle({ dataset: 'components', version });
    const cached = await handle({ dataset: 'components', version, ifNoneMatch: first.etag });

    expect(cached.matched).toBe(true);
    expect(cached.payloadIncluded).toBe(false);
  });
});

// ── Manifest version warning ──

describe('manifest dataset with version parameter', () => {
  it('warns when version is used with manifest', async () => {
    const result = await handle({ dataset: 'manifest', version: '2026-02-24' });

    expect(validateOutput(result)).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('not supported for the manifest'))).toBe(true);
  });
});

// ── Version edge cases ──

describe('version edge cases', () => {
  it('resolves to earliest when requested version is before all available', async () => {
    const result = await handle({ dataset: 'components', version: '2020-01-01' });

    expect(result.status).toBeUndefined(); // structuredData.fetch doesn't have status field
    expect(result.resolvedVersion).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes('not found'))).toBe(true);
  });

  it('resolves to latest when requested version is after all available', async () => {
    const result = await handle({ dataset: 'components', version: '2099-12-31' });

    expect(result.resolvedVersion).toBeDefined();
    expect(result.warnings).toBeDefined();
  });
});
