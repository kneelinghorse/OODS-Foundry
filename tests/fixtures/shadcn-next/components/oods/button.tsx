import * as React from 'react';
import type { ButtonProps } from '@oods/components-react';
import { Button } from '@/components/ui/button';

export const OodsButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function OodsButton(
  { content, children, intent = 'neutral', size = 'md', type, asChild = false, onClick, onActivate, ...props }, ref,
) {
  const variant = intent === 'danger' || intent === 'destructive' ? 'destructive'
    : intent === 'primary' ? 'default'
    : intent === 'neutral' ? 'secondary'
    : intent === 'success' || intent === 'warning' ? 'secondary' : intent;
  return <Button {...props} ref={ref} variant={variant} size={size === 'md' ? 'default' : size} {...(asChild ? {} : { type: type ?? 'button' })} data-oods-component={undefined} data-oods-adapter="Button"
    data-intent={intent} onClick={event => { onClick?.(event); if (!event.defaultPrevented) onActivate?.(event); }}>
    {children ?? content}
  </Button>;
});
