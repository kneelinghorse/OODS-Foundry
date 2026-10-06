import { describe, it, expect } from 'vitest';
import { getPositionAffinity, inferSlotPosition, type SlotPosition } from './position-affinity.js';

describe('getPositionAffinity', () => {
  it('boosts SearchInput in header position', () => {
    const result = getPositionAffinity('SearchInput', 'header');
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reason).toContain('fits well');
  });

  it('penalizes SearchInput in footer position', () => {
    const result = getPositionAffinity('SearchInput', 'footer');
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.reason).toContain('poor fit');
  });

  it('boosts PaginationBar in footer position', () => {
    const result = getPositionAffinity('PaginationBar', 'footer');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('penalizes PaginationBar in header position', () => {
    const result = getPositionAffinity('PaginationBar', 'header');
    expect(result.multiplier).toBeLessThan(1.0);
  });

  it('boosts Table in main position', () => {
    const result = getPositionAffinity('Table', 'main');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('penalizes Table in header position', () => {
    const result = getPositionAffinity('Table', 'header');
    expect(result.multiplier).toBeLessThan(1.0);
  });

  it('boosts StatusBadge in header/sidebar', () => {
    expect(getPositionAffinity('StatusBadge', 'header').multiplier).toBeGreaterThan(1.0);
    expect(getPositionAffinity('StatusBadge', 'sidebar').multiplier).toBeGreaterThan(1.0);
  });

  it('returns neutral for unknown components', () => {
    const result = getPositionAffinity('UnknownComponent', 'header');
    expect(result.multiplier).toBe(1.0);
    expect(result.reason).toBe('');
  });

  it('returns neutral for components in unlisted positions', () => {
    const result = getPositionAffinity('Button', 'main');
    expect(result.multiplier).toBe(1.0);
  });

  it('boosts Button in footer', () => {
    const result = getPositionAffinity('Button', 'footer');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('boosts Card in tab position', () => {
    const result = getPositionAffinity('Card', 'tab');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('boosts FilterPanel in sidebar', () => {
    const result = getPositionAffinity('FilterPanel', 'sidebar');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('boosts Select in main form slots', () => {
    const result = getPositionAffinity('Select', 'main');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('keeps Input neutral in main form slots', () => {
    const result = getPositionAffinity('Input', 'main');
    expect(result.multiplier).toBe(1.0);
  });

  it('boosts Textarea in main form slots', () => {
    const result = getPositionAffinity('Textarea', 'main');
    expect(result.multiplier).toBeGreaterThan(1.0);
  });
});

describe('inferSlotPosition', () => {
  it('maps header-like slot names', () => {
    expect(inferSlotPosition('header')).toBe('header');
    expect(inferSlotPosition('title')).toBe('header');
    expect(inferSlotPosition('banner')).toBe('header');
    expect(inferSlotPosition('search')).toBe('header');
    expect(inferSlotPosition('toolbar-actions')).toBe('header');
  });

  it('maps main-like slot names', () => {
    expect(inferSlotPosition('main-content')).toBe('main');
    expect(inferSlotPosition('items')).toBe('main');
    expect(inferSlotPosition('metrics')).toBe('main');
    expect(inferSlotPosition('main-section-1')).toBe('main');
    expect(inferSlotPosition('metrics-section-1')).toBe('main');
    expect(inferSlotPosition('field-0')).toBe('main');
  });

  it('maps footer-like slot names', () => {
    expect(inferSlotPosition('footer')).toBe('footer');
    expect(inferSlotPosition('actions')).toBe('footer');
    expect(inferSlotPosition('pagination')).toBe('footer');
  });

  it('maps sidebar-like slot names', () => {
    expect(inferSlotPosition('sidebar')).toBe('sidebar');
    expect(inferSlotPosition('metadata')).toBe('sidebar');
    expect(inferSlotPosition('filters')).toBe('sidebar');
    expect(inferSlotPosition('sidebar-section-1')).toBe('sidebar');
  });

  it('maps tab-N slot names', () => {
    expect(inferSlotPosition('tab-0')).toBe('tab');
    expect(inferSlotPosition('tab-5')).toBe('tab');
  });

  it('returns undefined for unknown slot names', () => {
    expect(inferSlotPosition('custom-slot')).toBeUndefined();
    expect(inferSlotPosition('chart-toolbar')).toBeUndefined();
  });
});
