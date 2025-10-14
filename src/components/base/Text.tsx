import * as React from 'react';
import type { JSX } from 'react';

export type TextProps = {
  size?: 'sm' | 'md' | 'lg';
  weight?: 'regular' | 'medium' | 'semibold';
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>;

const TEXT_SIZE_STYLES: Record<NonNullable<TextProps['size']>, string> = {
  sm: 'text-sm leading-5',
  md: 'text-base leading-6',
  lg: 'text-lg leading-7',
};

const TEXT_WEIGHT_STYLES: Record<
  NonNullable<TextProps['weight']>,
  string
> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      as: asElement = 'span',
      children,
      className,
      size = 'md',
      weight = 'regular',
      ...props
    },
    forwardedRef
  ) => {
    const Element = (asElement ?? 'span') as React.ElementType;
    const composedClassName = [
      TEXT_SIZE_STYLES[size],
      TEXT_WEIGHT_STYLES[weight],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Element
        ref={forwardedRef}
        className={composedClassName}
        {...props}
      >
        {children}
      </Element>
    );
  }
);

Text.displayName = 'OODS.Text';
