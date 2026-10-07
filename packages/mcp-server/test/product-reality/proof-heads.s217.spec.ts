import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { handle as health } from '../../src/tools/health.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import { clearRuntimeLedgerMemo } from '../../src/lib/runtime-ledger.js';
import { proofMatchesBuild } from '../../src/lib/visual-proof-ledger.js';
import { projectToolSummary } from '../../src/lib/tool-ledger.js';
import { latestPortableReceipt } from '../../../../scripts/product-reality/s193-tool-truth.mjs';
import { advertisedName } from '../../../../scripts/runtime/tool-names.mjs';

afterEach(() => { delete process.env.MCP_RUNTIME_CELLS_PATH; clearRuntimeLedgerMemo(); });

it('health separates the head a proof measured from the tool census and never omits HTML/fidelity', async () => {
  const result = await health({});
  const proofs = result.productReality as any;
  for (const kind of ['runtime', 'tools', 'release', 'html', 'fidelity']) {
    expect(proofs[kind], kind).not.toBeNull();
    expect(proofs[kind], kind).toHaveProperty('thisBuild', null); // source has no built revision stamp
    expect(proofs[kind], kind).toHaveProperty('head');
  }
  const ledger = JSON.parse(fs.readFileSync('registry/tool-capability-ledger.v1.json', 'utf8'));
  expect(proofs.tools.head).toBe(ledger.portableExecution.bundleHead);
  expect(proofs.tools.sourceHead).toBe(ledger.head);
  expect(proofs.html.cells).toBe(JSON.parse(fs.readFileSync('registry/html-cells.v1.json', 'utf8')).rows.length);
  expect(proofs.fidelity.files).toBeGreaterThan(0);
});

it('a matching source census cannot disguise an older, mixed or missing measurement head', () => {
  const current = 'a'.repeat(40), old = 'b'.repeat(40);
  expect(proofMatchesBuild(current, current)).toBe(true);
  expect(proofMatchesBuild(old, current)).toBe(false);
  expect(proofMatchesBuild(null, current)).toBe(false);
  expect(proofMatchesBuild(current)).toBeNull();
  const ledger = JSON.parse(fs.readFileSync('registry/tool-capability-ledger.v1.json', 'utf8'));
  ledger.rows.find((row: any) => row.registration === 'auto').portableOutcome.bundleHead = old;
  expect(() => projectToolSummary(ledger)).toThrow(/portable outcome not bound/);
});

it('selects a complete passing archive by its recorded execution time, without a sprint lookup table', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'latest-proof-'));
  const write = (file: string, completedAt: string, status = 'pass', names = ['health']) => {
    const full = path.join(folder, 'artifacts/product-reality', file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ status, completedAt, manifest: { commit: 'a'.repeat(40), dirty: false }, tools: { count: names.length, names: names.map(name => advertisedName(name)) }, calls: { outcomes: Object.fromEntries(names.map(name => [name, { outcome: 'pass' }])) } }));
  };
  try {
    write('sprint-999/e2e-old.json', '2026-01-01T00:00:00Z');
    write('sprint-217/e2e-current.json', '2026-09-25T00:00:00Z');
    write('sprint-217/e2e-failed.json', '2026-09-26T00:00:00Z', 'fail');
    write('sprint-217/e2e-missing-tool.json', '2026-09-27T00:00:00Z', 'pass', []);
    expect(latestPortableReceipt(folder, ['health'])).toBe('artifacts/product-reality/sprint-217/e2e-current.json');
    expect(() => latestPortableReceipt(folder, ['health', 'schema'])).toThrow(/No passing archive receipt/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

it('a catalog component loses its generated-app label when the current runtime receipt no longer uses it', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-label-'));
  try {
    const ledger = JSON.parse(fs.readFileSync('registry/runtime-cells.v1.json', 'utf8'));
    for (const row of ledger.rows) row.components = row.components.filter((name: string) => name !== 'Button');
    process.env.MCP_RUNTIME_CELLS_PATH = path.join(folder, 'runtime.json');
    fs.writeFileSync(process.env.MCP_RUNTIME_CELLS_PATH, JSON.stringify(ledger));
    clearRuntimeLedgerMemo();
    const result = await catalog({ detail: 'full', pageSize: 200 });
    expect(result.components.find(component => component.name === 'Button')?.readiness).toBe('react-and-vue');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
