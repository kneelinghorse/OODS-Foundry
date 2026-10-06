import { UI_WORKFLOW_STATES } from '@oods/component-contracts';

import type { UiElement } from '../schemas/generated.js';
import type { CodegenFramework, CodegenIssue } from './types.js';

const UI_WORKFLOW_STATE_SET: ReadonlySet<string> = new Set(UI_WORKFLOW_STATES);

export type UiStateBranch = {
  nodeId: string;
  component: string;
  state: string;
};

function nodesInDocumentOrder(screens: readonly UiElement[]): UiElement[] {
  const nodes: UiElement[] = [];
  const stack = [...screens].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodes.push(node);
    if (node.children) stack.push(...node.children.slice().reverse());
  }
  return nodes;
}

/** Ordered state-branch declarations shared by validation and emitters. */
export function collectUiStateBranches(
  screens: readonly UiElement[],
): UiStateBranch[] {
  return nodesInDocumentOrder(screens).flatMap((node) => (
    node.state === undefined
      ? []
      : [{ nodeId: node.id, component: node.component, state: node.state }]
  ));
}

/**
 * Validate the cross-component workflow-state vocabulary before emission.
 *
 * The JSON Schema intentionally accepts any non-empty string. Keeping this
 * check semantic lets draft generation preserve a prospective state behind a
 * visible warning while build and release remain fail-closed.
 */
export function preflightStateContract(
  screens: readonly UiElement[],
  _framework: CodegenFramework,
): CodegenIssue[] {
  const issues: CodegenIssue[] = [];

  for (const branch of collectUiStateBranches(screens)) {
    if (!UI_WORKFLOW_STATE_SET.has(branch.state)) {
      issues.push({
        code: 'OODS-V164',
        message:
          `UI workflow state ${JSON.stringify(branch.state)} is not canonical; expected one of `
          + `${UI_WORKFLOW_STATES.join(', ')}.`,
        nodeId: branch.nodeId,
        component: branch.component,
      });
      continue;
    }

  }

  return issues;
}
