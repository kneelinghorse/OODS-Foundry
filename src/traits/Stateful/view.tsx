import { cloneElement, isValidElement, type ReactNode } from 'react';
import type { TraitAdapter, RenderContext } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import { PageHeader, type PageHeaderAction, type PageHeaderProps } from '../../components/page/PageHeader.js';
import { Button } from '../../components/base/Button.js';
import { Card } from '../../components/base/Card.js';
import { Text } from '../../components/base/Text.js';
import { withStatusBadge, type StatusBadgeDescriptor } from '../../modifiers/withStatusBadge.modifier.js';

export interface StateTransitionRecord {
  readonly from_state?: string | null;
  readonly to_state?: string | null;
  readonly timestamp?: string | null;
  readonly actor_id?: string | null;
  readonly reason?: string | null;
}

export interface StatefulViewData {
  readonly name?: string | null;
  readonly preferred_name?: string | null;
  readonly description?: string | null;
  readonly primary_email?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly status?: string | null;
  readonly state_history?: readonly StateTransitionRecord[] | null;
}

export interface StatefulTraitOptions {
  readonly traitId?: string;
}

export interface SubscriptionStatefulViewData {
  readonly plan_name?: string | null;
  readonly plan_interval?: string | null;
  readonly customer_name?: string | null;
  readonly customer_email?: string | null;
  readonly subscription_id?: string | null;
  readonly status?: string | null;
}

export interface SubscriptionStatefulTraitOptions extends StatefulTraitOptions {
  readonly headerId?: string;
  readonly headerPriority?: number;
}

const PAGE_HEADER_ID = 'stateful:page-header';
const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatStatus(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .split(/[_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return TIMESTAMP_FORMATTER.format(date);
}

function resolveDisplayName(data: StatefulViewData): string {
  const candidates = [data.name, data.preferred_name];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'Unnamed User';
}

function resolveSubtitle(data: StatefulViewData): string | undefined {
  const candidates = [data.primary_email, data.email];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function resolveDescription(data: StatefulViewData): string | undefined {
  if (typeof data.description === 'string' && data.description.trim()) {
    return data.description.trim();
  }

  if (typeof data.role === 'string' && data.role.trim()) {
    return `Role: ${formatStatus(data.role)}`;
  }

  return undefined;
}

function buildPrimaryActions(data: StatefulViewData): readonly PageHeaderAction[] | undefined {
  if (!data.status) {
    return undefined;
  }

  const normalized = data.status.toLowerCase();

  if (normalized === 'active') {
    return [
      {
        id: 'stateful:action:disable',
        label: 'Disable User',
        intent: 'danger',
      },
      {
        id: 'stateful:action:promote',
        label: 'Promote to Admin',
        intent: 'neutral',
      },
    ];
  }

  if (normalized === 'suspended' || normalized === 'deactivated') {
    return [
      {
        id: 'stateful:action:reinstate',
        label: 'Reinstate User',
        intent: 'success',
      },
      {
        id: 'stateful:action:contact',
        label: 'Contact Support',
        intent: 'neutral',
      },
    ];
  }

  return [
    {
      id: 'stateful:action:activate',
      label: 'Activate User',
      intent: 'success',
    },
  ];
}

function createPageHeaderExtension<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: PAGE_HEADER_ID,
    region: 'pageHeader',
    type: 'section',
    priority: 20,
    render: ({ data }) => (
      <PageHeader
        title={resolveDisplayName(data)}
        subtitle={resolveSubtitle(data)}
        description={resolveDescription(data)}
        actions={buildPrimaryActions(data)}
      />
    ),
  };
}

function createStatusBadgeModifier<Data extends StatefulViewData>(
  traitId: string
): ViewExtension<Data> {
  return {
    id: 'stateful:page-header:status-badge',
    region: 'pageHeader',
    type: 'modifier',
    targetId: PAGE_HEADER_ID,
    priority: 30,
    render: (renderContext) => {
      const statusContext = renderContext as unknown as RenderContext<StatefulViewData>;
      const partial = withStatusBadge({}, {
        renderContext: statusContext,
        status: renderContext.data.status ?? undefined,
      });

      const badges = partial.badges;
      if (!badges || badges.length === 0) {
        return {};
      }

      return (node) => {
        if (!isValidElement(node)) {
          return node;
        }

        const pageHeader = node as React.ReactElement<PageHeaderProps>;
        const existingBadges = Array.isArray(pageHeader.props?.badges) ? pageHeader.props.badges : [];
        return cloneElement(pageHeader, {
          badges: [...existingBadges, ...badges],
        });
      };
    },
    metadata: {
      sourceTrait: traitId,
    },
  };
}

function createToolbarAction<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: 'stateful:view-toolbar:primary-action',
    region: 'viewToolbar',
    type: 'action',
    priority: 40,
    render: ({ data }) => {
      const status = typeof data.status === 'string' ? data.status.toLowerCase() : 'unknown';
      const isActive = status === 'active' || status === 'invited';
      const intent = isActive ? 'danger' : 'success';
      const label = isActive ? 'Disable Access' : 'Activate Access';

      return <Button intent={intent}>{label}</Button>;
    },
  };
}

function createStatusSummary<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: 'stateful:summary',
    region: 'main',
    type: 'section',
    priority: 30,
    render: ({ data }) => (
      <Card className="flex flex-col gap-4">
        <Text as="h2" size="lg" weight="semibold">
          Lifecycle Status
        </Text>
        <Text as="p" size="md" className="text-slate-600 dark:text-slate-300">
          {`Current status: ${formatStatus(data.status)}`}
        </Text>
        <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
          State changes automatically update analytics and downstream contexts.
        </Text>
      </Card>
    ),
  };
}

function createStateHistoryList<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: 'stateful:state-history',
    region: 'contextPanel',
    type: 'section',
    priority: 60,
    render: ({ data }) => {
      const entries = Array.isArray(data.state_history) ? data.state_history : [];

      if (entries.length === 0) {
        return (
          <Card className="flex flex-col gap-3">
            <Text as="h3" size="md" weight="semibold">
              Recent State Changes
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              No lifecycle changes recorded.
            </Text>
          </Card>
        );
      }

      return (
        <Card className="flex flex-col gap-3">
          <Text as="h3" size="md" weight="semibold">
            Recent State Changes
          </Text>
          <ol className="flex flex-col gap-2">
            {entries.slice(0, 5).map((entry, index) => (
              <li
                key={`${entry.timestamp ?? index}-${entry.to_state ?? 'unknown'}`}
                className="rounded-lg border border-slate-200/60 px-3 py-2 dark:border-slate-700/60"
              >
                <Text as="p" size="sm" weight="medium">
                  {`${formatStatus(entry.from_state ?? 'unknown')} → ${formatStatus(entry.to_state ?? 'unknown')}`}
                </Text>
                {entry.reason ? (
                  <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
                    {entry.reason}
                  </Text>
                ) : null}
                {entry.timestamp ? (
                  <Text as="p" size="sm" className="text-slate-400 dark:text-slate-500">
                    {formatTimestamp(entry.timestamp)}
                  </Text>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      );
    },
  };
}

function createTimelineStream<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: 'stateful:timeline-stream',
    region: 'main',
    type: 'section',
    priority: 80,
    render: ({ data }) => {
      const entries = Array.isArray(data.state_history) ? data.state_history : [];

      if (entries.length === 0) {
        return (
          <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
            Lifecycle timeline will populate once the user changes state.
          </Text>
        );
      }

      return (
        <div className="flex flex-col gap-4">
          {entries.slice(0, 7).map((entry, index) => (
            <article
              key={`${entry.timestamp ?? index}-timeline`}
              className="rounded-lg border border-slate-200/60 px-4 py-3 shadow-sm dark:border-slate-700/60"
            >
              <Text as="h4" size="sm" weight="semibold">
                {formatStatus(entry.to_state ?? 'Unknown')}
              </Text>
              <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
                {entry.reason ?? 'State transition recorded.'}
              </Text>
              {entry.timestamp ? (
                <Text as="p" size="sm" className="text-slate-400 dark:text-slate-500">
                  {formatTimestamp(entry.timestamp)}
                </Text>
              ) : null}
            </article>
          ))}
        </div>
      );
    },
  };
}

function createListRow<Data extends StatefulViewData>(): ViewExtension<Data> {
  return {
    id: 'stateful:list-row',
    region: 'main',
    type: 'section',
    priority: 10,
    render: ({ data }) => (
      <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col">
          <Text as="span" weight="semibold">
            {resolveDisplayName(data)}
          </Text>
          {resolveSubtitle(data) ? (
            <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
              {resolveSubtitle(data)}
            </Text>
          ) : null}
        </div>
        <Text as="span" size="sm" weight="medium" className="text-slate-600 dark:text-slate-300">
          {formatStatus(data.status)}
        </Text>
      </div>
    ),
  };
}

const SUBSCRIPTION_HEADER_ID = 'subscription:page-header';

const SUBSCRIPTION_STATUS_ACTIVE: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-active',
  label: 'Active',
  tone: 'success',
});

const SUBSCRIPTION_STATUS_TRIALING: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-trialing',
  label: 'Trialing',
  tone: 'info',
});

const SUBSCRIPTION_STATUS_PAST_DUE: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-past-due',
  label: 'Past Due',
  tone: 'warning',
});

const SUBSCRIPTION_STATUS_CANCELED: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-canceled',
  label: 'Canceled',
  tone: 'danger',
});

const SUBSCRIPTION_STATUS_PAUSED: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-paused',
  label: 'Paused',
  tone: 'neutral',
});

const SUBSCRIPTION_STATUS_INCOMPLETE: StatusBadgeDescriptor = Object.freeze({
  id: 'subscription-status-incomplete',
  label: 'Incomplete',
  tone: 'neutral',
});

const SUBSCRIPTION_STATUS_BADGES: Readonly<Record<string, StatusBadgeDescriptor>> = Object.freeze({
  active: SUBSCRIPTION_STATUS_ACTIVE,
  trial: SUBSCRIPTION_STATUS_TRIALING,
  trialing: SUBSCRIPTION_STATUS_TRIALING,
  past_due: SUBSCRIPTION_STATUS_PAST_DUE,
  'past-due': SUBSCRIPTION_STATUS_PAST_DUE,
  pastdue: SUBSCRIPTION_STATUS_PAST_DUE,
  delinquent: SUBSCRIPTION_STATUS_PAST_DUE,
  canceled: SUBSCRIPTION_STATUS_CANCELED,
  cancelled: SUBSCRIPTION_STATUS_CANCELED,
  pausing: SUBSCRIPTION_STATUS_PAUSED,
  paused: SUBSCRIPTION_STATUS_PAUSED,
  incomplete: SUBSCRIPTION_STATUS_INCOMPLETE,
});

function sanitizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function resolveSubscriptionBadge(
  status?: string | null
): StatusBadgeDescriptor | undefined {
  const normalized = sanitizeString(status);
  if (!normalized) {
    return undefined;
  }

  const key = normalized.toLowerCase().replace(/[\s-]+/g, '_');
  return SUBSCRIPTION_STATUS_BADGES[key];
}

function resolvePlanTitle(data: SubscriptionStatefulViewData): string {
  const plan = sanitizeString(data.plan_name);
  if (plan) {
    return plan;
  }

  const statusLabel = formatStatus(data.status);
  if (statusLabel !== 'Unknown') {
    return `${statusLabel} Subscription`;
  }

  return 'Subscription';
}

function resolveCustomerSubtitle(data: SubscriptionStatefulViewData): string | undefined {
  const parts = [
    sanitizeString(data.customer_name),
    sanitizeString(data.customer_email),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' • ');
}

function resolvePlanDescription(data: SubscriptionStatefulViewData): string | undefined {
  const interval = sanitizeString(data.plan_interval);
  const subscriptionId = sanitizeString(data.subscription_id);

  const segments: string[] = [];

  if (interval) {
    segments.push(`${formatStatus(interval)} billing cycle`);
  }

  if (subscriptionId) {
    segments.push(`Subscription ID ${subscriptionId}`);
  }

  if (segments.length === 0) {
    return undefined;
  }

  return segments.join(' • ');
}

function resolveSubscriptionMetadata(
  data: SubscriptionStatefulViewData
): ReactNode | null {
  const fields: string[] = [];

  const email = sanitizeString(data.customer_email);
  if (email) {
    fields.push(email);
  }

  const status = sanitizeString(data.status);
  if (status) {
    fields.push(formatStatus(status));
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <Text as="span" size="sm" className="text-right text-slate-500 dark:text-slate-400">
      {fields.join(' • ')}
    </Text>
  );
}

function buildSubscriptionHeader<Data extends SubscriptionStatefulViewData>(
  headerId: string,
  priority: number
): ViewExtension<Data> {
  return {
    id: headerId,
    region: 'pageHeader',
    type: 'section',
    priority,
    render: ({ data }) => {
      const badge = resolveSubscriptionBadge(data.status);
      const metadata = resolveSubscriptionMetadata(data);

      return (
        <PageHeader
          title={resolvePlanTitle(data)}
          subtitle={resolveCustomerSubtitle(data)}
          description={resolvePlanDescription(data)}
          badges={badge ? [badge] : undefined}
          metadata={metadata ?? undefined}
        />
      );
    },
  };
}

export function createStatefulTraitAdapter<Data extends StatefulViewData>(
  options: StatefulTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Stateful';

  const extensions: ViewExtension<Data>[] = [
    createPageHeaderExtension<Data>(),
    createStatusSummary<Data>(),
    createToolbarAction<Data>(),
    createStateHistoryList<Data>(),
    createTimelineStream<Data>(),
    createListRow<Data>(),
    createStatusBadgeModifier<Data>(traitId),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}

export function createSubscriptionStatefulTraitAdapter<
  Data extends SubscriptionStatefulViewData
>(options: SubscriptionStatefulTraitOptions = {}): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Stateful';
  const headerId = options.headerId ?? SUBSCRIPTION_HEADER_ID;
  const headerPriority = options.headerPriority ?? 10;

  const extensions: ViewExtension<Data>[] = [
    buildSubscriptionHeader<Data>(headerId, headerPriority),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
