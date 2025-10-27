/**
 * @file Breadcrumbs token hooks
 * @module components/breadcrumbs/tokens
 */

/**
 * Breadcrumbs component tokens
 *
 * Maps to design system tokens for:
 * - Typography and spacing
 * - Interactive link states
 * - Separator styling
 * - High-contrast mode support
 */
export const BREADCRUMBS_TOKENS = {
  fontSize: 'var(--font-size-body-sm, 0.813rem)',
  fontWeight: 'var(--font-weight-regular, 400)',
  gap: 'var(--spacing-inline-xs, 0.25rem)',
  paddingBlock: 'var(--spacing-squish-block-xs, 0.25rem)',
  paddingInline: 'var(--spacing-squish-inline-xs, 0.5rem)',

  // Colors
  colorText: 'var(--cmp-text-body, var(--sys-text-primary))',
  colorTextDisabled: 'var(--cmp-text-disabled, var(--sys-text-disabled))',
  colorTextCurrent: 'var(--cmp-text-body, var(--sys-text-primary))',
  colorLink: 'var(--cmp-text-action, var(--sys-text-interactive-primary))',
  colorLinkHover:
    'var(--cmp-text-action_hover, var(--sys-text-interactive-primary-hover))',
  colorSeparator: 'var(--cmp-text-subtle, var(--sys-text-secondary))',
  focusOutlineColor: 'var(--cmp-focus-text, var(--sys-focus-text))',
  focusOutlineWidth: 'var(--cmp-focus-width, var(--sys-focus-width))',
} as const;

/**
 * Resolve breadcrumbs tokens (currently static, but allows future theming)
 */
export function resolveBreadcrumbsTokens() {
  return BREADCRUMBS_TOKENS;
}
