/**
 * runPreEmit() — shared structural pre-emit pass.
 *
 * Per decision D2 (multi-fidelity render),
 * this module factors the tree-walking pre-emission work that every emitter
 * needs (component collection, handler/binding collection, prop defaults,
 * Tailwind variant definitions) out of the individual emitters into a single
 * canonical pass. It also enriches a PreEmitContext with Object Catalog
 * annotations (pragmatic_role, traits, relationships, evidence_refs,
 * projection_variants, brand_overlay) when an Object Catalog SemanticEntity
 * is provided as input — so new fidelities (boxes-and-arrows, wireframe,
 * A2UI runtime) can project from a single annotated source.
 *
 * Existing react/vue/html emitters now route their pre-walks through this
 * function and receive a PreEmitContext instead of re-walking the tree.
 * The format-specific emit walks (emitNode/emitTemplateNode/renderTree) are
 * unchanged — they remain in the per-fidelity emitters.
 */

import type {
  FieldSchemaEntry,
  UiElement,
  UiSchema,
} from '../schemas/generated.js';
import type {
  EvidenceRef,
  Location,
  OodsConfidenceDecomposition,
  OodsEvidenceChainEntry,
  OodsProjectionVariant,
  OodsSlot,
  PragmaticRole,
  SemanticEntity,
  TypedRelationship,
  URN,
  ElementSpec,
} from '../object-catalog/types.js';
import {
  analyzeBindings,
  collectBindings as collectHandlerBindings,
  collectPropDefaults,
  type BindingAnalysis,
} from './binding-utils.js';
import {
  collectTailwindVariantDefinitions,
  type TailwindVariantDefinition,
} from './tailwind-codegen-utils.js';
import type { CodegenOptions } from './types.js';

export type PreEmitSource = 'ui-schema' | 'object-catalog';

/** Catalog-axis enrichment derived from an Object Catalog SemanticEntity. */
export interface CatalogAnnotations {
  urn: URN;
  element: ElementSpec;
  pragmaticRole?: PragmaticRole;
  traits: string[];
  relationships: TypedRelationship[];
  evidenceRefs: EvidenceRef[];
  /** brand_overlay for the selected variant (or canonical render when no variant param). */
  brandOverlay?: string;
  projectionVariants: OodsProjectionVariant[];
  /** Slot tree for the selected variant (per PreEmitOptions.variant); canonical render.slots when no variant param. */
  slots: OodsSlot[];
  states: string[];
  preconditions: string[];
  effects: string[];
  semantics: {
    purpose: string;
    humanMeaning: string;
    tags: string[];
  };
  evidenceChain: OodsEvidenceChainEntry[];
  confidenceDecomposition?: OodsConfidenceDecomposition;
  context: Record<string, unknown>;
  locations: Location[];
}

/**
 * Result of the shared pre-emit pass.
 *
 * Today this is a function-shaped abstraction (the IR-in-disguise per D2).
 * It is deliberately not persisted or serialized in v0.1; formalization to a
 * typed intermediate is deferred until A2UI runtime emission triggers it,
 * per the open sub-question in the D2 memo.
 */
export interface PreEmitContext {
  /** Origin of the context: a UiSchema (legacy compose path) or an Object Catalog entity. */
  source: PreEmitSource;

  /** The walked UiSchema. For object-catalog input this is synthesized from oods.render.slots. */
  schema: UiSchema;

  /** Convenience alias for schema.screens. */
  tree: UiElement[];

  /** Object field schema (when present) used for prop enrichment + type generation. */
  objectSchema?: Record<string, FieldSchemaEntry>;

  /** Object-level semantic token overrides (when present). */
  tokenOverrides?: Record<string, string>;

  /** Distinct component names referenced in the tree. */
  components: Set<string>;

  /** Handler name → binding key. */
  handlers: Map<string, string>;

  /** Lossless binding classification, signatures, provenance, and validation issues. */
  bindingAnalysis: BindingAnalysis;

  /** Prop defaults derived from objectSchema field metadata (camelCase name → formatted value). */
  propDefaults: Map<string, { formatted: string; isExpression: boolean }>;

  /** Tailwind variant definitions per component, populated only when options.styling === 'tailwind'. */
  tailwindVariants: Map<string, TailwindVariantDefinition>;

  /** Codegen options surfaced for downstream readers. */
  options: CodegenOptions;

  /** Object Catalog annotations — set when the input was a SemanticEntity OR an entity was provided via options. */
  catalog?: CatalogAnnotations;
}

export interface PreEmitOptions {
  /** Codegen options. Tailwind variant collection only runs when styling === 'tailwind'. */
  options?: CodegenOptions;
  /** Optional Object Catalog entity to enrich a UiSchema input with catalog annotations. */
  entity?: SemanticEntity;
  /** When the input is a SemanticEntity with multiple projection_variants, pick by surface. */
  variant?: string;
}

const DEFAULT_OPTIONS: CodegenOptions = { typescript: false, styling: 'inline' };

/**
 * Walk a tree of UiElements and collect distinct component names.
 * Equivalent to the duplicated `collectComponents` previously defined inside
 * react-emitter and vue-emitter.
 */
function collectComponents(screens: UiElement[]): Set<string> {
  const names = new Set<string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    names.add(node.component);
    if (node.children) stack.push(...node.children);
  }
  return names;
}

function buildCatalogAnnotations(
  entity: SemanticEntity,
  variant?: string,
): CatalogAnnotations {
  const oods = entity.oods ?? {};
  const selection = selectVariant(entity, variant);
  const slots = selection?.slots ?? [];
  const brandOverlay = selection?.brandOverlay;
  const projectionVariants = oods.projection_variants ?? [];
  const evidenceChain = oods.evidence_chain ?? [];
  const confidenceDecomposition = oods.confidence_decomposition;
  const semantics = entity.semantics;

  return {
    urn: entity.urn,
    element: entity.element,
    pragmaticRole: entity.pragmatic_role,
    traits: entity.traits ? [...entity.traits] : [],
    relationships: entity.relationships?.edges
      ? [...entity.relationships.edges]
      : [],
    evidenceRefs: entity.evidence_refs ? [...entity.evidence_refs] : [],
    brandOverlay,
    projectionVariants: [...projectionVariants],
    slots: [...slots],
    states: entity.states ? [...entity.states] : [],
    preconditions: entity.preconditions ? [...entity.preconditions] : [],
    effects: entity.effects ? [...entity.effects] : [],
    semantics: {
      purpose: semantics.purpose,
      humanMeaning: semantics.human_meaning,
      tags: semantics.tags ? [...semantics.tags] : [],
    },
    evidenceChain: [...evidenceChain],
    confidenceDecomposition,
    context: entity.context ? { ...entity.context } : {},
    locations: entity.locations ? [...entity.locations] : [],
  };
}

/**
 * Pick the projection variant matching the requested surface, or fall back to
 * oods.render, the first projection variant, or null when nothing is available.
 */
function selectVariant(
  entity: SemanticEntity,
  variant?: string,
): { slots: OodsSlot[]; brandOverlay?: string; uiSchemaRef?: string } | null {
  const oods = entity.oods;
  if (!oods) return null;

  const variants = oods.projection_variants;
  if (variant && variants && variants.length > 0) {
    const match = variants.find((v) => v.surface === variant);
    if (match) {
      return {
        slots: match.slots ?? [],
        brandOverlay: match.brand_overlay,
        uiSchemaRef: match.ui_schema_ref,
      };
    }
  }

  if (oods.render) {
    return {
      slots: oods.render.slots ?? [],
      brandOverlay: oods.render.brand_overlay,
      uiSchemaRef: oods.render.ui_schema_ref,
    };
  }

  if (variants && variants.length > 0) {
    const first = variants[0];
    return {
      slots: first.slots ?? [],
      brandOverlay: first.brand_overlay,
      uiSchemaRef: first.ui_schema_ref,
    };
  }

  return null;
}

/**
 * Synthesize a minimal UiSchema from an Object Catalog entity when no host
 * UiSchema is supplied. Each slot becomes a child UiElement carrying a
 * data-binding reference. The synthesized tree exists so downstream renderers
 * (boxes-and-arrows, wireframe, A2UI) have a uniform walkable structure even
 * before a compose-emitted UiSchema is resolved against the catalog.
 *
 * Variant resolution happens *before* this synthesis (D2 sub-question #2): a
 * caller wanting multi-variant projection calls runPreEmit() once per variant.
 */
function synthesizeSchemaFromEntity(
  entity: SemanticEntity,
  variant?: string,
): UiSchema {
  const selection = selectVariant(entity, variant);
  const slots = selection?.slots ?? [];
  const rootId = `catalog-${entity.urn.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const elementType = entity.element.type;
  const slotElements: UiElement[] = slots.map((slot, idx) => ({
    id: `${rootId}-slot-${idx}`,
    component: 'Slot',
    props: {
      'data-slot-name': slot.name,
      'data-field': slot.binding.field,
    },
  }));
  const rootElement: UiElement = {
    id: rootId,
    component: elementType,
    props: {
      'data-entity-urn': entity.urn,
      'data-element-name': entity.element.name,
    },
    children: slotElements.length > 0 ? slotElements : undefined,
  };
  return {
    version: '1.0',
    screens: [rootElement],
  };
}

/**
 * Shared structural pre-emit pass.
 *
 * Accepts either a UiSchema (legacy compose path) or an Object Catalog
 * SemanticEntity (Object Catalog path). Returns a PreEmitContext carrying
 * the walked tree plus protocol-axis enrichment when catalog input is
 * available.
 *
 * @example legacy UiSchema path
 *   const ctx = runPreEmit(schema, { options });
 *   // ctx.components, ctx.handlers, ctx.propDefaults, ctx.tailwindVariants
 *
 * @example Object Catalog path
 *   const ctx = runPreEmit(entity, { variant: 'desktop' });
 *   // ctx.catalog.pragmaticRole, ctx.catalog.relationships, ctx.catalog.traits
 */
export function runPreEmit(
  input: UiSchema,
  options?: PreEmitOptions,
): PreEmitContext;
export function runPreEmit(
  input: SemanticEntity,
  options?: PreEmitOptions,
): PreEmitContext;
export function runPreEmit(
  input: UiSchema | SemanticEntity,
  options: PreEmitOptions = {},
): PreEmitContext {
  const codegenOptions = options.options ?? DEFAULT_OPTIONS;

  const isEntity =
    typeof (input as SemanticEntity).urn === 'string' &&
    (input as SemanticEntity).element !== undefined &&
    (input as SemanticEntity).semantics !== undefined;

  let schema: UiSchema;
  let source: PreEmitSource;
  let entity: SemanticEntity | undefined;

  if (isEntity) {
    entity = input as SemanticEntity;
    schema = synthesizeSchemaFromEntity(entity, options.variant);
    source = 'object-catalog';
  } else {
    schema = input as UiSchema;
    source = 'ui-schema';
    if (options.entity) entity = options.entity;
  }

  const components = collectComponents(schema.screens);
  const handlers = collectHandlerBindings(schema.screens);
  const bindingAnalysis = analyzeBindings(schema.screens);

  const objectSchema = schema.objectSchema;
  const hasObjectSchema = !!objectSchema && Object.keys(objectSchema).length > 0;
  const propDefaults = hasObjectSchema
    ? collectPropDefaults(schema.screens, objectSchema!)
    : new Map<string, { formatted: string; isExpression: boolean }>();

  const tailwindVariants = codegenOptions.styling === 'tailwind'
    ? collectTailwindVariantDefinitions(schema.screens)
    : new Map<string, TailwindVariantDefinition>();

  const catalog = entity ? buildCatalogAnnotations(entity, options.variant) : undefined;

  return {
    source,
    schema,
    tree: schema.screens,
    objectSchema,
    tokenOverrides: schema.tokenOverrides,
    components,
    handlers,
    bindingAnalysis,
    propDefaults,
    tailwindVariants,
    options: codegenOptions,
    catalog,
  };
}
