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

describe('object.list', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  it('validates input schema contracts', () => {
    expect(validateInput({})).toBe(true);
    expect(validateInput({ domain: 'core' })).toBe(true);
    expect(validateInput({ maturity: 'stable' })).toBe(true);
    expect(validateInput({ trait: 'Priceable' })).toBe(true);
    expect(validateInput({ domain: 'core', maturity: 'stable', trait: 'Priceable' })).toBe(true);
    expect(validateInput({ unknown: true })).toBe(false);
    expect(validateInput({ maturity: 'invalid' })).toBe(false);
  });

  it('returns all objects with no filters', async () => {
    const output = await handle({});

    expect(output.objects).toBeDefined();
    expect(Array.isArray(output.objects)).toBe(true);
    expect(output.totalCount).toBeGreaterThan(0);
    expect(output.totalCount).toBe(output.objects.length);
    expect(output.filters.domain).toBeNull();
    expect(output.filters.maturity).toBeNull();
    expect(output.filters.trait).toBeNull();
  });

  it('output validates against schema', async () => {
    const output = await handle({});
    expect(validateOutput(output)).toBe(true);
    if (validateOutput.errors) {
      // eslint-disable-next-line no-console
      console.error('Output validation errors:', validateOutput.errors);
    }
    expect(validateOutput.errors).toBeNull();
  });

  it('each entry has required fields', async () => {
    const output = await handle({});

    for (const entry of output.objects) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.domain).toBe('string');
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(Array.isArray(entry.traits)).toBe(true);
      expect(typeof entry.fieldCount).toBe('number');
      expect(entry.fieldCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(entry.tags)).toBe(true);
    }
  });

  it('includes known objects', async () => {
    const output = await handle({});
    const names = output.objects.map((o) => o.name);
    expect(names).toContain('User');
    expect(names).toContain('Product');
  });

  it('filters by domain', async () => {
    const output = await handle({ domain: 'core' });

    expect(output.objects.length).toBeGreaterThan(0);
    for (const entry of output.objects) {
      expect(entry.domain.toLowerCase().startsWith('core')).toBe(true);
    }
    expect(output.filters.domain).toBe('core');
  });

  it('filters by trait', async () => {
    const output = await handle({ trait: 'Priceable' });

    expect(output.objects.length).toBeGreaterThan(0);
    for (const entry of output.objects) {
      const hasMatch = entry.traits.some(
        (t) => t.toLowerCase().includes('priceable'),
      );
      expect(hasMatch).toBe(true);
    }
    expect(output.filters.trait).toBe('Priceable');
  });

  it('filters by maturity', async () => {
    const output = await handle({ maturity: 'stable' });

    for (const entry of output.objects) {
      expect(entry.maturity).toBe('stable');
    }
    expect(output.filters.maturity).toBe('stable');
  });

  it('returns empty for non-matching filter', async () => {
    const output = await handle({ domain: 'nonexistent.domain.xyz' });
    expect(output.objects).toHaveLength(0);
    expect(output.totalCount).toBe(0);
  });

  it('trait filter works with category-qualified names', async () => {
    const output = await handle({ trait: 'financial/Priceable' });

    expect(output.objects.length).toBeGreaterThan(0);
    expect(output.filters.trait).toBe('financial/Priceable');
  });
});
