/**
 * @file Pagination token hooks
 * @module components/pagination/tokens
 */

/**
 * Pagination component tokens
 *
 * Maps to design system tokens for:
 * - Interactive states (selected, hover, disabled)
 * - Typography and spacing
 * - High-contrast mode support
 */
export const PAGINATION_TOKENS = {
  fontSize: 'var(--sys-text-scale-label-font-size)',
  fontWeight: 'var(--sys-text-scale-label-font-weight)',
  gap: 'var(--sys-control-gap-compact)',
  paddingBlock: 'var(--sys-control-padding-block)',
  paddingInline: 'var(--sys-control-padding-inline)',
  borderRadius: 'var(--sys-radius-control)',

  // Colors
  colorText: 'var(--sys-text-primary)',
  colorTextDisabled: 'var(--sys-text-disabled)',
  colorTextSelected: 'var(--sys-text-on-interactive)',
  colorBackground: 'transparent',
  // A page button keeps its primary text on hover, so the hover is the subtle fill, not the primary one.
  colorBackgroundHover: 'var(--sys-surface-interactive-secondary-default)',
  colorBackgroundSelected: 'var(--sys-surface-interactive-primary-default)',
  colorBorder: 'var(--sys-border-subtle)',
  colorBorderHover: 'var(--sys-border-strong)',
  focusOutlineColor: 'var(--sys-focus-ring-outer)',
  focusOutlineWidth: 'var(--sys-focus-width)',
} as const;

/**
 * Resolve pagination tokens (currently static, but allows future theming)
 */
export function resolvePaginationTokens() {
  return PAGINATION_TOKENS;
}
