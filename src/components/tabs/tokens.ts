/**
 * @file Tabs token resolution
 * @module components/tabs/tokens
 */

import type { TabsSize } from './types.js';

const FONT_SIZE_MAP: Record<TabsSize, string> = {
  sm: 'var(--sys-text-scale-body-sm-font-size)',
  md: 'var(--sys-text-scale-label-md-font-size)',
  lg: 'var(--sys-text-scale-body-md-font-size)',
} as const;

const FONT_WEIGHT = 'var(--sys-text-scale-label-md-font-weight)';

const PADDING_BLOCK_MAP: Record<TabsSize, string> = {
  sm: 'var(--sys-tab-padding-block-sm)',
  md: 'var(--sys-tab-padding-block-md)',
  lg: 'var(--sys-tab-padding-block-lg)',
} as const;

const PADDING_INLINE_MAP: Record<TabsSize, string> = {
  sm: 'var(--sys-tab-padding-inline-sm)',
  md: 'var(--sys-tab-padding-inline-md)',
  lg: 'var(--sys-tab-padding-inline-lg)',
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
