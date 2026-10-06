/**
 * pragmatic_role page/IA roles contract (s106-m03).
 *
 * Forge owns the semantic protocol (decision #634). This sprint additively
 * expanded the pragmatic_role enum with four non-action page/IA roles —
 * page, landing, section, index — so site-map entities (The Academy IA work)
 * are no longer forced into navigation/informational.
 *
 * This test pins the additive contract end-to-end:
 *   1. G1 — a site-map manifest whose entities carry the new roles passes the
 *      Forge-owned manifest validation (the roles are schema-valid).
 *   2. The new roles are NON-action: an entity with a page/IA role and NO
 *      element.action/object still validates (it does not trip the
 *      element.object_action_present allowlist).
 *   3. Render round-trip — fidelity.preview boxes-arrows emits each entity with
 *      data-role === the input pragmatic_role and the new human label.
 *   4. The original 6 roles are unchanged (additive-only) and the action-shaped
 *      contract still bites (a *_action role without an element.action fails).
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { validateManifest } from '../../src/object-catalog/manifest-validator.js';
import { handle as fidelityPreview } from '../../src/tools/fidelity.preview.js';

const PAGE_IA_ROLES = ['page', 'landing', 'section', 'index'] as const;

// Expected boxes-arrows ROLE_LABEL text for the new roles.
const ROLE_LABEL: Record<(typeof PAGE_IA_ROLES)[number], string> = {
  page: 'Page',
  landing: 'Landing page',
  section: 'Section',
  index: 'Index',
};

function pageEntity(slug: string, name: string, purpose: string, role: string) {
  return {
    urn: `urn:proto:ui:${slug}@1.0.0`,
    element: { type: 'ui.surface.page', name },
    semantics: { purpose, human_meaning: `${name} page in the site map.` },
    pragmatic_role: role,
  };
}

// A small site-map / IA manifest: one entity per new page/IA role.
const SITE_MAP_MANIFEST = {
  manifest_version: '4.0',
  schema_version: '1.1.0',
  source: { agent: 's106-m03-ia-test', captured_at: '2026-06-09T00:00:00.000Z' },
  entities: [
    pageEntity('home-landing', 'Home', 'convert visitors', 'landing'),
    pageEntity('about-page', 'About', 'inform readers', 'page'),
    pageEntity('courses-hub', 'Courses', 'group course pages', 'section'),
    pageEntity('blog-index', 'Blog', 'list blog posts', 'index'),
  ],
};

describe('pragmatic_role page/IA roles — additive protocol expansion', () => {
  it('G1: a site-map manifest carrying the new page/IA roles validates', () => {
    const result = validateManifest(SITE_MAP_MANIFEST);
    if (!result.valid) {
      throw new Error(`site-map manifest failed G1: ${JSON.stringify(result.errors, null, 2)}`);
    }
    expect(result.valid).toBe(true);
    // schema_version pinned to 1.1.0 → exact → no version warnings.
    expect(result.warnings).toEqual([]);
  });

  it('the new roles are NON-action: a page/IA entity needs no element.action/object', () => {
    for (const role of PAGE_IA_ROLES) {
      const manifest = {
        ...SITE_MAP_MANIFEST,
        entities: [pageEntity('solo-page', 'Solo', 'stand alone', role)],
      };
      const result = validateManifest(manifest);
      expect(result.valid, `role "${role}" must validate without element.action`).toBe(true);
    }
  });

  it('the action-shaped contract still bites (regression: I did not weaken the validator)', () => {
    const manifest = {
      ...SITE_MAP_MANIFEST,
      // primary_action with no element.action/object MUST fail.
      entities: [
        {
          urn: 'urn:proto:ui:bare-action@1.0.0',
          element: { type: 'ui.control.button', name: 'Go' },
          semantics: { purpose: 'do', human_meaning: 'A bare action.' },
          pragmatic_role: 'primary_action',
        },
      ],
    };
    expect(validateManifest(manifest).valid).toBe(false);
  });

  it('render round-trip: boxes-arrows emits data-role + label for each new role', async () => {
    const out = await fidelityPreview({ fidelityKind: 'boxes-arrows', manifest: SITE_MAP_MANIFEST });
    expect(out.status).toBe('ok');
    expect(out.meta.entityCount).toBe(SITE_MAP_MANIFEST.entities.length);

    const doc = new JSDOM(out.html).window.document;
    for (const entity of SITE_MAP_MANIFEST.entities) {
      const node = doc.querySelector(`.entity[data-entity-urn="${entity.urn}"]`);
      expect(node, `entity ${entity.urn} rendered`).not.toBeNull();
      // data-role round-trips the input pragmatic_role …
      expect(node!.getAttribute('data-role')).toBe(entity.pragmatic_role);
      // … and the visible role label is the new human label.
      const label = ROLE_LABEL[entity.pragmatic_role as (typeof PAGE_IA_ROLES)[number]];
      expect(node!.querySelector('.role')?.textContent).toBe(label);
    }
  });
});
