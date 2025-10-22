import { Button } from '../../../components/base/Button.js';
import { registerContribution } from '../../../engine/contributions/index.js';
import type { ContributionRenderContext } from '../../../engine/contributions/index.js';
import type { ContextKind } from '../../../contexts/index.js';
import type { StatusableViewData } from '../../Statusable/types.js';
import { sanitizeString } from '../../Statusable/utils.js';

interface ActionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly intent: 'neutral' | 'success' | 'danger';
}

function resolveActions(status: string | null | undefined): readonly ActionDescriptor[] {
  const normalized = sanitizeString(status)?.toLowerCase();

  if (normalized === 'active') {
    return [
      { id: 'action:disable', label: 'Disable Access', intent: 'danger' },
      { id: 'action:promote', label: 'Promote to Admin', intent: 'neutral' },
    ];
  }

  if (normalized === 'suspended' || normalized === 'deactivated') {
    return [
      { id: 'action:reinstate', label: 'Reinstate Access', intent: 'success' },
      { id: 'action:contact', label: 'Contact Support', intent: 'neutral' },
    ];
  }

  if (normalized === 'past_due' || normalized === 'past-due') {
    return [
      { id: 'action:collect', label: 'Collect Payment', intent: 'success' },
      { id: 'action:pause', label: 'Pause Billing', intent: 'neutral' },
    ];
  }

  return [{ id: 'action:activate', label: 'Activate Access', intent: 'success' }];
}

function renderActionToolbar<Data extends StatusableViewData>(
  ctx: ContributionRenderContext<Data>
) {
  const data = ctx.renderContext.data as StatusableViewData;
  const actions = resolveActions(data.status);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Button key={action.id} intent={action.intent} id={`actionable:${action.id}`}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export interface RegisterActionableContributionsInput {
  readonly traitId: string;
  readonly contexts?: readonly ContextKind[];
}

const DEFAULT_CONTEXTS: readonly ContextKind[] = Object.freeze(['detail', 'list', 'form', 'timeline']);

export function registerActionableContributions<Data extends StatusableViewData>(
  input: RegisterActionableContributionsInput
): void {
  const { traitId, contexts = DEFAULT_CONTEXTS } = input;

  registerContribution<Data>({
    id: `${traitId}:view-toolbar:primary-actions`,
    traitId,
    context: contexts,
    region: 'viewToolbar',
    priority: 45,
    render: renderActionToolbar,
  });
}
