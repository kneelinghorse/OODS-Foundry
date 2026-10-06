/**
 * The breakpoint scale, in JS, read from the token bundle (s173 m02/m03).
 *
 * There are three places a breakpoint number can appear, and they must be the same number:
 * Tailwind's generated `screens` (tailwind.config.ts), the `@container` literals in
 * `src/styles/domain-contexts.css`, and JS that has to make the same decision at runtime
 * (the contextPanel drawer). Only the first two can be generated; this module is how the
 * third one avoids being a typed-in copy.
 *
 * FAIL LOUD, at import: a missing token throws rather than defaulting. The token bundle is
 * a build artifact of this repo, so a missing value means `pnpm build:tokens` was not run —
 * a build-time mistake, and one that a silently-defaulted 768 would hide until a designer
 * changed the scale and nothing moved.
 */
import tokensBundle from '@oods/tokens';

export type BreakpointKey = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export function breakpointPx(key: BreakpointKey): number {
  const flat = (tokensBundle?.flatTokens ?? {}) as Record<string, { value?: unknown }>;
  const value = flat[`sys-breakpoint-${key}`]?.value;
  if (typeof value !== 'number') {
    throw new Error(
      `sys.breakpoint.${key} is missing from the @oods/tokens bundle — run \`pnpm build:tokens\`.`,
    );
  }
  return value;
}

/**
 * The width at which a view context collapses to a single column, in px.
 *
 * The CSS says `@container view-shell (max-width: 48rem)`; 48rem is this number at the
 * 16px root size, and tests/tokens/breakpoint-keep-in-step.test.ts is what keeps the two
 * spellings honest. The drawer reads THIS one so it opens at the same width the rail
 * disappears at — a drawer that appeared at a different width than the collapse would be
 * worse than no drawer.
 */
export const VIEW_COLLAPSE_PX = breakpointPx('md');
