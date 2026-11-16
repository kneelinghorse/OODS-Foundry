/**
 * s249-m01: the resolver for related lists (compose/related-records.ts). For every sample of User, Organization, Agent
 * and Grant it returns the rows this table expects, built from the samples as this mission set them (Interface 15). The
 * table was read against the research's reverse index (cmos/research/persons-side-2026-11-15/R4-foundry-today.md,
 * section 1.2), which counts every record that points at a party by id: what the lists leave out of it is what each
 * list's note says it cannot see (Tidewater Co-op's two Relationships, Ruth Adeyemi's payment by user_id). A brute-force
 * index built the same way, here, is the cross-check: every row points at its subject by id, never by name.
 *
 * A row reads "<seat>: <title> [<state now> at end <state at the subject's end>] (<lines> lines) {<grants inside it>}";
 * a list the table leaves out is empty, and one that "does not apply" waits for its subject to end. s249-m02: a row
 * carries its state at the subject's end only on a list that reads finality ("Under way under it").
 */
import { describe, expect, it } from 'vitest';
import { loadObject } from '../../src/objects/object-loader.js';
import { endedAt, finalityOf, resolveRelatedList, resolveRelatedLists, stateAt, type RelatedRow } from '../../src/compose/related-records.js';
import type { RelatedList } from '../../src/objects/types.js';

type Sample = Record<string, any>;
const NAME: Record<string, string> = { Organization: 'label', User: 'name', Agent: 'name', Grant: 'name', Task: 'name' };
const KEY: Record<string, string> = { Organization: 'organization_id', User: 'user_id', Agent: 'agent_id', Grant: 'grant_id', Task: 'task_id', Approval: 'approval_id', Transaction: 'payment_reference' };
const show = (row: RelatedRow): string => [row.seat ? `${row.seat}: ` : '', row.title, row.kept ? ` (kept${row.kept.kind ? ', ' + row.kept.kind : ''})` : '',
  row.state ? ` [${row.state}${row.stateAtEnd !== undefined ? ` at end ${row.stateAtEnd ?? 'none'}` : ''}]` : '', row.lines ? ` (${row.lines.length} lines)` : '',
  row.inner ? ` {${row.inner.map(inner => `${inner.title} [${inner.state}]`).join(', ')}}` : ''].join('');
const samplesOf = (name: string) => (loadObject(name).samples ?? []) as Sample[];
const sample = (object: string, name: string) => samplesOf(object).find(record => record[NAME[object]!] === name)!;
const list = (object: string, name: string, id: string) => resolveRelatedLists(object, sample(object, name)).find(found => found.id === id)!;

const EXPECTED: Record<string, Record<string, Record<string, string[] | 'does not apply'>>> = {
  Organization: {
    "Northwind Traders": {
      'done-for': ["Reply about order NW-2207 [needs_input] (2 lines)"],
      'tasks': ["Reply about order NW-2207 [needs_input]"],
      'payments': ["PAY-2026-0412 [settled]","PAY-2026-0388 [settled]"],
      'ended-grants': ["Northwind spring order replies [replaced]","Northwind customer replies [revoked]"],
    },
    "Blue Harbor Studio": {
      'acting-for': ["Blue Harbor session bookings [paused]"],
      'done-for': ["Send Sunday's session reminders [outcome_unknown] (2 lines)"],
      'tasks': ["Send Sunday's session reminders [outcome_unknown]"],
      'payments': ["PAY-2026-0425 [authorized]"],
    },
    "Lindqvist Bakery": {
      'tasks': ["Count flour and butter for Monday's order [handed_over]","Count flour and butter by hand [finished]"],
      'payments': ["PAY-2026-0395 [refunded]","PAY-2026-0417 [settled]"],
    },
    "Kestrel Print Co.": {
      'acting-for': ["Kestrel overdue invoices [active]"],
      'done-for': ["Add a late fee to overdue invoices [declined] (1 lines)","Send September's payment reminders [cancelled] (1 lines)"],
      'tasks': ["Add a late fee to overdue invoices [declined]","Send September's payment reminders [cancelled]"],
      'payments': ["PAY-2026-0409 [failed]"],
    },
    "Tidewater Co-op": {
      'acting-for': ["Tidewater invoices and payments [active] {Resend returned transfers [active]}"],
      'done-for': ["Get INV-2026-0155 paid [waiting] (4 lines)","Approve the resend of PAY-2026-0429 [used] (3 lines)","PAY-2026-0429 [pending] (1 lines)","Resend returned transfers [active] (1 lines)"],
      'tasks': ["Get INV-2026-0155 paid [waiting]"],
      'approvals': ["Approve the resend of PAY-2026-0429 [used]"],
      'payments': ["PAY-2026-0429 [pending]"],
    },
    "Marlow Yoga": {
      'ended-grants': ["Marlow Yoga class bookings [revoked]"],
    },
    "Summit Outfitters": {
      'acting-for': ["Summit online orders [active]"],
      'done-for': ["Hold 40 trail tents for the autumn sale [paused] (1 lines)"],
      'tasks': ["Hold 40 trail tents for the autumn sale [paused]"],
    },
    "Gale & Rowe Legal": {
      'payments': ["PAY-2026-0404 [cancelled]"],
    },
  },
  User: {
    "Dana Whitfield": {
      'waiting': ["Reply about order NW-2207 [needs_input]"],
      'sponsors': ["Support Agent [active]"],
      'ended-grants': ["Northwind spring order replies [replaced]","Northwind customer replies [revoked]"],
    },
    "Ruth Adeyemi": {
      'gave': ["Tidewater invoices and payments [active] {Resend returned transfers [active]}"],
      'answers-for': ["Tidewater invoices and payments [active] {Resend returned transfers [active]}"],
      'sponsors': ["Billing Agent [active]"],
      'approved': ["PAY-2026-0429 [pending] (1 lines)"],
    },
    "Priya Raman": {
      'gave': ["Blue Harbor session bookings [paused]"],
      'answers-for': ["Blue Harbor session bookings [paused]"],
      'sponsors': ["Booking Agent [paused]"],
    },
    "Tomas Lindqvist": {
      'sponsors': ["Inventory Agent [draft]"],
    },
    "Grace Okafor": {
      'gave': ["Kestrel overdue invoices [active]"],
    },
    "Mei Chen": {},
    "Jonah Marlow": {
      'sponsors': ["Scheduling Agent [retired]"],
      'ended-grants': ["Marlow Yoga class bookings [revoked]"],
    },
    "Arjun Mehta": {
      'gave': ["Summit online orders [active]"],
      'answers-for': ["Summit online orders [active]"],
      'sponsors': ["Order Agent [active]"],
    },
  },
  Agent: {
    "Billing Agent": {
      'acts-for': ["Tidewater invoices and payments [active] {Resend returned transfers [active]}"],
      'work': ["Get INV-2026-0155 paid [waiting] (4 lines)","Approve the resend of PAY-2026-0429 [used] (3 lines)","PAY-2026-0429 [pending] (1 lines)","Resend returned transfers [active] (1 lines)"],
    },
    "Support Agent": {
      'work': ["Reply about order NW-2207 [needs_input] (2 lines)"],
      'ended-grants': ["Northwind spring order replies [replaced]","Northwind customer replies [revoked]"],
    },
    "Order Agent": {
      'acts-for': ["Summit online orders [active]"],
      'work': ["Hold 40 trail tents for the autumn sale [paused] (1 lines)"],
    },
    "Booking Agent": {
      'acts-for': ["Blue Harbor session bookings [paused]"],
      'work': ["Send Sunday's session reminders [outcome_unknown] (2 lines)"],
    },
    "Inventory Agent": {
      'work': ["Count flour and butter for Monday's order [handed_over] (1 lines)"],
    },
    "Collections Agent": {
      'acts-for': ["Kestrel overdue invoices [active]"],
      'work': ["Add a late fee to overdue invoices [declined] (1 lines)","Send September's payment reminders [cancelled] (1 lines)"],
    },
    "Scheduling Agent": {
      'ended-grants': ["Marlow Yoga class bookings [revoked]"],
    },
  },
  Grant: {
    "Tidewater invoices and payments": {
      'inside': ["Resend returned transfers [active]"],
      'recorded': ["Get INV-2026-0155 paid [waiting] (4 lines)","Approve the resend of PAY-2026-0429 [used] (3 lines)","PAY-2026-0429 [pending] (1 lines)","Resend returned transfers [active] (1 lines)"],
      'under-way': ["Get INV-2026-0155 paid [waiting] (4 lines)","PAY-2026-0429 [pending] (1 lines)","Resend returned transfers [active] (1 lines)"],
      'after-end': 'does not apply',
      'parties': ["Given by: Ruth Adeyemi [active]","Held by: Billing Agent [active]","For: Tidewater Co-op [active]","Answers for it: Ruth Adeyemi [active]"],
    },
    "Resend returned transfers": {
      'recorded': [],
      'after-end': 'does not apply',
      'parties': ["Given by: Ruth Adeyemi [active]","Held by: Billing Agent [active]","For: Tidewater Co-op [active]","Answers for it: Ruth Adeyemi [active]"],
    },
    "Marlow Yoga class bookings": {
      'parties': ["Given by: Jonah Marlow [deactivated]","Held by: Scheduling Agent [retired]","For: Marlow Yoga [churned]","Answers for it: Jonah Marlow [deactivated]"],
    },
    "Northwind spring order replies": {
      'replaced-by': ["Northwind customer replies [revoked]"],
      'parties': ["Given by: Dana Whitfield [active]","Held by: Support Agent [active]","For: Northwind Traders [active]","Answers for it: Dana Whitfield [active]"],
    },
    "Northwind customer replies": {
      'recorded': ["Reply about order NW-2207 [needs_input] (2 lines)"],
      'under-way': ["Reply about order NW-2207 [needs_input at end needs_input] (2 lines)"],
      'parties': ["Given by: Dana Whitfield [active]","Held by: Support Agent [active]","For: Northwind Traders [active]","Answers for it: Dana Whitfield [active]"],
    },
    "Summit online orders": {
      'recorded': ["Hold 40 trail tents for the autumn sale [paused] (1 lines)"],
      'under-way': ["Hold 40 trail tents for the autumn sale [paused] (1 lines)"],
      'after-end': 'does not apply',
      'parties': ["Given by: Arjun Mehta [active]","Held by: Order Agent [active]","For: Summit Outfitters [active]","Answers for it: Arjun Mehta [active]"],
    },
    "Blue Harbor session bookings": {
      'recorded': ["Send Sunday's session reminders [outcome_unknown] (2 lines)"],
      'under-way': ["Send Sunday's session reminders [outcome_unknown] (2 lines)"],
      'after-end': 'does not apply',
      'parties': ["Given by: Priya Raman [active]","Held by: Booking Agent [paused]","For: Blue Harbor Studio [onboarding]","Answers for it: Priya Raman [active]"],
    },
    "Kestrel overdue invoices": {
      'recorded': ["Add a late fee to overdue invoices [declined] (1 lines)","Send September's payment reminders [cancelled] (1 lines)"],
      'after-end': 'does not apply',
      'parties': ["Given by: Grace Okafor [suspended]","Held by: Collections Agent [paused]","For: Kestrel Print Co. [active]","Answers for it: Accounts team (kept, team)"],
    },
  },
};

describe('the resolver returns, for every sample of the four objects, the rows the table expects', () => {
  it.each(Object.keys(EXPECTED))('every %s sample', object => {
    const samples = samplesOf(object);
    expect(Object.keys(EXPECTED[object]!).sort()).toEqual(samples.map(record => String(record[NAME[object]!])).sort());
    for (const record of samples) {
      const expected = EXPECTED[object]![String(record[NAME[object]!])]!;
      const lists = resolveRelatedLists(object, record);
      expect(lists.length).toBe((loadObject(object).metadata.relatedLists ?? []).length);
      for (const resolved of lists) {
        const where = `${object} ${String(record[NAME[object]!])} ${resolved.id}`;
        expect(resolved.warnings, where).toEqual([]);
        const wanted = expected[resolved.id] ?? [];
        if (wanted === 'does not apply') { expect(resolved.applies, where).toBe(false); expect(resolved.rows, where).toEqual([]); continue; }
        expect(resolved.applies, where).toBe(true);
        expect(resolved.rows.map(show), where).toEqual(wanted);
        expect(resolved.label, where).not.toContain('{name}');
        expect(resolved.empty, where).not.toContain('{name}');
      }
    }
  });

  it('heads each list with the subject\'s name and says, when it lists nothing, which seat it read', () => {
    // s249-m05 (the fresh read): the headings and empty sentences claim no permission and no "standing" beyond now.
    expect(list('Organization', 'Tidewater Co-op', 'acting-for')).toMatchObject({ label: 'Agents holding a grant for Tidewater Co-op', collapsed: false });
    expect(list('User', 'Ruth Adeyemi', 'given-for')).toMatchObject({ label: 'Given for Ruth Adeyemi by someone else', empty: 'No grant was given for Ruth Adeyemi by someone else.', rows: [] });
    expect(list('User', 'Dana Whitfield', 'waiting')).toMatchObject({ label: 'Waiting for Dana Whitfield\'s answer' });
    expect(list('Agent', 'Support Agent', 'acts-for')).toMatchObject({ label: 'Grants Support Agent holds', empty: 'Support Agent holds no grant now.', rows: [] });
    expect(list('Organization', 'Tidewater Co-op', 'payments').note).toBe('Subscriptions, usage and invoices name their customer in words, so they are not listed here.');
    expect(list('Organization', 'Marlow Yoga', 'ended-grants').collapsed).toBe(true);
  });

  it('gives a grant\'s records with their lines beside the product\'s own count, and leaves the count out where the grant holds none', () => {
    const recorded = list('Grant', 'Tidewater invoices and payments', 'recorded');
    expect(recorded.rows).toHaveLength(4);
    expect(recorded.lineCount).toBe(9);
    expect(recorded.beside).toBe('Your product counts 6 uses.');
    expect(list('Grant', 'Summit online orders', 'recorded').beside).toBe('Your product counts 1 use.');
    expect(list('Grant', 'Resend returned transfers', 'recorded').beside).toBe('Your product counts 0 uses.');
    for (const name of ['Marlow Yoga class bookings', 'Northwind spring order replies']) expect(list('Grant', name, 'recorded').beside, name).toBeUndefined();
    // Each line is printed as every history is: who acted, for whom, on whose yes, under what grant and task.
    const payment = recorded.rows.find(row => row.title === 'PAY-2026-0429')!;
    const attribution = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · grant: Tidewater invoices and payments · task: Get INV-2026-0155 paid';
    expect(payment.lines).toEqual([{ at: '2026-09-28T21:00:00Z', title: 'Sent again', from: 'failed', to: 'pending', reason: expect.any(String), attribution,
      // s249-m04 (Interface 13): a line's time names its zone.
      text: `Sent again · Sep 28, 2026, 9:00 PM UTC · ${attribution} · ${payment.lines![0]!.reason}` }]);
    expect(payment.linesText).toBe('1 line');
    expect(recorded.rows.find(row => row.object === 'Task')!.lines!.map(line => line.title)).toEqual(['Started', 'Asked for a yes', 'Went on', 'Waiting for the bank']);
  });

  it('reads each row against its source\'s declared order: final, not final, or not known where the source declares none', () => {
    const rows = list('Grant', 'Tidewater invoices and payments', 'recorded').rows;
    expect(Object.fromEntries(rows.map(row => [row.title, row.finality]))).toEqual({
      'Get INV-2026-0155 paid': 'not_final', 'Approve the resend of PAY-2026-0429': 'final', 'PAY-2026-0429': 'not_known', 'Resend returned transfers': 'not_final',
    });
    // Under way leaves out only what is final; the payment, whose object declares no order, is not known, so it stays.
    expect(list('Grant', 'Tidewater invoices and payments', 'under-way').rows.map(row => row.title)).toEqual(['Get INV-2026-0155 paid', 'PAY-2026-0429', 'Resend returned transfers']);
    expect(list('Grant', 'Kestrel overdue invoices', 'under-way').rows).toEqual([]);
  });

  it('reads an ended grant\'s records at its end and now: the work under way when Northwind customer replies was revoked', () => {
    const replies = sample('Grant', 'Northwind customer replies');
    const underWay = list('Grant', 'Northwind customer replies', 'under-way');
    expect(underWay.endedAt).toBe('2026-10-08T16:00:00Z');
    expect(underWay.rows).toHaveLength(1);
    expect(underWay.rows[0]).toMatchObject({ object: 'Task', title: 'Reply about order NW-2207', state: 'needs_input', finality: 'not_final', stateAtEnd: 'needs_input', finalityAtEnd: 'not_final' });
    expect(underWay.label).toBe('Still under way');
    expect(underWay.note).toBe('These are only the records here that name this grant; work under it elsewhere is not shown.');
    expect(underWay.rows[0]!.atEndText).toBe('When the grant ended: needs input. Now: needs input.');
    // Taking the grant back ended the yes, not the work: the person it waits on still finds it waiting for her answer.
    expect(list('User', 'Dana Whitfield', 'waiting').rows.map(row => row.title)).toEqual(['Reply about order NW-2207']);
    expect(list('Grant', 'Northwind customer replies', 'after-end')).toMatchObject({ applies: true, rows: [] });
    expect(list('Grant', 'Tidewater invoices and payments', 'after-end')).toMatchObject({ applies: false, rows: [] });
    // The state at an instant, read from the record's own history.
    const task = sample('Task', 'Reply about order NW-2207');
    expect(stateAt(task, Date.parse('2026-10-06T14:05:00Z'))).toBe('working');
    expect(stateAt(task, Date.parse('2026-10-06T14:12:00Z'))).toBe('needs_input');
    expect(stateAt(task, Date.parse('2026-10-01T00:00:00Z'))).toBeUndefined();
    const order = loadObject('Grant').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters!.transitionRules as Record<string, string[]>;
    expect(endedAt(replies, order)).toBe('2026-10-08T16:00:00Z');
    expect(endedAt(sample('Grant', 'Kestrel overdue invoices'), order)).toBeUndefined();
    expect([finalityOf('revoked', order), finalityOf('paused', order), finalityOf('paused', undefined), finalityOf('archived', order)]).toEqual(['final', 'not_final', 'not_known', 'not_known']);
  });

  it('leaves out a row whose excluded field also holds the subject\'s key, as "given for them by someone else" does', () => {
    const ruth = sample('User', 'Ruth Adeyemi');
    const answersFor: RelatedList = { id: 'answers', label: 'Answers', sources: [{ from: 'Grant', via: 'owner_id', when: { within_id: null } }] };
    expect(resolveRelatedList('User', ruth, answersFor).rows.map(row => row.title)).toEqual(['Tidewater invoices and payments']);
    // Ruth gave the grant she answers for, so a list of those given by someone else leaves it out.
    const bySomeoneElse: RelatedList = { ...answersFor, sources: [{ ...answersFor.sources[0]!, exclude: ['granted_by_id'] }] };
    expect(resolveRelatedList('User', ruth, bySomeoneElse).rows).toEqual([]);
  });

  it('nests a grant inside another under its grant, so a heading counts the grants that can act, and shows a seat with no record here by its kept name', () => {
    const acting = list('Organization', 'Tidewater Co-op', 'acting-for');
    expect(acting.rows).toHaveLength(1);
    expect(acting.rows[0]).toMatchObject({ title: 'Tidewater invoices and payments', line: ['Billing Agent', 'Invoices and payments', '28 Sep: asked for a standing yes to resend returned transfers'], time: { field: 'ends_note', value: 'At the end of 31 Dec 2026, Tauranga time', instant: false } });
    expect(acting.rows[0]!.inner!.map(row => ({ title: row.title, line: row.line }))).toEqual([{ title: 'Resend returned transfers', line: ['Billing Agent', 'Resend a payment the bank returned', 'No uses counted'] }]);
    const parties = list('Grant', 'Kestrel overdue invoices', 'parties').rows;
    expect(parties.map(row => [row.seat, row.title, row.state ?? row.kept?.kind])).toEqual([['Given by', 'Grace Okafor', 'suspended'], ['Held by', 'Collections Agent', 'paused'], ['For', 'Kestrel Print Co.', 'active'], ['Answers for it', 'Accounts team', 'team']]);
    // A person's waiting list is ordered by due date, then oldest first, across its sources; a grant request holds no due
    // date, so it follows the asks that do (s249-m03).
    const waiting = loadObject('User').metadata.relatedLists!.find(found => found.id === 'waiting')!;
    expect(waiting.sources.map(source => [source.from, source.order])).toEqual([['Approval', 'due_at'], ['Task', 'due_at'], ['Grant', undefined]]);
  });
});

describe('the resolver matches by id only', () => {
  /** R4's method: a value points at a party only when it equals a registered id; every top-level value and history entry. */
  function pointersAt(id: string): Set<string> {
    const found = new Set<string>();
    for (const object of ['Task', 'Approval', 'Transaction', 'Grant', 'Agent', 'User', 'Organization']) for (const record of samplesOf(object)) {
      const values = [...Object.values(record), ...((record.state_history ?? []) as Sample[]).flatMap(entry => Object.values(entry))];
      if (values.some(value => value === id || (Array.isArray(value) && value.includes(id)))) found.add(`${object}:${String(record[KEY[object]!])}`);
    }
    return found;
  }

  it('lists only records that point at the subject by id, and every one an unfiltered list reads', () => {
    for (const object of ['Organization', 'User', 'Agent', 'Grant']) for (const record of samplesOf(object)) {
      const id = String(record[KEY[object]!]);
      const pointing = pointersAt(id);
      for (const resolved of resolveRelatedLists(object, record)) {
        const declared = loadObject(object).metadata.relatedLists!.find(found => found.id === resolved.id)!;
        const forward = declared.sources.every(source => source.via === undefined);
        for (const row of resolved.rows) {
          if (forward) continue;
          const where = `${object} ${String(record[NAME[object]!])} ${resolved.id}: ${row.title}`;
          expect(pointing.has(`${row.object}:${row.object === 'Transaction' ? row.title : row.key}`), where).toBe(true);
        }
        // A list with no filter lists every record of its sources that points at the subject through its field.
        const plain = declared.sources.every(source => source.via !== undefined && !source.when && !source.exclude && !source.states) && !declared.finality && !declared.afterEnd;
        if (!plain) continue;
        const reads = declared.sources.flatMap(source => (Array.isArray(source.from) ? source.from : [source.from]).flatMap(from => samplesOf(from).filter(other => {
          const key = /^state_history\[\]\.(.+)$/.exec(source.via!)?.[1];
          return key ? ((other.state_history ?? []) as Sample[]).some(entry => entry[key] === id) : other[source.via!] === id;
        }).map(other => `${from}:${String(other[KEY[from]!])}`)));
        expect(resolved.rows.map(row => `${row.object}:${row.object === 'Transaction' ? row.title : row.key}`).sort(), `${object} ${String(record[NAME[object]!])} ${resolved.id}`).toEqual([...new Set(reads)].sort());
      }
    }
  });

  it('never matches a name: the subject\'s name in its key finds nothing, and another name on its id finds the same rows', () => {
    const tidewater = sample('Organization', 'Tidewater Co-op');
    const byName = resolveRelatedLists('Organization', { ...tidewater, organization_id: 'Tidewater Co-op' });
    expect(byName.flatMap(found => found.rows)).toEqual([]);
    const renamed = resolveRelatedLists('Organization', { ...tidewater, label: 'Northwind Traders' });
    expect(renamed.map(found => found.rows.map(show))).toEqual(resolveRelatedLists('Organization', tidewater).map(found => found.rows.map(show)));
    expect(renamed[0]!.label).toBe('Grants asked for Northwind Traders, not yet answered');
    // A field that names a party in words (Subscription's customer_name, "Tidewater Co-op" on "Enterprise") never holds
    // its id, so even a list declared on it finds nothing: such records are what the billing note says is not listed.
    const custom: RelatedList = { id: 'words', label: 'Named in words', sources: [{ from: 'Subscription', via: 'customer_name' }] };
    expect(samplesOf('Subscription').some(subscription => subscription.customer_name === 'Tidewater Co-op')).toBe(true);
    expect(resolveRelatedList('Organization', tidewater, custom).rows).toEqual([]);
  });
});
