/**
 * Dependency Validator
 *
 * Validates trait dependencies including conflict detection and resolution.
 */

import { DependencyGraph, GraphError } from './dependency-graph.js';
import { TraitDefinition } from './trait-definition.js';

/**
 * Validation options
 */
export interface ValidationOptions {
  allowMissingDependencies?: boolean;
  allowCircularDependencies?: boolean;
  strictConflicts?: boolean;
}

/**
 * Validation result with detailed information
 */
export interface ValidationResult {
  success: boolean;
  errors: GraphError[];
  warnings: ValidationWarning[];
}

/**
 * Warning for non-critical validation issues
 */
export interface ValidationWarning {
  type: 'optional_dependency_missing' | 'version_mismatch' | 'deprecated_trait';
  message: string;
  traits?: string[];
}

/**
 * Comprehensive validator for trait dependencies
 */
export class DependencyValidator {
  private graph: DependencyGraph;
  private options: ValidationOptions;

  constructor(graph: DependencyGraph, options: ValidationOptions = {}) {
    this.graph = graph;
    this.options = {
      allowMissingDependencies: false,
      allowCircularDependencies: false,
      strictConflicts: true,
      ...options,
    };
  }

  /**
   * Perform full validation of the dependency graph
   */
  validate(): ValidationResult {
    const errors: GraphError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Check for missing dependencies
    if (!this.options.allowMissingDependencies) {
      const missingResult = this.graph.validateDependenciesExist();
      if (!missingResult.success && missingResult.errors) {
        errors.push(...missingResult.errors);
      }
    }

    // 2. Check for circular dependencies
    if (!this.options.allowCircularDependencies) {
      const circularResult = this.graph.detectCircularDependencies();
      if (!circularResult.success && circularResult.errors) {
        errors.push(...circularResult.errors);
      }
    }

    // 3. Validate conflicts
    const conflictErrors = this.validateConflicts();
    errors.push(...conflictErrors);

    // 4. Check for optional dependencies
    const optionalWarnings = this.checkOptionalDependencies();
    warnings.push(...optionalWarnings);

    // 5. Check for deprecated traits
    const deprecatedWarnings = this.checkDeprecatedTraits();
    warnings.push(...deprecatedWarnings);

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate conflict relationships
   *
   * Ensures that traits marked as conflicting are not both present
   * in the dependency graph.
   */
  validateConflicts(): GraphError[] {
    const errors: GraphError[] = [];
    const nodes = this.graph.getAllNodes();

    for (const node of nodes) {
      const conflicts = this.graph.getConflicts(node.id);

      for (const conflictId of conflicts) {
        // Check if the conflicting trait exists in the graph
        if (this.graph.hasTrait(conflictId)) {
          errors.push({
            type: 'conflict',
            message: `Trait "${node.id}" conflicts with "${conflictId}" but both are present in the composition`,
            traits: [node.id, conflictId],
          });
        }

        // Check if the conflicting trait is in the dependency chain
        const dependencies = this.graph.getTransitiveDependencies(node.id);
        if (dependencies.has(conflictId)) {
          errors.push({
            type: 'conflict',
            message: `Trait "${node.id}" conflicts with "${conflictId}" but depends on it indirectly`,
            traits: [node.id, conflictId],
          });
        }
      }
    }

    return errors;
  }

  /**
   * Check for missing optional dependencies
   */
  checkOptionalDependencies(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const nodes = this.graph.getAllNodes();

    for (const node of nodes) {
      if (!node.trait || !node.trait.dependencies) continue;

      for (const dep of node.trait.dependencies) {
        if (typeof dep === 'object' && dep.optional) {
          const depNode = this.graph.getNode(dep.trait);
          if (!depNode || !depNode.trait) {
            warnings.push({
              type: 'optional_dependency_missing',
              message: `Trait "${node.id}" has optional dependency "${dep.trait}" which is not present`,
              traits: [node.id, dep.trait],
            });
          }
        }
      }
    }

    return warnings;
  }

  /**
   * Check for deprecated traits in the dependency chain
   */
  checkDeprecatedTraits(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const nodes = this.graph.getAllNodes();

    for (const node of nodes) {
      if (node.trait?.metadata?.deprecated) {
        const message = node.trait.metadata.deprecationMessage ||
          `Trait "${node.id}" is deprecated`;

        warnings.push({
          type: 'deprecated_trait',
          message,
          traits: [node.id],
        });
      }
    }

    return warnings;
  }

  /**
   * Validate a specific set of traits for composition
   *
   * This checks if a given set of trait IDs can be composed together
   * without conflicts or missing dependencies.
   */
  validateComposition(traitIds: string[]): ValidationResult {
    const errors: GraphError[] = [];

    // Build a subgraph with only the requested traits
    const subgraph = new DependencyGraph();

    // Add all requested traits and their dependencies
    const toProcess = new Set(traitIds);
    const processed = new Set<string>();

    while (toProcess.size > 0) {
      const current = Array.from(toProcess)[0];
      toProcess.delete(current);

      if (processed.has(current)) continue;
      processed.add(current);

      const node = this.graph.getNode(current);
      if (!node || !node.trait) {
        errors.push({
          type: 'missing_dependency',
          message: `Trait "${current}" is not defined`,
          traits: [current],
        });
        continue;
      }

      subgraph.addTrait(node.trait);

      // Add dependencies to process queue
      for (const dep of node.dependencies) {
        if (!processed.has(dep)) {
          toProcess.add(dep);
        }
      }
    }

    // Validate the subgraph
    const validator = new DependencyValidator(subgraph, this.options);
    return validator.validate();
  }

  /**
   * Find all traits that conflict with a given trait
   */
  findConflictingTraits(traitId: string): string[] {
    const conflicts = new Set<string>();
    const node = this.graph.getNode(traitId);

    if (!node) return [];

    // Direct conflicts
    for (const conflict of node.conflicts) {
      conflicts.add(conflict);
    }

    // Check reverse conflicts (traits that conflict with this one)
    for (const otherNode of this.graph.getAllNodes()) {
      if (otherNode.conflicts.has(traitId)) {
        conflicts.add(otherNode.id);
      }
    }

    return Array.from(conflicts);
  }

  /**
   * Check if two traits can be composed together
   */
  canCompose(trait1: string, trait2: string): boolean {
    const conflicts1 = this.graph.getConflicts(trait1);
    const conflicts2 = this.graph.getConflicts(trait2);

    // Check direct conflicts
    if (conflicts1.includes(trait2) || conflicts2.includes(trait1)) {
      return false;
    }

    // Check if they create a circular dependency
    const testGraph = this.graph.clone();
    const node1 = testGraph.getNode(trait1);
    const node2 = testGraph.getNode(trait2);

    if (!node1 || !node2) return false;

    // Temporarily add a dependency to test for cycles
    node1.dependencies.add(trait2);
    const circularResult = testGraph.detectCircularDependencies();

    return circularResult.success;
  }
}

/**
 * Helper function to validate a set of traits
 */
export function validateTraits(
  traits: TraitDefinition[],
  options?: ValidationOptions
): ValidationResult {
  const graph = new DependencyGraph();

  for (const trait of traits) {
    graph.addTrait(trait);
  }

  const validator = new DependencyValidator(graph, options);
  return validator.validate();
}

/**
 * Helper function to check if a set of trait IDs can be composed
 */
export function canComposeTraits(
  graph: DependencyGraph,
  traitIds: string[]
): boolean {
  const validator = new DependencyValidator(graph);
  const result = validator.validateComposition(traitIds);
  return result.success;
}
