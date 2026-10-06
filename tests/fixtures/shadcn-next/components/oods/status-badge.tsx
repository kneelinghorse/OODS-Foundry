import * as React from 'react';
import type { StatusBadgeProps } from '@oods/components-react';
import { getStatusPresentation, resolveStatusIcon, statusIconMarkup } from '@oods/component-contracts';
import { Badge } from '@/components/ui/badge';

export const OodsStatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(function OodsStatusBadge(
  { status, value, label, children, content, domain = 'subscription', tone, emphasis = 'subtle', variant,
    showIcon = true, icon, iconPosition = 'start', title, field, statusField, domainField, readOnly, compact,
    'aria-label': ariaLabel, ...props }, ref,
) {
  void [field, statusField, domainField, readOnly, compact];
  const state = status ?? value ?? 'unknown';
  const presentation = getStatusPresentation(domain, state);
  const resolvedTone = tone && tone !== 'lifecycle' ? tone : presentation.tone;
  const destructive = resolvedTone === 'critical' || resolvedTone === 'danger';
  const solid = variant === 'solid' || emphasis === 'solid';
  const name = resolveStatusIcon(presentation.iconName);
  const mark = showIcon ? icon ?? (name ? <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: statusIconMarkup(name) }} /> : null) : null;
  return <Badge {...props} ref={ref} variant={destructive ? 'destructive' : solid ? 'default' : 'secondary'}
    data-oods-component={undefined} data-oods-adapter="StatusBadge" data-status={state} data-domain={domain} data-tone={resolvedTone}
    title={title ?? presentation.description} aria-label={ariaLabel ?? label ?? `Status: ${presentation.label}`}>
    {iconPosition === 'start' ? mark : null}{children ?? content ?? presentation.label}{iconPosition === 'end' ? mark : null}
  </Badge>;
});
