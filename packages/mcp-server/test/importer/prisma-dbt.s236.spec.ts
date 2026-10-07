import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { canonical } from '../../src/importer/source.js';

let folder: string;
beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 'models-import-')); });
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));
const prisma = (content: string) => draftSource({ content, format: 'prisma' });
const dbt = (value: unknown) => draftSource({ content: JSON.stringify(value), format: 'dbt' });
const source = `datasource db {
 provider = "postgresql"
 url = env("MUST_NOT_BE_READ")
}
/// A customer account
model Account {
 /// Database identity
 id String @id @default(uuid()) @db.Uuid
 name String @unique @db.VarChar(80)
 created DateTime @default(now())
 modified DateTime @updatedAt
 records Record[]
 @@map("accounts")
}
model Record {
 id Int @id @default(autoincrement())
 accountId String @db.Uuid
 account Account @relation(fields: [accountId], references: [id])
 status Status @default(new)
 due DateTime? @db.Date
 code String? @map("external_code")
}
enum Status {
 new
 paid
}`;
it('reads Prisma models/enums/keys/defaults/docs/native types and projects relation navigation through its FK', () => {
  const result = prisma(source);
  const account = result.drafts.find(d => d.name === 'Account')!, record = result.drafts.find(d => d.name === 'Record')!;
  expect(account.definition.object.description).toBe('A customer account');
  expect(account.definition.schema.id).toMatchObject({ description: 'Database identity', type: 'uuid', readOnly: true });
  expect(account.definition.schema.name.validation?.maxLength).toBe(80);
  expect(result.hub.$defs.Account['x-prisma-table']).toBe('accounts');
  expect(result.hub.$defs.Record.properties.code['x-prisma-column']).toBe('external_code');
  expect(record.definition.schema.due.type).toBe('date?');
  expect(record.definition.schema.status.validation?.enum).toEqual(['new', 'paid']);
  expect(record.definition.relationships).toEqual([{ target: 'Account', via: 'accountId', cardinality: 'many-to-one', label: 'Account' }]);
  expect(record.definition.schema).not.toHaveProperty('account');
  expect(account.proposals).toContainEqual(expect.objectContaining({ trait: expect.objectContaining({ name: 'Timestampable' }), grade: 'strong' }));
  expect(result.report.some(row => row.reason.includes('never executed'))).toBe(true);
  expect(canonical(prisma(source))).toBe(canonical(result));
});
it('resolves multi-file Prisma declarations and rejects duplicates rather than silently overriding them', () => {
  fs.writeFileSync(path.join(folder, 'account.prisma'), source.slice(0, source.indexOf('model Record')));
  fs.writeFileSync(path.join(folder, 'record.prisma'), source.slice(source.indexOf('model Record')));
  expect(draftSource({ path: folder }).drafts.map(d => d.name).sort()).toEqual(['Account', 'Record']);
  fs.writeFileSync(path.join(folder, 'duplicate.prisma'), 'model Account {\n id Int\n}\n');
  expect(() => draftSource({ path: folder })).toThrow(/duplicate Prisma/);
});
it('dbt YAML declarations provide read-only objects, constraints, relationships and preserved metadata', () => {
  const result = dbt({ version: 2, models: [
    { name: 'customers', columns: [{ name: 'id', data_type: 'integer', data_tests: ['not_null', 'unique'] }] },
    { name: 'orders', config: { contract: { enforced: true }, meta: { team: 'sales' } }, columns: [
      { name: 'id', data_type: 'integer', constraints: [{ type: 'primary_key' }] },
      { name: 'customer_id', data_type: 'integer', data_tests: [{ relationships: { arguments: { to: "ref('customers')", field: 'id' } } }] },
      { name: 'state', data_type: 'text', description: 'Order state', tests: [{ accepted_values: { values: ['new', 'paid'] } }] },
      { name: 'unknown', description: "{{ doc('not_executed') }}" },
    ] },
  ] });
  const orders = result.drafts.find(d => d.name === 'Orders')!;
  expect(orders.definition.metadata.supportedContexts).toEqual(['list', 'detail']);
  expect(orders.definition.schema.id.required).toBe(true);
  expect(orders.definition.schema.state.validation?.enum).toEqual(['new', 'paid']);
  expect(orders.definition.relationships?.[0].target).toBe('Customers');
  expect(result.hub.$defs.Orders['x-dbt'].contract.enforced).toBe(true);
  expect(result.report.some(row => row.reason.includes('no template evaluated'))).toBe(true);
  expect(orders.definition.schema).not.toHaveProperty('unknown');
});
it('dbt snapshots declare history and semantic models add typed dimensions, measures and key evidence', () => {
  const result = dbt({ snapshots: [{ name: 'customers_history', columns: [{ name: 'id', data_type: 'integer' }] }], models: [{ name: 'orders', columns: [] }], semantic_models: [{ name: 'orders_metrics', model: "ref('orders')", entities: [{ name: 'order_id', type: 'primary' }], dimensions: [{ name: 'ordered_at', type: 'time' }, { name: 'channel', type: 'categorical' }], measures: [{ name: 'revenue', agg: 'sum', description: 'Booked revenue' }] }] });
  const history = result.drafts.find(d => d.name === 'CustomersHistory')!;
  expect(history.definition.metadata.supportedContexts).toEqual(['list', 'detail', 'timeline']);
  expect(history.proposals).toContainEqual(expect.objectContaining({ trait: expect.objectContaining({ name: 'Supersedable' }), grade: 'strong', valid: true }));
  const orders = result.drafts.find(d => d.name === 'Orders')!;
  expect(orders.definition.schema.revenue.type).toBe('number');
  expect(orders.definition.schema.ordered_at.type).toBe('datetime');
  expect(orders.definition.semantics.order_id.semantic_type).toBe('text.label');
});
it('reads manifest resource/test nodes without invoking a dbt command', () => {
  const result = dbt({ metadata: { dbt_schema_version: 'https://schemas.getdbt.com/dbt/manifest/v12.json' }, nodes: {
    'model.example.orders': { resource_type: 'model', name: 'orders', columns: { id: { name: 'id', data_type: 'integer' }, state: { name: 'state', data_type: 'text' } } },
    'test.example.state': { resource_type: 'test', column_name: 'state', test_metadata: { name: 'accepted_values', kwargs: { model: "{{ ref('orders') }}", values: ['new', 'paid'] } } },
  } });
  expect(result.drafts[0].definition.schema.state.validation?.enum).toEqual(['new', 'paid']);
  expect(result.counts.total).toBe(result.counts.mapped + result.counts.proposed + result.counts.unmapped);
});
it('reads a dbt properties folder while leaving SQL/Jinja unevaluated and produces deterministic bytes', () => {
  fs.writeFileSync(path.join(folder, 'dbt_project.yml'), 'name: example\nversion: 1.0\n');
  fs.writeFileSync(path.join(folder, 'schema.yml'), 'version: 2\nmodels:\n  - name: records\n    columns:\n      - name: id\n        data_type: integer\n');
  fs.writeFileSync(path.join(folder, 'records.sql'), "{{ dangerous_function() }} select * from {{ ref('never_run') }}");
  const result = draftSource({ path: folder });
  expect(result.drafts[0].name).toBe('Records');
  expect(result.report.some(row => row.file === 'records.sql' && row.reason.includes('never evaluated'))).toBe(true);
  expect(canonical(draftSource({ path: folder }))).toBe(canonical(result));
});

it('reads embedded dbt semantic column declarations and simple metrics without guessing unnamed types', () => {
  const result = dbt({ models: [{ name: 'customers', semantic_model: { enabled: true }, columns: [
    { name: 'customer_id', entity: { type: 'primary' } }, { name: 'full_name', dimension: { type: 'categorical' } },
    { name: 'first_ordered_at', dimension: { type: 'time' } }, { name: 'lifetime_spend' },
  ], metrics: [{ name: 'customers', expr: 'customer_id', type: 'simple', agg: 'count_distinct' }, { name: 'lifetime_spend', type: 'simple', agg: 'sum' }] }] });
  const schema = result.drafts[0].definition.schema;
  expect(schema.customer_id.type).toBe('string');
  expect(schema.full_name.type).toBe('string');
  expect(schema.first_ordered_at.type).toBe('datetime');
  expect(schema.lifetime_spend.type).toBe('number');
});
