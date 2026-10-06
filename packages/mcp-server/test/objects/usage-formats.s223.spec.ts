/**
 * s223-m01 (#2527 ruling 4): Usage's detail read "86420", "12.5" and a bare "0" for money. A number's display format is
 * declared on its field (ui_hints.format) and carried into the field entry, as money is; Usage's money fields read in the
 * currency each authored sample names (its subscription's), and every overage figure is authored, none generated.
 */
import { describe, expect, it } from 'vitest';
import { populateObjectSchema } from '../../src/compose/object-slot-filler.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import type { FieldSchemaEntry, UiSchema } from '../../src/schemas/generated.js';

function fields(name: string) {
  const composed = composeObject(loadObject(name));
  const schema: UiSchema = { version: '2026.02', screens: [{ id: 'root', component: 'Box' }] };
  populateObjectSchema(schema, composed.schema, composed.semantics, composed.traits, composed.samples);
  return schema.objectSchema as Record<string, FieldSchemaEntry>;
}

describe('Usage numbers read as numbers', () => {
  const usage = fields('Usage');
  it('carries the declared formats into the field entries', () => {
    expect(usage.consumed_quantity?.format).toBe('quantity');
    expect(usage.included_quantity?.format).toBe('quantity');
    expect(usage.trend_percent?.format).toBe('percent');
    // An undeclared number keeps no format: nothing is inferred from a name such as "_percent" or "_quantity".
    expect(Object.values(usage).filter(entry => entry.format).length).toBe(3);
  });
  it('reads its money fields in the currency each sample names, from authored values', () => {
    for (const field of ['variance_minor', 'overage_rate_minor', 'projected_overage_minor']) {
      expect(usage[field]?.money).toEqual({ currencyField: 'currency', minorUnits: 100 });
    }
    const samples = loadObject('Usage').samples as Array<Record<string, unknown>>;
    expect(samples.every(sample => ['USD', 'EUR', 'GBP'].includes(String(sample.currency)))).toBe(true);
    expect(samples.every(sample => Number.isInteger(sample.overage_rate_minor) && Number.isInteger(sample.projected_overage_minor))).toBe(true);
    // The variance is the overage so far: zero within the included quantity, (consumed - included) x rate past it.
    for (const sample of samples) {
      const over = Math.max(0, Number(sample.consumed_quantity) - Number(sample.included_quantity));
      expect(sample.variance_minor, String(sample.usage_id)).toBe(over * Number(sample.overage_rate_minor));
    }
  });
  it('leaves the long-standing integer type note of other traits without a display format', () => {
    expect(fields('Organization').tag_count?.format).toBeUndefined();
  });
});
