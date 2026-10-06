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

// The layout widths (36rem, 16rem) and the fixed icon geometry (a 48px disc, a 24px glyph, round) stay literal: they are
// structure, on the 4px ramp, not chrome.
const BASE_TOKENS = {
  containerPadding: 'var(--sys-stack-xl)',
  containerPaddingMobile: 'var(--sys-inset-md)',
  containerMaxWidth: '36rem',
  containerGap: 'var(--sys-stack-md)',
  contentGap: 'var(--sys-stack-sm)',
  illustrationGap: 'var(--sys-stack-md)',
  illustrationMaxWidth: '16rem',
  iconSize: '3rem',
  iconGap: 'var(--sys-stack-md)',
  iconBorderRadius: '50%',
  iconGlyphSize: '1.5rem',
  headlineColor: 'var(--sys-text-primary)',
  headlineFontSize: 'var(--sys-text-scale-heading-md-font-size)',
  headlineFontWeight: 'var(--sys-text-scale-heading-md-font-weight)',
  headlineLineHeight: 'var(--sys-text-scale-heading-md-line-height)',
  bodyColor: 'var(--sys-text-muted)',
  bodyFontSize: 'var(--sys-text-scale-body-sm-font-size)',
  bodyLineHeight: 'var(--sys-text-scale-body-sm-line-height)',
  actionsGap: 'var(--sys-control-gap)',
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
