#!/usr/bin/env node
/**
 * s168 m06 — THE RENDERED-SURFACE PROOF.
 *
 * Every other control in this sprint reads a FILE: the emitted CSS artifact, the token
 * sources, the bridge map. None of them proves a browser resolves any of it. This does.
 *
 * ── WHAT IT ASSERTS, AND WHY IT DISCRIMINATES ──
 * For each brand × theme cell, two probe elements are painted:
 *
 *   probe A   background-color: var(--theme-<slot>)     ← goes through the whole cascade
 *   probe B   background-color: <the literal value the brand token source declares>
 *
 * Both are read back with `getComputedStyle`, so both are RESOLVED COMPUTED values in the
 * same colour space, converted by the same engine. If the cascade delivers the right token
 * they are byte-identical strings; if any layer masks, mis-scopes, or drops a slot, they
 * differ. Comparing two browser-computed values sidesteps every oklch→rgb rounding
 * question — the browser is the authority on both sides.
 *
 * A probe that fails to resolve computes to `rgba(0, 0, 0, 0)`, which is treated as a
 * FAILURE rather than a match, so an undefined variable cannot pass by looking transparent.
 *
 * ── CSS IS INJECTED IN THE REAL IMPORT ORDER, AND THE ORDER IS *DERIVED* ──
 * `apps/explorer/src/styles/index.css` is `layers.css` → `motion.css` → `hc.css`, and
 * `layers.css:1` imports the generated `@oods/tokens/css`. Stylesheet insertion order is
 * the cascade's source order, so injecting in that sequence reproduces the real cascade.
 *
 * s169 m02 closed a gap here. The proof used to inject THREE sheets (generated CSS,
 * layers.css, brand.css) while its order guard checked only indices 0 and 1 — so
 * `motion.css`, `hc.css` and the explorer's own `tokens.css` were all absent, and the
 * guard could not have noticed a fourth import arriving. Now `SHEETS` is **built from the
 * parsed import list itself**, and the guard asserts that list in FULL; the two therefore
 * cannot diverge, because there is only one of them. s178 removes `brand.css` from that
 * order after moving its final responsibilities into the token pipeline and hc.css.
 * `apps/explorer/src/styles/tokens.css`
 * is injected LAST — it is not an `index.css` import (Storybook loads it separately), and
 * last is the worst case for `:root` masking, so green there covers every real position.
 * MEASURED: all bridged-slot assertions pass in this worst-case order.
 *
 * ── SCOPE, STATED ──
 * This proves the CSS cascade resolves brand tokens in a real engine. It does NOT prove
 * any particular component renders correctly; that is a different (and larger) claim.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { focusIdentityFailures } from './brand-focus-identity.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

// s213-m04: every brand in the brand registry (the brands folder), so a new brand's cascade is proven too.
const BRANDS = createRequire(import.meta.url)('../../packages/tokens/scripts/brand-registry.cjs').readBrandRegistry();
const THEMES = ['base', 'dark', 'hc'];

const { SEMANTIC_BRIDGE } = await import(
  path.join(REPO_ROOT, 'packages/tokens/scripts/brand-bridge.mjs')
);
const FOCUS_SLOTS = SEMANTIC_BRIDGE.map((entry) => entry.slot).filter((slot) =>
  slot.startsWith('--theme-focus-'),
);
if (FOCUS_SLOTS.length !== 3) {
  throw new Error(
    `semantic bridge exposes ${FOCUS_SLOTS.length} focus slots, expected exactly 3 — ` +
      'the rendered focus proof cannot be trusted until its contract is reconciled',
  );
}

/** The brand token source is the expectation — never the build's own output. */
function expectedFor(brand, theme) {
  const doc = JSON.parse(read(`packages/tokens/src/tokens/brands/${brand}/${theme}.json`));
  const out = {};
  for (const { slot, tokenPath } of SEMANTIC_BRIDGE) {
    let node = doc;
    for (const segment = `color.brand.${brand}.${tokenPath}`.split('.'), i = { v: 0 }; ; ) {
      node = node?.[segment[i.v++]];
      if (i.v >= segment.length || node === undefined) break;
    }
    if (node && typeof node === 'object' && '$value' in node) out[slot] = String(node.$value);
  }
  return out;
}

// The real import order from apps/explorer/src/styles/index.css. layers.css:1 imports the
// generated CSS, so it goes in first, exactly as the bundler would place it.
const LAYERS_CSS = read('apps/explorer/src/styles/layers.css');
if (!/@import[^;]*@oods\/tokens\/css/.test(LAYERS_CSS)) {
  throw new Error(
    'layers.css no longer imports @oods/tokens/css — the injection order below no longer ' +
      'reproduces the real cascade. Re-derive it from index.css before trusting this proof.',
  );
}
const INDEX_CSS = read('apps/explorer/src/styles/index.css');
const importOrder = [...INDEX_CSS.matchAll(/@import\s+'\.\/([a-z-]+\.css)'/g)].map((m) => m[1]);
// The FULL list, not just the first two. A fifth import — or a reorder past index 1 —
// must stop this proof rather than be silently left out of the injected cascade.
const EXPECTED_IMPORT_ORDER = ['layers.css', 'motion.css', 'hc.css'];
if (JSON.stringify(importOrder) !== JSON.stringify(EXPECTED_IMPORT_ORDER)) {
  throw new Error(
    `index.css import list changed to [${importOrder.join(', ')}] — this proof pins ` +
      `[${EXPECTED_IMPORT_ORDER.join(', ')}]. Re-verify the cascade before updating this check.`,
  );
}

// SHEETS is DERIVED from importOrder, so the guard above and the injection below cannot
// disagree. `tokens.css` is not an index.css import (Storybook loads it separately), so it
// is appended LAST — the worst case for `:root` masking.
const SHEETS = [
  ['generated @oods/tokens/css', read('packages/tokens/dist/css/tokens.css')],
  ...importOrder.map((file) => [file, read(`apps/explorer/src/styles/${file}`)]),
  ['explorer tokens.css', read('apps/explorer/src/styles/tokens.css')],
];
console.log(`sheet order: ${SHEETS.map(([name]) => name).join(' → ')}`);

/**
 * ── THE THREE FOCUS SLOTS, NOW TOKEN-SOURCED ──
 *
 * s178 promotes `--theme-focus-ring-outer|-inner|-text` into the generated semantic bridge
 * for all six brand × theme cells. Base is deliberately brand-coloured (the visible F1
 * movement), dark preserves the previously winning values, and hc preserves its system
 * keywords. The expectation below is extracted from the generated token CSS itself so the
 * focus-only browser assertions exercise the post-retirement cascade, not a deleted
 * hand-authored stylesheet. The independent 18-value source contract lives in
 * `brand-semantic-bridge.test.ts`; this script proves those emitted values actually win.
 */
const GENERATED_CSS = read('packages/tokens/dist/css/tokens.css');

/**
 * Declarations of the focus slots from every block whose selector matches, merged in order.
 *
 * THE `@import` TRAP, hit live while writing this: the text preceding a block's `{` runs
 * back to the previous `}`, so the FIRST block of `layers.css` has a raw header of
 * `@import '@oods/tokens/css';\n\n:root` and an equality test against `':root'` silently
 * matches nothing. The selector is the text after the last `;`, and that is not a nicety —
 * without it this function found zero declarations and the guard below fired.
 */
function focusDeclarations(css, selectorMatches, label) {
  const found = {};
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const header = match[1];
    const selector = header.slice(header.lastIndexOf(';') + 1).trim().replace(/"/g, "'");
    const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);
    if (selectors.length === 0 || !selectors.some(selectorMatches)) continue;
    for (const line of match[2].split(';')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const prop = line.slice(0, idx).trim();
      if (FOCUS_SLOTS.includes(prop)) found[prop] = line.slice(idx + 1).trim();
    }
  }
  const missing = FOCUS_SLOTS.filter((slot) => !(slot in found));
  if (missing.length > 0) {
    throw new Error(
      `${label} no longer declares ${missing.join(', ')} — the focus expectation cannot be ` +
        'derived, so the proof would silently assert nothing. Re-derive it before trusting this.',
    );
  }
  return found;
}

const BRAND_FOCUS = {};
for (const brand of BRANDS) {
  BRAND_FOCUS[brand] = {};
  for (const theme of THEMES) {
    const selector = `[data-brand='${brand}'][data-theme='${theme}']`;
    BRAND_FOCUS[brand][theme] = focusDeclarations(
      GENERATED_CSS,
      (sel) => sel === selector,
      `generated tokens.css ${selector}`,
    );
  }
}
const expectedFocusFor = (brand, theme) => BRAND_FOCUS[brand][theme];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><html><head></head><body></body></html>');
for (const [, css] of SHEETS) {
  // @import inside an injected sheet cannot resolve; the generated CSS is injected
  // directly above, which is what that import would have produced.
  await page.addStyleTag({ content: css.replace(/@import[^;]+;/g, '') });
}

// SELF-TEST (rule 13a: a control that cannot go red is not a control). With
// BRAND_CASCADE_PROOF_SELFTEST=1 a masking rule is injected LAST, exactly as a regressed
// stylesheet loading after the bridge would. The proof must then FAIL; if it still passes,
// it is not measuring the cascade and the green above means nothing.
if (process.env.BRAND_CASCADE_PROOF_SELFTEST === '1') {
  // TWO masks, one per assertion group (s169 m02): the bridged-slot group and the focus
  // group each need their own red, or a self-test green would only vouch for one of them.
  // The focus mask targets a LIGHT cell specifically, because light focus is the row whose
  // documented behaviour this mission corrected — the row most worth being able to catch.
  await page.addStyleTag({
    content:
      "[data-brand='A'][data-theme='dark']{--theme-surface-canvas:rgb(1,2,3)}" +
      "[data-brand='B'][data-theme='base']{--theme-focus-text:rgb(4,5,6)}",
  });
  console.log(
    'SELFTEST: injected masking declarations for A/dark --theme-surface-canvas and ' +
      'B/base --theme-focus-text',
  );
}

const failures = [];
let asserted = 0;
/** Cascade-computed focus values per cell, kept for the cross-brand identity checks. */
const focusComputed = {};

for (const brand of BRANDS) {
  for (const theme of THEMES) {
    const expected = expectedFor(brand, theme);
    const expectedFocus = expectedFocusFor(brand, theme);
    const slots = Object.keys(expected);
    const results = await page.evaluate(
      ({ brand, theme, expected, expectedFocus }) => {
        document.documentElement.setAttribute('data-brand', brand);
        document.documentElement.setAttribute('data-theme', theme);
        const paint = (declaration) => {
          const probe = document.createElement('div');
          probe.style.backgroundColor = declaration;
          document.body.append(probe);
          const computed = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return computed;
        };
        const out = {};
        for (const [slot, literal] of Object.entries(expected)) {
          out[slot] = { cascade: paint(`var(${slot})`), literal: paint(literal) };
        }
        const focus = {};
        for (const [slot, declaration] of Object.entries(expectedFocus)) {
          // Same two-probe pattern: the cascade's answer vs the WINNING declaration's own
          // text, both computed by the same engine.
          focus[slot] = { cascade: paint(`var(${slot})`), literal: paint(declaration) };
        }
        return { out, focus };
      },
      { brand, theme, expected, expectedFocus },
    );

    for (const slot of slots) {
      const { cascade, literal } = results.out[slot];
      asserted += 1;
      // An unresolved var() paints transparent — never let that count as agreement.
      if (cascade === 'rgba(0, 0, 0, 0)') {
        failures.push(`${brand}/${theme} ${slot}: did not resolve (painted transparent)`);
      } else if (cascade !== literal) {
        failures.push(
          `${brand}/${theme} ${slot}: cascade painted ${cascade}, token source declares ` +
            `${expected[slot]} which paints ${literal}`,
        );
      }
    }

    focusComputed[`${brand}/${theme}`] = {};
    for (const slot of FOCUS_SLOTS) {
      const { cascade, literal } = results.focus[slot];
      focusComputed[`${brand}/${theme}`][slot] = cascade;
      asserted += 1;
      if (cascade === 'rgba(0, 0, 0, 0)') {
        failures.push(`${brand}/${theme} ${slot}: did not resolve (painted transparent)`);
      } else if (cascade !== literal) {
        failures.push(
          `${brand}/${theme} ${slot}: cascade painted ${cascade}, but the winning declaration ` +
            `${expectedFocus[slot]} paints ${literal}` +
            (theme === 'base'
              ? ` — expected the branded generated [data-brand='${brand}'][data-theme='base'] value`
              : ` — expected the generated [data-brand='${brand}'][data-theme='${theme}'] value`),
        );
      }
    }

    console.log(
      `${brand}/${theme}: ${slots.length} bridged + ${FOCUS_SLOTS.length} focus slots painted, ` +
        `${failures.length === 0 ? 'all match' : `${failures.length} mismatch so far`}`,
    );
  }
}

await browser.close();

// Reuse the nine explicit primary/shared/HC relationships over the measured paints.
failures.push(...focusIdentityFailures(focusComputed));

console.log(
  `\nrendered-surface proof: ${asserted} computed-style assertions across 6 cells ` +
    `(${SEMANTIC_BRIDGE.length * 6} bridged + ${FOCUS_SLOTS.length * 6} focus), plus ` +
    `${FOCUS_SLOTS.length * 3} derived cross-brand identity checks over those same values`,
);
console.log('focus resolution, measured:');
for (const cell of Object.keys(focusComputed)) {
  console.log(
    `  ${cell}: ${FOCUS_SLOTS.map((s) => `${s.replace('--theme-focus-', '')}=${focusComputed[cell][s]}`).join('  ')}`,
  );
}
if (failures.length > 0) {
  console.error(`\n${failures.length} MISMATCH(ES):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
if (asserted === 0) {
  console.error('\nZERO assertions ran — the proof is vacuous. Failing rather than reporting green.');
  process.exit(1);
}
console.log(
  '✔ every bridged slot resolves in a real browser to the value its token source declares, ' +
    'and every focus slot resolves from the generated bridge ' +
    '(primary ring brand-distinct, neutral/accent shared, HC system-keyword-identical)',
);
