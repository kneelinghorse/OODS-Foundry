/**
 * Composed Object Interface
 *
 * Defines the structure of a composed object after trait composition.
 * Includes the final merged schema, semantics, tokens, and view extensions,
 * along with provenance metadata tracking which traits contributed what.
 */

import TimeService from '../services/time/index.js';
import type {
  TraitDefinition,
  SchemaField,
  SemanticMapping,
  ViewExtension,
  TokenDefinition,
  TraitAction,
  StateMachine,
} from './trait-definition.js';

/**
 * Provenance information tracking which trait contributed a field
 */
export interface FieldProvenance {
  /**
   * Name of the field
   */
  fieldName: string;

  /**
   * Trait that contributed this field (or 'base' for base object fields)
   */
  source: string;

  /**
   * Layer in the merge cascade where this field was introduced
   */
  layer: 'foundation' | 'base' | 'trait' | 'object' | 'context';

  /**
   * Order in the composition sequence
   */
  order: number;

  /**
   * Whether this field overrode a previous value
   */
  overridden?: boolean;

  /**
   * Previous value(s) if this field overrode something
   */
  previousSources?: string[];
}

/**
 * Collision information for fields that had conflicts during composition
 */
export interface CollisionInfo {
  /**
   * Field name that had a collision
   */
  fieldName: string;

  /**
   * Traits that attempted to define this field
   */
  conflictingTraits: string[];

  /**
   * Resolution strategy applied
   */
  resolution: 'stricter_type' | 'enum_union' | 'required_wins' | 'manual' | 'error';

  /**
   * Details about the resolution
   */
  details: string;

  /**
   * The winning trait/source
   */
  winner: string;
}

/**
 * Metadata about the composition process
 */
export interface CompositionMetadata {
  /**
   * Timestamp when composition occurred
   */
  composedAt: Date;

  /**
   * List of traits composed in order
   */
  traitOrder: string[];

  /**
   * Total number of traits composed
   */
  traitCount: number;

  /**
   * Field provenance mapping
   */
  provenance: Map<string, FieldProvenance>;

  /**
   * Collisions detected and resolved
   */
  collisions: CollisionInfo[];

  /**
   * Warnings generated during composition
   */
  warnings: string[];

  /**
   * Composition performance metrics
   */
  performance?: {
    durationMs: number;
    fieldsProcessed: number;
    viewExtensionsProcessed: number;
  };
}

/**
 * Composed Object - the result of trait composition
 *
 * This represents the final, merged object with all traits applied
 * following the 5-layer merge cascade:
 * Foundation → Base Object → Traits (topo order) → Object Overrides → Context
 */
export interface ComposedObject {
  /**
   * Unique identifier for this composed object
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * List of trait definitions that were composed
   */
  traits: TraitDefinition[];

  /**
   * Merged schema from all traits and base object
   */
  schema: Record<string, SchemaField>;

  /**
   * Merged semantics (field mappings to semantic types and UI hints)
   */
  semantics: Record<string, SemanticMapping>;

  /**
   * Merged view extensions by context
   */
  viewExtensions: {
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  };

  /**
   * Merged tokens from all traits
   */
  tokens: TokenDefinition;

  /**
   * Merged actions from all traits
   */
  actions: TraitAction[];

  /**
   * State machine (only one allowed per object)
   */
  stateMachine?: {
    definition: StateMachine;
    ownerTrait: string;
  };

  /**
   * Composition metadata and provenance
   */
  metadata: CompositionMetadata;
}

/**
 * Result of composition operation
 */
export interface CompositionResult {
  success: boolean;
  data?: ComposedObject;
  errors?: CompositionError[];
}

/**
 * Error types for composition
 */
export interface CompositionError {
  type:
    | 'type_mismatch'
    | 'multiple_state_machines'
    | 'unresolved_collision'
    | 'invalid_trait'
    | 'dependency_error';
  message: string;
  fieldName?: string;
  conflictingTraits?: string[];
  details?: unknown;
}

/**
 * Options for composition behavior
 */
export interface CompositionOptions {
  /**
   * Whether to track detailed provenance (default: true)
   */
  trackProvenance?: boolean;

  /**
   * Whether to allow multiple state machines (default: false)
   */
  allowMultipleStateMachines?: boolean;

  /**
   * Custom collision resolution rules
   */
  collisionResolutions?: Record<
    string,
    {
      strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
      traitName?: string;
    }
  >;

  /**
   * Whether to fail on warnings (default: false)
   */
  strictMode?: boolean;

  /**
   * Performance tracking (default: false)
   */
  trackPerformance?: boolean;
}

/**
 * Helper to create an empty composed object
 */
export function createEmptyComposedObject(id: string, name: string): ComposedObject {
  const now = TimeService.nowSystem();
  return {
    id,
    name,
    traits: [],
    schema: {},
    semantics: {},
    viewExtensions: {},
    tokens: {},
    actions: [],
    metadata: {
      composedAt: now.toJSDate(),
      traitOrder: [],
      traitCount: 0,
      provenance: new Map(),
      collisions: [],
      warnings: [],
    },
  };
}

/**
 * Helper to create a composition error
 */
export function createCompositionError(
  type: CompositionError['type'],
  message: string,
  options?: {
    fieldName?: string;
    conflictingTraits?: string[];
    details?: unknown;
  }
): CompositionError {
  return {
    type,
    message,
    ...options,
  };
}

/**
 * Helper to create a successful composition result
 */
export function createSuccessResult(data: ComposedObject): CompositionResult {
  return {
    success: true,
    data,
  };
}

/**
 * Helper to create a failed composition result
 */
export function createFailureResult(errors: CompositionError[]): CompositionResult {
  return {
    success: false,
    errors,
  };
}
