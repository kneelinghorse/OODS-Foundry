/**
 * Landing / content-page layout (s106-m04).
 *
 * design.compose was data-view-only: "landing page" routed to detail/Tabs
 * because the unqualified 'page' keyword was a detail signal. This mission
 * added a `landing` content-page layout + fixed the keyword collision.
 *
 * Covers: intent detection (the collision fix), explicit layout, the template
 * structure (unit), and the compose -> render path.
 */

import { describe, expect, it } from 'vitest';

import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { landingTemplate } from '../../src/compose/templates/landing.js';

describe('landing layout — intent detection (the page->detail collision fix)', () => {
  it('"landing page" now routes to landing, not detail/Tabs', async () => {
    const result = await composeHandle({ intent: 'a landing page for our new product' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('landing');
    // Regression on the bug: it must NOT be detail anymore.
    expect(result.layout).not.toBe('detail');
  });

  it('content/marketing page phrasings route to landing', async () => {
    for (const intent of ['a marketing page', 'our homepage', 'a content page with three sections']) {
      const result = await composeHandle({ intent });
      expect(result.layout, intent).toBe('landing');
    }
  });

  it('a generic "about page" routes to landing (page is now a content-page signal)', async () => {
    const result = await composeHandle({ intent: 'an about page' });
    expect(result.layout).toBe('landing');
  });

  it('detail intents still win their ties: "detail page" stays detail', async () => {
    // "detail page" scores detail AND landing (via "page"); the tie must resolve
    // to detail (strong data-view keyword beats the generic page signal).
    const detailPage = await composeHandle({ intent: 'a detail page' });
    expect(detailPage.layout).toBe('detail');

    const detail = await composeHandle({ intent: 'subscription detail view', object: 'Subscription', context: 'detail' });
    expect(detail.layout).toBe('detail');
    const intentOnly = await composeHandle({ intent: 'show the user profile' });
    expect(intentOnly.layout).toBe('detail');
  });

  it('layout="landing" can be requested explicitly', async () => {
    const result = await composeHandle({ intent: 'pricing', layout: 'landing' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('landing');
    expect(result.meta!.layoutDetected).toContain('explicit');
  });
});

describe('landingTemplate — structure (unit)', () => {
  it('emits hero + hero-cta + N sections + cta + footer by default', () => {
    const { slots, schema } = landingTemplate();
    const names = slots.map((s) => s.name);
    expect(names).toEqual(['hero', 'hero-cta', 'section-0', 'section-1', 'section-2', 'cta', 'footer']);

    // hero + hero-cta are the only required slots.
    expect(slots.filter((s) => s.required).map((s) => s.name)).toEqual(['hero', 'hero-cta']);

    // Root is a vertical page stack, not a Card/Tabs detail shell.
    expect(schema.screens[0].component).toBe('Stack');
    expect(schema.screens[0].id).toMatch(/^screen-landing-\d+$/);
  });

  it('honors sectionCount and the includeCta/includeFooter toggles', () => {
    const { slots } = landingTemplate({ sectionCount: 2, includeCta: false, includeFooter: false });
    expect(slots.map((s) => s.name)).toEqual(['hero', 'hero-cta', 'section-0', 'section-1']);
  });

  it('clamps a stray sectionCount into a sane range', () => {
    expect(landingTemplate({ sectionCount: 0 }).slots.filter((s) => s.name.startsWith('section-'))).toHaveLength(1);
    expect(landingTemplate({ sectionCount: 999 }).slots.filter((s) => s.name.startsWith('section-'))).toHaveLength(12);
  });

  it('is deterministic — identical options yield byte-identical schema', () => {
    expect(JSON.stringify(landingTemplate())).toBe(JSON.stringify(landingTemplate()));
  });
});

describe('landing layout — compose -> render', () => {
  it('composes a valid landing schema that renders to HTML', async () => {
    const composed = await composeHandle({ intent: 'a landing page with hero and three feature sections' });
    expect(composed.status).toBe('ok');
    expect(composed.layout).toBe('landing');
    expect(composed.validation?.status).toBe('ok');
    expect(composed.schema.screens[0].component).toBe('Stack');

    const rendered = await renderHandle({ mode: 'full', schema: composed.schema, apply: true });
    expect(rendered.status).toBe('ok');
    expect(rendered.html).toContain('<!DOCTYPE html>');
    // The composed landing tree carries node-id anchors like every other layout.
    expect(rendered.html).toContain('data-oods-node-id');
  });
});
