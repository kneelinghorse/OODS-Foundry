/**
 * s167 m02 — the brand → semantic bridge (memo SS3 D8).
 *
 * WHY A BRIDGE IS THE DELIVERABLE
 * ------------------------------
 * Brand token values on their own are INERT. `src/tokens/themes/theme0/*.json` declares
 * the flat consumer namespace — `theme.surface.canvas`, `theme.text.primary`, … — and
 * resolves every one of them to the brand-agnostic reference palette
 * (`{ref.color.neutral.50}`, `{ref.color.primary.600}`, …). Measured on the shipped CSS:
 * 377 semantic declarations (`--theme-*`, `--sys-*`, `--cmp-*`) and ZERO of them
 * reference any `--oods-color-brand-*` variable.
 *
 * So emitting `[data-brand]` blocks over the brand namespace alone would change ZERO
 * pixels — the brand vars would go on resolving only to each other. What makes
 * `data-brand` mean anything is re-assigning the SHARED consumer slots from the scope's
 * brand values, which is what this table does.
 *
 * VALUES ARE EMITTED AS LITERALS, NOT `var()` REFERENCES
 * -----------------------------------------------------
 * `--theme-surface-canvas: var(--oods-color-brand-a-surface-canvas)` would also work in
 * a browser — a `var()` resolves at computed-value time and would follow the scoped
 * override — and it would collapse the matrix to one block per brand. It is deliberately
 * NOT what we do, for two reasons: the per-cell literal is what lets the artifact-level
 * test verify each cell WITHOUT a CSS engine (it loads only tokens.css), and a matrix of
 * six identical `var()` texts makes "no cell carries another cell's value" unfalsifiable.
 *
 * THE SLOT LIST IS A FROZEN CONSUMER CONTRACT
 * -------------------------------------------
 * The 41 slot names were captured from the former hand-authored mapping and are now
 * carried by `tests/tokens/__fixtures__/brand-css-slot-contract.json`. s178 m02 deleted
 * `apps/explorer/src/styles/brand.css` after the final three focus slots gained tokens;
 * every frozen slot is mapped below. s206 m01 added the four accent status slots (45), in
 * the fixture and here together.
 */

/**
 * The authored mapping: consumer slot -> the brand token that supplies it, written
 * relative to the brand (full path is `color.brand.<BRAND>.<tokenPath>`).
 *
 * Written out in full rather than derived by string transform. The correspondence
 * happens to be regular, but it is a design decision per slot — deriving it would hide
 * which slots are deliberately mapped.
 */
export const SEMANTIC_BRIDGE = Object.freeze([
  // surfaces
  { slot: '--theme-surface-canvas', tokenPath: 'surface.canvas' },
  { slot: '--theme-surface-raised', tokenPath: 'surface.raised' },
  { slot: '--theme-surface-subtle', tokenPath: 'surface.subtle' },
  { slot: '--theme-surface-disabled', tokenPath: 'surface.disabled' },
  { slot: '--theme-surface-backdrop', tokenPath: 'surface.backdrop' },
  { slot: '--theme-surface-inverse', tokenPath: 'surface.inverse' },
  { slot: '--theme-surface-interactive-primary-default', tokenPath: 'surface.interactive.primary.default' },
  { slot: '--theme-surface-interactive-primary-hover', tokenPath: 'surface.interactive.primary.hover' },
  { slot: '--theme-surface-interactive-primary-pressed', tokenPath: 'surface.interactive.primary.pressed' },
  // s222-m01 (#2502 ruling 11): the secondary (subtle fill) and destructive actions get their own fills.
  { slot: '--theme-surface-interactive-secondary-default', tokenPath: 'surface.interactive.secondary.default' },
  { slot: '--theme-surface-interactive-secondary-hover', tokenPath: 'surface.interactive.secondary.hover' },
  { slot: '--theme-surface-interactive-secondary-pressed', tokenPath: 'surface.interactive.secondary.pressed' },
  { slot: '--theme-surface-interactive-destructive-default', tokenPath: 'surface.interactive.destructive.default' },
  { slot: '--theme-surface-interactive-destructive-hover', tokenPath: 'surface.interactive.destructive.hover' },
  { slot: '--theme-surface-interactive-destructive-pressed', tokenPath: 'surface.interactive.destructive.pressed' },

  // borders
  { slot: '--theme-border-subtle', tokenPath: 'border.subtle' },
  { slot: '--theme-border-strong', tokenPath: 'border.strong' },
  // s222-m01 (#2502 ruling 7): control borders, graded at 3:1 against the surfaces controls sit on.
  { slot: '--theme-border-interactive', tokenPath: 'border.interactive' },
  { slot: '--theme-border-interactive-hover', tokenPath: 'border.interactiveHover' },

  // focus
  { slot: '--theme-focus-ring-outer', tokenPath: 'focus.ring.outer' },
  { slot: '--theme-focus-ring-inner', tokenPath: 'focus.ring.inner' },
  { slot: '--theme-focus-text', tokenPath: 'focus.text' },

  // text
  { slot: '--theme-text-primary', tokenPath: 'text.primary' },
  { slot: '--theme-text-secondary', tokenPath: 'text.secondary' },
  { slot: '--theme-text-muted', tokenPath: 'text.muted' },
  { slot: '--theme-text-inverse', tokenPath: 'text.inverse' },
  { slot: '--theme-text-accent', tokenPath: 'text.accent' },
  { slot: '--theme-text-on-interactive', tokenPath: 'text.onInteractive' },
  { slot: '--theme-text-disabled', tokenPath: 'text.disabled' },
  { slot: '--theme-text-on-destructive', tokenPath: 'text.onDestructive' },

  // status — info
  { slot: '--theme-status-info-surface', tokenPath: 'status.info.surface' },
  { slot: '--theme-status-info-border', tokenPath: 'status.info.border' },
  { slot: '--theme-status-info-text', tokenPath: 'status.info.text' },
  { slot: '--theme-status-info-icon', tokenPath: 'status.info.icon' },
  { slot: '--theme-status-info-solid', tokenPath: 'status.info.solid' },
  { slot: '--theme-status-info-on-solid', tokenPath: 'status.info.onSolid' },

  // status — success
  { slot: '--theme-status-success-surface', tokenPath: 'status.success.surface' },
  { slot: '--theme-status-success-border', tokenPath: 'status.success.border' },
  { slot: '--theme-status-success-text', tokenPath: 'status.success.text' },
  { slot: '--theme-status-success-icon', tokenPath: 'status.success.icon' },
  { slot: '--theme-status-success-solid', tokenPath: 'status.success.solid' },
  { slot: '--theme-status-success-on-solid', tokenPath: 'status.success.onSolid' },

  // status — warning
  { slot: '--theme-status-warning-surface', tokenPath: 'status.warning.surface' },
  { slot: '--theme-status-warning-border', tokenPath: 'status.warning.border' },
  { slot: '--theme-status-warning-text', tokenPath: 'status.warning.text' },
  { slot: '--theme-status-warning-icon', tokenPath: 'status.warning.icon' },
  { slot: '--theme-status-warning-solid', tokenPath: 'status.warning.solid' },
  { slot: '--theme-status-warning-on-solid', tokenPath: 'status.warning.onSolid' },

  // status — critical
  { slot: '--theme-status-critical-surface', tokenPath: 'status.critical.surface' },
  { slot: '--theme-status-critical-border', tokenPath: 'status.critical.border' },
  { slot: '--theme-status-critical-text', tokenPath: 'status.critical.text' },
  { slot: '--theme-status-critical-icon', tokenPath: 'status.critical.icon' },
  { slot: '--theme-status-critical-solid', tokenPath: 'status.critical.solid' },
  { slot: '--theme-status-critical-on-solid', tokenPath: 'status.critical.onSolid' },

  // status — neutral
  { slot: '--theme-status-neutral-surface', tokenPath: 'status.neutral.surface' },
  { slot: '--theme-status-neutral-border', tokenPath: 'status.neutral.border' },
  { slot: '--theme-status-neutral-text', tokenPath: 'status.neutral.text' },
  { slot: '--theme-status-neutral-icon', tokenPath: 'status.neutral.icon' },
  { slot: '--theme-status-neutral-solid', tokenPath: 'status.neutral.solid' },
  { slot: '--theme-status-neutral-on-solid', tokenPath: 'status.neutral.onSolid' },

  // status — accent (s206-m01: the four slots the 41 never carried, so dark and high contrast painted the light chip)
  { slot: '--theme-status-accent-surface', tokenPath: 'status.accent.surface' },
  { slot: '--theme-status-accent-border', tokenPath: 'status.accent.border' },
  { slot: '--theme-status-accent-text', tokenPath: 'status.accent.text' },
  { slot: '--theme-status-accent-icon', tokenPath: 'status.accent.icon' },
  { slot: '--theme-status-accent-solid', tokenPath: 'status.accent.solid' },
  { slot: '--theme-status-accent-on-solid', tokenPath: 'status.accent.onSolid' },

  // s222-m01 (#2502 rulings 3 and 9): radius and font belong to the brand, the same in each of its themes. They live in
  // the brand's base file, outside the colour namespace (`radius.brand.<X>.*`, `font.brand.<X>.*`).
  { slot: '--theme-radius-control', token: 'radius.brand.{brand}.control' },
  { slot: '--theme-radius-small', token: 'radius.brand.{brand}.small' },
  { slot: '--theme-radius-large', token: 'radius.brand.{brand}.large' },
  { slot: '--theme-radius-card', token: 'radius.brand.{brand}.card' },
  { slot: '--theme-radius-pill', token: 'radius.brand.{brand}.pill' },
  { slot: '--theme-font-sans', token: 'font.brand.{brand}.sans' },
  { slot: '--theme-font-mono', token: 'font.brand.{brand}.mono' },
]);

/**
 * Every slot in the frozen brand consumer contract is bridged. This export stays as an
 * explicit empty carrier so callers can keep proving that bridge + gaps account for the
 * entire contract. s178 m02 closed the last three gaps by authoring focus tokens for all
 * six brand × theme cells; the generator still never invents a value.
 */
export const UNBRIDGED_SLOTS = Object.freeze([]);

/**
 * Brand tokens with no consumer slot on the other side of the bridge. Recorded for the
 * same reason as UNBRIDGED_SLOTS: an unmapped token is a fact worth stating, not a
 * silent omission. `accent.*` is a distinct ramp from `text.accent` and the retired
 * hand-authored mapping never consumed it.
 */
export const UNBRIDGED_TOKENS = Object.freeze([
  'accent.background',
  'accent.border',
  'accent.text',
]);

/**
 * Render one cell's bridge block.
 *
 * @param {{brand: string, theme: string}} scope
 * @param {Map<string, string>} resolvedByPath  dotted token path -> resolved CSS value
 * @param {string[]} selectors                  the D9 selector list for this cell
 */
export function renderBridgeBlock(scope, resolvedByPath, selectors) {
  const lines = [];
  const missing = [];

  for (const { slot, tokenPath, token } of SEMANTIC_BRIDGE) {
    const fullPath = token ? token.replace('{brand}', scope.brand) : `color.brand.${scope.brand}.${tokenPath}`;
    const value = resolvedByPath.get(fullPath);
    if (value === undefined) {
      missing.push(fullPath);
      continue;
    }
    lines.push(`  ${slot}: ${value};`);
  }

  if (missing.length > 0) {
    // Fail loud. A silently short bridge block would leave those slots on the neutral
    // :root palette and look like a brand that simply chose neutral values.
    throw new Error(
      `brand bridge ${scope.brand}/${scope.theme}: ${missing.length} mapped token(s) did not resolve: ${missing.join(', ')}`,
    );
  }

  return `${selectors.join(',\n')} {\n${lines.join('\n')}\n}`;
}
