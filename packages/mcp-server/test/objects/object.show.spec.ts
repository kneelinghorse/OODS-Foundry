import { afterEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/object.show.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/object.show.output.json' assert { type: 'json' };
import { handle } from '../../src/tools/object.show.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

describe('object.show', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  it('validates input schema contracts', () => {
    expect(validateInput({ name: 'User' })).toBe(true);
    expect(validateInput({ name: 'User', context: 'detail' })).toBe(true);
    expect(validateInput({})).toBe(false); // name is required
    expect(validateInput({ name: 'User', unknown: true })).toBe(false);
  });

  it('returns full object definition for User', async () => {
    const output = await handle({ name: 'User' });

    expect(output.name).toBe('User');
    expect(output.version).toBeDefined();
    expect(output.domain).toBeDefined();
    expect(output.description).toBeDefined();
    expect(Array.isArray(output.tags)).toBe(true);
    expect(Array.isArray(output.traits)).toBe(true);
    expect(output.traits.length).toBeGreaterThan(0);
  });

  it('output validates against schema', async () => {
    const output = await handle({ name: 'User' });
    const valid = validateOutput(output);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.error('Validation errors:', JSON.stringify(validateOutput.errors, null, 2));
    }
    expect(valid).toBe(true);
    expect(validateOutput.errors).toBeNull();
  });

  it('traits include name, alias, and parameters', async () => {
    const output = await handle({ name: 'User' });

    for (const trait of output.traits) {
      expect(typeof trait.name).toBe('string');
      expect(trait.alias === null || typeof trait.alias === 'string').toBe(true);
      expect(trait.parameters === null || typeof trait.parameters === 'object').toBe(true);
    }

    // User has traits with aliases
    const withAlias = output.traits.find((t) => t.alias !== null);
    expect(withAlias).toBeDefined();
  });

  it('schema includes object and trait fields', async () => {
    const output = await handle({ name: 'User' });

    // Object's own fields
    expect(output.schema.user_id).toBeDefined();
    expect(output.schema.user_id.type).toBe('uuid');
    expect(output.schema.user_id.required).toBe(true);

    // Trait-contributed fields
    expect(output.schema.created_at).toBeDefined();
  });

  it('semantics include semantic_type and token_mapping', async () => {
    const output = await handle({ name: 'User' });

    expect(Object.keys(output.semantics).length).toBeGreaterThan(0);
    for (const [, mapping] of Object.entries(output.semantics)) {
      expect(mapping.semantic_type).toBeDefined();
      expect(mapping.token_mapping).toBeDefined();
    }
  });

  it('tokens section is populated', async () => {
    const output = await handle({ name: 'User' });
    expect(Object.keys(output.tokens).length).toBeGreaterThan(0);
  });

  it('viewExtensions populated from traits', async () => {
    const output = await handle({ name: 'Product' });
    expect(Object.keys(output.viewExtensions).length).toBeGreaterThan(0);
  });

  it('context filter narrows viewExtensions', async () => {
    const full = await handle({ name: 'Product' });
    clearObjectCache();
    clearTraitCache();
    const filtered = await handle({ name: 'Product', context: 'detail' });

    // Filtered should have at most 1 context key
    const filteredKeys = Object.keys(filtered.viewExtensions);
    expect(filteredKeys.length).toBeLessThanOrEqual(1);
    if (filteredKeys.length === 1) {
      expect(filteredKeys[0]).toBe('detail');
    }

    // Full should have more contexts
    expect(Object.keys(full.viewExtensions).length).toBeGreaterThanOrEqual(
      filteredKeys.length,
    );
  });

  it('context filter with non-matching context returns empty viewExtensions', async () => {
    const output = await handle({ name: 'User', context: 'nonexistent' });
    expect(Object.keys(output.viewExtensions)).toHaveLength(0);
  });

  it('throws for unknown object with closest match suggestion', async () => {
    await expect(handle({ name: 'Usr' })).rejects.toThrowError(
      /not found.*Did you mean.*User/,
    );
  });

  it('throws for completely unknown object without suggestion', async () => {
    await expect(handle({ name: 'XyzAbcNothing123' })).rejects.toThrowError(
      /not found/,
    );
  });

  it('filePath points to a .object.yaml file', async () => {
    const output = await handle({ name: 'User' });
    expect(output.filePath).toMatch(/\.object\.yaml$/);
  });

  it('output validates for all known objects', async () => {
    const { listObjects } = await import('../../src/objects/object-loader.js');
    const names = listObjects();

    for (const name of names) {
      clearObjectCache();
      clearTraitCache();
      const output = await handle({ name });
      const valid = validateOutput(output);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error(`Validation failed for ${name}:`, JSON.stringify(validateOutput.errors, null, 2));
      }
      expect(valid).toBe(true);
    }
  });
});
