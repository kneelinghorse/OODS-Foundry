/**
 * s222-m03 (#2502 ruling 14; #2384, #2425, #2426): an object's authored `samples` are its sample records. The producer
 * (populateObjectSchema) turns them into per-field examples aligned by index, so a generated app's record i is sample i
 * on every field — trait fields included — without the object copying trait fields to carry examples (OODS-V117), and
 * without the generator inventing a value for a field a sample leaves out.
 */
import { describe, expect, it } from 'vitest';
import { populateObjectSchema } from '../../src/compose/object-slot-filler.js';
import { sampleCountFor } from '../../src/compose/workflow-assembler.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import type { FieldDefinition } from '../../src/objects/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const shape = (): UiSchema => ({ version: '2026.02', screens: [{ id: 'root', component: 'Box' }] });

describe('samples become aligned per-field examples', () => {
  it('gives every named field, trait fields included, one example per sample in sample order', () => {
    const organization = composeObject(loadObject('Organization'));
    const schema = shape();
    populateObjectSchema(schema, organization.schema, organization.semantics, organization.traits, organization.samples);
    const samples = organization.samples!;
    const fields = schema.objectSchema!;
    // label and status are content/Labelled's and lifecycle/Stateful's fields; domain is the object's own.
    for (const field of ['label', 'status', 'state_history', 'owner_name', 'domain']) {
      expect(fields[field]!.examples, field).toEqual(samples.map(sample => sample[field]));
    }
    // The trait fields carry the examples without the object redeclaring them: no refinement, so no OODS-V117.
    expect(Object.keys(loadObject('Organization').schema)).not.toContain('status');
    expect(organization.warnings.filter(warning => /refines/.test(warning))).toEqual([]);
  });

  it('fills a field a sample leaves out from that field\'s own example at the index, else its neutral value, never an enum member or default', () => {
    const fields: Record<string, FieldDefinition> = {
      title: { type: 'string', required: true },
      tier: { type: 'string', required: true, default: 'gold', validation: { enum: ['gold', 'silver'] } },
      note: { type: 'string', required: false, examples: ['first', 'second', 'third'] },
      closed_at: { type: 'datetime', required: false },
      seats: { type: 'number', required: false, examples: [4] },
      untouched: { type: 'string', required: false, examples: ['kept', 'as authored'] },
    };
    const schema = shape();
    populateObjectSchema(schema, fields, undefined, [], [
      { title: 'A', tier: 'silver', note: 'from the sample', closed_at: '2026-09-01T00:00:00Z', seats: 2 },
      { title: 'B' },
      { title: 'C' },
    ]);
    const entry = schema.objectSchema!;
    expect(entry.title!.examples).toEqual(['A', 'B', 'C']);
    // The sample did not record a tier: the record says nothing, rather than the default or another enum member.
    expect(entry.tier!.examples).toEqual(['silver', '', '']);
    // The field's own authored example at the same index is authored data for that record.
    expect(entry.note!.examples).toEqual(['from the sample', 'second', 'third']);
    // An absent optional date stays absent; a number with no authored example at the index is the neutral 0.
    expect(entry.closed_at!.examples).toEqual(['2026-09-01T00:00:00Z', null, null]);
    expect(entry.seats!.examples).toEqual([2, 0, 0]);
    // A field no sample names keeps its own examples.
    expect(entry.untouched!.examples).toEqual(['kept', 'as authored']);
    // The object's definition is not rewritten.
    expect(fields.note!.examples).toEqual(['first', 'second', 'third']);
  });

  it('refuses samples that name a field the object lacks, a field it never supplies, or a value its enum does not allow', () => {
    const fields: Record<string, FieldDefinition> = {
      status: { type: 'string', required: true, validation: { enum: ['open', 'closed'] } },
      hidden: { type: 'string', required: false, unavailable: true },
    };
    expect(() => populateObjectSchema(shape(), fields, undefined, [], [{ status: 'open' }, { statsu: 'open' }])).toThrow('sample 2 names "statsu", which is not a field of this object');
    expect(() => populateObjectSchema(shape(), fields, undefined, [], [{ hidden: 'x' }])).toThrow('sample 1 names "hidden", a field this object never supplies');
    expect(() => populateObjectSchema(shape(), fields, undefined, [], [{ status: 'open' }, { status: 'opened' }])).toThrow('sample 2 gives status "opened"');
    expect(() => populateObjectSchema(shape(), fields, undefined, [], [['open']])).toThrow('Invalid samples');
  });

  it('leaves an object without samples exactly as before', () => {
    const fields: Record<string, FieldDefinition> = { title: { type: 'string', required: true, examples: ['one'] } };
    const withSamples = shape(), without = shape();
    populateObjectSchema(without, fields);
    populateObjectSchema(withSamples, fields, undefined, [], undefined);
    expect(withSamples).toEqual(without);
    expect(without.objectSchema!.title!.examples).toEqual(['one']);
  });
});

describe('sample count', () => {
  it('equals the number of samples, clamped to 5-10; an object without samples keeps ten', () => {
    expect(sampleCountFor(undefined)).toBe(10);
    expect(sampleCountFor([])).toBe(10);
    expect(sampleCountFor([{}, {}, {}])).toBe(5);
    expect(sampleCountFor(Array.from({ length: 8 }, () => ({})))).toBe(8);
    expect(sampleCountFor(Array.from({ length: 12 }, () => ({})))).toBe(10);
  });

  it('seeds a workflow app with one coherent record per sample and invents nothing', async () => {
    const result = await compose({ object: 'User', context: 'workflow', preferences: { seed: 's222-m03' }, options: { transient: true, validate: false } });
    expect(result.status).toBe('ok');
    const samples = loadObject('User').samples!;
    expect(result.schema.workflow!.data.sampleCount).toBe(samples.length);
    const { records, seedTable } = workflowSampleData(result.schema);
    expect(records).toHaveLength(samples.length);
    const named = [...new Set(samples.flatMap(sample => Object.keys(sample)))];
    for (const record of records) {
      // Every named field of a record comes from one and the same sample: a name never sits beside another's email.
      const sample = samples.find(candidate => candidate.user_id === record.user_id)!;
      expect(sample, String(record.user_id)).toBeDefined();
      for (const field of named) expect(record[field], field).toEqual(sample[field]);
    }
    // Each sample appears once, and every named value is attributed to the authored samples.
    expect(new Set(records.map(record => record.user_id)).size).toBe(samples.length);
    expect(seedTable.filter(row => named.includes(row.field)).every(row => row.rule === 'authored field example')).toBe(true);
  });
});

describe('record keys', () => {
  const schema = (keys: unknown[]): UiSchema => ({
    version: '2026.02', screens: [{ id: 'root', component: 'Box' }],
    objectSchema: { thing_id: { type: 'string', required: true, examples: keys }, name: { type: 'string', required: true, examples: ['A', 'B', 'C', 'D', 'E'] } },
    workflow: { object: 'Thing', screens: [], transitions: [], states: [], data: { idField: 'thing_id', traits: [], sampleCount: 5, recordedEvents: [], cancellationRequiresReason: false, cancellationReasonCodes: [], lifecycleStates: [], billingIntervals: [], currency: 'usd', minorUnits: 100 } },
  } as unknown as UiSchema);

  it('uses authored keys only when every one is present and distinct, so editing one record cannot edit another', () => {
    expect(workflowSampleData(schema(['a', 'b', 'c', 'd', 'e'])).records.map(record => record.thing_id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // Samples that name an id for some records only leave the others empty; those records get neutral unique keys.
    const partial = workflowSampleData(schema(['a', '', 'c', '', 'e'])).records.map(record => record.thing_id);
    expect(new Set(partial).size).toBe(5);
    expect(partial).toEqual(['sample-1', 'sample-2', 'sample-3', 'sample-4', 'sample-5']);
    expect(workflowSampleData(schema(['a', 'a', 'c', 'd', 'e'])).records.map(record => record.thing_id)).toEqual(['sample-1', 'sample-2', 'sample-3', 'sample-4', 'sample-5']);
  });
});
