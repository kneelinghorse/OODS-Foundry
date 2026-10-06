/**
 * The result-state visual family (s205-m03, traits/core/Assessable).
 *
 * A result state — violation, passed, needs review, not applicable, not measured — renders in ONE family that is
 * never the severity family: never red, never green, never scored. Every result state takes the same tone, so the
 * difference between "needs review" and "violation" is carried by the words, and nothing about a non-verdict looks
 * like a failure or a pass. The composer pins it (mcp-server `enforceResultStateFamily`), and a spec fails if any
 * theme scope resolves this tone to a colour a severity tone uses.
 */
export const RESULT_STATES = ['violation', 'passed', 'needs_review', 'not_applicable', 'not_measured'] as const;
export type ResultState = (typeof RESULT_STATES)[number];
/**
 * neutral, measured in s205-m03 across the six scopes the pages render: theme-aware in every one, and in light and
 * dark it shares no surface or text colour with any severity tone. In high contrast every severity tone resolves to
 * the same Canvas/CanvasText pair and differs only by border, and neutral's border is its own. `accent` was the first
 * choice and was refused on measurement: its status tokens are defined for light only, so dark and high contrast
 * render the light-theme chip.
 */
export const RESULT_STATE_TONE = 'neutral' as const;
/** The tones that carry a verdict or a severity; a result state never resolves to any of their colours. */
export const SEVERITY_TONES = ['positive', 'success', 'warning', 'critical', 'danger'] as const;
