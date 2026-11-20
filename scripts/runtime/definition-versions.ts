import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { loadDefinitionYaml } from '../../packages/mcp-server/src/objects/definition-yaml.js';
import { shippedTrackedFiles } from './assemble.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
const baselinePath = path.join(repo, 'scripts/runtime/definition-versions-baseline.json');
type Header = { name: string; version: string };
type Entry = Header & { digest: string };
type Definition = { object?: Header; trait?: Header; metadata?: { changelog?: { version: string }[] } };
type Snapshot = Record<string, Entry>;

function sortedKeys(_key: string, value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  return value;
}

export function readDefinitions(root: string) {
  const files = ['domains', 'objects', 'traits'].flatMap(dir =>
    fs.readdirSync(path.join(root, dir), { recursive: true, encoding: 'utf8' })
      .filter(file => /\.(?:object|trait)\.ya?ml$/.test(file)).map(file => path.join(dir, file)));
  const entries: Snapshot = {};
  const changes = new Map<string, string[]>();
  for (const file of shippedTrackedFiles(files.sort(), root)) {
    const definition = loadDefinitionYaml(fs.readFileSync(path.join(root, file), 'utf8')) as Definition;
    const header = definition.object ?? definition.trait;
    if (!header || !semver.valid(header.version)) throw new Error(`Invalid definition version in ${file}`);
    entries[file] = { name: header.name, version: header.version,
      digest: createHash('sha256').update(JSON.stringify(definition, sortedKeys)).digest('hex') };
    if (definition.object) changes.set(file, (definition.metadata?.changelog ?? []).map(item => item.version));
  }
  return { entries, changes };
}

export function definitionVersionProblems(root = repo, baseline: Snapshot = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).definitions) {
  const { entries, changes } = readDefinitions(root);
  const changelog = fs.readFileSync(path.join(root, 'packages/foundry/CHANGELOG.md'), 'utf8').split(/^## /m)[1] ?? '';
  const problems: string[] = [];
  for (const [file, entry] of Object.entries(entries)) {
    const old = baseline[file];
    if (old?.digest === entry.digest) continue;
    if (old && !semver.gt(entry.version, old.version)) problems.push(`${file}: changed at ${entry.version}, baseline ${old.version}`);
    if (changes.has(file) && !changes.get(file)!.includes(entry.version)) problems.push(`${file}: missing object changelog entry for ${entry.version}`);
    if (!changelog.split(/[^\w-]+/).includes(entry.name)) problems.push(`${file}: ${entry.name} missing from the current release notes`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? repo);
  if (process.argv[3] === '--write-baseline' && process.argv[4]) {
    fs.writeFileSync(baselinePath, JSON.stringify({ source: process.argv[4], definitions: readDefinitions(root).entries }, null, 2) + '\n');
  } else {
    const problems = definitionVersionProblems(root);
    console.log(JSON.stringify({ status: problems.length ? 'fail' : 'pass', problems }, null, 2));
    if (problems.length) process.exitCode = 1;
  }
}
