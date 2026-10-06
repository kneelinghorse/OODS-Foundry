/**
 * s213-m03: register keeps only what composes. If an object that validates fails to compose in a context it declares,
 * the team's folder is put back exactly as it was (a new file removed, an overwritten one restored) and OODS-V215 names
 * the context, so a half-registered object never breaks the screens that list or compose it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/tools/design.compose.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/tools/design.compose.js')>();
  return {
    ...actual,
    handle: vi.fn(async (input: Parameters<typeof actual.handle>[0]) => (input.context === 'timeline' && input.object === 'Warehouse'
      ? { status: 'error', errors: [{ code: 'OODS-V003', message: 'forced failure for the rollback spec' }] }
      : actual.handle(input))),
  };
});

const { clearObjectCache, listObjects } = await import('../../src/objects/object-loader.js');
const { clearTraitCache } = await import('../../src/objects/trait-loader.js');
const { handle: objectTool } = await import('../../src/tools/object.js');

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/team-definitions');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s213-m03-rollback-'));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.OODS_TRAITS_DIR = path.join(home, 'traits');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  clearTraitCache(); clearObjectCache();
});

afterEach(() => {
  for (const key of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'MCP_SCHEMA_STORE_ROOT']) delete process.env[key];
  clearTraitCache(); clearObjectCache();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('s213-m03: register leaves the folder as it was when a declared context does not compose', () => {
  it('removes a new file and reports the context', async () => {
    await objectTool({ action: 'register', yaml: fixture('Stockable.trait.yaml') });
    await expect(objectTool({ action: 'register', yaml: fixture('Warehouse.object.yaml') })).rejects.toMatchObject({
      opiCode: 'OODS-V215', message: expect.stringContaining('does not compose in the timeline context'),
    });
    expect(fs.existsSync(path.join(home, 'objects', 'Warehouse.object.yaml'))).toBe(false);
    expect(fs.readdirSync(path.join(home, 'objects'))).toEqual([]);
    expect(listObjects()).not.toContain('Warehouse');
  });

  it('restores an overwritten definition byte for byte', async () => {
    await objectTool({ action: 'register', yaml: fixture('Stockable.trait.yaml') });
    const file = path.join(home, 'objects', 'Warehouse.object.yaml');
    const earlier = fixture('Warehouse.object.yaml').replace(/^traits:[\s\S]*?\nschema:/m, 'schema:');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, earlier);
    clearObjectCache();
    await expect(objectTool({ action: 'register', yaml: fixture('Warehouse.object.yaml'), overwrite: true })).rejects.toMatchObject({ opiCode: 'OODS-V215' });
    expect(fs.readFileSync(file, 'utf8')).toBe(earlier);
  });
});
