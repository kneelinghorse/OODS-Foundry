import * as React from 'react';
import type { ButtonProps } from '@oods/components-react';
import { Button } from '@/registry/new-york-v4/ui/button';

export const OodsButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function OodsButton(
  { content, children, intent = 'neutral', size = 'md', type, asChild = false, className, onClick, onActivate, ...props }, ref,
) {
  const variant = intent === 'danger' || intent === 'destructive' ? 'destructive'
    : intent === 'primary' ? 'default'
    : intent === 'neutral' ? 'secondary'
    : intent === 'success' || intent === 'warning' ? 'secondary' : intent;
  // Keep normal-size destructive text readable using the team's solid tokens in both themes.
  const destructiveClass = variant === 'destructive' ? 'bg-destructive text-background hover:bg-destructive dark:bg-destructive dark:hover:bg-destructive' : undefined;
  return <Button {...props} ref={ref} className={[destructiveClass, className].filter(Boolean).join(' ')} variant={variant} size={size === 'md' ? 'default' : size}
    asChild={asChild} {...(asChild ? {} : { type: type ?? 'button' })} data-oods-component={undefined} data-oods-adapter="Button"
    data-intent={intent} onClick={event => { onClick?.(event); if (!event.defaultPrevented) onActivate?.(event); }}>
    {children ?? content}
  </Button>;
});
