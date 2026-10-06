import * as React from 'react';
import type { CardHeaderProps, HeaderElement } from '@oods/components-react';
import { CardHeader, CardTitle, CardDescription } from '@/registry/new-york-v4/ui/card';

export const OodsCardHeader = React.forwardRef<HTMLElement, CardHeaderProps>(function OodsCardHeader(
  { title, label, text, supporting, supportingText, subtitle, description, level, as, children, className, ...props }, ref,
) {
  const firstText = (...values: Array<string | undefined>) => values.find(value => value?.trim());
  const flatten = (value: React.ReactNode): React.ReactNode[] => React.Children.toArray(value).flatMap(node => React.isValidElement<{ children?: React.ReactNode }>(node) && node.type === React.Fragment ? flatten(node.props.children) : [node]);
  const nodes = flatten(children);
  const authored = nodes.some(node => typeof node !== 'string' && typeof node !== 'number');
  const scalar = authored ? undefined : nodes.join('');
  const heading = scalar?.trim() ? scalar : firstText(title, label, text) ?? 'Card';
  const details = firstText(supporting, supportingText, subtitle, description);
  const Heading = (as && /^h[1-6]$/.test(as) ? as : `h${Number.isFinite(level) ? Math.max(1, Math.min(6, Math.trunc(level!))) : 2}`) as HeaderElement;
  return <header {...props} ref={ref} className={className} data-oods-component={undefined} data-oods-adapter="CardHeader">
    <CardHeader>{authored ? children : <>
      <CardTitle><Heading>{heading}</Heading></CardTitle>
      {details && details.trim() !== heading.trim() ? <CardDescription data-oods-supporting="true">{details}</CardDescription> : null}
    </>}</CardHeader>
  </header>;
});
