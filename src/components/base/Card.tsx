import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

const BASE_CARD_STYLES =
  'rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow dark:border-slate-800 dark:bg-slate-950';
const ELEVATED_CARD_STYLES = 'shadow-lg shadow-slate-200/50 dark:shadow-none';

type CardElement = React.ElementRef<'div'>;

export const Card = React.forwardRef<CardElement, CardProps>(
  ({ className, elevated = false, ...props }, forwardedRef) => {
    const composedClassName = [
      BASE_CARD_STYLES,
      elevated ? ELEVATED_CARD_STYLES : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={forwardedRef} className={composedClassName} {...props} />
    );
  }
);

Card.displayName = 'OODS.Card';
