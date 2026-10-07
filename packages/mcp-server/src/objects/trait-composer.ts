/**
 * Trait composition engine.
 * Given an object definition, merges trait schemas, view_extensions, semantics, and tokens
 * into a unified ComposedObject.
 */

import { ToolError } from '../errors/tool-error.js';
import { cancellationMode } from './cancellation-mode.js';
import { loadTrait } from './trait-loader.js';
import type {
  FieldDefinition,
  ObjectDefinition,
  SemanticMapping,
  TraitDefinition,
  TraitReference,
  ViewExtension,
} from './types.js';

// ---- Composition output types ----

export interface ResolvedTrait {
  ref: TraitReference;
  definition: TraitDefinition;
}

export interface ComposedObject {
  /** Original object header */
  object: ObjectDefinition['object'];
  /** Resolved trait references with their full definitions */
  traits: ResolvedTrait[];
  /** Merged field schema: object fields override trait fields */
  schema: Record<string, FieldDefinition>;
  /** Merged semantic mappings: object overrides traits */
  semantics: Record<string, SemanticMapping>;
  /** Collected and priority-sorted view_extensions per context */
  viewExtensions: Record<string, ViewExtension[]>;
  /** Combined token map: object tokens override trait tokens */
  tokens: Record<string, unknown>;
  /** Collision/warning messages produced during composition */
  warnings: string[];
  /** s222-m03 (#2502 ruling 14): the object's authored sample records, as its file gives them (populateObjectSchema). */
  samples?: ObjectDefinition['samples'];
}

/**
 * s206-m01: the fields a `list-behavior` trait contributes (Searchable, Filterable, Pageable, Sortable) are the
 * collection view's own state — its search query, filter count, page — never facts of a record, so no screen places
 * them as record fields; the list's search, filters and paginator come from those traits' view extensions. A field the
 * object itself or any other trait also declares stays a record field.
 */
export function viewStateFields(objectDef: ObjectDefinition, composed: ComposedObject): Set<string> {
  const listBehavior = composed.traits.filter(trait => trait.definition.trait.tags?.includes('list-behavior'));
  const recordDeclared = new Set([
    ...Object.keys(objectDef.schema ?? {}),
    ...composed.traits.filter(trait => !listBehavior.includes(trait)).flatMap(trait => Object.keys(trait.definition.schema ?? {})),
  ]);
  return new Set(listBehavior.flatMap(trait => Object.keys(trait.definition.schema ?? {})).filter(field => !recordDeclared.has(field)));
}

/** Internal type for tracking priority resolution order */
interface RankedExtension {
  extension: ViewExtension;
  traitOrder: number;
}

/**
 * The trait with each view extension's matching record-field bindings (`field` or `…Field` props) removed. An extension
 * that bound record fields and is left with none is dropped: it would present nothing of the record.
 */
function withoutBindings(traitDef: TraitDefinition, drop: (binding: { field: string }) => boolean): TraitDefinition {
  const isBinding = (key: string, value: unknown): value is string => (key === 'field' || key.endsWith('Field')) && typeof value === 'string';
  const view_extensions = Object.fromEntries(Object.entries(traitDef.view_extensions ?? {}).map(([context, extensions]) => [context, extensions.flatMap(extension => {
    const bound = Object.entries(extension.props ?? {}).filter(([key, value]) => isBinding(key, value));
    const dropped = bound.filter(([, value]) => drop({ field: value as string }));
    if (!dropped.length) return [extension];
    if (dropped.length === bound.length) return [];
    return [{ ...extension, props: Object.fromEntries(Object.entries(extension.props ?? {}).filter(([key, value]) => !(isBinding(key, value) && drop({ field: value })))) }];
  })]));
  return { ...traitDef, view_extensions };
}

/** Resolve once, before any consumer reads a trait's fields, semantics or view recipes. */
function bindTraitFields(trait: TraitDefinition, ref: TraitReference, object: ObjectDefinition): TraitDefinition {
  const bindings = ref.fieldBindings;
  if (bindings === undefined) return trait;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error(`${ref.name}.fieldBindings must be a mapping.`);
  const targets = new Set<string>();
  for (const [field, target] of Object.entries(bindings)) {
    if (!Object.hasOwn(trait.schema, field)) throw new Error(`${ref.name}.fieldBindings names unknown trait field ${field}.`);
    if (target === null) continue;
    if (typeof target !== 'string' || !Object.hasOwn(object.schema ?? {}, target)) throw new Error(`${ref.name}.${field} must bind a declared object field or null.`);
    if (targets.has(target) || target !== field && Object.hasOwn(trait.schema, target) && !Object.hasOwn(bindings, target)) throw new Error(`${ref.name}.fieldBindings binds more than one field to ${target}.`);
    if (trait.schema[field].type.replace(/\?$/, '') !== object.schema[target].type.replace(/\?$/, '')) throw new Error(`${ref.name}.${field} and ${target} must have the same field type.`);
    targets.add(target);
  }
  const name = (field: string) => Object.hasOwn(bindings, field) ? bindings[field] : field;
  const remap = <T>(fields: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(fields).flatMap(([field, value]) => name(field) === null ? [] : [[name(field)!, value]]));
  const supported = { ...trait, view_extensions: Object.fromEntries(Object.entries(trait.view_extensions).map(([context, extensions]) => [context, extensions.filter(extension =>
    !Object.entries(extension.props ?? {}).some(([key, value]) => ['field', 'amountField', 'statusField'].includes(key) && typeof value === 'string' && name(value) === null
      && !(extension.component === 'RelativeTimestamp' && typeof extension.props?.fallbackField === 'string' && name(extension.props.fallbackField) !== null)),
  )])) };
  const filtered = withoutBindings(supported, ({ field }) => name(field) === null);
  return {
    ...filtered, schema: remap(trait.schema), semantics: remap(trait.semantics),
    view_extensions: Object.fromEntries(Object.entries(filtered.view_extensions).map(([context, extensions]) => [context, extensions.map(extension => ({
      ...extension, ...(extension.props ? { props: Object.fromEntries(Object.entries(extension.props).map(([key, value]) => [key,
        (key === 'field' || key.endsWith('Field')) && typeof value === 'string' ? name(value) : value,
      ])) } : {}),
    }))])),
  };
}

const BOUND_MARK_PREVIEWS: Readonly<Record<string, { chartType: string; component: string }>> = {
  MarkArea: { chartType: 'area', component: 'VizAreaPreview' },
  MarkBar: { chartType: 'bar', component: 'VizMarkPreview' },
  MarkLine: { chartType: 'line', component: 'VizLinePreview' },
  MarkGraph: { chartType: 'force_graph', component: 'VizGraphPreview' },
  MarkPoint: { chartType: 'scatter', component: 'VizPointPreview' },
  MarkRect: { chartType: 'heatmap', component: 'VizHeatmapPreview' },
};

/**
 * Compose an object definition by resolving all its traits.
 * Merges schemas (field collision = last-trait-wins + warning),
 * collects view_extensions (priority-sorted per context),
 * and combines token maps (object overrides traits).
 * An object refining fields its traits define is how objects specialise traits, so it is reported
 * as one line naming every refined field by trait (s211-m01), not as a warning per field.
 */
export function composeObject(objectDef: ObjectDefinition): ComposedObject {
  const warnings: string[] = [];
  const schema: Record<string, FieldDefinition> = {};
  const semantics: Record<string, SemanticMapping> = {};
  const extensionsByContext: Record<string, RankedExtension[]> = {};
  const tokens: Record<string, unknown> = {};
  const resolvedTraits: ResolvedTrait[] = [];
  const fieldTrait: Record<string, string> = {};

  // 1. Process each trait in declaration order
  const traits = objectDef.traits ?? [];
  const unavailable = new Set(Object.entries(objectDef.schema ?? {}).filter(([, field]) => field.unavailable === true).map(([name]) => name));
  const lifecycleStates = traits.find(trait => trait.name.split('/').pop() === 'Stateful')?.parameters?.states;
  const cancellation = cancellationMode(Array.isArray(lifecycleStates) ? lifecycleStates : undefined);
  // A period-end flag exists only where a record can cancel at its billing period's end. Everywhere else the object
  // never supplies it: no row, editor or badge shows "Cancel at period end" (s213-m01, Sprint 212 review finding 3).
  const cancellable = traits.some(trait => trait.name.split('/').pop() === 'Cancellable');
  if (cancellable && cancellation !== 'deferred') unavailable.add('cancel_at_period_end');
  // A billing interval is a recurring cadence ("when the pricing model is subscription based"). An object whose billing
  // traits declare no recurring interval (Transaction: one_time only) never supplies one: no Interval term repeating its
  // One Time model, no one-option select (s213-m01, finding 3).
  const billing = traits.filter(trait => ['Billable', 'Priceable'].includes(trait.name.split('/').pop()!));
  const declaredIntervals = billing.map(trait => {
    let declared = trait.parameters?.billingIntervals;
    if (declared === undefined) { try { declared = loadTrait(trait.name).parameters.find(parameter => parameter.name === 'billingIntervals')?.default; } catch { declared = undefined; } }
    return Array.isArray(declared) ? declared.map(String) : [];
  });
  if (billing.length && declaredIntervals.every(intervals => !intervals.some(interval => interval !== 'one_time'))) unavailable.add('billing_interval');
  for (let traitOrder = 0; traitOrder < traits.length; traitOrder++) {
    const ref = traits[traitOrder];
    let traitDef: TraitDefinition;
    try {
      traitDef = loadTrait(ref.name);
    } catch (err) {
      throw new ToolError('OODS-V215', `Required trait "${ref.name}" is unavailable: ${(err as Error).message}`, { trait: ref.name });
    }

    // A bound chart projects existing domain fields. Mark controls belong only
    // to unbound visualization objects, never to their host's form or schema.
    if (traitDef.trait.name.startsWith('Mark') && ref.parameters?.chart) {
      const preview = BOUND_MARK_PREVIEWS[traitDef.trait.name];
      if (!preview) throw new Error(`Bound chart trait "${traitDef.trait.name}" has no supported preview projection.`);
      const chart = ref.parameters.chart;
      if (typeof chart !== 'object' || Array.isArray(chart) || !('chartType' in chart) || chart.chartType !== preview.chartType) {
        throw new Error(`Bound chart trait "${traitDef.trait.name}" requires chartType "${preview.chartType}".`);
      }
      const parameters = {
        ...Object.fromEntries(traitDef.parameters.filter(parameter => parameter.default !== undefined).map(parameter => [parameter.name, parameter.default])),
        ...ref.parameters,
      };
      const contexts = traitDef.view_extensions?.dashboard ? ['detail', 'dashboard'] : ['detail'];
      traitDef = {
        ...traitDef,
        schema: {},
        semantics: {},
        dependencies: [],
        view_extensions: Object.fromEntries(contexts.map(context => [context, [{
          component: preview.component, position: 'top', priority: 55, props: {
            chart: structuredClone(chart),
            ...(parameters.title !== undefined ? { title: parameters.title } : {}),
            ...(parameters.description !== undefined ? { description: parameters.description } : {}),
          },
        }]])),
      };
    }
    // A cancellation without a billing period is an event, not a scheduled billing-period summary: no period-end term
    // in detail and no "Cancellation scheduled" badge on a card (s213-m01: Transaction read "Cancel at period end").
    if (traitDef.trait.name === 'Cancellable' && cancellation !== 'deferred') {
      traitDef = { ...traitDef, view_extensions: { ...traitDef.view_extensions, detail: [{
        component: 'CancellationEvent', position: 'top', props: {
          title: 'Cancellation', timestampField: 'cancellation_requested_at',
          labelField: 'cancellation_reason', codeField: 'cancellation_reason_code',
        },
      }], card: (traitDef.view_extensions?.card ?? []).filter(extension => extension.component !== 'CancellationBadge') } };
      if (cancellation === 'none') warnings.push(`${objectDef.object.name} is Cancellable, but its lifecycle declares neither "cancelled" nor "pending_cancellation", so a cancellation has no state to move to.`);
    }
    // A field the object never supplies — declared unavailable (an upstream API withholds a record's owner) or inapplicable
    // (above) — is bound by no trait view; a view left with no bound record field is not placed (s213-m01, finding 2).
    traitDef = bindTraitFields(traitDef, ref, objectDef);
    if (unavailable.size) traitDef = withoutBindings(traitDef, binding => unavailable.has(binding.field));
    // RelativeTimestamp needs a primary value even when only creation time is supplied.
    if (ref.fieldBindings) traitDef = { ...traitDef, view_extensions: Object.fromEntries(Object.entries(traitDef.view_extensions).map(([context, extensions]) => [context, extensions.map(extension => extension.component === 'RelativeTimestamp' && !extension.props?.field && extension.props?.fallbackField ? { ...extension, props: { ...extension.props, field: extension.props.fallbackField } } : extension)])) };
    resolvedTraits.push({ ref, definition: traitDef });

    // Merge trait schema fields (collision = last-trait-wins with warning)
    for (const [field, fieldDef] of Object.entries(traitDef.schema)) {
      if (field in schema) {
        warnings.push(
          `Field collision: "${field}" from trait "${traitDef.trait.name}" overrides prior trait definition`,
        );
      }
      schema[field] = fieldDef;
      fieldTrait[field] = ref.name;
    }

    // Merge trait semantic mappings
    for (const [field, mapping] of Object.entries(traitDef.semantics)) {
      semantics[field] = mapping;
    }

    // Collect view_extensions with trait order for priority resolution
    for (const [context, extensions] of Object.entries(
      traitDef.view_extensions ?? {},
    )) {
      if (!extensionsByContext[context]) {
        extensionsByContext[context] = [];
      }
      for (const ext of extensions) {
        extensionsByContext[context].push({
          extension: ext,
          traitOrder,
        });
      }
    }

    // Merge trait tokens (later traits override earlier)
    for (const [key, value] of Object.entries(traitDef.tokens ?? {})) {
      tokens[key] = value;
    }
  }

  // 2. Overlay object's own schema fields (override trait fields)
  const refined = new Map<string, string[]>();
  for (const [field, fieldDef] of Object.entries(objectDef.schema ?? {})) {
    if (field in schema) refined.set(fieldTrait[field]!, [...(refined.get(fieldTrait[field]!) ?? []), field]);
    schema[field] = fieldDef;
  }
  // A field that is never supplied cannot be required: records and generated types leave it absent.
  for (const field of unavailable) if (schema[field]) schema[field] = { ...schema[field]!, required: false, unavailable: true };
  const refinedCount = [...refined.values()].flat().length;
  if (refinedCount > 0) {
    warnings.push(
      `${objectDef.object.name} refines ${refinedCount} field${refinedCount === 1 ? '' : 's'} its traits define, and its own definition${refinedCount === 1 ? ' is' : 's are'} used: ${[...refined].map(([trait, fields]) => `${trait} (${fields.join(', ')})`).join('; ')}.`,
    );
  }

  // 3. Overlay object semantic mappings
  for (const [field, mapping] of Object.entries(objectDef.semantics ?? {})) {
    const bound = traits.some(trait => Object.values(trait.fieldBindings ?? {}).includes(field));
    semantics[field] = bound && semantics[field] ? { ...semantics[field], ...mapping,
      semantic_type: mapping.semantic_type === 'text.value' ? semantics[field].semantic_type : mapping.semantic_type,
      ui_hints: { ...semantics[field].ui_hints, ...mapping.ui_hints },
    } : mapping;
  }

  // 4. Overlay object tokens (final override)
  for (const [key, value] of Object.entries(objectDef.tokens ?? {})) {
    tokens[key] = value;
  }

  // 5. Resolve view_extension priorities per context
  //    Higher priority first; same priority → earlier trait declaration order first
  const viewExtensions: Record<string, ViewExtension[]> = {};
  for (const [context, ranked] of Object.entries(extensionsByContext)) {
    if (objectDef.metadata?.supportedContexts && !objectDef.metadata.supportedContexts.includes(context)) continue;
    ranked.sort((a, b) => {
      const pA = a.extension.priority ?? 0;
      const pB = b.extension.priority ?? 0;
      if (pB !== pA) return pB - pA; // higher priority first
      return a.traitOrder - b.traitOrder; // earlier trait first on tie
    });
    viewExtensions[context] = ranked.map((r) => r.extension);
  }

  return {
    object: objectDef.object,
    traits: resolvedTraits,
    schema,
    semantics,
    viewExtensions,
    tokens,
    warnings,
    ...(objectDef.samples !== undefined ? { samples: objectDef.samples } : {}),
  };
}
