import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { handle as mapRead } from '../../src/tools/map.read.js';
import { handle as brand } from '../../src/tools/brand.intake.js';
import { handle as brandRead } from '../../src/tools/brand.read.js';
import { handle as objectImport } from '../../src/tools/object.import.js';
import { handle as objectImportRead } from '../../src/tools/object.import.read.js';

// A draft id the caller mistyped or that came from another home folder is the caller's to fix. In 0.10.0 the three
// draft tools answered with the operating system's ENOENT text and the absolute path of the user's home folder, and
// brand_create reported it as a server fault. Each must say which id is missing and how to get it back.

let folder: string;
const keys = ['OODS_FOUNDRY_HOME', 'MCP_MAPPINGS_PATH'];
const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'unknown-drafts-'));
  process.env.OODS_FOUNDRY_HOME = path.join(folder, 'home');
  process.env.MCP_MAPPINGS_PATH = path.join(folder, 'mappings.json');
});
afterEach(() => {
  for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; }
  fs.rmSync(folder, { recursive: true, force: true });
});

const zeros = '0'.repeat(64);
async function failure(call: () => Promise<unknown>) {
  try { await call(); } catch (error) { return error as { opiCode?: string; message: string }; }
  throw new Error('expected the call to fail');
}
function expectCallerError(error: { opiCode?: string; message: string }, code: string, said: RegExp) {
  expect(error.opiCode).toBe(code);
  expect(error.message).toMatch(said);
  expect(error.message).toMatch(/Run draft again/);
  expect(error.message).not.toMatch(/ENOENT|lstat/);
  expect(error.message).not.toContain(folder);
}

it('brand_read show and brand_create apply name the missing brand draft as a validation error', async () => {
  for (const input of [{ action: 'show', draftId: `brand-${zeros}` }, { action: 'apply', draftId: `brand-${zeros}`, accept: true }]) {
    expectCallerError(await failure(() => (input.action === 'show' ? brandRead : brand)(input as never)), 'OODS-V001', new RegExp(`No brand draft brand-${zeros}`));
  }
});

it('component_map_read show names the missing component draft', async () => {
  expectCallerError(await failure(() => mapRead({ action: 'show', draftId: `components-${zeros}` } as never)), 'OODS-V219', new RegExp(`No component draft components-${zeros}`));
});

it('object_import_read show and object_import apply name the missing staged import', async () => {
  for (const input of [{ action: 'show', importId: `import-${zeros}`, object: 'Order' }, { action: 'apply', importId: `import-${zeros}`, objects: [{ name: 'Order' }] }]) {
    expectCallerError(await failure(() => (input.action === 'show' ? objectImportRead : objectImport)(input as never)), 'OODS-V220', new RegExp(`No staged import import-${zeros}`));
  }
});
