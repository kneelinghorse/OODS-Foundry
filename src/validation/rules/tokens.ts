import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import {
  extractProvenanceEntries,
  flattenTokenDefinition,
  parseTokenMappingExpression,
} from '../zod-transformer.js';
import type { RuleIssue } from './types.js';

/**
 * Ensure semantic token mappings reference existing token namespaces.
 */
export function validateTokenMappings(composed: ComposedObject): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const tokenPaths = flattenTokenDefinition(
    (composed.tokens as Record<string, unknown>) ?? {}
  );
  const tokenSet = new Set(tokenPaths);

  const provenanceMap = new Map(extractProvenanceEntries(composed));

  const semanticsEntries = composed.semantics && typeof composed.semantics === 'object'
    ? Object.entries(composed.semantics)
    : [];

  for (const [fieldName, mapping] of semanticsEntries) {
    if (!mapping || typeof mapping !== 'object') {
      continue;
    }

    const expression = parseTokenMappingExpression(mapping.token_mapping);
    if (!expression) {
      continue;
    }

    const { namespace, wildcard } = expression;

    let matches = false;
    if (wildcard) {
      const prefix = namespace ? `${namespace}.` : '';
      matches = tokenPaths.some((path) =>
        prefix ? path.startsWith(prefix) : true
      );
    } else {
      matches = tokenSet.has(namespace);
    }

    if (!matches) {
      const sourceTrait = provenanceMap.get(fieldName)?.source;
      const traitPath = sourceTrait ? [sourceTrait] : undefined;

      // Find other traits whose semantics reference the same token namespace
      const impactedTraits = findTraitsSharingTokenNamespace(composed, namespace, sourceTrait);

      issues.push({
        code: ErrorCodes.TOKEN_MAPPING_MISSING,
        message: `Semantic token mapping for "${fieldName}" points to "${namespace}" but no matching tokens were found.`,
        hint: `Define tokens under "${namespace}${wildcard ? '.*' : ''}" or update the token mapping for "${fieldName}"${sourceTrait ? ` in trait "${sourceTrait}"` : ''}.`,
        severity: 'error',
        path: ['semantics', fieldName, 'token_mapping'],
        related: [fieldName, namespace],
        traitPath,
        impactedTraits,
      });
    }
  }

  return issues;
}

function findTraitsSharingTokenNamespace(
  composed: ComposedObject,
  namespace: string,
  excludeTrait: string | undefined
): string[] | undefined {
  const others = (composed.traits ?? [])
    .filter((t) => t.trait?.name && t.trait.name !== excludeTrait)
    .filter((t) => {
      for (const sem of Object.values(t.semantics ?? {})) {
        if (sem && typeof sem === 'object' && typeof sem.token_mapping === 'string') {
          const expr = parseTokenMappingExpression(sem.token_mapping);
          if (expr && expr.namespace === namespace) return true;
        }
      }
      return false;
    })
    .map((t) => t.trait.name);
  return others.length > 0 ? others : undefined;
}
