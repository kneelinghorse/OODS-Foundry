/**
 * s249-m01, s249-m02: the resolver for lists declared on the page that shows them (objects/related-lists.ts). For one
 * subject record and one of its object's `metadata.relatedLists`, it returns, from each source's samples, the records
 * whose `via` holds the subject's key, filtered, ordered and merged. It sits beside the forward lookup
 * (relationship-options.ts), which reads a target's samples the other way.
 *
 * s249-m02: the rows themselves are worked out by the shared core in @oods/component-contracts (resolveRelatedListRows),
 * which a generated app calls at run time too, so HTML, the standalone screens and the app list the same rows in the same
 * words. This module gives the core the registered objects' samples and shapes, and keeps the one thing the core cannot
 * know: whether a declaration still fits the objects registered now.
 *
 * - **Ids only.** A name never matches: «A UUID name never creates an edge or implies a target.» (objects/relationships.ts).
 * - **It never refuses.** A source that no longer fits its declaration (a team's own Grant with no `granted_for_id`, or
 *   whose lifecycle has no `paused`) gives a warning and no rows for that object only; the subject's other sources and
 *   lists stand.
 *
 * Pure data: it reads the registered objects' samples, as the forward lookup does, and changes nothing.
 */
import {
  RELATED_COPIED_NOTE, relatedEndedAt, relatedFinality, relatedStateAt, resolveRelatedListRows,
  type RelatedFinality, type RelatedLine as CoreLine, type RelatedList as CoreList, type RelatedObject, type RelatedRow as CoreRow, type ResolvedRelatedList as CoreResolved,
} from '@oods/component-contracts';
import { loadObject } from '../objects/object-loader.js';
import { composeObject, type ComposedObject } from '../objects/trait-composer.js';
import { recordKeyField } from '../objects/record-identity.js';
import { historyKey, relatedListProblems, sourceNames, type RelatedShape } from '../objects/related-lists.js';
import type { ObjectDefinition, RelatedList } from '../objects/types.js';
import type { FieldSchemaEntry } from '../schemas/generated.js';
import { recordNameField } from './record-label.js';
import { fieldLabel } from './label-generator.js';
import { declaredMoney } from './declared-money.js';
import { statusTableOf } from './status-table.js';

export type Finality = RelatedFinality;
export type RelatedLine = CoreLine;
export type RelatedRow = CoreRow;
export type ResolvedRelatedList = CoreResolved;
type Row = Record<string, unknown>;

const short = (name: unknown) => String(name).split('/').pop();
const bare = (type: unknown) => String(type ?? '').replace(/\?$/, '');
type Described = { definition: ObjectDefinition; shape: RelatedShape; composed: ComposedObject; object: RelatedObject; labels: Record<string, string> };
const cache = new WeakMap<ObjectDefinition, Omit<Described, 'definition'>>();

/** The shape related-list checks read: the composed fields, the lifecycle's states and declared order, and the own id. */
export function shapeOfDefinition(definition: ObjectDefinition, composed: Pick<ComposedObject, 'schema'>): RelatedShape {
  const lifecycle = definition.traits.find(trait => short(trait.name) === 'Stateful')?.parameters as Record<string, unknown> | undefined;
  const states = Array.isArray(lifecycle?.states) ? lifecycle!.states.map(String) : undefined;
  const rules = lifecycle?.transitionRules;
  const order = rules && typeof rules === 'object' && !Array.isArray(rules)
    ? Object.fromEntries(Object.entries(rules as Record<string, unknown>).map(([from, targets]) => [from, Array.isArray(targets) ? targets.map(String) : []])) : undefined;
  const key = recordKeyField(definition);
  return { name: definition.object.name, fields: composed.schema, ...(states ? { states } : {}), ...(order ? { order } : {}), ...(key ? { key } : {}) };
}

/** What a related list needs to know of a registered object, or undefined when no such object composes. */
function described(name: string): Described | undefined {
  let definition: ObjectDefinition;
  try { definition = loadObject(name); } catch { return undefined; }
  let known = cache.get(definition);
  if (!known) {
    let composed: ComposedObject;
    try { composed = composeObject(definition); } catch { return undefined; }
    // The field entries the record-naming rule reads (compose/record-label.ts), from the composed object.
    const fields = Object.fromEntries(Object.entries(composed.schema).map(([field, entry]) => [field, {
      type: entry.type, required: entry.required, ...(Array.isArray(entry.validation?.enum) ? { enum: entry.validation!.enum!.map(String) } : {}),
      ...(composed.semantics[field]?.semantic_type ? { semanticType: composed.semantics[field]!.semantic_type } : {}),
    } as FieldSchemaEntry]));
    const shape = shapeOfDefinition(definition, composed);
    const noun = fieldLabel(definition.object.name).toLowerCase();
    const titleField = recordNameField(definition.object.name, fields);
    const instantFields = Object.keys(composed.schema).filter(field => ['datetime', 'timestamp'].includes(bare(composed.schema[field]!.type)));
    const dateOnlyFields = Object.keys(composed.schema).filter(field => bare(composed.schema[field]!.type) === 'date');
    // The table its rows' badges read, as its own record's badge reads it (compose/status-table.ts); the lifecycle table is
    // the core's default, so it is named only when it is another.
    const statusDomain = statusTableOf(fields.status?.semanticType);
    const statusLabels = composed.semantics.status?.ui_hints?.enumLabels;
    const labels = Object.fromEntries(Object.keys(fields).map(field => {
      const label = composed.semantics[field]?.ui_hints?.label;
      return [field, typeof label === 'string' ? label : fieldLabel(field)];
    }));
    known = { shape, composed, labels, object: {
      name: definition.object.name, ...(shape.key ? { key: shape.key } : {}), ...(titleField ? { titleField } : {}), ...(shape.order ? { order: shape.order } : {}),
      ...(statusLabels && typeof statusLabels === 'object' && !Array.isArray(statusLabels) ? { statusLabels } : {}),
      instantFields, dateOnlyFields, noun: { one: noun, other: `${noun}s` }, ...(statusDomain !== 'lifecycle' ? { statusDomain } : {}),
    } };
    cache.set(definition, known);
  }
  return { definition, ...known };
}

/** The shape related-list checks read for a registered object (tools/object.validate.ts uses it too). */
export const relatedShape = (name: string): RelatedShape | undefined => described(name)?.shape;

/** A state read against a declared order: final, not final, or not known. */
export const finalityOf = relatedFinality;
/** The record's state at an instant, from its history; undefined when its history starts after it or it keeps none. */
export const stateAt = relatedStateAt;
/** The instant a record moved into a final state of its declared order, read from its history. */
export const endedAt = relatedEndedAt;

/**
 * The declaration as it can be read now: each source with only the objects that fit it, and the warnings for what was
 * left out. A list whose own shape does not fit (no label, two ids) is left out whole.
 */
function usable(subjectName: string, subject: Described, list: RelatedList, index: number): { list?: RelatedList; warnings: string[] } {
  const warnings: string[] = [];
  const where = (message: string) => message.replace('metadata.relatedLists[0]', `metadata.relatedLists[${index}]`);
  const problems = relatedListProblems([list], subject.shape, relatedShape);
  const listProblems = problems.filter(problem => problem.source === undefined);
  if (listProblems.length) {
    for (const problem of listProblems) warnings.push(`${subjectName}'s list "${list.id}" lists nothing: ${where(problem.message)}`);
    return { warnings };
  }
  const sources = list.sources.flatMap(source => {
    // A problem with one object a source reads leaves out only that object; any other leaves out the source.
    const index = list.sources.indexOf(source);
    const broken = problems.filter(problem => problem.source === index);
    const left = new Set(broken.flatMap(problem => problem.from === undefined ? sourceNames(source.from) : [problem.from]));
    for (const problem of broken) warnings.push(`${subjectName}'s list "${list.id}" leaves out ${problem.from ?? sourceNames(source.from).join(', ')}: ${where(problem.message)}`);
    const kept = sourceNames(source.from).filter(name => !left.has(name));
    if (!kept.length) return [];
    return [{ ...source, from: Array.isArray(source.from) ? kept : kept[0]! }];
  });
  return { list: { ...list, sources }, warnings };
}

/* Keep only labels a related row reads in the generated app's data. */
function withRowDisplay(target: Described, lists: readonly RelatedList[]): RelatedObject {
  const timeLabels: Record<string, string> = {};
  const moneyFields: Record<string, { currencyField: string; minorUnits?: number }> = {};
  for (const list of lists) for (const source of list.sources) {
    if (!sourceNames(source.from).includes(target.object.name)) continue;
    const time = source.row?.time;
    if (typeof time === 'string') timeLabels[time] = target.labels[time]!;
    for (const item of source.row?.line ?? []) {
      if (typeof item === 'string' || !('says' in item) || !('field' in item)) continue;
      const { schema, semantics, traits } = target.composed;
      const owner = traits.find(trait => trait.definition.schema[item.field] === schema[item.field]);
      const money = declaredMoney(item.field, schema, semantics, traits, owner);
      if (money?.currencyField) moneyFields[item.field] = { currencyField: money.currencyField, minorUnits: money.minorUnits };
    }
  }
  return { ...target.object, ...(Object.keys(timeLabels).length ? { timeLabels } : {}), ...(Object.keys(moneyFields).length ? { moneyFields } : {}) };
}

/** Resolve one declared list for one record of the subject object. */
export function resolveRelatedList(subjectName: string, record: Row, list: RelatedList, index = 0): ResolvedRelatedList {
  const subject = described(subjectName);
  if (!subject) {
    const empty = resolveRelatedListRows({ ...list, sources: [] } as CoreList, { name: subjectName }, record, {});
    return { ...empty, warnings: [`${subjectName} is no registered object, so its list "${list.id}" lists nothing.`] };
  }
  const { list: fit, warnings } = usable(subjectName, subject, list, index);
  const objects: Record<string, RelatedObject> = {};
  for (const source of fit?.sources ?? []) for (const from of sourceNames(source.from)) {
    const found = described(from);
    if (found) objects[from] = { ...withRowDisplay(found, [fit!]), records: (found.definition.samples ?? []) as Row[] };
  }
  const resolved = resolveRelatedListRows((fit ?? { ...list, sources: [] }) as CoreList, subject.object, record, objects);
  return { ...resolved, warnings };
}

/** Resolve every list an object declares, for one of its records. */
export function resolveRelatedLists(subjectName: string, record: Row): ResolvedRelatedList[] {
  let lists: RelatedList[] = [];
  try { lists = (loadObject(subjectName).metadata?.relatedLists ?? []) as RelatedList[]; } catch { return []; }
  return lists.map((list, index) => resolveRelatedList(subjectName, record, list, index));
}

/** Every warning an object's lists give now (the declarations that no longer fit the registered objects). */
export function relatedListWarnings(subjectName: string): string[] {
  const subject = described(subjectName);
  if (!subject) return [];
  return ((subject.definition.metadata?.relatedLists ?? []) as RelatedList[]).flatMap((list, index) => usable(subjectName, subject, list, index).warnings);
}

/** The fields a generated app copies from an object's samples: those its lists read, and what a row shows. */
function copiedFields(object: RelatedObject, lists: readonly RelatedList[], from: string): string[] {
  const fields = new Set<string>(['status', 'created_at', ...(object.key ? [object.key] : []), ...(object.titleField ? [object.titleField] : [])]);
  for (const list of lists) for (const source of list.sources) {
    if (!sourceNames(source.from).includes(from)) continue;
    if (source.via && !historyKey(source.via)) fields.add(source.via);
    // s250-m01: a source that carries its records' whole history (lines) copies it too.
    if ((source.via && historyKey(source.via)) || source.lines || list.finality || list.afterEnd) fields.add('state_history');
    for (const field of [...Object.keys(source.when ?? {}), ...(source.exclude ?? []), source.order, source.inner, typeof source.row?.time === 'string' ? source.row.time : source.row?.time?.field]) if (field) fields.add(field);
    for (const item of source.row?.line ?? []) {
      if (typeof item === 'string') fields.add(item);
      else if ('field' in item) fields.add(item.field);
      else for (const field of Object.keys(item.when)) fields.add(field);
    }
  }
  for (const money of Object.values(object.moneyFields ?? {})) fields.add(money.currencyField);
  return [...fields];
}

/**
 * s249-m02: what a generated app needs to list its records' related records at run time (Interface 5): the declarations
 * as they fit now, the object's own shape (its records are the app's live store), and, for every other object a list
 * reads, its records copied from the samples with only the fields the lists read. A list that reads only the app's own
 * object (a grant's "Grants inside it") reads the live store; one that reads another object carries the copied note.
 */
export function relatedAppData(subjectName: string): { lists: RelatedList[]; own: RelatedObject; objects: Record<string, RelatedObject>; copied: Record<string, string> } | undefined {
  const subject = described(subjectName);
  const declared = (subject?.definition.metadata?.relatedLists ?? []) as RelatedList[];
  if (!subject || !declared.length) return undefined;
  const lists = declared.flatMap((list, index) => usable(subjectName, subject, list, index).list ?? []);
  const objects: Record<string, RelatedObject> = {};
  const copied: Record<string, string> = {};
  for (const list of lists) {
    const others = list.sources.flatMap(source => sourceNames(source.from)).filter(from => from !== subject.object.name);
    if (others.length) copied[list.id] = RELATED_COPIED_NOTE;
    for (const from of others) {
      if (objects[from]) continue;
      const found = described(from);
      if (!found) continue;
      const shape = withRowDisplay(found, lists);
      const fields = copiedFields(shape, lists, from);
      const records = ((found.definition.samples ?? []) as Row[]).map(sample => Object.fromEntries(fields.filter(field => Object.hasOwn(sample, field)).map(field => [field, structuredClone(sample[field])])));
      objects[from] = { ...shape, records };
    }
  }
  return { lists, own: withRowDisplay(subject, lists), objects, copied };
}
