/**
 * s249-m01: lists declared on the page that shows them. An object can declare, in `metadata.relatedLists`, lists of the
 * records that point at one of its records, so its detail page can list them: an organization's agents and grants, a
 * person's waiting asks, a grant's records. The declaration sits on the subject, the page that shows the list, never on
 * the source as a forward relationship: a declared relationship's `via` becomes a reference select on the source's form
 * (compose/form-detail.ts), so a list declared that way would move the source object's screens. This one moves none.
 *
 * A list has an `id` unique on its object, a `label` (its heading; `{name}` is the subject's display name), and one or
 * more `sources`. Optional on a list: `empty` (the sentence shown when it lists nothing, naming the seat it reads),
 * `filtered` (the sentence shown when it lists nothing but records in its seat are in a state it leaves out: `one` for 1
 * and `other` with `{count}`), `note` (one more sentence on what it cannot see), `rowsNote` (a sentence said with the rows,
 * only when there are some: where a row is acted on), `collapsed` (drawn closed), `afterEnd` (it applies only once the
 * subject has ended, and its history sources read only the lines written after that), `finality` (it keeps only rows
 * read as final, not final or not known: at the subject's end when the subject has ended, else now), `beside` (a
 * sentence shown beside the heading when the subject holds a value in `field`: `one` for 1, `other` with `{value}`) and,
 * s250-m01, `endedAt` (the end `afterEnd` and `finality` read, from a date-time `field` of the subject, the instant another
 * record ended, with the `noun` that names what ended in a row's sentence: "When the grant ended: …"; with it, `afterEnd`
 * needs no declared order of the subject's own, and a subject holding no instant there is read as not ended).
 *
 * Each source names:
 * - `from`: an object, or a list of objects;
 * - `via`: a top-level field of each `from`, or `state_history[].<key>`, where the key is one of the six entry keys
 *   Stateful documents. Left out with `key` set, it is each `from`'s own id: a forward lookup of the record the subject's
 *   `key` field names;
 * - `key`: the subject's field to match, by default its own id;
 * - `when`: equality filters on `from`'s top-level fields (a `null` matches a record that holds no value there, and,
 *   s250-m01, `{ present: true }` one that holds any value), so integer-keyed data cannot list user 42's grants on agent
 *   42's page;
 * - `exclude`: fields that, when they also hold the subject's key, leave the row out;
 * - `states`: states of `from`'s lifecycle;
 * - `order`: a field of `from` to sort by, earliest first (records holding none last, then the oldest first);
 *   by default the records keep the order the source's samples are written in;
 * - `inner`: a field of `from` naming another record of `from`: a record whose `inner` holds a row's own id is shown
 *   under that row (a grant inside another);
 * - `seat` and `kept`: for a forward lookup, the words naming the seat it reads ("Given by"), and the subject's fields
 *   that keep the seat's name and kind, shown when no record here matches (a team that is no sample);
 * - `row`: the row's `line`, fields of `from` (or `{ says, when }`: fixed words shown when the record's fields hold the
 *   given values; or, s250-m04, `{ field, except }`: a field shown except when it holds one of the given values), and its
 *   `time`, one field;
 * - s250-m01, `lines`: on a source matched by a top-level field, each row carries its record's whole history, printed as a
 *   history source's lines are (a source that reads a history already carries the lines that name the subject).
 *
 * Validation follows `listColumns` (tools/object.validate.ts): each `from` is registered, each field exists on its
 * composed `from`, a history key is one of the six, and states belong to `from`'s lifecycle. A malformed declaration is
 * refused there, naming its path. compose/related-records.ts reads the same checks at run time and never refuses: a
 * source that no longer fits (a team's own Grant with no `granted_for_id`) gives a warning and no rows.
 */
import type { FieldDefinition } from './types.js';

/** The history entry keys Stateful documents that point at another record (traits/lifecycle/Stateful.trait.yaml). */
export const HISTORY_KEYS = ['actor_id', 'on_behalf_of_id', 'approved_by_id', 'approval_id', 'grant_id', 'task_id'] as const;
export const FINALITIES = ['final', 'not_final', 'not_known'] as const;
const HISTORY_PATH = /^state_history\[\]\.([A-Za-z_][A-Za-z0-9_]*)$/;
const LIST_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LIST_KEYS = ['id', 'label', 'empty', 'filtered', 'note', 'rowsNote', 'collapsed', 'afterEnd', 'finality', 'beside', 'endedAt', 'sources'];
const SOURCE_KEYS = ['from', 'via', 'key', 'when', 'exclude', 'states', 'order', 'inner', 'seat', 'kept', 'row', 'lines'];
/** s250-m01: the field types that hold an instant, as the resolver reads them (compose/related-records.ts). */
const INSTANT_TYPES = ['datetime', 'timestamp'];

/** What a list's checks need to know of one object: its composed fields, its lifecycle and its own id. */
export type RelatedShape = {
  name: string;
  fields: Record<string, FieldDefinition>;
  /** The lifecycle's states (Stateful's `states` parameter), when it declares one. */
  states?: readonly string[];
  /** The lifecycle's declared order (Stateful's `transitionRules`), when it declares one. */
  order?: Readonly<Record<string, readonly string[]>>;
  /** The field that holds a record's own id (objects/record-identity.ts). */
  key?: string;
};

/** A problem, with the list and source it belongs to and, when it concerns one object a source reads, that object. */
export type RelatedListProblem = { path: string; message: string; list: number; source?: number; from?: string };

/** The history key a `via` reads (`state_history[].grant_id` reads `grant_id`), or undefined for a top-level field. */
export const historyKey = (via: string): string | undefined => HISTORY_PATH.exec(via)?.[1];
export const sourceNames = (from: unknown): string[] => (Array.isArray(from) ? from : [from]).filter((name): name is string => typeof name === 'string');

const isMap = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const scalar = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);
/** s250-m01: `{ present: true }`, a `when` that keeps a record holding any value; a map, since "present" is a value too. */
const anyValue = (value: unknown) => isMap(value) && Object.keys(value).length === 1 && value.present === true;

/**
 * Check `metadata.relatedLists` for one subject. `shape` answers for any object a source names (undefined when it is no
 * registered object); the subject's own shape is passed, so a list may read the subject's own object before it is
 * registered. Each problem names its path and the list, and the source it belongs to, so a reader can drop only that.
 */
export function relatedListProblems(raw: unknown, subject: RelatedShape, shape: (name: string) => RelatedShape | undefined): RelatedListProblem[] {
  if (raw === undefined) return [];
  const problems: RelatedListProblem[] = [];
  const at = 'metadata.relatedLists';
  if (!Array.isArray(raw)) return [{ path: at, message: `${at} must be a list of maps, each with id, label and sources.`, list: -1 }];
  const look = (name: string) => name === subject.name ? subject : shape(name);
  const ids = new Set<string>();
  raw.forEach((entry: unknown, index) => {
    const path = `${at}[${index}]`;
    const fail = (where: string, message: string, source?: number, from?: string) => problems.push({ path: where, message, list: index, ...(source === undefined ? {} : { source }), ...(from === undefined ? {} : { from }) });
    if (!isMap(entry)) { fail(path, `${path} must be a map with id, label and sources.`); return; }
    for (const key of Object.keys(entry)) if (!LIST_KEYS.includes(key)) fail(`${path}.${key}`, `${path}.${key} is not a key a related list takes (${LIST_KEYS.join(', ')}).`);
    if (typeof entry.id !== 'string' || !LIST_ID.test(entry.id)) fail(`${path}.id`, `${path}.id must be lower-case words joined by hyphens ("acting-for").`);
    else if (ids.has(entry.id)) fail(`${path}.id`, `${path}.id "${entry.id}" names another list on ${subject.name} too.`);
    else ids.add(entry.id);
    if (!text(entry.label)) fail(`${path}.label`, `${path}.label must be the list's heading, as text.`);
    for (const key of ['empty', 'note', 'rowsNote'] as const) if (entry[key] !== undefined && !text(entry[key])) fail(`${path}.${key}`, `${path}.${key} must be text.`);
    if (entry.filtered !== undefined && (!isMap(entry.filtered) || !text(entry.filtered.one) || !text(entry.filtered.other))) fail(`${path}.filtered`, `${path}.filtered must be a map with one and other: the words for one record, and for any other count as {count}.`);
    for (const key of ['collapsed', 'afterEnd'] as const) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') fail(`${path}.${key}`, `${path}.${key} must be true or false.`);
    if (entry.afterEnd === true && !subject.order && entry.endedAt === undefined) fail(`${path}.afterEnd`, `${path}.afterEnd needs ${subject.name} to declare its lifecycle's order, which says when it has ended, or the list to read its end from a date-time field (endedAt).`);
    if (entry.endedAt !== undefined) {
      const endedAt = entry.endedAt;
      if (!isMap(endedAt)) fail(`${path}.endedAt`, `${path}.endedAt must be a map with field (a date-time field of ${subject.name} holding the instant the list reads as the end) and noun (the words naming what ended, "grant").`);
      else {
        for (const key of Object.keys(endedAt)) if (!['field', 'noun'].includes(key)) fail(`${path}.endedAt.${key}`, `${path}.endedAt takes field and noun.`);
        const type = typeof endedAt.field === 'string' ? subject.fields[endedAt.field]?.type : undefined;
        if (typeof endedAt.field !== 'string' || !endedAt.field) fail(`${path}.endedAt.field`, `${path}.endedAt.field must name a date-time field of ${subject.name}.`);
        else if (!Object.hasOwn(subject.fields, endedAt.field)) fail(`${path}.endedAt.field`, `${path}.endedAt.field "${endedAt.field}" is not a field of ${subject.name}, including its traits.`);
        else if (!INSTANT_TYPES.includes(String(type ?? '').replace(/\?$/, ''))) fail(`${path}.endedAt.field`, `${path}.endedAt.field "${endedAt.field}" is a ${String(type)} field, and an end is an instant: name a date-time field of ${subject.name}.`);
        if (!text(endedAt.noun)) fail(`${path}.endedAt.noun`, `${path}.endedAt.noun must be the words naming what ended, as a row's sentence says it ("When the grant ended: …").`);
      }
    }
    if (entry.finality !== undefined && (!Array.isArray(entry.finality) || !entry.finality.length || entry.finality.some(value => !(FINALITIES as readonly unknown[]).includes(value)))) {
      fail(`${path}.finality`, `${path}.finality must list some of ${FINALITIES.join(', ')}.`);
    }
    if (entry.beside !== undefined) {
      const beside = entry.beside;
      if (!isMap(beside) || typeof beside.field !== 'string' || !text(beside.one) || !text(beside.other)) fail(`${path}.beside`, `${path}.beside must be a map with field (a field of ${subject.name}), one and other: the words for a value of 1, and for any other value as {value}.`);
      else if (!Object.hasOwn(subject.fields, beside.field)) fail(`${path}.beside.field`, `${path}.beside.field "${beside.field}" is not a field of ${subject.name}, including its traits.`);
    }
    if (!Array.isArray(entry.sources) || !entry.sources.length) { fail(`${path}.sources`, `${path}.sources must list at least one source.`); return; }
    entry.sources.forEach((raw: unknown, sourceIndex) => {
      const where = `${path}.sources[${sourceIndex}]`;
      const problem = (place: string, message: string, from?: string) => fail(place, message, sourceIndex, from);
      if (!isMap(raw)) { problem(where, `${where} must be a source with "from" and "via".`); return; }
      const source = raw;
      for (const key of Object.keys(source)) if (!SOURCE_KEYS.includes(key)) problem(`${where}.${key}`, `${where}.${key} is not a key a source takes (${SOURCE_KEYS.join(', ')}).`);
      const names = sourceNames(source.from);
      if (!names.length || names.length !== (Array.isArray(source.from) ? source.from.length : 1)) { problem(`${where}.from`, `${where}.from must name an object, or a list of objects.`); return; }
      const shapes: RelatedShape[] = [];
      names.forEach((name, nameIndex) => {
        const found = look(name);
        const place = Array.isArray(source.from) ? `${where}.from[${nameIndex}]` : `${where}.from`;
        if (!found) problem(place, `${place} "${name}" is not a registered object. Register that object first.`, name);
        else shapes.push(found);
      });
      const field = (place: string, name: unknown, what: string) => {
        if (typeof name !== 'string' || !name) { problem(place, `${place} must name ${what}.`); return; }
        for (const found of shapes) if (!Object.hasOwn(found.fields, name)) problem(place, `${place} "${name}" is not a field of ${found.name}, including its traits.`, found.name);
      };
      if (source.key !== undefined) {
        if (typeof source.key !== 'string' || !Object.hasOwn(subject.fields, source.key)) problem(`${where}.key`, `${where}.key must name a field of ${subject.name}, including its traits.`);
      } else if (!subject.key) problem(`${where}.key`, `${subject.name} has no field that holds a record's own id, so ${where} must name the field to match as its key.`);
      if (source.via === undefined) {
        if (source.key === undefined) problem(`${where}.via`, `${where}.via must name the field of ${names.join(', ')} that holds the subject's id, or the source must name the subject's field to look up as its key.`);
        for (const found of shapes) if (!found.key) problem(`${where}.via`, `${found.name} has no field that holds a record's own id, so ${where}.via must name the field to match.`, found.name);
      } else if (typeof source.via !== 'string' || !source.via) problem(`${where}.via`, `${where}.via must name a field, or state_history[].<key>.`);
      else {
        const entryKey = historyKey(source.via);
        if (entryKey !== undefined) {
          if (!(HISTORY_KEYS as readonly string[]).includes(entryKey)) problem(`${where}.via`, `${where}.via reads "${entryKey}" in a history entry, which is not one of the entry keys Stateful documents (${HISTORY_KEYS.join(', ')}).`);
          for (const found of shapes) if (!Object.hasOwn(found.fields, 'state_history')) problem(`${where}.via`, `${where}.via reads a history, and ${found.name} keeps none (it composes no lifecycle/Stateful).`, found.name);
        } else if (source.via.includes('[') || source.via.includes('.')) problem(`${where}.via`, `${where}.via "${source.via}" must be a top-level field, or state_history[].<key>.`);
        else field(`${where}.via`, source.via, 'a field');
      }
      if (source.when !== undefined) {
        if (!isMap(source.when)) problem(`${where}.when`, `${where}.when must map fields of ${names.join(', ')} to the values a row holds there.`);
        else for (const [name, value] of Object.entries(source.when)) {
          field(`${where}.when.${name}`, name, 'a field');
          if (!scalar(value) && !anyValue(value)) problem(`${where}.when.${name}`, `${where}.when.${name} must be one value: text, a number, true or false, null for none, or { present: true } for any value.`);
        }
      }
      if (source.exclude !== undefined) {
        if (!Array.isArray(source.exclude)) problem(`${where}.exclude`, `${where}.exclude must list fields.`);
        else source.exclude.forEach((name, item) => field(`${where}.exclude[${item}]`, name, 'a field'));
      }
      if (source.states !== undefined) {
        if (!Array.isArray(source.states) || !source.states.length) problem(`${where}.states`, `${where}.states must list states.`);
        else for (const found of shapes) {
          if (!found.states) { problem(`${where}.states`, `${where}.states: ${found.name} declares no lifecycle states.`, found.name); continue; }
          source.states.forEach((state, item) => {
            if (typeof state !== 'string' || !found.states!.includes(state)) problem(`${where}.states[${item}]`, `${where}.states[${item}] "${String(state)}" is not one of ${found.name}'s states (${found.states!.join(', ')}).`, found.name);
          });
        }
      }
      for (const key of ['order', 'inner'] as const) if (source[key] !== undefined) field(`${where}.${key}`, source[key], 'a field');
      if (source.seat !== undefined && !text(source.seat)) problem(`${where}.seat`, `${where}.seat must be the words naming the seat it reads.`);
      if (source.kept !== undefined) {
        const kept = source.kept;
        if (!isMap(kept) || typeof kept.name !== 'string') problem(`${where}.kept`, `${where}.kept must name the fields of ${subject.name} that keep the seat's name and kind.`);
        else for (const [key, name] of Object.entries(kept)) {
          if (!['name', 'kind'].includes(key)) problem(`${where}.kept.${key}`, `${where}.kept takes name and kind.`);
          else if (typeof name !== 'string' || !Object.hasOwn(subject.fields, name)) problem(`${where}.kept.${key}`, `${where}.kept.${key} must name a field of ${subject.name}, including its traits.`);
        }
      }
      if (source.lines !== undefined) {
        if (typeof source.lines !== 'boolean') problem(`${where}.lines`, `${where}.lines must be true or false.`);
        else if (source.lines && typeof source.via === 'string' && historyKey(source.via) !== undefined) {
          problem(`${where}.lines`, `${where}.lines: this source reads a history (${source.via}), so each row already carries the lines that name the subject. lines is for a source matched by a top-level field.`);
        } else if (source.lines) for (const found of shapes) if (!Object.hasOwn(found.fields, 'state_history')) problem(`${where}.lines`, `${where}.lines reads a history, and ${found.name} keeps none (it composes no lifecycle/Stateful).`, found.name);
      }
      if (source.row !== undefined) {
        const row = source.row;
        if (!isMap(row)) { problem(`${where}.row`, `${where}.row must be a map with line, time or both.`); return; }
        for (const key of Object.keys(row)) if (!['line', 'time'].includes(key)) problem(`${where}.row.${key}`, `${where}.row takes line and time.`);
        if (row.time !== undefined) field(`${where}.row.time`, row.time, 'a field');
        if (row.line !== undefined) {
          if (!Array.isArray(row.line)) problem(`${where}.row.line`, `${where}.row.line must be a list of fields, fields left out for given values ({ field, except }) and fixed words ({ says, when }).`);
          else row.line.forEach((item, position) => {
            const place = `${where}.row.line[${position}]`;
            if (typeof item === 'string') { field(place, item, 'a field'); return; }
            // s250-m04 (next step 1887, item 4): a field shown except when it holds one of the given values.
            if (isMap(item) && 'field' in item) {
              for (const key of Object.keys(item)) if (!['field', 'except'].includes(key)) problem(`${place}.${key}`, `${place} takes field and except.`);
              field(`${place}.field`, item.field, 'a field');
              const except = Array.isArray(item.except) ? item.except : [item.except];
              if (item.except === undefined || !except.length || !except.every(scalar)) problem(`${place}.except`, `${place}.except must be the value, or a list of the values, for which the field is left out of the line.`);
              return;
            }
            if (!isMap(item) || !text(item.says) || !isMap(item.when) || !Object.keys(item.when).length) { problem(place, `${place} must be a field, a field left out for given values ({ field, except }), or fixed words with the values that show them ({ says, when }).`); return; }
            for (const [name, value] of Object.entries(item.when)) {
              field(`${place}.when.${name}`, name, 'a field');
              if (!scalar(value)) problem(`${place}.when.${name}`, `${place}.when.${name} must be one value.`);
            }
          });
        }
      }
    });
  });
  return problems;
}
