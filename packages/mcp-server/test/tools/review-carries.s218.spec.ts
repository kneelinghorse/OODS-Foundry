import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

it('an installed object with a missing trait reports the cause instead of a generic server load error (#1620)', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 's218-unloadable-'));
  try {
    vi.stubEnv('OODS_OBJECTS_DIR', folder);
    vi.stubEnv('OODS_TRAITS_DIR', path.join(folder, 'traits'));
    fs.copyFileSync(new URL('../fixtures/team-definitions/problems/Pallet.object.yaml', import.meta.url), path.join(folder, 'Pallet.object.yaml'));
    clearObjectCache(); clearTraitCache();
    const result = await compose({ object: 'Pallet', context: 'detail', options: { transient: true } });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.code).toBe('OODS-V215');
    expect(result.errors?.[0]?.message).toContain('Pallet');
    expect(result.errors?.[0]?.message).toMatch(/trait/i);
    expect(result.compositionId).toBeUndefined();
  } finally {
    vi.unstubAllEnvs(); clearObjectCache(); clearTraitCache();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
