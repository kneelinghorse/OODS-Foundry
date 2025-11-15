import { describe, expect, it } from 'vitest';
import { stackTransform } from '../../src/viz/transforms/stack-transform.js';

describe('stackTransform', () => {
  it('computes cumulative ranges per group using zero offset', () => {
    const rows = [
      { month: 'Jan', segment: 'Growth', revenue: 30 },
      { month: 'Jan', segment: 'Enterprise', revenue: 20 },
      { month: 'Jan', segment: 'Intl', revenue: -10 },
      { month: 'Feb', segment: 'Growth', revenue: 25 },
      { month: 'Feb', segment: 'Enterprise', revenue: 15 },
    ];

    const result = stackTransform(rows, {
      stack: 'revenue',
      groupby: ['month'],
      sort: [{ field: 'segment', order: 'ascending' }],
      as: ['start', 'end'],
    });

    const janEnterprise = result.rows.find((row) => row.month === 'Jan' && row.segment === 'Enterprise');
    expect(janEnterprise?.start).toBe(0);
    expect(janEnterprise?.end).toBe(20);

    const janGrowth = result.rows.find((row) => row.month === 'Jan' && row.segment === 'Growth');
    expect(janGrowth?.start).toBe(20);
    expect(janGrowth?.end).toBe(50);

    const janIntl = result.rows.find((row) => row.month === 'Jan' && row.segment === 'Intl');
    expect(janIntl?.start).toBe(-10);
    expect(janIntl?.end).toBe(0);
  });

  it('normalizes stacked values when offset is normalize', () => {
    const rows = [
      { month: 'Jan', segment: 'Growth', revenue: 60 },
      { month: 'Jan', segment: 'Enterprise', revenue: 40 },
    ];

    const result = stackTransform(rows, {
      stack: 'revenue',
      groupby: ['month'],
      offset: 'normalize',
      as: ['start', 'end'],
    });

    const normalized = result.rows.map((row) => row.end as number);
    expect(normalized[normalized.length - 1]).toBeCloseTo(1);
    expect(result.rows[0]?.start).toBe(0);
  });
});
