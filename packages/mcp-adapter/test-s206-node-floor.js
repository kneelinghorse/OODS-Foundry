// s206-m03: the Node floor. Below it the adapter stops before anything else loads, with one plain sentence that names
// the cause (the version it found, and which node) and the next step (install a current LTS or point the client at
// one). Run: node packages/mcp-adapter/test-s206-node-floor.js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const adapterDirectory = path.dirname(fileURLToPath(import.meta.url));
// Importing the module runs its check against this Node, which is above the floor, so it returns quietly.
const { nodeFloorProblem } = await import('./node-floor.js');
// s211-m03: the sentence names the product from the one name source (configs/product/name.json, rendered as product.json).
const { product } = JSON.parse(fs.readFileSync(path.join(adapterDirectory, 'product.json'), 'utf8'));

test('reads the floor to the patch level', () => {
  assert.equal(nodeFloorProblem('20.11.1', '>=20.11.1'), null);
  assert.equal(nodeFloorProblem('v20.11.2', '>=20.11.1'), null);
  assert.equal(nodeFloorProblem('22.0.0', '>=20.11.1'), null);
  assert.equal(nodeFloorProblem('24.6.0', '>=20.11.1'), null);
  assert.equal(product, 'OODS Foundry');
  assert.ok(nodeFloorProblem('20.11.0', '>=20.11.1', '/usr/local/bin/node').startsWith(`${product} needs Node.js 20.11.1 or newer, and this is Node.js 20.11.0 (/usr/local/bin/node).`));
  assert.match(nodeFloorProblem('18.20.8', '>=20.11.1'), /Node\.js 18\.20\.8/);
  assert.match(nodeFloorProblem('v16.20.2', '>=20.11.1'), /Node\.js 16\.20\.2/);
  // A range it cannot read is not its to police.
  assert.equal(nodeFloorProblem('18.0.0', '^20 || ^22'), null);
  assert.equal(nodeFloorProblem('18.0.0', undefined), null);
});

test('names the next step', () => {
  const message = nodeFloorProblem('18.20.8', '>=20.11.1', '/opt/old/node');
  assert.match(message, /Install a current Node\.js LTS from https:\/\/nodejs\.org, or point your MCP client's command at a newer node, then restart the client\.$/);
});

test('the adapter declares the runtime floor', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(adapterDirectory, 'package.json'), 'utf8'));
  // s220-m02: Style Dictionary 5 (the patched token build) needs Node 22, so the runtime floor is 22.0.0.
  assert.equal(manifest.engines.node, '>=22.0.0');
});

test('refuses before anything else loads, with the sentence on stderr and exit code 1', () => {
  // A copy of the adapter whose floor is above every Node that exists: the real entry, run by this Node. Its
  // dependencies resolve (ES modules link every import before evaluating any), so a stop here is the floor's alone.
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s206-node-floor-'));
  try {
    for (const file of ['index.js', 'node-floor.js', 'sanitize-schema.js', 'advertised-schema.js', 'tool-surface.json', 'mcp-apps.js', 'product.json']) fs.copyFileSync(path.join(adapterDirectory, file), path.join(temporary, file));
    const manifest = JSON.parse(fs.readFileSync(path.join(adapterDirectory, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ ...manifest, engines: { node: '>=99.0.0' } }));
    fs.symlinkSync(path.join(adapterDirectory, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
    const run = spawnSync(process.execPath, [path.join(temporary, 'index.js')], { input: '', encoding: 'utf8', timeout: 20_000 });
    assert.equal(run.status, 1);
    assert.equal(run.stdout, '', 'nothing on stdout: that channel is the MCP protocol');
    assert.equal(run.stderr.trim(), `[oods-mcp-adapter] ${product} needs Node.js 99.0.0 or newer, and this is Node.js ${process.versions.node} (${process.execPath}). Install a current Node.js LTS from https://nodejs.org, or point your MCP client's command at a newer node, then restart the client.`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('starts normally at or above the floor', () => {
  const run = spawnSync(process.execPath, [path.join(adapterDirectory, 'index.js')], { input: '', encoding: 'utf8', timeout: 20_000 });
  assert.doesNotMatch(run.stderr, /needs Node\.js/);
  assert.match(run.stderr, /\[oods-mcp-adapter\] v\d+\.\d+\.\d+ \| \d+ tools/);
});
