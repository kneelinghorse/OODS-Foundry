/**
 * s169 m04 — `repl.render` honours `brand`, end to end.
 *
 * ── WHAT WAS MISSING, AND WHAT WAS NOT ──
 * `renderDocument` has accepted and HTML-escaped a `brand` input for several sprints, and a
 * unit test has covered it with `brand: 'A'` the whole time. What did not exist was any way
 * for an MCP caller to reach it: no render input schema declared the field, and
 * `normalizeBrand` therefore resolved every request to `'default'`. Meanwhile the built
 * `tokens.css` has been shipping 8 `[data-brand='A']` and 8 `[data-brand='B']` blocks, none
 * of which `data-brand="default"` matches. Threading activates real, already-committed CSS
 * with zero new build machinery — which is exactly why the gap was so easy to miss.
 *
 * ── WHY 'default' IS PRESERVED RATHER THAN DEFAULTED TO 'A' ──
 * `data-brand="default"` matching no generated block is the CORRECT rendering of "no brand
 * requested": the document falls through to `:root`. Defaulting an absent brand to 'A' would
 * silently re-brand every existing caller's output. The absence test below pins that.
 *
 * This file lives in `src/tools/` and so runs via the by-name colocated-golden list in CI,
 * alongside `repl.render.skin-mapping.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle as renderHandle } from './repl.render.js';
import { getAjv } from '../lib/ajv.js';
import type { ReplRenderOutput, UiSchema } from '../schemas/generated.js';

const SCHEMA: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'brand-screen',
      component: 'Stack',
      children: [{ id: 'brand-button', component: 'Button', props: { label: 'Save' } }],
    },
  ],
};

const render = (extra: Record<string, unknown> = {}): Promise<ReplRenderOutput> =>
  renderHandle({
    mode: 'full',
    schema: SCHEMA,
    apply: true,
    output: { format: 'document', compact: false },
    ...extra,
  } as never);

const renderInputSchema = JSON.parse(
  readFileSync(new URL('../schemas/repl.render.input.json', import.meta.url), 'utf8'),
);
const validateRenderInput = getAjv().compile(renderInputSchema);

describe('repl.render brand threading (s169 m04)', () => {
  it('an ABSENT brand still renders data-brand="default" — byte-identical to before', async () => {
    const out = await render();
    expect(out.html as string).toContain('data-brand="default"');
    expect(out.html as string).not.toContain("data-brand=\"A\"");
  });

  it('brand=A and brand=B each reach the document element', async () => {
    for (const brand of ['A', 'B'] as const) {
      const out = await render({ brand });
      expect(out.html as string, `brand ${brand} on <html>`).toContain(`<html lang="en" data-theme="light" data-brand="${brand}">`);
      expect(out.html as string, `brand ${brand} on <body>`).toContain(`data-brand="${brand}">`);
      expect(out.html as string).not.toContain('data-brand="default"');
    }
  });

  it('the brand the document names is a brand the inlined token CSS actually defines', async () => {
    // Otherwise `brand: 'B'` would be a false affordance: accepted, echoed into an
    // attribute, and matching no rule. compact:false inlines the full token CSS, so the
    // selector it must match is right there in the same document.
    for (const brand of ['A', 'B'] as const) {
      const html = (await render({ brand })).html as string;
      expect(html, `no [data-brand='${brand}'] block in the inlined tokens`).toContain(
        `[data-brand='${brand}']`,
      );
    }
  });

  it('brand A and brand B produce DIFFERENT documents', async () => {
    const a = (await render({ brand: 'A' })).html;
    const b = (await render({ brand: 'B' })).html;
    expect(a).not.toBe(b);
  });

  it('the FRAGMENTS branch ignores brand, exactly as the schema description says', async () => {
    // Fragments emit no <html> element, so there is nothing to carry data-brand. The
    // contract is "ignored", not "errors" — and it must be ignored IDENTICALLY, or the
    // description is wrong.
    const withBrand = await renderHandle({
      mode: 'full',
      schema: SCHEMA,
      apply: true,
      output: { format: 'fragments', compact: false },
      brand: 'B',
    } as never);
    const withoutBrand = await renderHandle({
      mode: 'full',
      schema: SCHEMA,
      apply: true,
      output: { format: 'fragments', compact: false },
    } as never);
    expect(JSON.stringify(withBrand.fragments)).toBe(JSON.stringify(withoutBrand.fragments));
    expect(withBrand.html).toBeUndefined();
  });

  it('the schema accepts exactly A and B, and rejects everything else', () => {
    expect(validateRenderInput({ mode: 'full', schema: SCHEMA, brand: 'A' })).toBe(true);
    expect(validateRenderInput({ mode: 'full', schema: SCHEMA, brand: 'B' })).toBe(true);
    expect(validateRenderInput({ mode: 'full', schema: SCHEMA })).toBe(true);
    for (const brand of ['C', 'a', 'b', 'default', '', 1, null]) {
      expect(validateRenderInput({ mode: 'full', schema: SCHEMA, brand }), `brand ${JSON.stringify(brand)}`).toBe(false);
    }
  });
});
