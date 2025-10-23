/**
 * Zod Transformer Utilities
 *
 * Helper functions that prepare composed trait objects for validation.
 * These utilities expose normalized representations of tokens, dependencies,
 * provenance, and other derived metadata that the Zod composition rules rely on.
 */

import type {
  TokenDefinition,
  TraitDefinition,
  TraitDependency,
} from '../core/trait-definition.js';
import type {
  ComposedObject,
  FieldProvenance,
} from '../core/composed-object.js';

/**
 * Flatten a token definition into dotted token paths.
 *
 * Example:
 * ```
 * {
 *   status: {
 *     state: {
 *       active: 'var(--sys-status-success-surface)'
 *     }
 *   }
 * }
 * ```
 * becomes `['status.state.active']`.
 */
export function flattenTokenDefinition(
  tokens: TokenDefinition | Record<string, unknown> | undefined,
  prefix: string = ''
): string[] {
  const paths: string[] = [];

  if (!tokens || typeof tokens !== 'object') {
    return paths;
  }

  for (const [key, value] of Object.entries(tokens)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      paths.push(
        ...flattenTokenDefinition(
          value as TokenDefinition | Record<string, unknown>,
          currentPath
        )
      );
    } else {
      paths.push(currentPath);
    }
  }

  return paths;
}

/**
 * Parse a `tokenMap(namespace)` expression and return the canonical token path.
 *
 * Supports wildcards such as `tokenMap(status.state.*)` by returning an object
 * describing whether the expression expects a wildcard match.
 */
export function parseTokenMappingExpression(
  value: string | undefined
): { namespace: string; wildcard: boolean } | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('tokenMap(') || !trimmed.endsWith(')')) {
    return null;
  }

  const namespace = trimmed.slice('tokenMap('.length, -1).trim();
  if (!namespace) {
    return null;
  }

  const wildcard = namespace.endsWith('.*');
  return {
    namespace: wildcard ? namespace.slice(0, -2) : namespace,
    wildcard,
  };
}

/**
 * Extract dependency descriptors from a trait definition.
 */
export function extractTraitDependencies(
  trait: TraitDefinition
): Array<{ name: string; optional: boolean }> {
  if (!trait.dependencies) {
    return [];
  }

  return trait.dependencies.map((dependency) => {
    if (typeof dependency === 'string') {
      return { name: dependency, optional: false };
    }

    const dep = dependency as TraitDependency;
    return {
      name: dep.trait,
      optional: Boolean(dep.optional),
    };
  });
}

/**
 * Collect trait names that provide state machines.
 */
export function collectStateMachineProviders(
  traits: TraitDefinition[]
): Array<{ name: string; index: number; states: string[]; initial: string }> {
  const providers: Array<{ name: string; index: number; states: string[]; initial: string }> = [];

  traits.forEach((trait, index) => {
    if (!trait?.state_machine || !trait.trait?.name) {
      return;
    }

    providers.push({
      name: trait.trait.name,
      index,
      states: [...trait.state_machine.states],
      initial: trait.state_machine.initial,
    });
  });

  return providers;
}

/**
 * Extract provenance entries from the composed object's metadata.
 */
export function extractProvenanceEntries(
  composed: ComposedObject
): Array<[string, FieldProvenance]> {
  const entries: Array<[string, FieldProvenance]> = [];

  const provenanceMap = composed.metadata?.provenance;
  if (!provenanceMap || typeof (provenanceMap as Map<string, FieldProvenance>).entries !== 'function') {
    return entries;
  }

  for (const [field, provenance] of (provenanceMap as Map<string, FieldProvenance>).entries()) {
    entries.push([field, provenance]);
  }

  return entries;
}

/**
 * Normalize a view region key for canonical comparison.
 */
export function normalizeViewRegion(region: string): string {
  return region ? region.trim().toLowerCase() : '';
}
