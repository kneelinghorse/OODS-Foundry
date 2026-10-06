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
  fontSize: 'var(--sys-text-scale-body-sm-font-size)',
  fontWeight: 'var(--sys-text-scale-body-sm-font-weight)',
  gap: 'var(--sys-control-gap-compact)',
  paddingBlock: 'var(--sys-control-padding-block)',
  paddingInline: 'var(--sys-control-padding-inline-xs)',

  // Colors
  colorText: 'var(--sys-text-primary)',
  colorTextDisabled: 'var(--sys-text-disabled)',
  colorTextCurrent: 'var(--sys-text-primary)',
  colorLink: 'var(--sys-text-accent)',
  colorLinkHover: 'var(--sys-text-accent)',
  colorSeparator: 'var(--sys-text-secondary)',
  focusOutlineColor: 'var(--sys-focus-ring-outer)',
  focusOutlineWidth: 'var(--sys-focus-width)',
} as const;

/**
 * Resolve breadcrumbs tokens (currently static, but allows future theming)
 */
export function resolveBreadcrumbsTokens() {
  return BREADCRUMBS_TOKENS;
}
