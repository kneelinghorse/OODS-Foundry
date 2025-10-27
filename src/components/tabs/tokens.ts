/**
 * @file Tabs token resolution
 * @module components/tabs/tokens
 */

import type { TabsSize } from './types.js';

const FONT_SIZE_MAP: Record<TabsSize, string> = {
  sm: 'var(--sys-text-scale-body-sm-font-size, 0.875rem)',
  md: 'var(--sys-text-scale-label-md-font-size, 0.9375rem)',
  lg: 'var(--sys-text-scale-body-md-font-size, 1rem)',
} as const;

const FONT_WEIGHT = 'var(--sys-text-scale-label-md-font-weight, 600)';

const PADDING_BLOCK_MAP: Record<TabsSize, string> = {
  sm: 'calc(var(--sys-space-stack-compact, 0.5rem) * 0.6)',
  md: 'var(--sys-space-stack-compact, 0.5rem)',
  lg: 'calc(var(--sys-space-stack-compact, 0.5rem) * 1.2)',
} as const;

const PADDING_INLINE_MAP: Record<TabsSize, string> = {
  sm: 'var(--sys-space-inline-xs, 0.75rem)',
  md: 'var(--sys-space-inline-sm, 1rem)',
  lg: 'calc(var(--sys-space-inline-sm, 1rem) * 1.2)',
} as const;

/** Resolve CSS custom properties for tabs */
export function resolveTabsTokens(size: TabsSize) {
  return {
    fontSize: FONT_SIZE_MAP[size],
    fontWeight: FONT_WEIGHT,
    paddingBlock: PADDING_BLOCK_MAP[size],
    paddingInline: PADDING_INLINE_MAP[size],
  };
}
