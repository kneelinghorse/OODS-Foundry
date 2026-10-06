import { UI_WORKFLOW_STATES } from '@oods/component-contracts';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { DesignComposeInput, DesignComposeOutput } from '../tools/design.compose.js';
import { cancellationMode } from '../objects/cancellation-mode.js';
import { composeObject } from '../objects/trait-composer.js';
import { loadObject } from '../objects/object-loader.js';
import { supportsContext } from '../objects/supported-contexts.js';
import { handle as validate } from '../tools/repl.validate.js';
import { createSchemaRef, describeSchemaRef } from '../tools/schema-ref.js';

const ROUTES = { list: '/', detail: '/:id', form: '/:id/edit', timeline: '/:id/timeline' } as const;

type WorkflowData = NonNullable<UiSchema['workflow']>['data'];

/**
 * s222-m03 (#2502 ruling 14): an object with authored samples seeds one record per sample, from 5 to 10 (fewer than five
 * repeat to five; more than ten show the first ten); an object without samples keeps its ten.
 */
export function sampleCountFor(samples: readonly unknown[] | undefined): number {
  return samples?.length ? Math.min(10, Math.max(5, samples.length)) : 10;
}

/** The sample-data descriptor a workflow's records are seeded from: its id field, lifecycle and trait parameters. */
function workflowData(first: DesignComposeOutput): WorkflowData {
  const definition = loadObject(first.objectUsed!.name);
  const object = composeObject(definition);
  const parameters = (name: string) => object.traits.find((trait) => trait.ref.name.split('/').pop() === name)?.ref.parameters ?? {};
  const lifecycle = parameters('Stateful');
  const billing = parameters('Billable');
  const timestamps = parameters('Timestampable');
  const cancellation = parameters('Cancellable');
  const addressable = parameters('Addressable');
  const fields = first.schema.objectSchema ?? {};
  const idField = Object.keys(fields).find((field) => field === 'id')
    ?? Object.keys(fields).find((field) => field === `${object.object.name.toLowerCase()}_id`)
    ?? Object.keys(fields).find((field) => field.endsWith('_id'))
    ?? Object.keys(fields)[0]!;
  return {
    idField, traits: first.objectUsed!.traits, sampleCount: sampleCountFor(definition.samples),
    ...(Array.isArray(addressable.roles) ? { addressRoles: addressable.roles.map(String), defaultAddressRole: String(addressable.defaultRole ?? addressable.roles[0]) } : {}),
    recordedEvents: Array.isArray(timestamps.recordedEvents) ? timestamps.recordedEvents.map(String) : [],
    cancellationRequiresReason: cancellation.requireReason === true,
    cancellationReasonCodes: Array.isArray(cancellation.allowedReasons) ? cancellation.allowedReasons.map(String) : [],
    lifecycleStates: Array.isArray(lifecycle.states) ? lifecycle.states.map(String) : fields.status?.enum ?? [],
    billingIntervals: Array.isArray(billing.billingIntervals) ? billing.billingIntervals.map(String) : [],
    currency: String(billing.defaultCurrency ?? 'usd'), minorUnits: Number(billing.minorUnits ?? 100),
  };
}

/**
 * The schema a standalone preview draws its seed records from (design.preview and the design loop share it).
 *
 * An object with a workflow app seeds from its workflow, so a card, a list and a detail show the app's own
 * records. s206-m01: a read-only object composes no workflow, so it seeds from its list composition carrying the
 * same data descriptor — the same deterministic records, without composing the form it does not have. An object
 * that composes no list either (Chunk, embedded inline) has no seed records.
 */
export async function seedSchema(
  input: DesignComposeInput & { object: string },
  compose: (input: DesignComposeInput) => Promise<DesignComposeOutput>,
): Promise<UiSchema | undefined> {
  const definition = loadObject(input.object);
  const transient = { ...input, options: { ...(input.options ?? {}), transient: true } };
  if (supportsContext(definition, 'workflow')) {
    const workflow = await compose({ ...transient, context: 'workflow' });
    if (workflow.status !== 'ok' || !workflow.schema) throw new Error(`Seed composition failed: ${JSON.stringify(workflow.errors ?? workflow)}`);
    return workflow.schema;
  }
  if (!supportsContext(definition, 'list')) return undefined;
  const list = await compose({ ...transient, context: 'list' });
  if (list.status !== 'ok' || !list.schema || !list.objectUsed) throw new Error(`Seed composition failed: ${JSON.stringify(list.errors ?? list)}`);
  // The seed carries the workflow's data descriptor only: it assembles no screens, so none are listed.
  const screens = [] as unknown as NonNullable<UiSchema['workflow']>['screens'];
  return { ...list.schema, workflow: { object: list.objectUsed.name, screens, transitions: [], states: [...UI_WORKFLOW_STATES], data: workflowData(list) } };
}

/** Assemble public compositions. Trait actions are already present on each source screen. */
export async function assembleWorkflow(
  input: DesignComposeInput,
  compose: (input: DesignComposeInput) => Promise<DesignComposeOutput>,
): Promise<DesignComposeOutput> {
  const results: DesignComposeOutput[] = [];
  for (const context of Object.keys(ROUTES) as Array<keyof typeof ROUTES>) {
    const result = await compose({ ...input, context });
    if (result.status !== 'ok') return result;
    results.push(result);
  }
  const first = results[0]!;
  if (!first.objectUsed) return { ...first, status: 'error', errors: [{ code: 'OODS-V003', message: 'workflow requires a registered object.' }] };
  const screens: UiElement[] = [];
  const workflow: NonNullable<UiSchema['workflow']> = {
    object: first.objectUsed.name, screens: (Object.keys(ROUTES) as Array<keyof typeof ROUTES>).map((context) => ({ id: `${context}-screen`, context, route: ROUTES[context] })) as NonNullable<UiSchema['workflow']>['screens'], transitions: [], states: [...UI_WORKFLOW_STATES],
    data: workflowData(first),
  };
  for (const [index, context] of (Object.keys(ROUTES) as Array<keyof typeof ROUTES>).entries()) {
    const source = structuredClone(results[index]!.schema.screens[0]!);
    const prefix = (node: UiElement) => { node.id = `${context}-${node.id}`; node.children?.forEach(prefix); };
    prefix(source);
    // A public list already owns the four branches. Reuse them so the workflow
    // does not nest loading/error checks inside its success branch.
    // A rows collection prints its own empty banner, so a list screen owns its states without an empty branch.
    const rowsCollection = context === 'list';
    const ownsStates = UI_WORKFLOW_STATES.every(state => (rowsCollection && state === 'empty') || source.children?.some(child => child.state === state));
    const screen: UiElement = {
      id: `${context}-screen`, component: 'Stack', route: ROUTES[context],
      ...(source.bindings ? { bindings: source.bindings } : {}),
      children: ownsStates ? source.children : [
        ...(['loading', 'empty', 'error'] as const).filter(state => !(rowsCollection && state === 'empty')).map((state): UiElement => ({
          id: `${context}-${state}`, component: 'Banner', state,
          props: { title: state === 'loading' ? 'Loading' : state === 'empty' ? 'No records found' : 'Unable to load records', message: state === 'error' ? 'Try again or choose another record.' : state === 'empty' ? 'Change the filters or add a record.' : 'Loading your records.' },
        })),
        { ...source, state: 'success', bindings: undefined },
      ],
    };
    // The generated Delete action archives. Only Archivable objects can execute it.
    if (!workflow.data.traits.some(name => name.split('/').pop() === 'Archivable') && screen.bindings?.onDelete === 'handleDelete') delete screen.bindings.onDelete;
    screens.push(screen);
    for (const action of Object.values(screen.bindings ?? {})) {
      const destination = {
        handleRowClick: ['detail', 'navigate'], handleEdit: ['form', 'navigate'],
        handleSubmit: ['detail', 'save'],
        // Only a lifecycle with a billing period gains its pending state; every other cancellation saves (cancellationMode).
        handleCancel: ['detail', cancellationMode(workflow.data.lifecycleStates) === 'deferred' ? 'pending_cancellation' : 'save'],
        handleViewTimeline: ['timeline', 'navigate'], handleDelete: ['list', 'archive'],
      } as const;
      const transition = destination[action as keyof typeof destination];
      if (transition) workflow.transitions.push({ action, from: context, to: transition[0], effect: transition[1] });
    }
  }
  const schema: UiSchema = { ...first.schema, screens: [screens[0]!, ...screens.slice(1)], workflow };
  let validation: DesignComposeOutput['validation'] = { status: 'skipped' };
  if (input.options?.validate !== false) {
    const result = await validate({ mode: 'full', schema, options: { checkComponents: true } });
    validation = { status: result.status, errors: result.errors, warnings: result.warnings };
  }
  const countNodes = (node: UiElement): number => 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
  const ref = describeSchemaRef(createSchemaRef(schema, 'compose'));
  return {
    ...first, schema, validation,
    ...(first.meta ? { meta: { ...first.meta, layoutDetected: 'workflow', slotCount: results.reduce((sum, result) => sum + (result.meta?.slotCount ?? 0), 0), nodeCount: screens.reduce((sum, screen) => sum + countNodes(screen), 0) } } : {}),
    layout: 'workflow', schemaRef: ref.ref,
    schemaRefCreatedAt: ref.createdAt, schemaRefExpiresAt: ref.expiresAt,
    selections: results.flatMap((result) => result.selections),
    warnings: results.flatMap((result) => result.warnings),
  };
}
