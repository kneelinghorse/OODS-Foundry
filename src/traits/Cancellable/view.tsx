import type { TraitAdapter } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import { Card } from '../../components/base/Card.js';
import { Text } from '../../components/base/Text.js';
import { formatDate } from '../../utils/format.js';

export interface CancellableViewData {
  readonly cancel_at_period_end?: boolean | null;
  readonly cancellation_reason?: string | null;
  readonly cancellation_requested_at?: string | null;
}

export interface CancellableTraitOptions {
  readonly traitId?: string;
  readonly priority?: number;
}

function normalizeReason(reason?: string | null): string | null {
  if (typeof reason !== 'string') {
    return null;
  }

  const trimmed = reason.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function buildCancellationBanner<Data extends CancellableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'cancellable:scheduled-banner',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      if (!data.cancel_at_period_end) {
        return null;
      }

      const reason = normalizeReason(data.cancellation_reason);
      const requestedAt = formatDate(data.cancellation_requested_at);

      return (
        <Card className="border-amber-200/70 bg-amber-50/80 text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100">
          <Text as="h2" size="md" weight="semibold">
            Cancellation scheduled at period end
          </Text>
          {reason ? (
            <Text as="p" size="sm" className="text-amber-800/90 dark:text-amber-200">
              Reason: {reason}
            </Text>
          ) : (
            <Text as="p" size="sm" className="text-amber-800/90 dark:text-amber-200">
              The subscription will remain active until billing completes.
            </Text>
          )}
          {requestedAt ? (
            <Text as="p" size="sm" className="text-amber-700/80 dark:text-amber-300">
              Requested {requestedAt}
            </Text>
          ) : null}
        </Card>
      );
    },
  };
}

export function createCancellableTraitAdapter<Data extends CancellableViewData>(
  options: CancellableTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Cancellable';
  const priority = options.priority ?? 60;

  const extensions: ViewExtension<Data>[] = [buildCancellationBanner<Data>(priority)];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
