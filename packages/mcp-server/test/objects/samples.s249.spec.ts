/**
 * s249-m01: the samples the related lists read are set right (Interface 15). A list matches by id only, so a party kept
 * under two ids would be split in two, and a worked example must obey its own rule (learning #920):
 * - every party a sample names by id and name, in any seat or history line, keeps one id (a usage meter is no object,
 *   so a meter that shares a service's name is not a party);
 * - every person who changes an Agent sample acts while their own record says they are active (next step 1876: two
 *   lines acted at the instant their actor's own account closed);
 * - the reason the Tidewater grant and the Billing Agent give for their start says what their dates say (next step 1880).
 */
import { describe, expect, it } from 'vitest';
import { loadObject } from '../../src/objects/object-loader.js';

type Sample = Record<string, any>;
// s250-m02: Closure, the sixteenth public object, joins both.
// s255-m03: Memory, the seventeenth public object, joins both.
const PUBLIC = ['User', 'Organization', 'Product', 'Subscription', 'Transaction', 'Relationship', 'Article', 'Media', 'Invoice', 'Plan', 'Usage', 'Agent', 'Approval', 'Task', 'Grant', 'Closure', 'Memory'];
const OWN: Record<string, [string, string]> = { User: ['user_id', 'name'], Organization: ['organization_id', 'label'], Agent: ['agent_id', 'name'], Grant: ['grant_id', 'name'], Task: ['task_id', 'name'], Approval: ['approval_id', 'name'], Closure: ['closure_id', 'name'], Memory: ['memory_id', 'name'] };
/** A usage meter is no object (R4 1.1): its id names a meter, never a party. */
const NOT_A_PARTY = new Set(['Usage.meter_id']);
const samplesOf = (name: string) => (loadObject(name).samples ?? []) as Sample[];

/** Each name a sample gives beside an id, with the ids it is given: `<seat>_id` beside `<seat>_name`, at the top or on a line. */
function partyIds(samples: (name: string) => Sample[]): Map<string, Set<string>> {
  const ids = new Map<string, Set<string>>();
  const add = (name: unknown, id: unknown) => { if (typeof name === 'string' && id !== undefined && id !== null) ids.set(name, (ids.get(name) ?? new Set()).add(String(id))); };
  const pairs = (object: string, row: Sample) => { for (const [field, value] of Object.entries(row)) { const seat = /^(.*)_id$/.exec(field)?.[1]; if (seat && !NOT_A_PARTY.has(`${object}.${field}`)) add(row[`${seat}_name`], value); } };
  for (const object of PUBLIC) for (const sample of samples(object)) {
    if (OWN[object]) add(sample[OWN[object]![1]], sample[OWN[object]![0]]);
    pairs(object, sample);
    for (const entry of sample.state_history ?? []) pairs(object, entry);
  }
  return ids;
}
const split = (ids: Map<string, Set<string>>) => [...ids].filter(([, set]) => set.size > 1).map(([name, set]) => `${name}: ${[...set].join(', ')}`);

/** Whether the record's own history says it is active at the instant: a move at that instant already applies. */
const active = (record: Sample, at: number) => {
  let state: unknown;
  for (const entry of record.state_history ?? []) { if (Date.parse(entry.at) > at) break; state = entry.to; }
  return state === 'active';
};
const users = samplesOf('User');
const agentLineProblems = (agents: Sample[]) => agents.flatMap(agent => (agent.state_history ?? []).filter((entry: Sample) => entry.actor_kind === 'person').flatMap((entry: Sample) => {
  const person = users.find(user => user.user_id === entry.actor_id && user.name === entry.actor_name);
  return person && active(person, Date.parse(entry.at)) ? [] : [`${String(agent.name)}: ${String(entry.actor_name)} acts at ${String(entry.at)}, when their record says they are not active`];
}));

describe('the samples the related lists read are set right', () => {
  it('keep one id for every party, in every seat and line', () => {
    const ids = partyIds(samplesOf);
    expect(split(ids)).toEqual([]);
    // The two that had two ids until 0.15.0, now the Relationship samples' ids.
    expect([...ids.get('Northwind Group')!]).toEqual(['3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a09']);
    expect([...ids.get('Harbor Channel Partners')!]).toEqual(['3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a10']);
  });

  it('catch a party given a second id', () => {
    const changed = (name: string) => name === 'Organization'
      ? samplesOf(name).map(sample => sample.label === 'Summit Outfitters' ? { ...sample, owner_id: 'reseller_harbor_channel' } : sample) : samplesOf(name);
    expect(split(partyIds(changed))).toEqual(['Harbor Channel Partners: reseller_harbor_channel, 3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a10']);
  });

  it('let every person who changes an agent act while their own record says they are active', () => {
    expect(agentLineProblems(samplesOf('Agent'))).toEqual([]);
    // 0.15.0's Scheduling Agent was retired at 09:00 on 10 Jul, the instant Jonah Marlow's own account was deactivated.
    const before = structuredClone(samplesOf('Agent'));
    before.find(agent => agent.name === 'Scheduling Agent')!.state_history.at(-1).at = '2026-07-10T09:00:00Z';
    expect(agentLineProblems(before)).toEqual(['Scheduling Agent: Jonah Marlow acts at 2026-07-10T09:00:00Z, when their record says they are not active']);
  });

  it('give the Tidewater grant\'s and the Billing Agent\'s start a reason their dates bear out', () => {
    const tidewater = samplesOf('Grant').find(grant => grant.name === 'Tidewater invoices and payments')!;
    const billing = samplesOf('Agent').find(agent => agent.name === 'Billing Agent')!;
    const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    const given = tidewater.state_history.find((entry: Sample) => entry.to === 'active');
    const activated = billing.state_history.find((entry: Sample) => entry.to === 'active');
    expect(days(tidewater.state_history[0].at, given.at)).toBe(12);
    expect(days(billing.state_history[0].at, activated.at)).toBe(12);
    expect(given.reason).toBe('Given after twelve days of supervised matching');
    expect(activated.reason).toBe('Approved after twelve days of supervised matching');
  });
});
