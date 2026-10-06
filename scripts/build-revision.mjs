#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2];
if (!output) throw new Error('A build revision output path is required.');
const args = process.argv.slice(3);
const explicit = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (!['--commit', '--structured-data-manifest-hash'].includes(key) || !value || key in explicit) {
    throw new Error('Expected --commit <40hex> and --structured-data-manifest-hash <sha256:64hex>.');
  }
  explicit[key] = value;
}
if (args.length && (!/^[a-f0-9]{40}$/.test(explicit['--commit'] ?? '') || !/^sha256:[a-f0-9]{64}$/.test(explicit['--structured-data-manifest-hash'] ?? ''))) {
  throw new Error('Explicit build revision requires both a 40hex commit and sha256:64hex structured-data manifest hash.');
}
// Assembly stamps the manifest's source identity without requiring git or host data.
// s211-m01: the release this build is part of, from the repository's own manifest, so health can report it where no
// repository ships (the archive, the package). Omitted when the script runs without that manifest.
const release = existsSync(path.join(root, 'package.json')) ? JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version : undefined;
const revision = {
  commit: explicit['--commit'] ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  structuredDataManifestHash: explicit['--structured-data-manifest-hash'] ?? `sha256:${createHash('sha256').update(readFileSync(path.join(root, 'artifacts/structured-data/manifest.json'))).digest('hex')}`,
  ...(typeof release === 'string' ? { release } : {}),
};
mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
writeFileSync(output, JSON.stringify(revision, null, 2) + '\n');
