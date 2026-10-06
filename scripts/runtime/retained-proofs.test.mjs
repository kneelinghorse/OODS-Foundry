import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT, TOOL_LEDGER, VISUAL_LEDGER, readRetainedProofs, copyRetainedToolLedger } from './retained-proofs.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retained-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of [TOOL_LEDGER, VISUAL_LEDGER, 'packages/mcp-server/registry/html-cells.v1.json', 'packages/mcp-server/src/tools/registry.json']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(root, file));
  }
  return root;
}

test('a receipt-free build preserves the retained proof bytes and historical identities', t => {
  const root = fixture(t);
  assert.equal(fs.existsSync(path.join(root, 'artifacts')), false);
  const proofs = readRetainedProofs(root);
  const output = 'packages/mcp-server/dist/registry/tool-capability-ledger.v1.json';
  copyRetainedToolLedger(output, root);
  assert.deepEqual(fs.readFileSync(path.join(root, output)), proofs.toolBytes);
  assert.deepEqual(proofs.visualBytes, fs.readFileSync(path.join(ROOT, VISUAL_LEDGER)));
});

test('a changed committed HTML ledger cannot retain an old measured identity', t => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, 'packages/mcp-server/registry/html-cells.v1.json'), '\n');
  assert.throws(() => readRetainedProofs(root), /must bind the committed ledger/);
});

test('an unregistered tool or self-certification cannot enter a build through a retained ledger', t => {
  const root = fixture(t);
  const original = JSON.parse(fs.readFileSync(path.join(root, TOOL_LEDGER)));
  for (const change of [value => value.rows.pop(), value => { value.builderSelfCertified = true; }]) {
    const value = structuredClone(original); change(value);
    fs.writeFileSync(path.join(root, TOOL_LEDGER), JSON.stringify(value));
    assert.throws(() => readRetainedProofs(root));
  }
});

test('copy destinations cannot leave the checkout', t => {
  assert.throws(() => copyRetainedToolLedger('../escape.json', fixture(t)), /must stay in the repository/);
});
