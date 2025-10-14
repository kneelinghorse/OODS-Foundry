import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type BadgeProps = {
  tone?: BadgeTone;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  selected?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Badge = forwardRef<HTMLButtonElement, BadgeProps>(
  (
    {
      tone = 'neutral',
      leadingIcon,
      trailingIcon,
      selected,
      className,
      type = 'button',
      children,
      'aria-pressed': ariaPressedProp,
      ...rest
    },
    ref
  ) => {
    const composedClassName = className ? `cmp-badge ${className}` : 'cmp-badge';
    const computedAriaPressed =
      typeof ariaPressedProp === 'undefined' && typeof selected === 'boolean' ? selected : ariaPressedProp;

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={composedClassName}
        data-tone={tone}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={computedAriaPressed}
      >
        {leadingIcon ? (
          <span className="cmp-badge__icon" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <span className="cmp-badge__label">{children}</span>
        {trailingIcon ? (
          <span className="cmp-badge__icon" aria-hidden>
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Badge.displayName = 'Badge';

