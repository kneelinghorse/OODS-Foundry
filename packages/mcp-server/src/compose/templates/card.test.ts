/**
 * Card layout template tests (s86-m02).
 */
import { describe, it, expect } from 'vitest';
import { cardTemplate } from './card.js';
import { resetIdCounter } from './types.js';

describe('cardTemplate', () => {
  it('produces a valid schema with header and body slots', () => {
    resetIdCounter();
    const result = cardTemplate();
    expect(result.schema.screens).toHaveLength(1);
    expect(result.slots.some(s => s.name === 'header')).toBe(true);
    expect(result.slots.some(s => s.name === 'body')).toBe(true);
  });

  it('has 3 slots by default (header, body, footer)', () => {
    const result = cardTemplate();
    expect(result.slots).toHaveLength(3);
    expect(result.slots.map(s => s.name)).toEqual(['header', 'body', 'footer']);
  });

  it('header and body are required, footer is optional', () => {
    const result = cardTemplate();
    expect(result.slots.find(s => s.name === 'header')!.required).toBe(true);
    expect(result.slots.find(s => s.name === 'body')!.required).toBe(true);
    expect(result.slots.find(s => s.name === 'footer')!.required).toBe(false);
  });

  it('omits footer when includeFooter is false', () => {
    const result = cardTemplate({ includeFooter: false });
    expect(result.slots).toHaveLength(2);
    expect(result.slots.some(s => s.name === 'footer')).toBe(false);
  });

  it('root component is Card', () => {
    const result = cardTemplate();
    expect(result.schema.screens[0].component).toBe('Card');
  });

  it('applies theme when provided', () => {
    const result = cardTemplate({ theme: 'brand-dark' });
    expect(result.schema.theme).toBe('brand-dark');
  });

  it('has no tabs or sidebar', () => {
    const result = cardTemplate();
    const screen = result.schema.screens[0];
    const components = collectComponents(screen);
    expect(components).not.toContain('Tabs');
    // No sidebar layout type
    expect(screen.layout?.type).not.toBe('sidebar');
  });
});

function collectComponents(node: Record<string, unknown>): string[] {
  const names: string[] = [];
  if (typeof node.component === 'string') names.push(node.component);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      names.push(...collectComponents(child as Record<string, unknown>));
    }
  }
  return names;
}
