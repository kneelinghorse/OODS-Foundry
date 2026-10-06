import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle as tokens } from '../../src/tools/tokens.build.js';
import * as security from '../../src/lib/security.js';

const root = path.resolve(import.meta.dirname, '../../../..');
let sandbox: string | undefined;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true }); });
function sourceHashes(dir: string): unknown[] {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const full = path.join(dir, entry.name);
    return [entry.name, entry.isDirectory() ? sourceHashes(full) : createHash('sha256').update(fs.readFileSync(full)).digest('hex')];
  });
}
describe('tokens.build compiles source rather than copying stale distribution values', () => {
  it('builds current source with the shipped compiler and returns the exact CSS and JSON it writes', async () => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 's216-token-build-'));
    const kit = path.join(sandbox, 'kit');
    for (const name of ['src', 'scripts', 'dist', 'style-dictionary.config.cjs', 'package.json']) fs.cpSync(path.join(root, 'packages/tokens', name), path.join(kit, name), { recursive: true });
    const source = path.join(kit, 'src/tokens/brands/A/base.json');
    const doc = JSON.parse(fs.readFileSync(source, 'utf8'));
    doc.color.brand.A.text.primary.$value = 'oklch(0.22 0.025 260)';
    fs.writeFileSync(source, JSON.stringify(doc));
    vi.stubEnv('MCP_BRAND_SOURCE_ROOT', kit);
    vi.stubEnv('OODS_BRANDS_DIR', '');
    const policy = security.loadPolicy();
    vi.spyOn(security, 'loadPolicy').mockReturnValue({ ...policy, artifactsBase: path.join(sandbox, 'artifacts') });
    const before = sourceHashes(kit);
    const planned = await tokens({ brand: 'A', theme: 'light' });
    const result = await tokens({ brand: 'A', theme: 'light', apply: true });
    const data = result.structuredData as any;
    expect(data, 'values are usable without reading server-local file paths').toBeDefined();
    expect(data.build).toMatchObject({ exitCode: 0 });
    expect(data.build.commands).toHaveLength(2);
    expect(data.cssVariables['--oods-sys-text-primary']).toBe('oklch(0.22 0.025 260)');
    expect(sourceHashes(kit), 'compilation may not alter the attested runtime').toEqual(before);
    const files = new Map(result.artifacts.map(file => [path.basename(file), file]));
    expect(JSON.parse(fs.readFileSync(files.get('tokens.light.json')!, 'utf8'))).toEqual(data.json);
    expect(fs.readFileSync(files.get('tokens.scope.css')!, 'utf8')).toBe(data.css);
    expect(planned.preview?.specimens).toEqual(result.artifacts);
    expect(fs.existsSync(result.transcriptPath!)).toBe(true);
    expect(fs.existsSync(result.bundleIndexPath!)).toBe(true);
  }, 120_000);
});
