import { afterEach, describe, expect, it } from 'vitest';
import {
  clearObjectCache,
  getObjectFilePath,
  listObjects,
  loadAllObjects,
  loadObject,
} from '../../src/objects/object-loader.js';
import {
  clearTraitCache,
  getTraitFilePath,
  listTraits,
  loadAllTraits,
  loadTrait,
} from '../../src/objects/trait-loader.js';

describe('YAML loaders', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  describe('object-loader', () => {
    it('discovers objects from all scan roots', () => {
      const names = listObjects();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('User');
      expect(names).toContain('Product');
      expect(names).toContain('Invoice'); // domain object
    });

    it('parses valid object YAML', () => {
      const user = loadObject('User');
      expect(user.object.name).toBe('User');
      expect(user.object.version).toBeDefined();
      expect(user.traits.length).toBeGreaterThan(0);
      expect(Object.keys(user.schema).length).toBeGreaterThan(0);
    });

    it('normalizes missing sections', () => {
      for (const name of listObjects()) {
        const obj = loadObject(name);
        expect(Array.isArray(obj.traits)).toBe(true);
        expect(typeof obj.schema).toBe('object');
        expect(typeof obj.semantics).toBe('object');
        expect(typeof obj.tokens).toBe('object');
        expect(typeof obj.metadata).toBe('object');
      }
    });

    it('caches parsed results', () => {
      const a = loadObject('User');
      const b = loadObject('User');
      expect(a).toBe(b);
    });

    it('throws for missing object with suggestions', () => {
      expect(() => loadObject('FakeObject')).toThrowError(/not found.*Available/);
    });

    it('getObjectFilePath returns path for known objects', () => {
      expect(getObjectFilePath('User')).toBeDefined();
      expect(getObjectFilePath('User')!.endsWith('.object.yaml')).toBe(true);
    });

    it('getObjectFilePath returns undefined for unknown', () => {
      expect(getObjectFilePath('Nonexistent')).toBeUndefined();
    });

    it('loadAllObjects loads every discovered object', () => {
      const all = loadAllObjects();
      expect(all.size).toBe(listObjects().length);
    });

    it('clearObjectCache allows re-scan', () => {
      loadObject('User');
      clearObjectCache();
      expect(listObjects()).toContain('User');
    });
  });

  describe('trait-loader', () => {
    it('discovers traits from all scan roots', () => {
      const names = listTraits();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('Priceable');
      expect(names).toContain('Timestampable');
      expect(names).toContain('Stateful');
      expect(names).toContain('Taggable');
    });

    it('parses valid trait YAML', () => {
      const p = loadTrait('Priceable');
      expect(p.trait.name).toBe('Priceable');
      expect(p.trait.category).toBe('financial');
      expect(p.parameters.length).toBeGreaterThan(0);
      expect(Object.keys(p.schema).length).toBeGreaterThan(0);
    });

    it('normalizes missing sections', () => {
      for (const name of listTraits()) {
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

    it('supports simple name lookup', () => {
      const t = loadTrait('Priceable');
      expect(t.trait.name).toBe('Priceable');
    });

    it('supports category-qualified lookup', () => {
      const t = loadTrait('financial/Priceable');
      expect(t.trait.name).toBe('Priceable');
    });

    it('supports directory-path lookup (object trait references)', () => {
      const t = loadTrait('lifecycle/Stateful');
      expect(t.trait.name).toBe('Stateful');
    });

    it('caches parsed results', () => {
      const a = loadTrait('Priceable');
      const b = loadTrait('Priceable');
      expect(a).toBe(b);
    });

    it('cross-caches between qualified and simple name', () => {
      const qualified = loadTrait('financial/Priceable');
      const simple = loadTrait('Priceable');
      expect(qualified).toBe(simple);
    });

    it('throws for missing trait with suggestions', () => {
      expect(() => loadTrait('FakeTrait')).toThrowError(/not found.*Available/);
    });

    it('getTraitFilePath returns path for known traits', () => {
      expect(getTraitFilePath('Priceable')).toBeDefined();
      expect(getTraitFilePath('Priceable')!.endsWith('.trait.yaml')).toBe(true);
    });

    it('getTraitFilePath returns undefined for unknown', () => {
      expect(getTraitFilePath('Nonexistent')).toBeUndefined();
    });

    it('loadAllTraits loads every discovered trait', () => {
      const all = loadAllTraits();
      expect(all.size).toBe(listTraits().length);
    });

    it('clearTraitCache allows re-scan', () => {
      loadTrait('Priceable');
      clearTraitCache();
      expect(listTraits()).toContain('Priceable');
    });

    it('parses trait view_extensions', () => {
      const p = loadTrait('Priceable');
      expect(p.view_extensions.detail).toBeDefined();
      expect(p.view_extensions.detail.length).toBeGreaterThan(0);
    });

    it('parses trait events and dependencies', () => {
      const mb = loadTrait('MarkBar');
      expect(mb.events).toBeDefined();
      expect(mb.dependencies.length).toBeGreaterThan(0);
    });
  });
});
