// s173 m03 (crawl 2) — the narrow-container collapse, asserted STRUCTURALLY.
//
// WHAT THIS FILE CAN AND CANNOT PROVE, stated up front so no one reads it as more than it
// is: jsdom does not implement container queries, so nothing here observes a collapsed
// layout. The behavioural proof — computed `grid-template-columns` at 375 vs 1280 in a real
// engine — is m04's Playwright leg, and that is where the collapse is genuinely verified.
//
// What this file DOES prove is the part a browser test would silently miss: that the
// collapse block covers EVERY context rather than the five obvious ones, and that the
// coverage claim is derived from the stylesheet instead of asserted about it. The eight
// contexts are read out of the file, every two-column template is found, and each one must
// be released. If a ninth context lands with a rail, this reds; if someone adds a template
// and forgets the release, this reds — neither of which a 375px screenshot would catch.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VIEW_COLLAPSE_PX } from '../../src/styles/breakpoints.js';
import { buildViewContainerAttributes } from '../../src/engine/render/ViewContainer.js';

const CSS_PATH = resolve(process.cwd(), 'src/styles/domain-contexts.css');
const css = readFileSync(CSS_PATH, 'utf8');

/** The @container block's body, extracted by brace matching (nested rules make a regex wrong). */
function containerBlock(source: string): string {
  const start = source.indexOf('@container view-shell (max-width: 48rem)');
  expect(start).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error('unterminated @container block');
}

/** Every context named anywhere in the stylesheet — read out, never typed in. */
const CONTEXTS = [...new Set([...css.matchAll(/\[data-view-context='([a-z]+)'\]/g)].map((m) => m[1]))].sort();

/** Contexts whose content group pins a two-column template outside the collapse block. */
const TWO_COLUMN_CONTEXTS = [
  ...new Set(
    [...css.matchAll(/\[data-view-context='([a-z]+)'\]\[data-view-has-contextpanel='true'\]/g)].map((m) => m[1]),
  ),
].sort();

describe('view-context collapse — the shell is a query container (s173 m03)', () => {
  it('declares container-type AND an explicit container-name on [data-view]', () => {
    expect(css).toMatch(/container-type:\s*inline-size/);
    expect(css).toMatch(/container-name:\s*view-shell/);
    // Named, so the queries cannot be captured by a container someone nests later.
    expect(css).toContain('@container view-shell (max-width: 48rem)');
  });

  it('CONTAINMENT CHECK: the shell-max-width child rule is untouched by containment', () => {
    // `[data-view] > * { width: var(--view-shell-max-width) }` resolves min(75rem, 100%)
    // against the container's inline size. That size still comes from `width: 100%` — the
    // PARENT — so inline-size containment introduces no cycle and no new dependency. The
    // rule and the width:100% that makes it safe must both survive; this is the assertion
    // that they did, since deleting either would silently change how children size.
    expect(css).toMatch(/\[data-view\]\s*>\s*\*\s*\{[^}]*width:\s*var\(--view-shell-max-width\)/);
    expect(css).toMatch(/\[data-view\]\s*\{[^}]*width:\s*100%/);
  });

  it('the threshold literal and the token agree — 48rem IS sys.breakpoint.md', () => {
    expect(48 * 16).toBe(VIEW_COLLAPSE_PX);
  });
});

describe('view-context collapse — ALL EIGHT contexts, derived not asserted (s173 m03)', () => {
  const block = containerBlock(css);

  it('the stylesheet still defines exactly the eight known contexts', () => {
    // If this list grows, the coverage assertions below are no longer exhaustive and the
    // new context has to be dispositioned deliberately.
    expect(CONTEXTS).toEqual(['card', 'chart', 'dashboard', 'detail', 'form', 'inline', 'list', 'timeline']);
  });

  it('every context that pins a two-column template releases it inside the collapse', () => {
    // Five today: detail, list, form, chart, dashboard.
    expect(TWO_COLUMN_CONTEXTS.length).toBeGreaterThanOrEqual(5);
    for (const context of TWO_COLUMN_CONTEXTS) {
      expect(block).toContain(`[data-view-context='${context}'][data-view-has-contextpanel='true']`);
    }
    expect(block).toMatch(/grid-template-columns:\s*var\(--view-columns-default\)/);
  });

  it('the three contexts with NO two-column template genuinely have none — the claim is checked', () => {
    // timeline is the trap: it shares the STANDARD rail with detail, so it looks like a
    // two-column context and is not. If any of these ever gains a template, the assertion
    // above stops covering it and this one says so.
    for (const context of ['timeline', 'inline', 'card']) {
      expect(TWO_COLUMN_CONTEXTS).not.toContain(context);
    }
  });

  it('the rail is released for every context at once, including timeline and the narrow pair', () => {
    expect(block).toMatch(/\[data-view\]\s*aside\[data-region='contextPanel'\]\s*\{/);
    expect(block).toMatch(/inline-size:\s*auto/);
    expect(block).toMatch(/min-inline-size:\s*0/);
  });

  it('the release is written at the SAME specificity as the rules it overrides', () => {
    // Container queries add no specificity, so the cascade here is decided by source order.
    // A release written as a bare [data-region-group] would lose to the base rule and the
    // whole collapse would be inert — the failure mode this pins against.
    for (const context of TWO_COLUMN_CONTEXTS) {
      const base = `[data-view-context='${context}'][data-view-has-contextpanel='true']`;
      expect(css.indexOf(base)).toBeLessThan(css.lastIndexOf(base));
      expect(block).toContain(base);
    }
    expect(css.indexOf('@container view-shell')).toBeGreaterThan(
      css.indexOf(`[data-view-context='detail'][data-view-has-contextpanel='true']`),
    );
  });
});

describe('view-context collapse — what must NOT have moved (s173 m03)', () => {
  it('data-view-has-contextpanel is not renamed', () => {
    expect(css).toContain("[data-view-has-contextpanel='true']");
  });

  it('the ENGINE really emits the attributes the stylesheet and the proof stories key on', () => {
    // The proof stories hand-compose the view shell (RenderObject takes no region override,
    // and the drawer is opt-in), so they mirror the engine's markup rather than driving it.
    // A mirror can drift into fiction; this is the pin that it has not. buildViewContainerAttributes
    // is the real producer — its output is compared, not a transcription of the prefix.
    const attributes = buildViewContainerAttributes('detail', {
      main: 'main content',
      contextPanel: 'panel content',
    } as never);
    expect(attributes['data-view-context']).toBe('detail');
    expect(attributes['data-view-has-contextpanel']).toBe('true');
    // The negative cases, since every collapse selector is keyed on the 'true' VALUE. There
    // are two of them and they are not the same shape: an EMPTY region flags 'false', while
    // an ABSENT region emits no attribute at all. Both fail the selector, which is what the
    // collapse needs — but a test that assumed 'false' for the absent case would be asserting
    // an attribute the engine never writes.
    const emptyPanel = buildViewContainerAttributes('detail', {
      main: 'main content',
      contextPanel: null,
    } as never);
    expect(emptyPanel['data-view-has-contextpanel']).toBe('false');

    const noPanelKey = buildViewContainerAttributes('detail', { main: 'main content' } as never);
    expect(noPanelKey['data-view-has-contextpanel']).toBeUndefined();
  });

  it('the forced-colors block is still present and still covers the four panelled contexts', () => {
    expect(css).toContain('@media (forced-colors: active)');
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    for (const context of ['detail', 'list', 'form', 'timeline']) {
      expect(forced).toContain(`[data-view-context='${context}']`);
    }
  });

  it('the collapse adds NO colour, border, spacing or surface declaration — it is layout only', () => {
    const block = containerBlock(css);
    for (const forbidden of ['background', 'border', 'color:', 'box-shadow', 'padding', 'margin']) {
      expect(block).not.toContain(forbidden);
    }
  });

  it('the collapse DECLARES no custom property — it cannot enter the bridged-slot cascade', () => {
    // The repo-wide invariant (tests/tokens/bridged-slot-specificity-census.test.ts, 14 rows)
    // is that only the generated bridge declares a bridged slot at brand-block weight. This
    // is the local, cheap half of that: a collapse rule that set a --theme-*/--view-* value
    // would be a new declarer inside a container query, where the census's specificity model
    // does not obviously apply. It only CONSUMES var(); it never writes one.
    const block = containerBlock(css);
    expect(block).not.toMatch(/^\s*--[\w-]+\s*:/m);
    expect(block).toContain('var(--view-columns-default)');
  });
});
