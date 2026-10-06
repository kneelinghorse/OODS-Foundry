import * as React from 'react';
import type { PriceBadgeProps } from '@oods/components-react';
import { currencyMinorUnits } from '@oods/component-contracts';
import { Badge } from '@/registry/new-york-v4/ui/badge';

export const OodsPriceBadge = React.forwardRef<HTMLSpanElement, PriceBadgeProps>(function OodsPriceBadge(
  { amountCents, unitAmountCents, minorUnits, amount, unitAmount, currency, currencyCode, label, value, children,
    emphasis = 'subtle', field, amountField, currencyField, intervalField, minorUnitsParameter, ...props }, ref,
) {
  void [field, amountField, currencyField, intervalField, minorUnitsParameter];
  const cents = amountCents ?? unitAmountCents;
  const code = currency ?? currencyCode;
  const price = cents === undefined ? amount ?? unitAmount : cents / currencyMinorUnits(code, minorUnits);
  let formatted: React.ReactNode = value ?? 'Price';
  if (price !== undefined && Number.isFinite(price)) {
    if (!code) formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(price);
    else try { formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: code.toUpperCase() }).format(price); }
    catch { formatted = `${code.toUpperCase()} ${price.toFixed(2)}`; }
  }
  return <Badge {...props} ref={ref} variant={emphasis === 'solid' ? 'default' : 'secondary'}
    data-oods-component={undefined} data-oods-adapter="PriceBadge" data-badge-variant="price" data-price="true" data-currency={code?.toUpperCase()}>
    {label ?? children ?? formatted}
  </Badge>;
});
