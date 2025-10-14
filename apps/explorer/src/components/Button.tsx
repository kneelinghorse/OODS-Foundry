import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonTone = 'primary' | 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';
export type ButtonVariant = 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = {
  tone?: ButtonTone;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  selected?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      tone = 'primary',
      variant = 'solid',
      size = 'md',
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
    const composedClassName = className ? `cmp-button ${className}` : 'cmp-button';
    const computedAriaPressed =
      typeof ariaPressedProp === 'undefined' && typeof selected === 'boolean' ? selected : ariaPressedProp;

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={composedClassName}
        data-tone={tone}
        data-variant={variant}
        data-size={size}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={computedAriaPressed}
      >
        {leadingIcon ? (
          <span className="cmp-button__icon cmp-button__icon--leading" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <span className="cmp-button__label">{children}</span>
        {trailingIcon ? (
          <span className="cmp-button__icon cmp-button__icon--trailing" aria-hidden>
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

