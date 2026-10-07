import { annotateSubstitutions } from '../codegen/component-substitutions.js';
/**
 * design.compose MCP tool handler.
 *
 * Takes an intent description and produces a valid UiSchema
 * using layout templates (s51-m01) and the component selection
 * engine (s51-m02).
 *
 * Processing:
 *   1. Parse intent to detect layout hint
 *   2. Select layout template
 *   3. Fill slots using component selector
 *   4. Auto-validate via repl.validate
 *   5. Return schema + selections + validation
 */
import type { UiElement, UiSchema } from '../schemas/generated.js';
import {
  dashboardTemplate,
  formTemplate,
  detailTemplate,
  listTemplate,
  cardTemplate,
  timelineTemplate,
  landingTemplate,
  resetIdCounter,
  isSlotElement,
  uid,
  type TemplateResult,
  type Slot,
} from '../compose/templates/index.js';
import {
  selectComponent,
  loadCatalog,
  type SelectionCandidate,
  type SelectionResult,
} from '../compose/component-selector.js';
import { handle as validateHandle } from './repl.validate.js';
import type { ComponentCatalogSummary } from './types.js';
import { createSchemaRef, describeSchemaRef } from './schema-ref.js';
import { newCompositionId, nextVersion, readForgeHead, resolveCompositionsDir, writeVersion, type CompositionOperation, type CompositionVersion } from '../lib/composition-store.js';
import { createHash } from 'node:crypto';
import { ToolError } from '../errors/tool-error.js';
import { resolveEntity, isResolved as isEntityResolved } from './entity-resolver.js';
import { listObjects, loadObject, unknownObjectMessage } from '../objects/object-loader.js';
import { composeObject, viewStateFields, type ComposedObject } from '../objects/trait-composer.js';
import type { FieldDefinition, SemanticMapping, StateMachineDefinition, TraitAction } from '../objects/types.js';
import { resolveIntentObject, fuzzyMatchObject } from '../compose/intent-object-resolver.js';
import { populateCollections, populateListStates } from '../compose/collections.js';
import { reconcileFormDetail, KEPT_BESIDE_PATTERN } from '../compose/form-detail.js';
import { populateObjectSchema, populateBindings, fillSlotsWithObject, wireFieldProps, applySelectionsToSchema, dropUnfilledInteractiveSlots, neutralizeUnfilledSurfaceSlots, bindCardHeadingField } from '../compose/object-slot-filler.js';
import { enforceResultStateFamily } from '../compose/result-state.js';
import { nameStatusTables } from '../compose/status-table.js';
import { isTraitRecipe } from '../compose/trait-recipes.js';
import { collectDashboardViewExtensions, collectViewExtensions } from '../compose/view-extension-collector.js';
import type { SlotPlan } from '../compose/view-extension-collector.js';
import { expandSlots, groupFieldsIntoSlots, type ExpansionContext } from '../compose/slot-expander.js';
import type { LayoutType, LayoutInput } from '../compose/layout-types.js';
import type { FieldPatternMatch } from '../compose/field-patterns.js';
import { inferSlotPosition } from '../compose/position-affinity.js';
import { selectPattern, type CompositionContext } from '../compose/slot-patterns.js';
import type { FieldHint } from '../compose/field-affinity.js';
import {
  buildDashboardSectionPlan,
  buildSlotContextOverridesFromSections,
  parseIntentSections,
  prefersDashboardLayout,
} from '../compose/intent-sections.js';
import { loadOodsrc } from '../lib/oodsrc.js';
import { assembleWorkflow } from '../compose/workflow-assembler.js';
import { contextRefusal, isReadOnly, supportsContext } from '../objects/supported-contexts.js';
import { generateLabels, populateFieldLabels } from '../compose/label-generator.js';
import { labelScreens } from '../codegen/screen-shell.js';
import { preflightTargetContracts } from '../codegen/target-contracts.js';
import { assertKnownBrand, DEFAULT_BRAND } from '../lib/brand-registry.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ActionMapping {
  /** Verb label (e.g., "archive", "cancel"). `orcaVerb` is accepted as an alias for Stage1 BridgeSummary.summary.action_mappings entries. */
  verb?: string;
  orcaVerb?: string;
  /** OODS trait this verb is attributed to. `trait` is accepted as an alias. */
  oodsTrait?: string;
  trait?: string;
  /** Optional display label (Stage1 BridgeSummary emits this on action_mappings entries). */
  suggestedAction?: string;
  /** Optional narrowing hints. */
  object?: string;
  component?: string;
  slot?: string;
  confidence?: number;
  [k: string]: unknown;
}

/**
 * Per-component action evidence from Stage1 BridgeSummary.actions[]. Each
 * instance ties a verb to a specific component. When paired with action_mappings[]
 * (verb→trait vocabulary), the consumer can attach per-slot actions[] for
 * components whose trait lookup matches.
 */
/**
 * Stage1 BridgeSummary shape for `actions[].targetEntity`:
 *   { id, hint?, confidence?, signals? }
 *
 * Per Stage1 contract v1.2.4 §4:
 *   - `id`: always present, of the form `entity-<lowercase-name>` (§3).
 *   - `hint`: best-effort OODS-object-name hint. Present both at full
 *     emission AND on the sub-threshold envelope `{ id, hint, confidence:0,
 *     signals:[] }` seen on pure-DOM captures (no --api flag upstream).
 *   - `confidence`: sum-with-cap of the four §4 signals. Emission threshold
 *     for treating `hint` as authoritative is 0.75; below that the resolver
 *     falls through to alias/slug per contract §2c.
 *   - `signals`: stable-ordered subset of {url_slug_match, text_label_match,
 *     schema_org_type, recurrence_support}. May be empty.
 *
 * Pre-S40 runs used a bare string ("entity-customer"). The consumer accepts
 * both so fixture swaps are a no-op for downstream callers.
 */
export interface TargetEntityDescriptor {
  id: string;
  /**
   * Stage1-supplied best-effort OODS object name. Singular PascalCase,
   * passed through from `entity.name` upstream. Authoritative ONLY when
   * `confidence` ≥ 0.75 (contract v1.2.4 §4.3 emission threshold).
   */
  hint?: string;
  confidence?: number;
  signals?: string[];
  [k: string]: unknown;
}

export interface ActionInstance {
  actionId?: string;
  name?: string;
  verb: string;
  sourceComponent?: string;
  /**
   * Raw Stage1 entity id or structured descriptor. Pre-S40: `"entity-customer"`
   * (string). Post-S40 (5e3a5dbf+): `{ id, confidence, signals }` object with
   * Stage1-side entity-resolution signals. Resolved via entity-resolver.
   */
  targetEntity?: string | TargetEntityDescriptor;
  /**
   * Optional Stage1-supplied canonical OODS object name hint (Path B agreement,
   * 2026-04-15). Honored by the resolver when confidence ≥ 0.75.
   */
  canonicalName?: string;
  /** Stage1-side confidence for the canonical_name hint (0..1). */
  canonicalNameConfidence?: number;
  confidence?: number;
  confidenceLabel?: 'low' | 'medium' | 'high' | string;
  [k: string]: unknown;
}

export interface DesignComposeInput {
  presentation?: 'stage1-inspection';
  intent?: string;
  object?: string;
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline' | 'workflow';
  layout?: LayoutInput;
  preferences?: {
    /** A brand in the brand registry (s213-m04); validated at call time. */
    brand?: string;
    theme?: string;
    metricColumns?: number;
    fieldGroups?: number;
    tabCount?: number;
    tabLabels?: string[];
    componentOverrides?: Record<string, string>;
    /** Regions (the screen's direct children) by id in the desired order. */
    regionOrder?: string[];
    /** Region id → field names in the desired order among sibling field nodes. */
    fieldOrder?: Record<string, string[]>;
    /** Sample-data seed, recorded on the schema; rotates the deterministic sample records. */
    seed?: string;
  };
  options?: {
    validate?: boolean;
    topN?: number;
    /** Do not record a composition version (internal seed compositions); the result carries no compositionId. */
    transient?: boolean;
    /** With compositionId: the lineage operation recorded on the new version; default recompose. */
    operation?: CompositionOperation;
  };
  /** Record the result as the next version of this composition (operation "recompose") instead of a new one. */
  compositionId?: string;
  /** The version the new one derives from; default the latest. */
  parentVersion?: number;
  /** Sprint 88: Stage1 BridgeSummary action_mappings — flat verb-keyed entries. */
  actionMappings?: ActionMapping[];
  /** Sprint 88.1: Stage1 BridgeSummary.actions[] — per-component action instances. Merged with actionMappings[] for trait lookup. */
  actionInstances?: ActionInstance[];
}

export interface ResolvedTraitActions {
  trait: string;
  verbs: string[];
}

export interface ComposeIssue {
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface SlotSelectionEntry {
  slotName: string;
  intent: string;
  selectedComponent?: string;
  /** Raw confidence score (0–1) before normalization. */
  confidence?: number;
  /** Human-readable confidence band for quick review. */
  confidenceLevel?: 'high' | 'medium' | 'low';
  /** One-line rationale summarizing why this component was selected. */
  explanation: string;
  /** Follow-up guidance when the selection confidence is low. */
  reviewHint?: string;
  /** Ranked candidates; `score` is each candidate's ranking score, distinct from the slot's `confidence`. */
  candidates: SlotCandidate[];
  /** Alternative candidates surfaced when confidence < 0.5. */
  alternativeCandidates?: SlotCandidate[];
  /** Every component a view extension or the layout placed in this slot, in render order. */
  placedComponents?: string[];
}

export type SlotCandidate = Omit<SelectionCandidate, 'confidence'> & { score?: number };
/** The selector scores candidates under `confidence`; the public contract names the two numbers apart. */
const toSlotCandidate = ({ confidence, ...candidate }: SelectionCandidate): SlotCandidate => ({ ...candidate, score: confidence });

export interface TraitStateMachineEntry {
  trait: string;
  stateMachine: StateMachineDefinition;
}

export interface TraitActionsEntry {
  trait: string;
  actions: TraitAction[];
}

export interface ObjectUsedInfo {
  name: string;
  version: string;
  traits: string[];
  fieldsComposed: number;
  viewExtensionsApplied: Record<string, number>;
  /** Traits that define a state_machine, collected for Stage1 action_candidates integration */
  traitStateMachines?: TraitStateMachineEntry[];
  /** Traits that define actions, collected for Stage1 action_candidates integration */
  traitActions?: TraitActionsEntry[];
  /** Sprint 88: verbs grouped by trait after actionMappings reconciliation. */
  resolvedActions?: ResolvedTraitActions[];
}

export interface DesignComposeOutput {
  status: 'ok' | 'error';
  layout: string;
  schema: UiSchema;
  schemaRef?: string;
  schemaRefCreatedAt?: string;
  schemaRefExpiresAt?: string;
  /** The durable composition this result was recorded as (absent for transient compositions). */
  compositionId?: string;
  version?: number;
  parentVersion?: number | null;
  operation?: CompositionOperation;
  head?: string | null;
  selections: SlotSelectionEntry[];
  validation?: {
    status: 'ok' | 'invalid' | 'skipped';
    errors?: ComposeIssue[];
    warnings?: ComposeIssue[];
  };
  warnings: ComposeIssue[];
  errors?: ComposeIssue[];
  objectUsed?: ObjectUsedInfo;
  meta?: {
    substitutions?: Array<{ nodeId: string; mappingId: string; component: string }>;
    intentParsed: string;
    layoutDetected: string;
    slotCount: number;
    nodeCount: number;
    objectAutoDetected?: string;
    contextAutoDetected?: string;
    intentSynthetic?: boolean;
    warnings?: string[];
    /** Intelligence indicators from Sprint 73+ compositor features */
    intelligence?: {
      fieldsExpanded?: boolean;
      slotsExpanded?: number;
      expansionReason?: string;
      patternsApplied?: number;
      fieldAffinityUsed?: boolean;
      intentSectionsParsed?: number;
      sectionContextUsed?: boolean;
      /** Aggregated composition confidence (0–1, average of per-slot raw confidences). */
      compositionConfidence?: number;
      /** Count of slots with confidence below 0.5 that have alternative candidates. */
      lowConfidenceSlots?: number;
      /** Slot names whose selected component scored below the low-confidence threshold. */
      lowConfidenceSlotNames?: string[];
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Layout detection                                                   */
/* ------------------------------------------------------------------ */

type FormFieldSlotConfig = {
  description?: string;
  intent?: string;
  required?: boolean;
};

const LAYOUT_KEYWORDS: Record<LayoutType, string[]> = {
  dashboard: ['dashboard', 'metrics', 'overview', 'analytics', 'stats', 'kpi', 'monitor'],
  form: ['form', 'registration', 'signup', 'sign-up', 'edit', 'input', 'submit', 'settings', 'configure'],
  // 'page' moved to `landing` in s106-m04: it is a generic content-page signal
  // ("landing page", "home page", "about page"), not a detail signal. The 7
  // remaining keywords are unambiguous detail signals. A phrase like "detail
  // page" still scores detail AND landing; the tie resolves to detail because
  // detectLayout's stable sort preserves insertion order (detail precedes
  // landing), so strong layout keywords always win their ties.
  detail: ['detail', 'profile', 'view', 'show', 'record', 'entity', 'inspect'],
  list: ['list', 'table', 'browse', 'search', 'catalog', 'directory', 'index', 'inventory'],
  card: ['card', 'summary', 'compact', 'preview', 'snippet'],
  timeline: ['timeline', 'events', 'history', 'audit', 'changelog', 'activity'],
  // Content / marketing pages (s106-m04). Listed last so its keyword ties with
  // any data-view layout resolve to the data-view layout.
  landing: ['landing', 'marketing', 'homepage', 'home page', 'content page', 'page', 'hero', 'splash'],
};

function hasLayoutKeyword(intent: string, keyword: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword.toLowerCase())}([^a-z0-9]|$)`, 'i');
  return pattern.test(intent);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectLayout(intent: string): { layout: LayoutType; confidence?: number } {
  const lower = intent.toLowerCase();
  const scores: Record<LayoutType, number> = { dashboard: 0, form: 0, detail: 0, list: 0, card: 0, timeline: 0, landing: 0 };

  for (const [layout, keywords] of Object.entries(LAYOUT_KEYWORDS) as [LayoutType, string[]][]) {
    for (const kw of keywords) {
      if (hasLayoutKeyword(lower, kw)) {
        scores[layout] += 1;
      }
    }
  }

  const entries = Object.entries(scores) as [LayoutType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [bestLayout, bestScore] = entries[0];
  if (bestScore === 0) {
    // Default to dashboard if no keywords match
    return { layout: 'dashboard' };
  }

  const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
  return { layout: bestLayout, confidence: bestScore / totalScore };
}

/* ------------------------------------------------------------------ */
/*  Schema tree helpers                                                */
/* ------------------------------------------------------------------ */

/** Walk the schema tree to find the Tabs element. */
function findTabsElement(screens: UiElement[]): UiElement | undefined {
  for (const screen of screens) {
    const found = walkFindElement(screen, el => el.component === 'Tabs');
    if (found) return found;
  }
  return undefined;
}

function walkFindElement(el: UiElement, pred: (el: UiElement) => boolean): UiElement | undefined {
  if (pred(el)) return el;
  if (el.children) {
    for (const child of el.children) {
      const found = walkFindElement(child, pred);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Derive a human-readable tab label from the fields assigned to a tab slot.
 * Uses dominant semantic category of the fields to produce labels like
 * "Pricing", "Dates & History", "Settings", etc.
 */
function inferTabLabelFromFields(
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string {
  if (fieldNames.length === 0) return 'Details';

  const categories: Record<string, number> = {};

  for (const name of fieldNames) {
    const field = schema[name];
    if (!field) continue;

    const lowerName = name.toLowerCase();
    const sem = semantics?.[name]?.semantic_type?.toLowerCase();

    if (sem && /(^|\.)(status|lifecycle)(\.|$)/.test(sem) || lowerName === 'status' || lowerName.endsWith('_status') || lowerName.endsWith('_state')) {
      categories['status'] = (categories['status'] ?? 0) + 1;
    } else if (sem && /(currency|price|percentage|count|metric)/.test(sem) || field.type === 'number' || field.type === 'integer') {
      categories['pricing'] = (categories['pricing'] ?? 0) + 1;
    } else if (sem && /(timestamp|date|time|audit)/.test(sem) || field.type === 'datetime' || field.type === 'date' || lowerName.endsWith('_at')) {
      categories['temporal'] = (categories['temporal'] ?? 0) + 1;
    } else if (field.type === 'boolean') {
      categories['settings'] = (categories['settings'] ?? 0) + 1;
    } else if (field.validation?.enum && field.validation.enum.length > 0) {
      categories['options'] = (categories['options'] ?? 0) + 1;
    } else if (field.type.endsWith('[]') || field.type === 'object[]') {
      categories['collections'] = (categories['collections'] ?? 0) + 1;
    } else if (sem && /(email|phone|contact)/.test(sem) || lowerName.includes('email') || lowerName.includes('phone')) {
      categories['contact'] = (categories['contact'] ?? 0) + 1;
    } else {
      categories['details'] = (categories['details'] ?? 0) + 1;
    }
  }

  // Find dominant category
  let dominant = 'details';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categories)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cat;
    }
  }

  const CATEGORY_TO_LABEL: Record<string, string> = {
    status: 'Status',
    pricing: 'Pricing',
    temporal: 'Dates & History',
    settings: 'Settings',
    options: 'Options',
    collections: 'Collections',
    contact: 'Contact',
    details: 'Details',
  };

  return CATEGORY_TO_LABEL[dominant] ?? 'Details';
}

/* ------------------------------------------------------------------ */
/*  Template selection                                                 */
/* ------------------------------------------------------------------ */

function selectTemplate(
  layout: LayoutType,
  preferences: DesignComposeInput['preferences'],
  dashboardSectionPlan?: ReturnType<typeof buildDashboardSectionPlan>,
  formFieldSlots?: FormFieldSlotConfig[],
  context?: string,
): TemplateResult {
  resetIdCounter();

  switch (layout) {
    case 'dashboard':
      return dashboardTemplate({
        metricColumns: preferences?.metricColumns,
        sectionPlan: dashboardSectionPlan,
        theme: preferences?.theme,
      });
    case 'form':
      return formTemplate({
        fieldGroups: preferences?.fieldGroups,
        fieldSlots: formFieldSlots,
        theme: preferences?.theme,
      });
    case 'detail':
      return detailTemplate({
        tabCount: preferences?.tabCount,
        tabLabels: preferences?.tabLabels,
        theme: preferences?.theme,
      });
    case 'list':
      return listTemplate({
        inline: context === 'inline',
        theme: preferences?.theme,
      });
    case 'card':
      return cardTemplate({
        theme: preferences?.theme,
      });
    case 'timeline':
      return timelineTemplate({
        theme: preferences?.theme,
      });
    case 'landing':
      return landingTemplate({
        theme: preferences?.theme,
      });
  }
}

/* ------------------------------------------------------------------ */
/*  Slot filling                                                       */
/* ------------------------------------------------------------------ */

function fillSlots(
  slots: Slot[],
  catalog: ComponentCatalogSummary[],
  overrides: Record<string, string> | undefined,
  topN: number,
  intentContext: string,
  tabLabels: string[] | undefined,
  fieldHints?: Map<string, FieldHint>,
  slotContextOverrides?: Map<string, string[]>,
  strictFieldControlSlots?: Set<string>,
  detectedPatterns?: FieldPatternMatch[],
  warnings: ComposeIssue[] = [],
): SlotSelectionEntry[] {
  const keywordPriorityIntents = new Set([
    'boolean-input',
    'data-display',
    'data-table',
    'date-input',
    'email-input',
    'enum-input',
    'form-input',
    'long-text-input',
    'metadata-display',
    'metrics-display',
    'search-input',
    'status-indicator',
    'tab-panel',
  ]);
  const formControlIntents = new Set([
    'boolean-input',
    'date-input',
    'email-input',
    'enum-input',
    'form-input',
    'long-text-input',
  ]);

  const contextForSlot = (slot: Slot): string[] => {
    const overrideContext = slotContextOverrides?.get(slot.name);
    const suppressFormControlBias = strictFieldControlSlots?.has(slot.name) && formControlIntents.has(slot.intent);
    if (suppressFormControlBias) {
      return (overrideContext && overrideContext.length > 0
        ? overrideContext
        : [intentContext]).filter(Boolean);
    }

    const context: string[] = overrideContext && overrideContext.length > 0
      ? [...overrideContext, slot.description]
      : [intentContext, slot.description];
    const match = /^tab-(\d+)$/.exec(slot.name);
    if (match && tabLabels?.[Number(match[1])]) {
      context.push(tabLabels[Number(match[1])]);
    }
    return context.filter(Boolean);
  };

  return slots.map(slot => {
    // Check for explicit override
    const override = overrides?.[slot.name];
    if (override) {
      return {
        slotName: slot.name,
        intent: slot.intent,
        selectedComponent: override,
        explanation: `Selected ${override} for slot "${slot.name}" because it was explicitly pinned via preferences.componentOverrides.`,
        candidates: [{
          name: override,
          reason: `user override for slot "${slot.name}"`,
        }],
      };
    }

    // Use the component selector with intelligence signals
    const slotPosition = inferSlotPosition(slot.name);
    const suppressFormControlBias = strictFieldControlSlots?.has(slot.name) && formControlIntents.has(slot.intent);
    const slotFieldHint = !suppressFormControlBias ? fieldHints?.get(slot.name) : undefined;
    const useKeywordMatches = !suppressFormControlBias && keywordPriorityIntents.has(slot.intent);

    // Look up pattern boost for this slot's field group
    let slotPatternBoost: { componentName: string; boost: number; patternId: string } | undefined;
    if (detectedPatterns && detectedPatterns.length > 0) {
      for (const pattern of detectedPatterns) {
        if (pattern.slotGroup === slot.name || slot.name.startsWith(pattern.slotGroup)) {
          slotPatternBoost = {
            componentName: pattern.compositeComponent,
            boost: pattern.selectionBoost,
            patternId: pattern.patternId,
          };
          break;
        }
      }
    }

    // New trait recipes require explicit placement. The established generic
    // preview remains eligible for intent-only dashboards as before Sprint193.
    const result: SelectionResult = selectComponent(slot.intent, catalog.filter((component) => component.name === 'VizAreaPreview' || !isTraitRecipe(component.name)), {
      topN,
      intentContext: contextForSlot(slot),
      preferKeywordMatches: useKeywordMatches,
      ...(slotFieldHint ? { fieldHint: slotFieldHint } : {}),
      ...(slotPosition ? { slotPosition } : {}),
      ...(slotPatternBoost ? { patternBoost: slotPatternBoost } : {}),
    });

    if (result.warning) warnings.push({ code: 'OODS-V118', message: result.warning, path: `slots.${slot.name}` });
    const entry: SlotSelectionEntry = {
      slotName: slot.name,
      intent: slot.intent,
      selectedComponent: result.candidates[0]?.name,
      confidence: result.rawConfidence,
      // s211-m01: the level is the score's own, not a placeholder — applySelectionsToSchema stamps it onto the node
      // before the explainability pass re-levels the selections, so a placeholder 'low' contradicted them.
      confidenceLevel: getConfidenceLevel(result.rawConfidence),
      explanation: '',
      candidates: result.candidates.map(toSlotCandidate),
    };

    // Surface alternative candidates when confidence is low
    if (result.rawConfidence < 0.5 && result.candidates.length > 1) {
      entry.alternativeCandidates = result.candidates.slice(1, 4).map(toSlotCandidate);
    }

    return entry;
  });
}

/**
 * The field a sibling node stands for: its own `field`; for a slot, the first field it places; for a
 * row wrapping exactly one field (a label + value pair, a field editor group), that field. A node
 * whose subtree carries several fields stands for none and is walked into instead.
 */
export function fieldKeyOf(node: UiElement): string | undefined {
  if (typeof node.props?.field === 'string') return node.props.field;
  const fields = new Set<string>();
  const walk = (child: UiElement) => { if (typeof child.props?.field === 'string') fields.add(child.props.field); child.children?.forEach(walk); };
  node.children?.forEach(walk);
  const slot = /^slot-/.test(node.id) || (typeof node.meta?.intent === 'string' && node.meta.intent.startsWith('slot:'));
  if (slot) return fields.values().next().value;
  return fields.size === 1 ? fields.values().next().value : undefined;
}

/** Reorder a list by an explicit order of keys: listed keys first, in that order; the rest keep their relative order. */
function reorderBy<T>(items: T[], keyOf: (item: T) => string | undefined, order: string[]): T[] {
  const listed = order.map(key => items.find(item => keyOf(item) === key)).filter((item): item is T => item !== undefined);
  return [...listed, ...items.filter(item => !listed.includes(item))];
}

/**
 * The override surface for edits: regionOrder reorders the screen's direct children by id;
 * fieldOrder[region] reorders sibling field nodes inside that region; seed is recorded on the
 * schema. Every override names ids and fields that must exist, so an edit can never point at
 * nothing; nothing here changes what a node is, only where it sits and which sample data it shows.
 */
function applyOrderOverrides(schema: UiSchema, preferences: DesignComposeInput['preferences']): void {
  if (!preferences) return;
  const screen = schema.screens[0];
  if (preferences.regionOrder && screen?.children) {
    const ids = new Set(screen.children.map(node => node.id));
    const unknown = preferences.regionOrder.filter(id => !ids.has(id));
    if (unknown.length) throw new ToolError('OODS-V204', `regionOrder names regions this screen does not have: ${unknown.join(', ')}`, { regionOrder: preferences.regionOrder, regions: [...ids] });
    screen.children = reorderBy(screen.children, node => node.id, preferences.regionOrder);
  }
  if (preferences.fieldOrder && screen?.children) {
    for (const [regionId, order] of Object.entries(preferences.fieldOrder)) {
      const region = screen.children.find(node => node.id === regionId);
      if (!region) throw new ToolError('OODS-V204', `fieldOrder names a region this screen does not have: ${regionId}`, { region: regionId, regions: screen.children.map(node => node.id) });
      const present = new Set<string>();
      const parents: UiElement[] = [];
      const walk = (node: UiElement) => {
        if (!node.children?.length) return;
        if (node.children.some(child => fieldKeyOf(child) !== undefined)) parents.push(node);
        for (const child of node.children) { const key = fieldKeyOf(child); if (key) present.add(key); if (!/^slot-/.test(child.id)) walk(child); }
      };
      walk(region);
      const unknown = order.filter(field => !present.has(field));
      if (unknown.length) throw new ToolError('OODS-V204', `fieldOrder for ${regionId} names fields the region does not carry: ${unknown.join(', ')}`, { region: regionId, fields: [...present] });
      for (const parent of parents) parent.children = reorderBy(parent.children!, fieldKeyOf, order);
    }
  }
  if (preferences.seed !== undefined) schema.seed = preferences.seed;
}

/**
 * A slot reports what leads it on screen. When the layout places a record title (DetailHeader)
 * before a slot's view-extension stack, that title is the slot's leader and the extensions are
 * the components placed after it; the report says so instead of naming the first extension.
 */
function reportLayoutLeaders(schema: UiSchema, selections: SlotSelectionEntry[]): void {
  const parents = new Map<string, UiElement>();
  const slots = new Map<string, UiElement>();
  const walk = (node: UiElement): void => {
    const intent = node.meta?.intent;
    if (typeof intent === 'string' && intent.startsWith('slot:')) slots.set(intent.slice(5), node);
    for (const child of node.children ?? []) { parents.set(child.id, node); walk(child); }
  };
  schema.screens.forEach(walk);
  for (const selection of selections) {
    if (!selection.placedComponents?.length) continue;
    const slot = slots.get(selection.slotName);
    const parent = slot ? parents.get(slot.id) : undefined;
    if (!slot || !parent) continue;
    const siblings = parent.children ?? [];
    const before = siblings.slice(0, siblings.indexOf(slot)).filter((node) => node.component === 'DetailHeader');
    if (before.length === 0) continue;
    const leader = before[0]!.component;
    selection.placedComponents = [leader, ...selection.placedComponents];
    selection.selectedComponent = leader;
    delete selection.confidence;
    delete selection.confidenceLevel;
    selection.candidates = [{ name: leader, reason: 'record title placed by the layout from the object\'s label field' }, ...selection.candidates.filter((candidate) => candidate.name !== leader)];
  }
}

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence < 0.5) return 'low';
  if (confidence < 0.8) return 'medium';
  return 'high';
}

function buildSelectionExplanation(selection: SlotSelectionEntry): string {
  const selected = selection.selectedComponent ?? selection.candidates[0]?.name ?? 'an unassigned component';
  const topReason = selection.candidates[0]?.reason?.trim() || 'limited matching signals were available';
  const confidence = selection.confidence === undefined ? '' : ` Confidence is ${selection.confidenceLevel} (${selection.confidence.toFixed(2)}).`;
  const normalizedReason = topReason.toLowerCase();
  if (normalizedReason.includes('override')) {
    return `${selected} was selected for slot "${selection.slotName}" because it was explicitly pinned via preferences.componentOverrides.${confidence}`;
  }
  const alternatives = selection.alternativeCandidates && selection.alternativeCandidates.length > 0
    ? ` Alternatives to review: ${selection.alternativeCandidates
      .map((candidate) => `${candidate.name}${candidate.score === undefined ? '' : ` (score ${candidate.score.toFixed(2)})`}`)
      .join(', ')}.`
    : '';
  const reviewSentence = selection.confidenceLevel === 'low'
    ? ' Review this slot before shipping, or pin a component with preferences.componentOverrides if you disagree with the pick.'
    : '';
  if (selection.placedComponents && selection.placedComponents.length > 0) {
    // Placement, not ranking: the components stacked in the slot are what renders, in order.
    const rest = selection.placedComponents.slice(1);
    const stacked = rest.length > 0 ? ` The slot also renders ${rest.join(', ')} after it, in that order.` : '';
    return `${selected} leads slot "${selection.slotName}" because ${topReason}.${stacked}${confidence}${reviewSentence}`;
  }

  return `${selected} was selected for slot "${selection.slotName}" because ${topReason}.${confidence}${alternatives}${reviewSentence}`;
}

function applySelectionExplainability(selections: SlotSelectionEntry[]): SlotSelectionEntry[] {
  return selections.map((selection) => {
    const confidenceLevel = selection.confidence === undefined ? undefined : getConfidenceLevel(selection.confidence);
    const reviewHint = confidenceLevel === 'low'
      ? `Low-confidence selection for "${selection.slotName}". Consider preferences.componentOverrides to pin a different component if needed.`
      : undefined;

    const entry: SlotSelectionEntry = {
      ...selection,
      confidenceLevel,
      explanation: '',
      ...(reviewHint ? { reviewHint } : {}),
    };
    entry.explanation = buildSelectionExplanation(entry);
    return entry;
  });
}

/**
 * Wrap pattern-grouped slots with container components.
 *
 * When a slot contains fields from a detected multi-field pattern
 * (e.g., address-block → street + city + state + zip), this function
 * groups those fields together in a Stack container with metadata
 * indicating the pattern. The composite component name is preserved
 * in props.patternComponent for downstream codegen to reference.
 *
 * Uses Stack (a known, validated component) as the container to
 * avoid validation failures from unregistered composite component names.
 *
 * Returns the number of patterns applied.
 */
function applyPatternGroupWrappers(
  schema: UiSchema,
  patternGroups: Record<string, FieldPatternMatch>,
  objectFields: Record<string, FieldDefinition>,
): number {
  let applied = 0;

  const walk = (el: UiElement): void => {
    const slotName = el.meta?.label ?? (
      el.meta?.intent?.startsWith('slot:')
        ? el.meta.intent.slice('slot:'.length)
        : undefined
    );

    // A trait recipe already owns this slot; generic grouping must not erase it.
    if (slotName && patternGroups[slotName] && !isTraitRecipe(el.component)) {
      const pattern = patternGroups[slotName];

      const fieldChildren: UiElement[] = pattern.matchedFields
        .filter(f => objectFields[f])
        .map(fieldName => ({
          id: uid(`pg-${pattern.patternId}`),
          component: 'Text',
          props: { field: fieldName },
        }));

      if (fieldChildren.length > 0) {
        const existingChildren = el.children ?? [];
        // s213-m03: a trait's component placed in this slot for a field outside the pattern (a team trait's stock badge
        // beside Stateful's status) stays as the group's child; turning the slot into the group used to erase it. The
        // detail reconciler labels it (reconcileFormDetail).
        const bound = Object.entries(el.props ?? {}).filter(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string').map(([, value]) => value as string);
        const displaced: UiElement[] = bound.length > 0 && !bound.some(field => pattern.matchedFields.includes(field))
          ? [{ id: uid(`pg-${pattern.patternId}-kept`), component: el.component, props: el.props, meta: { intent: KEPT_BESIDE_PATTERN } }]
          : [];
        // Use Stack as container (validated component) with pattern metadata
        el.component = 'Stack';
        el.layout = { type: 'stack', gapToken: 'cluster-tight' };
        el.props = {
          ...(displaced.length ? {} : el.props),
          patternComponent: pattern.compositeComponent,
          fields: pattern.matchedFields,
        };
        el.children = [...fieldChildren, ...displaced, ...existingChildren];
        el.meta = {
          ...el.meta,
          notes: `pattern-group:${pattern.patternId}`,
        };
        applied++;
      }
    }

    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return applied;
}

function applyOverridesToSchema(
  schema: UiSchema,
  overrides: Record<string, string> | undefined,
  catalog: ComponentCatalogSummary[],
  warnings: ComposeIssue[],
): void {
  if (!overrides || Object.keys(overrides).length === 0) return;

  const knownComponents = new Set(catalog.map(component => component.name));
  const warned = new Set<string>();

  for (const [slotName, overrideName] of Object.entries(overrides)) {
    if (!knownComponents.has(overrideName) && !warned.has(`${slotName}:${overrideName}`)) {
      warnings.push({
        code: 'OODS-V006',
        message: `Override component "${overrideName}" for slot "${slotName}" was not found in the catalog.`,
        hint: 'Check the component name or refresh structured data.',
      });
      warned.add(`${slotName}:${overrideName}`);
    }
  }

  const resolveSlotName = (el: UiElement): string | undefined => {
    if (el.meta?.label) return el.meta.label;
    if (el.meta?.intent?.startsWith('slot:')) {
      return el.meta.intent.slice('slot:'.length);
    }
    return undefined;
  };

  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && overrides[slotName]) {
        el.component = overrides[slotName];
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/* ------------------------------------------------------------------ */
/*  Context → layout inference                                         */
/* ------------------------------------------------------------------ */

const CONTEXT_TO_LAYOUT: Record<string, LayoutType> = {
  detail: 'detail',
  list: 'list',
  form: 'form',
  timeline: 'timeline',
  card: 'card',
  inline: 'list',
};

function inferLayoutFromContext(context: string | undefined): LayoutType {
  if (context && context in CONTEXT_TO_LAYOUT) {
    return CONTEXT_TO_LAYOUT[context];
  }
  return 'detail'; // default when context is unknown or missing
}

/* ------------------------------------------------------------------ */
/*  Field group → intent inference                                     */
/* ------------------------------------------------------------------ */

/**
 * Infer a differentiated slot intent from the dominant field types/semantics
 * in a field group. Produces intents like 'status-indicator', 'metrics-display',
 * 'metadata-display', 'form-input' instead of the generic 'data-display'.
 */
function inferSlotIntentFromFields(
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string | undefined {
  if (fieldNames.length === 0) return undefined;

  // Count semantic/type categories
  const categories: Record<string, number> = {};
  let classified = 0;

  for (const name of fieldNames) {
    const field = schema[name];
    if (!field) continue;

    const lowerName = name.toLowerCase();
    const sem = semantics?.[name]?.semantic_type?.toLowerCase();
    const isStatusLike = Boolean(
      sem && /(^|\.)(status|lifecycle)(\.|$)/.test(sem),
    ) || lowerName === 'status' || lowerName.endsWith('_status') || lowerName.endsWith('_state');
    const isMetricLike = Boolean(
      sem && /(currency|price|percentage|count|metric)/.test(sem),
    ) || field.type === 'number' || field.type === 'integer';
    const isTemporalLike = Boolean(
      sem && /(timestamp|date|time|audit)/.test(sem),
    ) || field.type === 'datetime' || field.type === 'date' || lowerName.endsWith('_at');
    const isMetadataLike = field.type === 'boolean'
      || Boolean(field.validation?.enum && field.validation.enum.length > 0)
      || field.type === 'object[]'
      || field.type.endsWith('[]');

    if (isStatusLike) {
      categories['status'] = (categories['status'] ?? 0) + 1;
      classified++;
    } else if (isMetricLike) {
      categories['metrics'] = (categories['metrics'] ?? 0) + 1;
      classified++;
    } else if (isTemporalLike) {
      categories['temporal'] = (categories['temporal'] ?? 0) + 1;
      classified++;
    } else if (isMetadataLike) {
      categories['metadata'] = (categories['metadata'] ?? 0) + 1;
      classified++;
    }
  }

  // Find dominant category — require majority (>50% of fields) to override intent.
  // Without strong dominance, keep the default 'data-display' which selects
  // container components (Card, Stack) appropriate for multi-field tabs.
  let dominant: string | undefined;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categories)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cat;
    }
  }

  const totalFields = fieldNames.length;
  const dominanceRatio = totalFields > 0 ? maxCount / totalFields : 0;

  // Require >50% dominance for leaf-level intents (status-indicator, metrics-display).
  // These intents select leaf components (Badge, StatusBadge) which are wrong for
  // multi-field tab containers. Container-safe intents (metadata-display) have a
  // lower threshold since they prefer Stack/Text which work as containers.
  switch (dominant) {
    case 'status':
      return dominanceRatio > 0.5 ? 'status-indicator' : undefined;
    case 'metrics':
      // Even with dominance, multi-field groups are containers — use data-display
      // which prefers Card/Stack. Only single-field slots get metrics-display.
      if (totalFields <= 2 && dominanceRatio > 0.5) return 'metrics-display';
      return undefined;
    case 'temporal':
      return dominanceRatio > 0.3 ? 'metadata-display' : undefined;
    case 'metadata':
      return dominanceRatio > 0.3 ? 'metadata-display' : undefined;
    default:
      return undefined;
  }
}

const FORM_INTENT_PRIORITY = [
  'long-text-input',
  'enum-input',
  'boolean-input',
  'date-input',
  'email-input',
  'form-input',
] as const;

function buildSemanticTypeMap(
  semantics?: Record<string, SemanticMapping>,
): Record<string, string> {
  const semanticTypes: Record<string, string> = {};
  if (!semantics) return semanticTypes;

  for (const [name, sem] of Object.entries(semantics)) {
    if (sem.semantic_type) {
      semanticTypes[name] = sem.semantic_type;
    }
  }

  return semanticTypes;
}

function humanizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLongTextField(
  fieldName: string,
  field: FieldDefinition,
  semantics?: Record<string, SemanticMapping>,
): boolean {
  if (field.type !== 'string') return false;

  const uiHints = semantics?.[fieldName]?.ui_hints;
  const hintMaxLength = typeof uiHints?.maxLength === 'number'
    ? uiHints.maxLength
    : undefined;
  const validationMaxLength = typeof field.validation?.maxLength === 'number'
    ? field.validation.maxLength
    : undefined;
  const normalizedName = fieldName.replace(/[_-]+/g, ' ');
  const lowerText = `${normalizedName} ${field.description}`.toLowerCase();

  return Boolean(
    uiHints?.multiline === true
    || (hintMaxLength && hintMaxLength >= 120)
    || (validationMaxLength && validationMaxLength >= 120)
    || /\b(description|summary|notes?|message|comment|reason|details?|body|content|bio|explanation|free form)\b/.test(lowerText),
  );
}

function inferFormSlotIntentFromFields(
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string {
  if (fieldNames.length === 0) return 'form-input';

  const counts: Record<string, number> = {};

  for (const fieldName of fieldNames) {
    const entry = schema[fieldName];
    if (!entry) continue;
    // Nullability does not turn a boolean/date/email into a generic text control.
    const field = { ...entry, type: entry.type.replace(/\?$/, '') };

    const semanticType = semantics?.[fieldName]?.semantic_type?.toLowerCase() ?? '';
    let intent = 'form-input';

    if (isLongTextField(fieldName, field, semantics)) {
      intent = 'long-text-input';
    } else if (field.validation?.enum && field.validation.enum.length > 0) {
      intent = 'enum-input';
    } else if (field.type === 'boolean') {
      intent = 'boolean-input';
    } else if (
      field.type === 'date'
      || field.type === 'datetime'
      || /(timestamp|date|time|calendar)/.test(semanticType)
    ) {
      intent = 'date-input';
    } else if (field.type === 'email' || semanticType.includes('email')) {
      intent = 'email-input';
    }

    counts[intent] = (counts[intent] ?? 0) + 1;
  }

  let bestIntent: typeof FORM_INTENT_PRIORITY[number] = 'form-input';
  let bestCount = 0;

  for (const intent of FORM_INTENT_PRIORITY) {
    const count = counts[intent] ?? 0;
    if (count > bestCount) {
      bestIntent = intent;
      bestCount = count;
    }
  }

  return bestIntent;
}

function buildFormSlotDescription(slotName: string, fieldNames: string[]): string {
  const slotIndex = Number.parseInt(slotName.replace('field-', ''), 10);
  if (fieldNames.length === 0) {
    return `Form field group ${Number.isNaN(slotIndex) ? 1 : slotIndex + 1}`;
  }

  const labels = fieldNames.slice(0, 3).map(humanizeFieldName);
  const suffix = fieldNames.length > 3 ? ', ...' : '';
  return `Form fields: ${labels.join(', ')}${suffix}`;
}

function buildFormSlotMetadata(
  slotName: string,
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): FormFieldSlotConfig {
  return {
    description: buildFormSlotDescription(slotName, fieldNames),
    intent: inferFormSlotIntentFromFields(fieldNames, schema, semantics),
    required: slotName === 'field-0',
  };
}

function buildFormFieldSlots(
  fieldGroups: number,
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
  semanticTypes?: Record<string, string>,
): FormFieldSlotConfig[] {
  const slotNames = Array.from({ length: fieldGroups }, (_, idx) => `field-${idx}`);
  const groupedFields = groupFieldsIntoSlots(schema, slotNames, semanticTypes);

  return slotNames.map((slotName, idx) => {
    const fieldNames = groupedFields[slotName] ?? [];
    if (fieldNames.length === 0) {
      return {
        description: `Form field group ${idx + 1}`,
        intent: 'form-input',
        required: idx === 0,
      };
    }

    return buildFormSlotMetadata(slotName, fieldNames, schema, semantics);
  });
}

function applyFormSlotMetadata(
  slots: Slot[],
  fieldGroups: Record<string, string[]>,
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): void {
  for (const slot of slots) {
    if (!slot.name.startsWith('field-')) continue;
    const fieldNames = fieldGroups[slot.name];
    if (!fieldNames || fieldNames.length === 0) continue;

    const metadata = buildFormSlotMetadata(slot.name, fieldNames, schema, semantics);
    slot.intent = metadata.intent ?? slot.intent;
    slot.description = metadata.description ?? slot.description;
  }
}

function resolvePrimaryFieldForFormSlot(
  slotIntent: string,
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string | undefined {
  const matchingField = fieldNames.find((fieldName) => (
    inferFormSlotIntentFromFields([fieldName], schema, semantics) === slotIntent
  ));

  return matchingField ?? fieldNames[0];
}

function getSlotName(node: UiElement): string | undefined {
  if (node.meta?.label) return node.meta.label;
  if (node.meta?.intent?.startsWith('slot:')) {
    return node.meta.intent.slice('slot:'.length);
  }
  return undefined;
}

function applyFormFieldBindingsFromGroups(
  schema: UiSchema,
  slots: Slot[],
  fieldGroups: Record<string, string[]>,
  objectSchema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): void {
  const fieldBySlot = new Map<string, string>();

  for (const slot of slots) {
    if (!slot.name.startsWith('field-')) continue;
    const fieldNames = fieldGroups[slot.name] ?? [];
    const primaryField = resolvePrimaryFieldForFormSlot(slot.intent, fieldNames, objectSchema, semantics);
    if (primaryField) {
      fieldBySlot.set(slot.name, primaryField);
    }
  }

  const walk = (node: UiElement): void => {
    const slotName = getSlotName(node);
    const fieldName = slotName ? fieldBySlot.get(slotName) : undefined;
    // A slot can host several trait editors. Its container owns no field value;
    // each editor keeps its explicit field directives instead.
    if (fieldName && typeof node.props?.field !== 'string' && !node.children?.length) {
      node.props = {
        ...(node.props ?? {}),
        field: fieldName,
      };
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/**
 * Enrich form field nodes with label/placeholder/type props derived from
 * intent-parsed field descriptions. Called in the no-object form path
 * after slot filling and selection application.
 */
function enrichFormFieldPropsFromIntent(
  schema: UiSchema,
  slotContextOverrides: Map<string, string[]>,
  fieldHints: Map<string, FieldHint>,
): void {
  const FORM_CONTROL_COMPONENTS = new Set([
    'Input', 'Select', 'Textarea', 'DatePicker', 'Toggle', 'Checkbox', 'Switch',
    'TagInput', 'SearchInput', 'PreferenceEditor',
  ]);

  const walk = (node: UiElement): void => {
    const slotName = getSlotName(node);
    if (slotName && slotName.startsWith('field-') && FORM_CONTROL_COMPONENTS.has(node.component)) {
      const contexts = slotContextOverrides.get(slotName);
      const hint = fieldHints.get(slotName);
      if (contexts && contexts.length > 0) {
        const label = contexts[0]
          .replace(/\b(toggle|switch|checkbox|dropdown|select|selector|input)\b/gi, '')
          .trim();
        if (label) {
          node.props = {
            ...(node.props ?? {}),
            label,
          };
        }
      }
      if (hint && node.component === 'Input') {
        if (hint.type === 'email') {
          node.props = { ...(node.props ?? {}), type: 'email' };
        } else if (hint.type === 'number' || hint.type === 'integer') {
          node.props = { ...(node.props ?? {}), type: 'number' };
        } else if (hint.type === 'url') {
          node.props = { ...(node.props ?? {}), type: 'url' };
        }
      }
      if (hint?.enum && hint.enum.length > 0 && node.component === 'Select') {
        node.props = {
          ...(node.props ?? {}),
          options: hint.enum,
        };
      }
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/** A phrase that names a choice control, such as "frequency dropdown". */
const CHOICE_CONTROL_CUE = /(dropdown|select|selector|radio|enum|choice|options?)/;

function inferIntentFieldHint(phrase: string): FieldHint {
  const lower = phrase.toLowerCase();

  if (/(toggle|switch|checkbox|boolean|enable|disable|opt[\s-]?in|opt[\s-]?out)/.test(lower)) {
    return { type: 'boolean' };
  }

  if (CHOICE_CONTROL_CUE.test(lower)) {
    return { type: 'string' };
  }

  if (/(timestamp|time|scheduled at|scheduled for)/.test(lower)) {
    return { type: 'datetime', semanticType: 'timestamp' };
  }

  if (/(date|calendar|deadline|due)/.test(lower)) {
    return { type: 'date', semanticType: 'timestamp' };
  }

  if (/\bemail\b/.test(lower)) {
    return { type: 'email' };
  }

  if (/\b(url|link|website)\b/.test(lower)) {
    return { type: 'url' };
  }

  if (/\b(amount|price|total|count|quantity|qty|revenue|score|number)\b/.test(lower)) {
    return { type: 'number' };
  }

  return { type: 'string' };
}

function inferSlotIntentFromFieldHint(hint: FieldHint, phrase: string): string {
  if (hint.semanticType === 'preferences.toggle' || hint.type === 'boolean') {
    return 'boolean-input';
  }

  // s223-m02 (#2527 ruling 13 e): a phrase that names a choice control composes a Select. s216-m05 (374a6eaec)
  // removed the invented option-a/option-b values (#2384), and they were this cue's only carrier: "frequency
  // dropdown" fell to form-input, where Input and Select tie at the score cap and Input wins alphabetically. The
  // phrase carries the cue now, and the Select still gets no invented options.
  if ((hint.enum && hint.enum.length > 0) || CHOICE_CONTROL_CUE.test(phrase.toLowerCase())) {
    return 'enum-input';
  }

  if (hint.type === 'datetime' || hint.type === 'date' || hint.semanticType === 'timestamp') {
    return 'date-input';
  }

  if (hint.type === 'email') {
    return 'email-input';
  }

  return 'form-input';
}

function inferFormFieldDescriptorsFromIntent(
  intent: string,
  slots: Slot[],
): Map<string, { hint: FieldHint; context: string[] }> {
  const fieldSlots = slots
    .filter((slot) => /^field-\d+$/.test(slot.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (fieldSlots.length === 0) {
    return new Map();
  }

  const listSource = intent.includes(':')
    ? intent.slice(intent.indexOf(':') + 1)
    : intent;
  const phrases = listSource
    .split(/,|;|\n|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  if (phrases.length < 2) {
    return new Map();
  }

  const lowerIntent = intent.toLowerCase();
  const preferenceContext = /(settings|preference|notification)/.test(lowerIntent)
    ? 'settings preferences notification'
    : undefined;
  const descriptors = new Map<string, { hint: FieldHint; context: string[] }>();
  for (let i = 0; i < fieldSlots.length && i < phrases.length; i++) {
    const hint = inferIntentFieldHint(phrases[i]);
    if (hint.type === 'boolean' && preferenceContext) {
      hint.semanticType = 'preferences.toggle';
    }

    descriptors.set(fieldSlots[i].name, {
      hint,
      context: hint.semanticType === 'preferences.toggle' && preferenceContext
        ? [phrases[i], preferenceContext]
        : [phrases[i]],
    });
  }

  return descriptors;
}

/* ------------------------------------------------------------------ */
/*  Object → objectUsed metadata                                       */
/* ------------------------------------------------------------------ */

function buildObjectUsedInfo(composed: ComposedObject): ObjectUsedInfo {
  const viewExtensionsApplied: Record<string, number> = {};
  for (const [ctx, exts] of Object.entries(composed.viewExtensions)) {
    viewExtensionsApplied[ctx] = exts.length;
  }

  const traitStateMachines: TraitStateMachineEntry[] = [];
  const traitActionsEntries: TraitActionsEntry[] = [];
  for (const resolvedTrait of composed.traits) {
    const def = resolvedTrait.definition;
    if (def.state_machine) {
      traitStateMachines.push({ trait: resolvedTrait.ref.name, stateMachine: def.state_machine });
    }
    if (def.actions && def.actions.length > 0) {
      traitActionsEntries.push({ trait: resolvedTrait.ref.name, actions: def.actions });
    }
  }

  return {
    name: composed.object.name,
    version: composed.object.version,
    traits: composed.traits.map((t) => t.ref.name),
    fieldsComposed: Object.keys(composed.schema).length,
    viewExtensionsApplied,
    ...(traitStateMachines.length > 0 ? { traitStateMachines } : {}),
    ...(traitActionsEntries.length > 0 ? { traitActions: traitActionsEntries } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Node counting                                                      */
/* ------------------------------------------------------------------ */

function countNodes(schema: UiSchema): number {
  let count = 0;
  function walk(el: UiElement) {
    count++;
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return count;
}

function resolveCatalogFallback(
  entry: SlotPlan,
  layout: LayoutType,
): string | undefined {
  switch (entry.component) {
    case 'BillingSummaryBadge':
      return layout === 'dashboard' ? 'PriceSummary' : 'PriceBadge';
    case 'BillingCardMeta':
      return 'PriceCardMeta';
    default:
      return undefined;
  }
}

function normalizeObjectPlanForCatalog(
  plan: SlotPlan[],
  catalog: ComponentCatalogSummary[],
  layout: LayoutType,
): SlotPlan[] {
  const allowedComponents = new Set(catalog.map((component) => component.name));
  const deduped = new Set<string>();
  const normalized: SlotPlan[] = [];

  for (const entry of plan) {
    const component = allowedComponents.has(entry.component)
      ? entry.component
      : resolveCatalogFallback(entry, layout);
    if (!component || !allowedComponents.has(component)) {
      continue;
    }

    let nextEntry = component === entry.component
      ? entry
      : { ...entry, component };
    // s223-m01 (#2527 ruling 6): a card's `after` recipes (its price, its owner) read under the title and status in the
    // card body, left-aligned. The footer is end-aligned for the card's actions, so they sat indented or flush right.
    if (layout === 'card' && nextEntry.position === 'after' && !nextEntry.targetSlot && nextEntry.component !== 'Button') {
      nextEntry = { ...nextEntry, targetSlot: 'body' };
    }
    const signature = `${nextEntry.targetSlot ?? ''}:${nextEntry.component}:${JSON.stringify(nextEntry.props)}`;
    if (deduped.has(signature)) {
      continue;
    }

    deduped.add(signature);
    normalized.push(nextEntry);
  }

  return normalized;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

/** A generation refusal the target contracts would raise, keyed so an override is judged only by what it adds. */
const contractIssueKeys = (schema: UiSchema): Set<string> => {
  const keys = new Set<string>();
  for (const framework of ['react', 'vue'] as const) {
    const result = preflightTargetContracts(schema, framework);
    for (const issue of [...result.issues, ...result.bindingSafetyIssues]) keys.add(`${framework}:${issue.nodeId ?? ''}:${issue.message}`);
  }
  return keys;
};

/**
 * The composer's candidates a swap may choose from (Sprint 202 m01): every candidate is re-composed as the
 * override it would become and kept only when the target contracts accept the result in both frameworks, so
 * the page never offers a component code.generate refuses (OODS-V007). The selected component always stays.
 * A trial keeps the version's own order overrides; when those name what the candidate does not place, the swap
 * itself would be refused (OODS-V204), so that candidate is left out instead of failing the recording (s202-m04).
 * The same applies to a candidate that violates the result-state family (OODS-V211): exclude the unsafe swap,
 * while an explicitly requested unsafe screen still fails before recording (s212-m06).
 */
export async function swappableCandidates(input: DesignComposeInput, schema: UiSchema, selection: SlotSelectionEntry): Promise<string[]> {
  const names = [...new Set([...selection.candidates.map(candidate => candidate.name), ...(selection.alternativeCandidates ?? []).map(candidate => candidate.name)])];
  if (names.length <= 1) return names;
  const baseline = contractIssueKeys(schema);
  const viable: string[] = [];
  for (const name of names) {
    if (name === selection.selectedComponent) { viable.push(name); continue; }
    const { compositionId: _id, parentVersion: _parent, ...compose } = input;
    let trial: Awaited<ReturnType<typeof handle>>;
    try {
      trial = await handle({
        ...compose,
        preferences: { ...(input.preferences ?? {}), componentOverrides: { ...(input.preferences?.componentOverrides ?? {}), [selection.slotName]: name } },
        options: { ...(input.options ?? {}), transient: true, validate: false },
      });
    } catch (error) {
      if (error instanceof ToolError && ['OODS-V204', 'OODS-V211'].includes(error.opiCode)) continue;
      throw error;
    }
    if (trial.status !== 'ok' || !trial.schema) continue;
    const added = [...contractIssueKeys(trial.schema)].filter(key => !baseline.has(key));
    if (!added.length) viable.push(name);
  }
  return viable;
}

/** Write the result as a composition version: a new composition, or the next version of the one named. */
async function recordComposition(input: DesignComposeInput, schema: UiSchema, selections: SlotSelectionEntry[]): Promise<Pick<DesignComposeOutput, 'compositionId' | 'version' | 'parentVersion' | 'operation' | 'head'>> {
  const directory = resolveCompositionsDir();
  const { compositionId: _id, parentVersion: _parent, ...compose } = input;
  // Positional, not keyed by slot name: a workflow's four screens repeat slot names.
  const candidatesBySlot: string[][] = [];
  // A workflow offers no swaps: a componentOverride applies to every one of its four screens, so a candidate
  // measured safe on one screen is not a candidate for the workflow. Each slot records only what it carries.
  for (const selection of selections) candidatesBySlot.push(input.context === 'workflow'
    ? (selection.selectedComponent ? [selection.selectedComponent] : [])
    : await swappableCandidates(input, schema, selection));
  const target = input.compositionId
    ? { compositionId: input.compositionId, operation: (input.options?.operation ?? 'recompose') as CompositionOperation, ...(await nextVersion(directory, input.compositionId, input.parentVersion)) }
    : { compositionId: newCompositionId(), version: 1, parentVersion: null, operation: 'compose' as const };
  const theme = input.preferences?.theme === 'dark' || input.preferences?.theme === 'hc' ? input.preferences.theme : 'light';
  const brand = input.preferences?.brand === undefined ? DEFAULT_BRAND : assertKnownBrand(input.preferences.brand, 'preferences.brand');
  const record: CompositionVersion = {
    recordVersion: '1', compositionId: target.compositionId, version: target.version, parentVersion: target.parentVersion, operation: target.operation,
    createdAt: new Date().toISOString(), head: readForgeHead(),
    compose: compose as unknown as Record<string, unknown>, schema, schemaHash: `sha256:${createHash('sha256').update(JSON.stringify(schema)).digest('hex')}`,
    brand, theme,
    slots: selections.map((selection, index) => ({ slotName: selection.slotName, ...(selection.selectedComponent ? { selectedComponent: selection.selectedComponent } : {}), ...(selection.placedComponents ? { placedComponents: selection.placedComponents } : {}),
      // The composer's own candidates for the slot that generate: what a swap may choose from.
      candidates: candidatesBySlot[index] ?? [] })),
    artifacts: {}, measurements: {},
  };
  await writeVersion(directory, record);
  return { compositionId: record.compositionId, version: record.version, parentVersion: record.parentVersion, operation: record.operation, head: record.head };
}

export async function handle(input: DesignComposeInput): Promise<DesignComposeOutput> {
  const warnings: ComposeIssue[] = [];

  // Apply .oodsrc preference fallbacks (explicit input always wins)
  const rc = loadOodsrc();
  if (rc.preferences) {
    const merged = { ...rc.preferences, ...input.preferences };
    // Only apply if there's something to merge
    if (Object.keys(merged).length > 0) {
      input = { ...input, preferences: merged };
    }
  }
  if (!input.context && rc.context) {
    input = { ...input, context: rc.context };
  }
  if (!input.layout && rc.layout) {
    input = { ...input, layout: rc.layout };
  }

  if (input.context === 'workflow') {
    // s206-m01: an object that does not compose all four screens (a read-only record, an embedded Chunk) is refused
    // here, naming the workflow, rather than by whichever of the four screens it lacks.
    const definition = input.object ? (() => { try { return loadObject(input.object!); } catch { return undefined; } })() : undefined;
    if (definition && !supportsContext(definition, 'workflow')) {
      return { status: 'error', layout: '', schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] }, selections: [], warnings: [], errors: [contextRefusal(definition, 'workflow')] };
    }
    // s205-m01 (a Sprint 204 carry): the four screens compose TRANSIENTLY and the assembled workflow is recorded
    // once. Before this each screen recorded its own composition and the workflow returned the list's, so the
    // stored version held the list screen alone with context "list", and a workflow preview showed a list.
    const assembled = await assembleWorkflow({ ...input, options: { ...(input.options ?? {}), transient: true } }, handle);
    if (assembled.status === 'ok') {
      const substitutions = annotateSubstitutions(assembled.schema);
      if (substitutions.length && assembled.meta) assembled.meta.substitutions = substitutions;
    }
    if (assembled.status !== 'ok' || input.options?.transient) return assembled;
    return { ...assembled, ...(await recordComposition(input, assembled.schema, assembled.selections)) };
  }

  // Reject empty or whitespace-only intent when no object is provided
  if (input.intent !== undefined && !input.intent.trim() && !input.object) {
    return {
      status: 'error',
      layout: '',
      schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
      selections: [],
      warnings: [],
      errors: [{
        code: 'OODS-V003',
        message: 'intent must not be empty or whitespace-only when no object is provided.',
        hint: 'Provide a descriptive intent (e.g., "A detail view for a Product") or specify an object.',
      }],
    };
  }

  // Resolve intent/object/context via hybrid resolver
  const resolved = resolveIntentObject(input.intent, input.object, input.context);

  // Surface resolution warnings
  for (const w of resolved.warnings) {
    warnings.push({ code: 'OODS-V118', message: w });
  }

  // Use resolved values (may include auto-detected object/context)
  const effectiveObject = resolved.object;
  const effectiveContext = resolved.context ?? input.context;

  // Object-aware composition: load and compose when object is present
  let composed: ComposedObject | undefined;
  let objectUsed: ObjectUsedInfo | undefined;
  let readOnly = false;
  let readTab: string | undefined;
  let viewState = new Set<string>();

  if (effectiveObject) {
    try {
      const objectDef = loadObject(effectiveObject);
      if (!supportsContext(objectDef, effectiveContext ?? 'detail')) {
        return {
          status: 'error', layout: '',
          schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
          selections: [], warnings,
          errors: [contextRefusal(objectDef, effectiveContext ?? 'detail')],
        };
      }
      readOnly = isReadOnly(objectDef);
      readTab = objectDef.metadata?.detailTab;
      composed = composeObject(objectDef);
      viewState = viewStateFields(objectDef, composed);
      objectUsed = buildObjectUsedInfo(composed);

      // Surface maturity warning for non-stable objects
      const maturity = objectDef.metadata?.maturity;
      if (maturity && maturity !== 'stable') {
        warnings.push({
          code: 'OODS-V121',
          message: `Object '${effectiveObject}' has maturity '${maturity}' — composed output may change.`,
          hint: 'Consider using stable objects for production compositions.',
        });
      }

      // Surface composition warnings
      for (const w of composed.warnings) {
        warnings.push({
          code: 'OODS-V117',
          message: w,
        });
      }
    } catch (e) {
      // Fuzzy-match suggestion for unknown objects
      const fuzzy = fuzzyMatchObject(effectiveObject);
      const hint = fuzzy && fuzzy.similarity >= 0.4
        ? `Did you mean "${fuzzy.match}"? (similarity: ${(fuzzy.similarity * 100).toFixed(0)}%)`
        : 'The object tool (action: list) describes each object.';
      // s206-m03: a name that is not an object is said plainly; any other load failure keeps its own cause.
      const available = listObjects();
      const message = available.includes(effectiveObject)
        ? `Failed to load object "${effectiveObject}": ${(e as Error).message}`
        : unknownObjectMessage(effectiveObject, available);

      return {
        status: 'error',
        layout: '',
        schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
        selections: [],
        warnings,
        errors: [{
          code: e instanceof ToolError ? e.opiCode : available.includes(effectiveObject) ? 'OODS-V215' : 'OODS-N005',
          message,
          hint,
        }],
      };
    }
  }

  const semanticTypes = buildSemanticTypeMap(composed?.semantics);

  // 1. Parse intent and detect layout
  const intentStr = resolved.intent;
  const parsedIntentSections = parseIntentSections(intentStr);
  const dashboardSectionPlan = buildDashboardSectionPlan(parsedIntentSections);
  let layoutType: LayoutType;
  let layoutDetected: string;

  if (input.layout && input.layout !== 'auto') {
    layoutType = input.layout;
    layoutDetected = `explicit: ${input.layout}`;
  } else if (composed && effectiveContext) {
    const inferredLayout = inferLayoutFromContext(effectiveContext);
    if (resolved.contextSource === 'auto-detected' && prefersDashboardLayout(parsedIntentSections) && inferredLayout !== 'dashboard') {
      layoutType = 'dashboard';
      layoutDetected = `auto: dashboard (section-signaled, base ${inferredLayout})`;
    } else {
      // Object-aware: infer layout from explicit or aligned context hints.
      layoutType = inferredLayout;
      layoutDetected = `context-inferred: ${layoutType} (from context="${effectiveContext}")`;
    }
  } else {
    const detection = detectLayout(intentStr);
    if (prefersDashboardLayout(parsedIntentSections) && detection.layout !== 'dashboard') {
      layoutType = 'dashboard';
      layoutDetected = `auto: dashboard (section-signaled, base ${detection.layout})`;
    } else {
      layoutType = detection.layout;
      layoutDetected = detection.confidence === undefined
        ? `default: ${detection.layout} (no layout keyword matched)`
        : `auto: ${detection.layout} (confidence ${detection.confidence.toFixed(2)})`;
    }

    if (detection.confidence === undefined || detection.confidence < 0.5) {
      warnings.push({
        code: 'OODS-V116',
        message: detection.confidence === undefined
          ? 'No layout keyword matched; dashboard is the default. Consider specifying layout explicitly.'
          : `Layout auto-detection confidence is low (${detection.confidence.toFixed(2)}). Consider specifying layout explicitly.`,
        hint: `Set layout to one of: dashboard, form, detail, list`,
      });
    }
  }

  // Generic form controls edit scalar values. Collections and structured
  // documents remain in the complete object schema and its trait editors, but
  // must not influence generic control selection or its primary field binding.
  // s206-m01: a list-behavior trait's view state (search query, filter count, page) is placed on no screen.
  // s213-m01: neither is a field the object's contract never supplies (unavailable).
  // Imported schemas carry explicit access direction. Do not expose write-only samples on read screens,
  // or place read-only fields in editable forms. The stored definition retains the complete source contract.
  if (composed) {
    const visible = Object.fromEntries(Object.entries(composed.schema).filter(([, field]) => layoutType === 'form' ? !field.readOnly : !field.writeOnly));
    composed = { ...composed, schema: visible, samples: composed.samples?.map(sample => Object.fromEntries(Object.entries(sample).filter(([key]) => Object.hasOwn(visible, key)))) };
  }
  const recordFields = composed ? Object.fromEntries(Object.entries(composed.schema).filter(([name, field]) => !viewState.has(name) && field.unavailable !== true)) : undefined;
  const formFields = composed && layoutType === 'form'
    ? Object.fromEntries(Object.entries(recordFields!).filter(([, field]) => (
      Boolean(field.validation?.enum?.length)
      || ['string', 'datetime', 'email', 'date', 'url', 'uuid', 'integer', 'number', 'boolean'].includes(field.type.replace(/\?$/, ''))
    )))
    : undefined;

  // 2. Select layout template
  let template = selectTemplate(
    layoutType,
    input.preferences,
    layoutType === 'dashboard' ? dashboardSectionPlan : undefined,
    layoutType === 'form' && composed
      ? buildFormFieldSlots(
        input.preferences?.fieldGroups ?? 3,
        formFields ?? recordFields!,
        composed.semantics,
        semanticTypes,
      )
      : undefined,
    input.context,
  );
  let { schema, slots } = template;

  // 2b. Expand slots if object has more fields than template provides
  let expansionResult: ReturnType<typeof expandSlots> | undefined;
  let formFieldGroups: Record<string, string[]> | undefined;
  if (composed) {
    const expCtx: ExpansionContext = {
      layout: layoutType,
      fields: formFields ?? recordFields!,
      semanticTypes,
    };
    expansionResult = expandSlots(template, expCtx);
    if (expansionResult.expanded) {
      template = expansionResult.template;
      schema = template.schema;
      slots = template.slots;
    }

    // Wire semantic tab labels from trait categories (s86-m01).
    // When the detail layout has tabs and object composition produced traits,
    // derive human-readable labels instead of generic "Tab 1", "Tab 2".
    // User-provided preferences.tabLabels still take precedence.
    if (layoutType === 'detail' && composed) {
      const contextForLabels = effectiveContext === 'dashboard' && !composed.viewExtensions.dashboard ? 'detail' : effectiveContext ?? 'detail';
      const labelResult = generateLabels(composed, contextForLabels, input.preferences?.tabLabels);

      for (const w of labelResult.warnings) {
        warnings.push({ code: 'OODS-V122', message: w });
      }

      if (labelResult.labels.length > 0) {
        // Patch tab panel labels in the schema tree
        const tabsEl = findTabsElement(schema.screens);
        const fieldGroups = expansionResult?.fieldGroups;

        if (tabsEl?.children) {
          // Track used labels to deduplicate field-derived labels
          const usedLabels = new Set(labelResult.labels);

          for (let i = 0; i < tabsEl.children.length; i++) {
            let label: string;
            if (i < labelResult.labels.length) {
              // Trait-category-derived label
              label = labelResult.labels[i];
            } else {
              // Derive label from field group for expanded tabs beyond category count
              const slotName = `tab-${i}`;
              const groupFields = fieldGroups?.[slotName];
              if (groupFields && groupFields.length > 0 && composed) {
                let derived = inferTabLabelFromFields(groupFields, composed.schema, composed.semantics);
                // Deduplicate: append index if label already used
                if (usedLabels.has(derived)) {
                  derived = `${derived} ${i + 1}`;
                }
                usedLabels.add(derived);
                label = derived;
              } else {
                label = `Additional ${i + 1}`;
              }
            }

            const child = tabsEl.children[i];
            if (child.props) {
              child.props.label = label;
            } else {
              child.props = { label };
            }
          }
        }

        // Update slot descriptions for all tabs with semantic labels
        const tabsElForDesc = findTabsElement(schema.screens);
        if (tabsElForDesc?.children) {
          for (let i = 0; i < tabsElForDesc.children.length; i++) {
            const label = tabsElForDesc.children[i].props?.label;
            if (label) {
              const slot = slots.find(s => s.name === `tab-${i}`);
              if (slot) {
                slot.description = `Content for "${label}" tab`;
              }
            }
          }
        }
      }
    }

    // Differentiate tab slot intents based on field group semantics.
    // This ensures each tab selects a different component instead of
    // all tabs getting the same 'data-display' → Card result.
    const fieldGroups = expansionResult?.fieldGroups;
    formFieldGroups = layoutType === 'form' ? fieldGroups : undefined;
    if (fieldGroups && composed) {
      for (const slot of slots) {
        if (!slot.name.startsWith('tab-')) continue;
        const groupFields = fieldGroups[slot.name];
        if (!groupFields || groupFields.length === 0) continue;

        const dominantIntent = inferSlotIntentFromFields(
          groupFields,
          composed.schema,
          composed.semantics,
        );
        if (dominantIntent) {
          slot.intent = dominantIntent;
          slot.description = `${slot.description} (${dominantIntent})`;
        }
      }
    }

    if (layoutType === 'form' && fieldGroups) {
      applyFormSlotMetadata(slots, fieldGroups, composed.schema, composed.semantics);
    }
  }

  // 3. Load catalog and fill slots
  let catalog: ComponentCatalogSummary[];
  try {
    const fullCatalog = await loadCatalog();
    catalog = fullCatalog.filter((c) => c.status !== 'planned');
  } catch (e) {
    return {
      status: 'error',
      layout: layoutType,
      schema,
      selections: [],
      warnings,
      errors: [{
        code: 'OODS-S005',
        message: `Failed to load component catalog: ${(e as Error).message}`,
      }],
    };
  }

  const topN = input.options?.topN ?? 3;
  const slotContextOverrides = new Map<string, string[]>();
  const strictFieldControlSlots = composed && layoutType === 'form'
    ? new Set(slots.filter((slot) => slot.name.startsWith('field-')).map((slot) => slot.name))
    : undefined;
  let sectionContextUsed = false;

  if (layoutType === 'dashboard') {
    slotContextOverrides.set('header', [parsedIntentSections.summary]);
    for (const section of dashboardSectionPlan.slots) {
      slotContextOverrides.set(section.slotName, section.context);
    }
    sectionContextUsed = dashboardSectionPlan.slots.length > 0;
  }

  // 3a. Object-aware slot filling: use view_extensions when object is present
  let selections: SlotSelectionEntry[];
  const contextForExtensions = effectiveContext === 'dashboard' && composed && !composed.viewExtensions.dashboard
    ? 'detail'
    : input.context
    ?? (
      resolved.contextSource === 'auto-detected'
      && effectiveContext
      && inferLayoutFromContext(effectiveContext) !== layoutType
        ? layoutType
        : effectiveContext ?? layoutType
    );
  let patternsApplied = 0;

  // Build per-slot field hints for intelligence-aware selection.
  // When field groups are available from expansion, each slot gets a hint
  // derived from the dominant field in its group — enabling differentiated
  // component selection across expanded tabs.
  const fieldHints = new Map<string, FieldHint>();
  if (composed) {
    // Build field-level hints first
    const perFieldHints = new Map<string, FieldHint>();
    for (const [fieldName, fieldDef] of Object.entries(composed.schema)) {
      const hint: FieldHint = { type: fieldDef.type };
      if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
        hint.enum = fieldDef.validation.enum;
      }
      if (composed.semantics?.[fieldName]?.semantic_type) {
        hint.semanticType = composed.semantics[fieldName].semantic_type;
      }
      perFieldHints.set(fieldName, hint);
    }

    // If field groups are available, create per-slot hints from them
    const fieldGroups = expansionResult?.fieldGroups;
    if (fieldGroups) {
      for (const [slotName, fieldNames] of Object.entries(fieldGroups)) {
        if (fieldNames.length === 0) continue;
        // Pick the most descriptive field hint (prefer semantic types)
        let bestHint: FieldHint | undefined;
        for (const fn of fieldNames) {
          const h = perFieldHints.get(fn);
          if (!h) continue;
          if (!bestHint || (h.semanticType && !bestHint.semanticType)) {
            bestHint = h;
          }
        }
        if (bestHint) {
          fieldHints.set(slotName, bestHint);
        }
      }
    }

    // Also include field-level hints for non-slot lookups
    for (const [fieldName, hint] of perFieldHints) {
      if (!fieldHints.has(fieldName)) {
        fieldHints.set(fieldName, hint);
      }
    }
  } else if (layoutType === 'form') {
    const inferredFormDescriptors = inferFormFieldDescriptorsFromIntent(intentStr, slots);
    for (const [slotName, descriptor] of inferredFormDescriptors) {
      fieldHints.set(slotName, descriptor.hint);
      slotContextOverrides.set(slotName, descriptor.context);
      const slot = slots.find((candidate) => candidate.name === slotName);
      if (slot) {
        slot.intent = inferSlotIntentFromFieldHint(descriptor.hint, descriptor.context[0] ?? '');
      }
    }
  } else if (layoutType === 'list') {
    slotContextOverrides.set('search', ['search input']);
    slotContextOverrides.set('filters', ['filter controls']);
    slotContextOverrides.set('toolbar-actions', ['toolbar actions']);
  }

  if (parsedIntentSections.isLongForm) {
    const sectionOverrides = buildSlotContextOverridesFromSections(slots, parsedIntentSections);
    for (const [slotName, contexts] of sectionOverrides) {
      if (!slotContextOverrides.has(slotName)) {
        slotContextOverrides.set(slotName, contexts);
      }
    }
    sectionContextUsed = sectionContextUsed || sectionOverrides.size > 0;
  }

  if (composed) {
    const collected = layoutType === 'dashboard'
      ? collectDashboardViewExtensions(composed)
      : collectViewExtensions(composed, contextForExtensions);
    for (const w of collected.warnings) {
      warnings.push({ code: 'OODS-V119', message: w });
    }

    // Timestampable exposes scalar dates, not an audit log. The read-only reconciler displays those
    // fields; do not attempt to place an AuditTimeline it would immediately remove.
    // s213-m01: `composed` is a `let`, so the callback keeps no narrowing; it reads the schema through a constant.
    const composedFields = composed.schema;
    const displayPlan = effectiveContext === 'detail' || effectiveContext === 'dashboard'
      ? collected.plan.filter(entry => entry.component !== 'AuditTimeline' || (typeof entry.props.auditLogField === 'string' && Boolean(composedFields[entry.props.auditLogField])))
      : collected.plan;
    const slotPlan = normalizeObjectPlanForCatalog(displayPlan, catalog, layoutType);

    if (slotPlan.length > 0) {
      // Use view_extension-driven slot filling
      const fillResult = fillSlotsWithObject(
        { schema, slots },
        slotPlan,
        catalog,
        input.preferences?.componentOverrides,
        intentStr,
        fieldHints.size > 0 ? fieldHints : undefined,
      );
      for (const w of fillResult.warnings) {
        warnings.push({ code: 'OODS-V120', message: w });
      }

      // Use the filled schema (fillSlotsWithObject clones internally)
      schema = fillResult.schema;

      // Convert placements to selections format
      selections = fillResult.placements.map((p) => {
        return {
          slotName: p.slotName,
          intent: slots.find((s) => s.name === p.slotName)?.intent ?? '',
          selectedComponent: p.components[0],
          explanation: '',
          // The stacked components are placements, not alternatives: candidates names the leader only.
          candidates: [{ name: p.components[0]!, reason: `${p.source} placement` }],
          placedComponents: [...p.components],
        };
      });

      // Also fill any remaining slots not covered by view_extensions
      const filledSlotNames = new Set(fillResult.placements.map((p) => p.slotName));
      const unfilledSlots = slots.filter((s) => !filledSlotNames.has(s.name));
      if (unfilledSlots.length > 0) {
        const fallbackSelections = fillSlots(
          unfilledSlots,
          catalog,
          input.preferences?.componentOverrides,
          topN,
          intentStr,
          input.preferences?.tabLabels,
          fieldHints.size > 0 ? fieldHints : undefined,
          slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
          strictFieldControlSlots,
          expansionResult?.detectedPatterns,
          warnings,
        );
        selections.push(...fallbackSelections);

        // Apply selection rankings to the schema tree (bridge the gap)
        applySelectionsToSchema(schema, fallbackSelections);
      }
    } else {
      // No view_extensions for this context — fall back to generic slot filling
      selections = fillSlots(
        slots,
        catalog,
        input.preferences?.componentOverrides,
        topN,
        intentStr,
        input.preferences?.tabLabels,
        fieldHints.size > 0 ? fieldHints : undefined,
        slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
        strictFieldControlSlots,
        expansionResult?.detectedPatterns,
        warnings,
      );

      // Apply selection rankings to the schema tree
      applySelectionsToSchema(schema, selections);
    }

    // Apply composite slot patterns for form/dashboard contexts
    if (composed && (layoutType === 'form' || layoutType === 'dashboard')) {
      const compCtx = layoutType as CompositionContext;
      const semanticMap = semanticTypes;

      // Apply patterns to unassigned fields
      const assignedFields = new Set<string>();
      const walk = (el: UiElement): void => {
        if (el.props?.field && typeof el.props.field === 'string') {
          assignedFields.add(el.props.field as string);
        }
        el.children?.forEach(walk);
      };
      schema.screens.forEach(walk);

      for (const [fieldName, fieldDef] of Object.entries(recordFields!)) {
        if (assignedFields.has(fieldName)) continue;
        const pattern = selectPattern(fieldName, fieldDef, compCtx, semanticMap[fieldName]);
        if (pattern) {
          patternsApplied++;
        }
      }
    }

    // Apply pattern-driven slot grouping: wrap pattern-grouped slots with
    // composite container components (e.g., AddressBlock, DateRange, MetricTrend)
    if (expansionResult?.patternGroups) {
      patternsApplied += applyPatternGroupWrappers(
        schema,
        expansionResult.patternGroups,
        composed.schema,
      );
    }
  } else {
    // No object — use generic slot filling (backward compatible)
    selections = fillSlots(
      slots,
      catalog,
      input.preferences?.componentOverrides,
      topN,
      intentStr,
      input.preferences?.tabLabels,
      fieldHints.size > 0 ? fieldHints : undefined,
      slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
      strictFieldControlSlots,
      expansionResult?.detectedPatterns,
      warnings,
    );

    // Apply selection rankings to the schema tree
    applySelectionsToSchema(schema, selections);

    // Enrich form field props from intent-parsed descriptions (no-object path)
    if (layoutType === 'form' && slotContextOverrides.size > 0) {
      enrichFormFieldPropsFromIntent(schema, slotContextOverrides, fieldHints);
    }
  }

  applyOverridesToSchema(
    schema,
    input.preferences?.componentOverrides,
    catalog,
    warnings,
  );

  // 3b. Populate object schema, field→component wiring, and bindings for codegen
  if (composed) {
    populateObjectSchema(schema, composed.schema, composed.semantics, composed.traits, composed.samples);
    if (layoutType === 'form' && formFieldGroups) {
      applyFormFieldBindingsFromGroups(
        schema,
        slots,
        formFieldGroups,
        composed.schema,
        composed.semantics,
      );
    }
    wireFieldProps(schema, viewState);
    populateFieldLabels(schema);

    if (effectiveContext) {
      populateBindings(
        schema,
        effectiveContext,
        Object.keys(composed.schema),
        composed.traits.map((trait) => trait.ref.name),
        readOnly,
      );
    }
  }

  if (composed && effectiveContext) populateCollections(schema, effectiveContext, composed.object.name, composed.traits.find(trait => trait.ref.name === 'behavioral/Searchable')?.ref.parameters?.placeholder as string | undefined);
  if (composed && effectiveContext) reconcileFormDetail(schema, effectiveContext, composed, input.preferences?.tabLabels, readTab, viewState);
  // Reconciled trait panels retain their slot identity; report the same confidence as their selection.
  const stampConfidence = (node: UiElement): void => {
    const slot = node.meta?.intent?.startsWith('slot:') ? node.meta.intent.slice(5) : undefined;
    const selected = selections.find(entry => entry.slotName === slot && entry.selectedComponent === node.component);
    if (selected) node.meta = { ...node.meta, confidence: selected.confidence, confidenceLevel: selected.confidenceLevel };
    node.children?.forEach(stampConfidence);
  };
  schema.screens.forEach(stampConfidence);
  reportLayoutLeaders(schema, selections);
  applyOrderOverrides(schema, input.preferences);
  if (composed && effectiveContext === 'list') populateListStates(schema);
  if (input.preferences?.brand) {
    const brand = assertKnownBrand(input.preferences.brand, 'preferences.brand');
    const applyChartBrand = (node: UiElement): void => {
      if (node.chart) node.chart.brand = brand;
      node.children?.forEach(applyChartBrand);
    };
    schema.screens.forEach(applyChartBrand);
  }
  // A slot nothing filled must not leave a focusable control with no accessible name on the page.
  dropUnfilledInteractiveSlots(schema);
  // A card header must not bind a field that says nothing about the record (s203 review #2180).
  bindCardHeadingField(schema, effectiveContext, composed?.object.name);
  // Nor an empty bordered box. The anchor stays where overrides and slot swaps expect it; only the
  // paint goes (s203 review #2180).
  neutralizeUnfilledSurfaceSlots(schema);
  // Each status badge reads the tone table its field's semantics name (s222-m03).
  nameStatusTables(schema);
  // A result state renders in its own family, never a severity colour (s205-m03, traits/core/Assessable).
  enforceResultStateFamily(schema);
  // Every screen root is named after its object and context: the generated shell's heading when the screen places none.
  labelScreens(schema, effectiveObject, effectiveContext);

  // Presentation changes the composed view before validation, hashing and persistence, never the source record.
  if (input.presentation === 'stage1-inspection' && effectiveObject === 'Run') {
    const omitScore = (node: UiElement): void => {
      if (node.children) node.children = node.children.filter(child => fieldKeyOf(child) !== 'accessibility_score');
      node.children?.forEach(omitScore);
    };
    schema.screens.forEach(omitScore);
  }

  // 4. Auto-validate
  let validation: DesignComposeOutput['validation'];
  const shouldValidate = input.options?.validate !== false;

  if (shouldValidate) {
    try {
      const validationResult = await validateHandle({
        mode: 'full',
        schema,
        options: { checkComponents: true },
      });

      validation = {
        status: validationResult.status,
        errors: validationResult.errors.map(e => ({
          code: e.code,
          message: e.message,
          path: e.path,
          hint: e.hint,
        })),
        warnings: validationResult.warnings.map(w => ({
          code: w.code,
          message: w.message,
          path: w.path,
          hint: w.hint,
        })),
      };
    } catch (e) {
      validation = {
        status: 'invalid',
        errors: [{
          code: 'OODS-V007',
          message: `Validation failed: ${(e as Error).message}`,
        }],
      };
    }
  } else {
    validation = { status: 'skipped' };
  }

  if (validation.status === 'invalid') return { status: 'error', layout: layoutType, schema, selections: [], validation, warnings, errors: validation.errors };

  // 4b. Sprint 88: Annotate slots/components with actions[] from Stage1 action_mappings.
  //     Sprint 88.1: Also merge per-component action instances if provided.
  const mappingsIn = input.actionMappings ?? [];
  const instancesIn = input.actionInstances ?? [];
  if (mappingsIn.length > 0 || instancesIn.length > 0) {
    const mergedMap = new Map<string, string[]>();
    const mergeResolved = (entries: ResolvedTraitActions[]) => {
      for (const { trait, verbs } of entries) {
        const list = mergedMap.get(trait) ?? [];
        for (const v of verbs) if (!list.includes(v)) list.push(v);
        mergedMap.set(trait, list);
      }
    };
    if (mappingsIn.length > 0) {
      mergeResolved(annotateWithActionMappings(schema, mappingsIn, composed));
    }
    if (instancesIn.length > 0 && mappingsIn.length > 0) {
      mergeResolved(annotateWithActionInstances(schema, instancesIn, mappingsIn, composed));
    }
    if (objectUsed && mergedMap.size > 0) {
      objectUsed.resolvedActions = Array.from(mergedMap.entries()).map(([trait, verbs]) => ({ trait, verbs }));
    }
  }

  // 5. Snapshot the mapping after Forge has made and validated its component choices.
  const substitutions = annotateSubstitutions(schema);
  const schemaRefRecord = createSchemaRef(schema, 'compose', input.object ? `${input.object} ${effectiveContext ?? layoutType}` : undefined);
  const schemaRefMeta = describeSchemaRef(schemaRefRecord);
  const presentSlots = new Set<string>();
  const collectSlots = (node: UiElement): void => {
    if (node.meta?.intent?.startsWith('slot:')) presentSlots.add(node.meta.intent.slice(5));
    node.children?.forEach(collectSlots);
  };
  schema.screens.forEach(collectSlots);
  const explainedSelections = applySelectionExplainability(selections.filter(entry => presentSlots.has(entry.slotName)));
  // Compute overall composition confidence from per-slot raw confidences
  const slotConfidences = explainedSelections
    .flatMap(s => s.confidence === undefined ? [] : [s.confidence]);
  const compositionConfidence = slotConfidences.length > 0
    ? Math.round((slotConfidences.reduce((sum, c) => sum + c, 0) / slotConfidences.length) * 100) / 100
    : undefined;
  const lowConfidenceSelections = explainedSelections
    .filter(s => s.confidenceLevel === 'low');
  const lowConfidenceSlots = lowConfidenceSelections
    .filter(s => s.confidence !== undefined && s.confidence < 0.5 && s.alternativeCandidates)
    .length;
  const lowConfidenceSlotNames = lowConfidenceSelections.map((selection) => selection.slotName);

  const intelligenceMeta = {
    ...(composed ? {
      fieldsExpanded: expansionResult?.expanded ?? false,
      ...(expansionResult?.expanded ? {
        slotsExpanded: expansionResult.slotsAdded,
        expansionReason: expansionResult.reason,
      } : {}),
      patternsApplied: patternsApplied > 0 ? patternsApplied : undefined,
      patternGroups: expansionResult?.patternGroups
        ? Object.entries(expansionResult.patternGroups).map(([slotName, p]) => ({
          slotName,
          patternId: p.patternId,
          compositeComponent: p.compositeComponent,
          matchedFields: p.matchedFields,
          confidence: p.confidence,
        }))
        : undefined,
    } : {}),
    fieldAffinityUsed: fieldHints.size > 0,
    intentSectionsParsed: parsedIntentSections.sections.length > 0 ? parsedIntentSections.sections.length : undefined,
    sectionContextUsed: sectionContextUsed || undefined,
    compositionConfidence,
    lowConfidenceSlots: lowConfidenceSlots > 0 ? lowConfidenceSlots : undefined,
    lowConfidenceSlotNames: lowConfidenceSlotNames.length > 0 ? lowConfidenceSlotNames : undefined,
  };

  // The composition is durable: one version file per result, beside the saved-schema store.
  const recorded = input.options?.transient ? undefined : await recordComposition(input, schema, explainedSelections);

  return {
    status: 'ok',
    layout: layoutType,
    schema,
    schemaRef: schemaRefMeta.ref,
    schemaRefCreatedAt: schemaRefMeta.createdAt,
    schemaRefExpiresAt: schemaRefMeta.expiresAt,
    ...(recorded ?? {}),
    selections: explainedSelections,
    validation,
    warnings,
    ...(objectUsed ? { objectUsed } : {}),
    meta: {
      ...(substitutions.length ? { substitutions } : {}),
      intentParsed: intentStr,
      layoutDetected,
      slotCount: explainedSelections.length,
      nodeCount: countNodes(schema),
      ...(resolved.objectSource === 'auto-detected' ? { objectAutoDetected: resolved.object } : {}),
      ...(resolved.contextSource === 'auto-detected' ? { contextAutoDetected: resolved.context } : {}),
      ...(resolved.intentSource === 'synthetic' ? { intentSynthetic: true } : {}),
      ...(warnings.length > 0 ? { warnings: warnings.map((w) => w.message) } : {}),
      ...((Object.values(intelligenceMeta).some((value) => value !== undefined)) ? {
        intelligence: {
          ...intelligenceMeta,
        },
      } : {}),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Sprint 88: action_mappings annotation                              */
/* ------------------------------------------------------------------ */

function traitOf(m: ActionMapping): string | undefined {
  return m.oodsTrait ?? m.trait;
}

function verbOf(m: ActionMapping): string | undefined {
  return m.verb ?? m.orcaVerb;
}

function slotNameFromIntent(el: UiElement): string | undefined {
  const intent = el.meta?.intent;
  if (typeof intent === 'string' && intent.startsWith('slot:')) {
    return intent.slice('slot:'.length);
  }
  return undefined;
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}

function attachVerb(el: UiElement, verb: string): void {
  if (!el.props) el.props = {};
  const existing = el.props.actions;
  if (Array.isArray(existing)) {
    pushUnique(existing as string[], verb);
  } else {
    el.props.actions = [verb];
  }
}

/**
 * Walk the composed schema and attach `actions[]` on slots/components based on
 * flat verb-keyed action_mappings. Returns the resolved per-trait verb groups
 * for surfacing on objectUsed.resolvedActions.
 */
export function annotateWithActionMappings(
  schema: UiSchema,
  mappings: ActionMapping[],
  composed: ComposedObject | undefined,
): ResolvedTraitActions[] {
  // Traits may be path-qualified (e.g. "lifecycle/Stateful"). Match on the
  // final segment so callers can pass either "Stateful" or "lifecycle/Stateful".
  const traitKey = (name: string) => name.split('/').pop() ?? name;
  const composedTraits = composed
    ? new Set(composed.traits.map(t => traitKey(t.ref.name)))
    : undefined;
  const perTraitVerbs = new Map<string, string[]>();

  // Collect elements once for component/slot scans
  const allElements: UiElement[] = [];
  const walk = (el: UiElement) => {
    allElements.push(el);
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);

  for (const mapping of mappings) {
    const trait = traitOf(mapping);
    const verb = verbOf(mapping);
    if (!trait || !verb) continue;
    // If composed with traits, filter to traits the object actually carries.
    if (composedTraits && !composedTraits.has(traitKey(trait))) continue;

    // Track resolved verb for this trait, keyed by unqualified trait name
    // so path-qualified and unqualified mappings roll up together.
    const key = traitKey(trait);
    const list = perTraitVerbs.get(key) ?? [];
    pushUnique(list, verb);
    perTraitVerbs.set(key, list);

    let matched = false;

    if (mapping.slot) {
      for (const el of allElements) {
        if (slotNameFromIntent(el) === mapping.slot) {
          attachVerb(el, verb);
          matched = true;
        }
      }
    }

    if (mapping.component) {
      for (const el of allElements) {
        if (el.component === mapping.component) {
          attachVerb(el, verb);
          matched = true;
        }
      }
    }

    // No component/slot hint — fall back to slot-name == trait (lowercase) if present,
    // otherwise rely on the objectUsed.resolvedActions grouping only.
    if (!mapping.slot && !mapping.component && !matched) {
      const traitLower = trait.toLowerCase();
      for (const el of allElements) {
        const slotName = slotNameFromIntent(el);
        if (slotName && slotName.toLowerCase() === traitLower) {
          attachVerb(el, verb);
        }
      }
    }
  }

  return Array.from(perTraitVerbs.entries()).map(([trait, verbs]) => ({ trait, verbs }));
}

/**
 * Sprint 88.1 — merge per-component ActionInstance entries against the
 * verb→trait vocabulary in `mappings`. For each instance whose verb appears in
 * the vocabulary and whose resolved trait is carried by the composed object,
 * the verb is attached to matching slots/components and rolled into
 * `resolvedActions`. `sourceComponent` narrows attachment when it matches a
 * UiElement component; otherwise behavior matches trait-only fallback.
 */
export function annotateWithActionInstances(
  schema: UiSchema,
  instances: ActionInstance[],
  mappings: ActionMapping[],
  composed: ComposedObject | undefined,
): ResolvedTraitActions[] {
  if (instances.length === 0) return [];
  // Build verb → [trait] lookup from the mappings vocabulary.
  const verbToTraits = new Map<string, string[]>();
  for (const m of mappings) {
    const v = verbOf(m);
    const t = traitOf(m);
    if (!v || !t) continue;
    const list = verbToTraits.get(v) ?? [];
    pushUnique(list, t);
    verbToTraits.set(v, list);
  }
  if (verbToTraits.size === 0) return [];

  // Track unresolved entity ids per sourceComponent for meta.unresolvedEntity
  // annotation after the synthetic mapping pass (Path B retention).
  const unresolvedBySourceComponent = new Map<string, string>();
  const composedObjectName = composed?.object?.name;

  // Project instances into synthetic ActionMappings. Stage1 `targetEntity`
  // narrows scope: when the resolver returns a specific OODS object AND the
  // composed object differs, the instance is skipped (it targets another
  // entity). When the resolver cannot place the raw id, the instance still
  // flows through so the node isn't silently dropped; the raw id is retained
  // on matching nodes as meta.unresolvedEntity for author-side triage.
  const synthetic: ActionMapping[] = [];
  for (const inst of instances) {
    const traits = verbToTraits.get(inst.verb) ?? [];
    if (traits.length === 0) continue;

    if (inst.targetEntity) {
      // Accept both pre-S40 string and post-S40 { id, hint, confidence,
      // signals } descriptor shapes (contract v1.2.4 §4.1). The descriptor's
      // `hint` is Stage1's canonical_name candidate; its `confidence` is the
      // §4 sum-with-cap score. Resolver gates on the 0.75 threshold so a
      // sub-threshold hint on a pure-DOM capture falls through to alias/slug
      // cleanly.
      const targetEntityId = typeof inst.targetEntity === 'string'
        ? inst.targetEntity
        : inst.targetEntity.id;
      const descriptorHint = typeof inst.targetEntity === 'object'
        ? inst.targetEntity.hint
        : undefined;
      const descriptorConfidence = typeof inst.targetEntity === 'object'
        ? inst.targetEntity.confidence
        : undefined;
      const resolution = resolveEntity(targetEntityId, {
        canonicalName: inst.canonicalName ?? descriptorHint,
        canonicalNameConfidence: inst.canonicalNameConfidence ?? descriptorConfidence,
      });
      if (isEntityResolved(resolution)) {
        if (composedObjectName && resolution.objectName !== composedObjectName) {
          // Entity belongs to a different OODS object — drop silently from the
          // composed schema; it will still surface on a future compose call
          // targeting that object.
          continue;
        }
      } else if (inst.sourceComponent) {
        // Remember the raw id so we can stamp meta.unresolvedEntity on the
        // matching node after the synthetic mappings are applied.
        unresolvedBySourceComponent.set(inst.sourceComponent, resolution.rawId);
      }
    }

    for (const trait of traits) {
      synthetic.push({
        verb: inst.verb,
        oodsTrait: trait,
        component: inst.sourceComponent,
        confidence: inst.confidence,
      });
    }
  }

  const resolved = annotateWithActionMappings(schema, synthetic, composed);

  if (unresolvedBySourceComponent.size > 0) {
    const walk = (el: UiElement) => {
      if (el.component && unresolvedBySourceComponent.has(el.component)) {
        const rawId = unresolvedBySourceComponent.get(el.component);
        if (rawId) {
          el.meta = el.meta ?? {};
          (el.meta as Record<string, unknown>).unresolvedEntity = rawId;
        }
      }
      el.children?.forEach(walk);
    };
    schema.screens.forEach(walk);
  }

  return resolved;
}
