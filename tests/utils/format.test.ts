import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney } from '../../src/utils/format.js';

describe('format utilities', () => {
  it('produces stable formatted dates', () => {
    const samples = {
      iso: formatDate('2024-05-01T00:00:00Z'),
      dateInstance: formatDate(new Date(Date.UTC(2024, 6, 1))),
      invalid: formatDate('invalid-date'),
    };

    expect(samples).toMatchSnapshot('formatDate');
  });

  it('produces stable formatted money strings', () => {
    const samples = {
      usd: formatMoney(12900, 'USD'),
      eur: formatMoney(4599, 'eur'),
      invalidAmount: formatMoney(undefined, 'USD'),
      invalidCurrency: formatMoney(12900, 'US'),
      noMinorUnits: formatMoney(129, 'USD', { minorUnits: false }),
    };

    expect(samples).toMatchSnapshot('formatMoney');
  });
});
