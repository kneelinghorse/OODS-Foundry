import { expect, it } from 'vitest';
import { renderMappedComponent } from '../../src/render/component-map.js';
it.each([{ currency: 'JPY', amountCents: 1000, minorUnits: 1000, expected: '¥1</span>' }, { currency: 'JPY', amountCents: 1200, expected: '1,200' }, { currency: 'BHD', amountCents: 1234, expected: '1.234' }, { currency: 'BHD', amountCents: 1234, minorUnits: 100, expected: '12.340' }, { currency: 'JPY', amount: 1200, expected: '1,200' }])('PriceBadge respects $currency storage units ($minorUnits)', ({ expected, ...props }) => {
  expect(renderMappedComponent({ id: 'price', component: 'PriceBadge', props }, '')).toContain(expected);
});
it('keeps an authored minor-unit factor through React, Vue and record HTML bindings', async () => {
  const { handle: generate } = await import('../../src/tools/code.generate.js');
  const schema = { version: '2026.03', screens: [{ id: 'price', component: 'PriceBadge', props: { amountField: 'amount', currencyField: 'currency', minorUnitsParameter: 'minorUnits' } }], objectSchema: {
    amount: { type: 'integer', required: true, money: { currencyField: 'currency', minorUnits: 1000 }, examples: [1000] }, currency: { type: 'string', required: true, examples: ['JPY'] },
  } } as any;
  for (const framework of ['react', 'vue', 'html'] as const) {
    const result = await generate({ framework, schema });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    if (framework === 'react') expect(result.code).toContain('minorUnits={1000}');
    else if (framework === 'vue') expect(result.code).toContain(':minorUnits="1000"');
    else { expect(result.code).toContain('¥1</span>'); expect(result.code).not.toContain('¥1,000'); }
  }
});
