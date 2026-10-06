import type { UiElement } from '../schemas/generated.js';
import type { CodegenFramework, CodegenIssue } from './types.js';

function recordKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

/**
 * Refuse schema shapes whose compatibility normalization would discard
 * executable semantics. All three targets preserve child trees on tab panels;
 * explicit items plus children remain ambiguous and are rejected.
 */
export function preflightNormalizationSafety(
  screens: readonly UiElement[],
  _framework: CodegenFramework = 'html',
): CodegenIssue[] {
  const issues: CodegenIssue[] = [];
  const stack = [...screens].reverse();

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.component === 'Tabs' && node.children?.length && node.collectionControl !== 'archive') {
      const propKeys = recordKeys(node.props);
      const hasExplicitItems = propKeys.some((key) => (
        (key === 'items' || key === 'tabs')
        && Array.isArray((node.props as Record<string, unknown>)[key])
      ));
      if (hasExplicitItems) {
        issues.push({
          code: 'OODS-V007',
          message:
            `Tabs ${JSON.stringify(node.id)} cannot combine explicit items with children; `
            + 'normalization would discard the child tree.',
          nodeId: node.id,
          component: node.component,
        });
      }
    }
    if (node.children) stack.push(...node.children.slice().reverse());
  }

  return issues;
}
