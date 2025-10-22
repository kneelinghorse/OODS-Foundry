import type { JSX } from 'react';
import type { TraitAdapter } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import type { ContextKind } from '../../contexts/index.js';
import { PageHeader } from '../../components/page/PageHeader.js';
import { Text } from '../../components/base/Text.js';
import {
  registerStatusableContributions,
  type RegisterStatusableContributionsInput,
} from '../Statusable/contrib/statusable-contributions.js';
import { registerActionableContributions } from '../Actionable/contrib/actionable-contributions.js';
import { registerAuditableContributions } from '../Auditable/contrib/auditable-contributions.js';
import {
  formatStatus,
  sanitizeString,
  resolveDescription,
  resolveDisplayName,
  resolveSubtitle,
} from '../Statusable/utils.js';
import type {
  StatusTransitionEvent,
  StatusableContributionOptions,
  StatusableViewData,
  SubscriptionStatusableViewData,
} from '../Statusable/types.js';

export type StateTransitionRecord = StatusTransitionEvent;
export type StatefulViewData = StatusableViewData;
export type SubscriptionStatefulViewData = SubscriptionStatusableViewData;

export interface StatefulTraitOptions extends StatusableContributionOptions {
  readonly traitId?: string;
  readonly contexts?: readonly ContextKind[];
  readonly pageHeaderPriority?: number;
  readonly headerId?: string;
}

export interface SubscriptionStatefulTraitOptions extends StatefulTraitOptions {
  readonly headerId?: string;
  readonly headerPriority?: number;
}

const DEFAULT_STATEFUL_HEADER_ID = 'stateful:page-header';
const DEFAULT_SUBSCRIPTION_HEADER_ID = 'subscription:page-header';

interface PageHeaderOptions<Data> {
  readonly id: string;
  readonly priority: number;
  readonly buildTitle: (data: Data) => string;
  readonly buildSubtitle?: (data: Data) => string | undefined;
  readonly buildDescription?: (data: Data) => string | undefined;
  readonly buildMetadata?: (data: Data) => ReturnType<typeof renderMetadata>;
}

function renderMetadata(items: readonly string[]): JSX.Element | undefined {
  if (!items || items.length === 0) {
    return undefined;
  }

  return (
    <div className="flex flex-col text-right text-sm text-slate-500 dark:text-slate-400">
      {items.map((item) => (
        <Text as="span" size="sm" key={item}>
          {item}
        </Text>
      ))}
    </div>
  );
}

function createPageHeaderExtension<Data>(
  options: PageHeaderOptions<Data>
): ViewExtension<Data> {
  return {
    id: options.id,
    region: 'pageHeader',
    type: 'section',
    priority: options.priority,
    render: ({ data }) => (
      <PageHeader
        title={options.buildTitle(data)}
        subtitle={options.buildSubtitle ? options.buildSubtitle(data) : undefined}
        description={options.buildDescription ? options.buildDescription(data) : undefined}
        metadata={options.buildMetadata ? options.buildMetadata(data) : undefined}
      />
    ),
  };
}

function registerSharedContributions<Data extends StatefulViewData>(
  traitId: string,
  options: StatefulTraitOptions = {}
): void {
  const contexts = options.contexts;
  const statusableInput: RegisterStatusableContributionsInput = {
    traitId,
    options: {
      statusDomain: options.statusDomain,
      summaryTitle: options.summaryTitle,
      summaryDescription: options.summaryDescription,
    },
    contexts,
  };

  registerStatusableContributions<Data>(statusableInput);

  registerActionableContributions<Data>({
    traitId,
    contexts,
  });

  registerAuditableContributions<Data>(traitId);
}

function resolveSubscriptionTitle(data: SubscriptionStatefulViewData): string {
  const plan = sanitizeString(data.plan_name);
  if (plan) {
    return plan;
  }

  const status = sanitizeString(data.status);
  if (status) {
    return `${formatStatus(status)} Subscription`;
  }

  return 'Subscription';
}

function resolveSubscriptionSubtitle(data: SubscriptionStatefulViewData): string | undefined {
  const name = sanitizeString(data.customer_name);
  const email = sanitizeString(data.customer_email);

  const parts = [name, email].filter((value): value is string => Boolean(value));
  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' • ');
}

function resolveSubscriptionDescription(data: SubscriptionStatefulViewData): string | undefined {
  const interval = sanitizeString(data.plan_interval);
  const subscriptionId = sanitizeString(data.subscription_id);

  const parts: string[] = [];

  if (interval) {
    parts.push(`${formatStatus(interval)} billing cycle`);
  }

  if (subscriptionId) {
    parts.push(`Subscription ID ${subscriptionId}`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' • ');
}

function resolveSubscriptionMetadata(data: SubscriptionStatefulViewData): string[] {
  const metadata: string[] = [];

  const status = sanitizeString(data.status);
  if (status) {
    metadata.push(formatStatus(status));
  }

  const email = sanitizeString(data.customer_email);
  if (email) {
    metadata.push(email);
  }

  return metadata;
}

export function createStatefulTraitAdapter<Data extends StatefulViewData>(
  options: StatefulTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Stateful';
  const pageHeaderPriority = options.pageHeaderPriority ?? 20;
  const headerId = options.headerId ?? DEFAULT_STATEFUL_HEADER_ID;

  registerSharedContributions<Data>(traitId, {
    ...options,
    statusDomain: options.statusDomain ?? 'user',
  });

  const extensions: ViewExtension<Data>[] = [
    createPageHeaderExtension<Data>({
      id: headerId,
      priority: pageHeaderPriority,
      buildTitle: (record) => resolveDisplayName(record),
      buildSubtitle: (record) => resolveSubtitle(record),
      buildDescription: (record) => resolveDescription(record),
    }),
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
  const pageHeaderPriority = options.headerPriority ?? options.pageHeaderPriority ?? 15;
  const headerId = options.headerId ?? DEFAULT_SUBSCRIPTION_HEADER_ID;

  registerSharedContributions<Data>(traitId, {
    ...options,
    statusDomain: options.statusDomain ?? 'subscription',
  });

  const extensions: ViewExtension<Data>[] = [
    createPageHeaderExtension<Data>({
      id: headerId,
      priority: pageHeaderPriority,
      buildTitle: (record) => resolveSubscriptionTitle(record),
      buildSubtitle: (record) => resolveSubscriptionSubtitle(record),
      buildDescription: (record) => resolveSubscriptionDescription(record),
      buildMetadata: (record) => renderMetadata(resolveSubscriptionMetadata(record)),
    }),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
