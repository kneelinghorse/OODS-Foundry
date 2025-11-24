import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

type CardElement = React.ElementRef<'div'>;

export const Card = React.forwardRef<CardElement, CardProps>(
  ({ className, elevated = false, ...props }, forwardedRef) => {
    const composedClassName = [
      'cmp-card',
      elevated ? 'cmp-card--elevated' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={forwardedRef}
        className={composedClassName}
        data-elevated={elevated ? 'true' : undefined}
        {...props}
      />
    );
  }
);

Card.displayName = 'OODS.Card';
