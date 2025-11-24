import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  intent?: 'neutral' | 'success' | 'warning' | 'danger';
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

const INTENT_TO_TONE: Record<NonNullable<ButtonProps['intent']>, string> = {
  neutral: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'critical',
};

type ButtonElement = React.ElementRef<'button'>;

export const Button = React.forwardRef<ButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      className,
      intent = 'neutral',
      variant = 'solid',
      size = 'md',
      type,
      ...props
    },
    forwardedRef
  ) => {
    const Component = asChild ? Slot : 'button';

    const composedClassName = ['cmp-button', className].filter(Boolean).join(' ');
    const tone = INTENT_TO_TONE[intent] ?? 'neutral';
    const dataAttributes = {
      'data-tone': tone,
      'data-size': size,
      'data-variant': variant === 'solid' ? undefined : variant,
    } as const;

    if (asChild) {
      return (
        <Component
          ref={forwardedRef}
          className={composedClassName}
          {...dataAttributes}
          {...props}
        />
      );
    }

    return (
      <Component
        ref={forwardedRef}
        className={composedClassName}
        type={type ?? 'button'}
        {...dataAttributes}
        {...props}
      />
    );
  }
);

Button.displayName = 'OODS.Button';
