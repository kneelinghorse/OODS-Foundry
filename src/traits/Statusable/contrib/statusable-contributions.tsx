import type { ReactNode } from 'react';
import { Badge } from '../../../components/base/Badge.js';
import { Card } from '../../../components/base/Card.js';
import { Text } from '../../../components/base/Text.js';
import { registerContribution } from '../../../engine/contributions/index.js';
import type { ContributionRenderContext } from '../../../engine/contributions/index.js';
import type { ContextKind } from '../../../contexts/index.js';
import type { StatusDomain } from '../../../components/statusables/statusRegistry.js';
import {
  formatStatus,
  formatTimestamp,
  sanitizeString,
  resolveDisplayName,
  resolveSubtitle,
} from '../utils.js';
import type {
  StatusableContributionOptions,
  StatusableViewData,
} from '../types.js';

const STATUS_LABEL = 'Status';
const DEFAULT_STATUS_DOMAIN: StatusDomain = 'subscription';
const DEFAULT_SUMMARY_TITLE = 'Lifecycle Summary';

type StatusContributionContext<Data> = ContributionRenderContext<Data>;

function hasStatus<Data extends StatusableViewData>(data: Data): data is Data & { status: string } {
  return typeof data?.status === 'string' && data.status.trim().length > 0;
}

function buildSummaryMetadata(data: StatusableViewData): ReactNode {
  const entries: Array<{ readonly label: string; readonly value: string }> = [];

  const email = sanitizeString(data.primary_email) ?? sanitizeString(data.email);
  if (email) {
    entries.push({ label: 'Primary email', value: email });
  }

  const role = sanitizeString(data.role);
  if (role) {
    entries.push({ label: 'Role', value: formatStatus(role) });
  }

  const status = sanitizeString(data.status);
  if (status) {
    entries.push({ label: 'Status', value: formatStatus(status) });
  }

  const lastStateChange = Array.isArray(data.state_history) ? data.state_history[0] : undefined;
  const lastChangedAt = formatTimestamp(lastStateChange?.timestamp);
  if (lastChangedAt) {
    entries.push({ label: 'Last updated', value: lastChangedAt });
  }

  if (entries.length === 0) {
    return (
      <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
        Metadata unavailable for this record.
      </Text>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-3">
      {entries.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1">
          <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
            {label}
          </Text>
          <Text as="dd" weight="medium">
            {value}
          </Text>
        </div>
      ))}
    </dl>
  );
}

function renderStatusChip<Data extends StatusableViewData>(
  context: StatusContributionContext<Data>,
  statusDomain: StatusDomain
): ReactNode {
  const data = context.renderContext.data as StatusableViewData;

  if (!hasStatus(data)) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
        {STATUS_LABEL}
      </Text>
      <Badge status={data.status} domain={statusDomain} emphasis="solid" />
    </div>
  );
}

function renderStatusSummary<Data extends StatusableViewData>(
  context: StatusContributionContext<Data>,
  statusDomain: StatusDomain,
  title: string,
  description?: string
): ReactNode {
  const data = context.renderContext.data as StatusableViewData;
  const status = sanitizeString(data.status);
  const subtitle = resolveSubtitle(data) ?? null;
  const metadata = buildSummaryMetadata(data);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Text as="h2" size="lg" weight="semibold">
          {title}
        </Text>
        {description ? (
          <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
            {description}
          </Text>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
          {STATUS_LABEL}
        </Text>
        {status ? (
          <Badge status={status} domain={statusDomain} emphasis="subtle" />
        ) : (
          <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
            Unknown
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
          Primary contact
        </Text>
        <Text as="span" weight="medium">
          {resolveDisplayName(data)}
        </Text>
        {subtitle ? (
          <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
            {subtitle}
          </Text>
        ) : null}
      </div>

      {metadata}
    </Card>
  );
}

function renderListRow<Data extends StatusableViewData>(
  context: StatusContributionContext<Data>,
  statusDomain: StatusDomain
): ReactNode {
  const data = context.renderContext.data as StatusableViewData;
  const subtitle = resolveSubtitle(data);
  const status = sanitizeString(data.status);

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col">
        <Text as="span" weight="semibold">
          {resolveDisplayName(data)}
        </Text>
        {subtitle ? (
          <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {status ? (
        <Badge status={status} domain={statusDomain} emphasis="subtle" />
      ) : null}
    </div>
  );
}

export interface RegisterStatusableContributionsInput {
  readonly traitId: string;
  readonly options?: StatusableContributionOptions;
  readonly contexts?: readonly ContextKind[];
}

const DEFAULT_CONTEXTS: readonly ContextKind[] = Object.freeze([
  'detail',
  'list',
  'form',
  'timeline',
]);

export function registerStatusableContributions<Data extends StatusableViewData>(
  input: RegisterStatusableContributionsInput
): void {
  const { traitId, options, contexts = DEFAULT_CONTEXTS } = input;
  const statusDomain = (options?.statusDomain ?? DEFAULT_STATUS_DOMAIN) as StatusDomain;
  const summaryTitle = options?.summaryTitle ?? DEFAULT_SUMMARY_TITLE;
  const summaryDescription = options?.summaryDescription;

  registerContribution<Data>({
    id: `${traitId}:page-header:status-chip`,
    traitId,
    context: contexts,
    region: 'pageHeader',
    priority: 40,
    render: (ctx) => renderStatusChip(ctx, statusDomain),
  });

  const summaryContexts = contexts.filter((context) => context !== 'timeline');
  if (summaryContexts.length > 0) {
    registerContribution<Data>({
      id: `${traitId}:context-panel:status-summary`,
      traitId,
      context: summaryContexts,
      region: 'contextPanel',
      priority: 50,
      render: (ctx) => renderStatusSummary(ctx, statusDomain, summaryTitle, summaryDescription),
    });
  }

  if (contexts.includes('list')) {
    registerContribution<Data>({
      id: `${traitId}:list:summary-row`,
      traitId,
      context: 'list',
      region: 'main',
      priority: 25,
      render: (ctx) => renderListRow(ctx, statusDomain),
    });
  }
}
