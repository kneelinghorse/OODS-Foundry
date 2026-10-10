import { reactBindingReads } from './react-binding-reads.js';
import type { FieldSchemaEntry, UiElement } from '../schemas/generated.js';
import { displayFieldExpression, mapFieldType, snakeToCamel } from './binding-utils.js';
import { escapeDoubleQuotedAttribute, javascriptSingleQuotedString } from './emission-safety.js';
import type { CodegenIssue } from './types.js';
import { readableCode, reads, templateExpressions } from './vue-unread-declarations.js';

const literal = (value: unknown): string => {
  if (typeof value === 'string') return javascriptSingleQuotedString(value);
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, entry]) => `${literal(key)}: ${literal(entry)}`).join(', ')}}`;
  return JSON.stringify(value) ?? 'undefined';
};
const walk = (nodes: readonly UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
export const collectionSources = (nodes: readonly UiElement[]) => new Set(walk(nodes).flatMap(node => node.collection ? [node.collection.source] : []));

export function preflightCollections(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry> | undefined): CodegenIssue[] {
  const issues: CodegenIssue[] = [];
  const components = { search: 'SearchInput', filter: 'Select', sort: 'Select', page: 'PaginationBar', archive: 'Tabs', open: 'Button', event: 'Card', 'payment-event': 'PaymentEventTimeline', empty: 'Banner' };
  for (const node of walk(nodes)) {
    const fail = (message: string) => issues.push({ code: 'OODS-V007', message, nodeId: node.id, component: node.component });
    if (node.collection && (!fields || Object.keys(fields).length === 0)) fail('Object collection screens require an objectSchema.');
    if (node.collection?.source === 'rows') {
      for (const name of [node.collection.keyField, node.collection.labelField]) {
        if (!fields?.[name]) fail(`Collection field ${JSON.stringify(name)} is not declared by the object.`);
      }
    }
    if (node.collectionControl && components[node.collectionControl] !== node.component) {
      fail(`Collection control ${node.collectionControl} requires ${components[node.collectionControl]}, received ${node.component}.`);
    }
  }
  return issues;
}

export function collectionProps(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry>): string[] {
  const sources = collectionSources(nodes);
  const row = Object.entries(fields).map(([name, field]) => `${snakeToCamel(name)}${field.required ? '' : '?'}: ${mapFieldType(field)}`).join('; ');
  return [
    ...(sources.has('rows') ? [`rows?: Array<{ ${row} }>;`, 'collectionQuery?: { search?: string; status?: string; descending?: boolean; archived?: boolean; page?: number; pageSize?: number; total?: number };'] : []),
    ...(sources.has('events') ? ['events?: CollectionEvent[];'] : []),
  ];
}

/** The record keys recordCollectionEvents reads besides a record's history and payment fields. */
const RECORD_EVENT_KEYS = ['payment_history', 'amount', 'currency', 'billing_interval', 'created_at', 'last_event', 'last_event_at', 'issued_at', 'period_start', 'ownership_transferred_at', 'archived_at', 'restored_at', 'archive_reason', 'cancellation_requested_at', 'cancellation_reason'];

/** The shared event formatter keeps its canonical API; only explicitly bound audit semantics supply aliases. */
export function recordEventAliases(fields: Record<string, FieldSchemaEntry>): Record<string, string> {
  const aliases = Object.fromEntries([['created_at', 'audit.created_at'], ['updated_at', 'audit.updated_at'], ['last_event', 'audit.event.type'], ['last_event_at', 'audit.event.timestamp']].flatMap(([canonical, semantic]) => {
    const source = Object.keys(fields).find(field => !fields[field].unavailable && fields[field].semanticType === semantic);
    return source && source !== canonical ? [[canonical, source]] : [];
  }));
  if (aliases.updated_at && !fields.last_event_at && !aliases.last_event_at) aliases.last_event_at = aliases.updated_at;
  return aliases;
}

/**
 * s220-m01 (#2461): the events a timeline shows when its consumer passes none are the record's own, projected the way its
 * workflow store and the preview project them (recordCollectionEvents). A standalone Subscription timeline received the
 * record's history, showed it under "State transitions", and said "No events yet" above it.
 */
export function recordEventsProjection(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry>): { keys: string[]; aliases: Record<string, string>; options: { historyField?: string; payments: Array<{ field: string; title: string }>; minorUnits?: number } } | undefined {
  const collection = walk(nodes).find(node => node.collection?.source === 'events')?.collection;
  if (!collection) return undefined;
  const payment = walk(nodes).find(node => node.component === 'PaymentEventTimeline');
  const payments = payment ? [{ field: payment.props?.lastPaymentField, title: 'Last payment' }, { field: payment.props?.nextPaymentField, title: 'Next payment' }]
    .filter((entry): entry is { field: string; title: string } => typeof entry.field === 'string') : [];
  const historyField = collection.historyField;
  const aliases = recordEventAliases(fields);
  const keys = [...new Set([...Object.values(aliases), historyField ?? 'state_history', ...payments.map(entry => entry.field), ...RECORD_EVENT_KEYS])].filter(name => fields[name] && !fields[name]!.unavailable);
  const minorUnits = fields.amount?.money?.minorUnits;
  return { keys, aliases, options: { ...(historyField ? { historyField } : {}), payments, ...(minorUnits ? { minorUnits } : {}) } };
}

export function recordEventsExpression(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry>): string | undefined {
  const projection = recordEventsProjection(nodes, fields);
  if (!projection) return undefined;
  return `recordCollectionEvents({ ${[...projection.keys.map(name => `${name}: ${snakeToCamel(name)}`), ...Object.entries(projection.aliases).map(([canonical, source]) => `${canonical}: ${snakeToCamel(source)}`)].join(', ')} }, ${literal(projection.options)})`;
}

/** React defaults a timeline's events to the record's own; Vue cannot (a props default is hoisted out of setup), so it reads timelineEvents(). */
export function collectionParameters(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry> = {}, framework: 'react' | 'vue' = 'react'): string[] {
  const sources = collectionSources(nodes);
  const events = recordEventsExpression(nodes, fields);
  return [...(sources.has('rows') ? ['rows = []', 'collectionQuery = {}'] : []), ...(sources.has('events') ? [framework === 'vue' ? 'events' : `events = ${events ?? '[]'}`] : [])];
}

/** Vue's shown timeline events: the consumer's, else the record's own. */
export function vueTimelineEvents(nodes: readonly UiElement[], fields: Record<string, FieldSchemaEntry>): string | undefined {
  if (!collectionSources(nodes).has('events')) return undefined;
  return `const timelineEvents = () => events ?? ${recordEventsExpression(nodes, fields) ?? '[]'};`;
}

/** Screen bindings retain provenance but controls, rather than duplicate buttons, invoke them. */
export function wiredCollectionAction(node: UiElement, event: string): boolean {
  const controls = new Set(walk([node]).map(child => child.collectionControl));
  return event === 'onRowClick' && controls.has('open')
    || event === 'onFilter' && (controls.has('search') || controls.has('filter'))
    || event === 'onSort' && controls.has('sort')
    || event === 'onPageChange' && controls.has('page');
}

// s222-m03 (#2502 ruling 16): the title field of the collection whose rows are being emitted, so each row button is named
// by its record's title. Emission is synchronous, so the collection sets it around its own content only.
let rowLabelField: string | undefined;

/** Lower explicit collection semantics while delegating row content to the ordinary emitter. */
export function emitCollectionNode(
  node: UiElement,
  framework: 'react' | 'vue',
  fields: Record<string, FieldSchemaEntry>,
  emit: (node: UiElement) => string,
): string | undefined {
  const react = framework === 'react';
  const attr = (name: string, expression: string) => react ? `${name}={${expression}}` : `:${name}="${escapeDoubleQuotedAttribute(expression)}"`;
  const on = (name: string, expression: string) => react ? `on${name}={${expression}}` : `@${name.replace(/[A-Z]/g, (letter, index) => (index ? '-' : '') + letter.toLowerCase())}="${escapeDoubleQuotedAttribute(expression)}"`;
  const id = `id="${escapeDoubleQuotedAttribute(node.id)}"`;
  const value = (expression: string) => react ? `{${expression}}` : `{{ ${expression} }}`;
  const children = () => (node.children ?? []).map(emit).join('\n');
  if (node.collection) {
    const source = node.collection.source;
    const empty = node.children?.find(child => child.collectionControl === 'empty');
    const outerLabelField = rowLabelField;
    rowLabelField = source === 'rows' ? node.collection.labelField : undefined;
    const content = (node.children ?? []).filter(child => child !== empty).map(emit).join('\n');
    rowLabelField = outerLabelField;
    // Repeated controls must not introduce duplicate DOM IDs.
    const indexed = content.replace(/(?<=\s)id="([^"]+)"/g, (_, original: string) => attr('id', `${literal(original + '-')} + collectionIndex`));
    // The collection's banner is the list's empty branch: it renders whenever the rows are empty and carries the
    // state marker, without the uiState wrap (the toolbar stays mounted through an empty search).
    const emptyCode = empty ? emit({ ...empty, collectionControl: undefined, state: undefined }).replace('data-oods-component="Banner"', 'data-oods-component="Banner" data-oods-state="empty"') : '';
    const shown = source === 'events' && !react ? 'timelineEvents()' : source;
    const items = source === 'events' ? `chronologicalEvents(${shown})` : 'rows';
    const label = source === 'events' ? 'Lifecycle history' : 'Records';
    const key = source === 'events' ? 'collectionEvent.id' : `String(${snakeToCamel(node.collection.keyField)})`;
    // s213-m01 (finding 6): a Vue row destructures the fields its template reads, and its key; a v-for destructure of
    // every field leaves unread bindings a strict team project rejects in either framework.
    const rowExpressions = readableCode(templateExpressions(indexed));
    const reactReads = react ? reactBindingReads(`return (<li key={${key}}>${indexed}</li>);`) : new Set<string>();
    const rowFields = Object.keys(fields).map(snakeToCamel).filter(name => react ? reactReads.has(name) : name === snakeToCamel(node.collection!.keyField) || reads(rowExpressions, name));
    const binding = source === 'events' ? 'collectionEvent' : `{ ${rowFields.join(', ')} }`;
    if (react) return `<section ${id} data-oods-collection="${source}">{${source}.length === 0 ? (${emptyCode}) : (<ol aria-label="${label}" className="oods-collection">{${items}.map((${binding}, collectionIndex) => <li key={${key}}>${indexed}</li>)}</ol>)}</section>`;
    return `<section ${id} data-oods-collection="${source}"><template v-if="${shown}.length === 0">${emptyCode}</template><ol v-else aria-label="${label}" class="oods-collection"><li v-for="(${escapeDoubleQuotedAttribute(binding)}, collectionIndex) in ${items}" :key="${escapeDoubleQuotedAttribute(key)}">${indexed}</li></ol></section>`;
  }
  switch (node.collectionControl) {
    case 'empty': return emit({ ...node, collectionControl: undefined, state: undefined }).replace('data-oods-component="Banner"', 'data-oods-component="Banner" data-oods-state="empty"');
    case 'search': return `<SearchInput ${id} label="Search" placeholder="${escapeDoubleQuotedAttribute(String(node.props?.placeholder ?? 'Search records'))}" ${attr('value', "collectionQuery.search ?? ''")} ${attr('clearable', 'true')} ${on(react ? 'ValueChange' : 'valueChange', react ? `(search) => handleFilter({ ...collectionQuery, search })` : `handleFilter({ ...collectionQuery, search: $event })`)} />`;
    case 'filter': {
      const options = node.props?.options as Array<{ value: string; label: string }> | undefined;
      const field = snakeToCamel(String(node.props?.field ?? 'status'));
      // String statuses have no enum. Offer observed values so the filter isn't
      // a dead one-option select; retain the selected value across filtered pages.
      // Function expressions also survive vue-tsc's handling of HTML-escaped attributes.
      const values = `[...new Set([...rows.map(function(row) { return String(row.${field} ?? ''); }), collectionQuery.status ?? ''])].filter(Boolean).sort()`;
      const expression = options && options.length > 1 ? literal(options)
        : `[{ value: '', label: 'All states' }, ...${values}.map(function(value) { return { value, label: value.split(/[_\\-\\s]+/).filter(Boolean).map(function(part) { return part.charAt(0).toUpperCase() + part.slice(1); }).join(' ') }; })]`;
      return `<Select ${id} label="${escapeDoubleQuotedAttribute(String(node.props?.label ?? 'Status'))}" ${attr('value', "collectionQuery.status ?? ''")} ${attr('options', expression)} ${on('Change', react ? `(event) => handleFilter({ ...collectionQuery, status: event.currentTarget.value })` : `handleFilter({ ...collectionQuery, status: $event })`)} />`;
    }
    case 'sort': return `<Select ${id} label="Sort" ${attr('value', "collectionQuery.descending ? 'desc' : 'asc'")} ${attr('options', literal(node.props?.options ?? []))} ${on('Change', react ? `() => handleSort(${literal(node.props?.field)})` : `handleSort(${literal(node.props?.field)})`)} />`;
    case 'page': return `<PaginationBar ${id} ${attr('page', 'collectionQuery.page ?? 1')} ${attr('pageSize', 'collectionQuery.pageSize ?? 10')} ${attr('totalItems', 'collectionQuery.total ?? rows.length')} ${on(react ? 'PageChange' : 'pageChange', 'handlePageChange')} />`;
    case 'archive': {
      const items = (node.props?.items ?? []) as Array<{ id: string; label: string }>;
      const panels = react ? '[' + items.map(item => `{ id: ${literal(item.id)}, label: ${literal(item.label)}, panel: (collectionQuery.archived ? 'archived' : 'active') === ${literal(item.id)} ? (<>${children()}</>) : null }`).join(', ') + ']' : literal(items);
      const attrs = `${id} ariaLabel="Archive views" ${attr('selectedId', "collectionQuery.archived ? 'archived' : 'active'")} ${attr('items', panels)} ${on('Change', react ? `(id) => handleFilter({ ...collectionQuery, archived: id === 'archived' })` : `handleFilter({ ...collectionQuery, archived: $event === 'archived' })`)}`;
      return react ? `<Tabs ${attrs} />` : `<Tabs ${attrs}><template #panel="{ selected }"><template v-if="selected">${children()}</template></template></Tabs>`;
    }
    case 'open': {
      const key = `String(${snakeToCamel(String(node.props?.field))})`;
      // s222-m03 (#2502 ruling 16): the row's accessible name is the record's title (its key when the title is empty).
      const labelField = rowLabelField ? displayFieldExpression(rowLabelField, fields) : undefined;
      const name = labelField ? `String(${labelField} || ${key})` : key;
      return `<Button ${id} type="button" ${react ? 'className' : 'class'}="oods-collection-row" ${attr('aria-label', name)} ${attr('data-record-id', key)} ${on('Click', react ? `() => handleRowClick(${key})` : `handleRowClick(${key})`)}>${children()}</Button>`;
    }
    case 'event': {
      const payment = node.children?.find(child => child.collectionControl === 'payment-event');
      const label = node.children?.find(child => child.component === 'TimelineEntryLabel');
      const state = `${label ? emit(label) : ''}<strong>${value('collectionEvent.title')}</strong><time ${attr(react ? 'dateTime' : 'datetime', 'collectionEvent.at')}>${value('formatDateTime(collectionEvent.at)')}</time><p>${value('collectionEvent.description')}</p>`;
      const body = payment ? (react ? `{collectionEvent.kind === 'payment' ? (${emit(payment)}) : (<>${state}</>)}` : `<template v-if="collectionEvent.kind === 'payment'">${emit(payment)}</template><template v-else>${state}</template>`) : state;
      return `<Card ${id}>${body}</Card>`;
    }
    case 'payment-event': return `<PaymentEventTimeline ${id} ${attr('event', 'collectionEvent')} />`;
    default: return undefined;
  }
}
