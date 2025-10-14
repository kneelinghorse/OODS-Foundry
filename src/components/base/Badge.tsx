import * as React from 'react';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  intent?: 'neutral' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
};

const BADGE_INTENT_STYLES: Record<
  NonNullable<BadgeProps['intent']>,
  string
> = {
  neutral:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  success:
    'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900 dark:text-emerald-50 dark:ring-emerald-700',
  warning:
    'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900 dark:text-amber-50 dark:ring-amber-700',
  danger:
    'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-900 dark:text-rose-50 dark:ring-rose-700',
};

const BASE_BADGE_STYLES =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide';

type BadgeElement = React.ElementRef<'span'>;

export const Badge = React.forwardRef<BadgeElement, BadgeProps>(
  ({ className, intent = 'neutral', children, ...props }, forwardedRef) => {
    const composedClassName = [
      BASE_BADGE_STYLES,
      BADGE_INTENT_STYLES[intent],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={forwardedRef} className={composedClassName} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'OODS.Badge';
