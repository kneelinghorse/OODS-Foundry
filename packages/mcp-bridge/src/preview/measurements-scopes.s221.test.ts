/**
 * s221-m03 (the website's defect (b), message a232e944): the panel lists every scope the page can be measured in, which
 * is every brand the token build carries (the shell's brand switch offers them all) in light, dark and hc, and the
 * version's own brand. In 0.3.2 the list was the six A and B scopes, so a preview in a team's brand (Harbor) never named
 * its own scopes, and a result measured there was never shown.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMeasurementPanel, withAxeResult, type AxeResult } from './measurements.js';
import type { CompositionVersion, PreviewArtifact } from './store.js';

const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8')) as { compose: CompositionVersion['compose']; schema: unknown; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const harbor = (): CompositionVersion => ({
  recordVersion: '1', compositionId: 'cmp-0123456789ab', version: 1, parentVersion: null, operation: 'compose', createdAt: '2026-09-15T00:00:00.000Z', head: null,
  compose: raw.compose, schema: raw.schema, schemaHash: 'sha256:' + 'a'.repeat(64), brand: 'Harbor', theme: 'light', slots: [], model: raw.model,
  artifacts: { react: { artifact: raw.frameworks.react.artifact, generatedAt: '2026-09-15T00:00:00.000Z' } }, measurements: {},
});
const axe = (brand: string, theme: 'light' | 'dark' | 'hc'): AxeResult => ({ engine: { name: 'axe-core', version: '4.11.0' }, ranAt: '2026-09-15T00:01:00.000Z', url: '/preview/cmp-0123456789ab/1/app', framework: 'react', brand, theme, violations: [], passes: 12, incomplete: 1, inapplicable: 40 });

describe('a preview in a team brand names its own scopes (s221-m03)', () => {
  it('lists every built brand in every theme as not measured, the version\'s own brand included', () => {
    const html = renderMeasurementPanel(harbor(), ['A', 'B', 'Harbor']);
    for (const brand of ['A', 'B', 'Harbor']) for (const theme of ['light', 'dark', 'hc']) expect(html).toContain(`data-oods-not-measured="axe:react:${brand}/${theme}"`);
  });

  it('shows a result measured in the team brand as measured', () => {
    const html = renderMeasurementPanel(withAxeResult(harbor(), axe('Harbor', 'dark')), ['A', 'B', 'Harbor']);
    expect(html).toContain('data-oods-measured="axe:react:Harbor/dark"');
    expect(html).not.toContain('data-oods-not-measured="axe:react:Harbor/dark"');
    expect(html).toContain('data-oods-not-measured="axe:react:Harbor/light"');
  });

  it('keeps the version\'s own brand when the token build no longer carries it', () => {
    expect(renderMeasurementPanel(harbor(), ['A', 'B'])).toContain('data-oods-not-measured="axe:react:Harbor/hc"');
  });
});
