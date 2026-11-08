/**
 * s244-m03 (#2829): the importer recognizes agents where the schema says so.
 * - A proto3 JSON enum (A2A's TaskStatus.state: its string values, an UNSPECIFIED sentinel pattern and the int32 wire
 *   form) is that string enum; the sentinel is never a state (#2835).
 * - A status reference whose target holds one state enum gives the referring record its lifecycle: A2A's Task gets its
 *   eight task states, and TaskStatus keeps its state field (#2836).
 * - Agent evidence is graded on structure (#2837, #2651): a field's name alone is weak; a reference to a person, group,
 *   directory or app record backs it. Nothing applies without acceptance, and a name-only proposal never grades higher.
 */
import { describe, expect, it } from 'vitest';
import { draftSource, protobufEnum } from '../../src/importer/draft.js';
import type { Proposal } from '../../src/importer/draft.js';

const STATES = ['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_REJECTED', 'TASK_STATE_AUTH_REQUIRED'];
const protoState = { anyOf: [{ type: 'string', pattern: '^TASK_STATE_UNSPECIFIED$' }, { type: 'string', enum: STATES }, { type: 'integer', minimum: -2147483648, maximum: 2147483647 }], default: 0, description: 'The current state of this task.' };
const from = (defs: Record<string, unknown>) => draftSource({ content: JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: defs }), name: 'source.json', format: 'json-schema' });
const draftOf = (result: ReturnType<typeof draftSource>, name: string) => result.drafts.find(draft => draft.name === name)!;
const proposal = (result: ReturnType<typeof draftSource>, object: string, trait: string): Proposal | undefined => draftOf(result, object).proposals.find(item => item.trait.name === trait);

describe('proto3 JSON enums and status references (A2A)', () => {
  const a2a = from({
    TaskStatus: { type: 'object', properties: { state: protoState, timestamp: { type: 'string', format: 'date-time' } } },
    Task: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, status: { $ref: '#/$defs/TaskStatus', description: 'The current status of a Task.' } } },
  });

  it('reads the enum union as its string values, without the sentinel or the wire default', () => {
    expect(protobufEnum(protoState, a2a.hub)).toEqual({ key: 'anyOf', index: 1, values: STATES });
    const state = draftOf(a2a, 'TaskStatus').definition.schema.state;
    expect(state).toMatchObject({ type: 'string', validation: { enum: STATES } });
    expect(state.default).toBeUndefined();
    expect(proposal(a2a, 'TaskStatus', 'Stateful')).toMatchObject({ grade: 'medium', valid: true, trait: { parameters: { states: STATES, initialState: 'TASK_STATE_SUBMITTED' } } });
  });

  it("gives Task its eight states through the status reference, and TaskStatus keeps its state field", () => {
    const task = draftOf(a2a, 'Task');
    expect(task.definition.schema.status).toMatchObject({ type: 'string', validation: { enum: STATES } });
    expect(task.definition.relationships ?? []).not.toContainEqual(expect.objectContaining({ via: 'status' }));
    const stateful = proposal(a2a, 'Task', 'Stateful')!;
    expect(stateful).toMatchObject({ grade: 'medium', valid: true, trait: { fieldBindings: expect.objectContaining({ status: 'status' }), parameters: { states: STATES } } });
    expect(stateful.evidence).toEqual([expect.objectContaining({ kind: 'structure', pointer: '/$defs/TaskStatus/properties/state/anyOf/1/enum' })]);
    expect(Object.keys(draftOf(a2a, 'TaskStatus').definition.schema)).toContain('state');
  });

  it('leaves every other union a union', () => {
    for (const union of [
      { anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'string', enum: ['c'] }] },
      { anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'number' }] },
      { anyOf: [{ type: 'string', pattern: '^X_UNSPECIFIED$' }, { type: 'integer' }] },
      { anyOf: [{ type: 'string', enum: ['a'] }, { type: 'string', pattern: '^[a-z]+$' }] },
    ]) expect(protobufEnum(union, a2a.hub), JSON.stringify(union)).toBeUndefined();
    // A status reference to a record with no single state enum stays a relationship.
    const plain = from({ Note: { type: 'object', properties: { body: { type: 'string' } } }, Task: { type: 'object', properties: { status: { $ref: '#/$defs/Note' } } } });
    expect(draftOf(plain, 'Task').definition.relationships).toContainEqual(expect.objectContaining({ via: 'status', target: 'Note' }));
  });
});

describe('agent evidence, graded on structure', () => {
  const user = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } };
  const app = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } };
  const result = from({
    User: user, Group: user, Installation: app,
    Agent: {
      type: 'object',
      properties: {
        id: { type: 'string' }, name: { type: 'string' },
        sponsors: { type: 'array', items: { $ref: '#/$defs/User' } },
        owners: { type: 'array', items: { $ref: '#/$defs/Group' } },
        runAsUser: { anyOf: [{ $ref: '#/$defs/User' }, { type: 'null' }] },
        is_bot: { type: 'boolean' }, installation: { $ref: '#/$defs/Installation' },
        resource_type: { type: 'string', enum: ['agent'] },
        accountEnabled: { type: ['boolean', 'null'] },
      },
    },
    Person: { type: 'object', properties: { id: { type: 'string' }, owners: { type: 'array', items: { type: 'string', format: 'email' } }, owner: { type: 'boolean' }, identityParentId: { type: 'string' }, app: { type: 'boolean' }, active: { type: 'boolean' } } },
  });

  it('owners or sponsors that reference people or groups propose Ownerable at medium, sponsors as a person or team', () => {
    const ownerable = proposal(result, 'Agent', 'Ownerable')!;
    expect(ownerable).toMatchObject({ grade: 'medium', valid: true, trait: { parameters: { ownerTypes: ['user', 'team'], primaryOwnerType: 'user' } } });
    expect(ownerable.evidence.map(item => [item.kind, item.pointer])).toEqual([['structure', '/$defs/Agent/properties/sponsors'], ['structure', '/$defs/Agent/properties/owners']]);
  });

  it('a run-as reference to a user, a bot flag beside an app reference and a declared agent type propose Actor as an agent at medium', () => {
    const actor = proposal(result, 'Agent', 'Actor')!;
    expect(actor).toMatchObject({ grade: 'medium', valid: true, trait: { parameters: { kind: 'agent' } } });
    const pointers = actor.evidence.map(item => item.pointer);
    for (const field of ['runAsUser', 'is_bot', 'installation', 'resource_type']) expect(pointers).toContain(`/$defs/Agent/properties/${field}`);
    expect(actor.evidence.every(item => item.kind === 'structure')).toBe(true);
  });

  it('an enabled flag proposes a two-state lifecycle, weak: a flag is not a state', () => {
    expect(proposal(result, 'Agent', 'Stateful')).toMatchObject({ grade: 'weak', trait: { parameters: { states: ['enabled', 'disabled'], initialState: 'enabled' } } });
    expect(proposal(result, 'Agent', 'Stateful')!.evidence.every(item => item.kind === 'name')).toBe(true);
  });

  it('names alone grade weak, and a boolean named owner is never an owner reference', () => {
    expect(proposal(result, 'Person', 'Ownerable')).toMatchObject({ grade: 'weak', evidence: [expect.objectContaining({ kind: 'name', pointer: '/$defs/Person/properties/owners' })] });
    expect(proposal(result, 'Person', 'Ownerable')!.evidence.map(item => item.pointer)).not.toContain('/$defs/Person/properties/owner');
    const actor = proposal(result, 'Person', 'Actor')!;
    expect(actor).toMatchObject({ grade: 'weak', trait: { parameters: { kind: 'agent' } } });
    expect(actor.evidence.map(item => [item.kind, item.pointer]).sort()).toEqual([['name', '/$defs/Person/properties/app'], ['name', '/$defs/Person/properties/identityParentId']]);
    expect(proposal(result, 'Person', 'Stateful')).toMatchObject({ grade: 'weak', trait: { parameters: { states: ['active', 'inactive'] } } });
  });

  it('a record with none of the evidence gets no agent proposal (A2A AgentCard shape)', () => {
    const card = from({ AgentProvider: { type: 'object', properties: { organization: { type: 'string' }, url: { type: 'string' } } }, AgentCard: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' }, provider: { $ref: '#/$defs/AgentProvider' }, skills: { type: 'array', items: { type: 'string' } } } } });
    expect(draftOf(card, 'AgentCard').proposals.map(item => item.trait.name)).toEqual([]);
  });
});
