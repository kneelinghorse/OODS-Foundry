import { describe, expect, it } from 'vitest';
import { withRenderWidthLabels } from './vega-lite-adapter.js';

const compiled = () => ({ mark: 'bar', encoding: { x: { field: 'payment', type: 'ordinal' }, y: { field: 'amount', type: 'quantitative' } }, data: { values: ['Jan 15', 'Feb 15', 'Mar 15', 'Apr 15', 'May 17', 'Jun 15', 'Jul 15', 'Aug 15', 'Aug 16', 'Aug 19', 'Sep 15'].map(day => ({ payment: `${day}, 2026`, amount: 19 })) }, config: { axisX: { labelColor: '#000' } } });

describe('narrow categorical dates leave the plot readable', () => {
  it('samples overlapping horizontal labels at the phone width without changing the compiled input or data', () => {
    const input = compiled();
    const before = structuredClone(input);
    const drawn = withRenderWidthLabels(input, 360);
    expect(drawn.config.axisX).toEqual({ labelColor: '#000', labelAngle: 0, labelOverlap: 'greedy' });
    expect(input).toEqual(before);
    expect(drawn.data).toBe(input.data);
  });

  it('keeps the existing desktop choice and authored angle or overlap preferences', () => {
    const input = compiled();
    expect(withRenderWidthLabels(input, 1120).config.axisX).toEqual({ labelColor: '#000', labelAngle: 0 });
    const angle = { ...input, config: { axisX: { labelAngle: 45 } } };
    expect(withRenderWidthLabels(angle, 360)).toBe(angle);
    const overlap = { ...input, config: { axisX: { labelOverlap: false } } };
    expect(withRenderWidthLabels(overlap, 360)).toBe(overlap);
    expect(withRenderWidthLabels(input, 500)).toBe(input);
  });
});
