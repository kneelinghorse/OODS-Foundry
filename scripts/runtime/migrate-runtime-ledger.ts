#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateRuntimeLedger, type RuntimeLedger } from '../../packages/mcp-server/src/lib/runtime-ledger.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = 'artifacts/product-reality/sprint-195/m07/runtime/runtime-cells.v1.json';
const destination = 'packages/mcp-server/registry/runtime-cells.v1.json';
const bytes = fs.readFileSync(path.join(root, source));
const ledger = JSON.parse(bytes.toString('utf8')) as RuntimeLedger;
assert.equal(ledger.head, '39deb793a3161621b5a0893618f9d40201c22256', 'Migration must use the certified Sprint195 runtime receipt');
assert.deepEqual(validateRuntimeLedger(ledger, true), []);
assert.deepEqual(ledger.summary, { cells: 154, pass: 154, typedGap: 0, fail: 0 });
const canonical = { ...ledger, receiptRoot: path.posix.dirname(source) };
const generated = JSON.stringify(canonical, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(path.join(root, destination), 'utf8'), generated, 'Canonical runtime ledger differs from the one-time migration output');
else fs.writeFileSync(path.join(root, destination), generated);
console.log(JSON.stringify({ operation: 'canonical-runtime-ledger-migration', source, destination, head: ledger.head, sourceRetained: true, rowsUnchanged: true, addedMetadata: { receiptRoot: canonical.receiptRoot }, sourceSha256: createHash('sha256').update(bytes).digest('hex'), canonicalSha256: createHash('sha256').update(generated).digest('hex'), ...ledger.summary }, null, 2));
