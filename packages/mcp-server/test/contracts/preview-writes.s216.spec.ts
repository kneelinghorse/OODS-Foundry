import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle as tokens } from '../../src/tools/tokens.build.js';
import { handle as scan } from '../../src/tools/a11y.scan.js';
import { handle as brand } from '../../src/tools/brand.apply.js';
import * as security from '../../src/lib/security.js';
import { getAjv } from '../../src/lib/ajv.js';
import genericSchema from '../../src/schemas/generic.output.json' with { type: 'json' };
import brandSchema from '../../src/schemas/brand.apply.output.json' with { type: 'json' };

let sandbox: string;
function snapshot(dir: string): unknown[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? [entry.name, 'directory', snapshot(full)] : [entry.name, createHash('sha256').update(fs.readFileSync(full)).digest('hex')];
  });
}
beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 's216-preview-'));
  const policy = security.loadPolicy();
  vi.spyOn(security, 'loadPolicy').mockReturnValue({ ...policy, artifactsBase: path.join(sandbox, 'uncreated-artifacts') });
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(sandbox, { recursive: true, force: true }); });

describe('a preview is safe to inspect without creating an artifact history', () => {
  for (const apply of [undefined, false]) {
    it.each([
      ['tokens.build', () => tokens({ brand: 'A', theme: 'light', apply })],
      ['a11y.scan', () => scan({ apply })],
      ['brand.apply', () => brand({ brand: 'A', delta: {}, apply })],
    ] as const)('%s apply:' + String(apply) + ' leaves files and directories byte-identical', async (_name, invoke) => {
      const before = snapshot(sandbox);
      const result = await invoke();
      expect(snapshot(sandbox), 'even an empty run directory is a preview side effect').toEqual(before);
      expect(result.artifacts).toEqual([]);
      expect(result).not.toHaveProperty('transcriptPath');
      expect(result).not.toHaveProperty('bundleIndexPath');
      const validate = getAjv().compile(_name === 'brand.apply' ? brandSchema : genericSchema);
      expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    });
  }
});
