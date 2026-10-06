import { describe, expect, it } from 'vitest';
import { getPositionAffinity, inferSlotPosition } from '../../src/compose/position-affinity.js';

describe('position affinity', () => {
  it('boosts SearchInput in header position', () => {
    const result = getPositionAffinity('SearchInput', 'header');
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reason).toContain('fits well');
  });

  it('maps toolbar-actions into the header vocabulary', () => {
    expect(inferSlotPosition('toolbar-actions')).toBe('header');
  });

  it('maps form field groups into the main vocabulary', () => {
    expect(inferSlotPosition('field-0')).toBe('main');
    expect(inferSlotPosition('field-3')).toBe('main');
  });

  it('maps expanded dashboard metric slots into the main vocabulary', () => {
    expect(inferSlotPosition('metrics')).toBe('main');
    expect(inferSlotPosition('metrics-section-1')).toBe('main');
  });

  it('leaves unknown slot names unmapped', () => {
    expect(inferSlotPosition('chart-toolbar')).toBeUndefined();
  });
});
