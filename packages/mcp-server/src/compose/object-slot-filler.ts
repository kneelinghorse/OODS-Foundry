import { enumOptionLabel } from './internal-fields.js';
/**
 * Object slot filler (s62-m03).
 *
 * Maps SlotPlan entries from view_extensions into UiSchema template slots.
 * Position heuristics match plan entries to template slots:
 *   top → header, main → main-content/tab-N, bottom → footer/actions,
 *   sidebar → metadata/sidebar.
 * Multiple entries targeting the same slot are stacked as children by priority.
 * Unfilled required slots fall back to selectComponent() text-based selection.
 * componentOverrides from preferences take precedence over view_extension placement.
 */

import type { UiElement, UiSchema, FieldSchemaEntry } from '../schemas/generated.js';
import type { ResolvedTrait } from '../objects/trait-composer.js';
import type { FieldDefinition, SemanticMapping } from '../objects/types.js';
import type { TemplateResult } from './templates/types.js';
import { isSlotElement, uid } from './templates/types.js';
import type { SlotPlan } from './view-extension-collector.js';
import {
  selectComponent,
  type SelectionResult,
} from './component-selector.js';
import type { ComponentCatalogSummary } from '../tools/types.js';
import { getContentStrategy, type ContentStrategy } from '../codegen/content-strategy.js';
import { inferSlotPosition, type SlotPosition } from './position-affinity.js';
import type { FieldHint } from './field-affinity.js';
import { isTraitRecipe } from './trait-recipes.js';
import { isChartPreview } from '../codegen/chart-declaration.js';
import { neutralFieldValue } from '../codegen/workflow-data-emitter.js';
import { fieldLabel } from './label-generator.js';
import { isProseSemantic, recordNameField } from './record-label.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FillResult {
  /** The modified UiSchema with slots filled */
  schema: UiSchema;
  /** Slot filling decisions for each slot */
  placements: SlotPlacement[];
  /** Warning messages */
  warnings: string[];
}

export interface SlotPlacement {
  slotName: string;
  /** How it was filled: 'view_extension', 'override', 'fallback' */
  source: 'view_extension' | 'override' | 'fallback';
  components: string[];
}

/* ------------------------------------------------------------------ */
/*  Position → slot mapping                                            */
/* ------------------------------------------------------------------ */

/**
 * Position-to-slot heuristic mapping per template layout.
 * Each position can match multiple slot names; first match wins.
 */
const POSITION_TO_SLOTS: Record<string, string[]> = {
  top: ['search', 'header', 'title', 'banner', 'metrics'],
  header: ['search', 'toolbar-actions', 'header', 'title', 'banner'],
  main: ['metrics', 'main-content', 'items'],
  bottom: ['toolbar-actions', 'pagination', 'footer', 'actions'],
  footer: ['toolbar-actions', 'pagination', 'footer', 'actions'],
  sidebar: ['filters', 'metadata', 'sidebar'],
  before: ['search', 'filters', 'header', 'banner', 'title'],
  after: ['toolbar-actions', 'pagination', 'footer', 'actions'],
};

const POSITION_TO_SLOT_PREFIXES: Record<string, string[]> = {
  top: ['metrics-section-', 'main-section-', 'field-'],
  header: [],
  main: ['metrics-section-', 'main-section-', 'field-'],
  bottom: [],
  footer: [],
  sidebar: ['sidebar-section-'],
  before: [],
  after: [],
};

const POSITION_TO_SLOT_GROUP: Partial<Record<string, SlotPosition>> = {
  top: 'header',
  header: 'header',
  before: 'header',
  main: 'main',
  bottom: 'footer',
  footer: 'footer',
  after: 'footer',
  sidebar: 'sidebar',
};

const PRIMARY_SLOT_INTENTS = new Set([
  'action-button',
  'pagination-control',
  'search-input',
]);

/**
 * Find the best matching slot for a position hint.
 * Returns the first slot name from the heuristic that exists in the template.
 */
function matchPositionToSlot(
  position: string,
  availableSlots: Set<string>,
): string | undefined {
  const candidates = POSITION_TO_SLOTS[position] ?? [];
  for (const candidate of candidates) {
    if (availableSlots.has(candidate)) {
      return candidate;
    }
  }

  const prefixes = POSITION_TO_SLOT_PREFIXES[position] ?? [];
  const available = Array.from(availableSlots).sort();
  for (const prefix of prefixes) {
    const prefixedSlot = available.find((slotName) => slotName.startsWith(prefix));
    if (prefixedSlot) {
      return prefixedSlot;
    }
  }

  const slotGroup = POSITION_TO_SLOT_GROUP[position];
  if (!slotGroup) {
    return undefined;
  }

  return available
    .filter((slotName) => inferSlotPosition(slotName) === slotGroup)
    .sort((a, b) => rankSlotForPosition(a, slotGroup) - rankSlotForPosition(b, slotGroup))[0];
}

function rankSlotForPosition(slotName: string, position: SlotPosition): number {
  switch (position) {
    case 'header':
      if (slotName === 'search') return 0;
      if (slotName === 'toolbar-actions') return 1;
      if (slotName === 'header') return 2;
      if (slotName === 'title') return 3;
      if (slotName === 'banner') return 4;
      return 10;
    case 'main':
      if (slotName === 'metrics') return 0;
      if (slotName.startsWith('metrics-section-')) return 1;
      if (slotName === 'main-content') return 2;
      if (slotName.startsWith('main-section-')) return 3;
      if (slotName.startsWith('field-')) return 4;
      if (slotName === 'items') return 5;
      return 10;
    case 'footer':
      if (slotName === 'toolbar-actions') return 0;
      if (slotName === 'pagination') return 1;
      if (slotName === 'footer') return 2;
      if (slotName === 'actions') return 3;
      return 10;
    case 'sidebar':
      if (slotName === 'filters') return 0;
      if (slotName === 'metadata') return 1;
      if (slotName === 'sidebar') return 2;
      if (slotName.startsWith('sidebar-section-')) return 3;
      return 10;
    case 'tab':
      return slotName.startsWith('tab-') ? 0 : 10;
  }
}

/* ------------------------------------------------------------------ */
/*  Tab distribution                                                   */
/* ------------------------------------------------------------------ */

/**
 * For detail layouts, distribute 'main' entries across tab-N slots
 * round-robin style when there are multiple tab slots available.
 */
function distributeToTabs(
  mainEntries: SlotPlan[],
  tabSlots: string[],
): Map<string, SlotPlan[]> {
  const distribution = new Map<string, SlotPlan[]>();
  for (const tab of tabSlots) {
    distribution.set(tab, []);
  }

  for (let i = 0; i < mainEntries.length; i++) {
    const targetTab = tabSlots[i % tabSlots.length];
    distribution.get(targetTab)!.push(mainEntries[i]);
  }

  return distribution;
}

/* ------------------------------------------------------------------ */
/*  Slot filler                                                        */
/* ------------------------------------------------------------------ */

export function fillSlotsWithObject(
  template: TemplateResult,
  slotPlan: SlotPlan[],
  catalog: ComponentCatalogSummary[],
  overrides?: Record<string, string>,
  intentContext?: string,
  fieldHints?: Map<string, FieldHint>,
): FillResult {
  const warnings: string[] = [];
  const placements: SlotPlacement[] = [];
  const knownComponents = new Set(catalog.map((c) => c.name));

  // Track which slots exist, which are filled, and which are locked by overrides
  const slotSet = new Set(template.slots.map((s) => s.name));
  const filledSlots = new Set<string>();
  const overriddenSlots = new Set<string>();
  const slotChildren = new Map<string, UiElement[]>();

  // Detect tab slots for distribution
  const tabSlots = template.slots
    .filter((s) => s.name.startsWith('tab-'))
    .map((s) => s.name)
    .sort();

  // ---- Phase 1: Apply componentOverrides first ----
  if (overrides) {
    for (const [slotName, componentName] of Object.entries(overrides)) {
      if (!slotSet.has(slotName)) continue;
      filledSlots.add(slotName);
      overriddenSlots.add(slotName);
      slotChildren.set(slotName, [
        buildElement(componentName, {}, `override-${slotName}`),
      ]);
      placements.push({
        slotName,
        source: 'override',
        components: [componentName],
      });
    }
  }

  // ---- Phase 2: Place view_extension entries by position ----

  // Separate 'main' entries for tab distribution
  const mainEntries: SlotPlan[] = [];
  const otherEntries: SlotPlan[] = [];

  for (const entry of slotPlan) {
    if (!entry.targetSlot && entry.position === 'main' && tabSlots.length > 0) {
      mainEntries.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }

  // Distribute main entries across tabs
  if (mainEntries.length > 0 && tabSlots.length > 0) {
    const tabDistribution = distributeToTabs(mainEntries, tabSlots);
    for (const [tabSlot, entries] of tabDistribution) {
      if (overriddenSlots.has(tabSlot) || entries.length === 0) continue;
      filledSlots.add(tabSlot);

      const children: UiElement[] = [];
      const components: string[] = [];
      for (const entry of entries) {
        if (!knownComponents.has(entry.component)) {
          warnings.push(
            `Skipped unregistered component "${entry.component}" from trait "${entry.sourceTrait}" while filling slot "${tabSlot}".`,
          );
          continue;
        }
        children.push(buildElement(entry.component, entry.props, `ve-${tabSlot}`));
        components.push(entry.component);
      }

      if (components.length === 0) {
        continue;
      }

      slotChildren.set(tabSlot, children);
      placements.push({
        slotName: tabSlot,
        source: 'view_extension',
        components,
      });
    }
  }

  // Place other (non-main) entries by position heuristic
  for (const entry of otherEntries) {
    const targetSlot = entry.targetSlot
      ? (slotSet.has(entry.targetSlot) ? entry.targetSlot : undefined)
      : matchPositionToSlot(entry.position, slotSet)
        ?? (entry.position === 'main' && isTraitRecipe(entry.component)
          ? [...slotSet].filter((slot) => slot.startsWith('entry-')).sort()[0]
          : undefined);
    if (!targetSlot) {
      const targetDescription = entry.targetSlot
        ? `slot "${entry.targetSlot}"`
        : `position "${entry.position}"`;
      warnings.push(
        `No matching slot for ${targetDescription} from ${entry.sourceTrait}/${entry.component}.`,
      );
      continue;
    }

    if (overriddenSlots.has(targetSlot)) {
      // Slot locked by override — skip view_extension
      continue;
    } else if (filledSlots.has(targetSlot)) {
      // Stack into existing slot (another view_extension already placed)
      if (!knownComponents.has(entry.component)) {
        warnings.push(
          `Skipped unregistered component "${entry.component}" from trait "${entry.sourceTrait}" while filling slot "${targetSlot}".`,
        );
        continue;
      }
      const existing = slotChildren.get(targetSlot) ?? [];
      existing.push(buildElement(entry.component, entry.props, `ve-${targetSlot}`));
      slotChildren.set(targetSlot, existing);

      const placement = placements.find((p) => p.slotName === targetSlot);
      if (placement) {
        placement.components.push(entry.component);
      }
    } else {
      if (!knownComponents.has(entry.component)) {
        warnings.push(
          `Skipped unregistered component "${entry.component}" from trait "${entry.sourceTrait}" while filling slot "${targetSlot}".`,
        );
        continue;
      }

      filledSlots.add(targetSlot);
      slotChildren.set(targetSlot, [
        buildElement(entry.component, entry.props, `ve-${targetSlot}`),
      ]);
      placements.push({
        slotName: targetSlot,
        source: 'view_extension',
        components: [entry.component],
      });
    }
  }

  // ---- Phase 3: Fallback for unfilled required slots ----
  for (const slot of template.slots) {
    if (!filledSlots.has(slot.name)) continue;
    // A new domain chart supplements the record identity; its top position
    // must not consume the required header's fallback component.
    const chartHeader = slot.name === 'header' && slotChildren.get(slot.name)?.some(child => child.chart?.source === 'record-array' || child.chart?.source === 'edge-array');
    if (!PRIMARY_SLOT_INTENTS.has(slot.intent) && !chartHeader) continue;
    // Optional action-or-metadata slots already have their authored content.
    // Adding a default button here invents an empty, unbound action.
    if (!slot.required && slot.intent === 'action-button') continue;

    const existingChildren = slotChildren.get(slot.name);
    if (!existingChildren || existingChildren.length === 0) continue;

    const existingComponents = new Set(existingChildren.map((child) => child.component));
    const slotPosition = inferSlotPosition(slot.name);
    const slotFieldHint = !FORM_CONTROL_INTENTS.has(slot.intent)
      ? fieldHints?.get(slot.name)
      : undefined;
    const primarySelection = selectComponent(slot.intent, catalog, {
      topN: 1,
      intentContext: FORM_CONTROL_INTENTS.has(slot.intent)
        ? (intentContext ? [intentContext] : [])
        : (intentContext ? [intentContext, slot.description] : [slot.description]),
      ...(slotFieldHint ? { fieldHint: slotFieldHint } : {}),
      ...(slotPosition ? { slotPosition } : {}),
    });
    const primaryComponent = primarySelection.candidates[0]?.name;

    if (!primaryComponent || existingComponents.has(primaryComponent)) {
      continue;
    }

    existingChildren.unshift(buildElement(primaryComponent, {}, `primary-${slot.name}`));

    const placement = placements.find((entry) => entry.slotName === slot.name);
    if (placement) {
      placement.components.unshift(primaryComponent);
    }
  }

  for (const slot of template.slots) {
    if (filledSlots.has(slot.name)) continue;
    if (!slot.required) continue;

    const slotPosition = inferSlotPosition(slot.name);
    const slotFieldHint = !FORM_CONTROL_INTENTS.has(slot.intent)
      ? fieldHints?.get(slot.name)
      : undefined;
    const result: SelectionResult = selectComponent(slot.intent, catalog, {
      topN: 1,
      intentContext: FORM_CONTROL_INTENTS.has(slot.intent)
        ? (intentContext ? [intentContext] : [])
        : (intentContext ? [intentContext, slot.description] : [slot.description]),
      ...(slotFieldHint ? { fieldHint: slotFieldHint } : {}),
      ...(slotPosition ? { slotPosition } : {}),
    });

    const selected = result.candidates[0]?.name;
    if (selected) {
      filledSlots.add(slot.name);
      slotChildren.set(slot.name, [
        buildElement(selected, {}, `fb-${slot.name}`),
      ]);
      placements.push({
        slotName: slot.name,
        source: 'fallback',
        components: [selected],
      });
    }
  }

  // ---- Phase 4: Apply to UiSchema ----
  const schema = structuredClone(template.schema);
  applyToSchema(schema, slotChildren);

  return { schema, placements, warnings };
}

/* ------------------------------------------------------------------ */
/*  Token injection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Inject ComposedObject.tokens into the UiSchema as tokenOverrides.
 * Only string values are included (non-string values are skipped with a warning).
 */
export function injectTokenOverrides(
  schema: UiSchema,
  tokens: Record<string, unknown>,
): string[] {
  const warnings: string[] = [];
  const overrides: Record<string, string> = {};

  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === 'string') {
      overrides[key] = value;
    } else {
      warnings.push(
        `Token "${key}" has non-string value (${typeof value}), skipped.`,
      );
    }
  }

  if (Object.keys(overrides).length > 0) {
    schema.tokenOverrides = overrides;
  }

  return warnings;
}

/* ------------------------------------------------------------------ */
/*  Object schema bridge                                               */
/* ------------------------------------------------------------------ */

/**
 * s213-m03 (Sprint 212 review finding 7): a field is money only when its semantics say so, with
 * `ui_hints.component: CurrencyAmount` and the record field holding its currency (`currencyField`). It is stored in
 * minor units only when the declaration gives the factor, as `minorUnits` or as `minorUnitsParameter` naming the trait
 * parameter that holds it; otherwise the amount is in major units. Nothing is inferred from a field's name: a team's
 * `amount` of 19.99 is 19.99, never 0.1999.
 */
function declaredMoney(
  fieldName: string,
  fieldSchema: Record<string, FieldDefinition>,
  semantics: Record<string, SemanticMapping> | undefined,
  traits: ResolvedTrait[],
  owner: ResolvedTrait | undefined,
): FieldSchemaEntry['money'] | undefined {
  const hints = semantics?.[fieldName]?.ui_hints;
  if (hints?.component !== 'CurrencyAmount') return undefined;
  const money: NonNullable<FieldSchemaEntry['money']> = {};
  // A trait names the currency field its objects usually carry; an object without it shows the amount as a number
  // (object validate says so).
  if (typeof hints.currencyField === 'string' && Object.hasOwn(fieldSchema, hints.currencyField)) money.currencyField = hints.currencyField;
  const parameter = hints.minorUnitsParameter;
  const declaring = typeof parameter === 'string'
    ? [owner, ...traits].find(trait => trait?.definition.parameters.some(entry => entry.name === parameter))
    : undefined;
  const factor = typeof hints.minorUnits === 'number' ? hints.minorUnits
    : declaring ? declaring.ref.parameters?.[parameter as string] ?? declaring.definition.parameters.find(entry => entry.name === parameter)?.default
      : undefined;
  if (typeof parameter === 'string' && factor === undefined) throw new Error(`Minor units for ${fieldName} name the parameter "${parameter}", which none of the object's traits declares.`);
  if (factor !== undefined) {
    if (!Number.isSafeInteger(factor) || (factor as number) < 1) throw new Error(`Minor units for ${fieldName} must be a positive whole number, not ${JSON.stringify(factor)}.`);
    money.minorUnits = factor as number;
  }
  return money;
}

/**
 * s222-m03 (#2502 ruling 14; #2384, #2425, #2426): an object's authored `samples` — partial records, by field name —
 * become each named field's `examples`, aligned by index, so sample i is example i of every field it names, trait fields
 * included, and no trait field is copied into the object's schema to carry them. A field no sample names keeps its own
 * authored examples. Where sample i leaves out a field another sample names, record i takes that field's own authored
 * example at index i, else the field's neutral typed value (`null` where the value is absent): never another sample's
 * value, an enum member or a default, because a sample that leaves a field out has not recorded it, and a default would
 * state a fact its author did not (a churned organization "in good standing"). A sample that names a field the object
 * does not have or never supplies, or an enum value the field does not allow, is an authoring error.
 */
function applySamples(objectSchema: Record<string, FieldSchemaEntry>, samples: unknown): void {
  if (samples === undefined) return;
  if (!Array.isArray(samples) || samples.some(sample => !sample || typeof sample !== 'object' || Array.isArray(sample))) {
    throw new Error('Invalid samples: samples must be a list of records, each naming field values.');
  }
  const records = samples as Array<Record<string, unknown>>;
  for (const field of new Set(records.flatMap(sample => Object.keys(sample)))) {
    const entry = Object.hasOwn(objectSchema, field) ? objectSchema[field]! : undefined;
    const naming = records.findIndex(sample => Object.hasOwn(sample, field)) + 1;
    if (!entry) throw new Error(`Invalid samples: sample ${naming} names "${field}", which is not a field of this object.`);
    if (entry.unavailable) throw new Error(`Invalid samples: sample ${naming} names "${field}", a field this object never supplies.`);
    const own = entry.examples ?? [];
    entry.examples = records.map((sample, index) => {
      if (!Object.hasOwn(sample, field)) return structuredClone(index < own.length ? own[index] : neutralFieldValue(entry) ?? null);
      const value = sample[field];
      if (entry.enum?.length && value != null && !entry.enum.includes(value as string)) {
        throw new Error(`Invalid samples: sample ${index + 1} gives ${field} "${String(value)}", which is not one of ${entry.enum.join(', ')}.`);
      }
      return structuredClone(value);
    });
  }
}

/**
 * Convert ComposedObject.schema (FieldDefinition map) into a codegen-friendly
 * objectSchema on the UiSchema root. Each FieldSchemaEntry carries type, required,
 * optional enum, description, and semanticType for downstream typed prop generation.
 * The object's authored `samples`, when it has them, become aligned per-field examples (applySamples).
 */
export function populateObjectSchema(
  schema: UiSchema,
  fieldSchema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
  traits: ResolvedTrait[] = [],
  samples?: unknown,
): void {
  const objectSchema: Record<string, FieldSchemaEntry> = {};

  for (const [fieldName, fieldDef] of Object.entries(fieldSchema)) {
    const entry: FieldSchemaEntry = {
      type: fieldDef.type,
      required: fieldDef.required,
    };

    const owner = traits.find(trait => trait.definition.schema[fieldName] === fieldDef);
    // s219-m01: an object that redeclares a trait's field (to author its examples) keeps resolving that trait's
    // parameters, so the refined field has the same enum and default as the field it refines.
    const parameterOwner = owner ?? traits.find(trait => Object.hasOwn(trait.definition.schema ?? {}, fieldName));
    const parameter = fieldDef.defaultFromParameter;
    const declaredDefault = parameter && parameterOwner
      ? parameterOwner.ref.parameters?.[parameter] ?? parameterOwner.definition.parameters.find(entry => entry.name === parameter)?.default ?? fieldDef.default
      : fieldDef.default;
    if (declaredDefault !== undefined) entry.default = structuredClone(declaredDefault);
    // Stateful's authored initial state is the sample history origin, not enum order.
    if ((fieldName === 'status' || traits.some(trait => trait.ref.name.split('/').pop() === 'Stateful' && trait.ref.fieldBindings?.status === fieldName)) && entry.default === undefined) {
      const lifecycle = traits.find(trait => trait.ref.name.split('/').pop() === 'Stateful');
      const initial = lifecycle?.ref.parameters?.initialState ?? lifecycle?.definition.parameters.find(parameter => parameter.name === 'initialState')?.default;
      if (typeof initial === 'string') entry.default = initial;
    }
    if (fieldDef.examples?.length) entry.examples = structuredClone([...fieldDef.examples]);
    if (fieldDef.unavailable === true) entry.unavailable = true;

    if (fieldDef.description) {
      entry.description = fieldDef.description;
    }

    const enumParameter = fieldDef.validation?.enumFromParameter;
    const parameterValues = enumParameter && parameterOwner ? parameterOwner.ref.parameters?.[enumParameter] ?? parameterOwner.definition.parameters.find(entry => entry.name === enumParameter)?.default : undefined;
    if (Array.isArray(parameterValues)) entry.enum = parameterValues.map(String);

    if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
      entry.enum = fieldDef.validation.enum;
    }

    if (semantics?.[fieldName]?.semantic_type) {
      entry.semanticType = semantics[fieldName].semantic_type;
    }
    const displayLabel = semantics?.[fieldName]?.ui_hints?.label;
    if (typeof displayLabel === 'string') entry.displayLabel = displayLabel;
    const enumLabels = semantics?.[fieldName]?.ui_hints?.enumLabels;
    if (enumLabels && typeof enumLabels === 'object' && !Array.isArray(enumLabels)) {
      entry.enumLabels = Object.fromEntries(Object.entries(enumLabels).filter((pair): pair is [string, string] => typeof pair[1] === 'string'));
    }

    const fallback = semantics?.[fieldName]?.ui_hints?.displayFallbackField;
    if (typeof fallback === 'string') {
      if (fallback === fieldName || !Object.hasOwn(fieldSchema, fallback)) throw new Error(`Invalid display fallback for ${fieldName}: ${fallback}`);
      entry.displayFallbackField = fallback;
    }

    const label = semantics?.[fieldName]?.ui_hints?.displayLabelField;
    if (typeof label === 'string') {
      if (label === fieldName || !Object.hasOwn(fieldSchema, label) || !/^string\??$/.test(fieldSchema[label].type)) throw new Error(`Invalid reference label for ${fieldName}: ${label}`);
      entry.displayLabelField = label;
    }

    const money = declaredMoney(fieldName, fieldSchema, semantics, traits, owner);
    if (money) entry.money = money;

    // s223-m01 (#2527 ruling 4): a number's display format is declared, as money is; nothing is read from its name.
    // Taggable, Pageable and Filterable have long written `format: integer` as a type note; it changes nothing on screen.
    const format = semantics?.[fieldName]?.ui_hints?.format;
    if (format === 'percent' || format === 'quantity') entry.format = format;
    else if (format !== undefined && format !== 'integer') throw new Error(`Invalid display format for ${fieldName}: ${JSON.stringify(format)} (percent or quantity).`);

    objectSchema[fieldName] = entry;
  }
  applySamples(objectSchema, samples);

  if (Object.keys(objectSchema).length > 0) {
    schema.objectSchema = objectSchema;
  }
}

/* ------------------------------------------------------------------ */
/*  Context-aware bindings                                             */
/* ------------------------------------------------------------------ */

/**
 * Context → default event binding map.
 * Each context defines which event bindings should appear on relevant elements.
 */
const CONTEXT_BINDINGS: Record<string, Record<string, string>> = {
  form: {
    onSubmit: 'handleSubmit',
    onChange: 'handleChange',
  },
  list: {
    onRowClick: 'handleRowClick',
    onSort: 'handleSort',
    onFilter: 'handleFilter',
  },
  detail: {
    onEdit: 'handleEdit',
    onDelete: 'handleDelete',
  },
};

/**
 * Populate UiElement.bindings with context-appropriate event mappings.
 * Form context adds onChange per field-bound component and onSubmit on the root form.
 * List/detail contexts add action bindings on the root screen element.
 * Only applies when a context is known; no-op otherwise (backward compatible).
 */
export function populateBindings(
  schema: UiSchema,
  context: string,
  fieldNames?: string[],
  traitNames: readonly string[] = [],
  readOnly = false,
): void {
  const contextBindings = CONTEXT_BINDINGS[context];
  if (!contextBindings) return;
  // s206-m01: a read-only record (it composes no form) is shown, never edited — its detail offers no Edit, which
  // would open a form it does not have, and no Delete, since Forge writes nothing to it.
  const offered = readOnly
    ? Object.fromEntries(Object.entries(contextBindings).filter(([event]) => event !== 'onEdit' && event !== 'onDelete'))
    : contextBindings;

  for (const screen of schema.screens) {
    // Add context-level bindings to the root screen element
    screen.bindings = { ...screen.bindings, ...offered };
    // These actions belong to every object carrying the trait, not to an app assembler.
    if (['detail', 'form'].includes(context) && traitNames.some((name) => name.split('/').pop() === 'Cancellable')) {
      screen.bindings.onCancel = 'handleCancel';
    }
    if (context === 'detail' && traitNames.some((name) => name.split('/').pop() === 'Timestampable')) {
      screen.bindings.onViewTimeline = 'handleViewTimeline';
    }

    // For form context, walk the tree and add per-field onChange bindings
    if (context === 'form' && fieldNames && fieldNames.length > 0) {
      populateFormFieldBindings(screen, fieldNames);
    }
  }
}

/**
 * Walk the element tree and add per-field onChange bindings to elements
 * whose props reference a known field name (via `field` prop).
 */
function populateFormFieldBindings(el: UiElement, fieldNames: string[]): void {
  const fieldSet = new Set(fieldNames);

  const walk = (node: UiElement): void => {
    // If this element has a `field` prop matching a known field, add onChange binding
    const fieldProp = node.props?.field;
    // Display headers own no edit event; ClassificationEditor has no generic field writer.
    if (!['ClassificationEditor', 'DetailHeader'].includes(node.component) && !node.bindings?.onUpdate && typeof fieldProp === 'string' && fieldSet.has(fieldProp)) {
      node.bindings = {
        ...node.bindings,
        onChange: `handleChange_${fieldProp}`,
      };
    }
    node.children?.forEach(walk);
  };

  walk(el);
}

/* ------------------------------------------------------------------ */
/*  Field → component prop wiring                                      */
/* ------------------------------------------------------------------ */

/**
 * Field type to preferred component content strategy mapping.
 * Used to rank how well a field type matches a component's strategy.
 */
const FIELD_TYPE_PREFERRED_STRATEGY: Record<string, ContentStrategy[]> = {
  string:   ['children', 'label-prop', 'value-prop'],
  integer:  ['children', 'value-prop'],
  number:   ['children', 'value-prop'],
  boolean:  ['value-prop'],
  datetime: ['children'],
  date:     ['children'],
  email:    ['children', 'value-prop'],
  url:      ['children'],
  uuid:     ['children'],
};

/**
 * Enum fields prefer status/label display over plain text.
 */
const ENUM_PREFERRED_STRATEGY: ContentStrategy[] = ['status-prop', 'label-prop', 'children'];

const AUTO_BIND_COMPONENT_BLACKLIST = new Set([
  'Button',
]);

const FORM_CONTROL_INTENTS = new Set([
  'boolean-input',
  'date-input',
  'email-input',
  'enum-input',
  'form-input',
  'long-text-input',
]);

function getExplicitFieldRefs(props: Record<string, unknown> | undefined): Set<string> {
  const refs = new Set<string>();
  if (!props) return refs;

  for (const [key, value] of Object.entries(props)) {
    if (key !== 'field' && !/Field(?:s)?$/.test(key)) {
      continue;
    }

    if (typeof value === 'string' && value.trim()) {
      refs.add(value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) {
          refs.add(entry);
        }
      }
    }
  }

  return refs;
}

function normalizeFieldType(type: string): string {
  return type.trim().toLowerCase();
}

function isArrayFieldType(type: string): boolean {
  const normalized = normalizeFieldType(type);
  return normalized === 'array' || normalized.endsWith('[]');
}

function isComplexFieldType(type: string): boolean {
  const trimmed = type.trim();
  const normalized = normalizeFieldType(type);

  if (normalized === 'object' || normalized === 'object[]' || normalized.startsWith('record<')) {
    return true;
  }

  if (/^[A-Z]/.test(trimmed)) {
    return true;
  }

  return false;
}

function isStatusField(fieldName: string, fieldEntry: FieldSchemaEntry): boolean {
  const semantic = fieldEntry.semanticType?.toLowerCase() ?? '';
  const lowerName = fieldName.toLowerCase();

  if (/(^|\.)(status|lifecycle)(\.|$)/.test(semantic)) return true;
  return lowerName === 'status' || lowerName.endsWith('_status') || lowerName.endsWith('_state');
}

function isTemporalField(fieldName: string, fieldEntry: FieldSchemaEntry): boolean {
  const semantic = fieldEntry.semanticType?.toLowerCase() ?? '';
  const lowerName = fieldName.toLowerCase();

  if (fieldEntry.type === 'date' || fieldEntry.type === 'datetime') return true;
  if (/(^|\.)(timestamp|date|time|audit)(\.|$)/.test(semantic)) return true;
  return lowerName.endsWith('_at')
    || lowerName.includes('timestamp')
    || lowerName.endsWith('_date')
    || lowerName.endsWith('_time');
}

function isSearchField(fieldName: string, fieldEntry: FieldSchemaEntry): boolean {
  const semantic = fieldEntry.semanticType?.toLowerCase() ?? '';
  const lowerName = fieldName.toLowerCase();

  // Active/focused state is not query text, even when its semantic name contains search.
  return fieldEntry.type === 'string' && (semantic.includes('search')
    || lowerName.includes('search')
    || lowerName.endsWith('query'));
}

function isTagField(fieldName: string, fieldEntry: FieldSchemaEntry): boolean {
  const semantic = fieldEntry.semanticType?.toLowerCase() ?? '';
  const lowerName = fieldName.toLowerCase();

  if (semantic.includes('tag') || semantic.includes('taxonomy')) return true;
  if (lowerName === 'tags' || lowerName === 'tag_count' || lowerName.includes('tag_')) return true;
  return isArrayFieldType(fieldEntry.type) && lowerName.includes('tag');
}

function isLabelField(fieldName: string, fieldEntry: FieldSchemaEntry): boolean {
  const semantic = fieldEntry.semanticType?.toLowerCase() ?? '';
  const lowerName = fieldName.toLowerCase();

  if (isComplexFieldType(fieldEntry.type) || isArrayFieldType(fieldEntry.type)) return false;

  if (semantic.includes('label') || semantic.includes('name') || semantic.includes('title')) {
    return true;
  }

  return lowerName === 'label'
    || lowerName === 'name'
    || lowerName.endsWith('_name')
    || lowerName.endsWith('_label')
    || lowerName.endsWith('_title')
    || lowerName.includes('description')
    || lowerName.includes('summary');
}

function isGenericFieldCompatible(
  strategy: ContentStrategy,
  fieldEntry: FieldSchemaEntry,
): boolean {
  switch (strategy) {
    case 'value-prop':
    case 'label-prop':
      return !isComplexFieldType(fieldEntry.type) && !isArrayFieldType(fieldEntry.type);
    case 'children':
      return !isComplexFieldType(fieldEntry.type);
    case 'status-prop':
      return false;
    case 'none':
    default:
      return false;
  }
}

function isFieldCompatibleWithNode(
  node: UiElement,
  fieldName: string,
  fieldEntry: FieldSchemaEntry,
): boolean {
  // A typed chart fragment or SVG is authored as a whole; a spare domain field
  // must not replace it or turn its declared recipe into a generic field reader.
  if (node.props?.intentParameter !== undefined || node.props?.svgParameter !== undefined) return false;
  if (AUTO_BIND_COMPONENT_BLACKLIST.has(node.component)) {
    return false;
  }

  switch (node.component) {
    case 'StatusBadge':
    case 'MessageStatusBadge':
    case 'ColorizedBadge':
      return isStatusField(fieldName, fieldEntry);
    case 'RelativeTimestamp':
    case 'TimelineTimestamp':
      return isTemporalField(fieldName, fieldEntry);
    case 'SearchInput':
      return isSearchField(fieldName, fieldEntry);
    case 'TagInput':
    case 'TagPills':
    case 'TagSummary':
      return isTagField(fieldName, fieldEntry);
    case 'LabelCell':
    case 'DetailHeader':
    case 'InlineLabel':
    case 'TimelineEntryLabel':
      return isLabelField(fieldName, fieldEntry);
    default:
      return isGenericFieldCompatible(getContentStrategy(node.component), fieldEntry);
  }
}

function applyBoundFieldProps(
  node: UiElement,
  fieldName: string,
  fieldEntry: FieldSchemaEntry,
): void {
  if (node.props?.intentParameter !== undefined || node.props?.svgParameter !== undefined) return;
  // A continuous quantity has no finite choices. Preserve the selected field
  // with a numeric editor instead of an empty Select that cannot display it.
  if (node.component === 'Select' && !fieldEntry.enum?.length
    && !node.props?.options && ['integer', 'number'].includes(fieldEntry.type)) {
    node.component = 'Input';
    node.props = { ...node.props, type: 'number' };
    node.bindings = { ...node.bindings, onChange: node.bindings?.onChange ?? `handleChange_${fieldName}` };
  }
  // A composed, bound search needs a local value update for typing and clear.
  // The component's semantic update covers both; a native change alone misses clear.
  if (node.component === 'SearchInput' && fieldEntry.type === 'string' && !Object.keys(node.bindings ?? {}).length) {
    node.bindings = { onUpdate: `handleUpdate_${fieldName}` };
  }
  const nextProps: Record<string, unknown> = {
    ...(node.props ?? {}),
    field: fieldName,
  };

  // Keep value badges free of synthetic labels that would shadow their bound state.
  // Other supported components retain field-description labels.
  if (!['StatusTimeline', 'ArchivePill', 'CancellationBadge', 'ColorStatePicker', 'GeoResolutionBadge', 'RelativeTimestamp'].includes(node.component) && fieldEntry.description && typeof nextProps.label !== 'string') {
    nextProps.label = fieldEntry.description;
  }

  if (node.component === 'Input' && typeof nextProps.type !== 'string') {
    switch (fieldEntry.type) {
      case 'email':
        nextProps.type = 'email';
        break;
      case 'url':
        nextProps.type = 'url';
        break;
      case 'integer':
      case 'number':
        nextProps.type = 'number';
        break;
    }
  }

  if (node.component === 'Select' && fieldEntry.enum && fieldEntry.enum.length > 0) {
    if (!nextProps.options) {
      nextProps.options = fieldEntry.enum.map(value => ({ value, label: enumOptionLabel(value, fieldEntry.enumLabels) }));
    }
  }

  node.props = nextProps;
}

/**
 * Walk the UiSchema tree and set `props.field` on leaf components that
 * match objectSchema fields. Uses field type, component content strategy,
 * and field name heuristics for intelligent matching.
 *
 * Each field is assigned to at most one component. Each leaf component
 * gets at most one field. Fields are matched in priority order:
 * required fields first, then by name match quality.
 */
export function wireFieldProps(
  schema: UiSchema,
  viewState: ReadonlySet<string> = new Set(),
): number {
  const objectSchema = schema.objectSchema;
  if (!objectSchema || Object.keys(objectSchema).length === 0) return 0;

  // Collect leaf components that accept field content
  const leafNodes: UiElement[] = [];
  const walkCollect = (el: UiElement): void => {
    const hasChildren = Array.isArray(el.children) && el.children.length > 0;
    if (!hasChildren && getContentStrategy(el.component) !== 'none') {
      leafNodes.push(el);
    }
    el.children?.forEach(walkCollect);
  };
  schema.screens.forEach(walkCollect);

  if (leafNodes.length === 0) return 0;

  // Sort fields: required first, then alphabetical. s206-m01: a list-behavior trait's view state (search query,
  // filter count, page) is never bound to a leaf by affinity — it is not a fact of the record.
  const fields = Object.entries(objectSchema).filter(([name]) => !viewState.has(name)).sort(([aName, aEntry], [bName, bEntry]) => {
    if (aEntry.required !== bEntry.required) return aEntry.required ? -1 : 1;
    return aName.localeCompare(bName);
  });

  const assignedNodes = new Set<UiElement>();
  const assignedFields = new Set<string>();
  let boundCount = 0;

  for (const node of leafNodes) {
    const refs = getExplicitFieldRefs(node.props);
    const explicitField = typeof node.props?.field === 'string'
      ? node.props.field
      : undefined;
    if (refs.size === 0) continue;

    assignedNodes.add(node);
    for (const ref of refs) {
      if (objectSchema[ref]) {
        assignedFields.add(ref);
        if (explicitField === ref) {
          applyBoundFieldProps(node, ref, objectSchema[ref]);
        }
      }
    }
  }

  // Pass 1: Try to match fields to components with strategy+type affinity
  for (const [fieldName, fieldEntry] of fields) {
    if (assignedFields.has(fieldName)) continue;

    const preferredStrategies = fieldEntry.enum && fieldEntry.enum.length > 0
      ? ENUM_PREFERRED_STRATEGY
      : FIELD_TYPE_PREFERRED_STRATEGY[fieldEntry.type] ?? ['children'];

    let bestNode: UiElement | undefined;
    let bestScore = -1;

    for (const node of leafNodes) {
      if (assignedNodes.has(node)) continue;
      if (!isFieldCompatibleWithNode(node, fieldName, fieldEntry)) continue;

      const strategy = getContentStrategy(node.component);
      const strategyIdx = preferredStrategies.indexOf(strategy);
      if (strategyIdx < 0 && strategy !== 'children') continue;

      // Score: higher is better. Strategy match priority (inverted index) + name affinity bonus
      let score = strategyIdx >= 0
        ? (preferredStrategies.length - strategyIdx) * 10
        : 4;

      // Bonus if the component name hints at the field
      const componentLower = node.component.toLowerCase();
      const fieldLower = fieldName.toLowerCase();
      if (componentLower.includes(fieldLower) || fieldLower.includes(componentLower)) {
        score += 5;
      }

      // Bonus if the node already has a props.field matching or similar
      if (node.props?.field === fieldName) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (bestNode) {
      applyBoundFieldProps(bestNode, fieldName, fieldEntry);
      assignedNodes.add(bestNode);
      assignedFields.add(fieldName);
      boundCount++;
    }
  }

  return boundCount;
}

/* ------------------------------------------------------------------ */
/*  Selection → tree application                                       */
/* ------------------------------------------------------------------ */

/**
 * Selection entry from fillSlots() in design.compose.ts.
 * Mirrors SlotSelectionEntry but only needs slotName + selectedComponent.
 */
export interface SelectionEntry {
  slotName: string;
  selectedComponent?: string;
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
}

/**
 * Apply computed selection results to the UiSchema tree.
 *
 * Walks the tree looking for slot placeholder elements (identified by
 * meta.intent = "slot:<name>") and replaces their `component` with
 * the top-ranked selected component from the selection engine.
 *
 * This bridges the gap where fillSlots() generates intelligence-aware
 * rankings (field affinity, position affinity) but doesn't modify the tree.
 */
export function applySelectionsToSchema(
  schema: UiSchema,
  selections: SelectionEntry[],
): number {
  const selectionMap = new Map<string, SelectionEntry>();
  for (const sel of selections) {
    if (sel.selectedComponent) {
      selectionMap.set(sel.slotName, sel);
    }
  }

  if (selectionMap.size === 0) return 0;

  let applied = 0;

  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && selectionMap.has(slotName)) {
        const sel = selectionMap.get(slotName)!;
        el.component = sel.selectedComponent!;
        // Attach confidence metadata to the element for render-time affordances
        if (sel.confidence !== undefined) {
          el.meta = {
            ...el.meta,
            confidence: sel.confidence,
            ...(sel.confidenceLevel ? { confidenceLevel: sel.confidenceLevel } : {}),
          };
        }
        applied++;
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return applied;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildElement(
  component: string,
  props: Record<string, unknown>,
  prefix: string,
): UiElement {
  const el: UiElement = {
    id: uid(prefix),
    component,
  };
  if (Object.keys(props).length > 0) {
    el.props = { ...props };
    if (isChartPreview(component) && props.chart) {
      el.chart = structuredClone(props.chart) as UiElement['chart'];
      delete el.props.chart;
    }
  }
  return el;
}

function resolveSlotName(el: UiElement): string | undefined {
  if (el.meta?.label) return el.meta.label;
  if (el.meta?.intent?.startsWith('slot:')) {
    return el.meta.intent.slice('slot:'.length);
  }
  return undefined;
}

function applyToSchema(
  schema: UiSchema,
  slotChildren: Map<string, UiElement[]>,
): void {
  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && slotChildren.has(slotName)) {
        const children = slotChildren.get(slotName)!;
        if (children.length === 1) {
          // Single component: replace the slot element directly
          el.component = children[0].component;
          el.props = children[0].props;
          if (children[0].chart) el.chart = children[0].chart;
          // Keep meta for traceability
        } else if (children.length > 1) {
          // Multiple components: wrap in a Stack
          el.component = 'Stack';
          el.children = children;
          el.layout = { type: 'stack', gapToken: 'cluster-default' };
        }
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/**
 * Drop slot placeholders nothing ever filled, when the placeholder would be visible on the page.
 *
 * A template declares its slots by putting a placeholder element in the tree and letting the filler
 * replace it. Where nothing fills a slot the placeholder survives, which is harmless for a layout
 * container — an empty `Stack` renders an empty div — but not for a control: the card template's
 * footer placeholder is a `Button`, so every object whose card footer stays empty shipped a focusable
 * button with no text and no accessible name at all (axe `button-name`, found on Article, Media,
 * Invoice and Usage in Sprint 203 m01 and reproduced by Person in m03, which is what identified the
 * card template rather than those objects as the cause).
 *
 * An empty control is worse than no control, so the placeholder is removed rather than given invented
 * copy: naming it would put a button on the page that does nothing.
 *
 * A container placeholder that PAINTS is a different problem with a different answer, and it is not
 * dropped: see `neutralizeUnfilledSurfaceSlots` below.
 */
export function dropUnfilledInteractiveSlots(schema: UiSchema): number {
  /**
   * Placeholders that draw something. Controls a keyboard or screen-reader user can reach, and
   * surfaces that paint a border or background; an empty one of either is a defect, not a layout gap.
   */
  const INTERACTIVE = new Set(['Button', 'Input', 'Select', 'Checkbox', 'Textarea', 'DatePicker']);
  let dropped = 0;
  // s223-m01 (#2527 ruling 6): a layout Stack whose only content was a dropped placeholder (the card footer around its
  // unfilled action button) is left with nothing; it is no slot anchor, and kept it would add a gap and padding below
  // the card's content.
  const emptied = new WeakSet<UiElement>();
  const unfilled = (el: UiElement): boolean =>
    (isSlotElement(el)
    && INTERACTIVE.has(el.component)
    && !el.children?.length
    && Object.keys(el.props ?? {}).length === 0)
    // Reconciliation can remove a duplicated/internal editor. Its surrounding
    // form group is layout only and must not leave a blank section behind.
    || (/^form-field-group-/.test(el.id) && !el.children?.length)
    || emptied.has(el);
  const walk = (el: UiElement): void => {
    if (el.children?.length) {
      el.children.forEach(walk);
      const kept = el.children.filter(child => !unfilled(child));
      dropped += el.children.length - kept.length;
      el.children = kept;
      if (!kept.length && el.component === 'Stack' && !isSlotElement(el)) emptied.add(el);
    }
  };
  schema.screens.forEach(walk);
  return dropped;
}

/**
 * Stop an unfilled slot placeholder from painting an empty bordered box, without moving the anchor
 * anything targets.
 *
 * Sprint 203 m04 measured this and left it (decision #2169): every card in the registry drew an empty
 * bordered box under its header, because the card template's body placeholder is a `Card` that nothing
 * fills for any object. Dropping it — the answer `dropUnfilledInteractiveSlots` gives a control —
 * would take the anchor with it, and that anchor is what a `componentOverrides` preference and a
 * `design.preview` slot swap target. The s203 review ruled (#2180) that the placeholder is kept and
 * rendered as a zero-height anchor instead, and that is what this does: the element stays, its `id`
 * stays (the fragment anchor), its `meta.intent` of `slot:<name>` stays (the slot identity), and only
 * the painted chrome goes.
 *
 * `SURFACE` is one name rather than a guess. Across all 112 entries of the canonical component
 * contracts, `Card` is the ONLY component whose `tokenRoles` carry both a `surface.*` and a
 * `border.*` role — that is, the only one an empty instance of which draws a box. Measured in
 * s204-m02, and `card-body-anchor.s204.spec.ts` re-derives it from the contracts so a future
 * component that starts painting a border cannot quietly reintroduce the defect.
 *
 * The neutral form is `Stack`, which renders an empty `div` with no border, no background and no
 * height. Nothing is destroyed by the rewrite: which component was selected for the slot is recorded
 * in design.compose's own `selections`, which this does not touch.
 *
 * Scope, also measured: 23 objects across 6 contexts leave 22 unfilled `Card` placeholders on card
 * bodies and a further 73 on detail tabs. The defect was reported as a card-header problem; it is the
 * same placeholder in both places and both are fixed here.
 */
export function neutralizeUnfilledSurfaceSlots(schema: UiSchema): number {
  const SURFACE = new Set(['Card']);
  const NEUTRAL = 'Stack';
  let neutralized = 0;
  const walk = (el: UiElement): void => {
    if (
      isSlotElement(el)
      && SURFACE.has(el.component)
      && !el.children?.length
      && Object.keys(el.props ?? {}).length === 0
    ) {
      el.component = NEUTRAL;
      neutralized += 1;
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return neutralized;
}

/**
 * Give a card header something that says what the record IS, and the card one fact beside it.
 *
 * `wireFieldProps` assigns fields to leaf nodes required-first then ALPHABETICALLY, so a card header
 * gets whatever field happens to sort first. For a CMOS Decision that is `created_at`, and the card
 * read `Decision · 2026-09-01T12:00:00.000Z · Active`: a stored timestamp and a supersession badge,
 * and nothing about the decision (s203-m04, decision #2170). The s203 review ruled the fix is a
 * first-line excerpt of the record's own words (#2180) — an excerpt, not an invented title, because
 * a CMOS decision genuinely has no title and m02 established that from the store.
 *
 * s206-m01 (the positive craft bar's residue, 24 screens): the header names the record with the field its object
 * declares (`recordNameField`), wherever the header binds something else — a trait's CardHeader titled by its generic
 * `label` (Person, Mission, User and ten more), a Text bound to an amount or a quantity (Plan, Usage), or nothing at
 * all (Subscription's header held three badges). A record named by its prose (Decision) heads with the prose's first
 * line (`headingExcerpt`); the same field still renders in full on the detail. A card that then states no fact beside
 * the name (Invoice) shows the record's status, or its first required value.
 */
export function bindCardHeadingField(schema: UiSchema, context: string | undefined, objectName?: string): number {
  if (context !== 'card') return 0;
  const objectSchema = schema.objectSchema;
  if (!objectSchema) return 0;
  const named = recordNameField(objectName, objectSchema);
  if (!named) return 0;
  const excerpt = isProseSemantic(objectSchema[named]?.semanticType);
  const isIdentifier = (name: string) => /(^|_)id$/i.test(name) || /\.id$/.test(objectSchema[name]?.semanticType ?? '');
  const bound = (el: UiElement): string[] => Object.entries(el.props ?? {})
    .filter(([prop, value]) => (prop === 'field' || /Field$/.test(prop)) && typeof value === 'string').map(([, value]) => value as string);
  let rebound = 0;
  const all: UiElement[] = [];
  const collect = (el: UiElement): void => { all.push(el); el.children?.forEach(collect); };
  schema.screens.forEach(collect);
  for (const header of all.filter(el => el.meta?.intent === 'slot:header')) {
    const nodes: UiElement[] = [];
    const walk = (el: UiElement): void => { nodes.push(el); el.children?.forEach(walk); };
    walk(header);
    if (nodes.some(el => bound(el).includes(named) && (el.component !== 'CardHeader' || el.props?.titleField === named))) continue;
    const title = nodes.find(el => el.component === 'CardHeader' && typeof el.props?.titleField === 'string');
    const text = nodes.find(el => el.component === 'Text' && typeof el.props?.field === 'string');
    if (title) {
      const { supportingField, ...rest } = title.props ?? {};
      title.props = { ...rest, titleField: named, ...(supportingField && supportingField !== named ? { supportingField } : {}) };
    } else if (text && excerpt) {
      text.props = { ...text.props, field: named, label: fieldLabel(named) };
      text.meta = { ...text.meta, headingExcerpt: true };
    } else if (text) {
      // s222-m03 (#2502 ruling 13): the record's name is the card's heading, as on every other card, not body text.
      text.component = 'CardHeader';
      text.props = { titleField: named };
    } else {
      const name: UiElement = { id: `${header.id}-record-name`, component: excerpt ? 'Text' : 'CardHeader', ...(excerpt ? { meta: { headingExcerpt: true } } : {}), props: excerpt ? { field: named, label: fieldLabel(named) } : { titleField: named } };
      if (header.component === 'Stack') header.children = [name, ...(header.children ?? [])];
      else {
        // s222-m03: the slot is itself a trait's recipe (Stateful's status badge on the User card). The name goes beside it;
        // inside it, it was the badge's label, a grey pill reading "Priya Raman". The slot keeps its id and meta.
        const { meta: _meta, layout: _layout, ...recipe } = header;
        for (const key of Object.keys(header)) if (!['id', 'meta', 'layout'].includes(key)) delete (header as unknown as Record<string, unknown>)[key];
        Object.assign(header, { component: 'Stack', children: [name, { ...recipe, id: `${header.id}-recipe` }] });
      }
    }
    rebound += 1;
  }
  // The fact sits in the header beside the name, as a status badge does on Subscription's card; an empty body slot
  // stays empty (and neutral), rather than becoming a card inside the card for one badge.
  // Read the tree again: a header slot turned into a stack above holds its recipe as a new node.
  all.length = 0;
  schema.screens.forEach(collect);
  const facts = new Set(all.flatMap(bound).filter(field => field !== named && objectSchema[field] && !isIdentifier(field)));
  const header = all.find(el => el.meta?.intent === 'slot:header');
  // s222-m03 (#2502 ruling 13): the record's status sits beside its name, as on its row, also when the card carries another
  // fact (a plan's owner).
  if (header && (!facts.size || (objectSchema.status?.enum?.length && !facts.has('status')))) {
    const scalar = (name: string) => /^(?:string|email|url|integer|number|boolean|date|datetime)$/.test(objectSchema[name]!.type.replace(/\?$/, ''));
    const fact = objectSchema.status ? 'status' : Object.keys(objectSchema).find(name => name !== named && objectSchema[name]!.required && scalar(name) && !isIdentifier(name));
    if (fact) {
      const node: UiElement = fact === 'status'
        ? { id: `${header.id}-record-status`, component: 'StatusBadge', props: { field: 'status', label: fieldLabel('status') } }
        : { id: `${header.id}-record-fact`, component: 'Text', props: { field: fact, label: fieldLabel(fact) } };
      // A header slot that is itself the naming leaf becomes a stack holding the name and the fact.
      if (header.children?.length) header.children = [...header.children, node];
      else {
        const { id, component, props, meta } = header;
        header.component = 'Stack';
        header.props = undefined;
        header.children = [{ id: `${id}-record-name`, component, props, ...(meta?.headingExcerpt ? { meta: { headingExcerpt: true } } : {}) }, node];
        header.meta = { ...meta, headingExcerpt: undefined };
      }
      rebound += 1;
    }
  }
  return rebound;
}
