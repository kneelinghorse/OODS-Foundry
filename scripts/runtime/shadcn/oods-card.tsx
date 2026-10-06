import * as React from 'react';
import type { CardProps } from '@oods/components-react';
import { Card } from '@/registry/new-york-v4/ui/card';

export const OodsCard = React.forwardRef<HTMLElement, CardProps>(function OodsCard(
  { as = 'div', elevated = false, className, children, ...props }, ref,
) {
  const classes = ['px-4', elevated ? 'shadow-lg' : 'shadow-none', className].filter(Boolean).join(' ');
  if (as === 'div') return <Card {...props} ref={ref as React.Ref<HTMLDivElement>} className={classes} data-oods-component={undefined} data-oods-adapter="Card">{children}</Card>;
  const Tag = as;
  return <Tag {...props} ref={ref} data-oods-component={undefined} data-oods-adapter="Card"><Card className={classes}>{children}</Card></Tag>;
});
