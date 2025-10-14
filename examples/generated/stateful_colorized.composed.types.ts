/**
 * Composed types for: Stateful + Colorized
 *
 * DO NOT EDIT - This file is auto-generated
 */

/**
 * Composed parameter: states
 * Sources: Stateful
 */
export const Composed_Stateful_States = [
  "draft",
  "active",
  "archived",
  "deleted"
] as const;

/**
 * Union type for composed states
 */
export type Stateful_States = (typeof Composed_Stateful_States)[number];

/**
 * Composed parameter: initialState
 * Sources: Stateful
 */
export const Composed_Stateful_InitialState = [
  "draft"
] as const;

/**
 * Union type for composed initialState
 */
export type Stateful_InitialState = (typeof Composed_Stateful_InitialState)[number];

/**
 * Composed parameter: colorScheme
 * Sources: Colorized
 */
export const Composed_Colorized_ColorScheme = [
  "default",
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "info"
] as const;

/**
 * Union type for composed colorScheme
 */
export type Colorized_ColorScheme = (typeof Composed_Colorized_ColorScheme)[number];

