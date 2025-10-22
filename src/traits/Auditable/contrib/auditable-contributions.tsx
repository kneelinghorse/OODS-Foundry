import { Card } from '../../../components/base/Card.js';
import { Text } from '../../../components/base/Text.js';
import { registerContribution } from '../../../engine/contributions/index.js';
import type { ContributionRenderContext } from '../../../engine/contributions/index.js';
import type { StatusableViewData, StatusTransitionEvent } from '../../Statusable/types.js';
import { formatStatus, formatTimestamp } from '../../Statusable/utils.js';

function normalizeEvents(
  history: StatusableViewData['state_history']
): readonly StatusTransitionEvent[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter((entry): entry is StatusTransitionEvent => Boolean(entry));
}

function renderTimeline<Data extends StatusableViewData>(
  ctx: ContributionRenderContext<Data>
) {
  const data = ctx.renderContext.data as StatusableViewData;
  const events = normalizeEvents(data.state_history);

  if (events.length === 0) {
    return (
      <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
        Lifecycle timeline will populate once this record has activity.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {events.slice(0, 7).map((event, index) => (
        <Card
          key={`${event.timestamp ?? index}-timeline`}
          className="flex flex-col gap-2 border border-slate-200/60 px-4 py-3 shadow-sm dark:border-slate-700/60"
        >
          <Text as="h4" size="sm" weight="semibold">
            {formatStatus(event.to_state ?? 'Unknown')}
          </Text>
          <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
            {event.reason ?? 'State transition recorded.'}
          </Text>
          {event.timestamp ? (
            <Text as="p" size="sm" className="text-slate-400 dark:text-slate-500">
              {formatTimestamp(event.timestamp)}
            </Text>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function registerAuditableContributions<Data extends StatusableViewData>(
  traitId: string
): void {
  registerContribution<Data>({
    id: `${traitId}:timeline:event-stream`,
    traitId,
    context: 'timeline',
    region: 'main',
    priority: 60,
    render: renderTimeline,
  });
}
