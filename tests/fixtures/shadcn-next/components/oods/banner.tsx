import * as React from 'react';
import type { BannerProps } from '@oods/components-react';
import { getStatusPresentation, resolveStatusIcon, statusIconMarkup } from '@oods/component-contracts';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const OodsBanner = React.forwardRef<HTMLDivElement, BannerProps>(function OodsBanner(
  { title, detail, description, content, children, status, domain = 'subscription', tone, emphasis = 'subtle', icon,
    showIcon, actions, onDismiss, dismissLabel = 'Dismiss notification', ...props }, ref,
) {
  const presentation = status ? getStatusPresentation(domain, status) : undefined;
  const resolvedTone = tone ?? presentation?.tone ?? 'neutral';
  const critical = resolvedTone === 'critical' || resolvedTone === 'danger';
  const heading = title ?? presentation?.label ?? status;
  const body = detail ?? description ?? children ?? content ?? presentation?.description;
  const name = resolveStatusIcon(presentation?.iconName);
  const mark = icon ?? (name ? <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: statusIconMarkup(name) }} /> : null);
  return <Alert {...props} ref={ref} variant={critical ? 'destructive' : 'default'} role={critical ? 'alert' : 'status'}
    aria-live={critical ? 'assertive' : 'polite'} data-oods-component={undefined} data-oods-adapter="Banner" data-tone={resolvedTone} data-emphasis={emphasis}>
    {(showIcon ?? Boolean(mark)) ? mark : null}{heading ? <AlertTitle>{heading}</AlertTitle> : null}
    {body ? <AlertDescription>{body}</AlertDescription> : null}{actions}
    {onDismiss ? <Button type="button" variant="ghost" aria-label={dismissLabel} onClick={onDismiss}>×</Button> : null}
  </Alert>;
});
