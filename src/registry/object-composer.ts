import { performance } from 'node:perf_hooks';
import { TraitCompositor, type BaseObjectDefinition } from '../core/compositor.js';
import type { ComposedObject, CollisionInfo, FieldProvenance } from '../core/composed-object.js';
import { mergeTokens } from '../core/merge-strategies/tokens-merger.js';
import type { RegistryRecord } from './indexer.js';
import type {
  ObjectDefinition,
  ObjectFieldDefinition,
  ObjectViewOverrides,
} from './object-definition.js';
import { buildConflictPlan, type ConflictResolutionPlan } from './conflict-applier.js';
import type { ResolvedTrait, TraitResolver } from './resolver.js';
import TimeService from '../services/time/index.js';

export interface ObjectComposerOptions {
  readonly traitResolver: TraitResolver;
}

export interface ComposeOptions {
  readonly base?: {
    readonly name: string;
    readonly composed: ComposedObject;
  };
}

export interface ResolvedObjectMetadata {
  readonly resolvedAt: Date;
  readonly resolutionMs: number;
  readonly compositionMs: number;
  readonly totalMs: number;
}

export interface ResolvedObject {
  readonly record: RegistryRecord;
  readonly definition: ObjectDefinition;
  readonly resolvedTraits: readonly ResolvedTrait[];
  readonly composed: ComposedObject;
  readonly base?: ComposeOptions['base'];
  readonly conflictPlan: ConflictResolutionPlan;
  readonly viewOverrides?: ObjectViewOverrides;
  readonly metadata: ResolvedObjectMetadata;
}

export class ObjectComposer {
  private readonly traitResolver: TraitResolver;

  constructor(options: ObjectComposerOptions) {
    this.traitResolver = options.traitResolver;
  }

  async compose(record: RegistryRecord, options: ComposeOptions = {}): Promise<ResolvedObject> {
    const resolutionStart = performance.now();
    const resolvedTraits = await this.traitResolver.resolveObject(record.definition, {
      objectName: record.definition.object.name,
      objectFilePath: record.source.path,
    });
    const resolutionMs = performance.now() - resolutionStart;

    const conflictPlan = buildConflictPlan(record.definition);
    const compositor = this.createCompositor(conflictPlan);

    const baseDefinition = options.base ? toBaseObjectDefinition(options.base) : undefined;
    const traitDefinitions = resolvedTraits.map((resolved) => resolved.definition);

    const compositionStart = performance.now();
    const compositionResult = compositor.compose(traitDefinitions, baseDefinition);
    const compositionMs = performance.now() - compositionStart;

    if (!compositionResult.success || !compositionResult.data) {
      throw new Error(
        `Composition failed for object "${record.definition.object.name}": ` +
          (compositionResult.errors?.[0]?.message ?? 'Unknown error')
      );
    }

    const composed = compositionResult.data;
    applyObjectOverrides(composed, record.definition, conflictPlan, record.definition.object.name);

    const metadata: ResolvedObjectMetadata = {
      resolvedAt: TimeService.nowSystem().toJSDate(),
      resolutionMs,
      compositionMs,
      totalMs: resolutionMs + compositionMs,
    };

    return {
      record,
      definition: record.definition,
      resolvedTraits,
      composed,
      base: options.base,
      conflictPlan,
      viewOverrides: record.definition.views,
      metadata,
    };
  }

  private createCompositor(conflictPlan: ConflictResolutionPlan): TraitCompositor {
    return new TraitCompositor({
      trackPerformance: true,
      trackProvenance: true,
      collisionResolutions: conflictPlan.fieldResolutions,
    });
  }
}

function toBaseObjectDefinition(base: ComposeOptions['base'] | undefined): BaseObjectDefinition | undefined {
  if (!base) {
    return undefined;
  }

  return {
    id: base.composed.id,
    name: base.composed.name,
    schema: { ...base.composed.schema },
    semantics: { ...base.composed.semantics },
    tokens: { ...base.composed.tokens },
    viewExtensions: { ...base.composed.viewExtensions },
    actions: [...base.composed.actions],
    stateMachine: base.composed.stateMachine
      ? {
          definition: base.composed.stateMachine.definition,
          ownerTrait: base.composed.stateMachine.ownerTrait,
        }
      : undefined,
  };
}

function applyObjectOverrides(
  composed: ComposedObject,
  definition: ObjectDefinition,
  conflictPlan: ConflictResolutionPlan,
  objectName: string
): void {
  if (definition.schema) {
    applySchemaOverrides(composed, definition.schema, conflictPlan, objectName);
  }

  if (definition.semantics) {
    composed.semantics = {
      ...composed.semantics,
      ...definition.semantics,
    };
  }

  if (definition.tokens) {
    const mergeResult = mergeTokens(composed.tokens, definition.tokens, composed.name, objectName);
    composed.tokens = mergeResult.tokens;
    if (mergeResult.warnings.length > 0) {
      composed.metadata.warnings.push(...mergeResult.warnings);
    }
  }

  if (definition.actions && definition.actions.length > 0) {
    composed.actions = [...composed.actions, ...definition.actions];
  }
}

function applySchemaOverrides(
  composed: ComposedObject,
  schema: Record<string, ObjectFieldDefinition>,
  conflictPlan: ConflictResolutionPlan,
  objectName: string
): void {
  const provenanceOrder = composed.metadata.traitCount;

  for (const [fieldName, fieldDefinition] of Object.entries(schema)) {
    const schemaField = toSchemaField(fieldDefinition);
    const existing = composed.schema[fieldName];
    const existingProvenance = composed.metadata.provenance.get(fieldName);

    composed.schema[fieldName] = schemaField;

    const previousSources = existingProvenance
      ? [existingProvenance.source, ...(existingProvenance.previousSources ?? [])]
      : undefined;

    const provenance: FieldProvenance = {
      fieldName,
      source: objectName,
      layer: 'object',
      order: provenanceOrder,
      overridden: Boolean(existingProvenance),
      previousSources,
    };

    composed.metadata.provenance.set(fieldName, provenance);

    if (existing && conflictPlan.objectFieldOverrides.has(fieldName)) {
      const conflictingTraits = previousSources
        ? Array.from(new Set([...previousSources, objectName]))
        : [objectName];
      const collision: CollisionInfo = {
        fieldName,
        conflictingTraits,
        resolution: 'manual',
        details: 'Object-level override applied',
        winner: objectName,
      };
      composed.metadata.collisions.push(collision);
    }
  }
}

function toSchemaField(field: ObjectFieldDefinition): {
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
  validation?: Record<string, unknown>;
} {
  return {
    type: field.type,
    required: field.required ?? true,
    default: field.default,
    description: field.description,
    validation: field.validation ? { ...field.validation } : undefined,
  };
}
