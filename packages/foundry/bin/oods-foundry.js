#!/usr/bin/env node
// OODS Foundry's command, which an MCP client starts with `npx -y @oods/foundry`.
//
// The package carries the release archive and its manifest under runtime/. On first start the archive is checked
// against the digest its manifest records and unpacked once into ~/.oods-foundry/runtime/<version>-<digest>; every
// later start reuses that directory. The stdio MCP server then runs from it, in this process, exactly as it runs from
// an archive extracted by hand. Standard output belongs to the protocol, so every sentence for a person goes to
// standard error.
//
// s239: unpacking takes longer than an MCP client waits for its first answer (Claude Code stops waiting after 30 s), so
// the first start unpacks in a detached process of its own (this command with --unpack). It finishes and renames the
// directory into place even when the client gives up, under a lock that other starts wait for instead of unpacking
// again, and removes the folders an unpack that died left behind. Meanwhile this process answers initialize, ping,
// tools/list, resources/list and resources/templates/list, and refuses the requests the server has no handler for,
// from runtime/<archive>.first-start.json, which the package builder records from this archive's own server
// (scripts/runtime/first-start.mjs). It holds every other message. Once the runtime is in place it starts the server
// as a child, hands it everything the client sent, in order, drops the server's own answers to what was answered
// already, and relays both ways. With MCP_EXTRA_TOOLS set, or in a package without that file, the first start waits
// for the unpack before it answers.
//
// What you make (compositions, saved schemas, file-mode output) is kept in ~/.oods-foundry too, so it survives
// upgrades. Set MCP_SCHEMA_STORE_ROOT to keep it somewhere else. Your own objects and traits are read from
// ~/.oods-foundry/objects and ~/.oods-foundry/traits after the shipped ones; set OODS_OBJECTS_DIR and
// OODS_TRAITS_DIR to read them from somewhere else. Your own brands are kept in ~/.oods-foundry/brands and built there,
// outside the runtime; set OODS_BRANDS_DIR to keep them somewhere else.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// OODS_FOUNDRY_HOME moves everything kept here at once (the Docker image sets it to its /data volume); the importer
// and the intake drafts read the same variable.
const HOME = process.env.OODS_FOUNDRY_HOME ? path.resolve(process.env.OODS_FOUNDRY_HOME) : path.join(os.homedir(), '.oods-foundry');
process.env.OODS_FOUNDRY_HOME = HOME;
const MARKER = '.unpacked.json';
const say = (message) => process.stderr.write(`[oods-foundry] ${message}\n`);
const fail = (message) => {
  say(message);
  process.exit(1);
};

const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8'));
// The package's Node floor, checked before anything is unpacked. The adapter checks the same floor again
// when a runtime is started straight from its archive.
const floor = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(pkg.engines?.node ?? '')?.slice(1).map(Number);
const node = process.versions.node.split('.').map(Number);
const differs = floor ? floor.findIndex((part, index) => node[index] !== part) : -1;
if (differs >= 0 && node[differs] < floor[differs]) {
  fail(`${pkg.name} needs Node.js ${floor.join('.')} or newer, and this is Node.js ${process.versions.node} (${process.execPath}). `
    + 'Install a current Node.js LTS from https://nodejs.org, or point your MCP client\'s command at a newer node, then restart the client.');
}
const runtimeFolder = path.join(PACKAGE_DIR, 'runtime');
const manifestFile = fs.existsSync(runtimeFolder) ? fs.readdirSync(runtimeFolder).find((name) => name.endsWith('.manifest.json')) : undefined;
if (!manifestFile) fail(`this copy of ${pkg.name} carries no runtime; reinstall it with npx -y ${pkg.name}@${pkg.version}.`);
const { archive } = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'runtime', manifestFile), 'utf8'));
const archivePath = path.join(PACKAGE_DIR, 'runtime', archive.file);
const target = path.join(HOME, 'runtime', `${pkg.version}-${archive.sha256.slice(0, 12)}`);
const adapter = path.join(target, 'packages', 'mcp-adapter', 'index.js');
// The unpack holds <target>.lock and touches it every second; a lock untouched for 10 s was left by an unpack that died.
const lock = `${target}.lock`;
const held = (file) => {
  try { return Date.now() - fs.statSync(file).mtimeMs < 10_000; } catch { return false; }
};
const unpacked = () => fs.existsSync(path.join(target, MARKER));

if (!process.env.MCP_SCHEMA_STORE_ROOT) {
  process.env.MCP_SCHEMA_STORE_ROOT = HOME;
  process.env.MCP_SCHEMA_STORE_DIR ??= 'schemas';
}
process.env.OODS_OBJECTS_DIR ||= path.join(HOME, 'objects');
process.env.OODS_TRAITS_DIR ||= path.join(HOME, 'traits');
process.env.OODS_BRANDS_DIR ||= path.join(HOME, 'brands');
// The legacy MCP_MAPPINGS_PATH file override takes precedence in the store.
process.env.OODS_MAPPINGS_DIR ||= path.join(HOME, 'mappings');

/** --unpack: the first start's detached unpack, which outlives the client that started it. */
async function unpack() {
  process.stderr.on('error', () => {}); // the start relaying these sentences may be gone
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!claim()) return;
  const beat = setInterval(() => {
    try { const now = new Date(); fs.utimesSync(lock, now, now); } catch {}
  }, 1000);
  let problem = null;
  try {
    if (!unpacked()) problem = await extract();
  } finally {
    clearInterval(beat);
    // Let go of our own lock only: after a long stall another unpack may have taken it over.
    try { if (fs.readFileSync(lock, 'utf8') === `${process.pid}\n`) fs.rmSync(lock); } catch {}
  }
  if (problem) fail(problem);
  removeDeadPartials();
}

/** Takes the lock; false when the runtime is in place or a live unpack holds it. A dead unpack's lock is taken over. */
function claim() {
  for (let attempt = 0; attempt < 2 && !unpacked(); attempt += 1) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, `${process.pid}\n`);
      fs.closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (held(lock)) return false;
    fs.rmSync(lock, { force: true });
  }
  return false;
}

/** Unpacks into a staging folder beside the target and renames it into place; returns why it could not, or null. */
async function extract() {
  const staging = fs.mkdtempSync(`${target}.partial-`);
  const tar = await new Promise((resolve) => {
    const child = spawn('tar', ['-xzf', archivePath, '-C', staging], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ error }));
    child.on('close', (status) => resolve({ status, stderr }));
  });
  if (tar.error || tar.status !== 0) {
    fs.rmSync(staging, { recursive: true, force: true });
    return `could not unpack the runtime with tar (${(tar.error?.message ?? tar.stderr).trim()}). The tar command must be on the PATH your MCP client starts with.`;
  }
  fs.writeFileSync(path.join(staging, MARKER), `${JSON.stringify({ version: pkg.version, sha256: archive.sha256 }, null, 2)}\n`);
  try {
    fs.renameSync(staging, target);
  } catch (error) {
    // Another unpack got there first: use its directory.
    fs.rmSync(staging, { recursive: true, force: true });
    if (!unpacked()) return `could not move the unpacked runtime into ${target} (${error.message}).`;
  }
  return null;
}

/**
 * Removes the folders unpacks left behind: this version's once its runtime is in place, and another version's when
 * nothing holds that version's lock and the folder has not changed for an hour (0.10.1 and earlier kept no lock).
 */
function removeDeadPartials() {
  const root = path.dirname(target);
  for (const name of fs.readdirSync(root)) {
    const owner = /^(.+)\.partial-/.exec(name)?.[1];
    if (!owner) continue;
    const folder = path.join(root, name);
    try {
      if (owner === path.basename(target) || (!held(path.join(root, `${owner}.lock`)) && Date.now() - fs.statSync(folder).mtimeMs > 3_600_000)) {
        fs.rmSync(folder, { recursive: true, force: true });
      }
    } catch {} // another start is removing it too
  }
}

/** Resolves once the runtime is in place and its unpack has let go of the lock, starting an unpack whenever none runs. */
async function runtimeReady() {
  let unpacking = null;
  while (!unpacked() || held(lock)) {
    if (!held(lock) && (!unpacking || unpacking.closed)) {
      if (unpacking?.failed) process.exit(1); // the unpack said why on standard error
      unpacking = startUnpack();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function startUnpack() {
  const state = { closed: false, failed: false };
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--unpack'], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  child.on('error', (error) => say(`could not start unpacking the runtime (${error.message}).`));
  child.on('close', (code, signal) => {
    if (signal) say(`unpacking the runtime stopped on ${signal}.`);
    Object.assign(state, { closed: true, failed: code !== 0 });
  });
  child.unref();
  child.stderr.unref();
  return state;
}

/** What the server answers before its runtime is in place, for this archive and tool list; null when the start must wait. */
function firstStartAnswers() {
  const file = path.join(PACKAGE_DIR, 'runtime', manifestFile.replace(/\.manifest\.json$/, '.first-start.json'));
  const answers = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  // The adapter lists every tool for MCP_TOOLSET=all and adds MCP_EXTRA_TOOLS to the default list otherwise. Only the
  // default and full lists are recorded.
  const toolset = (process.env.MCP_TOOLSET || 'default').toLowerCase() === 'all' ? 'all'
    : (process.env.MCP_EXTRA_TOOLS || '').split(/[,\s]+/).some(Boolean) ? null : 'default';
  return toolset && answers?.archiveSha256 === archive.sha256 && answers.variants?.[toolset] && answers.variants[`${toolset}+ui`] ? { ...answers, toolset } : null;
}

/** Answers what was recorded at once, holds everything else for the server, then relays both ways. */
function relay(answers) {
  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const received = [];
  const answered = new Set();
  // The adapter offers the preview app to a client that declares the MCP Apps UI extension in its latest initialize,
  // read as sent, or to every client when OODS_MCP_APPS_UI=1 (packages/mcp-adapter/mcp-apps.js).
  const forced = process.env.OODS_MCP_APPS_UI === '1';
  let ui = forced;
  let server = null;
  let pending = Buffer.alloc(0);
  // The MCP SDK's own serialization of a result and of "Method not found", so the bytes match the server's.
  const answer = (id, reply) => {
    answered.add(id);
    process.stdout.write(`${JSON.stringify(reply)}\n`);
  };
  // A request the SDK would refuse at the top level is left to the server, which answers it the SDK's way.
  const read = (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (!isObject(message) || message.jsonrpc !== '2.0' || !(typeof message.id === 'string' || Number.isInteger(message.id))
      || Object.keys(message).some((key) => !['jsonrpc', 'id', 'method', 'params'].includes(key))
      || !(message.params === undefined || isObject(message.params))) return;
    const { id, method, params } = message;
    const { results, errors } = answers.variants[ui ? `${answers.toolset}+ui` : answers.toolset];
    if (method === 'initialize') {
      const capabilities = isObject(params?.capabilities) ? params.capabilities : {};
      ui = Boolean(capabilities.extensions?.['io.modelcontextprotocol/ui'] ?? capabilities.experimental?.['io.modelcontextprotocol/ui']) || forced;
      if (typeof params?.protocolVersion === 'string' && isObject(params.capabilities) && isObject(params.clientInfo)
        && typeof params.clientInfo.name === 'string' && typeof params.clientInfo.version === 'string') {
        const protocolVersion = answers.protocolVersions.includes(params.protocolVersion) ? params.protocolVersion : answers.latestProtocolVersion;
        answer(id, { result: { ...answers.initialize, protocolVersion }, jsonrpc: '2.0', id });
      }
    } else if (Object.hasOwn(errors, method)) {
      // A request the server has no handler for is refused before its params are read.
      answer(id, { jsonrpc: '2.0', id, error: errors[method] });
    } else if (Object.hasOwn(results, method) && (params?.cursor === undefined || typeof params.cursor === 'string')) {
      // ping, and the lists that are the same in every session of this setup.
      answer(id, { result: results[method], jsonrpc: '2.0', id });
    }
  };
  process.stdin.on('data', (chunk) => {
    if (server) {
      server.stdin.write(chunk);
      return;
    }
    received.push(chunk);
    pending = Buffer.concat([pending, chunk]);
    let newline;
    while ((newline = pending.indexOf(10)) >= 0) {
      read(pending.toString('utf8', 0, newline).replace(/\r$/, ''));
      pending = pending.subarray(newline + 1);
    }
  });
  // A client that leaves before the runtime is in place gets nothing more; the unpack carries on without it.
  const leave = () => (server ? server.stdin.end() : process.stdout.write('', () => process.exit(0)));
  process.stdin.on('end', leave);
  process.once('SIGINT', leave);
  process.once('SIGTERM', leave);
  process.stdout.on('error', () => {});
  runtimeReady().then(() => {
    server = spawn(process.execPath, [adapter], { stdio: ['pipe', 'pipe', 'inherit'] });
    server.stdin.on('error', () => {});
    for (const chunk of received.splice(0)) server.stdin.write(chunk);
    let out = Buffer.alloc(0);
    server.stdout.on('data', (chunk) => {
      if (!answered.size) {
        process.stdout.write(chunk);
        return;
      }
      out = Buffer.concat([out, chunk]);
      let newline;
      while (answered.size && (newline = out.indexOf(10)) >= 0) {
        const line = out.subarray(0, newline + 1);
        out = out.subarray(newline + 1);
        let message;
        try { message = JSON.parse(line.toString('utf8')); } catch {}
        // The client has this answer already; a second initialize answer would break its session.
        if (isObject(message) && !('method' in message) && answered.delete(message.id)) continue;
        process.stdout.write(line);
      }
      if (!answered.size && out.length) {
        process.stdout.write(out);
        out = Buffer.alloc(0);
      }
    });
    server.on('error', (error) => fail(`could not start the server (${error.message}).`));
    server.on('close', (code) => process.stdout.write('', () => process.exit(code ?? 1)));
  });
}

if (process.argv[2] === '--unpack') {
  await unpack();
} else if (unpacked()) {
  await import(pathToFileURL(adapter).href);
} else {
  const digest = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
  if (digest !== archive.sha256) {
    fail(`the runtime archive in this package does not match its recorded digest, so it was not unpacked. Reinstall with npx -y ${pkg.name}@${pkg.version}.`);
  }
  say(held(lock) ? `waiting for the runtime another start is unpacking into ${target}.` : `first start of ${pkg.version}: unpacking the runtime into ${target} (once).`);
  const answers = firstStartAnswers();
  if (answers) {
    relay(answers);
  } else {
    await runtimeReady();
    await import(pathToFileURL(adapter).href);
  }
}
