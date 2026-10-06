/** Billable's declared defaults; object parameter overrides travel as runtime props. */
export const BILLING_INTERVALS = ['monthly', 'quarterly', 'annual'] as const;
export const BILLING_MINOR_UNITS = 100;
export const BILLING_AMOUNT_ERROR = 'Enter a non-negative amount.';
export const BILLING_INTERVAL_ERROR = 'Choose a valid billing interval.';

export type BillingAmountResult = { valid: true; value: number | undefined } | { valid: false; message: string };

export function validMinorUnits(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

/** Stored minor-unit factor: authored policy wins, otherwise use the currency's ISO fraction digits. */
export function currencyMinorUnits(currency?: string, declared?: number): number {
  if (declared !== undefined) {
    if (!validMinorUnits(declared)) throw new RangeError('minorUnits must be a positive integer factor.');
    return declared;
  }
  if (!currency) return BILLING_MINOR_UNITS;
  try {
    return 10 ** new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits;
  } catch { return BILLING_MINOR_UNITS; }
}

/** Decimal arithmetic avoids floating point errors at half-unit boundaries. */
export function parseBillingAmount(input: string, minorUnits = BILLING_MINOR_UNITS): BillingAmountResult {
  const text = input.trim();
  if (!text) return { valid: true, value: undefined };
  if (!validMinorUnits(minorUnits) || !/^\d*(?:\.\d*)?$/.test(text) || !/\d/.test(text)) {
    return { valid: false, message: BILLING_AMOUNT_ERROR };
  }
  const [whole = '', fraction = ''] = text.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt((whole || '0') + fraction) * BigInt(minorUnits);
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) return { valid: false, message: 'Amount is too large.' };
  return { valid: true, value: Number(rounded) };
}

export function billingAmountText(amount: number | undefined, minorUnits = BILLING_MINOR_UNITS): string {
  return amount === undefined ? '' : String(amount / minorUnits);
}

export function billingAmountMessage(amount: number | undefined, minorUnits = BILLING_MINOR_UNITS): string | undefined {
  return validMinorUnits(minorUnits) && (amount === undefined || (Number.isSafeInteger(amount) && amount >= 0))
    ? undefined : BILLING_AMOUNT_ERROR;
}

export function formatBillingAmount(amount: number | undefined, currency = 'usd', minorUnits = BILLING_MINOR_UNITS): string {
  if (amount === undefined) return 'No amount';
  if (billingAmountMessage(amount, minorUnits)) return 'Invalid amount';
  if (!/^[a-z]{3}$/i.test(currency)) return 'Invalid currency';
  // minorUnits is the explicit storage policy, including JPY's unit of 1.
  const digits = Math.min(20, Math.ceil(Math.log10(minorUnits)));
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(amount / minorUnits);
}

export function billingSummary(amount: number | undefined, currency = 'usd', minorUnits = BILLING_MINOR_UNITS, interval?: string): string {
  return `${formatBillingAmount(amount, currency, minorUnits)} · ${interval || 'No interval'}`;
}

export function billingIntervalMessage(interval: string | undefined, intervals: readonly string[] = BILLING_INTERVALS): string | undefined {
  return interval !== undefined && !intervals.includes(interval) ? BILLING_INTERVAL_ERROR : undefined;
}

/** PriceSummary aliases carry stored minor units, never major-unit floats. */
export function formatPriceAmount(value: unknown, currency: unknown = 'USD', minorUnits = BILLING_MINOR_UNITS): string {
  if (value == null || value === '') return 'No amount';
  const amount = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.0+)?$/.test(value.trim()) ? Number(value) : Number.NaN;
  return formatBillingAmount(amount, typeof currency === 'string' ? currency : '', minorUnits);
}

export function formatPriceCode(value: unknown): string | undefined {
  return value == null || value === '' ? undefined : String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
