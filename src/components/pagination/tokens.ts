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
  fontSize: 'var(--font-size-body-md, 0.875rem)',
  fontWeight: 'var(--font-weight-medium, 500)',
  gap: 'var(--spacing-inline-xs, 0.25rem)',
  paddingBlock: 'var(--spacing-squish-block-sm, 0.375rem)',
  paddingInline: 'var(--spacing-squish-inline-sm, 0.75rem)',
  borderRadius: 'var(--border-radius-md, 0.25rem)',

  // Colors
  colorText: 'var(--cmp-text-body, var(--sys-text-primary))',
  colorTextDisabled: 'var(--cmp-text-disabled, var(--sys-text-disabled))',
  colorTextSelected: 'var(--cmp-text-on_action, var(--sys-text-on_interactive))',
  colorBackground: 'var(--cmp-surface-canvas, transparent)',
  colorBackgroundHover:
    'var(--cmp-surface-action_hover, var(--sys-surface-interactive-primary-hover))',
  colorBackgroundSelected:
    'var(--cmp-surface-action, var(--sys-surface-interactive-primary-default))',
  colorBorder: 'var(--cmp-border-default, var(--sys-border-subtle))',
  colorBorderHover: 'var(--cmp-border-strong, var(--sys-border-strong))',
  focusOutlineColor: 'var(--cmp-focus-text, var(--sys-focus-text))',
  focusOutlineWidth: 'var(--cmp-focus-width, var(--sys-focus-width))',
} as const;

/**
 * Resolve pagination tokens (currently static, but allows future theming)
 */
export function resolvePaginationTokens() {
  return PAGINATION_TOKENS;
}
