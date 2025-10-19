import * as React from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../base/Badge.js';
import { Button, type ButtonProps } from '../base/Button.js';
import { Text } from '../base/Text.js';
import type { StatusBadgeDescriptor } from '../../modifiers/withStatusBadge.modifier.js';

type HeaderElement = React.ElementRef<'header'>;
type HeaderProps = React.ComponentPropsWithoutRef<'header'>;
type BaseHeaderProps = Omit<HeaderProps, 'children' | 'title'>;

export interface PageHeaderAction extends Omit<ButtonProps, 'children'> {
  readonly id: string;
  readonly label: ReactNode;
}

export interface PageHeaderProps extends BaseHeaderProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly description?: ReactNode;
  readonly badges?: readonly StatusBadgeDescriptor[];
  readonly actions?: readonly PageHeaderAction[];
  readonly metadata?: ReactNode;
}

function renderBadges(badges: readonly StatusBadgeDescriptor[] | undefined) {
  if (!badges || badges.length === 0) {
    return null;
  }

  return badges.map((badge) => (
    <Badge key={badge.id} tone={badge.tone} emphasis="solid" aria-label={badge.label}>
      {badge.label}
    </Badge>
  ));
}

function renderActions(actions: readonly PageHeaderAction[] | undefined) {
  if (!actions || actions.length === 0) {
    return null;
  }

  return actions.map((action) => {
    const { id, label, intent = 'neutral', size = 'md', ...buttonProps } = action;
    return (
      <Button key={id} intent={intent} size={size} {...buttonProps}>
        {label}
      </Button>
    );
  });
}

export const PageHeader = React.forwardRef<HeaderElement, PageHeaderProps>(
  (
    {
      title,
      subtitle,
      description,
      badges,
      actions,
      metadata,
      className,
      ...props
    },
    forwardedRef
  ) => {
    const rootClassName = [
      'flex flex-col gap-4 rounded-xl bg-surface-muted px-6 py-5 shadow-card',
      'dark:bg-slate-900/60',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const headerTextClass = 'text-foreground';
    const subtitleClass =
      'text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300';
    const descriptionClass = 'text-sm text-slate-600 dark:text-slate-400 max-w-2xl';

    return (
      <header ref={forwardedRef} className={rootClassName} {...props}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            {subtitle ? (
              <Text as="span" size="sm" weight="medium" className={subtitleClass}>
                {subtitle}
              </Text>
            ) : null}

            <Text
              as="h1"
              size="lg"
              weight="semibold"
              className={['truncate', headerTextClass].join(' ')}
            >
              {title}
            </Text>

            {description ? (
              <Text as="p" className={descriptionClass}>
                {description}
              </Text>
            ) : null}
          </div>

          {metadata ? <div className="shrink-0 text-sm text-slate-500">{metadata}</div> : null}
        </div>

        {(() => {
          const badgesNode = renderBadges(badges);
          const actionsNode = renderActions(actions);
          if (!badgesNode && !actionsNode) {
            return null;
          }

          return (
            <div className="flex flex-wrap items-center gap-3">
              {badgesNode ? (
                <div className="flex flex-wrap items-center gap-2">{badgesNode}</div>
              ) : null}
              {actionsNode ? (
                <div className="flex flex-wrap items-center gap-2 ml-auto">{actionsNode}</div>
              ) : null}
            </div>
          );
        })()}
      </header>
    );
  }
);

PageHeader.displayName = 'OODS.PageHeader';
