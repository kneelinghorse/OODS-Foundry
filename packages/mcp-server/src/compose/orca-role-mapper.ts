/**
 * ORCA role → OODS intent mapper.
 *
 * Stage1 `orca_candidates.json` attaches a free-form `role` string to each
 * discovered object. Values observed on the first real Stage1 run
 * (linear.app, aa22b12d) included: button, card, list, navigation, input,
 * section, aside, dialog, form, header, main, article, footer, unknown.
 *
 * Stage1 Sprint 40 Strategy 1d extends the ORCA inference to cover three
 * additional role values: `page`, `svg-primitive`, and an extended `media`
 * variant (still covering avatars/images/video). Roles stay free-form strings,
 * so the ORCA contract is backward-compatible — but the OODS consumer needs
 * explicit coverage so the post-S40 run doesn't silently drop composed nodes.
 *
 * This module is the single source of truth for `role → intent` resolution.
 * Future consumers (component-selector fallback, map.create enrichment,
 * design.compose node attachment) should call {@link resolveRoleToIntent} to
 * obtain an INTENT_MAP-compatible intent plus a fallback signal.
 *
 * @see docs/integration/stage1-oods-contract.md §2 (Composition Hints)
 */

/**
 * Canonical OODS intent string (must be a key of INTENT_MAP in
 * `component-selector.ts`).
 */
export type OodsIntent =
  | 'action-button'
  | 'text-input'
  | 'search-input'
  | 'form-input'
  | 'boolean-input'
  | 'enum-input'
  | 'date-input'
  | 'email-input'
  | 'long-text-input'
  | 'data-table'
  | 'data-display'
  | 'data-list'
  | 'metrics-display'
  | 'status-indicator'
  | 'page-header'
  | 'navigation-panel'
  | 'filter-control'
  | 'pagination-control'
  | 'metadata-display'
  | 'tab-panel';

/** Result of resolving an ORCA role. */
export interface RoleResolution {
  /** The input role (lower-cased, trimmed) — `null` when no role was provided. */
  role: string | null;
  /** The OODS intent chosen for this role. */
  intent: OodsIntent;
  /**
   * `true` when the role was unknown/missing and the generic fallback intent
   * was used. Consumers should treat this as a signal to keep the node but
   * emit a diagnostic (e.g., `metadata.unresolvedRole = role`) rather than
   * drop it.
   */
  fallback: boolean;
  /** Human-readable rationale, useful for debugging and telemetry. */
  reason: string;
}

/**
 * Default intent for roles that are neither explicitly mapped nor expected.
 *
 * `data-display` is intentionally generic: it lands on Card/Stack/Text, which
 * are structurally safe containers for unknown node shapes. Pairing this with
 * `fallback: true` lets consumers decide whether to warn or pass through.
 */
export const ORCA_ROLE_FALLBACK_INTENT: OodsIntent = 'data-display';

/**
 * Explicit handlers for every ORCA role value the OODS consumer is expected
 * to encounter. Populated from:
 *   - Stage1 S38/S39 observed roles on linear.app (14 values incl. `unknown`)
 *   - Stage1 S40 Strategy 1d new/extended values (`page`, `svg-primitive`,
 *     extended `media`)
 *
 * The `reason` copy is intentionally short; it surfaces in telemetry when a
 * consumer logs role resolution.
 */
const ORCA_ROLE_HANDLERS: Record<string, { intent: OodsIntent; reason: string }> = {
  // --- Observed on linear.app (S38/S39) -------------------------------------
  button: { intent: 'action-button', reason: 'ORCA button → interactive action' },
  card: { intent: 'data-display', reason: 'ORCA card → surfaced content container' },
  list: { intent: 'data-list', reason: 'ORCA list → iterable collection' },
  navigation: { intent: 'navigation-panel', reason: 'ORCA navigation → nav/tabs' },
  input: { intent: 'form-input', reason: 'ORCA input → form control' },
  section: { intent: 'data-display', reason: 'ORCA section → grouped content' },
  aside: { intent: 'metadata-display', reason: 'ORCA aside → ancillary metadata' },
  dialog: { intent: 'data-display', reason: 'ORCA dialog → modal/surface container' },
  form: { intent: 'form-input', reason: 'ORCA form → submittable form block' },
  header: { intent: 'page-header', reason: 'ORCA header → page/section heading' },
  main: { intent: 'data-display', reason: 'ORCA main → primary content region' },
  article: { intent: 'data-display', reason: 'ORCA article → standalone content' },
  footer: { intent: 'metadata-display', reason: 'ORCA footer → metadata / legal' },
  unknown: {
    intent: ORCA_ROLE_FALLBACK_INTENT,
    reason: 'ORCA unknown → generic container (role not inferred)',
  },

  // --- Stage1 S40 Strategy 1d additions -------------------------------------
  /** Page-root container introduced for route-level DOM nodes. */
  page: { intent: 'data-display', reason: 'ORCA page → top-level route container' },
  /**
   * Decorative SVG primitive (icon/mark). Maps to `data-display` so the node is
   * kept and rendered by Text/Stack fallback; consumers wanting to render
   * actual glyphs should read `metadata.mediaKind = 'svg-primitive'` and pick
   * an icon component explicitly.
   */
  'svg-primitive': {
    intent: 'data-display',
    reason: 'ORCA svg-primitive → decorative glyph (decorative container)',
  },
  /**
   * Extended media role: avatars, images, video, audio thumbnails. No
   * dedicated `media-display` intent exists today — `data-display` keeps the
   * node composable while a future media-focused intent can be added without
   * breaking the contract.
   */
  media: { intent: 'data-display', reason: 'ORCA media → image/video surface' },

  // --- Observed post-S40 vocabulary (linear.app 5e3a5dbf / stripe.com 09145d03)
  // Stage1 emits these in reconciliation_report.candidate_objects[].inferred_role.
  // They were not in the S40 contract doc but appear on real runs; adding
  // explicit handlers keeps the "no silent drop" invariant intact.
  text: { intent: 'data-display', reason: 'ORCA text → textual content node' },
  'data-display': {
    intent: 'data-display',
    reason: 'ORCA data-display → already an OODS intent; pass-through',
  },
  'form-control': { intent: 'form-input', reason: 'ORCA form-control → form control (individual input)' },
  badge: { intent: 'status-indicator', reason: 'ORCA badge → status/label badge' },
  link: { intent: 'action-button', reason: 'ORCA link → navigational action' },
  action: { intent: 'action-button', reason: 'ORCA action → generic interactive action' },
};

/**
 * Readonly list of every role value the mapper handles explicitly.
 * Useful for contract tests and for building Stage1-side telemetry.
 */
export const ORCA_ROLES_EXPLICITLY_HANDLED: readonly string[] = Object.freeze(
  Object.keys(ORCA_ROLE_HANDLERS),
);

/**
 * Role values introduced by Stage1 Sprint 40 Strategy 1d. Exported so contract
 * tests can assert the post-S40 surface is covered without hard-coding the
 * list in multiple places.
 */
export const ORCA_ROLES_S40_NEW: readonly string[] = Object.freeze([
  'page',
  'svg-primitive',
  'media',
]);

/**
 * Resolve an ORCA role to an OODS intent.
 *
 * Rules:
 * 1. `null`/`undefined`/empty → fallback intent, `fallback: true`.
 * 2. Trim + lowercase lookup against {@link ORCA_ROLE_HANDLERS}.
 * 3. Miss → fallback intent, `fallback: true`, reason names the raw role so
 *    unresolved cases are visible in telemetry rather than silently dropped.
 *
 * The resolver never throws and never returns `null`: callers can attach the
 * returned intent directly to a composed node.
 */
export function resolveRoleToIntent(role: string | null | undefined): RoleResolution {
  if (role === null || role === undefined) {
    return {
      role: null,
      intent: ORCA_ROLE_FALLBACK_INTENT,
      fallback: true,
      reason: 'no role supplied → generic container',
    };
  }

  const normalized = role.trim().toLowerCase();
  if (normalized.length === 0) {
    return {
      role: null,
      intent: ORCA_ROLE_FALLBACK_INTENT,
      fallback: true,
      reason: 'empty role string → generic container',
    };
  }

  const handler = ORCA_ROLE_HANDLERS[normalized];
  if (handler) {
    return {
      role: normalized,
      intent: handler.intent,
      fallback: false,
      reason: handler.reason,
    };
  }

  return {
    role: normalized,
    intent: ORCA_ROLE_FALLBACK_INTENT,
    fallback: true,
    reason: `unknown ORCA role "${normalized}" → generic container`,
  };
}

/**
 * Convenience predicate used by consumers that want to detect "this role will
 * fall through to the generic container" without repeating resolver state.
 */
export function isKnownOrcaRole(role: string | null | undefined): boolean {
  if (role === null || role === undefined) return false;
  return Object.prototype.hasOwnProperty.call(
    ORCA_ROLE_HANDLERS,
    role.trim().toLowerCase(),
  );
}
