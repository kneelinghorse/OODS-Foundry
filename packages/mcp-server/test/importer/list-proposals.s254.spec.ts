import { dump } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { shapeOfDefinition } from '../../src/compose/related-records.js';
import { draftSource } from '../../src/importer/draft.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { validateDefinition } from '../../src/tools/object.validate.js';

const sql = 'CREATE TABLE accounts (id integer PRIMARY KEY, name text); CREATE TABLE charges (id integer PRIMARY KEY, account_id integer REFERENCES accounts(id), name text);';
const draftSql = () => draftSource({ format: 'sql', content: sql, name: 'accounts.sql' });

describe('related lists from declared keys', () => {
  it('checks a list against the incoming source shape before either definition is registered', () => {
    const drafts = draftSql().drafts;
    const target = drafts.find(draft => draft.name === 'Accounts')!.definition;
    const source = drafts.find(draft => draft.name === 'Charges')!.definition;
    target.metadata.relatedLists = [{ id: 'charges', label: 'Charges for {name}', empty: 'No charge here names {name}.', sources: [{ from: 'Charges', via: 'account_id' }] }];
    const names = drafts.map(draft => draft.name);
    const lookup = (name: string) => name === 'Charges' ? shapeOfDefinition(source, composeObject(source)) : undefined;
    expect(validateDefinition(dump(target), names).valid).toBe(false);
    expect(validateDefinition(dump(target), names, lookup).errors).toEqual([]);
    target.metadata.relatedLists[0].sources[0].via = 'missing';
    expect(validateDefinition(dump(target), names, lookup).valid).toBe(false);
  });
});

const prisma = `model BillingAccount {
 id Int @id
 name String
 payments Charge[]
}
model Charge {
 id Int @id
 billingId Int
 account BillingAccount @relation(fields: [billingId], references: [id])
 name String
}`;
const relationships = { to: "ref('accounts')", field: 'id' };
const dbt = { version: 2, models: [
  { name: 'accounts', columns: [{ name: 'id', data_type: 'integer', constraints: [{ type: 'primary_key' }] }] },
  { name: 'charges', columns: [{ name: 'id', data_type: 'integer' }, { name: 'account_id', data_type: 'integer', tests: [{ relationships }] }] },
] };
const odata = (navigation: boolean) => ({ $Version: '4.01', Demo: {
  Account: { $Kind: 'EntityType', $Key: ['ID'], ID: { $Type: 'Edm.Int32' }, charges: { $Kind: 'NavigationProperty', $Collection: true, $Type: 'Demo.Charge' } },
  Charge: { $Kind: 'EntityType', $Key: ['ID'], ID: { $Type: 'Edm.Int32' },
    accountId: { $Type: 'Edm.Int32', '@Common.ValueList': { CollectionPath: 'Accounts', Parameters: [{ LocalDataProperty: { $PropertyPath: 'accountId' }, ValueListProperty: 'ID' }] } },
    ...(navigation ? { account: { $Kind: 'NavigationProperty', $Type: 'Demo.Account', $ReferentialConstraint: { accountId: 'ID' } } } : {}),
  }, Container: { $Kind: 'EntityContainer', Accounts: { $Collection: true, $Type: 'Demo.Account' } },
} });

it.each([
  ['sql', sql, 'Charges for {name}', 'account_id'],
  ['prisma', prisma, 'Charge records in Payments for {name}', 'billingId'],
  ['dbt', JSON.stringify(dbt), 'Charges for {name}', 'account_id'],
  ['odata', JSON.stringify(odata(true)), 'Charges for {name}', 'accountId'],
] as const)('%s proposes the inverse on the referenced object, with a declared key and inspectable evidence', (format, content, label, via) => {
  const result = draftSource({ format, content });
  const proposals = result.drafts.flatMap(d => d.lists ?? []);
  expect(proposals).toHaveLength(1);
  expect(proposals[0]).toMatchObject({ grade: 'strong', valid: true, errors: [], list: { label, sources: [{ via }] }, evidence: [{ kind: 'declaration', file: expect.any(String), pointer: expect.any(String) }] });
  expect(result.counts.total).toBe(result.counts.mapped + result.counts.proposed + result.counts.unmapped);
});

it('keeps OData value helps out of proposed lists unless navigation declares the same key', () => {
  const result = draftSource({ format: 'odata', content: JSON.stringify(odata(false)) });
  expect(result.drafts.flatMap(d => d.lists ?? [])).toEqual([]);
  expect(result.report.some(row => row.reason.includes('the OData value help'))).toBe(true);
});

it('lists a producer’s stored hub key, while references, names and declarations without a field give no lists', () => {
  const result = draftSource({ content: JSON.stringify({ $defs: {
    Customer: { type: 'object', properties: { id: { type: 'integer' } } },
    Charge: { type: 'object', properties: { id: { type: 'integer' }, buyer_id: { type: 'integer' }, customer_id: { type: 'integer' }, reference: { $ref: '#/$defs/Customer' } },
      'x-oods': { relationships: ['buyer_id', 'absent'].map(via => ({ via, target: 'Customer', cardinality: 'many-to-one', label: via })) } },
  } }) });
  expect(result.drafts.flatMap(d => d.lists ?? []).map(p => p.list.sources[0].via)).toEqual(['buyer_id']);
});

it('explains why compound link records, shared keys and a reference to a non-record key do not get lists', () => {
  const result = draftSource({ format: 'sql', content: sql + `
    CREATE TABLE aliases (id integer PRIMARY KEY REFERENCES accounts(id));
    CREATE TABLE links (account_id integer REFERENCES accounts(id), charge_id integer REFERENCES charges(id), PRIMARY KEY(account_id,charge_id));` });
  expect(result.drafts.flatMap(d => d.lists ?? [])).toHaveLength(1);
  expect(result.report.filter(row => row.reason.includes('on this link record'))).toHaveLength(2);
  expect(result.report.filter(row => row.reason.includes('source record’s primary key'))).toHaveLength(1);
  const other = draftSource({ format: 'prisma', content: prisma.replace('name String','name String @unique').replace('references: [id]','references: [name]') });
  expect(other.drafts.flatMap(d => d.lists ?? [])).toEqual([]);
  expect(other.report.some(row => row.reason.includes('references name instead of the record key id'))).toBe(true);
});

it('keeps the actual referenced SQL and dbt column so a list cannot match on a different identifier', () => {
  const alternate = sql.replace('name text);', 'name text UNIQUE);').replace('accounts(id)', 'accounts(name)');
  for (const result of [draftSource({ format: 'sql', content: alternate }), draftSource({ format: 'dbt', content: JSON.stringify(dbt).replace('"field":"id"', '"field":"external_id"') })]) {
    expect(result.drafts.flatMap(d => d.lists ?? [])).toEqual([]);
    expect(result.report.some(row => row.reason.includes('instead of the record key id'))).toBe(true);
  }
});

it('keeps producer names intact in empty states and identifies the stored field when several keys point to the same record', () => {
  const result = draftSource({ format: 'sql', content: `CREATE TABLE accounts (id integer PRIMARY KEY);
    CREATE TABLE movies (id integer PRIMARY KEY, reviewed_by integer REFERENCES accounts(id), updated_by integer REFERENCES accounts(id));
    CREATE TABLE children (id integer PRIMARY KEY, account_id integer REFERENCES accounts(id));` });
  const lists = result.drafts.find(d => d.name === 'Accounts')!.lists!.map(p => p.list);
  expect(lists).toContainEqual(expect.objectContaining({ label: 'Movies with “Reviewed by” set to {name}', empty: 'No records from Movies have “Reviewed by” set to {name}.', collapsed: true }));
  expect(lists).toContainEqual(expect.objectContaining({ label: 'Children for {name}', empty: 'No records from Children match {name}.' }));
});
