/**
 * s247-m03: the importer recognises another system's record of work where the schema says so.
 * - A state enum with a working value, a finished value and a value that means a person is needed, beside a single
 *   reference to the one doing the work (an agent's or an app's record, or a person or other principal named for the one
 *   doing it), proposes Assignment at medium. Either alone proposes nothing, and a name alone decides nothing.
 * - It binds only what the source has, and only where the type fits: a same-named field of another type stays unbound.
 * - Where it fires, the references it binds are not guessed again: a reference to the record's own kind is the task it came
 *   from, not a category tree, and the one doing the work (and who asked) is not an owner with nothing bound. Where it does
 *   not fire, every proposal is the one the 0.13.1 importer drafted (the fixture's "before", by id).
 * - The record's lifecycle is its work's states, ahead of another enum that sorts first.
 * - Accepting the proposal with fields unbound never rolls back, and the accepted records' screens compose.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import type { Proposal } from '../../src/importer/draft.js';
import { workValues } from '../../src/importer/proposals.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';

type Source = { format: 'openapi' | 'json-schema' | 'sql' | 'prisma' | 'graphql'; name: string; content: string };
type Before = { id: string; trait: string; grade: string; valid: boolean; evidence: string[] };
const FIXTURES = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/importer/work-records.s247.json'), 'utf8')) as { sources: Record<string, Source>; before: Record<string, Record<string, Before[]>> };
type Result = ReturnType<typeof draftSource>;
const drafted = new Map<string, Result>();
const draft = (key: string) => { if (!drafted.has(key)) drafted.set(key, draftSource(FIXTURES.sources[key])); return drafted.get(key)!; };
const draftOf = (key: string, name: string) => draft(key).drafts.find(item => item.name === name)!;
const proposal = (key: string, object: string, trait: string): Proposal | undefined => draftOf(key, object).proposals.find(item => item.trait.name === trait);
const bound = (item: Proposal | undefined) => Object.fromEntries(Object.entries(item?.trait.fieldBindings ?? {}).filter(([, target]) => target));
const ids = (proposals: Array<{ id: string }>) => proposals.map(item => item.id).sort();
const before = (key: string, object: string) => FIXTURES.before[key][object];
/** The records of work in the fixtures, and nothing else, get Assignment. */
const FIRES: Array<[string, string]> = [['sql-work', 'Jobs'], ['prisma-work', 'Job'], ['openapi-work', 'AgentJob'], ['openapi-work', 'Chore'], ['linear-mini', 'AgentSession']];

describe('the states of a record of work', () => {
  it('reads a working, a finished and a needs-a-person value, with a prefix every value shares taken off', () => {
    expect(workValues(['TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_REJECTED', 'TASK_STATE_AUTH_REQUIRED'])).toEqual({ working: 'TASK_STATE_WORKING', finished: 'TASK_STATE_COMPLETED', needsPerson: 'TASK_STATE_INPUT_REQUIRED' });
    expect(workValues(['active', 'awaitingInput', 'complete', 'error', 'pending', 'stale', 'stopping'])).toEqual({ working: 'active', finished: 'complete', needsPerson: 'awaitingInput' });
    expect(workValues(['queued', 'in_progress', 'completed', 'failed', 'idle', 'waiting_for_user', 'timed_out', 'cancelled'])).toEqual({ working: 'in_progress', finished: 'completed', needsPerson: 'waiting_for_user' });
    expect(workValues(['cancelled', 'completed', 'failed', 'input_required', 'working'])).toEqual({ working: 'working', finished: 'completed', needsPerson: 'input_required' });
  });

  it('reads no record of work where no value says a person is needed, or one of the three is missing', () => {
    for (const values of [
      ['working', 'blocked', 'expired', 'finished', 'suspend_requested', 'resumed'], // Devin's: blocked waits on anything
      ['todo', 'in_progress', 'blocked', 'done'], // a tracker's
      ['pending', 'processing', 'shipped', 'delivered'], // an order's
      ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded'], // a payment's
      ['pending', 'approved', 'rejected'], // an approval's
      ['working', 'needs_input'], ['needs_input', 'done', 'failed'], ['working', 'waiting', 'done'],
      ['working', 'needs_input', 2],
    ]) expect(workValues(values), JSON.stringify(values)).toBeUndefined();
  });
});

describe('a record of work proposes Assignment on structure', () => {
  it("binds what an agent's job has: the agent doing it, who asked, the thing, the task it came from, the dates, the ask, the result and the tries", () => {
    const job = proposal('openapi-work', 'AgentJob', 'Assignment')!;
    expect(job).toMatchObject({ grade: 'medium', valid: true, errors: [] });
    expect(bound(job)).toEqual({ asked_of_id: 'agent', requested_by_id: 'requested_by', subject_id: 'order', parent_id: 'parent', due_at: 'deadline', instruction: 'prompt', result: 'outcome', tries: 'run_count' });
    expect(job.evidence.map(item => [item.kind, item.pointer.split('/').slice(-2).join('/')])).toEqual([
      ['structure', 'properties/agent'], ['structure', 'state/enum'], ['name', 'properties/requested_by'], ['structure', 'properties/parent'],
      ['structure', 'properties/order'], ['name', 'properties/deadline'], ['name', 'properties/prompt'], ['name', 'properties/outcome'], ['name', 'properties/run_count'],
    ]);
    expect(job.evidence[0].reason).toBe("agent references Agent, an agent's or an app's own record: the one doing the work (asked_of_id).");
    expect(job.evidence[1].reason).toBe('state holds a working value (running), a finished value (done) and a value that means a person is needed (awaiting_input): the states of a record of work, proposed as its lifecycle (Stateful) unless the source declares another.');
    expect(job.evidence[3].reason).toBe("parent references AgentJob, this record's own kind: read as the task this one came from (parent_id), not a category tree; confirm before accepting.");
  });

  it('binds each field to one the source has, of the same type', () => {
    for (const [key, object] of FIRES) {
      const item = proposal(key, object, 'Assignment')!;
      expect(item, `${key}/${object}`).toMatchObject({ grade: 'medium', valid: true });
      const schema = draftOf(key, object).definition.schema;
      for (const [field, target] of Object.entries(bound(item))) expect(schema[target as string].type.replace(/\?$/, ''), `${object}.${field}`).toBe(field === 'due_at' ? 'datetime' : field === 'tries' ? 'integer' : 'string');
    }
    expect(bound(proposal('sql-work', 'Jobs', 'Assignment'))).toEqual({ asked_of_id: 'assignee_id', requested_by_id: 'created_by', parent_id: 'parent_id', subject_id: 'ticket_id', due_at: 'due_at', result: 'result', tries: 'attempts' });
  });

  it('leaves a same-named field of another type unbound, and the proposal stays valid', () => {
    const chore = proposal('openapi-work', 'Chore', 'Assignment')!;
    expect(chore).toMatchObject({ grade: 'medium', valid: true, errors: [] });
    expect(bound(chore)).toEqual({ asked_of_id: 'assignee' });
    // result is a boolean, tries text, instruction a number, due_at text without a date format, subject_id a number.
    expect(chore.trait.fieldBindings).toMatchObject({ result: null, tries: null, instruction: null, due_at: null, subject_id: null });
  });

  it('proposes nothing new for a person reference alone, such an enum alone, a name alone, or states that never need a person', () => {
    // Note: a person, no states. Job: the states, no one. Errand: a field named assignee that references nothing.
    // Shipment: a person beside an order's states. Story: a tracker's issue, blocked instead of a person needed.
    for (const object of ['Note', 'Job', 'Errand', 'Shipment', 'Story']) {
      expect(proposal('openapi-work', object, 'Assignment'), object).toBeUndefined();
      expect(ids(draftOf('openapi-work', object).proposals), object).toEqual(ids(before('openapi-work', object)));
    }
  });

  it('reads no one doing the work from a reference held as a number or a UUID, or from a person named for nothing else', () => {
    const keyed = draftSource({ format: 'sql', name: 'keyed.sql', content: `create table users (id uuid primary key, name text not null);
create table members (id integer primary key, name text not null);
create table jobs (id uuid primary key, title text not null, assignee_id uuid references users(id), parent_id uuid references jobs(id), status text not null check (status in ('queued','in_progress','needs_input','completed')));
create table chores (id integer primary key, title text not null, assignee_id integer references members(id), status text not null check (status in ('working','waiting_for_user','done')));` });
    for (const object of ['Jobs', 'Chores']) {
      const names = keyed.drafts.find(item => item.name === object)!.proposals.map(item => item.trait.name);
      expect(names, object).not.toContain('Assignment');
      expect(names, object).toContain('Ownerable');
    }
    expect(keyed.drafts.find(item => item.name === 'Jobs')!.proposals.map(item => item.trait.name)).toContain('Classifiable');
    const plain = draftSource({ format: 'openapi', name: 'plain.json', content: JSON.stringify({ openapi: '3.0.1', info: { title: 'Plain', version: '1' }, paths: {}, components: { schemas: {
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
      Run: { type: 'object', properties: { id: { type: 'string' }, user: { $ref: '#/components/schemas/User' }, status: { type: 'string', enum: ['working', 'input_required', 'completed'] } } },
    } } }) });
    expect(plain.drafts.find(item => item.name === 'Run')!.proposals.map(item => item.trait.name)).toEqual(['Stateful']);
  });

  it('still grades a name alone weak', () => {
    const named = draftSource({ format: 'openapi', name: 'named.json', content: JSON.stringify({ openapi: '3.0.1', info: { title: 'Named', version: '1' }, paths: {}, components: { schemas: { Errand: { type: 'object', properties: { id: { type: 'string' }, assignee: { type: 'string' }, status: { type: 'string' } } } } } }) });
    expect(named.drafts[0].proposals.map(item => [item.trait.name, item.grade])).toEqual([['Stateful', 'weak']]);
  });

  it("takes the record's lifecycle from its work's states, ahead of another enum that sorts first", () => {
    expect(proposal('openapi-work', 'AgentJob', 'Stateful')).toMatchObject({ grade: 'medium', valid: true, trait: { fieldBindings: { status: 'state' }, parameters: { initialState: 'pending' } } });
    expect(draft('openapi-work').report.some(entry => entry.object === 'AgentJob' && entry.reason === 'Alternative Stateful configuration (kind) retained as evidence; the record keeps the state of its work, so its lifecycle is state.')).toBe(true);
  });
});

describe('the two wrong guesses, stopped only where the rule fires', () => {
  it('binds the reference to its own kind as the task it came from, and proposes no category tree', () => {
    for (const [key, object, field] of [['sql-work', 'Jobs', 'parent_id'], ['prisma-work', 'Job', 'parentId']]) {
      expect(bound(proposal(key, object, 'Assignment')).parent_id, object).toBe(field);
      expect(proposal(key, object, 'Classifiable'), object).toBeUndefined();
    }
  });

  it('binds the one doing the work to the doing seat, and proposes no owner with nothing bound', () => {
    expect(bound(proposal('prisma-work', 'Job', 'Assignment')).asked_of_id).toBe('assigneeId');
    expect(proposal('prisma-work', 'Job', 'Ownerable')).toBeUndefined();
    // The jobs table's owner is still its owner: only the references the rule bound are not guessed again.
    const owner = proposal('sql-work', 'Jobs', 'Ownerable')!;
    expect(bound(proposal('sql-work', 'Jobs', 'Assignment'))).toMatchObject({ asked_of_id: 'assignee_id', requested_by_id: 'created_by' });
    expect(owner).toMatchObject({ grade: 'medium', valid: true });
    expect(owner.evidence.map(item => item.pointer)).toEqual(['/statements/2/columns/4']);
    expect(bound(owner)).toEqual({ owner_id: 'owner_id' });
  });

  it('keeps every proposal as 0.13.1 drafted it where the rule does not fire', () => {
    for (const key of Object.keys(FIXTURES.sources)) for (const item of draft(key).drafts) {
      if (FIRES.some(([k, object]) => k === key && object === item.name)) continue;
      expect(ids(item.proposals), `${key}/${item.name}`).toEqual(ids(before(key, item.name)));
    }
    // The same tables without a value that means a person is needed keep both guesses, the assignee's among the owner's evidence.
    for (const [key, object, parent, assignee] of [['sql-not-work', 'Jobs', '/statements/2/columns/5', '/statements/2/columns/2'], ['prisma-not-work', 'Job', '/declarations/1/members/5', '/declarations/1/members/3']]) {
      expect(proposal(key, object, 'Classifiable')!.evidence.map(item => item.pointer), object).toEqual([parent]);
      expect(proposal(key, object, 'Ownerable')!.evidence.map(item => item.pointer), object).toContain(assignee);
    }
    expect(bound(proposal('prisma-not-work', 'Job', 'Ownerable'))).toEqual({});
  });

  it('changes nothing else on a record where it fires', () => {
    // Every other proposal keeps 0.13.1's id: only Assignment is new, the claimed guesses go and the lifecycle may move.
    for (const [key, object] of FIRES) {
      const now = draftOf(key, object).proposals.filter(item => !['Assignment', 'Stateful', 'Classifiable', 'Ownerable'].includes(item.trait.name));
      const then = before(key, object).filter(item => !['Stateful', 'Classifiable', 'Ownerable'].includes(item.trait));
      expect(ids(now), `${key}/${object}`).toEqual(ids(then));
    }
  });
});

describe('the measured records, in miniature', () => {
  it("binds Linear's agent session: the app user doing it, the person who started it and the issue", () => {
    const session = proposal('linear-mini', 'AgentSession', 'Assignment')!;
    expect(session).toMatchObject({ grade: 'medium', valid: true });
    expect(bound(session)).toEqual({ asked_of_id: 'appUser', requested_by_id: 'creator', subject_id: 'issue' });
    expect(session.evidence[0].reason).toBe('appUser, a field named for the one doing the work, references User, a person or other principal: the one doing it (asked_of_id).');
    expect(session.evidence.find(item => item.reason.startsWith('issue'))?.reason).toBe('issue references Issue and is named for the thing the work is about (subject_id).');
  });

  it("gives Linear's issue, A2A's task and GitHub's agent task nothing: a ticket, and two records of work that name no one", () => {
    for (const [key, object] of [['linear-mini', 'Issue'], ['a2a-mini', 'Task'], ['a2a-mini', 'TaskStatus'], ['github-mini', 'Operationa4666d97c4']]) {
      expect(proposal(key, object, 'Assignment'), object).toBeUndefined();
      expect(ids(draftOf(key, object).proposals), object).toEqual(ids(before(key, object)));
    }
    // A2A's states arrive on its task, all eight; the task holds no reference to anyone, so the rule has no doer.
    expect(proposal('a2a-mini', 'Task', 'Stateful')!.trait.parameters?.states).toHaveLength(8);
    expect(draftOf('a2a-mini', 'Task').definition.relationships ?? []).toEqual([]);
  });
});

describe('acceptance', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's247-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
  afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
  const acceptAll = async (key: string) => {
    const staged = await importObjects({ action: 'draft', source: FIXTURES.sources[key] }) as any;
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; proposals: Proposal[] }>;
    const objects = drafts.map(item => ({ name: item.name, proposals: item.proposals.filter(p => p.valid && p.grade !== 'weak').map(p => p.id) }));
    return importObjects({ action: 'apply', importId: staged.importId, objects, overwrite: true, confirmShipped: objects.map(item => item.name) }) as Promise<any>;
  };

  it('accepts Assignment with fields unbound, rolls nothing back, and every screen of the accepted record composes', async () => {
    for (const key of ['sql-work', 'prisma-work', 'openapi-work', 'linear-mini']) {
      const applied = await acceptAll(key);
      for (const [k, object] of FIRES.filter(([k]) => k === key)) {
        expect(applied.applied.find((item: any) => item.name === object), `${k}/${object}`).toMatchObject({ name: object, contexts: expect.arrayContaining(['list', 'detail', 'form']) });
        for (const context of ['list', 'detail', 'form']) expect((await compose({ object, context, options: { transient: true } })).status, `${object}/${context}`).toBe('ok');
      }
    }
  });
});
