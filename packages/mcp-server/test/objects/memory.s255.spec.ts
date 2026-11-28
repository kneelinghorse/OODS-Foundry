/**
 * s255-m03: Memory, the seventeenth public object (Interface 2, settled 5, 6, 9 and 11). A memory is a claim, not a
 * fact: what an assistant or an agent keeps about a person, as the product that holds it shows it. These specs hold its
 * eight samples to the shipped samples they name, by ten rules, each with a bite that removes its fact:
 * 1. every seat names a shipped sample by id and kept name, its kind agreeing, and it is kept for a person or an
 *    organization, never an agent;
 * 2. a memory kept under a grant names a grant held by its keeper, for its party, active when it was made, whose
 *    go-ahead lines name keeping notes; one kept under no grant is kept by an agent for that agent's own sponsor;
 * 3. the words appear only on the memory: a removed memory holds no words, no note on its source, no statement and no
 *    "removing it would leave", every other holds words, and no line, summary or name holds any memory's words; its name
 *    is who it is about and when it was made, in UTC;
 * 4. its history starts active when it was made, follows the declared order, keeps the state on a line from null, ends
 *    at its state, names who acted on every line, and runs forward;
 * 5. a replaced memory names the one sample that took its place, about the same person and kept by the same keeper,
 *    made at the instant it was replaced;
 * 6. a removed memory keeps who removed it and when, as its last line says, and its summary says the same;
 * 7. an expiry that has passed decides the state: one that hides is a pause, at its expiry;
 * 8. between them the samples rest in every state, are made in every way and one way not known, and show a summary
 *    and a file, a grant and none, a correction, a replaced pair, a removal with what remains, a person's own
 *    statement, an expiry and a rewrite no one asked for;
 * 9. a time of day in a memory's words names its person's own zone;
 * 10. every memory is about a person.
 */
import { describe, expect, it } from 'vitest';
import { loadObject } from '../../src/objects/object-loader.js';

type Sample = Record<string, any>;
type Line = { title?: string; from: string | null; to: string; at: string; reason?: string; actor_id?: string; actor_name?: string; actor_kind?: string; on_behalf_of_id?: string; grant_id?: string };
const STATES = ['active', 'paused', 'replaced', 'removed'];
const ORIGINS = ['told', 'inferred', 'combined', 'imported', 'added_by_someone_else'];
const KEEP_NOTES = 'Keep notes about the people it deals with';
const ORDER = (loadObject('Memory').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as { transitionRules: Record<string, string[]> }).transitionRules;
const samplesOf = (name: string) => (loadObject(name).samples ?? []) as Sample[];
const users = samplesOf('User'), agents = samplesOf('Agent'), organizations = samplesOf('Organization'), grants = samplesOf('Grant');
const user = (id: unknown, name: unknown) => users.find(sample => sample.user_id === id && sample.name === name);
const agent = (id: unknown, name: unknown) => agents.find(sample => sample.agent_id === id && sample.name === name);
const organization = (id: unknown, name: unknown) => organizations.find(sample => sample.organization_id === id && sample.label === name);
const items = (line: unknown) => String(line ?? 'None') === 'None' ? [] : String(line).split('; ');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "28 Sep 2026, 21:12 UTC": the instant a memory was made, as its name says it. */
const madeAt = (instant: string) => { const d = new Date(instant); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
/** Whether the record's own history says it is in a state at the instant: a move at that instant already applies. */
const inState = (record: Sample, at: number, state: string) => {
  let now: unknown;
  for (const line of record.state_history ?? []) { if (Date.parse(line.at) > at) break; now = line.to; }
  return now === state;
};
const WORDLESS = ['words', 'source_note', 'persons_statement', 'removing_leaves'];

/** The ten rules, as one list of what breaks; an empty list is samples that hold. */
function broken(memories: Sample[]): string[] {
  const out: string[] = [];
  const allWords = memories.flatMap(memory => typeof memory.words === 'string' ? [memory.words] : []);
  for (const memory of memories) {
    const at = String(memory.name);
    const history = (memory.state_history ?? []) as Line[];
    // 1
    if (!user(memory.about_id, memory.about_name)) out.push(`1: ${at} is about no shipped person`);
    const maker = memory.made_by_kind === 'person' ? user(memory.made_by_id, memory.made_by_name) : memory.made_by_kind === 'agent' ? agent(memory.made_by_id, memory.made_by_name) : memory.made_by_kind === 'system' && memory.made_by_id === undefined && memory.made_by_name ? true : undefined;
    if (!maker) out.push(`1: ${at} is made by no shipped ${String(memory.made_by_kind)}`);
    if (!agent(memory.kept_by_id, memory.kept_by_name)) out.push(`1: ${at} is kept by no shipped agent`);
    const party = memory.kept_for_kind === 'person' ? user(memory.kept_for_id, memory.kept_for_name) : memory.kept_for_kind === 'organization' ? organization(memory.kept_for_id, memory.kept_for_name) : undefined;
    if (!party) out.push(`1: ${at} is kept for no shipped person or organization`);
    if (memory.removed_by_kind !== undefined) {
      const remover = memory.removed_by_kind === 'person' ? user(memory.removed_by_id, memory.removed_by_name) : memory.removed_by_kind === 'agent' ? agent(memory.removed_by_id, memory.removed_by_name) : memory.removed_by_kind === 'system' ? true : undefined;
      if (!remover) out.push(`1: ${at} is removed by no shipped ${String(memory.removed_by_kind)}`);
    }
    // 2
    const keeper = agent(memory.kept_by_id, memory.kept_by_name);
    if (memory.grant_id !== undefined) {
      const grant = grants.find(sample => sample.grant_id === memory.grant_id && sample.name === memory.grant_name);
      if (!grant) out.push(`2: ${at} names no Grant sample`);
      else {
        if (grant.granted_to_id !== memory.kept_by_id || grant.granted_for_id !== memory.kept_for_id) out.push(`2: ${at} names a grant of another holder or party`);
        if (!inState(grant, Date.parse(memory.created_at), 'active')) out.push(`2: ${at} was made when its grant was not active`);
        if (!items(grant.allowed_actions).includes(KEEP_NOTES)) out.push(`2: ${at} is kept under a grant whose go-ahead lines do not name keeping notes`);
      }
    } else if (!keeper || memory.kept_for_kind !== 'person' || keeper.owner_id !== memory.kept_for_id || keeper.owner_name !== memory.kept_for_name) out.push(`2: ${at} is kept under no grant and not for its keeper's own sponsor`);
    if (keeper && !items(keeper.allowed_actions).includes(KEEP_NOTES)) out.push(`2: ${at} is kept by an agent whose go-ahead lines do not name keeping notes`);
    // 3
    if (memory.status === 'removed') { for (const field of WORDLESS) if (memory[field] !== undefined) out.push(`3: ${at} is removed and holds ${field}`); }
    else if (typeof memory.words !== 'string' || !memory.words.trim()) out.push(`3: ${at} is not removed and holds no words`);
    if (memory.name !== `Memory about ${String(memory.about_name)}, ${madeAt(memory.created_at)}`) out.push(`3: ${at} is not named for who it is about and when it was made`);
    for (const words of allWords) {
      for (const [index, line] of history.entries()) if (`${line.title ?? ''} ${line.reason ?? ''}`.includes(words)) out.push(`3: ${at} line ${index + 1} holds a memory's words`);
      if (String(memory.summary).includes(words) || String(memory.name).includes(words)) out.push(`3: ${at} holds a memory's words in its name or summary`);
    }
    // 4
    if (!history.length || history[0]!.from !== null || history[0]!.to !== 'active') out.push(`4: ${at} is not made active`);
    else if (history[0]!.at !== memory.created_at) out.push(`4: ${at} is made at another time than its history says`);
    if (history.length > 8) out.push(`4: ${at} has more than eight lines`);
    history.forEach((line, index) => {
      if (!line.actor_name || !['person', 'agent', 'system'].includes(String(line.actor_kind))) out.push(`4: ${at} line ${index + 1} names no one who acted, with a kind`);
      if (index === 0) return;
      const before = history[index - 1]!;
      if (Date.parse(line.at) < Date.parse(before.at)) out.push(`4: ${at} line ${index + 1} goes back in time`);
      if (line.from === null) { if (line.to !== before.to) out.push(`4: ${at} line ${index + 1} keeps a state the line before did not leave`); return; }
      if (line.from !== before.to) out.push(`4: ${at} line ${index + 1} does not follow from ${before.to}`);
      if (!(ORDER[line.from] ?? []).includes(line.to)) out.push(`4: ${at} line ${index + 1} moves ${line.from} to ${line.to}, which the order does not allow`);
    });
    if (history.at(-1)?.to !== memory.status) out.push(`4: ${at} history ends at ${history.at(-1)?.to}, not ${memory.status}`);
    if (history.at(-1)?.at !== memory.updated_at) out.push(`4: ${at} last changed at another time than its last line`);
    // 5
    if (memory.status === 'replaced') {
      const next = memories.filter(other => other.memory_id === memory.replaced_by_id && other.name === memory.replaced_by_name);
      const replacedAt = history.find(line => line.to === 'replaced')?.at;
      if (next.length !== 1) out.push(`5: ${at} is replaced by ${next.length} samples`);
      else if (next[0]!.about_id !== memory.about_id || next[0]!.kept_by_id !== memory.kept_by_id) out.push(`5: ${at} is replaced by a memory about another person or kept by another`);
      else if (next[0]!.created_at !== replacedAt) out.push(`5: ${at} is replaced at ${String(replacedAt)}, not when its replacement was made`);
    } else if (memory.replaced_by_id !== undefined) out.push(`5: ${at} names a replacement and is not replaced`);
    // 6
    if (memory.status === 'removed') {
      const last = history.at(-1)!;
      if (memory.removed_at !== last.at || memory.removed_by_id !== last.actor_id || memory.removed_by_name !== last.actor_name || memory.removed_by_kind !== last.actor_kind) out.push(`6: ${at} and its last line disagree on who removed it and when`);
      if (!String(memory.summary).includes(String(memory.removed_by_name))) out.push(`6: ${at}'s summary does not say who removed it`);
    } else if (memory.removed_at !== undefined || memory.removed_by_name !== undefined || memory.remains !== undefined) out.push(`6: ${at} is not removed and says who removed it or what remains`);
    // 7
    if (memory.expires_at !== undefined && Date.parse(memory.expires_at) <= Date.parse(memory.updated_at)) {
      const expected = memory.expires_how === 'hides' ? 'paused' : memory.expires_how === 'deletes' ? 'removed' : undefined;
      const line = history.find(entry => entry.at === memory.expires_at);
      if (!expected || memory.status !== expected || line?.to !== expected) out.push(`7: ${at} expired and does not rest where its expiry puts it`);
    }
    // 9
    for (const match of String(memory.words ?? '').matchAll(/\b\d{2}:\d{2}\b/g)) {
      const zone = String(user(memory.about_id, memory.about_name)?.timezone ?? '').split('/').pop()!.replace(/_/g, ' ');
      if (!String(memory.words).includes(`${match[0]}, ${zone} time`)) out.push(`9: ${at} names ${match[0]} without ${String(memory.about_name)}'s own zone`);
    }
    // 10
    if (memory.about_kind !== undefined && memory.about_kind !== 'person') out.push(`10: ${at} is about something other than a person`);
  }
  // 8
  const has = (test: (memory: Sample) => boolean) => memories.some(test);
  for (const state of STATES) if (!has(memory => memory.status === state)) out.push(`8: no memory rests ${state}`);
  for (const origin of ORIGINS) if (!has(memory => memory.origin === origin)) out.push(`8: no memory is made ${origin}`);
  if (!has(memory => memory.origin === undefined)) out.push('8: no memory says how it was made is not known');
  for (const kind of ['summary', 'file']) if (!has(memory => memory.kind === kind)) out.push(`8: no memory is kept as a ${kind}`);
  if (!has(memory => memory.grant_id !== undefined) || !has(memory => memory.grant_id === undefined)) out.push('8: no memory under a grant, or none under no grant');
  if (!has(memory => (memory.state_history as Line[]).some(line => line.title === 'Corrected' && line.from === null))) out.push('8: no correction, as a line that keeps the state');
  if (!has(memory => memory.status === 'replaced')) out.push('8: no replaced pair');
  if (!has(memory => memory.status === 'removed' && typeof memory.remains === 'string')) out.push('8: no removed memory with what remains');
  if (!has(memory => typeof memory.persons_statement === 'string')) out.push("8: no person's own statement");
  if (!has(memory => memory.expires_at !== undefined)) out.push('8: no expiry');
  if (!has(memory => (memory.state_history as Line[]).some(line => line.actor_kind === 'system' && /no one asked/.test(String(line.reason))))) out.push('8: no rewrite no one asked for');
  return out;
}

const shipped = () => structuredClone(samplesOf('Memory'));
const find = (samples: Sample[], name: string) => samples.find(sample => sample.name === name)!;
const RUTH_EMAIL = 'Memory about Ruth Adeyemi, 28 Sep 2026, 21:12 UTC', RUTH_REMOVED = 'Memory about Ruth Adeyemi, 28 Sep 2026, 21:15 UTC';
const TOMAS = 'Memory about Tomas Lindqvist, 15 Oct 2026, 06:30 UTC', OLD_CALL = 'Memory about Ruth Adeyemi, 14 Sep 2026, 03:40 UTC', MEI = 'Memory about Mei Chen, 24 Sep 2026, 02:00 UTC';

describe('the eight memories tell true stories about the shipped samples they name', () => {
  it('ships eight memories about Ruth Adeyemi, Mei Chen and Tomas Lindqvist, and every rule holds', () => {
    const memories = shipped();
    expect(memories).toHaveLength(8);
    expect(memories.map(memory => [memory.about_name, memory.status, memory.origin ?? 'not known', memory.kind])).toEqual([
      ['Ruth Adeyemi', 'active', 'told', 'entry'], ['Ruth Adeyemi', 'removed', 'inferred', 'entry'], ['Tomas Lindqvist', 'active', 'told', 'entry'],
      ['Ruth Adeyemi', 'active', 'combined', 'summary'], ['Mei Chen', 'paused', 'added_by_someone_else', 'entry'], ['Ruth Adeyemi', 'replaced', 'told', 'entry'],
      ['Ruth Adeyemi', 'active', 'not known', 'entry'], ['Ruth Adeyemi', 'active', 'imported', 'file'],
    ]);
    expect(broken(memories)).toEqual([]);
  });

  it.each([
    ['1, a person no sample is', (s: Sample[]) => { find(s, TOMAS).about_name = 'Tomas Lind'; }, /^1: .* is about no shipped person/],
    ['1, a keeper no agent is', (s: Sample[]) => { find(s, RUTH_EMAIL).kept_by_id = 'agt_elsewhere'; }, /^1: .* is kept by no shipped agent/],
    ['1, kept for an agent', (s: Sample[]) => { const m = find(s, MEI); m.kept_for_id = m.kept_by_id; m.kept_for_name = m.kept_by_name; m.kept_for_kind = 'agent'; }, /^1: .* is kept for no shipped person or organization/],
    ['2, a grant whose lines do not name keeping notes', (s: Sample[]) => { const m = find(s, RUTH_EMAIL); m.grant_id = '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c02'; m.grant_name = 'Resend returned transfers'; }, /^2: .* whose go-ahead lines do not name keeping notes/],
    ['2, made before its grant stood', (s: Sample[]) => { const m = find(s, RUTH_EMAIL); m.created_at = '2026-08-30T09:00:00Z'; m.state_history[0].at = m.created_at; m.name = 'Memory about Ruth Adeyemi, 30 Aug 2026, 09:00 UTC'; }, /^2: .* was made when its grant was not active/],
    ['2, no grant and not for the sponsor', (s: Sample[]) => { const m = find(s, RUTH_EMAIL); delete m.grant_id; delete m.grant_name; }, /^2: .* is kept under no grant and not for its keeper's own sponsor/],
    ['3, a removed memory with its words', (s: Sample[]) => { find(s, RUTH_REMOVED).words = 'Ruth Adeyemi answers resend requests within minutes.'; }, /^3: .* is removed and holds words/],
    ['3, the words in a line', (s: Sample[]) => { const m = find(s, RUTH_EMAIL); m.state_history[1].reason = `Corrected to: ${m.words}`; }, /^3: .* line 2 holds a memory's words/],
    ['3, a name that is not who and when', (s: Sample[]) => { find(s, TOMAS).name = 'Stock counts before six'; }, /^3: .* is not named for who it is about and when it was made/],
    ['4, a move the order refuses', (s: Sample[]) => { const m = find(s, OLD_CALL); m.state_history.push({ title: 'Used again', from: 'replaced', to: 'active', at: '2026-10-01T09:00:00Z', reason: 'Used again', actor_name: 'Tidewater billing', actor_kind: 'system' }); m.status = 'active'; m.updated_at = '2026-10-01T09:00:00Z'; }, /^4: .* moves replaced to active, which the order does not allow/],
    ['4, a line with no one who acted', (s: Sample[]) => { delete find(s, MEI).state_history[1].actor_name; }, /^4: .* names no one who acted/],
    ['5, a replacement made at another time', (s: Sample[]) => { find(s, OLD_CALL).state_history[1].at = '2026-09-30T22:00:00Z'; }, /^5: .* is replaced at .* not when its replacement was made/],
    ['6, a removal its record does not keep', (s: Sample[]) => { find(s, RUTH_REMOVED).removed_by_name = 'Mei Chen'; }, /^6: .* disagree on who removed it and when/],
    ['7, an expiry that hides and a memory still active', (s: Sample[]) => { const m = find(s, MEI); m.state_history.pop(); m.status = 'active'; m.updated_at = m.state_history[0].at; m.expires_at = '2026-09-25T00:00:00Z'; m.updated_at = '2026-09-26T00:00:00Z'; m.state_history.push({ title: 'Kept', from: null, to: 'active', at: '2026-09-26T00:00:00Z', reason: 'Kept', actor_name: 'Tidewater billing', actor_kind: 'system' }); }, /^7: .* expired and does not rest where its expiry puts it/],
    ['8, no memory paused', (s: Sample[]) => { const m = find(s, MEI); delete m.expires_at; delete m.expires_how; m.state_history[1] = { ...m.state_history[1], title: 'Removed', to: 'removed', reason: 'Removed by Tidewater billing' }; m.status = 'removed'; }, /^8: no memory rests paused/],
    ['8, no origin not known', (s: Sample[]) => { for (const m of s) m.origin ??= 'told'; }, /^8: no memory says how it was made is not known/],
    ['9, a time of day with no zone', (s: Sample[]) => { find(s, TOMAS).words = 'Tomas Lindqvist wants the stock counted before 06:00.'; }, /^9: .* names 06:00 without Tomas Lindqvist's own zone/],
  ])('the rule breaks without its fact: %s', (_name, mutate, says) => {
    const memories = shipped();
    mutate(memories);
    expect(broken(memories).some(problem => says.test(problem)), broken(memories).join('\n')).toBe(true);
  });

  it('keeps the Tidewater grant\'s use count and last use true of the memories kept under it, by their kept names', () => {
    const tidewater = grants.find(grant => grant.name === 'Tidewater invoices and payments')!;
    const kept = shipped().filter(memory => memory.grant_id === tidewater.grant_id).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const last = kept.at(-1)!;
    expect(tidewater.last_used_at).toBe(last.created_at);
    expect(tidewater.last_use).toBe(`6 Oct: kept ${last.name}`);
    // The last use reads by the memory's kept name, never its words.
    expect(tidewater.last_use).not.toContain(last.words);
    expect(tidewater.uses).toBe(11);
  });
});
