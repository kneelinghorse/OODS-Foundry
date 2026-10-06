import { recordCollectionEvents } from '@oods/component-contracts';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { snakeToCamel } from './binding-utils.js';
import { recordEventsProjection } from './collection-emitter.js';
import { recordTitleField } from '../compose/record-label.js';
import { neutralFieldValue, shownSampleRecord, sortRecordsAsStated, statedListSortField, workflowSampleRecords } from './workflow-data-emitter.js';

/** Every element of a UiSchema in document order. */
export function schemaNodes(schema: UiSchema): UiElement[] {
  const nodes: UiElement[] = [];
  const visit = (node: UiElement) => { nodes.push(node); node.children?.forEach(visit); };
  schema.screens.forEach(visit);
  return nodes;
}

const camel = (name: string) => name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/**
 * Fill the actual public object shape, retaining established fixture values where compatible.
 * Moved from scripts/product-reality/s185-m04-consumer-contract.ts (Sprint 201) so the served
 * preview and the design loop mount the same deterministic field model; the script re-exports it.
 */
export function deriveConsumerModel(schema: UiSchema, established: Record<string, unknown> = {}): Record<string, unknown> {
  const model = Object.fromEntries(Object.entries(schema.objectSchema ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, field]) => {
    const key = camel(name);
    const previous = established[key];
    let value: unknown;
    if (Object.hasOwn(established, key) && (!field.enum?.length || field.enum.includes(previous as string))) value = previous;
    else if (field.examples?.length) {
      const example = structuredClone(field.examples[0]);
      value = example === null && !field.required && !field.type.endsWith('?') ? undefined : example;
    }
    else if (field.default !== undefined) value = structuredClone(field.default);
    else if (field.enum?.length) value = field.enum[0];
    else value = neutralFieldValue(field);
    return [key, value];
  }));
  // Exercise actual collection content through the public consumer API.
  const sources = new Set(schemaNodes(schema).flatMap(node => node.collection ? [node.collection.source] : []));
  if (sources.has('rows')) { model.rows = [{ ...model }]; model.collectionQuery = { page: 1, pageSize: 10, total: 1 }; }
  // s220-m01 (#2461): a timeline shows the record's own events, as a generated screen does when it is passed none.
  if (sources.has('events')) {
    const projection = recordEventsProjection(schema.screens, schema.objectSchema ?? {});
    model.events = projection ? recordCollectionEvents(Object.fromEntries(projection.keys.map(name => [name, model[camel(name)]])), projection.options) : [];
  }
  if (schemaNodes(schema).some(node => node.state)) model.uiState = 'success';
  return model;
}

export interface PreviewModelInput {
  schema: UiSchema;
  context: string;
  object?: string;
  /** The same object's workflow composition; supplies the seed records for standalone contexts. */
  workflowSchema?: UiSchema;
  /** Caller-supplied values; they win over every seeded value. */
  established?: Record<string, unknown>;
}

/**
 * The design loop's seed policy (scripts/design-loop/render.ts): a standalone preview uses the same
 * object/trait seed records as its workflow app, absence in the seed is meaningful, and generated
 * standalone components still receive rows and events through their public API.
 */
export function seedPreviewModel({ schema, context, object, workflowSchema, established = {} }: PreviewModelInput): Record<string, unknown> {
  const model = deriveConsumerModel(schema, established);
  if (Array.isArray(established.rows)) model.collectionQuery = { page: 1, pageSize: Math.max(10, established.rows.length), total: established.rows.length };
  if (workflowSchema && context !== 'workflow' && object) {
    const records = workflowSampleRecords(workflowSchema).filter(record => !record.is_archived);
    const camel = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [snakeToCamel(key), value]));
    const shown = shownSampleRecord(records);
    // Absence in the seed is meaningful (for example, an active record has no cancellation date).
    // Do not retain the consumer probe's invented values for omitted domain fields.
    for (const field of Object.keys(workflowSchema.objectSchema ?? {})) delete model[snakeToCamel(field)];
    Object.assign(model, shown ? camel(shown) : {}, established);
    if (context === 'timeline' && !Object.hasOwn(established, 'events')) {
      const payment = schemaNodes(schema).find(node => node.component === 'PaymentEventTimeline');
      const payments = payment ? [{ field: payment.props?.lastPaymentField, title: 'Last payment' }, { field: payment.props?.nextPaymentField, title: 'Next payment' }].filter((entry): entry is { field: string; title: string } => typeof entry.field === 'string') : [];
      model.events = recordCollectionEvents(shown!, { payments, minorUnits: workflowSchema.workflow?.data.minorUnits });
    }
    if (context === 'list' && !Object.hasOwn(established, 'rows')) {
      // s213-m01 (review finding 1): the list's sort control says "Name A–Z" before anyone sorts, so the seeded rows
      // take that order, compared as the workflow store compares them; seed order under that label was a lie.
      const fields = schema.objectSchema ?? workflowSchema.objectSchema ?? {};
      const title = recordTitleField(object, fields, workflowSchema.workflow?.data.idField ?? 'id');
      model.rows = sortRecordsAsStated(records, statedListSortField(schema, title), fields).map(camel);
      model.collectionQuery = { page: 1, pageSize: 10, total: records.length };
    }
  }
  return model;
}
