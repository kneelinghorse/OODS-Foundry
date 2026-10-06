import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle as validate } from '../../src/tools/object.validate.js';
import { handle as register } from '../../src/tools/object.register.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/object.output.json' assert { type: 'json' };
import { handle as show } from '../../src/tools/object.show.js';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
const validatePublicOutput = getAjv().compile(outputSchema);
const relationship = { target: 'Organization', via: 'organization_id', cardinality: 'many-to-one', label: 'Operated by' };
const definition = (relationships: unknown = [relationship]) => ({ object: { name: 'Depot', version: '1.0.0', domain: 'logistics', description: 'A team depot.' }, schema: { name: { type: 'string', required: true, description: 'Depot name' }, organization_id: { type: 'uuid', required: true, description: 'Operating organization' } }, relationships });
let folder: string;
beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 's215-rel-')); process.env.OODS_OBJECTS_DIR = folder; clearObjectCache(); });
afterEach(() => { delete process.env.OODS_OBJECTS_DIR; clearObjectCache(); fs.rmSync(folder, { recursive: true, force: true }); });
describe('declared object relationships', () => {
  it('retains team declarations through validate, register and reload instead of silently discarding them', async () => {
    const yaml = dump(definition());
    expect((await validate({ yaml })).valid).toBe(true);
    await register({ yaml });
    clearObjectCache();
    expect((loadObject('Depot') as any).relationships).toEqual([relationship]);
    const output = await show({ name: 'Depot' });
    expect(validatePublicOutput(output), JSON.stringify(validatePublicOutput.errors)).toBe(true);
  });
  it.each([
    [{ ...relationship, target: 'MissingObject' }, 'unknown-relationship-target'],
    [{ ...relationship, via: 'missing_field' }, 'unknown-relationship-field'],
    [{ ...relationship, cardinality: 'lots' }, 'invalid-relationship'],
    [{ ...relationship, label: '' }, 'invalid-relationship'],
  ])('refuses a broken declaration before writing a team file', async (relation, kind) => {
    const yaml = dump(definition([relation]));
    const result = await validate({ yaml });
    expect(result.valid).toBe(false);
    expect(validatePublicOutput(result), JSON.stringify(validatePublicOutput.errors)).toBe(true);
    expect(result.errors).toContainEqual(expect.objectContaining({ kind }));
    await expect(register({ yaml })).rejects.toThrow();
    expect(fs.readdirSync(folder)).toEqual([]);
  });
  it('allows self links before registration and fields contributed by traits', async () => {
    const doc = definition([{ target: 'Depot', via: 'owner_id', cardinality: 'many-to-one', label: 'Parent depot' }]);
    (doc as any).traits = [{ name: 'structural/Ownerable' }];
    expect((await validate({ yaml: dump(doc) })).errors).toEqual([]);
  });
  it('does not infer any relationship from an undeclared uuid field', async () => {
    const doc = definition(); delete (doc as any).relationships;
    await register({ yaml: dump(doc) });
    expect((loadObject('Depot') as any).relationships).toBeUndefined();
  });
  it('rejects malformed collections and duplicate source-field/target edges', async () => {
    for (const relationships of [{ target: 'Organization' }, [relationship, relationship]]) {
      expect((await validate({ yaml: dump(definition(relationships)) })).errors).toContainEqual(expect.objectContaining({ kind: 'invalid-relationship' }));
    }
  });
});
