import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { sampleValue } from '../../src/importer/samples.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as readImport } from '../../src/tools/object.import.read.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { bindRecordSchema } from '../../src/render/record-renderer.js';
let work: string;
const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's240-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
const draft = (schema: unknown) => draftSource({ content: JSON.stringify(schema) });
it('headings identify a record, while a declared prose title stays whole as its summary', () => {
  for (const field of ['subject', 'headline', 'handle', 'caption']) {
    const d = draft({ title: 'Ticket', required: [field], properties: { id: { type: 'integer' }, [field]: { type: 'string' }, description: { type: 'string' } } }).drafts[0];
    expect(d.definition.semantics[field].semantic_type).toBe('text.label');
  }
  const d = draft({ title: 'Trip', 'x-oods': { titleField: 'description' }, properties: { id: { type: 'integer' }, description: { type: 'string', examples: ['A weekend away.'] } } }).drafts[0];
  expect(d.definition.semantics.description.semantic_type).toBe('text.summary');
  expect(d.definition.samples![0].description).toBe('A weekend away.');
  const schema = { version: '2026.02', objectSchema: { id: { type: 'integer', semanticType: d.definition.semantics.id.semantic_type } }, screens: [{ id: 'title', component: 'DetailHeader', props: { titleField: 'id' } }] } as any;
  expect(bindRecordSchema(schema, { id: 3 }).screens[0].props!.title).toBe('Trip 3');
  expect(bindRecordSchema(schema, { id: 'TRIP-003' }).screens[0].props!.title).toBe('Trip 3');
});
it('related records are people or teams, with distinct identities and no row-for-row pairing', () => {
  const result = draft({ $defs: { Shopper: { properties: { id: { type: 'string' }, name: { type: 'string' } } }, Order: { properties: { id: { type: 'string' }, shopper: { $ref: '#/$defs/Shopper' } } } } });
  const shopper = result.drafts.find(d => d.name === 'Shopper')!.definition, order = result.drafts.find(d => d.name === 'Order')!.definition;
  expect(shopper.samples![0].name).toBe('Ava Martin');
  expect(shopper.samples![0].id).toMatch(/^SHOP-/);
  expect(order.samples![0].id).toMatch(/^ORDE-/);
  for (const [i, row] of order.samples!.entries()) expect(row.shopper).not.toBe(shopper.samples![i].id);
  for (const field of ['shipDate', 'dispatched_at', 'deliveryDate']) expect(String(sampleValue({ type: 'string', format: 'date' }, field, 2))).toBe('2026-01-17');
});
it('currency is explicit at acceptance, validates before writing, and timeline uses events without a false warning', async () => {
  const source = { title: 'Purchase', required: ['subject'], properties: { id: { type: 'integer' }, subject: { type: 'string' }, total: { type: 'number' }, currency: { type: 'string', enum: ['EUR'] }, createdAt: { type: 'string', format: 'date-time' } } };
  const staged = await importObjects({ action: 'draft', source: { content: JSON.stringify(source) } });
  const shown = await readImport({ action: 'show', importId: (staged as any).importId, object: 'Purchase' }) as any;
  expect(shown.yaml).not.toContain('money.amount');
  await expect(importObjects({ action: 'apply', importId: (staged as any).importId, objects: [{ name: 'Purchase', currencies: { total: { field: 'absent' } } }] })).rejects.toThrow(/Invalid currency/);
  expect(fs.readdirSync(process.env.OODS_OBJECTS_DIR!)).toEqual([]);
  await importObjects({ action: 'apply', importId: (staged as any).importId, objects: [{ name: 'Purchase', currencies: { total: { field: 'currency' } }, proposals: shown.proposals.filter((p: any) => p.valid && p.trait.name === 'Timestampable').map((p: any) => p.id) }] });
  const screen = await compose({ object: 'Purchase', context: 'timeline', options: { transient: true } });
  expect(screen.warnings?.some((w: any) => String(w.message ?? w).includes('No view_extensions'))).toBe(false);
  expect(screen.schema.objectSchema!.total.money?.currencyField).toBe('currency');
});
it('does not offer GraphQL mutation inputs as record objects', () => {
  const result = draftSource({ format: 'graphql', content: 'type Ticket { id: ID!, subject: String! } input TicketInput { subject: String! } type Mutation { create(input: TicketInput!): Ticket }' });
  expect(result.drafts.map(d => d.name)).toEqual(['Ticket']);
  expect(result.report.some(entry => entry.reason.includes('input type'))).toBe(true);
});

// s241: the sort names its actual field, not the field's data type.
it('names a numeric heading sort by its identifier field', async () => {
  const staged = await importObjects({ action: 'draft', source: { format: 'prisma', content: 'model Membership {\n id Int @id\n accepted Boolean\n}' } }) as any;
  await importObjects({ action: 'apply', importId: staged.importId, objects: [{ name: 'Membership', proposals: [] }] });
  const screen = await compose({ object: 'Membership', context: 'list', options: { transient: true } });
  const walk = (nodes: any[]): any[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
  const sort = walk(screen.schema.screens).find(node => node.collectionControl === 'sort');
  expect(sort.props).toMatchObject({ field: 'id', options: [{ value: 'asc', label: 'Id ascending' }, { value: 'desc', label: 'Id descending' }] });
});
