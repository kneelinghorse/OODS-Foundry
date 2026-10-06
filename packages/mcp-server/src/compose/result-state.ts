import { RESULT_STATE_TONE, componentContracts } from '@oods/component-contracts';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { ToolError } from '../errors/tool-error.js';

const RESULT_SEMANTIC = 'assessment.result.state';
const BADGES = new Set(['StatusBadge', 'Badge']);

/**
 * The result-state visual rule (s205-m03, traits/core/Assessable), enforced where the screen is made.
 *
 * Every StatusBadge or Badge bound to a result-state field takes RESULT_STATE_TONE, whatever the trait or an
 * override authored: an explicit tone wins over the lifecycle status-to-tone table, which would otherwise colour
 * "passed" as a success and "violation" as a failure. Any OTHER component that carries a tone (a Banner, a
 * ColorizedBadge, a summary badge) is refused with OODS-V211 — there is no honest way to pin it — and nothing is
 * written. Plain text binding the field is untouched: it has no verdict colour to take.
 */
export function enforceResultStateFamily(schema: UiSchema): number {
  const fields = schema.objectSchema ?? {};
  const resultFields = new Set(Object.keys(fields).filter(name => fields[name]!.semanticType === RESULT_SEMANTIC || name === 'result_state'));
  if (!resultFields.size) return 0;
  const contracts = componentContracts as Record<string, { props?: readonly string[] }>;
  let pinned = 0;
  const walk = (node: UiElement): void => {
    const bound = Object.entries(node.props ?? {}).find(([prop, value]) => (prop === 'field' || /Field$/.test(prop)) && typeof value === 'string' && resultFields.has(value));
    if (bound) {
      if (BADGES.has(node.component)) {
        node.props = { ...node.props, tone: RESULT_STATE_TONE };
        pinned += 1;
      } else if (contracts[node.component]?.props?.includes('tone')) {
        throw new ToolError('OODS-V211', `${node.component} (${node.id}) binds the result state ${bound[1]} but cannot be held to the result family: a result state renders as a StatusBadge or Badge in tone ${RESULT_STATE_TONE}, or as plain text — never a severity colour. Nothing was written.`, { node: node.id, component: node.component, field: bound[1] });
      }
    }
    node.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return pinned;
}
