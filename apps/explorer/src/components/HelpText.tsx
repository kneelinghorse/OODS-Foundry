import type { HTMLAttributes, ReactNode } from 'react';

export type HelpTextProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLParagraphElement>;

/**
 * HelpText renders secondary supporting copy for a field or group.
 * Styled via cmp-input__support so it consumes existing --cmp-* tokens.
 */
export function HelpText({ children, className, ...rest }: HelpTextProps) {
  const composed = className ? `cmp-help-text cmp-input__support ${className}` : 'cmp-help-text cmp-input__support';
  return (
    <p {...rest} className={composed} role="note">
      {children}
    </p>
  );
}

HelpText.displayName = 'HelpText';

