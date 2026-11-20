/**
 * s248-m02: a grant is a standing yes, not a setting. Grant is the fifteenth public object: one set of terms on which one
 * holder may act for one party, as given by one giver, until it ends. These checks hold its eight samples to the shipped
 * samples they name and to each other, because a worked example must obey its own rule:
 * - every seat names a shipped person, agent or organization by id and name, the party is never an agent, the giver is
 *   a person who gave it in the capacity their own record says, and the one who answers is a person or a team;
 * - a standing yes sits inside a grant with the same holder and party, ends no later, lets go ahead only an action that
 *   was asked first, carries money bounds where it moves money, and is given by a person, never its holder;
 * - a change of terms is a new grant: a replaced grant is named by exactly one grant that became active as it ended;
 * - every history follows the declared order, every actor acts inside its own record's active dates, and an ending's
 *   line names who ended it and why, as the record does;
 * - every line an agent writes for a party, in any shipped sample, names a grant of that agent for that party that was
 *   active at the time, and every standing grant not inside another is restated in its holder's acts_for;
 * - the end is kept three ways that agree: the instant is the end of the day the party's words name, in its zone.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, historyAttribution } from '@oods/component-contracts';
import { listObjects, loadObject } from '../../src/objects/object-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { FORM_FACT } from '../../src/compose/form-detail.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).textContent ?? '').replace(/\s+/g, ' ');
/** The page before the closed Reference details block, which lists every reference set or not, by design. */
const shown = (html: string) => { const body = text(html); const at = body.indexOf('Reference details'); return at >= 0 ? body.slice(0, at) : body; };
const CONTROLS = new Set(['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker', 'Checkbox', 'Switch', 'Toggle', 'StatusSelector']);
const bound = (node: UiElement) => Object.entries(node.props ?? {}).flatMap(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string' ? [value] : []);
const RENDERERS = ['html', 'react', 'vue'] as const;

type Sample = Record<string, any>;
const STATES = ['requested', 'active', 'paused', 'revoked', 'expired', 'replaced', 'declined', 'withdrawn'];
const ENDINGS = ['revoked', 'expired', 'replaced', 'declined', 'withdrawn'];
const MANDATE = Object.keys(composeObject(loadObject('Grant')).traits.find(trait => trait.definition.trait.name === 'Mandate')!.definition.schema);
const grants = (loadObject('Grant').samples ?? []) as Sample[];
const users = (loadObject('User').samples ?? []) as Sample[];
const agents = (loadObject('Agent').samples ?? []) as Sample[];
const organizations = (loadObject('Organization').samples ?? []) as Sample[];
const order = loadObject('Grant').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters!.transitionRules as Record<string, string[]>;
const user = (id: unknown, name: unknown) => users.find(sample => sample.user_id === id && sample.name === name);
const agent = (id: unknown, name: unknown) => agents.find(sample => sample.agent_id === id && sample.name === name);
const organization = (id: unknown, name: unknown) => organizations.find(sample => sample.organization_id === id && sample.label === name);
const items = (line: unknown) => String(line ?? 'None') === 'None' ? [] : String(line).split('; ');
const SHIPPED_WITH_LINES = ['Task', 'Approval', 'Transaction', 'Grant'];

/** When a record's own history says it was in one of the states: [from, to) pairs, open-ended when it still is. */
function spans(record: Sample, states: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let since: number | undefined;
  for (const entry of record.state_history ?? []) {
    const at = Date.parse(entry.at);
    if (states.includes(entry.to) && since === undefined) since = at;
    else if (!states.includes(entry.to) && since !== undefined) { out.push([since, at]); since = undefined; }
  }
  if (since !== undefined) out.push([since, Infinity]);
  return out;
}
const inside = (when: number, ranges: Array<[number, number]>) => ranges.some(([from, to]) => when >= from && when < to);

/** "At the end of 31 Dec 2026, Tauranga time" in the named zone, as the instant a product checks. */
function endOfDay(note: string, zone: string): number | undefined {
  const match = /^At the end of (\d{1,2}) ([A-Z][a-z]{2}) (\d{4}), /.exec(note);
  if (!match) return undefined;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[2]!);
  // The instant whose wall clock in the zone reads 23:59:59 on that day.
  const guess = Date.UTC(Number(match[3]), month, Number(match[1]), 23, 59, 59);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find(part => part.type === type)!.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return guess - (wall - guess);
}

/** Every line an agent writes for a party, in every shipped sample that keeps a history (the grants given, or Grant's own). */
function agentLines(grantSamples: Sample[] = grants): Array<{ object: string; record: string; entry: Sample }> {
  return SHIPPED_WITH_LINES.flatMap(object => ((object === 'Grant' ? grantSamples : loadObject(object).samples ?? []) as Sample[]).flatMap(record =>
    (record.state_history ?? []).filter((entry: Sample) => entry.actor_kind === 'agent' && entry.on_behalf_of_name !== undefined)
      .map((entry: Sample) => ({ object, record: String(record.name ?? record.payment_reference ?? record.subject_name), entry }))));
}

/** The rules a Grant sample keeps (s248 handoff, Interfaces 2), as one checker so each can be shown to fail. */
function grantProblems(samples: Sample[], lines = agentLines(samples)): string[] {
  const problems: string[] = [];
  const byId = (id: unknown, name: unknown) => samples.find(sample => sample.grant_id === id && sample.name === name);
  for (const grant of samples) {
    const at = String(grant.name);
    const holder = grant.granted_to_kind === 'agent' ? agent(grant.granted_to_id, grant.granted_to_name) : grant.granted_to_kind === 'person' ? user(grant.granted_to_id, grant.granted_to_name) : undefined;
    // 1. The seats name shipped samples by id and name, their kinds agreeing; the party is never an agent.
    const giver = grant.granted_by_kind === 'person' ? user(grant.granted_by_id, grant.granted_by_name) : undefined;
    if (!giver) problems.push(`${at}: its giver is no shipped person`);
    else if (grant.granted_as !== giver.description) problems.push(`${at}: it was given as "${String(grant.granted_as)}", not as its giver's record says`);
    if (!holder) problems.push(`${at}: its holder is no shipped ${String(grant.granted_to_kind)}`);
    if (!organization(grant.granted_for_id, grant.granted_for_name) && !user(grant.granted_for_id, grant.granted_for_name)) problems.push(`${at}: it is for no shipped organization or person`);
    if (agent(grant.granted_for_id, grant.granted_for_name)) problems.push(`${at}: it is for an agent`);
    if (grant.requested_by_id !== undefined) {
      const asker = grant.requested_by_kind === 'person' ? user(grant.requested_by_id, grant.requested_by_name) : grant.requested_by_kind === 'agent' ? agent(grant.requested_by_id, grant.requested_by_name) : undefined;
      if (!asker) problems.push(`${at}: its asker is no shipped ${String(grant.requested_by_kind)}`);
    }
    // 2. The one who answers is a person or a team, never an agent: a shipped person, or the team an agent names as its sponsor.
    const team = grant.owner_type === 'team' && agents.some(sample => sample.owner_type === 'team' && sample.owner_id === grant.owner_id && sample.owner_name === grant.owner_name);
    if (!(grant.owner_type === 'user' && user(grant.owner_id, grant.owner_name)) && !team) problems.push(`${at}: answered for by no shipped person or team`);
    // 3. Its lines never go wider than its holder's own, and never name an action the holder never takes.
    const own = { allowed: items(holder?.allowed_actions), ask: items(holder?.asks_first_for), never: items(holder?.never_allowed) };
    for (const action of [...items(grant.allowed_actions), ...items(grant.asks_first_for)]) if (own.never.includes(action)) problems.push(`${at}: it names "${action}", which its holder never takes`);
    // 4. A standing yes sits inside a grant of the same holder and party, ends no later, lets go ahead only what was asked
    // first, is given by a person who is not its holder, and carries money bounds and an end where its action moves money.
    if (grant.within_id !== undefined) {
      const outer = byId(grant.within_id, grant.within_name);
      if (!outer) problems.push(`${at}: it sits inside no sample`);
      else {
        if (outer.granted_to_id !== grant.granted_to_id || outer.granted_for_id !== grant.granted_for_id) problems.push(`${at}: it sits inside a grant of another holder or party`);
        if (Date.parse(grant.ends_at) > Date.parse(outer.ends_at)) problems.push(`${at}: it ends after the grant it sits inside`);
        for (const action of items(grant.allowed_actions)) if (![...items(outer.asks_first_for), ...own.ask].includes(action)) problems.push(`${at}: it lets "${action}" go ahead, which was not asked first`);
        for (const action of [...items(grant.allowed_actions), ...items(grant.asks_first_for)]) if (items(outer.never_allowed).includes(action)) problems.push(`${at}: it names "${action}", which the grant it sits inside never allows`);
      }
      if (grant.granted_by_id === grant.granted_to_id) problems.push(`${at}: its holder gave it`);
      if (items(grant.allowed_actions).some(action => /payment|charge|refund/i.test(action)) && (grant.amount_limit_minor === undefined || grant.period_limit_minor === undefined || grant.uses_per_period === undefined || grant.ends_at === undefined)) problems.push(`${at}: it moves money with no bounds`);
    } else {
      for (const action of items(grant.allowed_actions)) if (!own.allowed.includes(action)) problems.push(`${at}: it lets "${action}" go ahead, which its holder's own lines do not`);
      for (const action of items(grant.asks_first_for)) if (![...own.allowed, ...own.ask].includes(action)) problems.push(`${at}: it asks first for "${action}", which its holder's own lines do not name`);
    }
    // 5. A replaced grant is named by exactly one sample that became active as it ended, for the same holder and party.
    if (grant.status === 'replaced') {
      const next = samples.filter(sample => sample.replaces_id === grant.grant_id && sample.replaces_name === grant.name);
      const ended = (grant.state_history ?? []).find((entry: Sample) => entry.to === 'replaced')?.at;
      if (next.length !== 1) problems.push(`${at}: replaced by ${next.length} samples`);
      else {
        const became = (next[0]!.state_history ?? []).find((entry: Sample) => entry.to === 'active')?.at;
        if (became !== ended) problems.push(`${at}: its replacement became active at ${String(became)}, not as it ended at ${String(ended)}`);
        if (next[0]!.granted_to_id !== grant.granted_to_id || next[0]!.granted_for_id !== grant.granted_for_id) problems.push(`${at}: replaced by a grant of another holder or party`);
        const first = grant.first_grant_id !== undefined ? { id: grant.first_grant_id, name: grant.first_grant_name } : { id: grant.grant_id, name: grant.name };
        if (next[0]!.first_grant_id !== first.id || next[0]!.first_grant_name !== first.name) problems.push(`${at}: its replacement names another first grant`);
      }
    }
    // 6. The history follows the declared order from requested, and ends in the record's status.
    const history = (grant.state_history ?? []) as Sample[];
    if (history[0]?.from !== null || history[0]?.to !== 'requested') problems.push(`${at}: its history does not start requested`);
    for (const entry of history) if (entry.from !== null && !(order[entry.from] ?? []).includes(entry.to)) problems.push(`${at}: ${String(entry.from)} to ${String(entry.to)} is not in the declared order`);
    if (history.at(-1)?.to !== grant.status) problems.push(`${at}: its history ends in another state than its status`);
    // 7. Every actor acts while its own record says it is active.
    for (const entry of history) {
      const actor = entry.actor_kind === 'agent' ? agent(entry.actor_id, entry.actor_name) : entry.actor_kind === 'person' ? user(entry.actor_id, entry.actor_name) : undefined;
      if (!actor) { problems.push(`${at}: ${String(entry.actor_name)} acts and is no shipped sample`); continue; }
      if (!inside(Date.parse(entry.at), spans(actor, ['active']))) problems.push(`${at}: ${String(entry.actor_name)} acts at ${String(entry.at)}, when its record says it is not active`);
    }
    // 8. An ended grant keeps who ended it and why, and its ending's line says the same.
    const ending = history.find(entry => ['revoked', 'replaced'].includes(entry.to));
    if (ending && (grant.ended_by_id !== ending.actor_id || grant.ended_by_name !== ending.actor_name || grant.ended_reason !== ending.reason)) problems.push(`${at}: its ending's line and its record disagree on who ended it and why`);
    if (!ending && (grant.ended_by_id !== undefined || grant.ended_reason !== undefined)) problems.push(`${at}: it stands and names who ended it`);
    // 9. A grant to an agent has an end, kept three ways that agree.
    if (grant.granted_to_kind === 'agent') {
      const end = typeof grant.ends_note === 'string' && typeof grant.timezone === 'string' ? endOfDay(grant.ends_note, grant.timezone) : undefined;
      if (end === undefined || end !== Date.parse(grant.ends_at)) problems.push(`${at}: its end's instant is not the end of the day its words name, in its zone`);
    }
    // 10. A money limit has its currency, and a limit per period its period.
    if ((grant.amount_limit_minor !== undefined || grant.period_limit_minor !== undefined || grant.spent_minor !== undefined) && grant.limit_currency === undefined) problems.push(`${at}: a money limit with no currency`);
    if ((grant.period_limit_minor !== undefined || grant.uses_per_period !== undefined) !== (grant.limit_period !== undefined)) problems.push(`${at}: a limit per period with no period, or a period with no limit`);
    // 11. A standing grant not inside another is restated in its holder's acts_for, by party, scope and end.
    if (['active', 'paused'].includes(grant.status) && grant.within_id === undefined) {
      const phrase = `${String(grant.granted_for_name)} · ${String(grant.scope).toLowerCase()} · until ${String(/^At the end of (.*?), /.exec(String(grant.ends_note))?.[1])}`;
      if (!String(holder?.acts_for ?? '').split('; ').includes(phrase)) problems.push(`${at}: its holder's acts_for does not restate it ("${phrase}")`);
    }
    // 12. The use it records is the use the shipped lines show: a use for each moment a line names it (one act can write
    // lines on several records at once: the 21:00 resend writes the payment's, the task's and the approval's), and the
    // last one's time.
    const named = lines.filter(line => line.entry.grant_id === grant.grant_id);
    const moments = new Set(named.map(line => line.entry.at)).size;
    if (grant.uses !== undefined && grant.uses < moments) problems.push(`${at}: it records ${String(grant.uses)} uses, and lines name it at ${moments} moments`);
    const last = named.map(line => line.entry.at).sort().at(-1);
    if (grant.last_used_at !== last && !(grant.last_used_at === undefined && last === undefined)) problems.push(`${at}: its last use is ${String(grant.last_used_at)}, and the last line naming it is at ${String(last)}`);
  }
  // 13. Every line an agent writes for a party names a grant of that agent for that party, active at the time.
  for (const { object, record, entry } of lines) {
    const grant = samples.find(sample => sample.grant_id === entry.grant_id && sample.name === entry.grant_name);
    const where = `${object} "${record}" at ${String(entry.at)}`;
    if (!grant) { problems.push(`${where}: the agent's line names no grant sample`); continue; }
    if (grant.granted_to_id !== entry.actor_id || grant.granted_for_id !== entry.on_behalf_of_id) problems.push(`${where}: it names a grant of another holder or party`);
    else if (!inside(Date.parse(entry.at), spans(grant, ['active']))) problems.push(`${where}: it names a grant that was not active then`);
  }
  return problems;
}

const copy = () => structuredClone(grants);

describe('the eight Grant samples tell true stories about the shipped samples they name', () => {
  it('rest in at least active, paused, revoked and replaced, with a standing yes inside the Tidewater grant', () => {
    expect(grants).toHaveLength(8);
    for (const state of ['active', 'paused', 'revoked', 'replaced']) expect(grants.some(grant => grant.status === state), state).toBe(true);
    expect(grants.every(grant => STATES.includes(grant.status))).toBe(true);
    const tidewater = grants[0]!;
    const standing = grants[1]!;
    expect(tidewater).toMatchObject({ name: 'Tidewater invoices and payments', status: 'active', granted_by_name: 'Ruth Adeyemi', granted_as: 'Finance manager, Tidewater Co-op', granted_to_name: 'Billing Agent', granted_for_name: 'Tidewater Co-op', owner_name: 'Ruth Adeyemi' });
    expect(tidewater).toMatchObject({ allowed_actions: 'Look up invoices; Match payments to invoices', asks_first_for: 'Resend a payment; Dispute a charge', never_allowed: 'Change bank details; Close the account' });
    expect(tidewater).toMatchObject({ ends_at: '2026-12-31T10:59:59Z', timezone: 'Pacific/Auckland', ends_note: 'At the end of 31 Dec 2026, Tauranga time' });
    expect(standing).toMatchObject({ name: 'Resend returned transfers', status: 'active', within_id: tidewater.grant_id, within_name: tidewater.name, allowed_actions: 'Resend a payment',
      amount_limit_minor: 1200000, period_limit_minor: 3000000, limit_currency: 'USD', limit_period: 'month', uses_per_period: 3, uses: 0, requested_by_name: 'Billing Agent' });
    // The 21:00 resend used Ruth's one-time approval, never the standing yes, which she gave after it.
    expect(Date.parse(standing.state_history.find((entry: Sample) => entry.to === 'active').at)).toBeGreaterThan(Date.parse('2026-09-28T21:00:00Z'));
    // One giver has since been suspended, and the grant stands.
    const kestrel = grants.find(grant => grant.granted_for_name === 'Kestrel Print Co.')!;
    expect(kestrel.status).toBe('active');
    expect(user(kestrel.granted_by_id, kestrel.granted_by_name)!.status).toBe('suspended');
    // Jonah Marlow ended the Marlow Yoga grant before his own account closed at 09:00 on 10 Jul.
    const marlow = grants.find(grant => grant.status === 'revoked')!;
    expect(marlow).toMatchObject({ ended_by_name: 'Jonah Marlow', ended_reason: 'The studio closed' });
    expect(Date.parse(marlow.state_history.at(-1).at)).toBeLessThan(Date.parse('2026-07-10T09:00:00Z'));
    // s249-m01: one grant ended with work under way. Dana Whitfield revoked Northwind customer replies on 8 Oct, two days
    // after the task it was used for went to needs input; the task still needs her answer, as its record says, and the
    // Support Agent's acts_for was restated as None.
    const replies = grants.find(grant => grant.name === 'Northwind customer replies')!;
    expect(replies).toMatchObject({ status: 'revoked', ended_by_name: 'Dana Whitfield', last_event: 'ended', uses: 2 });
    const ended = Date.parse(replies.state_history.at(-1).at);
    const task = (loadObject('Task').samples as Sample[]).find(sample => sample.name === 'Reply about order NW-2207')!;
    expect(task).toMatchObject({ status: 'needs_input', waiting_on_name: 'Dana Whitfield' });
    expect(Date.parse(task.state_history.at(-1).at)).toBeLessThan(ended);
    expect(task.state_history.every((entry: Sample) => entry.grant_name === replies.name)).toBe(true);
    expect(agent(replies.granted_to_id, replies.granted_to_name)!.acts_for).toBe('None');
    expect(user(replies.ended_by_id, replies.ended_by_name)!.status).toBe('active');
  });

  it('keep every rule: the seats, the lines, inside and replaced, the order, the dates, the ending, the end, the money, acts_for, the use and every agent line', () => {
    expect(grantProblems(grants)).toEqual([]);
  });

  it.each([
    ['a giver that is no shipped person', (s: Sample[]) => { s[0]!.granted_by_name = 'Ruth A.'; }, /its giver is no shipped person/],
    ['a capacity the giver\'s record does not say', (s: Sample[]) => { s[0]!.granted_as = 'Owner, Tidewater Co-op'; }, /given as "Owner, Tidewater Co-op"/],
    ['a holder that is no shipped agent', (s: Sample[]) => { s[5]!.granted_to_name = 'Orders Bot'; }, /its holder is no shipped agent/],
    ['a grant for an agent', (s: Sample[]) => { s[5]!.granted_for_id = agents[0]!.agent_id; s[5]!.granted_for_name = agents[0]!.name; }, /it is for an agent/],
    ['an agent answering for a grant', (s: Sample[]) => { Object.assign(s[5]!, { owner_id: agents[2]!.agent_id, owner_name: agents[2]!.name, owner_type: 'agent' }); }, /answered for by no shipped person or team/],
    ['a line its holder never takes', (s: Sample[]) => { s[0]!.asks_first_for = 'Resend a payment; Change bank details'; }, /names "Change bank details", which its holder never takes/],
    ['a go-ahead wider than the holder\'s own', (s: Sample[]) => { s[5]!.allowed_actions = 'Check stock; Split a shipment'; }, /lets "Split a shipment" go ahead, which its holder's own lines do not/],
    ['a standing yes inside another party\'s grant', (s: Sample[]) => { s[1]!.within_id = s[4]!.grant_id; s[1]!.within_name = s[4]!.name; }, /sits inside a grant of another holder or party/],
    ['a standing yes that ends after its grant', (s: Sample[]) => { s[1]!.ends_at = '2027-01-31T10:59:59Z'; s[1]!.ends_note = 'At the end of 31 Jan 2027, Tauranga time'; }, /ends after the grant it sits inside/],
    ['a standing yes for what was never asked first', (s: Sample[]) => { s[1]!.allowed_actions = 'Look up invoices'; }, /lets "Look up invoices" go ahead, which was not asked first/],
    ['a standing yes its holder gave', (s: Sample[]) => { Object.assign(s[1]!, { granted_by_id: s[1]!.granted_to_id }); }, /its holder gave it|its giver is no shipped person/],
    ['a standing yes that moves money unbounded', (s: Sample[]) => { delete s[1]!.amount_limit_minor; }, /moves money with no bounds/],
    ['a replaced grant nothing replaces', (s: Sample[]) => { delete s[4]!.replaces_id; }, /replaced by 0 samples/],
    ['a replacement given after the old grant ended', (s: Sample[]) => { s[4]!.state_history[1].at = '2026-03-09T15:30:00Z'; }, /became active at 2026-03-09T15:30:00Z, not as it ended/],
    ['a move the order does not declare', (s: Sample[]) => { s[2]!.state_history[2].from = 'requested'; s[2]!.state_history.splice(1, 1); }, /requested to revoked is not in the declared order/],
    ['an actor acting after their account closed', (s: Sample[]) => { s[2]!.state_history[2].at = '2026-07-10T09:00:00Z'; }, /Jonah Marlow acts at 2026-07-10T09:00:00Z/],
    ['an ending whose line and record disagree', (s: Sample[]) => { s[2]!.ended_reason = 'No longer needed'; }, /disagree on who ended it and why/],
    ['an end whose instant is another day', (s: Sample[]) => { s[0]!.ends_at = '2026-12-31T23:59:59Z'; }, /not the end of the day its words name/],
    ['a money limit with no currency', (s: Sample[]) => { delete s[1]!.limit_currency; }, /a money limit with no currency/],
    ['a standing grant its holder does not restate', (s: Sample[]) => { s[5]!.scope = 'Online and phone orders'; }, /its holder's acts_for does not restate it/],
    ['a last use the lines do not show', (s: Sample[]) => { s[5]!.last_used_at = '2026-10-09T15:00:00Z'; }, /its last use is 2026-10-09T15:00:00Z/],
    ['fewer uses than the moments its lines show', (s: Sample[]) => { s[0]!.uses = 5; }, /it records 5 uses, and lines name it at 6 moments/],
    ['an agent line naming no grant', (s: Sample[]) => { delete s[1]!.state_history[0].grant_id; }, /the agent's line names no grant sample/],
    ['an agent line under a paused grant', (s: Sample[]) => { s[6]!.state_history[2].at = '2026-09-19T17:00:00Z'; }, /names a grant that was not active then/],
  ])('catches %s', (_name, mutate, says) => {
    const samples = copy();
    mutate(samples);
    expect(grantProblems(samples).join('\n')).toMatch(says);
  });
});

describe('Grant is the fifteenth public object', () => {
  it('composes the record trait, its lifecycle, its times and the one who answers, and no Cancel', () => {
    const grant = loadObject('Grant');
    expect(grant.object).toMatchObject({ name: 'Grant', version: '1.0.1', domain: 'core.governance' });
    expect(grant.object).not.toHaveProperty('visibility');
    expect(grant.traits.map(trait => trait.name)).toEqual(['core/Mandate', 'lifecycle/Stateful', 'lifecycle/Timestampable', 'structural/Ownerable']);
    const lifecycle = grant.traits[1]!.parameters!;
    expect(lifecycle.states).toEqual(STATES);
    expect(lifecycle.initialState).toBe('requested');
    // The five endings are final: a grant never comes back, and a new one follows it. Paused is the stop that lifts.
    for (const ending of ENDINGS) expect(order[ending], ending).toEqual([]);
    // s249-m03: a request can also lapse unanswered (requested to expired).
    expect(order).toMatchObject({ requested: ['active', 'declined', 'withdrawn', 'expired'], active: ['paused', 'revoked', 'expired', 'replaced'], paused: ['active', 'revoked', 'expired', 'replaced'] });
    expect(grant.traits[2]!.parameters!.recordedEvents).toEqual(['requested', 'granted', 'paused', 'resumed', 'ended', 'updated']);
    expect(grant.traits[3]!.parameters!.ownerTypes).toEqual(['user', 'team']);
    for (const state of STATES) expect(getStatusPresentation('lifecycle', state).description, state).not.toMatch(/not found in registry/);
    for (const state of ENDINGS) expect(getStatusPresentation('lifecycle', state).tone, state).not.toBe('success');
    expect(listObjects()).toContain('Grant');
  });

  it('names itself, so a row reads as a grant, with what it covers as its summary', () => {
    const composed = composeObject(loadObject('Grant'));
    expect(composed.semantics.name?.semantic_type).toBe('text.label');
    expect(composed.semantics.scope).toMatchObject({ semantic_type: 'text.summary', ui_hints: { label: 'Covers' } });
    expect(composed.semantics.owner_id?.ui_hints).toMatchObject({ displayLabelField: 'owner_name' });
  });

  it('composes and renders in list, detail, form, timeline, card, inline and workflow, in HTML, React and Vue', async () => {
    for (const context of ['list', 'detail', 'form', 'timeline', 'card', 'inline', 'workflow'] as const) {
      const composed = await compose({ object: 'Grant', context, options: { transient: true } } as never) as { status: string; schema: UiSchema };
      expect(composed.status, context).toBe('ok');
      const html = await pipeline({ object: 'Grant', context, framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } };
      expect(String(html.render?.html ?? ''), `${context} html`).toMatch(/Tidewater invoices and payments|Resend returned transfers|Marlow Yoga class bookings|Northwind|Summit online orders|Blue Harbor session bookings|Kestrel overdue invoices/);
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema: composed.schema, framework, profile: 'build' } as never) as { status: string; errors?: unknown };
        expect(result.status, `${context} ${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      }
    }
  });

  it('an intent that names the Grant composes it', async () => {
    const composed = await compose({ intent: 'Show the Grant list', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(composed.status).toBe('ok');
    expect(JSON.stringify(composed.schema)).toContain('Tidewater invoices and payments');
  });
});

describe('on Grant\'s form its terms and seats are read beside the status, and why it ended is the one thing written there', () => {
  it('places the facts as labelled rows with no control, a status select, the reason, and the grant\'s name as its one required input', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const nodes = schemaNodes(schema);
    // s249-m03: "Asked of" (s249-m05's fresh read: it read "Waiting on", false once the grant is given), who was asked for
    // the yes, is read beside who asked for it; and once a grant is final, why it ended is a fact after the others, where
    // the input it replaces is drawn only while the grant is open (compose/ending-fields.ts). s249-m04/m05: the instant's
    // label is "End time", since its value says UTC and "Ends" is the party's own words.
    expect(nodes.filter(node => node.meta?.intent === FORM_FACT).map(row => row.children?.[0]?.props?.content)).toEqual(['Covers', 'For', 'Held by', 'Given by', 'Given as', 'Asked for by', 'Asked of',
      'Allowed actions', 'Asks first for', 'Never allowed', 'Most per use', 'Most per period', 'Period', 'Uses per period', 'Conditions', 'Ends', 'End time', 'Inside', 'Why it ended']);
    for (const field of MANDATE.filter(name => name !== 'ended_reason')) expect(nodes.filter(node => CONTROLS.has(node.component) && bound(node).includes(field)), field).toEqual([]);
    expect(nodes.filter(node => node.component === 'StatusSelector').map(node => node.props?.field)).toEqual(['status']);
    for (const field of ['ended_reason', 'name']) expect(nodes.filter(node => node.component === 'Input' && node.props?.field === field), field).toHaveLength(1);
    expect(schema.objectSchema?.name).toMatchObject({ required: true });
    // The one who answers stays editable through Ownerable, as on Task's form.
    expect(nodes.some(node => CONTROLS.has(node.component) && bound(node).includes('owner_id'))).toBe(true);
    const edited = nodes.filter(node => CONTROLS.has(node.component)).flatMap(bound);
    expect(new Set(edited).size).toBe(edited.length);
  });

  it('reads the facts as text in HTML, React and Vue, the limits as money, and the generated app gives none an input of its own', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const workflow = (await compose({ object: 'Grant', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const standing = grants[1]!;
    const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), standing[field] ?? null]));
    const model = seedPreviewModel({ schema, context: 'form', object: 'Grant', established });
    const pages: Record<string, string> = { html: renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never) };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      pages[framework] = renderGenerated(framework, result.code!, model, result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    for (const [renderer, page] of Object.entries(pages)) {
      for (const words of ['Covers', 'Resend a payment the bank returned', 'Held by', 'Billing Agent', 'Given by', 'Ruth Adeyemi', 'Most per use', '$12,000.00', 'Most per period', '$30,000.00', 'Status']) expect(shown(page), `${renderer}: ${words}`).toContain(words);
      const fragment = JSDOM.fragment(page);
      for (const field of MANDATE.filter(name => name !== 'ended_reason')) expect(fragment.querySelectorAll(`input[name="${field}"], select[name="${field}"], textarea[name="${field}"]`).length, `${renderer}: ${field}`).toBe(0);
    }
    for (const framework of ['react', 'vue'] as const) {
      const app = await generate({ schema: workflow, framework, profile: 'build' } as never);
      const application = app.artifact!.files.find(file => file.path === 'src/application.ts')!.contents;
      const supplemental = JSON.parse(application.match(/export const supplementalFields[^=]*= (\[.*?\]);/)![1]!) as Array<{ name: string }>;
      expect(supplemental.map(field => field.name).filter(name => MANDATE.includes(name) && name !== 'ended_reason'), framework).toEqual([]);
    }
  });
});

describe('the generated app: a grant is taken back on its form, the list finds a grant by any seat, and the end reads in the party\'s words', () => {
  const apps = {} as Record<'react' | 'vue', GeneratedArtifact>;
  let records: Array<{ status: string; name: string; props: Record<string, unknown> }> = [];
  let revoked: Record<string, unknown> = {};
  beforeAll(async () => {
    const workflow = (await compose({ object: 'Grant', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never);
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      apps[framework] = result.artifact!;
    }
    const out = runGeneratedStore(apps.react.files, `
const { createStore, screenProps, collectionEvents, idField } = store;
const s = createStore({ latency: 0, now: () => '2026-11-20T09:00:00.000Z' });
const all = s.list({ pageSize: 1000 }).records;
const records = all.map(record => ({ status: String(record.status), name: String(record.name), props: { ...screenProps(record), events: collectionEvents(record), uiState: 'success' } }));
// Taking the standing yes back: its status moves to revoked on its form, with the reason typed there.
const standing = all.find(record => record.name === 'Resend returned transfers');
const saved = s.update({ ...standing, status: 'revoked', ended_reason: 'No longer needed: the bank fixed its reference check' });
process.stdout.write(JSON.stringify({ records, revoked: { ...screenProps(saved), events: collectionEvents(saved), uiState: 'success' } }));
`) as { records: typeof records; revoked: Record<string, unknown> };
    records = out.records;
    revoked = out.revoked;
  }, 600_000);

  it('takes a grant back by moving its status to revoked on its form, and its page shows the reason', () => {
    expect(revoked).toMatchObject({ status: 'revoked', endedReason: 'No longer needed: the bank fixed its reference check' });
    // s249-m03 (Interface 6): the form's move is Revoke, written as its button writes it: one line titled with the new state,
    // the reason typed there as its reason, naming no one since the store was told no one, and the ended event.
    expect((revoked.stateHistory as unknown[]).at(-1)).toEqual({ title: 'Revoked', from: 'active', to: 'revoked', at: '2026-11-20T09:00:00.000Z', reason: 'No longer needed: the bank fixed its reference check' });
    expect(revoked).toMatchObject({ lastEvent: 'ended', lastEventAt: '2026-11-20T09:00:00.000Z' });
    for (const framework of ['react', 'vue'] as const) {
      const detail = apps[framework].files.find(file => file.path === `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`)!;
      const [page] = renderGeneratedModels(framework, detail.contents, [revoked], apps[framework].actions.map(action => action.name), { entry: detail.path, files: apps[framework].files });
      expect(shown(page!), framework).toContain('Why it ended');
      expect(shown(page!), framework).toContain('No longer needed: the bank fixed its reference check');
      // A grant has no Cancel: it is taken back by Revoke, or on its form (s249-m03).
      expect(page!, framework).not.toMatch(/data-oods-action="handleCancel"|Cancel grant/);
    }
  });

  it('filters by status and finds a grant by any seat\'s name, what it covers, or the first grant\'s name', () => {
    const found = runGeneratedStore(apps.react.files, [
      'const s = store.createStore();',
      'const names = query => [...new Set(s.list({ pageSize: 100, ...query }).records.map(record => record.name))].sort();',
      "process.stdout.write(JSON.stringify({ paused: names({ status: 'paused' }), ruth: names({ search: 'Ruth Adeyemi' }), billing: names({ search: 'Billing Agent' }), tidewater: names({ search: 'Tidewater Co-op' }), scope: names({ search: 'the bank returned' }), first: names({ search: 'Northwind spring order replies' }), team: names({ search: 'Accounts team' }) }));",
    ].join('\n')) as Record<string, string[]>;
    expect(found.paused).toEqual(['Blue Harbor session bookings']);
    // Everything Ruth Adeyemi gave, which the 0.14.0 delegation's history line could not show.
    expect(found.ruth).toEqual(['Resend returned transfers', 'Tidewater invoices and payments']);
    expect(found.billing).toEqual(['Resend returned transfers', 'Tidewater invoices and payments']);
    expect(found.tidewater).toEqual(['Resend returned transfers', 'Tidewater invoices and payments']);
    expect(found.scope).toEqual(['Resend returned transfers']);
    // The first grant's name is kept on every grant in a line of replacements, so a search by it gathers the line.
    expect(found.first).toEqual(['Northwind customer replies', 'Northwind spring order replies']);
    expect(found.team).toEqual(['Kestrel overdue invoices']);
  });

  it('reads the Tidewater grant\'s end as the end of 31 Dec 2026 in Tauranga on its list, card and detail, in HTML, React and Vue, and labels the instant as UTC', async () => {
    const tidewater = grants[0]!;
    for (const context of ['list', 'card', 'detail'] as const) {
      const schema = (await compose({ object: 'Grant', context, options: { transient: true } } as never) as { schema: UiSchema }).schema;
      const row = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), tidewater[field] ?? null]));
      const model = { ...seedPreviewModel({ schema, context, object: 'Grant', established: context === 'list' ? { rows: [row] } : row }), ...(context === 'list' ? { rows: [row], collectionQuery: { page: 1, pageSize: 10, total: 1 } } : {}) };
      const pages: Record<string, string> = { html: renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never) };
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
        pages[framework] = renderGenerated(framework, result.code!, model, result.artifact!.actions.map(({ name }: { name: string }) => name));
      }
      for (const renderer of RENDERERS) {
        const body = shown(pages[renderer]!);
        expect(body, `${renderer} ${context}`).toContain('At the end of 31 Dec 2026, Tauranga time');
        // The instant is shown only on the detail page, and says UTC. s249-m04 (Interface 13): the value names its zone, so
        // its label is "End time", where it read "Ends (UTC)" beside an unlabelled time.
        if (context === 'detail') expect(body, renderer).toMatch(/End time\s*Dec 31, 2026, 10:59 AM UTC/);
        else expect(body, `${renderer} ${context}`).not.toContain('10:59 AM');
      }
    }
  });

  it('draws no empty place on the app\'s detail page or form for any sample: no "Not recorded", no "unavailable", and no limit or period a grant does not set', () => {
    for (const framework of ['react', 'vue'] as const) {
      for (const screen of ['Detail', 'Form'] as const) {
        const page = apps[framework].files.find(file => file.path === `src/screens/${screen}.${framework === 'react' ? 'tsx' : 'vue'}`)!;
        const pages = renderGeneratedModels(framework, page.contents, records.map(record => record.props), apps[framework].actions.map(action => action.name), { entry: page.path, files: apps[framework].files });
        records.forEach((record, index) => {
          const body = shown(pages[index]!);
          expect(body, `${framework} ${screen} ${record.name}`).not.toMatch(/Not recorded|unavailable|not resolved/);
          // Only the standing yes sets money limits; no other grant reads a limit of $0.00, a period (the form's facts once
          // read "Period: Day", the first choice, in Vue) or any limit at all.
          if (record.name !== 'Resend returned transfers') expect(body, `${framework} ${screen} ${record.name}`).not.toMatch(/Most per use|Most per period|Period\s*(?:Day|Week|Month|Year)|Uses per period|\$0\.00/);
          else expect(body, `${framework} ${screen} ${record.name}`).toMatch(/Period\s*Month/);
        });
      }
    }
  });
});

describe('what Grant changes elsewhere, and only that', () => {
  it('Transaction opens resends to a yes given in advance and declares the new outcome; its level texts and PAY-2026-0429 stay as they were', () => {
    const rule = loadObject('Transaction').traits.find(trait => trait.name === 'core/Approvable')!.parameters as Record<string, any>;
    expect(rule.inAdvance).toEqual(['resend']);
    expect(rule.outcomes).toEqual(['not_required', 'waiting', 'approved', 'allowed_in_advance', 'declined', 'out_of_date']);
    expect(rule.requiredLevels).toEqual({ resend: 'approval' });
    expect(rule.levelDefinitions.approval.permits).toBe('The one resend or refund it was asked for');
    expect(rule.levelDefinitions.approval.lapses).toBe('Once it is used (the resend is sent and recorded, not when the bank answers), or when the amount changes');
    const payment = (loadObject('Transaction').samples as Sample[]).find(sample => sample.payment_reference === 'PAY-2026-0429')!;
    expect(payment.approval_state).toBe('approved');
    expect((loadObject('Transaction').samples as Sample[]).some(sample => sample.approval_state === 'allowed_in_advance')).toBe(false);
    const resend = (payment.state_history as Sample[]).find(entry => entry.title === 'Sent again')!;
    expect(historyAttribution(resend)?.text).toBe('Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater invoices and payments · task: Get INV-2026-0155 paid');
  });

  it('Relationship keeps the delegation type as the link alone, and holds six samples, its two delegations now Grant samples', () => {
    const relationship = loadObject('Relationship');
    expect(relationship.samples).toHaveLength(6);
    expect((relationship.samples as Sample[]).some(sample => sample.relationship_type === 'delegation')).toBe(false);
    expect(relationship.schema.relationship_type!.validation!.enum).toContain('delegation');
    expect(relationship.schema.relationship_type!.description).toContain('a delegation is the link alone');
    for (const name of ['Marlow Yoga class bookings', 'Tidewater invoices and payments']) expect(grants.some(grant => grant.name === name), name).toBe(true);
  });

  it('Agent\'s four rule fields read their new descriptions and stay one-line inputs on its form; its samples do not move', async () => {
    const agent = loadObject('Agent');
    expect(agent.object.version).toBe('1.1.1');
    expect(agent.schema.acts_for!.description).toContain('restating the grant it holds for that party');
    expect(agent.schema.asks_first_for!.description).toContain('asked each time or given in advance by a standing yes under a grant');
    const { schema } = await compose({ object: 'Agent', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    for (const field of ['acts_for', 'allowed_actions', 'asks_first_for', 'never_allowed']) {
      const controls = schemaNodes(schema).filter(node => CONTROLS.has(node.component) && node.props?.field === field).map(node => node.component);
      expect(controls.every(component => component === 'Input'), `${field}: ${controls.join(', ')}`).toBe(true);
    }
  });
});
