/**
 * Single source of truth for the layout vocabulary.
 *
 * Every site that declares a layout — design.compose (input + internal
 * detection), slot-expander, pipeline, .oodsrc config — imports `LayoutType`
 * / `LayoutInput` from here, and the AJV input enums are pinned to
 * `LAYOUT_INPUT_VALUES` by a contract test (layout-single-source.spec.ts).
 * Adding a layout is therefore one edit here: the exhaustive
 * `Record<LayoutType, …>` maps in design.compose force a compile error and the
 * enum-parity test fails until the JSON schemas are updated to match.
 *
 * `auto` is an input-only sentinel meaning "detect the layout from intent",
 * not a real template — so it lives in `LAYOUT_INPUT_VALUES` but not in
 * `LAYOUT_TYPES`.
 */

/** The real layout templates, in detection-priority order. */
export const LAYOUT_TYPES = [
  'dashboard',
  'form',
  'detail',
  'list',
  'card',
  'timeline',
  'landing',
] as const;

export type LayoutType = (typeof LAYOUT_TYPES)[number];

/** Accepted layout *inputs*: the real layouts plus the `auto` detect sentinel. */
export const LAYOUT_INPUT_VALUES = [...LAYOUT_TYPES, 'auto'] as const;

export type LayoutInput = (typeof LAYOUT_INPUT_VALUES)[number];

/** True when `value` is a usable layout-input string. */
export function isLayoutInput(value: unknown): value is LayoutInput {
  return typeof value === 'string' && (LAYOUT_INPUT_VALUES as readonly string[]).includes(value);
}
