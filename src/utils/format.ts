import { DateTime } from 'luxon';

/**
 * Formatting utilities for presenting canonical field values in views.
 */

const DEFAULT_DATE_OPTIONS: Readonly<Intl.DateTimeFormatOptions> = Object.freeze({
  dateStyle: 'medium',
  timeZone: 'UTC',
});

const DEFAULT_CURRENCY_OPTIONS: Readonly<Intl.NumberFormatOptions> = Object.freeze({
  style: 'currency',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an ISO8601 timestamp or Date instance into a readable string.
 * Returns an empty string when the input is missing or invalid so that
 * trait view renderers can remain pure and deterministic.
 */
export function formatDate(
  value?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === undefined || value === null) {
    return '';
  }

  let dateTime: DateTime | null = null;

  if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value);
  } else if (typeof value === 'number') {
    dateTime = DateTime.fromMillis(value, { zone: 'utc' });
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    const candidates = [
      DateTime.fromISO(trimmed, { zone: 'utc' }),
      DateTime.fromRFC2822(trimmed, { zone: 'utc' }),
      DateTime.fromSQL(trimmed, { zone: 'utc' }),
    ];
    dateTime = candidates.find((candidate) => candidate.isValid) ?? null;

    if ((!dateTime || !dateTime.isValid) && /^\d+$/.test(trimmed)) {
      dateTime = DateTime.fromMillis(Number.parseInt(trimmed, 10), { zone: 'utc' });
    }
  }

  if (!dateTime || !dateTime.isValid) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    ...DEFAULT_DATE_OPTIONS,
    ...options,
  });

  return formatter.format(dateTime.toJSDate());
}

export interface FormatMoneyOptions extends Intl.NumberFormatOptions {
  readonly locale?: string;
  readonly minorUnits?: boolean;
}

function normalizeCurrency(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length !== 3) {
    return null;
  }

  return normalized.toUpperCase();
}

function coerceAmount(
  amount: number | string | null | undefined,
  minorUnits: boolean | undefined
): number | null {
  if (amount === undefined || amount === null) {
    return null;
  }

  const numericValue =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount).trim());

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return minorUnits ? numericValue / 100 : numericValue;
}

/**
 * Format a monetary value for display.
 * Accepts amounts in major units by default, or minor units when the
 * `minorUnits` option is set. Invalid input returns an empty string so that
 * trait view renderers remain pure.
 */
export function formatMoney(
  amount?: number | string | null,
  currency?: string | null,
  options: FormatMoneyOptions = {}
): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const numericAmount = coerceAmount(amount ?? null, options.minorUnits ?? true);

  if (!normalizedCurrency || numericAmount === null) {
    return '';
  }

  const { locale, minorUnits: _minorUnits, ...formatOptions } = options;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      ...DEFAULT_CURRENCY_OPTIONS,
      ...formatOptions,
      currency: normalizedCurrency,
    });

    return formatter.format(numericAmount);
  } catch {
    return '';
  }
}
