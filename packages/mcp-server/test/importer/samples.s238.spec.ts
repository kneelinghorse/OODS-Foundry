import { expect, it } from 'vitest';
import { sampleValue, validSample } from '../../src/importer/samples.js';

// Imported objects without source examples showed "email 3", "memo 3" and "cu3" (a char(3) currency) on their screens,
// which read as broken data in a demo (website audit SITE-11). A field's name now chooses a realistic illustration;
// the source's constraints still decide, and a candidate they reject falls back to the general generator.

const string = (extra: Record<string, unknown> = {}) => ({ type: 'string', ...extra });
const five = (schema: Record<string, unknown>, field: string) => [0, 1, 2, 3, 4].map(index => sampleValue(schema, field, index));

it('illustrates common string fields the way real records read', () => {
  expect(sampleValue(string(), 'email', 2)).toBe('person3@example.com');
  expect(sampleValue(string(), 'contactEmail', 0)).toBe('person1@example.com');
  expect(five(string({ minLength: 3, maxLength: 3 }), 'currency')).toEqual(['USD', 'EUR', 'GBP', 'JPY', 'CAD']);
  expect(sampleValue(string({ maxLength: 2 }), 'country_code', 1)).toBe('GB');
  expect(sampleValue(string(), 'givenName', 0)).toBe('Ava');
  expect(sampleValue(string(), 'family_name', 0)).toBe('Martin');
  expect(sampleValue(string(), 'City', 2)).toBe('Osaka');
  expect(sampleValue(string(), 'memo', 0)).toBe('Example memo for record 1.');
  expect(sampleValue(string({ maxLength: 8 }), 'TripID', 0)).toBe('TRIP-001');
  expect(sampleValue(string({ maxLength: 6 }), 'AgencyID', 2)).toBe('AG-003');
  expect(sampleValue(string(), 'subject', 0)).toBe('Subject 1');
});

it('illustrates amounts, ages and years with ordinary values inside the constraints', () => {
  expect(sampleValue({ type: 'integer', minimum: 0 }, 'amount_cents', 0)).toBe(12950);
  expect(sampleValue({ type: 'number', multipleOf: 0.01 }, 'total', 0)).toBe(129.5);
  expect(sampleValue({ type: 'integer', minimum: 0, maximum: 130 }, 'age', 0)).toBe(34);
  // A name never overrides a constraint: the amount below its maximum falls back to the general generator.
  const bounded = { type: 'number', minimum: 0.25, maximum: 1, multipleOf: 0.25 };
  expect(validSample(bounded, sampleValue(bounded, 'total', 0))).toBe(true);
});

it('falls back when the realistic candidate breaks a constraint, and stays deterministic and distinct', () => {
  const tight = string({ maxLength: 5 });
  const values = five(tight, 'email');
  expect(values.every(value => validSample(tight, value))).toBe(true);
  expect(new Set(values).size).toBe(5);
  expect(five(string({ pattern: '^[A-Z]{3}$' }), 'currency')).toEqual(five(string({ pattern: '^[A-Z]{3}$' }), 'currency'));
  expect(new Set(five(string({ maxLength: 3 }), 'code')).size).toBe(5);
});
