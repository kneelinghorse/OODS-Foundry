import { describe, expect, it } from 'vitest';
import { extractComponentCssEntries, getCssForComponents } from '../../src/render/css-extractor.js';

describe('css-extractor', () => {
  it('extracts base and component-scoped entries from default component css', () => {
    const entries = extractComponentCssEntries();

    expect(entries.has('css.base')).toBe(true);
    expect(entries.has('cmp.button.base')).toBe(true);
    expect(entries.has('cmp.card.base')).toBe(true);
    expect(entries.has('cmp.badge.base')).toBe(true);
    expect(entries.has('cmp.banner.base')).toBe(true);
    expect(entries.has('cmp.table.base')).toBe(true);
    expect(entries.has('cmp.tabs.base')).toBe(true);
    expect(entries.size).toBe(7);
  });

  it('always returns css.base and deduplicates requested component refs', () => {
    const result = getCssForComponents(['Button', 'button', 'Card', 'MissingComponent'], false);

    expect(result.cssRefs).toEqual(['css.base', 'cmp.button.base', 'cmp.card.base']);
    expect(result.css['css.base']).toContain('[data-oods-component]');
    expect(result.css['cmp.button.base']).toContain('[data-oods-component="Button"]');
    expect(result.css['cmp.card.base']).toContain('[data-oods-component="Card"]');
    expect(result.css['cmp.missingcomponent.base']).toBeUndefined();
  });

  it('includes css.tokens when includeCss=true and keeps selector fidelity for component css', () => {
    const result = getCssForComponents(['Tabs'], true);

    expect(result.cssRefs[0]).toBe('css.base');
    expect(result.cssRefs).toContain('css.tokens');
    expect(result.cssRefs).toContain('cmp.tabs.base');
    expect(typeof result.css['css.tokens']).toBe('string');
    expect(result.css['cmp.tabs.base']).toContain('[data-oods-component="Tabs"]');
  });
});
