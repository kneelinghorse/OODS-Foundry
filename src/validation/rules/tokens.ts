import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import {
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
      issues.push({
        code: ErrorCodes.TOKEN_MAPPING_MISSING,
        message: `Semantic token mapping for "${fieldName}" points to "${namespace}" but no matching tokens were found.`,
        hint: `Define tokens under "${namespace}${wildcard ? '.*' : ''}" or update the token mapping for "${fieldName}".`,
        severity: 'error',
        path: ['semantics', fieldName, 'token_mapping'],
        related: [fieldName, namespace],
      });
    }
  }

  return issues;
}
