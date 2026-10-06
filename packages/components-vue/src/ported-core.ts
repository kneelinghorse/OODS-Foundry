import { getStatusPresentation, resolveStatusIcon, type StatusIconName } from '@oods/component-contracts';
import type { ComponentTone } from './types.js';

export type TimelineEvent = {
  label: string;
  timestamp?: string;
  detail?: string;
  actorId?: string;
  reason?: string;
};

export type PaginationItem = {
  type: 'page' | 'ellipsis' | 'previous' | 'next';
  page?: number;
  selected: boolean;
  disabled: boolean;
  index?: number;
};

type StatusMetadata = {
  description: string;
  tone: ComponentTone;
  icon?: StatusIconName;
};

export type StatusPresentation = StatusMetadata & {
  label: string;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstText(record: Readonly<Record<string, unknown>>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

export function statusLabel(status: string): string {
  return status
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

// s222-m03 (#2502 ruling 13): Vue reads the shared status registry, as React and the HTML renderer do. Its own copy of the
// subscription and invoice tables matched the registry entry for entry and is gone; a status neither table knows reads
// the lifecycle table there, so a settled payment is a success in every renderer.
export function getPortedStatusPresentation(domain: string, status: string): StatusPresentation {
  const presentation = getStatusPresentation(domain.toLowerCase(), status);
  return {
    label: statusLabel(status || 'Unknown'),
    description: presentation.description,
    tone: presentation.tone as ComponentTone,
    icon: resolveStatusIcon(presentation.iconName),
  };
}

export function formatPrice(
  amountCents: number | undefined,
  amount: number | undefined,
  currency: string | undefined,
): string | undefined {
  const normalizedAmount = amountCents !== undefined ? amountCents / 100 : amount;
  if (normalizedAmount === undefined || !Number.isFinite(normalizedAmount)) return undefined;
  const formatted = Number.isInteger(normalizedAmount)
    ? String(normalizedAmount)
    : normalizedAmount.toFixed(2);
  return currency ? `${currency.toUpperCase()} ${formatted}` : formatted;
}

export function normalizeTimelineEvents(raw: unknown): TimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: TimelineEvent[] = [];
  for (const entry of raw) {
    if (entry === undefined || entry === null) continue;
    if (!isRecord(entry)) {
      events.push({ label: String(entry) });
      continue;
    }
    const from = firstText(entry, ['from']);
    const to = firstText(entry, ['to']);
    events.push({
      label: firstText(entry, ['label', 'title'])
        ?? (firstText(entry, ['event', 'status', 'state']) ? statusLabel(firstText(entry, ['event', 'status', 'state'])!) : undefined)
        ?? firstText(entry, ['text', 'name'])
        ?? (to ? (from ? `${statusLabel(from)} → ${statusLabel(to)}` : statusLabel(to)) : undefined)
        ?? 'Event',
      timestamp: firstText(entry, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']),
      detail: firstText(entry, ['detail', 'description', 'message']) ?? (to ? (from ? `${statusLabel(from)} → ${statusLabel(to)}` : statusLabel(to)) : undefined),
      actorId: firstText(entry, ['actorId', 'actor_id', 'actor']),
      reason: firstText(entry, ['reason']),
    });
  }
  return events;
}

function integerAtLeast(value: number, minimum: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

export function buildPaginationItems(options: {
  page: number;
  count: number;
  siblingCount?: number;
  boundaryCount?: number;
}): { page: number; count: number; items: PaginationItem[] } {
  const count = integerAtLeast(options.count, 0, 0);
  const rawPage = integerAtLeast(options.page, 1, 1);
  const page = count > 0 ? Math.min(rawPage, count) : 1;
  const items: PaginationItem[] = [{
    type: 'previous',
    page: page > 1 ? page - 1 : page,
    selected: false,
    disabled: count === 0 || page <= 1,
  }];

  if (count === 0) {
    items.push({ type: 'next', page: 1, selected: false, disabled: true });
    return { page, count, items };
  }

  const siblingCount = integerAtLeast(options.siblingCount ?? 1, 0, 1);
  const boundaryCount = integerAtLeast(options.boundaryCount ?? 1, 1, 1);
  const candidates = count <= boundaryCount * 2 + siblingCount * 2 + 3
    ? Array.from({ length: count }, (_, index) => index + 1)
    : [...new Set([
        ...Array.from({ length: boundaryCount }, (_, index) => index + 1),
        ...Array.from({ length: siblingCount * 2 + 1 }, (_, index) => page - siblingCount + index),
        ...Array.from({ length: boundaryCount }, (_, index) => count - boundaryCount + index + 1),
      ])].filter((candidate) => candidate >= 1 && candidate <= count).sort((left, right) => left - right);
  let priorPage: number | undefined;
  let ellipsisIndex = 0;
  for (const pageNumber of candidates) {
    if (priorPage !== undefined && pageNumber - priorPage > 1) {
      items.push({
        type: 'ellipsis',
        selected: false,
        disabled: true,
        index: ellipsisIndex++,
      });
    }
    items.push({
      type: 'page',
      page: pageNumber,
      selected: pageNumber === page,
      disabled: false,
    });
    priorPage = pageNumber;
  }
  items.push({
    type: 'next',
    page: page < count ? page + 1 : page,
    selected: false,
    disabled: page >= count,
  });
  return { page, count, items };
}

export function relativeTimestampLabel(datetime: string, now?: string | number | Date): string {
  if (now === undefined) return datetime;
  const timestamp = Date.parse(datetime);
  const reference = now instanceof Date
    ? now.getTime()
    : typeof now === 'number'
      ? now
      : Date.parse(now);
  if (!Number.isFinite(timestamp) || !Number.isFinite(reference)) return datetime;
  const seconds = Math.round((timestamp - reference) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (absoluteSeconds < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}
