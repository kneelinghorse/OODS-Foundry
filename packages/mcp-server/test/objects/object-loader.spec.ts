import { afterEach, describe, expect, it } from 'vitest';
import {
  clearObjectCache,
  getObjectFilePath,
  listObjects,
  loadAllObjects,
  loadObject,
} from '../../src/objects/object-loader.js';

describe('object-loader', () => {
  afterEach(() => {
    clearObjectCache();
  });

  it('discovers objects from disk', () => {
    const names = listObjects();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('User');
    expect(names).toContain('Product');
  });

  it('discovers objects from all scan roots', () => {
    const names = listObjects();
    // Core objects
    expect(names).toContain('User');
    expect(names).toContain('Product');
    // Domain objects (domains/saas-billing/objects/)
    expect(names).toContain('Invoice');
  });

  it('prefers canonical objects/ definitions when domains contain duplicate names', () => {
    const filePath = getObjectFilePath('Subscription');
    expect(filePath).toContain('objects/core/Subscription.object.yaml');

    const subscription = loadObject('Subscription');
    expect(subscription.schema.customer_email).toBeDefined();
    expect(subscription.schema.cancel_at_period_end?.type).toBe('boolean');
    expect(subscription.schema.status?.validation?.enum?.length).toBeGreaterThan(0);
  });

  it('loads a known object with correct structure', () => {
    const user = loadObject('User');

    expect(user.object).toBeDefined();
    expect(user.object.name).toBe('User');
    expect(user.object.version).toBeDefined();
    expect(user.object.domain).toBeDefined();
    expect(user.object.description).toBeDefined();

    expect(Array.isArray(user.traits)).toBe(true);
    expect(user.traits.length).toBeGreaterThan(0);

    expect(typeof user.schema).toBe('object');
    expect(Object.keys(user.schema).length).toBeGreaterThan(0);

    expect(typeof user.semantics).toBe('object');
    expect(typeof user.tokens).toBe('object');
    expect(typeof user.metadata).toBe('object');
  });

  it('normalizes missing optional sections to defaults', () => {
    // All objects should have at least an empty object for optional sections
    const names = listObjects();
    for (const name of names) {
      const obj = loadObject(name);
      expect(Array.isArray(obj.traits)).toBe(true);
      expect(typeof obj.schema).toBe('object');
      expect(typeof obj.semantics).toBe('object');
      expect(typeof obj.tokens).toBe('object');
      expect(typeof obj.metadata).toBe('object');
    }
  });

  it('returns cached result on repeated load', () => {
    const first = loadObject('User');
    const second = loadObject('User');
    expect(first).toBe(second); // Same reference
  });

  it('returns file path for known objects', () => {
    const filePath = getObjectFilePath('User');
    expect(filePath).toBeDefined();
    expect(filePath!.endsWith('.object.yaml')).toBe(true);
  });

  it('returns undefined for unknown object path', () => {
    expect(getObjectFilePath('NonExistentObject')).toBeUndefined();
  });

  it('throws for unknown object with available list', () => {
    expect(() => loadObject('NonExistentObject')).toThrowError(
      /not found.*Available/,
    );
  });

  it('loadAllObjects returns map of all objects', () => {
    const all = loadAllObjects();
    expect(all.size).toBe(listObjects().length);
    expect(all.has('User')).toBe(true);
    expect(all.get('User')!.object.name).toBe('User');
  });

  it('clearObjectCache resets state', () => {
    loadObject('User'); // warm cache
    clearObjectCache();
    // After clear, list should re-scan and still work
    const names = listObjects();
    expect(names).toContain('User');
  });

  it('parses trait references with parameters', () => {
    const product = loadObject('Product');
    const stateful = product.traits.find(t => t.name.includes('Stateful'));
    expect(stateful).toBeDefined();
    expect(stateful!.parameters).toBeDefined();
    expect(stateful!.parameters!.states).toBeDefined();
  });

  it('parses schema field validation rules', () => {
    const user = loadObject('User');
    const roleField = user.schema.role;
    expect(roleField).toBeDefined();
    expect(roleField.type).toBe('string');
    expect(roleField.required).toBe(true);
    expect(roleField.validation?.enum).toBeDefined();
    expect(roleField.validation!.enum!.length).toBeGreaterThan(0);
  });

  it('parses semantic mappings', () => {
    const user = loadObject('User');
    const nameSem = user.semantics.name;
    expect(nameSem).toBeDefined();
    expect(nameSem.semantic_type).toBeDefined();
    expect(nameSem.token_mapping).toBeDefined();
  });
});
