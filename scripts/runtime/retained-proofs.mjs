#!/usr/bin/env node
/** Builds carry the committed proof identities; only explicit evidence refreshes read receipts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TOOL_LEDGER = 'packages/mcp-server/registry/tool-capability-ledger.v1.json';
export const VISUAL_LEDGER = 'packages/mcp-server/registry/visual-proofs.v1.json';

export function readRetainedProofs(root = ROOT) {
  const read = file => fs.readFileSync(path.join(root, file));
  const toolBytes = read(TOOL_LEDGER), visualBytes = read(VISUAL_LEDGER);
  const tool = JSON.parse(toolBytes), visual = JSON.parse(visualBytes);
  const registry = JSON.parse(read('packages/mcp-server/src/tools/registry.json'));
  assert.equal(tool.schemaVersion, '2.0.0');
  assert.equal(tool.builderSelfCertified, false);
  assert.match(tool.head, /^[a-f0-9]{40}$/);
  assert.deepEqual(tool.rows.map(row => row.name), [...registry.auto, ...registry.onDemand]);
  assert.equal(visual.schemaVersion, '1.0.0');
  assert.equal(visual.builderSelfCertified, false);
  const htmlBytes = read('packages/mcp-server/registry/html-cells.v1.json');
  assert.equal(visual.html.sha256, `sha256:${createHash('sha256').update(htmlBytes).digest('hex')}`, 'Retained HTML summary must bind the committed ledger');
  for (const kind of ['html', 'fidelity']) {
    const proof = visual[kind];
    assert.match(proof.sha256, /^sha256:[a-f0-9]{64}$/);
    assert(proof.rows.length > 0);
    assert.equal(new Set(proof.rows.map(row => row.id)).size, proof.rows.length);
    for (const row of proof.rows) {
      assert(['pass', 'fail'].includes(row.status));
      if (row.head !== null) assert.match(row.head, /^[a-f0-9]{40}$/);
    }
  }
  return { tool, visual, toolBytes, visualBytes };
}

export function copyRetainedToolLedger(output, root = ROOT) {
  const { tool, toolBytes } = readRetainedProofs(root);
  const destination = path.resolve(root, output);
  const relative = path.relative(root, destination);
  assert(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Ledger output must stay in the repository');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, toolBytes);
  return tool;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 2 && args[0] === '--output'), 'Expected optional --output <path>');
  if (args.length) copyRetainedToolLedger(args[1]);
  else readRetainedProofs();
}
