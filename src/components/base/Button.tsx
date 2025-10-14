import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  intent?: 'neutral' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

const BUTTON_INTENT_STYLES: Record<
  NonNullable<ButtonProps['intent']>,
  string
> = {
  neutral:
    'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-600',
  warning:
    'bg-amber-500 text-slate-900 hover:bg-amber-400 focus-visible:outline-amber-500',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600',
};

const BUTTON_SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const BASE_BUTTON_STYLES =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type ButtonElement = React.ElementRef<'button'>;

export const Button = React.forwardRef<ButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      className,
      intent = 'neutral',
      size = 'md',
      type,
      ...props
    },
    forwardedRef
  ) => {
    const Component = asChild ? Slot : 'button';

    const composedClassName = [
      BASE_BUTTON_STYLES,
      BUTTON_INTENT_STYLES[intent],
      BUTTON_SIZE_STYLES[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    if (asChild) {
      return (
        <Component ref={forwardedRef} className={composedClassName} {...props} />
      );
    }

    return (
      <Component
        ref={forwardedRef}
        className={composedClassName}
        type={type ?? 'button'}
        {...props}
      />
    );
  }
);

Button.displayName = 'OODS.Button';
