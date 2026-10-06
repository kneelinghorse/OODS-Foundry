#!/usr/bin/env node
/** Compare a built source snapshot with the published release, without publishing anything. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McpClient } from './e2e.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const output = path.resolve(root, process.argv[2] ?? '.tmp/public-proof/rebuild');
const published = path.resolve(root, process.argv[3] ?? path.join(output, 'published'));
const names = ['tokens', 'component-contracts', 'component-styles', 'components-react', 'components-vue'];
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(published, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command} failed: ${result.error ?? result.stderr}`);
  return result.stdout;
}
function tree(directory, prefix = '') {
  return fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? tree(directory, relative) : [relative];
  }).sort();
}
function unpack(tarball, directory) {
  fs.mkdirSync(directory, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', directory]);
}
const receipt = { schemaVersion: '1.0.0', version, builderSelfCertified: false, libraries: [], adapter: null, status: 'running' };
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
try {
  for (const name of [...names, 'foundry']) {
    const tarball = path.join(published, `${name}.tgz`);
    const metadata = path.join(published, `${name}.metadata.json`);
    if (!fs.existsSync(metadata)) {
      run('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', `https://registry.npmjs.org/@oods/${name}/${version}`, '--output', metadata]);
    }
    const dist = read(metadata).dist;
    if (!fs.existsSync(tarball)) {
      run('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', dist.tarball, '--output', tarball]);
    }
    const [algorithm, expected] = dist.integrity.split('-');
    assert.equal(createHash(algorithm).update(fs.readFileSync(tarball)).digest('base64'), expected, `${name}: registry integrity mismatch`);
    const target = path.join(published, name);
    if (!fs.existsSync(path.join(target, 'package/package.json'))) unpack(tarball, target);
  }
  for (const name of names) {
    const destination = path.join(output, 'packed', name);
    fs.mkdirSync(destination, { recursive: true });
    const [report] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], path.join(root, 'packages', name)));
    unpack(path.join(destination, report.filename), destination);
    const actual = path.join(destination, 'package'), expected = path.join(published, name, 'package');
    const actualFiles = tree(actual), expectedFiles = tree(expected);
    const missing = expectedFiles.filter(file => !actualFiles.includes(file)), extra = actualFiles.filter(file => !expectedFiles.includes(file));
    const changed = actualFiles.filter(file => expectedFiles.includes(file)).filter(file => {
      if (file === 'package.json') {
        const a = read(path.join(actual, file)), b = read(path.join(expected, file));
        delete a.repository; delete b.repository; delete a.bugs; delete b.bugs;
        return JSON.stringify(a) !== JSON.stringify(b);
      }
      return !fs.readFileSync(path.join(actual, file)).equals(fs.readFileSync(path.join(expected, file)));
    });
    receipt.libraries.push({ name: `@oods/${name}`, files: actualFiles.length, publishedTarballSha256: hash(fs.readFileSync(path.join(published, `${name}.tgz`))), builtTarballSha256: hash(fs.readFileSync(path.join(destination, report.filename))), missing, extra, changed, allowedMetadataFields: ['repository', 'bugs'] });
    save();
    assert.deepEqual({ missing, extra, changed }, { missing: [], extra: [], changed: [] }, `${name}: source rebuild differs from npm`);
  }
  const publishedRuntime = path.join(published, 'runtime');
  if (!fs.existsSync(path.join(publishedRuntime, 'packages/mcp-adapter/index.js'))) unpack(path.join(published, 'foundry/package/runtime/oods-foundry-runtime.tar.gz'), publishedRuntime);
  async function inspect(directory, label) {
    const taskHome = path.join(output, label, 'home'); fs.mkdirSync(taskHome, { recursive: true });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:MCP_|OODS_|FORGE_)/.test(key)));
    Object.assign(env, { HOME: taskHome, MCP_TOOLSET: 'default', MCP_HEALTH_PORT: '0', OODS_NODE_PATH: process.execPath });
    const client = new McpClient({ adapterPath: path.join(directory, 'packages/mcp-adapter/index.js'), cwd: directory, env });
    try {
      await client.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'public-source-proof', version: '1.0.0' } });
      client.notify('notifications/initialized');
      const list = await client.request('tools/list', {});
      const health = await client.callTool('health_check', {});
      return { list: list.tools, health };
    } finally {
      const closed = await client.closeStdinAndObserve();
      if (!closed.exited) await client.terminate();
      assert(closed.exited && closed.code === 0, `${label}: adapter must close cleanly`);
    }
  }
  const expected = await inspect(publishedRuntime, 'npm-runtime');
  const actual = await inspect(root, 'source-runtime');
  assert.equal(Buffer.byteLength(JSON.stringify(expected.list)), 79_716);
  assert.equal(JSON.stringify(actual.list), JSON.stringify(expected.list), 'Adapter tools/list must match published npm exactly');
  assert.equal(actual.health.registry.objects, 16);
  const retainedLedgerHashes = {};
  for (const name of ['runtime-cells.v1.json', 'release-cells.v1.json', 'tool-capability-ledger.v1.json', 'html-cells.v1.json', 'visual-proofs.v1.json']) {
    const source = fs.readFileSync(path.join(root, 'packages/mcp-server/registry', name));
    const built = fs.readFileSync(path.join(root, 'packages/mcp-server/dist/registry', name));
    assert(source.equals(built), `${name}: built retained evidence must match the committed source bytes`);
    retainedLedgerHashes[name] = hash(source);
  }
  const identities = reality => Object.fromEntries(['runtime', 'release', 'tools', 'html', 'fidelity'].map(name => {
    const value = { ...reality[name] }; delete value.thisBuild;
    // sourceHead records the retained source census, distinct from executed proof heads.
    if (name === 'tools') delete value.sourceHead;
    return [name, value];
  }));
  const runtime = await import(pathToFileURL(path.join(root, 'packages/mcp-server/dist/lib/runtime-ledger.js')));
  const release = await import(pathToFileURL(path.join(root, 'packages/mcp-server/dist/lib/release-ledger.js')));
  const tools = await import(pathToFileURL(path.join(root, 'packages/mcp-server/dist/lib/tool-ledger.js')));
  const visual = await import(pathToFileURL(path.join(root, 'packages/mcp-server/dist/lib/visual-proof-ledger.js')));
  const releaseSummary = release.readReleaseSummary();
  const committed = { runtime: runtime.readRuntimeSummary(), release: { ...releaseSummary, head: releaseSummary.bundleHead }, tools: tools.readToolSummary(), html: visual.readVisualProofSummary('html'), fidelity: visual.readVisualProofSummary('fidelity') };
  for (const [kind, summary] of Object.entries(committed)) {
    const served = { ...actual.health.productReality[kind] }; delete served.thisBuild; delete served.measuredOn;
    assert.deepEqual(served, summary, `${kind}: public health must retain the committed/private proof identity`);
  }
  // Publication itself can add a later measured receipt. Keep that difference visible without
  // confusing proof refreshes with the npm tool-contract equivalence checked above.
  const publishedProofIdentityDifferences = Object.keys(committed).filter(kind => JSON.stringify(identities(actual.health.productReality)[kind]) !== JSON.stringify(identities(expected.health.productReality)[kind]));
  receipt.adapter = { toolCount: actual.list.length, toolListUtf8Bytes: Buffer.byteLength(JSON.stringify(actual.list)), toolListSha256: hash(JSON.stringify(actual.list)), objects: actual.health.registry.objects, retainedProofsMatchCommittedLedgers: true, retainedLedgerHashes, publishedProofIdentityDifferences, retainedProofIdentities: identities(actual.health.productReality) };
  receipt.status = 'pass'; save();
  console.log(JSON.stringify({ status: receipt.status, libraries: receipt.libraries.length, tools: receipt.adapter.toolCount, toolListUtf8Bytes: receipt.adapter.toolListUtf8Bytes, objects: receipt.adapter.objects }));
} catch (error) {
  receipt.status = 'fail'; receipt.error = error.message; save(); throw error;
}
