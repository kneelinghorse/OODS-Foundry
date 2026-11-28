/**
 * s255-m02: a declared label keyed '' names the value a record does not hold. A memory's "How it was made" always shows,
 * and where the product does not say, it must read "Not known", never nothing and never another value; the same holds for
 * "Not reported". Without that key an absent value has no label, as before, so no shipped label moves (Mandate's
 * valueLabels are keyed by stored values only).
 */
import { describe, expect, it } from 'vitest';
import { formatReadOnlyValue, storedValueLabel } from '../src/date-time.js';

describe('a label for the value a record does not hold', () => {
  const labels = { '': 'Not known', told: 'Said by the person it is about' };
  it('reads the label keyed \'\' for an absent or blank value, and a stored value\'s own label otherwise', () => {
    for (const value of [undefined, null, '']) expect(storedValueLabel(value, labels), String(value)).toBe('Not known');
    expect(storedValueLabel('told', labels)).toBe('Said by the person it is about');
    expect(storedValueLabel('inferred', labels)).toBeUndefined();
    expect(storedValueLabel({ nested: true }, labels)).toBeUndefined();
    expect(formatReadOnlyValue(null, 'string', false, undefined, { '': 'Not reported' })).toBe('Not reported');
  });
  it('gives an absent value no label where none is keyed \'\', as before', () => {
    const shipped = { None: 'No listed action needs a separate yes' };
    for (const value of [undefined, null]) expect(storedValueLabel(value, shipped), String(value)).toBeUndefined();
    expect(storedValueLabel('None', shipped)).toBe('No listed action needs a separate yes');
    expect(formatReadOnlyValue(null, 'string', false, undefined, shipped)).toBe('Not recorded');
  });
});
