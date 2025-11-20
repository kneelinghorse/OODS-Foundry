import { DateTime } from 'luxon';

import TimeService from '@/services/time/index.js';
import type { QuietHours } from '@/traits/communication/runtime-types.js';

export interface QuietHoursWindow {
  readonly start: Date;
  readonly end: Date;
}

export function isInQuietHours(
  quietHours: QuietHours | null | undefined,
  timezone?: string,
  now: Date = TimeService.nowSystem().toJSDate()
): boolean {
  const window = resolveActiveWindow(quietHours, timezone, now);
  if (!window) {
    return false;
  }
  const current = DateTime.fromJSDate(now);
  return current >= DateTime.fromJSDate(window.start) && current < DateTime.fromJSDate(window.end);
}

export function calculateNextDeliveryWindow(
  quietHours: QuietHours,
  timezone?: string,
  now: Date = TimeService.nowSystem().toJSDate()
): Date {
  const active = resolveActiveWindow(quietHours, timezone, now);
  if (active && DateTime.fromJSDate(now) < DateTime.fromJSDate(active.end)) {
    return DateTime.fromJSDate(active.end).toJSDate();
  }
  const nextStart = resolveNextStart(quietHours, timezone, now);
  return nextStart.toJSDate();
}

function resolveActiveWindow(
  quietHours: QuietHours | null | undefined,
  timezone: string | undefined,
  now: Date
): QuietHoursWindow | null {
  if (!quietHours) {
    return null;
  }
  const zone = quietHours.timezone ?? timezone ?? 'UTC';
  const current = DateTime.fromJSDate(now, { zone });
  const todayWindow = buildWindow(current, quietHours);
  if (windowContains(todayWindow, current, quietHours)) {
    return {
      start: todayWindow.start.toUTC().toJSDate(),
      end: todayWindow.end.toUTC().toJSDate(),
    } satisfies QuietHoursWindow;
  }
  const yesterdayWindow = buildWindow(current.minus({ days: 1 }), quietHours);
  if (windowContains(yesterdayWindow, current, quietHours)) {
    return {
      start: yesterdayWindow.start.toUTC().toJSDate(),
      end: yesterdayWindow.end.toUTC().toJSDate(),
    } satisfies QuietHoursWindow;
  }
  return null;
}

function resolveNextStart(quietHours: QuietHours, timezone: string | undefined, now: Date): DateTime {
  const zone = quietHours.timezone ?? timezone ?? 'UTC';
  const current = DateTime.fromJSDate(now, { zone }).startOf('minute');
  for (let offset = 0; offset < 7; offset += 1) {
    const candidateDay = current.plus({ days: offset });
    const window = buildWindow(candidateDay, quietHours);
    if (!dayMatches(window.start, quietHours)) {
      continue;
    }
    if (window.start <= current && window.end > current) {
      return window.end;
    }
    if (window.start > current) {
      return window.start;
    }
  }
  return current.plus({ days: 1 });
}

function buildWindow(anchor: DateTime, quietHours: QuietHours): { start: DateTime; end: DateTime } {
  const [startHour, startMinute] = parseTime(quietHours.start_time);
  const [endHour, endMinute] = parseTime(quietHours.end_time);
  let start = anchor.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  let end = anchor.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });
  if (end <= start) {
    if (anchor < start) {
      start = start.minus({ days: 1 });
    } else {
      end = end.plus({ days: 1 });
    }
    if (end <= start) {
      end = start.plus({ days: 1 });
    }
  }
  return { start, end };
}

function windowContains(
  window: { start: DateTime; end: DateTime },
  instant: DateTime,
  quietHours: QuietHours
): boolean {
  if (!dayMatches(window.start, quietHours)) {
    return false;
  }
  return instant >= window.start && instant < window.end;
}

function dayMatches(start: DateTime, quietHours: QuietHours): boolean {
  const days = quietHours.days_of_week;
  if (!days || days.length === 0) {
    return true;
  }
  const normalized = new Set(days.map((day) => day.toLowerCase()));
  const weekday = (start.weekdayLong ?? '').toLowerCase();
  if (!weekday) {
    return false;
  }
  return normalized.has(weekday);
}

function parseTime(value: string): [number, number] {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return [hours, minutes];
}
