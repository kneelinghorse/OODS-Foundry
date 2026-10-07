import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { canonical } from '../../src/importer/source.js';
import { sqlStatements } from '../../src/importer/readers/sql.js';

let folder: string;
beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-import-')); });
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));
const sql = (content: string) => draftSource({ content, format: 'sql' });
const write = (name: string, content: string) => { const file = path.join(folder, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const schema = `CREATE TYPE payment_state AS ENUM ('new', 'paid');
CREATE TABLE customers (id integer PRIMARY KEY, name varchar(80) NOT NULL UNIQUE);
CREATE TABLE invoices (id serial PRIMARY KEY, customer_id integer REFERENCES customers(id), state payment_state NOT NULL DEFAULT 'new', amount numeric CHECK (amount >= 0 AND amount <= 100), created_at timestamp DEFAULT now(), due date);
COMMENT ON TABLE invoices IS 'Customer invoices';
COMMENT ON COLUMN invoices.amount IS 'Net amount';
CREATE VIEW invoice_totals AS SELECT id, amount FROM invoices;`;
it('reads keys, enums, literal/default-now values, CHECKs, descriptions, relations and read-only views', () => {
  const result = sql(schema);
  expect(result.drafts.map(d => d.name)).toContain('Invoices');
  const invoice = result.drafts.find(d => d.name === 'Invoices')!;
  expect(invoice.definition.schema.state).toMatchObject({ required: true, default: 'new', validation: { enum: ['new', 'paid'] } });
  expect(invoice.definition.schema.amount).toMatchObject({ description: 'Net amount', validation: { minimum: 0, maximum: 100 } });
  expect(invoice.definition.relationships).toEqual([{ target: 'Customers', via: 'customer_id', cardinality: 'many-to-one', label: 'customer id' }]);
  expect(result.drafts.findIndex(d => d.name === 'Customers')).toBeLessThan(result.drafts.findIndex(d => d.name === 'Invoices'));
  expect(invoice.proposals).toContainEqual(expect.objectContaining({ trait: expect.objectContaining({ name: 'Timestampable' }), grade: 'strong', valid: true }));
  expect(result.drafts.find(d => d.name === 'InvoiceTotals')!.definition.metadata.supportedContexts).toEqual(['list', 'detail']);
  expect(canonical(sql(schema))).toBe(canonical(result));
  expect(result.counts.total).toBe(result.counts.mapped + result.counts.proposed + result.counts.unmapped);
  expect(result.hub['x-oods'].provenance['/$defs/Invoices/properties/amount']).toEqual({ file: 'Inline.sql', pointer: '/statements/2/columns/3' });
});
it('replays numeric Flyway versions including ALTER, DROP and RENAME to the final DDL shape', () => {
  write('V1__initial.sql', 'CREATE TABLE old (id integer PRIMARY KEY, old_name text, obsolete boolean); CREATE TABLE dropped (id integer);');
  write('V10__rename.sql', "ALTER TABLE old RENAME TO records; ALTER TABLE records RENAME COLUMN old_name TO name; DROP TABLE dropped;");
  write('V2__alter.sql', "ALTER TABLE old ADD COLUMN score integer NOT NULL DEFAULT 1; ALTER TABLE old DROP COLUMN obsolete; ALTER TABLE old ALTER COLUMN old_name SET NOT NULL;");
  const result = draftSource({ path: folder });
  const equivalent = sql('CREATE TABLE records (id integer PRIMARY KEY, name text NOT NULL, score integer NOT NULL DEFAULT 1);');
  expect(result.drafts.map(d => d.name)).toEqual(['Records']);
  expect(result.drafts[0].definition.schema).toEqual(equivalent.drafts[0].definition.schema);
  expect(canonical(draftSource({ path: folder }))).toBe(canonical(result));
});
it('honours the Drizzle journal, reports unlisted files, and never executes an undo migration', () => {
  write('meta/_journal.json', JSON.stringify({ entries: [{ idx: 0, tag: '0009_initial' }, { idx: 1, tag: '0001_later' }] }));
  write('0009_initial.sql', 'CREATE TABLE records (id integer);');
  write('0001_later.sql', 'ALTER TABLE records ADD COLUMN name text;');
  write('0003_unlisted.sql', 'DROP TABLE records;');
  const result = draftSource({ path: folder });
  expect(result.drafts[0].definition.schema).toHaveProperty('name');
  expect(result.report).toContainEqual(expect.objectContaining({ file: '0003_unlisted.sql', outcome: 'unmapped', reason: expect.stringContaining('Not listed') }));
  fs.rmSync(path.join(folder, 'meta'), { recursive: true }); fs.rmSync(path.join(folder, '0003_unlisted.sql'));
  fs.rmSync(path.join(folder, '0001_later.sql'));
  write('001_initial.up.sql', 'CREATE TABLE kept (id integer);'); write('001_initial.down.sql', 'DROP TABLE kept;');
  expect(draftSource({ path: folder }).drafts.map(d => d.name)).toContain('Kept');
});
it('reads timestamp-named Prisma migration folders and Rails structure.sql as files', () => {
  write('20250101_init/migration.sql', 'CREATE TABLE sample (id integer);');
  write('20250201_update/migration.sql', 'ALTER TABLE sample ADD COLUMN name text;');
  expect(draftSource({ path: folder }).drafts[0].definition.schema).toHaveProperty('name');
  write('structure.sql', schema);
  expect(draftSource({ path: path.join(folder, 'structure.sql') }).drafts).toHaveLength(3);
});
it('splits quotes and function bodies without running code, and names unsupported elements', () => {
  const content = "CREATE TABLE entries (id int, note text DEFAULT 'a; b'); DO $$ BEGIN RAISE NOTICE 'never;run'; END $$; CREATE TABLE next_entry (id int);";
  expect(sqlStatements(content)).toHaveLength(3);
  const result = sql(content);
  expect(result.drafts).toHaveLength(2);
  expect(result.drafts.find(d => d.name === 'Entries')!.definition.schema.note.default).toBe('a; b');
  expect(result.report).toContainEqual(expect.objectContaining({ pointer: '/statements/1', outcome: 'unmapped', reason: expect.stringContaining('no code') }));
  const unknown = sql('CREATE TABLE exotic (id int, shape geometry);');
  expect(unknown.report.some(row => row.reason.includes('geometry'))).toBe(true);
});
it('removes dropped constraints and updates foreign keys when a table or column is renamed', () => {
  const result = sql(`CREATE TABLE parent(id integer PRIMARY KEY); CREATE TABLE child(id integer, parent_id integer, CONSTRAINT key UNIQUE(id), FOREIGN KEY(parent_id) REFERENCES parent(id)); ALTER TABLE parent RENAME TO account; ALTER TABLE account RENAME COLUMN id TO account_id; ALTER TABLE child DROP CONSTRAINT key;`);
  expect(result.drafts.find(d => d.name === 'Child')!.definition.relationships?.[0].target).toBe('Account');
  expect(result.hub.$defs.Child.properties.id['x-oods']?.unique).not.toBe(true);
});
it('keeps composite keys and unsupported checks honest instead of inventing scalar uniqueness', () => {
  const result = sql("CREATE TABLE tuple (a int, b int, PRIMARY KEY(a,b), CHECK (a + b > 0));");
  expect(result.hub.$defs.Tuple.properties.a['x-oods']).toMatchObject({ primaryKey: true });
  expect(result.hub.$defs.Tuple.properties.a['x-oods'].unique).not.toBe(true);
  expect(result.report.some(row => row.reason.includes('CHECK expression preserved'))).toBe(true);
});

it('keeps columns for modern generated storage and partitioned parent tables without executing expressions', () => {
  const result = draftSource({ format: 'sql', content: "CREATE TABLE film (id int primary key, hours numeric GENERATED ALWAYS AS (id / 60.0) VIRTUAL); CREATE TABLE payments (id int, amount numeric) PARTITION BY RANGE (id);" });
  expect(result.drafts.find(d => d.name === 'Film')!.definition.schema.hours.readOnly).toBe(true);
  expect(result.drafts.find(d => d.name === 'Payments')!.definition.schema.amount.type).toBe('number?');
  expect(result.report.some(row => row.reason.includes('Partition routing'))).toBe(true);
});

it('ignores nested migration comments and preserves quoted defaults and ordinary virtual columns', () => {
  const content = "/* warning `uid` /* nested */ */ CREATE TABLE t (id int primary key, virtual text DEFAULT '/* source text */'); /* warning `uid` */ CREATE UNIQUE INDEX idx ON t(virtual);";
  const result = draftSource({ format: 'sql', content });
  expect(result.drafts[0].definition.schema.virtual.default).toBe('/* source text */');
  expect(result.hub.$defs.T.properties.virtual['x-oods'].unique).toBe(true);
});
