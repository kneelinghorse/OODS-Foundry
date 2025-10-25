import type { RenderContext } from '../types/render-context.js';

export type StatusTone = 'info' | 'success' | 'warning' | 'critical' | 'neutral';

export interface StatusBadgeDescriptor {
  readonly id: string;
  readonly label: string;
  readonly tone: StatusTone;
}

export interface PageHeaderProps {
  readonly badges?: readonly StatusBadgeDescriptor[];
}

export interface WithStatusBadgeContext<Data = { status?: string }> {
  readonly renderContext: RenderContext<Data>;
  readonly status?: string;
}

const TERMINATED_DESCRIPTOR: StatusBadgeDescriptor = Object.freeze({
  id: 'status-terminated',
  label: 'Terminated',
  tone: 'neutral',
});

const STATUS_MAP: Readonly<Record<string, StatusBadgeDescriptor>> = Object.freeze({
  active: Object.freeze({
    id: 'status-active',
    label: 'Active',
    tone: 'success',
  }),
  trialing: Object.freeze({
    id: 'status-trialing',
    label: 'Trialing',
    tone: 'info',
  }),
  future: Object.freeze({
    id: 'status-future',
    label: 'Future',
    tone: 'info',
  }),
  paused: Object.freeze({
    id: 'status-paused',
    label: 'Paused',
    tone: 'warning',
  }),
  pending_cancellation: Object.freeze({
    id: 'status-pending-cancellation',
    label: 'Pending Cancellation',
    tone: 'warning',
  }),
  delinquent: Object.freeze({
    id: 'status-delinquent',
    label: 'Delinquent',
    tone: 'critical',
  }),
  terminated: TERMINATED_DESCRIPTOR,
  inactive: Object.freeze({
    id: 'status-inactive',
    label: 'Inactive',
    tone: 'neutral',
  }),
  past_due: Object.freeze({
    id: 'status-past-due',
    label: 'Past Due',
    tone: 'warning',
  }),
  canceled: TERMINATED_DESCRIPTOR,
  cancelled: TERMINATED_DESCRIPTOR,
});

function resolveStatus<Data>(
  context?: WithStatusBadgeContext<Data>
): StatusBadgeDescriptor | undefined {
  if (!context) {
    return undefined;
  }

  const directStatus = context.status ?? (context.renderContext.data as { status?: string })?.status;
  if (!directStatus) {
    return undefined;
  }

  const normalized = String(directStatus).toLowerCase();
  return STATUS_MAP[normalized];
}

export function withStatusBadge<Data>(
  props: PageHeaderProps,
  context?: WithStatusBadgeContext<Data>
): Partial<PageHeaderProps> {
  const descriptor = resolveStatus(context);
  if (!descriptor) {
    return {};
  }

  const existingBadges = props.badges ?? [];
  const hasBadge = existingBadges.some((badge) => badge.id === descriptor.id);
  if (hasBadge) {
    return {};
  }

  return {
    badges: [...existingBadges, descriptor],
  };
}
