/**
 * s249-m03: ending a grant. Taking a grant back ends the yes, not the work. These specs pin:
 * - Mandate 1.1.0's new seats: who a requested grant waits on (asked_of_id, asked_of_name, asked_of_kind) and the capacity
 *   a grant was ended in (ended_as), which only the product writes; Decision's asked_of_id and asked_of_name share the
 *   names and the meaning, and an object that composes both still composes;
 * - Grant's declared order lets a request lapse unanswered (requested to expired);
 * - a requested grant waiting on a person is in that person's waiting list, a standing yes asked for inside a grant
 *   among them, after the asks that hold a due date.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveRelatedListRows } from '@oods/component-contracts';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { handle as validate } from '../../src/tools/object.validate.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { relatedAppData, resolveRelatedLists } from '../../src/compose/related-records.js';

type Sample = Record<string, any>;
const samplesOf = (object: string) => (loadObject(object).samples ?? []) as Sample[];

describe('Mandate 1.1.0: who a request waits on, and the capacity a grant was ended in', () => {
  it('adds four read-only seats the product writes, placed only where a record holds them', () => {
    const mandate = loadTrait('core/Mandate');
    expect(mandate.trait.version).toBe('1.1.4');
    for (const field of ['asked_of_id', 'asked_of_name', 'asked_of_kind', 'ended_as']) {
      expect(mandate.schema[field], field).toMatchObject({ type: 'string', required: false, readOnly: true });
    }
    expect(mandate.schema.asked_of_kind!.validation?.enum).toEqual(['person', 'agent', 'system']);
    expect(mandate.schema.ended_as!.description).toContain('where it is not one of the grant\'s own seats');
  });

  it('keeps who the standing yes was asked of, and it is who gave it; no sample ends a grant from outside its seats', () => {
    const users = samplesOf('User');
    for (const grant of samplesOf('Grant')) {
      expect(grant.ended_as, String(grant.name)).toBeUndefined();
      if (grant.asked_of_id === undefined) continue;
      // The one asked is a shipped person, by id and name, and a given grant was given by the one it was asked of.
      expect(users.some(user => user.user_id === grant.asked_of_id && user.name === grant.asked_of_name), String(grant.name)).toBe(true);
      expect(grant.asked_of_kind).toBe('person');
      expect([grant.granted_by_id, grant.granted_by_name]).toEqual([grant.asked_of_id, grant.asked_of_name]);
    }
    expect(samplesOf('Grant').filter(grant => grant.asked_of_id !== undefined).map(grant => grant.name)).toEqual(['Resend returned transfers']);
  });

  it('shares asked_of_id and asked_of_name with Decision, and an object that composes both composes', async () => {
    const decision = loadTrait('core/Decision');
    expect(Object.keys(decision.schema)).toEqual(expect.arrayContaining(['asked_of_id', 'asked_of_name']));
    const yaml = [
      'object: { name: AskedTwice, version: 1.0.0, domain: test, description: A test record that composes a decision and a grant. }',
      'schema:',
      '  asked_twice_id: { type: uuid, required: true, description: Primary identifier. }',
      '  name: { type: string, required: true, description: Name. }',
      'traits:',
      '  - name: core/Decision',
      '    parameters: { levels: [approval] }',
      '  - name: core/Mandate',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [requested, active, revoked], initialState: requested }',
      'samples:',
      '  - { asked_twice_id: 0b7e2c1a-0000-4000-8000-0000000000c1, name: Shared seat, asked_of_id: user-1, asked_of_name: Ruth Adeyemi, status: requested }',
    ].join('\n');
    const checked = await validate({ yaml });
    expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
  });
});

describe('a grant request can lapse, and waits on a named person', () => {
  it('Grant\'s order lets a request expire unanswered, and every ending stays final', () => {
    const order = loadObject('Grant').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters!.transitionRules as Record<string, string[]>;
    expect(order.requested).toEqual(['active', 'declined', 'withdrawn', 'expired']);
    for (const ending of ['revoked', 'expired', 'replaced', 'declined', 'withdrawn']) expect(order[ending], ending).toEqual([]);
  });

  it('a standing yes asked for inside an active grant, waiting on a person, is in that person\'s waiting list, after the asks with a due date', () => {
    const data = relatedAppData('User')!;
    const waiting = data.lists.find(list => list.id === 'waiting')!;
    const ruth = samplesOf('User').find(user => user.name === 'Ruth Adeyemi')!;
    const tidewater = samplesOf('Grant')[0]!;
    // A fixture: the Billing Agent asks Ruth Adeyemi for a standing yes inside the Tidewater grant; no one has answered.
    const asked = {
      grant_id: '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3cf1', name: 'Refund duplicate charges', scope: 'Refund a duplicate charge', status: 'requested',
      requested_by_id: tidewater.granted_to_id, requested_by_name: 'Billing Agent', requested_by_kind: 'agent',
      asked_of_id: ruth.user_id, asked_of_name: 'Ruth Adeyemi', asked_of_kind: 'person',
      granted_to_id: tidewater.granted_to_id, granted_to_name: 'Billing Agent', granted_to_kind: 'agent', granted_for_id: tidewater.granted_for_id, granted_for_name: 'Tidewater Co-op',
      within_id: tidewater.grant_id, within_name: tidewater.name, created_at: '2026-09-30T08:00:00Z',
      state_history: [{ title: 'Requested', from: null, to: 'requested', at: '2026-09-30T08:00:00Z', reason: 'Asked to refund duplicate charges without asking each time' }],
    };
    const objects = { ...data.objects, Grant: { ...data.objects.Grant!, records: [...(data.objects.Grant!.records ?? []), asked] } };
    // A dated ask waiting on Ruth, so the order shows: the asks with a due date first, then the requests, oldest first.
    const approvals = data.objects.Approval!;
    const dated = { ...approvals.records![0]!, approval_id: '7b3d5f9a-1c2e-4a6b-8d0f-2e4a6c8e0af1', name: 'Approve a refund of PAY-2026-0429', status: 'waiting', asked_of_id: ruth.user_id, due_at: '2026-10-01T09:00:00Z' };
    const withDated = { ...objects, Approval: { ...approvals, records: [...approvals.records!, dated] } };
    const list = resolveRelatedListRows(waiting, data.own, ruth, withDated);
    expect(list.rows.map(row => [row.object, row.title, row.state])).toEqual([['Approval', 'Approve a refund of PAY-2026-0429', 'waiting'], ['Grant', 'Refund duplicate charges', 'requested']]);
    expect(list.rows[1]!.lineText).toBe('Billing Agent · Refund a duplicate charge');
    expect(list.heading).toBe('Waiting for Ruth Adeyemi\'s answer (2)');
    // Asked of an agent, or by kind not a person, it is not on a person's page.
    const ofAgent = { ...asked, asked_of_kind: 'agent' };
    const none = resolveRelatedListRows(waiting, data.own, ruth, { ...data.objects, Grant: { ...data.objects.Grant!, records: [...(data.objects.Grant!.records ?? []), ofAgent] } });
    expect(none.rows).toEqual([]);
  });
});

describe('a team\'s Grant that keeps no asked_of seat still composes the shipped pages', () => {
  let home: string;
  beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s249-ending-')); process.env.OODS_OBJECTS_DIR = path.join(home, 'objects'); process.env.MCP_SCHEMA_STORE_ROOT = home; clearTraitCache(); clearObjectCache(); });
  afterEach(() => { delete process.env.OODS_OBJECTS_DIR; delete process.env.MCP_SCHEMA_STORE_ROOT; clearTraitCache(); clearObjectCache(); fs.rmSync(home, { recursive: true, force: true }); });

  it('the shipped User page still composes, and its waiting list reads the asks it can', async () => {
    fs.mkdirSync(path.join(home, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(home, 'objects', 'Grant.object.yaml'), [
      'object: { name: Grant, version: 1.0.0, domain: team.access, description: A team\'s own grant record. }',
      'traits:',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [requested, active, revoked], initialState: requested }',
      'schema:',
      '  grant_id: { type: uuid, required: true, description: Primary identifier. }',
      '  name: { type: string, required: true, description: Grant name }',
    ].join('\n'));
    clearObjectCache();
    expect(composeObject(loadObject('Grant')).schema.asked_of_id).toBeUndefined();
    const composed = await compose({ object: 'User', context: 'detail', options: { transient: true } } as never) as { status: string; warnings?: Array<{ code: string; message: string }> };
    expect(composed.status).toBe('ok');
    const warnings = (composed.warnings ?? []).filter(warning => warning.code === 'OODS-V119').map(warning => warning.message).join('\n');
    expect(warnings).toMatch(/User's list "waiting" leaves out Grant: .*"asked_of_id" is not a field of Grant/);
  });
});

describe('Stateful 2.5.0\'s actions: a lifecycle declares the moves a person makes, within its order', () => {
  it('Grant declares Revoke, Pause and Resume, each offered only from the states its move leaves', async () => {
    const { declaredActions } = await import('../../src/objects/state-actions.js');
    expect(declaredActions(loadObject('Grant')).map(action => [action.id, action.verb, action.from, action.to, action.event, action.confirm])).toEqual([
      ['revoke', 'Revoke', ['active', 'paused'], 'revoked', 'ended', true],
      ['pause', 'Pause', ['active'], 'paused', 'paused', false],
      ['resume', 'Resume', ['paused'], 'active', 'resumed', false],
    ]);
    expect(declaredActions(loadObject('Grant'))[0]).toMatchObject({ reasonField: 'ended_reason', bySeat: 'ended_by', alsoEnds: { via: 'within_id' } });
    for (const object of ['Approval', 'Task', 'Subscription', 'User']) expect(declaredActions(loadObject(object)), object).toEqual([]);
    const checked = await validate({ yaml: fs.readFileSync(path.join(process.cwd(), '../../objects/core/Grant.object.yaml'), 'utf8') });
    expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
  });

  const object = (actions: unknown, rules: unknown = '{ open: [held, closed], held: [open, closed], closed: [] }') => [
    'object: { name: Hold, version: 1.0.0, domain: test, description: A test record with a hold and a close. }',
    'schema:',
    '  hold_id: { type: uuid, required: true, description: Primary identifier. }',
    '  name: { type: string, required: true, description: Name. }',
    '  closed_note: { type: string, required: false, description: Why it closed. }',
    '  closed_by_id: { type: string, required: false, description: Who closed it. }',
    '  closed_by_name: { type: string, required: false, description: Who closed it, as shown. }',
    '  closed_by_kind: { type: string, required: false, description: What kind of actor closed it. }',
    'traits:',
    `  - name: lifecycle/Stateful`,
    `    parameters: { states: [open, held, closed], initialState: open${rules ? `, transitionRules: ${String(rules)}` : ''}, actions: ${JSON.stringify(actions)} }`,
    '  - name: lifecycle/Timestampable',
    '    parameters: { recordedEvents: [created, held, closed, updated] }',
  ].join('\n');
  const close = { id: 'close', to: 'closed', verb: 'Close', event: 'closed', reasonField: 'closed_note', bySeat: 'closed_by', confirm: true };

  it('accepts a well-formed action, its from worked out from the order', async () => {
    const checked = await validate({ yaml: object([close, { id: 'hold', to: 'held', verb: 'Hold', event: 'held' }]) });
    expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
  });

  it.each([
    // s250-m04 (next step 1887, item 6): a trait parameter's path reads one way, with dots and brackets.
    ['a state the lifecycle lacks', [{ ...close, to: 'archived' }], undefined, 'traits[0].parameters.actions[0].to', /"archived" is not one of the lifecycle's states/],
    ['a move the order does not allow', [{ ...close, id: 'reopen', to: 'open', from: ['closed'] }], undefined, 'traits[0].parameters.actions[0].from[0]', /does not move "closed" to "open"; add "open" to transitionRules\.closed, or take "closed" out of from/],
    ['an action no state moves to', [{ id: 'restart', to: 'open', verb: 'Restart', event: 'created' }], '{ open: [held, closed], held: [closed], closed: [] }', 'traits[0].parameters.actions[0].to', /offered from none; add "open" to the transitionRules of the states it should move from/],
    ['two actions with one id', [close, { ...close, verb: 'Shut' }], undefined, 'traits[0].parameters.actions[1].id', /names another action too/],
    ['no declared order', [close], '', 'traits[0].parameters.actions', /needs transitionRules/],
    ['no verb', [{ id: 'close', to: 'closed', event: 'closed' }], undefined, 'traits[0].parameters.actions[0]', /verb/],
    ['an event Timestampable does not record', [{ ...close, event: 'ended' }], undefined, 'traits[0].parameters.actions[0].event', /"ended" is not one of Timestampable's recordedEvents/],
    ['a note field the object lacks', [{ ...close, reasonField: 'why' }], undefined, 'traits[0].parameters.actions[0].reasonField', /"why" is not a field/],
    ['a seat whose fields the object lacks', [{ ...close, bySeat: 'ended_by' }], undefined, 'traits[0].parameters.actions[0].bySeat', /"ended_by_id" is not a field/],
    ['records that end with it through a missing field', [{ ...close, alsoEnds: { via: 'parent_id' } }], undefined, 'traits[0].parameters.actions[0].alsoEnds.via', /"parent_id" is not a field/],
  ])('refuses %s, naming the path', async (_name, actions, rules, where, says) => {
    const checked = await validate({ yaml: object(actions, rules) });
    expect(checked.valid).toBe(false);
    const problem = checked.errors.find(error => error.path === where);
    expect(problem, JSON.stringify(checked.errors)).toBeDefined();
    expect(problem!.message).toMatch(says);
  });
});

describe('a person\'s page says where a grant is ended, under the rows of its standing grants (Interface 4)', () => {
  it('says "This list does not change grants: revoke one on the grant\'s own page." under a list of standing grants that lists some, and never under an empty one', () => {
    const notes = (name: string) => Object.fromEntries(resolveRelatedLists('User', samplesOf('User').find(sample => sample.name === name)!)
      .filter(list => ['acting-for', 'gave'].includes(list.id)).map(list => [list.id, { rows: list.rows.length, note: list.note ?? null }]));
    // Ruth Adeyemi gave the Tidewater grant; no agent holds a grant for her.
    expect(notes('Ruth Adeyemi')).toEqual({ 'acting-for': { rows: 0, note: null }, gave: { rows: 1, note: 'This list does not change grants: revoke one on the grant\'s own page.' } });
    // Dana Whitfield's grants have all ended, so neither list has a row, or the sentence.
    expect(notes('Dana Whitfield')).toEqual({ 'acting-for': { rows: 0, note: null }, gave: { rows: 0, note: null } });
  });
});
