/**
 * Timeline layout template tests (s86-m02).
 */
import { describe, it, expect } from 'vitest';
import { timelineTemplate } from './timeline.js';
import { resetIdCounter } from './types.js';

describe('timelineTemplate', () => {
  it('produces a valid schema with header and entry slots', () => {
    resetIdCounter();
    const result = timelineTemplate();
    expect(result.schema.screens).toHaveLength(1);
    expect(result.slots.some(s => s.name === 'header')).toBe(true);
    expect(result.slots.some(s => s.name === 'entry-0')).toBe(true);
  });

  it('has header + 5 entry slots by default (6 total)', () => {
    const result = timelineTemplate();
    expect(result.slots).toHaveLength(6);
    expect(result.slots[0].name).toBe('header');
    for (let i = 0; i < 5; i++) {
      expect(result.slots[i + 1].name).toBe(`entry-${i}`);
    }
  });

  it('first entry is required, rest are optional', () => {
    const result = timelineTemplate();
    expect(result.slots.find(s => s.name === 'header')!.required).toBe(true);
    expect(result.slots.find(s => s.name === 'entry-0')!.required).toBe(true);
    expect(result.slots.find(s => s.name === 'entry-1')!.required).toBe(false);
  });

  it('respects custom entryCount', () => {
    const result = timelineTemplate({ entryCount: 3 });
    const entrySlots = result.slots.filter(s => s.name.startsWith('entry-'));
    expect(entrySlots).toHaveLength(3);
  });

  it('entry slots have timeline-entry intent', () => {
    const result = timelineTemplate();
    for (const slot of result.slots.filter(s => s.name.startsWith('entry-'))) {
      expect(slot.intent).toBe('timeline-entry');
    }
  });

  it('applies theme when provided', () => {
    const result = timelineTemplate({ theme: 'brand-dark' });
    expect(result.schema.theme).toBe('brand-dark');
  });

  it('uses vertical stack layout', () => {
    const result = timelineTemplate();
    expect(result.schema.screens[0].layout?.type).toBe('stack');
  });

  it('each entry is wrapped in a Card', () => {
    const result = timelineTemplate({ entryCount: 2 });
    const screen = result.schema.screens[0];
    // entries container is the second child
    const entriesContainer = screen.children![1];
    expect(entriesContainer.children).toHaveLength(2);
    for (const entry of entriesContainer.children!) {
      expect(entry.component).toBe('Card');
    }
  });
});
