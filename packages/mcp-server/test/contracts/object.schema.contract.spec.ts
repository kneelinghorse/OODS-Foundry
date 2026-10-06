import { afterEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import objectListInputSchema from '../../src/schemas/object.list.input.json' assert { type: 'json' };
import objectListOutputSchema from '../../src/schemas/object.list.output.json' assert { type: 'json' };
import objectShowInputSchema from '../../src/schemas/object.show.input.json' assert { type: 'json' };
import objectShowOutputSchema from '../../src/schemas/object.show.output.json' assert { type: 'json' };
import { handle as handleList } from '../../src/tools/object.list.js';
import { handle as handleShow } from '../../src/tools/object.show.js';
import { clearObjectCache, listObjects } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';

const ajv = getAjv();

describe('object schema contracts', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  describe('object.list', () => {
    const validateInput = ajv.compile(objectListInputSchema);
    const validateOutput = ajv.compile(objectListOutputSchema);

    it('input schema rejects additionalProperties', () => {
      expect(validateInput({ extra: true })).toBe(false);
    });

    it('output schema covers all returned fields', async () => {
      const output = await handleList({});
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

    it('each entry passes validation for all objects', async () => {
      const output = await handleList({});
      const valid = validateOutput(output);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error('object.list output errors:', JSON.stringify(validateOutput.errors, null, 2));
      }
      expect(valid).toBe(true);
    });
  });

  describe('object.show', () => {
    const validateInput = ajv.compile(objectShowInputSchema);
    const validateOutput = ajv.compile(objectShowOutputSchema);

    it('input schema requires name', () => {
      expect(validateInput({})).toBe(false);
      expect(validateInput({ name: 'User' })).toBe(true);
    });

    it('input schema rejects additionalProperties', () => {
      expect(validateInput({ name: 'User', extra: true })).toBe(false);
    });

    it('output validates for User', async () => {
      const output = await handleShow({ name: 'User' });
      const valid = validateOutput(output);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error('object.show User errors:', JSON.stringify(validateOutput.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    it('output validates for every known object', async () => {
      const names = listObjects();
      for (const name of names) {
        clearObjectCache();
        clearTraitCache();
        const output = await handleShow({ name });
        const valid = validateOutput(output);
        if (!valid) {
          // eslint-disable-next-line no-console
          console.error(`object.show ${name} errors:`, JSON.stringify(validateOutput.errors, null, 2));
        }
        expect(valid).toBe(true);
      }
    });

    it('traits entries have no additionalProperties', async () => {
      const output = await handleShow({ name: 'User' });
      for (const trait of output.traits) {
        // Each trait entry should only have name, alias, parameters
        const keys = Object.keys(trait);
        expect(keys.sort()).toEqual(['alias', 'name', 'parameters']);
      }
    });

    it('schema fields have type, required, and description', async () => {
      const output = await handleShow({ name: 'User' });
      for (const [fieldName, field] of Object.entries(output.schema)) {
        expect(field.type, `${fieldName}.type`).toBeDefined();
        expect(typeof field.required, `${fieldName}.required`).toBe('boolean');
        expect(field.description, `${fieldName}.description`).toBeDefined();
      }
    });

    it('semantics have semantic_type and token_mapping', async () => {
      const output = await handleShow({ name: 'User' });
      for (const [fieldName, sem] of Object.entries(output.semantics)) {
        expect(sem.semantic_type, `${fieldName}.semantic_type`).toBeDefined();
        expect(sem.token_mapping, `${fieldName}.token_mapping`).toBeDefined();
      }
    });
  });
});
