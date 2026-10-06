import { chartNodes } from './chart-declaration.js';
import { VIZ_SVG_PROPS } from '@oods/component-contracts';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../schemas/generated.js';
import { displayFieldExpression, mapFieldType, snakeToCamel } from './binding-utils.js';
import { fieldLabel } from '../compose/label-generator.js';
import { recordTitleField } from '../compose/record-label.js';
import { cancellationMode } from '../objects/cancellation-mode.js';

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
  return '';
}

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
      if (name === idField && (keys.length < sampleCount || keys.some(key => key == null || key === '') || new Set(keys.map(String)).size < keys.length)) {
        return value(field.type === 'uuid' ? `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` : ['integer', 'number'].includes(field.type) ? index + 1 : `sample-${index + 1}`, 'neutral unique preview record key');
      }
      if (field.examples?.length) {
        const example = field.examples[(index + rotation) % field.examples.length];
        return value(example === null && !field.required && !field.type.endsWith('?') ? undefined : example, 'authored field example');
      }
      const chart = charts.find(chart => (chart.source === 'record-array' || chart.source === 'edge-array') && chart.dataField === name);
      if (chart?.source === 'record-array' || chart?.source === 'edge-array') return value(chart.sampleRows, 'authored chart rows');
      if (field.enum?.length) return value(field.enum[(index + rotation) % field.enum.length], 'declared field enum');
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
  const fallback = fields[field]?.displayFallbackField;
  const shown = (record: T) => fallback && fallback !== field && Object.hasOwn(fields, fallback) && !String(record[field] ?? '').trim() ? record[fallback] : record[field];
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
  const camelProps = Object.keys(fields).map((name) => `  ${snakeToCamel(name)}: record[${JSON.stringify(name)}],`).join('\n');
  return [
    { path: 'src/sample-data.ts', contents: `import type { DomainRecord } from './store';\n\nexport const sampleData: DomainRecord[] = ${JSON.stringify(records, null, 2)};\n` },
    { path: 'src/store.ts', contents: `import { recordCollectionEvents, ${billingCycle ? 'restartedBillingPeriod, ' : ''}type CollectionEvent } from '@oods/component-contracts';
import { sampleData } from './sample-data';
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
export const fieldLabels: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.keys(fields).map(name => [name, fieldLabel(name)])))};
export const fieldTypes: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.type])))};
export const traits: readonly string[] = ${JSON.stringify(workflow.data.traits.map((name) => name.split('/').pop()))};
export interface StoreOptions { empty?: boolean; fail?: boolean; latency?: number; now?: () => string; seed?: DomainRecord[] }
export interface ListQuery { search?: string; status?: string; archived?: boolean; sort?: keyof DomainRecord; descending?: boolean; page?: number; pageSize?: number }
export interface HistoryEntry { title?: string; from: string | null; to: string; at: string; reason: string; code?: string; atPeriodEnd?: boolean }
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
export function collectionEvents(record: DomainRecord): CollectionEvent[] {
  return recordCollectionEvents(record, ${JSON.stringify({ historyField: eventCollection?.historyField, payments: paymentSources, minorUnits: workflow.data.minorUnits })});
}
export function createStore(options: StoreOptions = {}) {
  let records = structuredClone(options.seed ?? (options.empty ? [] : sampleData));
  let fail = options.fail ?? false;
  const now = options.now ?? (() => new Date().toISOString());
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
  const update = (record: DomainRecord) => {
    const previous = records.find((entry) => entry[idField] === record[idField]);
    if (!previous) throw new Error('Cannot save a missing record');
    const values = record as Record<string, unknown>;
    const before = previous as Record<string, unknown>;
    const changed = Object.keys(values).filter((name) => Object.hasOwn(fieldTypes, name) && name !== 'state_history' && name !== 'updated_at' && JSON.stringify(values[name]) !== JSON.stringify(before[name]));
    if (changed.length === 0) return save(record);
    const at = now();
    const next = structuredClone(record);
    const target = next as Record<string, unknown>;
    if (Object.hasOwn(fieldTypes, 'updated_at')) target.updated_at = at;${billingCycle ? `
    // Billable's billing-anchor reset: new terms (price, currency or interval) on an active record start a new billing
    // period now, its payment due and pending. A period field the edit itself set is kept. Recorded payments are history:
    // they keep the currency they were paid in.
    const restarted = changed.some((name) => name === 'amount' || name === 'currency' || name === 'billing_interval') && target.status === 'active';
    if (restarted) for (const [name, value] of Object.entries(restartedBillingPeriod(at, typeof target.billing_interval === 'string' ? target.billing_interval : undefined))) if (Object.hasOwn(fieldTypes, name) && !changed.includes(name)) target[name] = value;
    if (changed.includes('currency') && Array.isArray(target.payment_history)) target.payment_history = target.payment_history.map((row) => row && typeof row === 'object' && !('currency' in row) ? { ...row, currency: before.currency } : row);` : ''}
    if (Object.hasOwn(fieldTypes, 'state_history')) {
      const status = String(target.status ?? before.status ?? '');
      const moved = changed.includes('status');
      const entry: HistoryEntry = { title: moved ? String(status).split(/[_-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Updated', from: moved ? String(before.status ?? '') : null, to: status, at, reason: 'Edited ' + changed.map((name) => fieldLabels[name] ?? name).join(', ')${billingCycle ? " + (restarted ? '; a new billing period started' : '')" : ''} };
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
  };
  return {
    get, save, update,
    async ready() {
      await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, options.latency ?? 180)));
      if (fail) throw new Error('Simulated data service failure');
    },
    setFailure(value: boolean) { fail = value; },
    list(query: ListQuery = {}) {
      const search = (query.search ?? '').trim().toLowerCase();
      const filtered = records.filter((record) => {
        const values = record as Record<string, unknown>;
        return Boolean(values.is_archived) === (query.archived ?? false)
          && (!query.status || values${filterField === 'status' ? '.status' : `[${JSON.stringify(filterField)}]`} === query.status)
          && (!search || Object.values(record).some((value) => String(value).toLowerCase().includes(search)));
      });
      const sort = query.sort ?? sortField;
      filtered.sort((a, b) => {
        const left = ${fields[sortField]?.displayFallbackField ? `sort === sortField ? ${displayFieldExpression(sortField, fields, name => `a[${JSON.stringify(name)}]`)} : a[sort]` : 'a[sort]'}; const right = ${fields[sortField]?.displayFallbackField ? `sort === sortField ? ${displayFieldExpression(sortField, fields, name => `b[${JSON.stringify(name)}]`)} : b[sort]` : 'b[sort]'};
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
      if (values.is_archived || values.status === 'terminated' || values.status === 'pending_cancellation' || (immediate && ['completed', 'cancelled', 'final'].includes(String(values.status)))) throw new Error('This record cannot be cancelled in its current state');
      ${workflow.data.cancellationRequiresReason ? `if (!reason.trim()) throw new Error('Enter a cancellation reason');
      if (!code || (${JSON.stringify(workflow.data.cancellationReasonCodes ?? [])}.length > 0 && !(${JSON.stringify(workflow.data.cancellationReasonCodes ?? [])} as readonly string[]).includes(code))) throw new Error('Choose an allowed cancellation reason code');` : ''}
      const at = now();
      const deferred = target === 'pending_cancellation' && atPeriodEnd;${billingCycle ? `
      // Ending at the period's end cancels the renewal: a payment due at or after that end will not be taken.
      if (deferred && typeof values.next_payment_due_at === 'string' && typeof values.current_period_end === 'string' && Date.parse(values.next_payment_due_at) >= Date.parse(values.current_period_end)) values.next_payment_due_at = undefined;` : ''}
      const entry: HistoryEntry = { title: target === 'cancelled' ? 'Cancelled' : 'Pending Cancellation', from: String(values.status), to: target, at, reason: reason.trim(), code, atPeriodEnd: deferred };
      Object.assign(record, { status: target, cancellation_reason: reason.trim(), cancellation_reason_code: code, ${fields.cancel_at_period_end && !fields.cancel_at_period_end.unavailable ? 'cancel_at_period_end: deferred, ' : ''}cancellation_requested_at: at, ${cancelEvent ? `last_event: ${JSON.stringify(cancelEvent)}, ${fields.last_event_at && !fields.last_event_at.unavailable ? 'last_event_at: at, ' : ''}` : ''}state_history: [...history(record), entry], updated_at: at });
      return save(record);
    },
    archive(id: string) { return setArchived(id, true); },
    restore(id: string) { return setArchived(id, false); },
  };
}
` },
  ];
}
