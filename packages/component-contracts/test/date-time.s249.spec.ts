/**
 * s249-m04 (Interface 13): every date-time a record screen shows names the zone it is shown in; a date alone names none.
 * Built without combining timeZoneName with dateStyle or timeStyle, which throws, and no path throws: not for any value,
 * zone, locale or kind of date the screens pass. Pinned text names only UTC, since other zones' names depend on ICU data.
 */
import { describe, expect, it } from 'vitest';
import { formatDateTime, formatReadOnlyValue, timeZoneLabel } from '../src/date-time.js';

describe('a date-time is labelled with its zone (Interface 13)', () => {
  it('names UTC after a date-time, and nothing after a date alone', () => {
    expect(formatDateTime('2026-12-31T10:59:59Z')).toBe('Dec 31, 2026, 10:59 AM UTC');
    expect(formatDateTime('2026-12-31', { dateOnly: true })).toBe('Dec 31, 2026');
    expect(formatReadOnlyValue('2026-09-28T21:05:00Z', 'datetime')).toBe('Sep 28, 2026, 9:05 PM UTC');
    expect(formatReadOnlyValue('2026-09-28', 'date')).toBe('Sep 28, 2026');
    expect(timeZoneLabel(new Date('2026-12-31T10:59:59Z'))).toBe('UTC');
  });

  it('names another zone when one is asked for, ending with the zone\'s own label', () => {
    const shown = formatDateTime('2026-12-31T10:59:59Z', { timeZone: 'Pacific/Auckland' });
    expect(shown.startsWith('Dec 31, 2026, 11:59 PM ')).toBe(true);
    expect(shown).toBe(`Dec 31, 2026, 11:59 PM ${timeZoneLabel(new Date('2026-12-31T10:59:59Z'), 'Pacific/Auckland')}`);
  });

  it('never throws, for any value, zone, locale or kind of date the screens pass', () => {
    const values = ['2026-12-31T10:59:59Z', '2026-12-31', 1798714799000, new Date('2026-12-31T10:59:59Z'), '', null, undefined, 'not a date', Number.NaN];
    const zones = [undefined, 'UTC', 'Pacific/Auckland', 'America/Chicago', 'Europe/London', 'UTC+2', 'Not/AZone', ''];
    const locales = [undefined, 'en-US', 'en-GB', 'de-DE'];
    for (const value of values) for (const timeZone of zones) for (const locale of locales) for (const dateOnly of [false, true]) {
      expect(() => formatDateTime(value as never, { timeZone, locale, dateOnly }), `${String(value)} ${timeZone} ${locale} ${dateOnly}`).not.toThrow();
    }
    for (const value of values) for (const type of ['date', 'datetime', 'date?', 'datetime?']) expect(() => formatReadOnlyValue(value, type)).not.toThrow();
    // A zone no formatter knows is shown in UTC, and labelled so.
    expect(formatDateTime('2026-12-31T10:59:59Z', { timeZone: 'UTC+2' })).toBe('Dec 31, 2026, 10:59 AM UTC');
  });
});
