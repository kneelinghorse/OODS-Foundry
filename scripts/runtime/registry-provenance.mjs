#!/usr/bin/env node
/** Distributed citations identify source bytes; they never promote a historical source to fresh runtime proof. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = JSON.parse(fs.readFileSync(new URL('./registry-provenance.sources.json', import.meta.url), 'utf8'));
const references = Object.fromEntries(Object.entries(sources).map(([id, { source, title, kind }]) => {
  assert(!path.isAbsolute(source) && !source.split('/').includes('..'));
  const bytes = fs.readFileSync(path.join(root, source));
  return [id, { title, kind, sha256: createHash('sha256').update(bytes).digest('hex'), sourceBytes: bytes.length, availability: 'Citation only; the source document is not included in this distribution.', verificationScope: 'Source identity, not a claim of a new test run or certification.' }];
}));
const output = path.join(root, 'objects/provenance.v1.json');
const text = JSON.stringify({ schemaVersion: '1.0.0', references }, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text, 'Registry provenance differs from its authoritative sources');
else fs.writeFileSync(output, text);
console.log(JSON.stringify({ references: Object.keys(references).length, check: process.argv.includes('--check') }));
