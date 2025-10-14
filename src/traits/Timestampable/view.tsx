import { cloneElement, isValidElement } from 'react';
import type { TraitAdapter } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import { Card } from '../../components/base/Card.js';
import { Text } from '../../components/base/Text.js';
import { Button } from '../../components/base/Button.js';
import { formatDate } from '../../utils/format.js';
import type { PageHeaderProps } from '../../components/page/PageHeader.js';

export interface TimestampableViewData {
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly last_event?: string | null;
  readonly last_event_at?: string | null;
  readonly timezone?: string | null;
}

export interface TimestampableTraitOptions {
  readonly traitId?: string;
  readonly headerId?: string;
}

export interface SubscriptionTimestampableViewData {
  readonly current_period_start?: string | null;
  readonly current_period_end?: string | null;
  readonly current_period_progress?: number | null;
}

export interface SubscriptionTimestampableTraitOptions {
  readonly traitId?: string;
  readonly summaryPriority?: number;
}

const DEFAULT_HEADER_ID = 'stateful:page-header';
const SUMMARY_SECTION_ID = 'timestampable:audit-summary';

function humanize(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .split(/[_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildAuditLines(data: TimestampableViewData): readonly string[] {
  const created = formatDate(data.created_at);
  const updated = formatDate(data.updated_at);
  const event = formatDate(data.last_event_at);

  const lines: string[] = [];

  if (created) {
    lines.push(`Joined ${created}`);
  }

  if (updated) {
    lines.push(`Last updated ${updated}`);
  }

  if (event && data.last_event) {
    lines.push(`${humanize(data.last_event)} (${event})`);
  }

  return lines;
}

function createMetadataModifier<Data extends TimestampableViewData>(
  headerId: string
): ViewExtension<Data> {
  return {
    id: 'timestampable:page-header:metadata',
    region: 'pageHeader',
    type: 'modifier',
    targetId: headerId,
    priority: 50,
    render: ({ data }) => {
      const lines = buildAuditLines(data);
      if (lines.length === 0) {
        return {};
      }

      return (node) => {
        if (!isValidElement<PageHeaderProps>(node)) {
          return node;
        }

        return cloneElement(node, {
          metadata: (
            <div className="flex flex-col text-right text-sm text-slate-500 dark:text-slate-400">
              {lines.map((line) => (
                <Text as="span" size="sm" key={line}>
                  {line}
                </Text>
              ))}
            </div>
          ),
        });
      };
    },
  };
}

function createSummarySection<Data extends TimestampableViewData>(): ViewExtension<Data> {
  return {
    id: SUMMARY_SECTION_ID,
    region: 'main',
    type: 'section',
    priority: 50,
    render: ({ data }) => {
      const created = formatDate(data.created_at) || '—';
      const updated = formatDate(data.updated_at) || '—';
      const eventDate = formatDate(data.last_event_at) || '—';

      return (
        <Card className="flex flex-col gap-3">
          <Text as="h2" size="lg" weight="semibold">
            Audit trail
          </Text>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Joined
              </Text>
              <Text as="dd" weight="medium">
                {created}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Last updated
              </Text>
              <Text as="dd" weight="medium">
                {updated}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Recent activity
              </Text>
              <Text as="dd" weight="medium">
                {data.last_event ? humanize(data.last_event) : '—'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Activity logged at
              </Text>
              <Text as="dd" weight="medium">
                {eventDate}
              </Text>
            </div>
          </dl>
        </Card>
      );
    },
  };
}

function createTimelineSection<Data extends TimestampableViewData>(): ViewExtension<Data> {
  return {
    id: 'timestampable:timeline',
    region: 'main',
    type: 'section',
    priority: 70,
    render: ({ data }) => {
      const eventLabel = data.last_event ? humanize(data.last_event) : 'Lifecycle event';
      const eventDate = formatDate(data.last_event_at);

      return (
        <Card className="flex flex-col gap-2 border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40">
          <Text as="h3" size="md" weight="semibold">
            Timeline highlight
          </Text>
          <Text as="p" size="sm" className="text-slate-600 dark:text-slate-300">
            {eventLabel}
          </Text>
          <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
            {eventDate ? `Recorded ${eventDate}` : 'Awaiting first activity.'}
          </Text>
        </Card>
      );
    },
  };
}

function createFormHelper<Data extends TimestampableViewData>(): ViewExtension<Data> {
  return {
    id: 'timestampable:form-helper',
    region: 'viewToolbar',
    type: 'action',
    priority: 60,
    render: ({ data }) => (
      <Button intent="neutral">{data.updated_at ? 'View audit log' : 'No audit history'}</Button>
    ),
  };
}

export function createTimestampableTraitAdapter<Data extends TimestampableViewData>(
  options: TimestampableTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Timestampable';
  const headerId = options.headerId ?? DEFAULT_HEADER_ID;

  const extensions: ViewExtension<Data>[] = [
    createMetadataModifier<Data>(headerId),
    createSummarySection<Data>(),
    createTimelineSection<Data>(),
    createFormHelper<Data>(),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}

function clampProgress(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (value === Infinity || value === -Infinity) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function buildRenewalSummary<Data extends SubscriptionTimestampableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'timestampable:renewal-summary',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      const renewalDate = formatDate(data.current_period_end);
      const periodStart = formatDate(data.current_period_start);
      const periodEnd = formatDate(data.current_period_end);
      const progress = clampProgress(data.current_period_progress ?? null);
      const percentage = progress === null ? null : Math.round(progress * 100);
      const progressWidth = `${progress === null ? 0 : progress * 100}%`;

      return (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Text as="h2" size="lg" weight="semibold">
              Renewal
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              {renewalDate ? `Renews on ${renewalDate}` : 'Renewal date unavailable'}
            </Text>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{periodStart || '—'}</span>
              <span>{periodEnd || '—'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                style={{ width: progressWidth }}
                aria-hidden={percentage === null ? 'true' : undefined}
                aria-label={
                  percentage === null ? undefined : `Billing cycle ${percentage}% complete`
                }
              />
            </div>
            {percentage !== null ? (
              <Text as="p" size="sm" className="text-right text-slate-500 dark:text-slate-400">
                {percentage}% of cycle elapsed
              </Text>
            ) : null}
          </div>
        </Card>
      );
    },
  };
}

export function createSubscriptionTimestampableTraitAdapter<
  Data extends SubscriptionTimestampableViewData
>(options: SubscriptionTimestampableTraitOptions = {}): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Timestampable';
  const summaryPriority = options.summaryPriority ?? 55;

  const extensions: ViewExtension<Data>[] = [buildRenewalSummary<Data>(summaryPriority)];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
