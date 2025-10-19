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

const CANCELLED_DESCRIPTOR: StatusBadgeDescriptor = Object.freeze({
  id: 'status-canceled',
  label: 'Canceled',
  tone: 'critical',
});

const STATUS_MAP: Readonly<Record<string, StatusBadgeDescriptor>> = Object.freeze({
  active: Object.freeze({
    id: 'status-active',
    label: 'Active',
    tone: 'success',
  }),
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
  canceled: CANCELLED_DESCRIPTOR,
  cancelled: CANCELLED_DESCRIPTOR,
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
