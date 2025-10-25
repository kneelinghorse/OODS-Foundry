import { DateTime } from 'luxon';
import type { StatusableViewData } from './types.js';

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function sanitizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatStatus(value: string | null | undefined): string {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return 'Unknown';
  }

  return sanitized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatTimestamp(value: string | null | undefined): string | null {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return null;
  }

  const candidates = [
    DateTime.fromISO(sanitized, { zone: 'utc' }),
    DateTime.fromRFC2822(sanitized, { zone: 'utc' }),
    DateTime.fromSQL(sanitized, { zone: 'utc' }),
  ];

  let parsed = candidates.find((candidate) => candidate.isValid);

  if (!parsed || !parsed.isValid) {
    if (/^\d+$/.test(sanitized)) {
      parsed = DateTime.fromMillis(Number.parseInt(sanitized, 10), { zone: 'utc' });
    }
  }

  if (!parsed || !parsed.isValid) {
    return null;
  }

  return TIMESTAMP_FORMATTER.format(parsed.toJSDate());
}

export function resolveDisplayName(data: StatusableViewData): string {
  const preferred = sanitizeString(data.preferred_name);
  if (preferred) {
    return preferred;
  }

  const name = sanitizeString(data.name);
  if (name) {
    return name;
  }

  return 'Unnamed Record';
}

export function resolveSubtitle(data: StatusableViewData): string | undefined {
  const email = sanitizeString(data.primary_email) ?? sanitizeString(data.email);
  if (email) {
    return email;
  }

  const role = sanitizeString(data.role);
  if (role) {
    return `Role: ${formatStatus(role)}`;
  }

  return undefined;
}

export function resolveDescription(data: StatusableViewData): string | undefined {
  const description = sanitizeString(data.description);
  if (description) {
    return description;
  }

  const role = sanitizeString(data.role);
  if (role) {
    return `Current role: ${formatStatus(role)}`;
  }

  return undefined;
}
