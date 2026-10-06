import { afterEach, describe, expect, it } from 'vitest';
import {
  clearTraitCache,
  getTraitFilePath,
  listTraits,
  loadAllTraits,
  loadTrait,
} from '../../src/objects/trait-loader.js';

describe('trait-loader', () => {
  afterEach(() => {
    clearTraitCache();
  });

  it('discovers traits from disk', () => {
    const names = listTraits();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('Priceable');
    expect(names).toContain('Timestampable');
  });

  it('discovers traits from all scan roots', () => {
    const names = listTraits();
    // Core traits
    expect(names).toContain('Addressable');
    // Lifecycle traits
    expect(names).toContain('Stateful');
    // Financial traits
    expect(names).toContain('Priceable');
    // Behavioral traits
    expect(names).toContain('Taggable');
  });

  it('loads a known trait with correct structure', () => {
    const priceable = loadTrait('Priceable');

    expect(priceable.trait).toBeDefined();
    expect(priceable.trait.name).toBe('Priceable');
    expect(priceable.trait.version).toBeDefined();
    expect(priceable.trait.category).toBe('financial');
    expect(priceable.trait.description).toBeDefined();

    expect(Array.isArray(priceable.parameters)).toBe(true);
    expect(priceable.parameters.length).toBeGreaterThan(0);

    expect(typeof priceable.schema).toBe('object');
    expect(Object.keys(priceable.schema).length).toBeGreaterThan(0);

    expect(typeof priceable.semantics).toBe('object');
    expect(typeof priceable.view_extensions).toBe('object');
    expect(typeof priceable.tokens).toBe('object');

    expect(Array.isArray(priceable.dependencies)).toBe(true);
    expect(typeof priceable.metadata).toBe('object');
  });

  it('normalizes missing optional sections to defaults', () => {
    const names = listTraits();
    for (const name of names) {
      const trait = loadTrait(name);
      expect(Array.isArray(trait.parameters)).toBe(true);
      expect(typeof trait.schema).toBe('object');
      expect(typeof trait.semantics).toBe('object');
      expect(typeof trait.view_extensions).toBe('object');
      expect(typeof trait.tokens).toBe('object');
      expect(Array.isArray(trait.dependencies)).toBe(true);
      expect(typeof trait.metadata).toBe('object');
    }
  });

  it('supports category-qualified lookup', () => {
    const bySimple = loadTrait('Priceable');
    clearTraitCache();
    const byQualified = loadTrait('financial/Priceable');
    expect(byQualified.trait.name).toBe(bySimple.trait.name);
  });

  it('supports directory-path lookup for object trait references', () => {
    // Object files reference traits as "lifecycle/Stateful"
    const stateful = loadTrait('lifecycle/Stateful');
    expect(stateful.trait.name).toBe('Stateful');
  });

  it('returns cached result on repeated load', () => {
    const first = loadTrait('Priceable');
    const second = loadTrait('Priceable');
    expect(first).toBe(second); // Same reference
  });

  it('caches under both requested key and canonical name', () => {
    const byQualified = loadTrait('financial/Priceable');
    const bySimple = loadTrait('Priceable');
    expect(byQualified).toBe(bySimple); // Same reference
  });

  it('returns file path for known traits', () => {
    const filePath = getTraitFilePath('Priceable');
    expect(filePath).toBeDefined();
    expect(filePath!.endsWith('.trait.yaml')).toBe(true);
  });

  it('returns undefined for unknown trait path', () => {
    expect(getTraitFilePath('NonExistentTrait')).toBeUndefined();
  });

  it('throws for unknown trait with available list', () => {
    expect(() => loadTrait('NonExistentTrait')).toThrowError(
      /not found.*Available/,
    );
  });

  it('loadAllTraits returns map of all traits', () => {
    const all = loadAllTraits();
    expect(all.size).toBe(listTraits().length);
    expect(all.has('Priceable')).toBe(true);
    expect(all.get('Priceable')!.trait.name).toBe('Priceable');
  });

  it('clearTraitCache resets state', () => {
    loadTrait('Priceable'); // warm cache
    clearTraitCache();
    const names = listTraits();
    expect(names).toContain('Priceable');
  });

  it('parses trait parameters', () => {
    const priceable = loadTrait('Priceable');
    const currencies = priceable.parameters.find(p => p.name === 'supportedCurrencies');
    expect(currencies).toBeDefined();
    expect(currencies!.type).toBe('string[]');
    expect(currencies!.required).toBe(true);
  });

  it('parses view_extensions', () => {
    const priceable = loadTrait('Priceable');
    expect(priceable.view_extensions.detail).toBeDefined();
    expect(Array.isArray(priceable.view_extensions.detail)).toBe(true);
    expect(priceable.view_extensions.detail.length).toBeGreaterThan(0);
    expect(priceable.view_extensions.detail[0].component).toBeDefined();
  });

  it('parses trait with events and dependencies', () => {
    const markBar = loadTrait('MarkBar');
    expect(markBar.events).toBeDefined();
    expect(Object.keys(markBar.events!).length).toBeGreaterThan(0);
    expect(markBar.dependencies.length).toBeGreaterThan(0);
  });

  it('parses semantic mappings with ui_hints', () => {
    const priceable = loadTrait('Priceable');
    const amountSem = priceable.semantics.unit_amount_cents;
    expect(amountSem).toBeDefined();
    expect(amountSem.ui_hints).toBeDefined();
    expect(amountSem.ui_hints!.component).toBe('CurrencyAmount');
  });
});
