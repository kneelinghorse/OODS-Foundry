import fs from 'node:fs';
import { expect, it } from 'vitest';
import { getObjectFilePath, loadObject } from '../../src/objects/object-loader.js';
import { handle as validate } from '../../src/tools/object.validate.js';

it.each([
  ['Subscription', 'customer_name'],
  ['Usage', 'customer_name'],
  ['Invoice', 'billing_contact_name'],
])('%s samples identify their named customer and the record still accepts a customer name alone', async (object, field) => {
  const billing = loadObject(object);
  const customers = new Map(loadObject('Organization').samples!.map(row => [row.organization_id, row.label]));
  expect(billing.schema.organization_id).toMatchObject({ type: 'string', required: false });
  expect(billing.samples).toHaveLength(8);
  for (const row of billing.samples!) {
    expect(customers.get(row.organization_id)).toBe(row[field]);
  }
  const source = fs.readFileSync(getObjectFilePath(object)!, 'utf8');
  const legacy = source.replace(/^    organization_id: [^\n]+\n/gm, '');
  expect(legacy).not.toBe(source);
  const result = await validate({ yaml: legacy });
  expect(result.valid, JSON.stringify(result.errors)).toBe(true);
});
