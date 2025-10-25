/**
 * Trait Compositor
 *
 * The heart of the Trait Engine. Implements deterministic trait composition
 * following the 5-layer merge cascade:
 * Foundation → Base Object → Traits (topo order) → Object Overrides → Context
 *
 * Key features:
 * - Deterministic composition (same input = same output)
 * - Collision detection and resolution
 * - Provenance tracking
 * - Performance monitoring
 */

import { performance } from 'node:perf_hooks';
import type {
  TraitDefinition,
  SchemaField,
  SemanticMapping,
  TokenDefinition,
  TraitAction,
  StateMachine,
} from './trait-definition.js';
import { DependencyGraph } from './dependency-graph.js';
import { validateAndSort } from './topological-sort.js';
import {
  type ComposedObject,
  type CompositionOptions,
  type CompositionResult,
  type FieldProvenance,
  createEmptyComposedObject,
  createSuccessResult,
  createFailureResult,
  createCompositionError,
} from './composed-object.js';
import { mergeSchemas } from './merge-strategies/schema-merger.js';
import { mergeSemantics } from './merge-strategies/semantics-merger.js';
import { mergeTokens } from './merge-strategies/tokens-merger.js';
import { mergeViewExtensions } from './merge-strategies/view-extensions-merger.js';
import { mergeActions } from './merge-strategies/actions-merger.js';

/**
 * Base object definition (optional starting point for composition)
 */
export interface BaseObjectDefinition {
  id: string;
  name: string;
  schema?: Record<string, SchemaField>;
  semantics?: Record<string, SemanticMapping>;
  tokens?: TokenDefinition;
  viewExtensions?: ComposedObject['viewExtensions'];
  actions?: TraitAction[];
  stateMachine?: {
    definition: StateMachine;
    ownerTrait: string;
  };
}

/**
 * Trait Compositor class
 *
 * Handles the composition of multiple traits into a single composed object.
 */
export class TraitCompositor {
  private options: Required<CompositionOptions>;

  constructor(options: CompositionOptions = {}) {
    this.options = {
      trackProvenance: options.trackProvenance ?? true,
      allowMultipleStateMachines: options.allowMultipleStateMachines ?? false,
      collisionResolutions: options.collisionResolutions ?? {},
      strictMode: options.strictMode ?? false,
      trackPerformance: options.trackPerformance ?? false,
    };
  }

  /**
   * Compose multiple traits into a single composed object
   *
   * @param traits - Array of trait definitions to compose
   * @param baseObject - Optional base object definition
   * @returns CompositionResult with the composed object or errors
   */
  compose(
    traits: TraitDefinition[],
    baseObject?: BaseObjectDefinition
  ): CompositionResult {
    const startTime = this.options.trackPerformance ? performance.now() : 0;
    const warnings: string[] = [];

    try {
      // Step 1: Build dependency graph
      const graph = new DependencyGraph();
      for (const trait of traits) {
        graph.addTrait(trait);
      }

      // Step 2: Validate and sort traits by dependencies
      const sortResult = validateAndSort(graph);
      if (!sortResult.success) {
        const graphErrors = sortResult.errors || [];
        return createFailureResult(
          graphErrors.map((err) =>
            createCompositionError('dependency_error', err.message, {
              details: err,
            })
          )
        );
      }

      const sortedTraitNames = sortResult.data!;

      // Step 3: Get traits in topological order
      const sortedTraits = sortedTraitNames
        .map((name) => traits.find((t) => t.trait.name === name))
        .filter((t): t is TraitDefinition => t !== undefined);

      // Step 4: Initialize composed object
      const objectId = baseObject?.id || 'composed-object';
      const objectName = baseObject?.name || 'Composed Object';
      const composed = createEmptyComposedObject(objectId, objectName);

      composed.traits = sortedTraits;
      composed.metadata.traitOrder = sortedTraitNames;
      composed.metadata.traitCount = sortedTraits.length;

      // Step 5: Apply base object if provided
      if (baseObject) {
        if (baseObject.schema) {
          composed.schema = { ...baseObject.schema };
        }
        if (baseObject.semantics) {
          composed.semantics = { ...baseObject.semantics };
        }
        if (baseObject.tokens) {
          composed.tokens = { ...baseObject.tokens };
        }
        if (baseObject.viewExtensions) {
          composed.viewExtensions = { ...baseObject.viewExtensions };
        }
        if (baseObject.actions) {
          composed.actions = [...baseObject.actions];
        }
        if (baseObject.stateMachine) {
          composed.stateMachine = {
            definition: baseObject.stateMachine.definition,
            ownerTrait: baseObject.stateMachine.ownerTrait,
          };
        }
      }

      // Step 6: Compose traits in topological order
      let fieldsProcessed = 0;
      let viewExtensionsProcessed = 0;

      for (let i = 0; i < sortedTraits.length; i++) {
        const trait = sortedTraits[i];
        const traitName = trait.trait.name;

        // Merge schema
        if (trait.schema) {
          const schemaMerge = mergeSchemas(
            composed.schema,
            trait.schema,
            i === 0 && !baseObject ? 'base' : 'composed',
            traitName,
            this.options.collisionResolutions
          );

          composed.schema = schemaMerge.schema;
          warnings.push(...schemaMerge.warnings);

          // Track provenance for new fields
          if (this.options.trackProvenance) {
            for (const fieldName of Object.keys(trait.schema)) {
              const provenance: FieldProvenance = {
                fieldName,
                source: traitName,
                layer: 'trait',
                order: i,
                overridden: false,
              };

              // Check if this field existed before
              const existing = composed.metadata.provenance.get(fieldName);
              if (existing) {
                provenance.overridden = true;
                provenance.previousSources = [existing.source];
              }

              composed.metadata.provenance.set(fieldName, provenance);
            }
          }

          // Track collisions
          for (const resolution of schemaMerge.resolutions) {
            composed.metadata.collisions.push(resolution.collisionInfo);
          }

          fieldsProcessed += Object.keys(trait.schema).length;
        }

        // Merge semantics
        if (trait.semantics) {
          const semanticsMerge = mergeSemantics(composed.semantics, trait.semantics);
          composed.semantics = semanticsMerge.semantics;
          warnings.push(...semanticsMerge.warnings);
        }

        // Merge tokens
        if (trait.tokens) {
          const tokensMerge = mergeTokens(
            composed.tokens,
            trait.tokens,
            'composed',
            traitName
          );
          composed.tokens = tokensMerge.tokens;
          warnings.push(...tokensMerge.warnings);
        }

        // Merge view extensions
        if (trait.view_extensions) {
          const viewMerge = mergeViewExtensions(
            composed.viewExtensions,
            trait.view_extensions
          );
          composed.viewExtensions = viewMerge.viewExtensions;
          warnings.push(...viewMerge.warnings);

          // Count view extensions
          for (const exts of Object.values(trait.view_extensions)) {
            if (Array.isArray(exts)) {
              viewExtensionsProcessed += exts.length;
            }
          }
        }

        // Merge actions
        if (trait.actions) {
          const actionsMerge = mergeActions(composed.actions, trait.actions);
          composed.actions = actionsMerge.actions;
          warnings.push(...actionsMerge.warnings);
        }

        // Handle state machine (only one allowed)
        if (trait.state_machine) {
          if (composed.stateMachine && !this.options.allowMultipleStateMachines) {
            return createFailureResult([
              createCompositionError(
                'multiple_state_machines',
                `Multiple state machines detected: "${composed.stateMachine.ownerTrait}" and "${traitName}"`,
                {
                  conflictingTraits: [composed.stateMachine.ownerTrait, traitName],
                }
              ),
            ]);
          }

          composed.stateMachine = {
            definition: trait.state_machine,
            ownerTrait: traitName,
          };
        }
      }

      // Step 7: Finalize metadata
      composed.metadata.warnings = warnings;

      if (this.options.trackPerformance) {
        const endTime = performance.now();
        composed.metadata.performance = {
          durationMs: endTime - startTime,
          fieldsProcessed,
          viewExtensionsProcessed,
        };
      }

      // Step 8: Check for strict mode violations
      if (this.options.strictMode && warnings.length > 0) {
        return createFailureResult([
          createCompositionError(
            'unresolved_collision',
            `Composition completed with ${warnings.length} warnings in strict mode`,
            {
              details: warnings,
            }
          ),
        ]);
      }

      return createSuccessResult(composed);
    } catch (error) {
      return createFailureResult([
        createCompositionError(
          'invalid_trait',
          `Composition failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            details: error,
          }
        ),
      ]);
    }
  }

  /**
   * Compose traits and return only the schema (convenience method)
   */
  composeSchema(traits: TraitDefinition[]): Record<string, SchemaField> | null {
    const result = this.compose(traits);
    return result.success && result.data ? result.data.schema : null;
  }

  /**
   * Generate a composition report for debugging
   */
  generateReport(composed: ComposedObject): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`COMPOSITION REPORT: ${composed.name}`);
    lines.push('='.repeat(80));
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Object ID: ${composed.id}`);
    lines.push(`Traits Composed: ${composed.metadata.traitCount}`);
    lines.push(`Trait Order: ${composed.metadata.traitOrder.join(' → ')}`);
    lines.push(`Composed At: ${composed.metadata.composedAt.toISOString()}`);
    lines.push('');

    // Schema
    lines.push('SCHEMA');
    lines.push('-'.repeat(80));
    const schemaFields = Object.keys(composed.schema);
    lines.push(`Total Fields: ${schemaFields.length}`);
    for (const field of schemaFields) {
      const fieldDef = composed.schema[field];
      const provenance = composed.metadata.provenance.get(field);
      const source = provenance ? ` (from ${provenance.source})` : '';
      lines.push(
        `  ${field}: ${fieldDef.type}${fieldDef.required ? ' (required)' : ' (optional)'}${source}`
      );
    }
    lines.push('');

    // Collisions
    if (composed.metadata.collisions.length > 0) {
      lines.push('COLLISIONS');
      lines.push('-'.repeat(80));
      lines.push(`Total Collisions: ${composed.metadata.collisions.length}`);
      for (const collision of composed.metadata.collisions) {
        lines.push(`  ${collision.fieldName}:`);
        lines.push(`    Conflicting Traits: ${collision.conflictingTraits.join(', ')}`);
        lines.push(`    Resolution: ${collision.resolution}`);
        lines.push(`    Winner: ${collision.winner}`);
        lines.push(`    Details: ${collision.details}`);
      }
      lines.push('');
    }

    // Warnings
    if (composed.metadata.warnings.length > 0) {
      lines.push('WARNINGS');
      lines.push('-'.repeat(80));
      lines.push(`Total Warnings: ${composed.metadata.warnings.length}`);
      for (const warning of composed.metadata.warnings) {
        lines.push(`  - ${warning}`);
      }
      lines.push('');
    }

    // View Extensions
    const viewContexts = Object.keys(composed.viewExtensions);
    if (viewContexts.length > 0) {
      lines.push('VIEW EXTENSIONS');
      lines.push('-'.repeat(80));
      for (const context of viewContexts) {
        const exts = composed.viewExtensions[context];
        if (exts && exts.length > 0) {
          lines.push(`  ${context}: ${exts.length} extension(s)`);
        }
      }
      lines.push('');
    }

    // Actions
    if (composed.actions.length > 0) {
      lines.push('ACTIONS');
      lines.push('-'.repeat(80));
      lines.push(`Total Actions: ${composed.actions.length}`);
      for (const action of composed.actions) {
        lines.push(`  - ${action.name}: ${action.label || '(no label)'}`);
      }
      lines.push('');
    }

    // State Machine
    if (composed.stateMachine) {
      lines.push('STATE MACHINE');
      lines.push('-'.repeat(80));
      lines.push(`Owner Trait: ${composed.stateMachine.ownerTrait}`);
      lines.push(`States: ${composed.stateMachine.definition.states.join(', ')}`);
      lines.push(`Initial State: ${composed.stateMachine.definition.initial}`);
      lines.push('');
    }

    // Performance
    if (composed.metadata.performance) {
      lines.push('PERFORMANCE');
      lines.push('-'.repeat(80));
      lines.push(`Duration: ${composed.metadata.performance.durationMs}ms`);
      lines.push(`Fields Processed: ${composed.metadata.performance.fieldsProcessed}`);
      lines.push(
        `View Extensions Processed: ${composed.metadata.performance.viewExtensionsProcessed}`
      );
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

/**
 * Convenience function to compose traits without creating a compositor instance
 */
export function composeTraits(
  traits: TraitDefinition[],
  baseObject?: BaseObjectDefinition,
  options?: CompositionOptions
): CompositionResult {
  const compositor = new TraitCompositor(options);
  return compositor.compose(traits, baseObject);
}
