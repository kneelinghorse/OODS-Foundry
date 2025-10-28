/**
 * @file EmptyState design token resolver
 * @module components/empty-state/tokens
 */

import { getToneTokenSet, type StatusTone } from '../statusables/statusRegistry.js';

export interface EmptyStateTokenSet {
  readonly tone: StatusTone;
  readonly containerPadding: string;
  readonly containerPaddingMobile: string;
  readonly containerMaxWidth: string;
  readonly containerGap: string;
  readonly contentGap: string;
  readonly illustrationGap: string;
  readonly illustrationMaxWidth: string;
  readonly iconSize: string;
  readonly iconGap: string;
  readonly iconBorderRadius: string;
  readonly iconGlyphSize: string;
  readonly iconBackground: string;
  readonly iconForeground: string;
  readonly iconBorder: string;
  readonly headlineColor: string;
  readonly headlineFontSize: string;
  readonly headlineFontWeight: string;
  readonly headlineLineHeight: string;
  readonly bodyColor: string;
  readonly bodyFontSize: string;
  readonly bodyLineHeight: string;
  readonly actionsGap: string;
}

const BASE_TOKENS = {
  containerPadding: 'var(--cmp-spacing-inset-spacious, var(--sys-spacing-inset-xl, 2rem))',
  containerPaddingMobile: 'var(--cmp-spacing-inset-default, var(--sys-spacing-inset-md, 1.5rem))',
  containerMaxWidth: '36rem',
  containerGap: 'var(--cmp-spacing-stack-default, 1.5rem)',
  contentGap: 'var(--cmp-spacing-stack-compact, 0.75rem)',
  illustrationGap: 'var(--cmp-spacing-stack-default, 1.5rem)',
  illustrationMaxWidth: '16rem',
  iconSize: '3rem',
  iconGap: 'var(--cmp-spacing-stack-compact, 1rem)',
  iconBorderRadius: 'var(--sys-shape-radius-circle, 50%)',
  iconGlyphSize: '1.5rem',
  headlineColor: 'var(--cmp-text-body, var(--sys-color-text-primary))',
  headlineFontSize: 'var(--sys-font-size-heading-md, 1.25rem)',
  headlineFontWeight: 'var(--sys-font-weight-semibold, 600)',
  headlineLineHeight: 'var(--sys-font-lineheight-heading, 1.3)',
  bodyColor: 'var(--cmp-text-muted, var(--sys-color-text-secondary))',
  bodyFontSize: 'var(--sys-font-size-body-md, 0.875rem)',
  bodyLineHeight: 'var(--sys-font-lineheight-body, 1.5)',
  actionsGap: 'var(--cmp-spacing-inline-sm, 0.75rem)',
} as const;

/**
 * Resolve token hooks for the EmptyState component.
 * Ensures tone-based color slots align with Statusables token governance.
 */
export function resolveEmptyStateTokens(tone: StatusTone = 'neutral'): EmptyStateTokenSet {
  const toneTokens = getToneTokenSet(tone);

  return {
    tone,
    ...BASE_TOKENS,
    iconBackground: toneTokens.background,
    iconForeground: toneTokens.foreground,
    iconBorder: toneTokens.border,
  };
}
