import { afterEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/object.list.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/object.list.output.json' assert { type: 'json' };
import { handle } from '../../src/tools/object.list.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

describe('object.list contract', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  // ---- Schema validation ----

  it('input schema accepts empty object', () => {
    expect(validateInput({})).toBe(true);
  });

  it('input schema accepts all filter combinations', () => {
    expect(validateInput({ domain: 'core' })).toBe(true);
    expect(validateInput({ maturity: 'stable' })).toBe(true);
    expect(validateInput({ trait: 'Priceable' })).toBe(true);
    expect(validateInput({ domain: 'core', maturity: 'stable', trait: 'Priceable' })).toBe(true);
  });

  it('input schema rejects invalid maturity values', () => {
    expect(validateInput({ maturity: 'invalid' })).toBe(false);
  });

  it('input schema rejects additionalProperties', () => {
    expect(validateInput({ extra: true })).toBe(false);
  });

  it('output schema validates unfiltered response', async () => {
    const output = await handle({});
    const valid = validateOutput(output);
    expect(valid).toBe(true);
    expect(validateOutput.errors).toBeNull();
  });

  it('output schema rejects extra top-level fields', () => {
    expect(
      validateOutput({
        objects: [],
        totalCount: 0,
        filters: { domain: null, maturity: null, trait: null },
        extra: true,
      }),
    ).toBe(false);
  });

  // ---- Filter behavior ----

  it('unfiltered returns all objects', async () => {
    const output = await handle({});
    expect(output.totalCount).toBeGreaterThan(0);
    expect(output.objects.length).toBe(output.totalCount);
    expect(output.filters.domain).toBeNull();
    expect(output.filters.maturity).toBeNull();
    expect(output.filters.trait).toBeNull();
  });

  it('domain filter narrows results to matching domain', async () => {
    const output = await handle({ domain: 'core' });
    expect(output.objects.length).toBeGreaterThan(0);
    for (const obj of output.objects) {
      expect(obj.domain.toLowerCase().startsWith('core')).toBe(true);
    }
    expect(output.filters.domain).toBe('core');

    // Unfiltered should have more results
    const all = await handle({});
    expect(all.totalCount).toBeGreaterThanOrEqual(output.totalCount);
  });

  it('domain filter is case-insensitive', async () => {
    const lower = await handle({ domain: 'core' });
    clearObjectCache();
    const upper = await handle({ domain: 'Core' });
    expect(lower.totalCount).toBe(upper.totalCount);
  });

  it('maturity filter narrows results', async () => {
    const output = await handle({ maturity: 'stable' });
    for (const obj of output.objects) {
      expect(obj.maturity).toBe('stable');
    }
    expect(output.filters.maturity).toBe('stable');
  });

  it('trait filter returns objects composing that trait', async () => {
    const output = await handle({ trait: 'Priceable' });
    expect(output.objects.length).toBeGreaterThan(0);
    for (const obj of output.objects) {
      const hasTrait = obj.traits.some(
        (t) => t.toLowerCase().includes('priceable'),
      );
      expect(hasTrait).toBe(true);
    }
    expect(output.filters.trait).toBe('Priceable');
  });

  it('non-matching filter returns empty result', async () => {
    const output = await handle({ domain: 'nonexistent.xyz' });
    expect(output.objects).toHaveLength(0);
    expect(output.totalCount).toBe(0);
  });

  // ---- Entry shape ----

  it('each entry has all required fields', async () => {
    const output = await handle({});
    for (const obj of output.objects) {
      expect(typeof obj.name).toBe('string');
      expect(typeof obj.domain).toBe('string');
      expect(typeof obj.version).toBe('string');
      expect(typeof obj.description).toBe('string');
      expect(typeof obj.fieldCount).toBe('number');
      expect(Array.isArray(obj.traits)).toBe(true);
      expect(Array.isArray(obj.tags)).toBe(true);
      expect(obj.maturity === null || typeof obj.maturity === 'string').toBe(true);
    }
  });
});
