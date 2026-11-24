import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { dump } from 'js-yaml';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handle as importObjects, readHandle } from '../../src/tools/object.import.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { SourceInput } from '../../src/importer/source.js';

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'accept-list-'));
  for (const [key, subdir] of Object.entries({ OODS_FOUNDRY_HOME: 'home', OODS_OBJECTS_DIR: 'objects', OODS_TRAITS_DIR: 'traits', MCP_SCHEMA_STORE_ROOT: 'store' })) vi.stubEnv(key, path.join(folder, subdir));
  reloadDefinitions();
});
afterEach(() => { vi.unstubAllEnvs(); reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true }); });

const sql = 'CREATE TABLE accounts (id integer PRIMARY KEY, name text); CREATE TABLE charges (id integer PRIMARY KEY, account_id integer REFERENCES accounts(id), name text);';
async function draft(source: SourceInput = { format: 'sql', content: sql }) {
  const result = await importObjects({ action: 'draft', source });
  if (result.action !== 'draft') throw Error('Expected draft');
  return result;
}
async function show(importId: string, object: string) {
  const result = await readHandle({ action: 'show', importId, object });
  if (result.action !== 'show') throw Error('Expected show');
  return result;
}

it('requires the source and accepts a reviewed list id in the same call, after every definition validates', async () => {
  const summary = await draft();
  expect(summary.proposalLists).toBe(1);
  const view = await show(summary.importId, 'Accounts');
  const [proposal] = view.lists;
  expect(proposal).toMatchObject({ grade: 'strong', valid: true, effects: expect.stringContaining('Charges') });
  const target = { name: 'Accounts', proposals: [proposal.id] };
  await expect(importObjects({ action: 'apply', importId: summary.importId, objects: [target] })).rejects.toThrow(/lists Charges/);
  expect(fs.readdirSync(process.env.OODS_OBJECTS_DIR!).filter(name => name.endsWith('.yaml'))).toEqual([]);
  await importObjects({ action: 'apply', importId: summary.importId, objects: [target, { name: 'Charges' }] });
  expect(loadObject('Accounts').metadata.relatedLists).toEqual([proposal.list]);
  expect(loadObject('Charges').metadata.relatedLists ?? []).toEqual([]);
  await importObjects({ action: 'apply', importId: summary.importId, objects: [target], overwrite: true });
  expect(loadObject('Accounts').metadata.relatedLists).toHaveLength(1);

  const own = structuredClone(loadObject('Accounts'));
  own.metadata.relatedLists![0].label = 'My existing list';
  fs.writeFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'Accounts.object.yaml'), dump(own)); reloadDefinitions();
  await expect(importObjects({ action: 'apply', importId: summary.importId, objects: [target], overwrite: true })).rejects.toThrow(/list id charges is already taken/);
  expect(loadObject('Accounts').metadata.relatedLists![0].label).toBe('My existing list');
});

it('requires confirmation for a team replacement of a shipped object before writing either selected object', async () => {
  const summary = await draft({ format: 'sql', content: sql.replaceAll('accounts', '"User"') });
  const view = await show(summary.importId, 'User');
  const prior = loadObject('User');
  await expect(importObjects({ action: 'apply', importId: summary.importId, objects: [{ name: 'User', proposals: [view.lists[0].id] }, { name: 'Charges' }] })).rejects.toThrow(/confirmShipped/);
  expect(loadObject('User')).toEqual(prior);
  expect(fs.readdirSync(process.env.OODS_OBJECTS_DIR!).filter(name => name.endsWith('.yaml'))).toEqual([]);
});

it('validates draft and show replies in both output contracts, including their previous shapes', async () => {
  const current = await draft();
  const currentShow = await show(current.importId, 'Accounts');
  const { proposalLists, ...older } = current;
  const { lists, ...olderShow } = currentShow;
  expect(proposalLists).toBe(lists.length);
  for (const name of ['object.import', 'object.import.read']) {
    const validator = new Ajv2020({ strict: false }).compile(JSON.parse(fs.readFileSync(new URL(`../../src/schemas/${name}.output.json`, import.meta.url), 'utf8')));
    for (const reply of [current, currentShow, older, olderShow]) expect(validator(reply), JSON.stringify(validator.errors)).toBe(true);
  }
});

it('compares accepted lists independently from base fields and explains what overwrite will drop', async () => {
  const summary = await draft();
  const view = await show(summary.importId, 'Accounts');
  const [proposal] = view.lists;
  expect(view.diff.lists).toMatchObject({ open: ['charges'], kept: [], gone: [] });
  await importObjects({ action: 'apply', importId: summary.importId, objects: [{ name: 'Accounts', proposals: [proposal.id] }, { name: 'Charges' }] });
  const identical = await draft();
  expect((await show(identical.importId, 'Accounts')).diff).toMatchObject({
    status: 'unchanged', lists: { kept: ['charges'], gone: [], open: [], overwrite: expect.stringContaining('accept again') },
  });
  const removed = await draft({ format: 'sql', content: sql.replace(' REFERENCES accounts(id)', '') });
  expect((await show(removed.importId, 'Accounts')).diff).toMatchObject({ status: 'changed', lists: { kept: [], gone: ['charges'], open: [] } });
  await importObjects({ action: 'apply', importId: identical.importId, objects: [{ name: 'Accounts' }], overwrite: true });
  expect(loadObject('Accounts').metadata.relatedLists ?? []).toEqual([]);
});

it('replaces a paired Prisma inverse and compares the same source without inventing field, relationship or sample changes', async () => {
  const source: SourceInput = { format: 'prisma', content: `model BillingAccount {
 id Int @id
 name String
 payments Charge[]
}
model Charge {
 id Int @id
 billingId Int
 account BillingAccount @relation(fields: [billingId], references: [id])
 name String
}` };
  const summary = await draft(source);
  const proposal = (await show(summary.importId, 'BillingAccount')).lists[0];
  expect(proposal.backSide).toBe('payments');
  const objects = [{ name: 'BillingAccount', proposals: [proposal.id] }, { name: 'Charge' }];
  await importObjects({ action: 'apply', importId: summary.importId, objects });
  const accepted = loadObject('BillingAccount');
  expect(accepted.schema.payments).toBeUndefined();
  expect(accepted.samples?.some(row => Object.hasOwn(row, 'payments'))).toBe(false);
  expect(accepted.relationships?.some(edge => edge.via === 'payments')).toBe(false);
  const again = await draft(source);
  expect((await show(again.importId, 'BillingAccount')).diff).toMatchObject({
    fields: { added: [], changed: [], removed: [] }, relationshipsChanged: false, status: 'unchanged', lists: { kept: ['charge'] },
  });
});

it('includes the accepted list in both generated workflow apps, which compile under their own strict settings', async () => {
  const { handle: compose } = await import('../../src/tools/design.compose.js');
  const { handle: generate } = await import('../../src/tools/code.generate.js');
  const { typecheckWorkflow } = await import('../product-reality/workflow-typecheck.js');
  const source: SourceInput = { format: 'sql', content: sql.replace('name text);', 'name text NOT NULL, created_at timestamptz DEFAULT now());') };
  const summary = await draft(source);
  const target = await show(summary.importId, 'Accounts');
  const timestamp = target.proposals.find(p => p.trait.name === 'Timestampable')!;
  expect(timestamp.valid).toBe(true);
  await importObjects({ action: 'apply', importId: summary.importId, objects: [{ name: 'Accounts', proposals: [target.lists[0].id, timestamp.id] }, { name: 'Charges' }] });
  const schema = (await compose({ object: 'Accounts', context: 'workflow', options: { transient: true } })).schema!;
  for (const framework of ['react','vue'] as const) {
    const result = await generate({ schema, framework, profile: 'build', options: { output: 'application' } });
    const artifact = result.artifact!;
    expect(artifact.files.find(file => file.path === 'src/related-data.ts')?.contents).toContain('Charges for {name}');
    const checked = typecheckWorkflow(artifact);
    expect(checked.status, checked.stderr + checked.stdout).toBe(0);
  }
}, 120_000);
