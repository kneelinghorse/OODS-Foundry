import { describe, expect, it } from 'vitest';
import { formatPriceAmount, formatPriceCode } from '../src/billing.js';
import { formatReferenceLabel, formatRecordLabel } from '../src/date-time.js';

describe('display truth without identity mutation (s212-m02)', () => {
  it.each([[0, 'USD', 100, '$0.00'], [1900, 'USD', 100, '$19.00'], [1900, 'EUR', 100, '€19.00'], [1900, 'JPY', 1, '¥1,900'], ['29.00', 'USD', 100, '$0.29'], [undefined, 'USD', 100, 'No amount'], [null, 'USD', 100, 'No amount'], [-1, 'USD', 100, 'Invalid amount'], [1.2, 'USD', 100, 'Invalid amount'], ['x', 'USD', 100, 'Invalid amount'], [20, 'dollars', 100, 'Invalid currency'], [20, 'USD', 0, 'Invalid amount']] as const)('distinguishes %s %s / %s as %s', (value, currency, units, expected) => {
    expect(formatPriceAmount(value, currency, units)).toBe(expected);
  });
  it('humanizes enums without pretending they are different stored values', () => {
    expect(formatPriceCode('one_time')).toBe('One Time');
    expect(formatPriceCode('usage_based')).toBe('Usage Based');
    expect(formatPriceCode(undefined)).toBeUndefined();
  });
  it('resolves only a supplied reference with a supplied non-UUID name', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(formatReferenceLabel(id, 'Northstar', 'Project')).toBe('Northstar');
    expect(formatReferenceLabel(id, '', 'Project')).toBe('Project reference not resolved');
    expect(formatReferenceLabel(id, id, 'Owner')).toBe('Owner reference not resolved');
    expect(formatReferenceLabel(undefined, 'Invented owner', 'Owner')).toBe('Owner unavailable');
    expect(formatReferenceLabel(null, undefined, 'Owner')).toBe('Owner unavailable');
    expect(formatRecordLabel(id)).toBe('Record name unavailable');
    expect(formatRecordLabel('transaction-003')).toBe('transaction-003');
    expect(formatRecordLabel('PAY-123')).toBe('PAY-123');
  });
});
