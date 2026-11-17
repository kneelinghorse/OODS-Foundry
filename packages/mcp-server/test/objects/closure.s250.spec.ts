/**
 * s250-m02: Closure, the sixteenth public object and the third part of the Grant story (Interfaces 3, 7 and 8). A closure
 * is what a product reports became of the work after a grant that was given has ended; only a report moves it, and it
 * reads as closed only where a report says so. These specs hold its three samples to the Grant samples they close, by
 * eight rules, each with a bite that removes its fact:
 * 1. every closure names one Grant sample by id and kept name, and no two name the same one;
 * 2. that grant was given (its history holds a line into active) and rests in revoked, expired or replaced, and every
 *    Grant sample of which that is true has a closure;
 * 3. how and when it ended, who it was for and who answers for it are the grant's;
 * 4. the history starts at closing, at or after the grant's end, follows the declared order and ends at the record's
 *    state; a line after the first may keep the state, from null to the state the line before it left;
 * 5. every line names its reporter, with a kind;
 * 6. a reported-closed closure names, in a line, every record its grant's page lists as still under way at its end;
 * 7. its deadline, its window and its receipt, where set, are not before the grant's end;
 * 8. at least one sample is not reported closed.
 * And no line carries the id of a shipped record in actor_id or on_behalf_of_id: a closure's reporters are systems named
 * in words, and the pages that list records by those keys do not read Closure.
 */
import { describe, expect, it } from 'vitest';
import { relatedStateLabel } from '@oods/component-contracts';
import { loadObject, listObjects } from '../../src/objects/object-loader.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import { recordKeyField } from '../../src/objects/record-identity.js';

type Sample = Record<string, any>;
type Line = { title?: string; from: string | null; to: string; at: string; reason?: string; actor_id?: string; actor_name?: string; actor_kind?: string; on_behalf_of_id?: string };
const ENDINGS = ['revoked', 'expired', 'replaced'];
const ORDER = (loadObject('Closure').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as { transitionRules: Record<string, string[]> }).transitionRules;
const grants = () => (loadObject('Grant').samples ?? []) as Sample[];
const given = (grant: Sample) => (grant.state_history as Line[]).some(line => line.to === 'active');
const endOf = (grant: Sample) => (grant.state_history as Line[]).find(line => line.to === grant.status)!.at;

/** The eight rules, as one list of what breaks; an empty list is samples that hold. */
function broken(closures: Sample[], shipped: Sample[] = grants()): string[] {
  const out: string[] = [];
  const byId = new Map(shipped.map(grant => [grant.grant_id, grant]));
  const named = new Set<string>();
  for (const closure of closures) {
    const at = String(closure.name);
    const grant = byId.get(closure.closes_id);
    // 1
    if (!grant) { out.push(`1: ${at} names no Grant sample`); continue; }
    if (closure.closes_name !== grant.name) out.push(`1: ${at} keeps the name ${closure.closes_name}, not ${grant.name}`);
    if (named.has(closure.closes_id)) out.push(`1: ${at} names a grant another closure names`);
    named.add(closure.closes_id);
    // 2
    if (!given(grant) || !ENDINGS.includes(grant.status)) out.push(`2: ${at} closes a grant that was not given and then ended`);
    // 3
    const ended = endOf(grant);
    if (closure.ended_how !== relatedStateLabel(grant.status)) out.push(`3: ${at} ended_how ${closure.ended_how} is not ${relatedStateLabel(grant.status)}`);
    if (closure.ended_at !== ended) out.push(`3: ${at} ended_at ${closure.ended_at} is not the grant's end ${ended}`);
    if (closure.for_id !== grant.granted_for_id || closure.for_name !== grant.granted_for_name) out.push(`3: ${at} is not for the grant's party`);
    if (closure.owner_id !== grant.owner_id || closure.owner_type !== grant.owner_type || closure.owner_name !== grant.owner_name) out.push(`3: ${at} is not answered for by the grant's owner`);
    // 4
    const history = (closure.state_history ?? []) as Line[];
    if (!history.length || history[0]!.from !== null || history[0]!.to !== 'closing') out.push(`4: ${at} does not open closing`);
    else if (Date.parse(history[0]!.at) < Date.parse(ended)) out.push(`4: ${at} opens before the grant ended`);
    history.forEach((line, index) => {
      if (index === 0) return;
      const before = history[index - 1]!;
      if (Date.parse(line.at) < Date.parse(before.at)) out.push(`4: ${at} line ${index + 1} goes back in time`);
      if (line.from === null) { if (line.to !== before.to) out.push(`4: ${at} line ${index + 1} keeps a state the line before did not leave`); return; }
      if (line.from !== before.to) out.push(`4: ${at} line ${index + 1} does not follow from ${before.to}`);
      if (!(ORDER[line.from] ?? []).includes(line.to)) out.push(`4: ${at} line ${index + 1} moves ${line.from} to ${line.to}, which the order does not allow`);
    });
    if (history.at(-1)?.to !== closure.status) out.push(`4: ${at} history ends at ${history.at(-1)?.to}, not ${closure.status}`);
    // 5
    for (const [index, line] of history.entries()) if (!line.actor_name || !['person', 'agent', 'system'].includes(String(line.actor_kind))) out.push(`5: ${at} line ${index + 1} names no reporter with a kind`);
    // 6
    if (closure.status === 'reported_closed') {
      const [underWay] = resolveRelatedLists('Grant', grant).filter(list => list.id === 'under-way');
      for (const row of underWay?.rows ?? []) if (!history.some(line => `${line.title ?? ''} ${line.reason ?? ''}`.includes(row.title))) out.push(`6: ${at} is reported closed and no line names ${row.title}, under way at its end`);
    }
    // 7
    for (const field of ['deadline_at', 'still_works_until', 'receipt_sent_at']) if (closure[field] && Date.parse(closure[field]) < Date.parse(ended)) out.push(`7: ${at} ${field} is before the grant ended`);
  }
  // 2, the other way: every given, ended grant has its closure.
  for (const grant of shipped) if (given(grant) && ENDINGS.includes(grant.status) && !named.has(grant.grant_id)) out.push(`2: ${grant.name} was given and ended, and no closure names it`);
  // 8
  if (closures.length && closures.every(closure => closure.status === 'reported_closed')) out.push('8: every closure is reported closed');
  return out;
}

const shipped = () => structuredClone(loadObject('Closure').samples ?? []) as Sample[];
const find = (samples: Sample[], name: string) => samples.find(sample => sample.closes_name === name)!;

describe('the three closures are held to the grants they close', () => {
  it('ships one closure per grant given and then ended, in the order they ended, and every rule holds', () => {
    const closures = shipped();
    expect(closures.map(closure => [closure.closes_name, closure.status])).toEqual([
      ['Northwind spring order replies', 'reported_closed'],
      ['Marlow Yoga class bookings', 'not_known'],
      ['Northwind customer replies', 'still_running'],
    ]);
    expect(broken(closures)).toEqual([]);
  });

  it.each([
    ['1, a grant no sample is', (s: Sample[]) => { find(s, 'Marlow Yoga class bookings').closes_id = 'grt_elsewhere'; }, /^1: .* names no Grant sample/],
    ['1, two closures of one grant', (s: Sample[]) => { const [first, second] = s; second!.closes_id = first!.closes_id; second!.closes_name = first!.closes_name; }, /^1: .* names a grant another closure names/],
    ['2, a grant that stands', (s: Sample[]) => { const c = find(s, 'Marlow Yoga class bookings'); c.closes_id = '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c01'; c.closes_name = 'Tidewater invoices and payments'; }, /^2: .* closes a grant that was not given and then ended/],
    ['2, a given and ended grant with no closure', (s: Sample[]) => { s.splice(0, 1); }, /^2: Northwind spring order replies was given and ended, and no closure names it/],
    ['3, how it ended', (s: Sample[]) => { find(s, 'Northwind spring order replies').ended_how = 'Revoked'; }, /^3: .* ended_how Revoked is not Replaced/],
    ['3, when it ended', (s: Sample[]) => { find(s, 'Northwind customer replies').ended_at = '2026-10-08T15:00:00Z'; }, /^3: .* ended_at .* is not the grant's end/],
    ['3, who it was for', (s: Sample[]) => { find(s, 'Marlow Yoga class bookings').for_name = 'Marlow Studio'; }, /^3: .* is not for the grant's party/],
    ['3, who answers for it', (s: Sample[]) => { find(s, 'Northwind customer replies').owner_name = 'Support team'; }, /^3: .* is not answered for by the grant's owner/],
    ['4, opening before the end', (s: Sample[]) => { find(s, 'Northwind customer replies').state_history[0].at = '2026-10-08T15:59:00Z'; }, /^4: .* opens before the grant ended/],
    ['4, a move the order refuses', (s: Sample[]) => { const c = find(s, 'Northwind spring order replies'); c.state_history.push({ title: 'Running again', from: 'reported_closed', to: 'still_running', at: '2026-03-10T09:00:00Z', reason: 'A reply started', actor_name: 'Northwind support desk', actor_kind: 'system' }); c.status = 'still_running'; }, /^4: .* moves reported_closed to still_running, which the order does not allow/],
    ['4, a kept line in another state', (s: Sample[]) => { find(s, 'Northwind customer replies').state_history[2].to = 'closing'; }, /^4: .* keeps a state the line before did not leave/],
    ['5, a line with no reporter', (s: Sample[]) => { delete find(s, 'Marlow Yoga class bookings').state_history[1].actor_name; }, /^5: .* names no reporter with a kind/],
    ['7, a receipt before the end', (s: Sample[]) => { find(s, 'Northwind customer replies').receipt_sent_at = '2026-10-08T15:00:00Z'; }, /^7: .* receipt_sent_at is before the grant ended/],
    ['8, every closure reported closed', (s: Sample[]) => { for (const c of s) { c.status = 'reported_closed'; } }, /^8: every closure is reported closed/],
  ])('the rule breaks without its fact: %s', (_name, mutate, says) => {
    const closures = shipped();
    mutate(closures);
    expect(broken(closures).some(problem => says.test(problem)), broken(closures).join('\n')).toBe(true);
  });

  it('6: a reported-closed closure names every record its grant lists as still under way at its end (a fixture: no shipped one has one)', () => {
    // A fixture: the customer replies closure, reported closed with no line naming the task still under way at the end.
    const closures = shipped();
    const replies = find(closures, 'Northwind customer replies');
    replies.state_history = [
      { title: 'Opened', from: null, to: 'closing', at: '2026-10-08T16:00:00Z', reason: 'Opened when the grant was revoked', actor_name: 'Northwind support desk', actor_kind: 'system' },
      { title: 'Reported closed', from: 'closing', to: 'reported_closed', at: '2026-10-08T16:05:00Z', reason: 'Nothing more can start under it', actor_name: 'Northwind support desk', actor_kind: 'system' },
    ];
    replies.status = 'reported_closed';
    expect(broken(closures)).toContain('6: Closure of Northwind customer replies is reported closed and no line names Reply about order NW-2207, under way at its end');
    replies.state_history.splice(1, 0, { title: 'Reply about order NW-2207 handed back', from: null, to: 'closing', at: '2026-10-08T16:03:00Z', reason: 'The support team answers it now', actor_name: 'Northwind support desk', actor_kind: 'system' });
    expect(broken(closures).filter(problem => problem.startsWith('6:'))).toEqual([]);
  });

  it('carries no id of a shipped record on any line, so the lists that read actor_id and on_behalf_of_id stay true', () => {
    const ids = new Set(listObjects().flatMap(name => {
      const definition = loadObject(name);
      const key = recordKeyField(definition);
      return key ? (definition.samples ?? []).map(sample => String((sample as Sample)[key])) : [];
    }));
    for (const closure of shipped()) for (const line of closure.state_history as Line[]) {
      for (const field of ['actor_id', 'on_behalf_of_id', 'approved_by_id', 'approval_id', 'grant_id', 'task_id'] as const) {
        expect(line[field as keyof Line] === undefined || !ids.has(String(line[field as keyof Line])), `${closure.name}: ${field}`).toBe(true);
      }
    }
  });

  it('states one window as an instant and one in words as not known, so a page draws each', () => {
    const closures = shipped();
    expect(closures.filter(closure => closure.still_works_until).map(closure => closure.closes_name)).toEqual(['Northwind customer replies']);
    expect(closures.filter(closure => /^Not known/.test(String(closure.still_works_note ?? ''))).map(closure => closure.closes_name)).toEqual(['Marlow Yoga class bookings']);
  });
});
