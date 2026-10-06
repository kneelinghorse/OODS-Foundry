import { afterEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/object.show.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/object.show.output.json' assert { type: 'json' };
import { handle } from '../../src/tools/object.show.js';
import { clearObjectCache, listObjects } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

describe('object.show contract', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  // ---- Schema validation ----

  it('input schema requires name', () => {
    expect(validateInput({})).toBe(false);
    expect(validateInput({ name: 'User' })).toBe(true);
    expect(validateInput({ name: 'User', context: 'detail' })).toBe(true);
  });

  it('input schema rejects additionalProperties', () => {
    expect(validateInput({ name: 'User', extra: true })).toBe(false);
  });

  it('output validates for User', async () => {
    const output = await handle({ name: 'User' });
    const valid = validateOutput(output);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.error('User errors:', JSON.stringify(validateOutput.errors, null, 2));
    }
    expect(valid).toBe(true);
  });

  it('output validates for every known object', async () => {
    const names = listObjects();
    for (const name of names) {
      clearObjectCache();
      clearTraitCache();
      const output = await handle({ name });
      const valid = validateOutput(output);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error(`${name} errors:`, JSON.stringify(validateOutput.errors, null, 2));
      }
      expect(valid).toBe(true);
    }
  });

  // ---- Output shape ----

  it('includes all top-level fields', async () => {
    const output = await handle({ name: 'User' });
    expect(output.name).toBe('User');
    expect(typeof output.version).toBe('string');
    expect(typeof output.domain).toBe('string');
    expect(typeof output.description).toBe('string');
    expect(Array.isArray(output.tags)).toBe(true);
    expect(Array.isArray(output.traits)).toBe(true);
    expect(typeof output.schema).toBe('object');
    expect(typeof output.semantics).toBe('object');
    expect(typeof output.viewExtensions).toBe('object');
    expect(typeof output.tokens).toBe('object');
    expect(Array.isArray(output.warnings)).toBe(true);
    expect(typeof output.filePath).toBe('string');
  });

  it('traits include name, alias, parameters', async () => {
    const output = await handle({ name: 'User' });
    for (const trait of output.traits) {
      expect(typeof trait.name).toBe('string');
      expect(trait.alias === null || typeof trait.alias === 'string').toBe(true);
      expect(trait.parameters === null || typeof trait.parameters === 'object').toBe(true);
    }
  });

  it('schema fields have type, required, description', async () => {
    const output = await handle({ name: 'User' });
    for (const [, field] of Object.entries(output.schema)) {
      expect(typeof field.type).toBe('string');
      expect(typeof field.required).toBe('boolean');
      expect(typeof field.description).toBe('string');
    }
  });

  it('semantics have semantic_type and token_mapping', async () => {
    const output = await handle({ name: 'User' });
    for (const [, sem] of Object.entries(output.semantics)) {
      expect(typeof sem.semantic_type).toBe('string');
      expect(typeof sem.token_mapping).toBe('string');
    }
  });

  // ---- Context filter ----

  it('context filter returns only matching context', async () => {
    const full = await handle({ name: 'Product' });
    clearObjectCache();
    clearTraitCache();
    const filtered = await handle({ name: 'Product', context: 'detail' });

    const keys = Object.keys(filtered.viewExtensions);
    expect(keys.length).toBeLessThanOrEqual(1);
    if (keys.length === 1) {
      expect(keys[0]).toBe('detail');
    }
    expect(Object.keys(full.viewExtensions).length).toBeGreaterThanOrEqual(keys.length);
  });

  it('non-matching context returns empty viewExtensions', async () => {
    const output = await handle({ name: 'User', context: 'nonexistent' });
    expect(Object.keys(output.viewExtensions)).toHaveLength(0);
  });

  // ---- Error cases ----

  it('unknown object throws with closest match', async () => {
    await expect(handle({ name: 'Usr' })).rejects.toThrowError(
      /not found.*Did you mean.*User/,
    );
  });

  it('completely unknown object throws without suggestion', async () => {
    await expect(handle({ name: 'XyzAbcNothing123' })).rejects.toThrowError(/not found/);
  });
});
