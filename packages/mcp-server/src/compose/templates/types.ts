/**
 * Shared types for layout template functions.
 *
 * Templates produce UiSchema skeletons with named slots.
 * Slots are placeholder UiElements that downstream code
 * (the component selector in s51-m02) replaces with real components.
 */
import type { UiElement, UiSchema } from '../../schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Slot                                                               */
/* ------------------------------------------------------------------ */

/** A named insertion point inside a template. */
export interface Slot {
  /** Unique slot name within the template (e.g. "header", "metrics-grid"). */
  name: string;
  /** Human-readable purpose of the slot. */
  description: string;
  /** Hint about what kind of component fits (used by the selector engine). */
  intent: string;
  /** Whether the slot must be filled for the schema to be useful. */
  required: boolean;
}

/** A UiElement whose `meta.intent` marks it as a slot placeholder. */
export function isSlotElement(el: UiElement): boolean {
  return el.meta?.intent?.startsWith('slot:') ?? false;
}

/* ------------------------------------------------------------------ */
/*  Template result                                                    */
/* ------------------------------------------------------------------ */

export interface TemplateResult {
  /** Valid UiSchema with slot placeholders. */
  schema: UiSchema;
  /** Declared slots that callers can fill. */
  slots: Slot[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DSL_VERSION = '2026.02';

let _counter = 0;

/** Reset the ID counter (for deterministic tests). */
export function resetIdCounter(): void {
  _counter = 0;
}

/** Generate a deterministic, unique element ID. */
export function uid(prefix: string): string {
  return `${prefix}-${++_counter}`;
}

/** Build a minimal UiSchema wrapper around a screen element. */
export function wrapSchema(screen: UiElement, theme?: string): UiSchema {
  return {
    version: DSL_VERSION,
    ...(theme ? { theme } : {}),
    screens: [screen],
  };
}

/** Create a slot placeholder element. */
export function slotElement(
  slotName: string,
  _intent: string,
  component = 'Stack',
): UiElement {
  return {
    id: uid(`slot-${slotName}`),
    component,
    meta: { intent: `slot:${slotName}`, label: slotName },
  };
}
