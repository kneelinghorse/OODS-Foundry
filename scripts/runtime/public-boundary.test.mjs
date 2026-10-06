import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { assertPublicStructuredDataBoundary } from './assemble.mjs';

test('a receipt-free source tree must carry the whole current structured-data closure, with no historical substitution', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-data-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = 'artifacts/structured-data/manifest.json';
  const mappings = 'artifacts/structured-data/component-mappings.json';
  const current = 'artifacts/structured-data/current.json';
  fs.mkdirSync(path.dirname(path.join(root, manifest)), { recursive: true });
  fs.writeFileSync(path.join(root, manifest), JSON.stringify({ artifacts: [{ path: current }] }));
  assert.doesNotThrow(() => assertPublicStructuredDataBoundary([current, mappings, manifest], root));
  for (const files of [[manifest, mappings], [manifest, mappings, 'artifacts/structured-data/old.json'], [manifest, mappings, current, 'artifacts/structured-data/old.json']]) {
    assert.throws(() => assertPublicStructuredDataBoundary(files, root), /complete current closure/);
  }
});
