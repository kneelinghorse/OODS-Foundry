import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('refresh:data wrapper', () => {
  it('adds default artifact-dir and version-tag when missing', async () => {
    const mod = await import('../../scripts/refresh-data.mjs');
    const args = mod.buildRefreshStructuredDataArgs(['--skip-delta']);

    expect(args).toEqual([
      path.join('cmos', 'scripts', 'refresh_structured_data.py'),
      '--artifact-dir',
      path.join('artifacts', 'structured-data'),
      '--version-tag',
      'auto',
      '--skip-delta',
    ]);
  });

  it('ignores pnpm passthrough separator', async () => {
    const mod = await import('../../scripts/refresh-data.mjs');
    const args = mod.buildRefreshStructuredDataArgs(['--', '--skip-delta']);

    expect(args).toEqual([
      path.join('cmos', 'scripts', 'refresh_structured_data.py'),
      '--artifact-dir',
      path.join('artifacts', 'structured-data'),
      '--version-tag',
      'auto',
      '--skip-delta',
    ]);
  });

  it('does not add default artifact-dir when provided', async () => {
    const mod = await import('../../scripts/refresh-data.mjs');
    const args = mod.buildRefreshStructuredDataArgs(['--artifact-dir', 'custom', '--skip-delta']);

    expect(args).toEqual([
      path.join('cmos', 'scripts', 'refresh_structured_data.py'),
      '--version-tag',
      'auto',
      '--artifact-dir',
      'custom',
      '--skip-delta',
    ]);
  });

  it('does not add default version-tag when provided', async () => {
    const mod = await import('../../scripts/refresh-data.mjs');
    const args = mod.buildRefreshStructuredDataArgs(['--version-tag=2026-02-24', '--skip-delta']);

    expect(args).toEqual([
      path.join('cmos', 'scripts', 'refresh_structured_data.py'),
      '--artifact-dir',
      path.join('artifacts', 'structured-data'),
      '--version-tag=2026-02-24',
      '--skip-delta',
    ]);
  });
});
