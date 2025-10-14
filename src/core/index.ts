/**
 * Core Dependency Resolution Exports
 */

export { DependencyGraph } from './dependency-graph.js';
export type { GraphNode, GraphResult, GraphError } from './dependency-graph.js';

export { topologicalSort, topologicalSortDFS, validateAndSort } from './topological-sort.js';
export type { TopologicalSortResult } from './topological-sort.js';

export { DependencyValidator, validateTraits, canComposeTraits } from './dependency-validator.js';
export type { ValidationOptions, ValidationResult, ValidationWarning } from './dependency-validator.js';

export { isTraitDefinition, createParseError, createSuccessResult, createFailureResult } from './trait-definition.js';
export type {
  TraitDefinition,
  TraitMetadata,
  TraitParameter,
  SchemaField,
  SemanticMapping,
  ViewExtension,
  TraitAction,
  StateMachine,
  TokenDefinition,
  TraitDependency,
  ParseResult,
  ParseError,
} from './trait-definition.js';

/**
 * Trait Composition Exports
 */

export { TraitCompositor, composeTraits } from './compositor.js';
export type { BaseObjectDefinition } from './compositor.js';

export {
  createEmptyComposedObject,
  createCompositionError,
  createSuccessResult as createCompositionSuccessResult,
  createFailureResult as createCompositionFailureResult,
} from './composed-object.js';
export type {
  ComposedObject,
  CompositionOptions,
  CompositionResult,
  CompositionError,
  CompositionMetadata,
  FieldProvenance,
  CollisionInfo,
} from './composed-object.js';

export { resolveCollision, resolveCollisions } from './collision-resolver.js';
export type { ResolutionResult } from './collision-resolver.js';

export * from './merge-strategies/index.js';
