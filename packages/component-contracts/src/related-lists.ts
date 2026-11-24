/**
 * s249-m02: the rows a related list shows, worked out in one place for every renderer and for generated apps.
 *
 * An object declares, in `metadata.relatedLists`, lists of the records that point at one of its records (the shape and
 * its checks are OODS Foundry's: packages/mcp-server/src/objects/related-lists.ts). This core takes one declared list,
 * the record whose page shows it, and the records of the objects it reads, and returns the list as the page shows it:
 * its heading with its count, its rows, the sentences for an empty list and a filtered one, and the note on what it
 * cannot see. OODS Foundry calls it for HTML and for the standalone screens it seeds; a generated app calls it at run time
 * with the records it copied from other objects and its own live records, so a change made in the app (a grant ended)
 * shows on the page that lists it. It reads data and changes nothing.
 *
 * - Ids only. A record matches when its `via` equals the subject's key (or, for a list of ids, holds it), or, through
 *   history (`state_history[].<key>`), when any of its lines holds the key; that row carries those lines. A name never
 *   matches.
 * - Each row is read against its object's declared order: final when its state's declared targets are empty, not final
 *   when they are not, not known when the object declares no order or its order does not name the state.
 * - An ended subject (its state final in its own declared order) is read at its end: a list that declares `finality`
 *   keeps the rows final, not final or not known at that instant and says each row's state then and now, and a list that
 *   declares `afterEnd` applies only once the subject has ended and reads only the lines written after its end.
 * - s250-m01: a list can read its end from a field of the subject instead (`endedAt`): the instant another record ended,
 *   as a closure's page reads its grant's end, with the noun that names what ended in the row's sentence.
 */
import { historyAttribution } from './attribution.js';
import { formatPriceAmount } from './billing.js';
import { formatDateTime } from './date-time.js';
import { enumOptionLabel, getStatusPresentation, type StatusDomain } from './status-registry.js';

export type RelatedFinality = 'final' | 'not_final' | 'not_known';
type Scalar = string | number | boolean | null;
type Row = Record<string, unknown>;
/**
 * A row line's item: a field of the source; fixed words shown when its fields hold the given values ({ says, when }); or,
 * s250-m04 (next step 1887, item 4), a field shown except when it holds one of the given values ({ field, except }).
 */
export type RelatedLineItem = string | { says: string; when: Record<string, Scalar> } | { field: string; except: Scalar | Scalar[] } | { field: string; says: string };
/** s250-m01: what a source's `when` asks of a field: this value, no value (null), or any value ({ present: true }). */
export type RelatedWhenValue = Scalar | { present: true };

/** One source of a declared list (OODS Foundry's objects/related-lists.ts says what each key means). */
export interface RelatedListSource {
  from: string | string[];
  via?: string;
  key?: string;
  when?: Record<string, RelatedWhenValue>;
  exclude?: string[];
  states?: string[];
  order?: string;
  inner?: string;
  seat?: string;
  kept?: { name: string; kind?: string };
  row?: { line?: RelatedLineItem[]; time?: string | { field: string; says: string } };
  /** s250-m01: on a source matched by a top-level field, each row carries its record's whole history. */
  lines?: boolean;
}

/** A declared list of the records that point at the subject. */
export interface RelatedList {
  id: string;
  label: string;
  empty?: string;
  /** Said when nothing is listed but records in this seat are in a state the list leaves out; `{count}` is how many. */
  filtered?: { one: string; other: string };
  note?: string;
  /** s249-m03: said with the rows, only when the list lists some: where a row is acted on ("This list does not change grants: revoke one on the grant's own page."). */
  rowsNote?: string;
  collapsed?: boolean;
  afterEnd?: boolean;
  finality?: RelatedFinality[];
  beside?: { field: string; one: string; other: string };
  /**
   * s250-m01: the end this list reads, from a date-time field of the subject, and the noun its rows' sentence names
   * ("grant"); left out, the subject's own end, read from its history and declared order.
   */
  endedAt?: { field: string; noun: string };
  sources: RelatedListSource[];
}

/** What the core knows of one object: its records, its own id, the field that names a record and its declared order. */
export interface RelatedObject {
  name: string;
  records?: ReadonlyArray<Row>;
  key?: string;
  titleField?: string;
  order?: Readonly<Record<string, readonly string[]>>;
  /** Fields that hold an instant, shown as a date and time; `dateOnlyFields` show the date alone. */
  instantFields?: readonly string[];
  dateOnlyFields?: readonly string[];
  /** Display rules for captioned fields that declare a currency on the source object. */
  moneyFields?: Readonly<Record<string, { currencyField: string; minorUnits?: number }>>;
  timeLabels?: Readonly<Record<string, string>>;
  /** The object's name in a sentence: "grant", "grants". */
  noun?: { one: string; other: string };
  /**
   * The status table its records' badges read, as its own record's badge does: the table a billing status field names
   * (a subscription's, an invoice's); left out, the lifecycle table.
   */
  statusDomain?: StatusDomain;
  statusLabels?: Readonly<Record<string, string>>;
}

/** One history line of a related record that names the subject. */
export interface RelatedLine {
  at: string;
  title?: string;
  from?: string | null;
  to?: string;
  reason?: string;
  /** Who acted, for whom, on whose yes, under what grant and task, as every history is printed. */
  attribution?: string;
  /** The line as a page prints it. */
  text: string;
}

/** One row: a record of a source object, or a seat's kept name where no record here matches. */
export interface RelatedRow {
  object: string;
  key?: string;
  title: string;
  state?: string;
  /** The status table the row's badge reads (its object's statusDomain, else the lifecycle table). */
  stateDomain?: StatusDomain;
  stateLabel?: string;
  finality: RelatedFinality;
  /** On a list that reads finality, of an ended subject: the record's state at the subject's end (null: not yet kept). */
  stateAtEnd?: string | null;
  finalityAtEnd?: RelatedFinality;
  /** "When the grant ended: needs input. Now: needs input." */
  atEndText?: string;
  line: string[];
  lineText?: string;
  time?: { field: string; value: string; instant: boolean };
  timeText?: string;
  lines?: RelatedLine[];
  /** "4 lines" */
  linesText?: string;
  inner?: RelatedRow[];
  /** "1 grant inside it" */
  innerText?: string;
  seat?: string;
  kept?: { kind?: string };
  /** What a kept seat is, since no record of it is here. */
  keptText?: string;
}

export interface ResolvedRelatedList {
  id: string;
  /** The declared heading with the subject's name. */
  label: string;
  /** The heading with its count: "Agents holding a grant for Tidewater Co-op (1)". */
  heading: string;
  empty: string;
  /** When nothing is listed but records in this seat are in a state the list leaves out, and the list declares the words. */
  filtered?: string;
  /** How many records in this seat the list's states or finality leave out. */
  leftOut: number;
  note?: string;
  /** What every list cannot see. */
  cannotSee: string;
  /** s250-m05 (the fresh read): a source of this list reads another of the subject's fields through key (a grant's parties),
   * so its cannotSee does not name the subject as the thing named. A page prints, once under the lists it draws, the first
   * keyed list's cannotSee, true of both kinds of list, or else its first list's (component-map.ts, collection-emitter.ts). */
  keyed?: true;
  /** Set by a generated app on a list that reads records it copied from other objects. */
  copied?: string;
  collapsed: boolean;
  applies: boolean;
  rows: RelatedRow[];
  /** "2 more not shown", past the first five rows. */
  more?: string;
  lineCount: number;
  beside?: string;
  endedAt?: string;
  warnings: string[];
}

/** The first rows a list shows; the rest are counted as more in the product. */
export const RELATED_SHOWN_ROWS = 5;
/** The note a generated app's list carries when it reads records copied from other objects. */
export const RELATED_COPIED_NOTE = 'Records of other objects here were copied from the samples when this app was made.';
const HISTORY_PATH = /^state_history\[\]\.([A-Za-z_][A-Za-z0-9_]*)$/;

const present = (value: unknown) => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
const same = (value: unknown, key: string) => present(value) && (Array.isArray(value) ? value.some(item => present(item) && String(item) === key) : String(value) === key);
const instant = (value: unknown) => { const at = Date.parse(String(value)); return Number.isNaN(at) ? undefined : at; };
const names = (from: unknown): string[] => (Array.isArray(from) ? from : [from]).filter((name): name is string => typeof name === 'string');
const plural = (count: number, noun: { one: string; other: string } | undefined, fallback: string) => count === 1 ? noun?.one ?? fallback : noun?.other ?? `${fallback}s`;
const fill = (words: string, name: string) =>
  words.replace(/\{name\}(\.)?/g, (_, stop: string | undefined) => name + (stop && !/[.!?]$/.test(name) ? stop : ''));
/** s250-m01: whether a record's field holds what a source's `when` asks: no value (null), any value, or this value. */
const holds = (record: Row, field: string, value: RelatedWhenValue) => value === null ? !present(record[field])
  : typeof value === 'object' ? present(record[field]) : present(record[field]) && String(record[field]) === String(value);

/**
 * The state's words, from the status table a badge of the same table reads, in sentence case as a record's own list and
 * select write them ("Needs input", never "Needs Input").
 */
export const relatedStateLabel = (state: string, domain: StatusDomain = 'lifecycle') =>
  getStatusPresentation(domain, state).label;

/** A state read against a declared order: final, not final, or not known. */
export function relatedFinality(state: unknown, order: Readonly<Record<string, readonly string[]>> | undefined): RelatedFinality {
  if (!order || typeof state !== 'string' || !Object.hasOwn(order, state)) return 'not_known';
  return order[state]!.length ? 'not_final' : 'final';
}

/** The record's state at an instant, from its history; undefined when its history starts after it or it keeps none. */
export function relatedStateAt(record: Row, at: number): string | undefined {
  let state: string | undefined;
  for (const entry of (Array.isArray(record.state_history) ? record.state_history : []) as Row[]) {
    const when = instant(entry.at);
    if (when === undefined || when > at) continue;
    state = typeof entry.to === 'string' ? entry.to : state;
  }
  return state;
}

/** The instant a record moved into a final state of its declared order, read from its history. */
export function relatedEndedAt(record: Row, order: Readonly<Record<string, readonly string[]>> | undefined): string | undefined {
  if (relatedFinality(record.status, order) !== 'final') return undefined;
  const entry = ((Array.isArray(record.state_history) ? record.state_history : []) as Row[]).find(line => relatedFinality(line.to, order) === 'final');
  const at = entry?.at;
  if (at instanceof Date && Number.isFinite(at.getTime())) return at.toISOString();
  return typeof at === 'string' ? at : undefined;
}

/** A record's display label: the field that names it, else its own id. */
export function relatedTitle(object: RelatedObject, record: Row): string {
  const value = object.titleField ? record[object.titleField] : undefined;
  return String(present(value) ? value : object.key && present(record[object.key]) ? record[object.key] : '');
}

function captionedValue(target: RelatedObject, field: string, record: Row): string {
  const value = record[field];
  const money = target.moneyFields?.[field];
  if (money) {
    const currency = record[money.currencyField];
    if (typeof currency !== 'string' || !/^[a-z]{3}$/i.test(currency)) return 'Currency unavailable';
    if (money.minorUnits) return formatPriceAmount(value, currency, money.minorUnits);
    return typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value) : 'Invalid amount';
  }
  return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 20 }) : String(value);
}

function lineOf(target: RelatedObject, source: RelatedListSource, record: Row): string[] {
  return (source.row?.line ?? []).flatMap(item => {
    if (typeof item === 'string') return present(record[item]) ? [String(record[item])] : [];
    if ('field' in item) {
      const value = record[item.field];
      if ('says' in item) return present(value) ? [`${item.says}: ${captionedValue(target, item.field, record)}`] : [];
      const except = (Array.isArray(item.except) ? item.except : [item.except]).map(String);
      return present(value) && !except.includes(String(value)) ? [String(value)] : [];
    }
    return Object.entries(item.when).every(([field, value]) => value === null ? !present(record[field]) : present(record[field]) && String(record[field]) === String(value)) ? [item.says] : [];
  });
}

function printed(entry: Row): RelatedLine {
  const attribution = historyAttribution(entry)?.text;
  const at = String(entry.at);
  const line: RelatedLine = {
    at,
    ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
    ...(entry.from === null || typeof entry.from === 'string' ? { from: entry.from as string | null } : {}),
    ...(typeof entry.to === 'string' ? { to: entry.to } : {}),
    ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}),
    ...(attribution ? { attribution } : {}),
    text: '',
  };
  line.text = [line.title, formatDateTime(at), attribution, line.reason].filter(part => typeof part === 'string' && part.length > 0).join(' · ');
  return line;
}

const ARTICLE = /^[aeiou]/i;
function keptWords(kind: string | undefined, subject: RelatedObject): string {
  const where = `named on this ${subject.noun?.one ?? 'record'}`;
  const what = kind ? `${ARTICLE.test(kind) ? 'An' : 'A'} ${kind.replace(/_/g, ' ')}, ${where}` : `Named on this ${subject.noun?.one ?? 'record'}`;
  return `${what}; no record of its own is here.`;
}

/**
 * Resolve one declared list for one record of the subject object, from the records of the objects it reads. An object
 * the list names that `objects` does not hold is read as having no records.
 */
export function resolveRelatedListRows(list: RelatedList, subject: RelatedObject, record: Row, objects: Readonly<Record<string, RelatedObject>>): ResolvedRelatedList {
  const name = relatedTitle(subject, record);
  // The subject as a sentence names it ("grant"), for a row read at the subject's end: "When the grant ended: …". s250-m01:
  // a list that reads its end from a field (endedAt) names what ended by its own noun, and reads that instant whatever the
  // subject's own state; a subject holding no instant there is read as not ended.
  const subjectNoun = list.endedAt?.noun ?? subject.noun?.one ?? subject.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const endValue = list.endedAt ? record[list.endedAt.field] : undefined;
  const ended = list.endedAt ? (present(endValue) && instant(endValue) !== undefined ? String(endValue) : undefined) : relatedEndedAt(record, subject.order);
  const end = ended === undefined ? undefined : instant(ended);
  const readsAtEnd = Boolean(list.finality) && end !== undefined;
  const applies = list.afterEnd !== true || ended !== undefined;
  const rows: RelatedRow[] = [];
  const counted = new Set<string>();
  type Ordered = { row: RelatedRow; source: number; order?: unknown; created?: number; position: number };
  const ordered: Ordered[] = [];
  let position = 0;
  let leftOut = 0;
  const seen = new Set<string>();
  const rowOf = (target: RelatedObject, source: RelatedListSource, sample: Row): RelatedRow => {
    const key = target.key && present(sample[target.key]) ? String(sample[target.key]) : undefined;
    const line = lineOf(target, source, sample);
    const domain = target.statusDomain ?? 'lifecycle';
    const stateLabel = (state: string, inSentence = false) => {
      if (target.statusLabels && Object.hasOwn(target.statusLabels, state)) return target.statusLabels[state]!;
      const label = relatedStateLabel(state, domain);
      return inSentence ? label.toLowerCase() : label;
    };
    const row: RelatedRow = {
      object: target.name, ...(key ? { key } : {}), title: relatedTitle(target, sample),
      ...(present(sample.status) ? { state: String(sample.status), stateDomain: domain, stateLabel: stateLabel(String(sample.status)) } : {}),
      finality: relatedFinality(sample.status, target.order), line, ...(line.length ? { lineText: line.join(' · ') } : {}),
      ...(source.seat ? { seat: source.seat } : {}),
    };
    const time = source.row?.time;
    const timeField = typeof time === 'string' ? time : time?.field;
    if (timeField && present(sample[timeField])) {
      const value = String(sample[timeField]);
      const isInstant = Boolean(target.instantFields?.includes(timeField) || target.dateOnlyFields?.includes(timeField));
      row.time = { field: timeField, value, instant: isInstant };
      const caption = typeof time === 'object' ? time.says : target.timeLabels?.[timeField] ?? enumOptionLabel(timeField);
      const shown = isInstant ? formatDateTime(value, { dateOnly: Boolean(target.dateOnlyFields?.includes(timeField)) }) : value;
      row.timeText = `${caption}: ${shown}`;
    }
    if (readsAtEnd) {
      const at = relatedStateAt(sample, end!);
      row.stateAtEnd = at ?? null;
      if (at !== undefined) {
        row.finalityAtEnd = relatedFinality(at, target.order);
        if (row.state) row.atEndText = `When the ${subjectNoun} ended: ${stateLabel(at, true)}. Now: ${stateLabel(row.state, true)}.`;
      }
    }
    return row;
  };
  // s250-m01: a source that reads another field of the subject through `key` (a closure's grant, a grant's parties) matches
  // records by the id that field holds, not by the subject's own, so the list's sentences do not name the subject as the
  // thing named.
  const keyed = list.sources.some(source => source.key !== undefined && source.key !== subject.key);
  const base = {
    id: list.id, label: fill(list.label, name), empty: fill(list.empty ?? (keyed ? 'No record here matches by id.' : `Nothing here names ${name} by id.`), name),
    ...(list.note ? { note: fill(list.note, name) } : {}),
    cannotSee: keyed
      ? 'These lists show only records here, matched by id; records named only in words, or that another product keeps, are not listed.'
      : `These lists show only records here that name ${name} by id; records that hold the name only in words, or that another product keeps, are not listed.`,
    collapsed: list.collapsed === true, applies, ...(keyed ? { keyed: true as const } : {}), ...(ended ? { endedAt: ended } : {}), warnings: [] as string[],
  };
  let beside: string | undefined;
  if (list.beside && present(record[list.beside.field])) {
    const value = record[list.beside.field];
    beside = Number(value) === 1 ? list.beside.one : list.beside.other.replaceAll('{value}', String(value));
  }
  if (applies) list.sources.forEach((source, sourceIndex) => {
    const keyField = source.key ?? subject.key;
    const key = keyField && present(record[keyField]) ? String(record[keyField]) : undefined;
    let matched = false;
    if (key !== undefined) for (const fromName of names(source.from)) {
      const target = objects[fromName];
      if (!target) continue;
      const entryKey = source.via === undefined ? undefined : HISTORY_PATH.exec(source.via)?.[1];
      const via = source.via === undefined ? target.key : source.via;
      if (!via) continue;
      const samples = target.records ?? [];
      for (const sample of samples) {
        let lines: Row[] | undefined;
        if (entryKey !== undefined) {
          lines = ((Array.isArray(sample.state_history) ? sample.state_history : []) as Row[]).filter(entry => same(entry[entryKey], key));
          if (list.afterEnd) lines = lines.filter(entry => { const at = instant(entry.at); return at !== undefined && end !== undefined && at > end; });
          if (!lines.length) continue;
        } else {
          if (!same(sample[via], key)) continue;
          // s250-m01: a source matched by a top-level field carries the record's whole history when it asks (lines), not
          // filtered by time even after an end: a closure's first line is written at the instant its grant ended.
          if (source.lines === true && Array.isArray(sample.state_history)) lines = sample.state_history as Row[];
        }
        if (Object.entries(source.when ?? {}).some(([field, value]) => !holds(sample, field, value))) continue;
        if ((source.exclude ?? []).some(field => same(sample[field], key))) continue;
        const identity = JSON.stringify([fromName, target.key && present(sample[target.key]) ? sample[target.key] : relatedTitle(target, sample), source.seat ?? null]);
        if (source.states && !source.states.includes(String(sample.status))) { if (!counted.has(identity)) { counted.add(identity); leftOut++; } continue; }
        const row = rowOf(target, source, sample);
        if (lines?.length) { row.lines = lines.map(printed); row.linesText = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`; }
        if (list.finality) {
          const read = readsAtEnd ? row.finalityAtEnd : row.finality;
          if (readsAtEnd && row.stateAtEnd === null) continue;
          if (!read || !list.finality.includes(read)) { if (!counted.has(identity)) { counted.add(identity); leftOut++; } continue; }
        }
        if (source.inner) {
          const innerField = source.inner;
          const inner = row.key === undefined ? [] : samples.filter(other => same(other[innerField], row.key!)).map(other => rowOf(target, source, other));
          if (inner.length) { row.inner = inner; row.innerText = `${inner.length} ${plural(inner.length, target.noun, 'record')} inside it`; }
        }
        matched = true;
        if (seen.has(identity)) continue;
        seen.add(identity);
        ordered.push({ row, source: sourceIndex, order: source.order === undefined ? undefined : sample[source.order], created: instant(sample.created_at), position: position++ });
      }
    }
    // A forward lookup whose seat names no record here shows the seat by the name the subject keeps for it.
    if (!matched && source.via === undefined && source.kept && present(record[source.kept.name])) {
      const kind = source.kept.kind && present(record[source.kept.kind]) ? String(record[source.kept.kind]) : undefined;
      ordered.push({ row: { object: names(source.from)[0] ?? '', title: String(record[source.kept.name]), finality: 'not_known', line: [], ...(source.seat ? { seat: source.seat } : {}), kept: kind ? { kind } : {}, keptText: keptWords(kind, subject) }, source: sourceIndex, position: position++ });
    }
  });
  const byOrder = (a: Ordered, b: Ordered) => {
    if (present(a.order) !== present(b.order)) return present(a.order) ? -1 : 1;
    const first = String(a.order ?? ''), second = String(b.order ?? '');
    const left = instant(first), right = instant(second);
    const compared = left !== undefined && right !== undefined ? left - right : first.localeCompare(second);
    if (compared) return compared;
    if ((a.created ?? Infinity) !== (b.created ?? Infinity)) return (a.created ?? Infinity) - (b.created ?? Infinity);
    return a.position - b.position;
  };
  // When any source names an order, the rows are merged by it (a person's waiting asks, by due date), rows with no value
  // there after the rest, then the oldest first. Otherwise the sources follow one another as declared, each as its records
  // are kept.
  if (list.sources.some(source => source.order !== undefined)) ordered.sort(byOrder);
  else ordered.sort((a, b) => a.source - b.source || (list.sources[a.source]!.order !== undefined ? byOrder(a, b) : a.position - b.position));
  rows.push(...ordered.map(item => item.row));
  // Said only where the list declares the words: on a page whose other lists show what this one leaves out, a sentence
  // counting them would only repeat those lists.
  const filtered = !rows.length && leftOut > 0 && list.filtered ? fill(leftOut === 1 ? list.filtered.one : list.filtered.other, name).replaceAll('{count}', String(leftOut)) : undefined;
  // s249-m03: a sentence about acting on the rows is said only when there are rows, after the list's own note.
  const note = rows.length && list.rowsNote ? [base.note, fill(list.rowsNote, name)].filter(Boolean).join(' ') : undefined;
  return {
    ...base, ...(note ? { note } : {}), heading: `${base.label} (${rows.length})`, ...(filtered ? { filtered } : {}), leftOut,
    rows, ...(rows.length > RELATED_SHOWN_ROWS ? { more: `${rows.length - RELATED_SHOWN_ROWS} more not shown` } : {}),
    lineCount: rows.reduce((total, row) => total + (row.lines?.length ?? 0), 0), ...(beside ? { beside } : {}),
  };
}

/** Every declared list of a subject, for one of its records. */
export function resolveRelatedListsRows(lists: readonly RelatedList[], subject: RelatedObject, record: Row, objects: Readonly<Record<string, RelatedObject>>): ResolvedRelatedList[] {
  return lists.map(list => resolveRelatedListRows(list, subject, record, objects));
}
