import { recordEventAliases } from './collection-emitter.js';
import { chartNodes } from './chart-declaration.js';
import { VIZ_SVG_PROPS } from '@oods/component-contracts';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../schemas/generated.js';
import { displayFieldExpression, mapFieldType, snakeToCamel } from './binding-utils.js';
import { fieldLabel } from '../compose/label-generator.js';
import { recordTitleField } from '../compose/record-label.js';
import { recordDisplayValue } from '../compose/record-display.js';
import { cancellableStates, cancellationMode } from '../objects/cancellation-mode.js';
import { declaredCancelOrder } from '../objects/declared-order.js';
import { relatedAppData } from '../compose/related-records.js';
import { enumOptionLabel } from '../compose/internal-fields.js';
import { loadObject } from '../objects/object-loader.js';
import { declaredActions, declaredOrder, endsRecord } from '../objects/state-actions.js';

/** The chart-assets.ts export holding one render prop's SVG per record: svg -> chartSvgByRecord (as chart-assets.ts writes it). */
const chartAssetMap = (prop: string): string => `chart${prop[0]!.toUpperCase()}${prop.slice(1)}ByRecord`;

/** One deterministic preview policy. Authored examples/defaults and enums own domain values. */
/** A stable rotation for a seed string: the same seed always rotates the sample lists the same way; no seed leaves them as authored. */
export function sampleSeedRotation(seed: string | undefined): number {
  if (!seed) return 0;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 1 + (hash % 9);
}

/** Neutral values carry type, never a guessed address, price, person or lifecycle history. */
export function neutralFieldValue(field: FieldSchemaEntry): unknown {
  if (field.unavailable) return undefined;
  if (field.type.endsWith('?')) return null;
  const type = field.type;
  if (type.endsWith('[]') || type === 'array') return [];
  if (type === 'object' || type.startsWith('Record<') || /^[A-Z]/.test(type)) return {};
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  // An empty date renders as not recorded; the epoch invents a historical event.
  if (type === 'date' || type === 'datetime') return field.required ? '' : undefined;
  if (type === 'uuid') return field.required ? '' : undefined;
  // s245-m02: an optional enum a record leaves out is not recorded; an empty string is no member of it (a waiting
  // approval has no answerer, so no answerer's kind).
  if (field.enum?.length && !field.required) return undefined;
  return '';
}

/**
 * s255-m02/m04: a fact only its product can report (core/Remembered's, semantic type remembered.*), or a field that says
 * in words that a value is not held (a label keyed ''): a preview never fills it from an enum or another record, so a
 * memory whose store does not say how it was made reads "Not known", never one of the five.
 */
export const reportedField = (field: FieldSchemaEntry) => /^remembered\./.test(field.semanticType ?? '') || Boolean(field.valueLabels && Object.hasOwn(field.valueLabels, ''));

export function workflowSampleData(schema: UiSchema): { records: Array<Record<string, unknown>>; seedTable: Array<{ recordId: string; field: string; value: unknown; rule: string }> } {
  const fields = schema.objectSchema ?? {};
  const idField = schema.workflow?.data.idField ?? Object.keys(fields).find(name => name.endsWith('_id')) ?? 'id';
  const sampleCount = schema.workflow?.data.sampleCount ?? 1;
  const charts = chartNodes(schema.screens).map(node => node.chart!);
  const rotation = sampleSeedRotation(schema.seed);
  const seedTable: Array<{ recordId: string; field: string; value: unknown; rule: string }> = [];
  const records = Array.from({ length: sampleCount }, (_, index) => {
    const rules: Record<string, string> = {};
    const record = Object.fromEntries(Object.entries(fields).map(([name, field]) => {
      const value = (result: unknown, rule: string) => { rules[name] = rule; return [name, structuredClone(result)]; };
      if (field.unavailable) return value(undefined, 'unavailable: the object data contract never supplies it');
      // Keys must stay distinct so editing one preview record cannot silently edit another. s222-m03 (#2502 ruling 14):
      // authored keys are used only when every one is present and distinct (samples that name an id for some records only
      // leave the others empty).
      const keys = field.examples ?? [];
      const keyType = field.type.replace(/\?$/, '');
      // Objects without an identifier can nominate their first field as a fallback. Never turn a
      // boolean, array or document into a string key: its authored value still owns the field.
      if (name === idField && ['string', 'uuid', 'integer', 'number'].includes(keyType) && (keys.length < sampleCount || keys.some(key => key == null || key === '') || new Set(keys.map(String)).size < keys.length)) {
        return value(keyType === 'uuid' ? `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` : ['integer', 'number'].includes(keyType) ? index + 1 : `sample-${index + 1}`, 'neutral unique preview record key');
      }
      if (field.examples?.length) {
        const example = field.examples[(index + rotation) % field.examples.length];
        return value(example === null && !field.required && !field.type.endsWith('?') ? undefined : example, 'authored field example');
      }
      const chart = charts.find(chart => (chart.source === 'record-array' || chart.source === 'edge-array') && chart.dataField === name);
      if (chart?.source === 'record-array' || chart?.source === 'edge-array') return value(chart.sampleRows, 'authored chart rows');
      if (field.enum?.length && !reportedField(field)) return value(field.enum[(index + rotation) % field.enum.length], 'declared field enum');
      if (field.default !== undefined) return value(field.default, 'declared field or trait parameter default');
      return value(neutralFieldValue(field), 'neutral typed value; no authored example or default');
    }));
    if (charts.some(chart => chart.source === 'payment-events') && !Object.hasOwn(record, 'payment_history')) {
      record.payment_history = [];
      rules.payment_history = 'empty history: no authored payment records';
    }
    for (const [field, value] of Object.entries(record)) seedTable.push({ recordId: String(record[idField] ?? index + 1), field, value: structuredClone(value), rule: rules[field]! });
    return record;
  });
  return { records, seedTable };
}

export function workflowSampleRecords(schema: UiSchema): Array<Record<string, unknown>> {
  return workflowSampleData(schema).records;
}

/**
 * s213-m01 (Sprint 212 review finding 1, learning #722): the field a list is ordered by before anyone sorts — the field
 * its sort control names ("Name A–Z"), else the record title. The generated store and a standalone list preview both
 * order by it, so the rows are always in the order the control states. Decision's control names its text while its
 * title is its id, and the store sorted by the id under a "Name A–Z" label.
 */
export function statedListSortField(schema: UiSchema, titleField: string): string {
  const nodes = (elements: UiElement[]): UiElement[] => elements.flatMap(node => [node, ...nodes(node.children ?? [])]);
  const field = nodes(schema.screens).find(node => node.collectionControl === 'sort')?.props?.field;
  return typeof field === 'string' && Object.hasOwn(schema.objectSchema ?? {}, field) ? field : titleField;
}

/** Records in the stated order, ascending, compared exactly as the generated store compares them (a stable sort). */
export function sortRecordsAsStated<T extends Record<string, unknown>>(records: readonly T[], field: string, fields: Record<string, FieldSchemaEntry>): T[] {
  const shown = (record: T) => fields[field]?.titleReferences?.length || fields[field]?.displayFallbackField
    ? recordDisplayValue(field, fields, name => record[name]) : record[field];
  return [...records].sort((a, b) => {
    const left = shown(a), right = shown(b);
    return typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
  });
}

/**
 * The seed record a standalone screen's preview shows: the third live record, else the first (the design loop's seed
 * policy). s211-m02: the preview model and the chart a standalone screen bakes both take it, so the chart draws the
 * record on the page; it drew the first sample's payments beside the third record's price.
 */
export function shownSampleRecord(records: ReadonlyArray<Record<string, unknown>>): Record<string, unknown> | undefined {
  const live = records.filter(record => !record.is_archived);
  return live[2] ?? live[0];
}

export function workflowDataFiles(schema: UiSchema): Array<{ path: string; contents: string }> {
  const workflow = schema.workflow!;
  const fields = schema.objectSchema!;
  const { idField } = workflow.data;
  const aliases = recordEventAliases(fields);
  const statusField = Object.keys(fields).find(field => fields[field].semanticType === 'status.state') ?? 'status';
  const updatedField = aliases.updated_at ?? 'updated_at';
  const titleField = recordTitleField(workflow.object, fields, idField);
  const sortField = statedListSortField(schema, titleField);
  const records = workflowSampleRecords(schema);
  const nodes = (elements: UiElement[]): UiElement[] => elements.flatMap(node => [node, ...nodes(node.children ?? [])]);
  const declaredFilter = nodes(schema.screens).find(node => node.collectionControl === 'filter')?.props?.field;
  const filterField = typeof declaredFilter === 'string' && Object.hasOwn(fields, declaredFilter) ? declaredFilter : 'status';
  const eventNames = workflow.data.recordedEvents?.length ? workflow.data.recordedEvents : fields.last_event?.enum?.map(String) ?? [];
  // s220-m01 (#2458): a cancellation is the record's last event when its vocabulary names one (Subscription's
  // cancellation_requested); an edited, cancelled Subscription read "Last event: Payment received" a month earlier.
  const cancelEvent = fields.last_event && !fields.last_event.unavailable ? eventNames.find(event => /cancel/.test(event)) : undefined;
  // s247-m01: an object that composes Cancellable and declares the order of its states is cancelled only from a state the
  // order lets move to where cancelling goes, as its detail's action bar offers it (cancellableStates, declared-order.ts).
  const cancelOrder = declaredCancelOrder(workflow.object);
  const cancelFrom = cancelOrder ? cancellableStates(workflow.data.lifecycleStates, cancelOrder) : undefined;
  const timeline = schema.screens.find(node => node.id === workflow.screens.find(screen => screen.context === 'timeline')?.id);
  const timelineNodes = nodes(timeline ? [timeline] : []);
  const eventCollection = timelineNodes.find(node => node.collection?.source === 'events')?.collection;
  const payment = timelineNodes.find(node => node.component === 'PaymentEventTimeline');
  const paymentSources = payment ? [
    { field: payment.props?.lastPaymentField, title: 'Last payment' },
    { field: payment.props?.nextPaymentField, title: 'Next payment' },
  ].filter(source => typeof source.field === 'string') : [];
  // s220-m01 (#2461, #2458): a record billed on a Billable cycle reconciles that cycle when its terms change.
  const billingCycle = ['billing_interval', 'current_period_start', 'current_period_end'].every(name => fields[name] && !fields[name]!.unavailable);
  const types = Object.entries(fields).map(([name, field]) => `  ${JSON.stringify(name)}${field.required ? '' : '?'}: ${mapFieldType(field)};`).join('\n');
  // s249-m02 (Interface 5): an object that declares related lists lists its records' related records at run time, from
  // records copied from the other objects' samples and the app's own live records (relatedAppData).
  const related = relatedAppData(workflow.object);
  // s249-m03 (Interfaces 6, 8 and 10): an object whose lifecycle declares an order (Approval, Task, Grant) keeps it in its
  // store; one that declares actions (a grant's Revoke, Pause and Resume) takes each through transition, as one change.
  // Every store signs the lines it writes with the actor it was told of, and only then.
  const definition = (() => { try { return loadObject(workflow.object); } catch { return undefined; } })();
  const order = definition ? declaredOrder(definition) : undefined;
  const stateActions = order && definition ? declaredActions(definition) : [];
  const stateWords = { object: workflow.object.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(), labels: Object.fromEntries(Object.keys(order ?? {}).map(state => [state, enumOptionLabel(state, fields[statusField]?.enumLabels)])) };
  const seatFields = (seat: string | undefined) => seat ? ['_id', '_name', '_kind'].map(suffix => seat + suffix).filter(name => Object.hasOwn(fields, name)) : [];
  const locked = order ? [...new Set(stateActions.filter(action => endsRecord(action, order)).flatMap(action => [...(action.reasonField && Object.hasOwn(fields, action.reasonField) ? [action.reasonField] : []), ...seatFields(action.bySeat)]))] : [];
  const mandate = workflow.data.traits.some(trait => trait.split('/').pop() === 'Mandate');
  const status = (target: string) => `${target}${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`}`;
  const camelProps = Object.keys(fields).map((name) => `  ${snakeToCamel(name)}: record[${JSON.stringify(name)}],`).join('\n');
  return [
    { path: 'src/sample-data.ts', contents: `import type { DomainRecord } from './store';\n\nexport const sampleData: DomainRecord[] = ${JSON.stringify(records, null, 2)};\n` },
    ...(related ? [{ path: 'src/related-data.ts', contents: relatedDataFile(related) }] : []),
    { path: 'src/store.ts', contents: `import { enumOptionLabel, recordCollectionEvents, recordMatchesSearch, ${billingCycle ? 'restartedBillingPeriod, ' : ''}${order ? `${stateActions.length ? 'declaredActionRefusal, ' : ''}declaredMoveRefusal, isFinalState, ` : ''}type CollectionEvent${order ? ', type DeclaredStateOrder' : ''} } from '@oods/component-contracts';
import { sampleData } from './sample-data';${related ? `
import { resolveRelatedListRows, type ResolvedRelatedList } from '@oods/component-contracts';
import { relatedCopied, relatedLists, relatedObjects, relatedOwn } from './related-data';` : ''}
${chartNodes(schema.screens).length ? `import { ${VIZ_SVG_PROPS.map(chartAssetMap).join(', ')} } from './chart-assets';` : ''}

export type DomainRecord = {
${types}
${chartNodes(schema.screens).some(node => node.chart?.source === 'payment-events') && !fields.payment_history ? '  payment_history: Array<{ at: string; amount: number }>;\n' : ''}};
${Object.values(fields).some(field => field.type === 'AddressableEntry[]') ? `
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function collectionAddressIndex(entries: unknown[] | undefined, role?: string): number {
  const index = entries?.findIndex(value => asRecord(value).role === role) ?? -1;
  return index >= 0 ? index : entries?.length ? 0 : -1;
}
export function collectionAddress(entries: unknown[] | undefined, role?: string) {
  const entry = asRecord(entries?.[collectionAddressIndex(entries, role)]);
  const address = asRecord(entry.address);
  return { street: Array.isArray(address.addressLines) ? address.addressLines.map(String).join(', ') : '', city: String(address.locality ?? ''), region: String(address.administrativeArea ?? ''), postalCode: String(address.postalCode ?? '') };
}
export function collectionSummary(entries: unknown[] | undefined): string {
  return (entries ?? []).map(entry => { const address = collectionAddress([entry]); return [asRecord(entry).role, address.street, address.city, address.region, address.postalCode].filter(Boolean).join(', '); }).join('; ');
}
` : ''}
export const idField = ${JSON.stringify(idField)} as const;
export const titleField = ${JSON.stringify(titleField)} as const;
export const sortField = ${JSON.stringify(sortField)} as const;
export const fieldLabels: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(fields).map(([name, entry]) => [name, entry.displayLabel ?? fieldLabel(name)])))};
export const fieldTypes: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.type])))};
export const traits: readonly string[] = ${JSON.stringify(workflow.data.traits.map((name) => name.split('/').pop()))};
/** Who is acting, when the app is told: the store signs each line it writes with them${stateActions.some(action => action.bySeat) ? ', and a declared action names them in its seat' : ''}. Not a viewer: nothing is shown or hidden by it. */
export interface StoreActor { id: string; name: string; kind: 'person' | 'agent' | 'system' }
export interface StoreOptions { empty?: boolean; fail?: boolean; latency?: number; now?: () => string; seed?: DomainRecord[]; actor?: StoreActor }
export interface ListQuery { search?: string; status?: string; archived?: boolean; sort?: keyof DomainRecord; descending?: boolean; page?: number; pageSize?: number }
export interface HistoryEntry { title?: string; from: string | null; to: string; at: string; reason: string; code?: string; atPeriodEnd?: boolean; actor_id?: string; actor_name?: string; actor_kind?: string }${order ? `
/** The order this object declares for its states (Stateful's transitionRules): the store refuses any other move, and any move out of a final state. */
export const stateOrder: DeclaredStateOrder = ${JSON.stringify(order)};
const stateWords: { object: string; labels: Record<string, string> } = ${JSON.stringify(stateWords)};` : ''}${stateActions.length ? `
/** The moves a person makes on a record (Stateful's actions), each written by transition as one change. */
export interface StateAction { id: string; to: string; from: readonly string[]; verb: string; event: string; reasonField?: string; bySeat?: string; confirm: boolean; alsoEnds?: { via: string } }
export const stateActions: readonly StateAction[] = ${JSON.stringify(stateActions)};
/** What a declared action would move and leave, for the confirmation that asks first: it is worked out from the records here. */
export interface ActionPreview { name: string; endsWith: string[]; notEnded: string[]; underWay: Array<{ title: string; state: string }>; leftRunning: Array<{ title: string; state: string }>; actor?: StoreActor }` : ''}
export function screenProps(record: DomainRecord) {
  return {
${camelProps}
${chartNodes(schema.screens).length ? VIZ_SVG_PROPS.map(prop => `  ${prop}: ${chartAssetMap(prop)}[String(record[idField])],`).join('\n') : ''}
  };
}
export function history(record: DomainRecord): HistoryEntry[] {
  const value = (record as Record<string, unknown>).state_history;
  return Array.isArray(value) ? value.filter((entry): entry is HistoryEntry => !!entry && typeof entry === 'object' && typeof entry.to === 'string' && typeof entry.at === 'string') : [];
}
${related ? `/**
 * The record's related lists (metadata.relatedLists), worked out by the same core HTML and the standalone screens use.
 * Records of other objects come from related-data.ts, copied from the samples when this app was made; the app's own
 * records are the store's, so a change made here shows on the page that lists it. Replace this with your own query.
 */
export function relatedRows(record: DomainRecord, records: readonly DomainRecord[]): ResolvedRelatedList[] {
  const objects = { ...relatedObjects, [relatedOwn.name]: { ...relatedOwn, records: records as unknown as Array<Record<string, unknown>> } };
  return relatedLists.map((list) => ({ ...resolveRelatedListRows(list, relatedOwn, record as unknown as Record<string, unknown>, objects), ...(relatedCopied[list.id] ? { copied: relatedCopied[list.id] } : {}) }));
}
` : ''}export function collectionEvents(record: DomainRecord): CollectionEvent[] {
  return recordCollectionEvents(${Object.keys(aliases).length ? `{ ...record, ${Object.entries(aliases).map(([canonical, source]) => `${JSON.stringify(canonical)}: (record as Record<string, unknown>)[${JSON.stringify(source)}]`).join(', ')} }` : 'record'}, ${JSON.stringify({ historyField: eventCollection?.historyField, payments: paymentSources, minorUnits: workflow.data.minorUnits })});
}
export function createStore(options: StoreOptions = {}) {
  let records = structuredClone(options.seed ?? (options.empty ? [] : sampleData));
  let fail = options.fail ?? false;
  const now = options.now ?? (() => new Date().toISOString());
  // s249-m03 (Interface 8): told who is acting, the store signs every line it writes with them; told no one, a line names no one.
  const signature: Pick<HistoryEntry, 'actor_id' | 'actor_name' | 'actor_kind'> = options.actor ? { actor_id: options.actor.id, actor_name: options.actor.name, actor_kind: options.actor.kind } : {};
  const requireTrait = (trait: string) => { if (!traits.includes(trait)) throw new Error('Object does not support ' + trait); };
  const get = (id: string) => {
    const record = records.find((entry) => String(entry[idField]) === id);
    if (!record) throw new Error('Record not found: ' + id);
    return structuredClone(record);
  };
  const save = (record: DomainRecord) => {
    const index = records.findIndex((entry) => entry[idField] === record[idField]);
    if (index < 0) throw new Error('Cannot save a missing record');
    records[index] = structuredClone(record);
    return get(String(record[idField]));
  };
  // A saved edit is history: the record's state history gains an entry naming the changed fields.
  const update = (record: DomainRecord${stateActions.length ? ', note?: string): DomainRecord' : ')'} => {
    const previous = records.find((entry) => entry[idField] === record[idField]);
    if (!previous) throw new Error('Cannot save a missing record');
    const values = record as Record<string, unknown>;
    const before = previous as Record<string, unknown>;
    const changed = Object.keys(values).filter((name) => Object.hasOwn(fieldTypes, name) && name !== 'state_history' && name !== ${JSON.stringify(updatedField)} && JSON.stringify(values[name]) !== JSON.stringify(before[name]));
    if (changed.length === 0) return save(record);${order ? `
    // s249-m03 (Interface 10): the declared order is kept. A move it does not allow and any move out of a final state are
    // refused${locked.length ? ', and so is a change to how a final record ended' : ''}.
    const moving = changed.includes(${JSON.stringify(statusField)});
    if (moving) { const refusal = declaredMoveRefusal(stateOrder, ${status('before')}, ${status('values')}, stateWords); if (refusal) throw new Error(refusal); }${locked.length ? `
    if (isFinalState(stateOrder, ${status('before')}) && changed.some((name) => (${JSON.stringify(locked)} as readonly string[]).includes(name))) throw new Error("This ${stateWords.object}'s status is " + ((label) => label.charAt(0).toUpperCase() + label.slice(1))(String(stateWords.labels[String(${status('before')})] ?? ${status('before')}).replace(/[_-]+/g, ' ').toLowerCase()) + ', and how it ended stays as it was recorded.');` : ''}${stateActions.length ? `
    // A saved move that a declared action makes is that action, written as its button writes it (transition); any other
    // change the form made saves first, as an edit.
    const action = moving ? stateActions.find((entry) => entry.to === String(${status('values')}) && entry.from.includes(String(${status('before')}))) : undefined;
    if (action) {
      const typed = action.reasonField && changed.includes(action.reasonField) ? String(values[action.reasonField] ?? '') : undefined;
      update({ ...values, [${JSON.stringify(statusField)}]: ${status('before')}, ...(action.reasonField ? { [action.reasonField]: before[action.reasonField] } : {}) } as DomainRecord);
      return transition(String(values[idField]), action.id, note ?? typed);
    }` : ''}` : ''}
    const at = now();
    const next = structuredClone(record);
    const target = next as Record<string, unknown>;
    if (Object.hasOwn(fieldTypes, ${JSON.stringify(updatedField)})) target[${JSON.stringify(updatedField)}] = at;${billingCycle ? `
    // Billable's billing-anchor reset: new terms (price, currency or interval) on an active record start a new billing
    // period now, its payment due and pending. A period field the edit itself set is kept. Recorded payments are history:
    // they keep the currency they were paid in.
    const restarted = changed.some((name) => name === 'amount' || name === 'currency' || name === 'billing_interval') && target${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} === 'active';
    if (restarted) for (const [name, value] of Object.entries(restartedBillingPeriod(at, typeof target.billing_interval === 'string' ? target.billing_interval : undefined))) if (Object.hasOwn(fieldTypes, name) && !changed.includes(name)) target[name] = value;
    if (changed.includes('currency') && Array.isArray(target.payment_history)) target.payment_history = target.payment_history.map((row) => row && typeof row === 'object' && !('currency' in row) ? { ...row, currency: before.currency } : row);` : ''}
    if (Object.hasOwn(fieldTypes, 'state_history')) {
      const status = String(target${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} ?? before${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} ?? '');
      const moved = changed.includes(${JSON.stringify(statusField)});
      const entry: HistoryEntry = { title: moved ? enumOptionLabel(status${fields[statusField]?.enumLabels ? ', ' + JSON.stringify(fields[statusField]!.enumLabels) : ''}) : 'Updated', from: moved ? String(before${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} ?? '') : null, to: status, at, reason: 'Edited ' + Array.from(new Set(changed.map((name) => fieldLabels[name] ?? name))).join(', ')${billingCycle ? " + (restarted ? '; a new billing period started' : '')" : ''}, ...signature };
      target.state_history = [...history(next), entry];
    }
    const events: readonly string[] = ${JSON.stringify(eventNames)};
    const updateEvent = ${billingCycle ? "(restarted && events.includes('billing_cycle_started') ? 'billing_cycle_started' : undefined) ?? " : ''}events.find((event) => /updat|edit|profile|chang/.test(event));
    if (updateEvent && Object.hasOwn(fieldTypes, 'last_event')) { target.last_event = updateEvent; if (Object.hasOwn(fieldTypes, 'last_event_at')) target.last_event_at = at; }
    return save(next);
  };
  const setArchived = (id: string, archived: boolean) => {
    requireTrait('Archivable');
    const record = get(id);
    Object.assign(record, { is_archived: archived, archived_at: archived ? now() : null });
    return save(record);
  };${stateActions.length ? `
  // s249-m03 (Interface 6): a declared action (a grant's Revoke) is one change: the new state, the note in its reason field
  // when one is given, who acted in its seat when the store was told, a line titled with the new state and the note as its
  // reason, and its event. Records of this object inside the record (alsoEnds) that can make the same move make it at the
  // same instant, each with its own line; one that cannot (a grant still asked for) is left as it is.
  const titleOf = (record: DomainRecord) => String((record as Record<string, unknown>)[titleField] ?? record[idField]);
  const inside = (record: DomainRecord, action: StateAction) => {
    const moved: DomainRecord[] = [];
    const held: DomainRecord[] = [];
    const visit = (id: string) => {
      if (!action.alsoEnds) return;
      for (const entry of records) {
        const values = entry as Record<string, unknown>;
        if (String(values[action.alsoEnds.via] ?? '') !== id || entry === previousOf(record) || moved.includes(entry) || held.includes(entry)) continue;
        if (action.from.includes(String(${status('values')}))) { moved.push(entry); visit(String(entry[idField])); }
        else if (!isFinalState(stateOrder, ${status('values')})) held.push(entry);
      }
    };
    visit(String(record[idField]));
    return { moved, held };
  };
  const previousOf = (record: DomainRecord) => records.find((entry) => entry[idField] === record[idField]);
  const transition = (id: string, actionId: string, note?: string): DomainRecord => {
    const action = stateActions.find((entry) => entry.id === actionId);
    if (!action) throw new Error('A ${stateWords.object} has no action ' + actionId);
    const record = get(id);
    const values = record as Record<string, unknown>;
    const refusal = declaredActionRefusal(action, ${status('values')}, stateOrder, stateWords);
    if (refusal) throw new Error(refusal);
    const at = now();
    const text = note?.trim() ?? '';
    const write = (target: Record<string, unknown>, reason: string) => {
      const entry: HistoryEntry = { title: stateWords.labels[action.to] ?? action.to, from: String(${status('target')} ?? ''), to: action.to, at, reason, ...signature };
      ${status('target')} = action.to;
      if (action.bySeat && options.actor) for (const [suffix, value] of [['_id', options.actor.id], ['_name', options.actor.name], ['_kind', options.actor.kind]] as const) if (Object.hasOwn(fieldTypes, action.bySeat + suffix)) target[action.bySeat + suffix] = value;${fields.last_event && !fields.last_event.unavailable ? `
      target.last_event = action.event;${fields.last_event_at && !fields.last_event_at.unavailable ? ' target.last_event_at = at;' : ''}` : ''}
      if (Object.hasOwn(fieldTypes, 'state_history')) target.state_history = [...history(target as DomainRecord), entry];
      if (Object.hasOwn(fieldTypes, ${JSON.stringify(updatedField)})) target[${JSON.stringify(updatedField)}] = at;
    };
    const { moved } = inside(record, action);
    if (text && action.reasonField) values[action.reasonField] = text;
    write(values, text);
    for (const entry of moved) { const inner = get(String(entry[idField])); write(inner as Record<string, unknown>, 'Ended with ' + titleOf(record)); save(inner); }
    return save(record);
  };
  const preview = (id: string, actionId: string): ActionPreview => {
    const action = stateActions.find((entry) => entry.id === actionId);
    if (!action) throw new Error('A ${stateWords.object} has no action ' + actionId);
    const record = get(id);
    const { moved, held } = inside(record, action);
    const ending = new Set([String(record[idField]), ...moved.map((entry) => String(entry[idField]))]);
    const label = (state: unknown) => stateWords.labels[String(state)] ?? String(state ?? '');
    const underWay: ActionPreview['underWay'] = [];${related ? `
    // The records its lines name that are not final, or not known, from the lists that read finality, leaving out what ends with it.
    const seen = new Set<string>();
    for (const list of relatedRows(record, records)) {
      const declared = relatedLists.find((entry) => entry.id === list.id);
      if (declared?.afterEnd || !declared?.finality?.length || declared.finality.includes('final')) continue;
      for (const row of list.rows) {
        const key = row.object + ':' + String(row.key);
        if ((row.object === relatedOwn.name && ending.has(String(row.key))) || seen.has(key)) continue;
        seen.add(key);
        underWay.push({ title: row.title, state: row.stateLabel ?? label(row.state) });
      }
    }` : ''}
    const leftRunning: ActionPreview['leftRunning'] = [];${mandate ? `
    // Other grants the same holder holds for the same party that still stand, leaving out what ends with it.
    const values = record as Record<string, unknown>;
    for (const entry of records) {
      const other = entry as Record<string, unknown>;
      if (!ending.has(String(entry[idField])) && action.from.includes(String(${status('other')})) && other.granted_to_id === values.granted_to_id && other.granted_for_id === values.granted_for_id) leftRunning.push({ title: titleOf(entry), state: label(${status('other')}) });
    }` : ''}
    return { name: titleOf(record), endsWith: moved.map(titleOf), notEnded: held.map(titleOf), underWay, leftRunning, ...(options.actor ? { actor: options.actor } : {}) };
  };
  /** The declared action a saved status move makes, if any: the form's way to the same change as the button. */
  const actionFor = (record: DomainRecord) => {
    const previous = previousOf(record) as Record<string, unknown> | undefined;
    const values = record as Record<string, unknown>;
    if (!previous || String(${status('previous')}) === String(${status('values')})) return undefined;
    return stateActions.find((entry) => entry.to === String(${status('values')}) && entry.from.includes(String(${status('previous')})));
  };` : ''}
  return {
    get, save, update,${stateActions.length ? ' transition, preview, actionFor,' : ''}${related ? `
    related(record: DomainRecord) { return relatedRows(record, records); },` : ''}
    async ready() {
      await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, options.latency ?? 180)));
      if (fail) throw new Error('Simulated data service failure');
    },
    setFailure(value: boolean) { fail = value; },
    list(query: ListQuery = {}) {
      // One search rule (recordMatchesSearch): any text or number at any depth, its history included; never a key name.
      const filtered = records.filter((record) => {
        const values = record as Record<string, unknown>;
        return Boolean(values.is_archived) === (query.archived ?? false)
          && (!query.status || values${filterField === 'status' ? '.status' : `[${JSON.stringify(filterField)}]`} === query.status)
          && recordMatchesSearch(record, query.search);
      });
      const sort = query.sort ?? sortField;
      filtered.sort((a, b) => {
        const left = ${(fields[sortField]?.displayFallbackField || fields[sortField]?.titleReferences?.length) ? `sort === sortField ? ${displayFieldExpression(sortField, fields, name => `a[${JSON.stringify(name)}]`)} : a[sort]` : 'a[sort]'}; const right = ${(fields[sortField]?.displayFallbackField || fields[sortField]?.titleReferences?.length) ? `sort === sortField ? ${displayFieldExpression(sortField, fields, name => `b[${JSON.stringify(name)}]`)} : b[sort]` : 'b[sort]'};
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
        return (query.descending ? -1 : 1) * order;
      });
      const pageSize = Math.max(1, Math.floor(query.pageSize ?? 10));
      const page = Math.max(1, Math.floor(query.page ?? 1));
      return { total: filtered.length, page, pageSize, records: structuredClone(filtered.slice((page - 1) * pageSize, page * pageSize)) };
    },
    cancel(id: string, reason: string, code: string, atPeriodEnd: boolean) {
      requireTrait('Cancellable');
      const record = get(id);
      const values = record as Record<string, unknown>;
      // s213-m01: the lifecycle decides (cancellationMode); a record never moves to a state its object does not declare.
      const mode = ${JSON.stringify(cancellationMode(workflow.data.lifecycleStates))} as 'deferred' | 'immediate' | 'none';
      if (mode === 'none') throw new Error('This record has no cancelled state to move to');
      const immediate = mode === 'immediate';
      const target = immediate ? 'cancelled' : 'pending_cancellation';
      ${cancelFrom ? `// The object's declared order decides the states a record may be cancelled from.
      if (values.is_archived || !(${JSON.stringify(cancelFrom)} as readonly string[]).includes(String(values${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`}))) throw new Error('This record cannot be cancelled in its current state');` : `if (values.is_archived || values${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} === 'terminated' || values${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`} === 'pending_cancellation' || (immediate && ['completed', 'cancelled', 'final'].includes(String(values${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`})))) throw new Error('This record cannot be cancelled in its current state');`}
      ${workflow.data.cancellationRequiresReason ? `if (!reason.trim()) throw new Error('Enter a cancellation reason');
      if (!code || (${JSON.stringify(workflow.data.cancellationReasonCodes ?? [])}.length > 0 && !(${JSON.stringify(workflow.data.cancellationReasonCodes ?? [])} as readonly string[]).includes(code))) throw new Error('Choose an allowed cancellation reason code');` : ''}
      const at = now();
      const deferred = target === 'pending_cancellation' && atPeriodEnd;${billingCycle ? `
      // Ending at the period's end cancels the renewal: a payment due at or after that end will not be taken.
      if (deferred && typeof values.next_payment_due_at === 'string' && typeof values.current_period_end === 'string' && Date.parse(values.next_payment_due_at) >= Date.parse(values.current_period_end)) values.next_payment_due_at = undefined;` : ''}
      const entry: HistoryEntry = { title: enumOptionLabel(target${fields[statusField]?.enumLabels ? ', ' + JSON.stringify(fields[statusField]!.enumLabels) : ''}), from: String(values${statusField === 'status' ? '.status' : `[${JSON.stringify(statusField)}]`}), to: target, at, reason: reason.trim(), code, atPeriodEnd: deferred, ...signature };
      Object.assign(record, { [${JSON.stringify(statusField)}]: target, cancellation_reason: reason.trim(), cancellation_reason_code: code, ${fields.cancel_at_period_end && !fields.cancel_at_period_end.unavailable ? 'cancel_at_period_end: deferred, ' : ''}cancellation_requested_at: at, ${cancelEvent ? `last_event: ${JSON.stringify(cancelEvent)}, ${fields.last_event_at && !fields.last_event_at.unavailable ? 'last_event_at: at, ' : ''}` : ''}state_history: [...history(record), entry], [${JSON.stringify(updatedField)}]: at });
      return save(record);
    },
    archive(id: string) { return setArchived(id, true); },
    restore(id: string) { return setArchived(id, false); },
  };
}
` },
  ];
}

/** s249-m02: the generated src/related-data.ts: the declared lists, the app's own object, and the records it copied. */
function relatedDataFile(related: NonNullable<ReturnType<typeof relatedAppData>>): string {
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  return `import type { RelatedList, RelatedObject } from '@oods/component-contracts';

/**
 * The related lists this object declares (metadata.relatedLists), read by relatedRows in store.ts. relatedObjects holds
 * the records of the other objects the lists read, copied from the samples when this app was made, with only the fields
 * the lists read; the app's own records are its store's. A product replaces relatedRows with its own query.
 */
export const relatedLists: RelatedList[] = ${json(related.lists)};

/** This app's own object; its records are the store's live records. */
export const relatedOwn: RelatedObject = ${json(related.own)};

/** The other objects' records, copied from the samples when this app was made. */
export const relatedObjects: Record<string, RelatedObject> = ${json(related.objects)};

/** The note a list carries when it reads records copied from other objects. */
export const relatedCopied: Record<string, string> = ${json(related.copied)};
`;
}
