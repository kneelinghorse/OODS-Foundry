import * as React from 'react';
import {
  BILLING_INTERVALS, BILLING_MINOR_UNITS, billingAmountMessage, billingAmountText,
  billingIntervalMessage, billingSummary, formatReadOnlyValue, formatBillingAmount, parseBillingAmount,
} from '@oods/component-contracts';

export interface BillingSummaryBadgeProps {
  id?: string;
  amount?: number;
  currency?: string;
  minorUnits?: number;
  interval?: string;
  showInterval?: boolean;
  className?: string;
}

export function BillingSummaryBadge({ id, amount, currency, minorUnits, interval, showInterval = true, className }: BillingSummaryBadgeProps) {
  return <span id={id} className={`oods-billing-summary ${className ?? ''}`.trim()} data-oods-component="BillingSummaryBadge">
    {showInterval ? billingSummary(amount, currency, minorUnits, interval) : formatBillingAmount(amount, currency, minorUnits)}
  </span>;
}

export interface BillingAmountInputProps extends Omit<BillingSummaryBadgeProps, 'interval'> {
  label?: string;
  help?: string;
  name?: string;
  disabled?: boolean;
  onChange?: (value: number | undefined) => void;
}

export function BillingAmountInput({ id, amount, currency = 'usd', minorUnits = BILLING_MINOR_UNITS, label = 'Billing amount', name, disabled, className, help, onChange }: BillingAmountInputProps) {
  const generatedId = React.useId();
  const controlId = id ?? `billing-amount-${generatedId}`;
  const [text, setText] = React.useState(() => billingAmountText(amount, minorUnits));
  const [error, setError] = React.useState(() => billingAmountMessage(amount, minorUnits));
  React.useEffect(() => { setText(billingAmountText(amount, minorUnits)); setError(billingAmountMessage(amount, minorUnits)); }, [amount, minorUnits]);
  return <div className={`oods-billing-field ${className ?? ''}`.trim()} data-oods-component="BillingAmountInput" data-state={error ? 'invalid' : 'editing'}>
    <label htmlFor={controlId}>{label}</label>
    <span id={`${controlId}-currency`}>{currency.toUpperCase()}</span>
    <input id={controlId} name={name} type="text" inputMode="decimal" value={text} disabled={disabled}
      data-billing-minor-units={minorUnits} aria-invalid={error ? true : undefined}
      aria-describedby={[`${controlId}-currency`, error && `${controlId}-error`].filter(Boolean).join(' ')}
      onChange={(event) => {
        const next = event.currentTarget.value;
        const result = parseBillingAmount(next, minorUnits);
        event.currentTarget.setCustomValidity(result.valid ? '' : result.message);
        setText(next); setError(result.valid ? undefined : result.message);
        if (result.valid) onChange?.(result.value);
      }} />
    {help && <p className="oods-field-help">{help}</p>}
    {error && <p id={`${controlId}-error`} role="alert">{error}</p>}
  </div>;
}

export interface BillingIntervalSelectorProps {
  id?: string;
  interval?: string;
  intervals?: readonly string[];
  label?: string;
  help?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

export function BillingIntervalSelector({ id, interval, intervals = BILLING_INTERVALS, label = 'Billing interval', name, disabled, className, help, onChange }: BillingIntervalSelectorProps) {
  const generatedId = React.useId();
  const controlId = id ?? `billing-interval-${generatedId}`;
  const [value, setValue] = React.useState(interval ?? '');
  React.useEffect(() => { setValue(interval ?? ''); }, [interval]);
  const error = billingIntervalMessage(value || undefined, intervals);
  return <div className={`oods-billing-field ${className ?? ''}`.trim()} data-oods-component="BillingIntervalSelector" data-state={error ? 'invalid' : 'editing'}>
    <label htmlFor={controlId}>{label}</label>
    <select id={controlId} name={name} value={value} disabled={disabled} aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${controlId}-error` : undefined} onChange={(event) => {
        const next = event.currentTarget.value;
        if (intervals.includes(next)) { setValue(next); onChange?.(next); }
      }}>
      {!intervals.includes(value) && <option value={value} disabled>{value || 'Choose interval'}</option>}
      {intervals.map((option) => <option key={option} value={option}>{formatReadOnlyValue(option, 'string', true)}</option>)}
    </select>
    {help && <p className="oods-field-help">{help}</p>}
    {error && <p id={`${controlId}-error`} role="alert">{error}</p>}
  </div>;
}
