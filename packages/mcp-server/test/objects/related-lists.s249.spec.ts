/**
 * s249-m01: lists declared on the page that shows them. An object declares, in metadata.relatedLists, lists of the
 * records that point at one of its records (objects/related-lists.ts), and the resolver returns their rows from the
 * registered objects' samples (compose/related-records.ts). These specs pin the declaration's checks:
 * - the lists User, Organization, Agent and Grant declare validate, as a team's own copy of those files would;
 * - each malformed declaration is refused before anything is written, naming its path: an unknown source, a missing
 *   field, a history key that is not one of the six, a state that is not in the source's lifecycle, and the rest;
 * - a team's own object that replaces a source and lacks a field or a state the shipped lists name gives the shipped
 *   subject a warning and an empty list for that source, never a refusal: its pages still compose.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump, load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle as validate } from '../../src/tools/object.validate.js';
import { handle as register } from '../../src/tools/object.register.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { clearObjectCache, getObjectFilePath, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { HISTORY_KEYS } from '../../src/objects/related-lists.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';

let home: string;
const reload = () => { clearTraitCache(); clearObjectCache(); };
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s249-lists-'));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  reload();
});
afterEach(() => {
  delete process.env.OODS_OBJECTS_DIR;
  delete process.env.MCP_SCHEMA_STORE_ROOT;
  reload();
  fs.rmSync(home, { recursive: true, force: true });
});

/** A team's object with its own id, a lifecycle and one valid list of the shipped tasks asked for it. */
const branch = (lists: unknown) => ({
  object: { name: 'Branch', version: '1.0.0', domain: 'team.retail', description: 'A shop branch a team runs.' },
  traits: [{ name: 'lifecycle/Stateful', parameters: { states: ['open', 'closed'], initialState: 'open', transitionRules: { open: ['closed'], closed: [] } } }],
  schema: { branch_id: { type: 'uuid', required: true, description: 'Primary identifier for the branch.' }, name: { type: 'string', required: true, description: 'Branch name' } },
  samples: [{ branch_id: '0b7e2c1a-0000-4000-8000-000000000001', name: 'Harbour Street', status: 'open' }],
  metadata: { relatedLists: lists },
});
const tasksFor = { id: 'tasks', label: 'Tasks for {name}', empty: 'No task is asked for {name} by id.', sources: [{ from: 'Task', via: 'requested_for_id', row: { line: ['asked_of_name'], time: 'due_at' } }] };

describe('metadata.relatedLists validates as declared', () => {
  it.each(['User', 'Organization', 'Agent', 'Grant'])('%s\'s lists validate, as a team\'s own copy of its file would', async name => {
    const yaml = fs.readFileSync(getObjectFilePath(name)!, 'utf8');
    const lists = (load(yaml) as { metadata: { relatedLists: unknown[] } }).metadata.relatedLists;
    expect(lists.length).toBeGreaterThan(2);
    const result = await validate({ yaml });
    expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts a team\'s own list, which then resolves from the shipped samples it names, by id', async () => {
    const yaml = dump(branch([tasksFor]));
    expect((await validate({ yaml })).errors).toEqual([]);
    await register({ yaml });
    reload();
    const [list] = resolveRelatedLists('Branch', loadObject('Branch').samples![0]!);
    // No shipped task names the branch's id, so the list is empty and says which seat it read.
    expect(list).toMatchObject({ id: 'tasks', label: 'Tasks for Harbour Street', empty: 'No task is asked for Harbour Street by id.', rows: [], warnings: [] });
  });

  it.each([
    ['an unknown source', { ...tasksFor, sources: [{ from: 'Warehouse', via: 'branch_id' }] }, 'metadata.relatedLists[0].sources[0].from', /"Warehouse" is not a registered object/],
    ['one unknown object among its sources', { ...tasksFor, sources: [{ from: ['Task', 'Ticket'], via: 'requested_for_id' }] }, 'metadata.relatedLists[0].sources[0].from[1]', /"Ticket" is not a registered object/],
    ['a missing field', { ...tasksFor, sources: [{ from: 'Task', via: 'branch_id' }] }, 'metadata.relatedLists[0].sources[0].via', /"branch_id" is not a field of Task/],
    ['a history key that is not one of the six', { ...tasksFor, sources: [{ from: 'Task', via: 'state_history[].customer_id' }] }, 'metadata.relatedLists[0].sources[0].via', new RegExp(`"customer_id" in a history entry, which is not one of the entry keys Stateful documents \\(${HISTORY_KEYS.join(', ')}\\)`)],
    ['a history read on an object that keeps none', { ...tasksFor, sources: [{ from: 'Plan', via: 'state_history[].actor_id' }] }, 'metadata.relatedLists[0].sources[0].via', /Plan keeps none/],
    ['a state not in the lifecycle', { ...tasksFor, sources: [{ from: 'Grant', via: 'granted_for_id', states: ['active', 'archived'] }] }, 'metadata.relatedLists[0].sources[0].states[1]', /"archived" is not one of Grant's states/],
    ['a filter on a missing field', { ...tasksFor, sources: [{ from: 'Grant', via: 'granted_for_id', when: { holder_kind: 'agent' } }] }, 'metadata.relatedLists[0].sources[0].when.holder_kind', /"holder_kind" is not a field of Grant/],
    ['a caption without its time field', { ...tasksFor, sources: [{ from: 'Task', via: 'requested_for_id', row: { time: { field: 'missing', says: 'Due' } } }] }, 'metadata.relatedLists[0].sources[0].row.time.field', /"missing" is not a field of Task/],
    ['a time field without its caption', { ...tasksFor, sources: [{ from: 'Task', via: 'requested_for_id', row: { time: { field: 'due_at', says: '' } } }] }, 'metadata.relatedLists[0].sources[0].row.time.says', /must name the time shown/],
    ['a row line field the source lacks', { ...tasksFor, sources: [{ from: 'Task', via: 'requested_for_id', row: { line: ['owner_email'] } }] }, 'metadata.relatedLists[0].sources[0].row.line[0]', /"owner_email" is not a field of Task/],
    ['a key the subject lacks', { ...tasksFor, sources: [{ from: 'Task', via: 'requested_for_id', key: 'store_code' }] }, 'metadata.relatedLists[0].sources[0].key', /must name a field of Branch/],
    ['no label', { ...tasksFor, label: '' }, 'metadata.relatedLists[0].label', /the list's heading/],
    ['an id in other words', { ...tasksFor, id: 'Tasks For' }, 'metadata.relatedLists[0].id', /lower-case words joined by hyphens/],
    ['no sources', { ...tasksFor, sources: [] }, 'metadata.relatedLists[0].sources', /at least one source/],
    ['a key no list takes', { ...tasksFor, columns: ['name'] }, 'metadata.relatedLists[0].columns', /not a key a related list takes/],
    ['a finality that is not one of three', { ...tasksFor, finality: ['open'] }, 'metadata.relatedLists[0].finality', /final, not_final, not_known/],
    // s249-m05 (the fresh read): each message names the shape and the keys it wants, so an agent can write it.
    ['an entry that is not a map', 'tasks', 'metadata.relatedLists[0]', /must be a map with id, label and sources/],
    ['filtered without its words for any other count', { ...tasksFor, filtered: { one: '1 other task.' } }, 'metadata.relatedLists[0].filtered', /must be a map with one and other: .*\{count\}/],
    ['beside with no field', { ...tasksFor, beside: { one: 'One.', other: '{value}.' } }, 'metadata.relatedLists[0].beside', /must be a map with field \(a field of Branch\), one and other: .*\{value\}/],
    ['a row that is not a map', { ...tasksFor, sources: [{ from: 'Task', via: 'requested_for_id', row: 'asked_of_name' }] }, 'metadata.relatedLists[0].sources[0].row', /must be a map with line, time or both/],
  ])('refuses %s, naming its path, and writes nothing', async (_name, list, where, says) => {
    const yaml = dump(branch([list]));
    const result = await validate({ yaml });
    expect(result.valid).toBe(false);
    const problem = result.errors.find(error => error.path === where);
    expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
    expect(problem!.message).toMatch(says);
    await expect(register({ yaml })).rejects.toThrow();
    const folder = path.join(home, 'objects');
    expect(fs.existsSync(folder) ? fs.readdirSync(folder) : []).toEqual([]);
  });

  it('refuses two lists with one id, and a list that is not a list', async () => {
    const twice = await validate({ yaml: dump(branch([tasksFor, tasksFor])) });
    expect(twice.errors).toContainEqual(expect.objectContaining({ kind: 'malformed', path: 'metadata.relatedLists[1].id' }));
    const single = await validate({ yaml: dump(branch(tasksFor)) });
    expect(single.errors).toContainEqual(expect.objectContaining({ kind: 'malformed', path: 'metadata.relatedLists' }));
    expect(single.errors.find(error => error.path === 'metadata.relatedLists')!.message).toMatch(/must be a list of maps, each with id, label and sources/);
  });
});

describe('a team\'s own source that lacks what a shipped list names gives a warning and an empty list, never a refusal', () => {
  /** A team's own Grant, used in place of the shipped one everywhere once registered. */
  const teamGrant = (schema: Record<string, unknown>, states: string[]) => dump({
    object: { name: 'Grant', version: '1.0.0', domain: 'team.access', description: 'A team\'s own grant record.' },
    traits: [{ name: 'lifecycle/Stateful', parameters: { states, initialState: states[0], transitionRules: Object.fromEntries(states.map((state, index) => [state, states.slice(index + 1)])) } }],
    schema: { grant_id: { type: 'uuid', required: true, description: 'Primary identifier.' }, name: { type: 'string', required: true, description: 'Grant name' }, ...schema },
    samples: [{ grant_id: '0b7e2c1a-0000-4000-8000-0000000000a1', name: 'Front desk', ...('granted_for_id' in schema ? { granted_for_id: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a05' } : {}), granted_to_kind: 'agent', status: states[1] }],
  });
  const tidewater = () => loadObject('Organization').samples!.find(sample => sample.label === 'Tidewater Co-op')!;

  it('with no granted_for_id, the organization\'s grant lists are empty and say why, and its other lists stand', async () => {
    const yaml = teamGrant({ granted_to_kind: { type: 'string', required: false, description: 'Holder kind' } }, ['requested', 'active', 'paused', 'revoked']);
    const checked = await validate({ yaml });
    expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
    await register({ yaml });
    reload();
    const lists = Object.fromEntries(resolveRelatedLists('Organization', tidewater()).map(list => [list.id, list]));
    for (const id of ['waiting', 'acting-for', 'ended-grants']) {
      expect(lists[id]!.rows, id).toEqual([]);
      expect(lists[id]!.warnings.join('\n'), id).toMatch(/leaves out Grant: .*"granted_for_id" is not a field of Grant/);
    }
    // "Done for" reads four objects. The team's Grant keeps a history too, and no line of its names Tidewater Co-op, so
    // the rows are the shipped task, approval and payment.
    expect(lists['done-for']!.rows.map(row => row.object)).toEqual(['Task', 'Approval', 'Transaction']);
    expect(lists.tasks!.rows.map(row => row.title)).toEqual(['Get INV-2026-0155 paid']);
    expect(lists.payments!.rows.map(row => row.title)).toEqual(['PAY-2026-0429']);
    for (const subject of ['Organization', 'User', 'Agent']) {
      const composed = await compose({ object: subject, context: 'detail', options: { transient: true } } as never) as { status: string };
      expect(composed.status, subject).toBe('ok');
    }
  });

  it('with no lifecycle at all, a list that reads four objects\' histories leaves out only the team\'s Grant', async () => {
    const yaml = dump({
      object: { name: 'Grant', version: '1.0.0', domain: 'team.access', description: 'A team\'s own grant record, with no lifecycle.' },
      schema: { grant_id: { type: 'uuid', required: true, description: 'Primary identifier.' }, name: { type: 'string', required: true, description: 'Grant name' } },
      samples: [{ grant_id: '0b7e2c1a-0000-4000-8000-0000000000a2', name: 'Front desk' }],
    });
    await register({ yaml });
    reload();
    const lists = Object.fromEntries(resolveRelatedLists('Organization', tidewater()).map(list => [list.id, list]));
    expect(lists['done-for']!.warnings.join('\n')).toMatch(/leaves out Grant: .*Grant keeps none/);
    expect(lists['done-for']!.rows.map(row => row.object)).toEqual(['Task', 'Approval', 'Transaction']);
    expect(lists['acting-for']!.warnings.join('\n')).toMatch(/Grant declares no lifecycle states/);
  });

  it('with no paused in its lifecycle, the lists that name paused are empty and say so', async () => {
    const yaml = teamGrant({ granted_for_id: { type: 'string', required: false, description: 'Party' }, granted_to_kind: { type: 'string', required: false, description: 'Holder kind' } }, ['requested', 'active', 'revoked']);
    await register({ yaml });
    reload();
    const lists = Object.fromEntries(resolveRelatedLists('Organization', tidewater()).map(list => [list.id, list]));
    expect(lists['acting-for']!.rows).toEqual([]);
    expect(lists['acting-for']!.warnings.join('\n')).toMatch(/states\[1\] "paused" is not one of Grant's states/);
    // The waiting list names no paused state; its warnings are only for the fields this team's Grant does not hold.
    expect(lists.waiting!.warnings.join('\n')).not.toMatch(/states/);
    expect(lists.waiting!.warnings.join('\n')).toMatch(/"requested_by_name" is not a field of Grant/);
    const user = loadObject('User').samples!.find(sample => sample.name === 'Ruth Adeyemi')!;
    expect(resolveRelatedLists('User', user).find(list => list.id === 'gave')!.warnings.join('\n')).toMatch(/leaves out Grant/);
  });
});
