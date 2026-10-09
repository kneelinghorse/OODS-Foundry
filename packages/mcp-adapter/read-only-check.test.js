import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { snapshot, assertUnchanged } from '../../scripts/release/read-only-check.mjs';
import { schemaBytes } from '../../scripts/release/schema-size.mjs';
import { advertisedSchema } from './advertised-schema.js';
import { checkTools } from '../../scripts/release/directory-readiness.mjs';
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
it('fails on file creation, replacement, deletion, new stores and symlink changes; exempts only reply output', () => {
  for (const change of ['create', 'overwrite', 'delete', 'directory', 'link']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'read-guard-')); roots.push(root);
    const file = path.join(root, 'record'); fs.writeFileSync(file, 'saved work');
    const payloads = path.join(root, 'payloads'), before = snapshot(root, payloads);
    if (change === 'create') fs.writeFileSync(path.join(root, 'another'), 'new');
    if (change === 'overwrite') fs.writeFileSync(file, 'overwritten');
    if (change === 'delete') fs.unlinkSync(file);
    if (change === 'directory') fs.mkdirSync(path.join(root, 'store'));
    if (change === 'link') { fs.unlinkSync(file); fs.symlinkSync('elsewhere', file); }
    expect(() => assertUnchanged(before, snapshot(root, payloads), change)).toThrow(/changed persistent state/);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'read-payload-')); roots.push(root);
  const payloads = path.join(root, 'payloads'), before = snapshot(root, payloads);
  fs.mkdirSync(payloads); fs.writeFileSync(path.join(payloads, 'reply.json'), '{}');
  expect(() => assertUnchanged(before, snapshot(root, payloads), 'reply')).not.toThrow();
});
it('keeps every split schema below the client description-loss threshold and warns on an oversized schema', () => {
  const read = file => JSON.parse(fs.readFileSync(new URL(`../mcp-server/src/schemas/${file}`, import.meta.url)));
  for (const name of ['object', 'object.write', 'schema', 'schema.read', 'map', 'map.read', 'brand.intake', 'brand.read', 'object.import', 'object.import.read', 'design.preview', 'design.versions', 'repl']) {
    expect(schemaBytes(advertisedSchema(read(`${name}.input.json`), read)), name).toBeLessThanOrEqual(5000);
  }
  expect(checkTools([{ name: 'large_schema', inputSchema: { type: 'object', description: 'x'.repeat(5100) } }]).some(f => f.rule === 'schema-size')).toBe(true);
});
