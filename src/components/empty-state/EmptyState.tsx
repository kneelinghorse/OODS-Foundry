import * as React from 'react';
import type { ReactNode } from 'react';
import {
  getStatusPresentation,
  type StatusDomain,
  type StatusTone,
} from '../statusables/statusRegistry.js';
import { resolveStatusGlyph } from '../statusables/statusGlyph.js';
import { resolveEmptyStateTokens } from './tokens.js';

export type EmptyStateIntent = 'info' | 'success' | 'warning' | 'neutral';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly illustration?: ReactNode;
  readonly icon?: ReactNode;
  readonly headline: ReactNode;
  readonly body?: ReactNode;
  readonly primaryAction?: ReactNode;
  readonly secondaryAction?: ReactNode;
  readonly actions?: ReactNode;
  readonly intent?: EmptyStateIntent;
  readonly status?: string;
  readonly domain?: StatusDomain;
  readonly headlineLevel?: HeadlineLevel;
}

type EmptyStateElement = React.ElementRef<'div'>;
type HeadlineLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const DEFAULT_DOMAIN: StatusDomain = 'subscription';

const INTENT_TO_TONE: Record<EmptyStateIntent, StatusTone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  neutral: 'neutral',
};

export const EmptyState = React.forwardRef<EmptyStateElement, EmptyStateProps>(
  (
    {
      illustration,
      icon,
      headline,
      body,
      primaryAction,
      secondaryAction,
      actions,
      intent = 'neutral',
      status,
      domain: domainProp,
      className,
      headlineLevel = 'h2',
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const domain = (domainProp ?? DEFAULT_DOMAIN) as StatusDomain;
    const statusPresentation = React.useMemo(
      () => (status ? getStatusPresentation(domain, status) : undefined),
      [domain, status]
    );
    const tone: StatusTone = statusPresentation?.tone ?? INTENT_TO_TONE[intent] ?? 'neutral';
    const tokens = React.useMemo(() => resolveEmptyStateTokens(tone), [tone]);
    const resolvedIcon =
      icon ??
      (statusPresentation?.iconName ? resolveStatusGlyph(statusPresentation.iconName) : undefined);
    const rootClassName = className ? `empty-state ${className}` : 'empty-state';
    const styleVariables = React.useMemo<Record<string, string>>(
      () => ({
        '--empty-state-padding': tokens.containerPadding,
        '--empty-state-padding-mobile': tokens.containerPaddingMobile,
        '--empty-state-max-width': tokens.containerMaxWidth,
        '--empty-state-gap': tokens.containerGap,
        '--empty-state-content-gap': tokens.contentGap,
        '--empty-state-illustration-gap': tokens.illustrationGap,
        '--empty-state-illustration-max-width': tokens.illustrationMaxWidth,
        '--empty-state-icon-size': tokens.iconSize,
        '--empty-state-icon-gap': tokens.iconGap,
        '--empty-state-icon-border-radius': tokens.iconBorderRadius,
        '--empty-state-icon-font-size': tokens.iconGlyphSize,
        '--empty-state-icon-background': tokens.iconBackground,
        '--empty-state-icon-foreground': tokens.iconForeground,
        '--empty-state-icon-border': tokens.iconBorder,
        '--empty-state-headline-color': tokens.headlineColor,
        '--empty-state-headline-font-size': tokens.headlineFontSize,
        '--empty-state-headline-font-weight': tokens.headlineFontWeight,
        '--empty-state-headline-line-height': tokens.headlineLineHeight,
        '--empty-state-body-color': tokens.bodyColor,
        '--empty-state-body-font-size': tokens.bodyFontSize,
        '--empty-state-body-line-height': tokens.bodyLineHeight,
        '--empty-state-actions-gap': tokens.actionsGap,
      }),
      [tokens]
    );
    const mergedStyle = React.useMemo<React.CSSProperties>(
      () => ({
        ...styleVariables,
        ...(style ?? {}),
      }),
      [style, styleVariables]
    );
    const hasActions = Boolean(primaryAction || secondaryAction || actions);
    const actionNodes: React.ReactNode[] = React.useMemo(() => {
      const nodes: React.ReactNode[] = [];

      if (primaryAction) {
        nodes.push(
          <div key="primary" className="empty-state__action empty-state__action--primary">
            {primaryAction}
          </div>
        );
      }

      if (secondaryAction) {
        nodes.push(
          <div key="secondary" className="empty-state__action empty-state__action--secondary">
            {secondaryAction}
          </div>
        );
      }

      if (actions) {
        nodes.push(
          <div key="custom" className="empty-state__action empty-state__action--custom">
            {actions}
          </div>
        );
      }

      return nodes;
    }, [actions, primaryAction, secondaryAction]);

    const HeadlineTag = headlineLevel;

    return (
      <div
        ref={forwardedRef}
        className={rootClassName}
        data-intent={intent}
        data-tone={tokens.tone}
        data-status={status ?? undefined}
        data-status-domain={status ? domain : undefined}
        style={mergedStyle}
        {...rest}
      >
        {illustration ? (
          <div className="empty-state__illustration" aria-hidden>
            {illustration}
          </div>
        ) : null}

        {resolvedIcon ? (
          <div className="empty-state__icon" aria-hidden data-tone={tokens.tone}>
            {resolvedIcon}
          </div>
        ) : null}

        <div className="empty-state__content">
          <HeadlineTag className="empty-state__headline">{headline}</HeadlineTag>
          {body ? <p className="empty-state__body">{body}</p> : null}
        </div>

        {hasActions ? <div className="empty-state__actions">{actionNodes}</div> : null}
      </div>
    );
  }
);

EmptyState.displayName = 'OODS.EmptyState';
