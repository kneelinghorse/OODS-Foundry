#!/usr/bin/env node
// OODS Foundry's command, which an MCP client starts with `npx -y @oods/foundry`.
//
// The package carries the release archive and its manifest under runtime/. On first start the archive is checked
// against the digest its manifest records and unpacked once into ~/.oods-foundry/runtime/<version>-<digest>; every
// later start reuses that directory. The stdio MCP server then runs from it, in this process, exactly as it runs from
// an archive extracted by hand. Standard output belongs to the protocol, so every sentence for a person goes to
// standard error.
//
// What you make (compositions, saved schemas, file-mode output) is kept in ~/.oods-foundry too, so it survives
// upgrades. Set MCP_SCHEMA_STORE_ROOT to keep it somewhere else. Your own objects and traits are read from
// ~/.oods-foundry/objects and ~/.oods-foundry/traits after the shipped ones; set OODS_OBJECTS_DIR and
// OODS_TRAITS_DIR to read them from somewhere else. Your own brands are kept in ~/.oods-foundry/brands and built there,
// outside the runtime; set OODS_BRANDS_DIR to keep them somewhere else.
import { spawnSync } from 'node:child_process';
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

/** The unpacked runtime for this package's archive, unpacking it first if no earlier start has. */
function runtimeDirectory() {
  const target = path.join(HOME, 'runtime', `${pkg.version}-${archive.sha256.slice(0, 12)}`);
  if (fs.existsSync(path.join(target, MARKER))) return target;

  const archivePath = path.join(PACKAGE_DIR, 'runtime', archive.file);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
  if (digest !== archive.sha256) {
    fail(`the runtime archive in this package does not match its recorded digest, so it was not unpacked. Reinstall with npx -y ${pkg.name}@${pkg.version}.`);
  }
  say(`first start of ${pkg.version}: unpacking the runtime into ${target} (once).`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = fs.mkdtempSync(`${target}.partial-`);
  const tar = spawnSync('tar', ['-xzf', archivePath, '-C', staging], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  if (tar.error || tar.status !== 0) {
    fs.rmSync(staging, { recursive: true, force: true });
    fail(`could not unpack the runtime with tar (${(tar.error?.message ?? tar.stderr).trim()}). The tar command must be on the PATH your MCP client starts with.`);
  }
  fs.writeFileSync(path.join(staging, MARKER), `${JSON.stringify({ version: pkg.version, sha256: archive.sha256 }, null, 2)}\n`);
  try {
    fs.renameSync(staging, target);
  } catch (error) {
    // Two clients starting at once: the first rename wins and the other uses its directory.
    fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(path.join(target, MARKER))) throw error;
  }
  return target;
}

const runtime = runtimeDirectory();
if (!process.env.MCP_SCHEMA_STORE_ROOT) {
  process.env.MCP_SCHEMA_STORE_ROOT = HOME;
  process.env.MCP_SCHEMA_STORE_DIR ??= 'schemas';
}
process.env.OODS_OBJECTS_DIR ||= path.join(HOME, 'objects');
process.env.OODS_TRAITS_DIR ||= path.join(HOME, 'traits');
process.env.OODS_BRANDS_DIR ||= path.join(HOME, 'brands');
// The legacy MCP_MAPPINGS_PATH file override takes precedence in the store.
process.env.OODS_MAPPINGS_DIR ||= path.join(HOME, 'mappings');
await import(pathToFileURL(path.join(runtime, 'packages', 'mcp-adapter', 'index.js')).href);
