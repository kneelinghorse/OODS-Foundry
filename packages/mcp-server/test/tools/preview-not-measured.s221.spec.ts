/**
 * s221-m03 (the website's defect (b), message a232e944): design.preview's `measured.notMeasured` lists every scope the
 * preview can be measured in: each brand this server can render, in light, dark and hc, and the version's own brand. In
 * 0.3.2 it listed the six A and B scopes whatever the brand, so a preview in a team's brand (Harbor, in the website's
 * quickstart run and in sprint-221/m02/warehouse/before) never named its own, contradicting "every measurement not
 * taken is listed under notMeasured".
 */
import { describe, expect, it } from 'vitest';
import { summarizeMeasurements } from '../../src/tools/design.preview.js';
import { knownBrands } from '../../src/lib/brand-registry.js';
import type { CompositionVersion } from '../../src/lib/composition-store.js';

const record = (brand: string, axe: Record<string, Record<string, unknown>> = {}) => ({
  brand, theme: 'light', artifacts: { react: {} }, scopes: {}, measurements: { validation: { react: {} }, charts: [], ...(Object.keys(axe).length ? { axe } : {}) },
}) as unknown as CompositionVersion;

describe('notMeasured names the preview\'s own brand (s221-m03)', () => {
  it('a Harbor preview lists Harbor in light, dark and hc beside every brand this server renders', () => {
    const { notMeasured } = summarizeMeasurements(record('Harbor'));
    for (const theme of ['light', 'dark', 'hc']) expect(notMeasured).toContain(`axe:react:Harbor/${theme}`);
    for (const brand of knownBrands()) for (const theme of ['light', 'dark', 'hc']) expect(notMeasured).toContain(`axe:react:${brand}/${theme}`);
  });

  it('a scope measured in the team brand is measured, not listed as missing', () => {
    const measured = summarizeMeasurements(record('Harbor', { react: { 'Harbor/dark': { violations: [] } } }));
    expect(measured.axe).toEqual(['react:Harbor/dark']);
    expect(measured.notMeasured).not.toContain('axe:react:Harbor/dark');
    expect(measured.notMeasured).toContain('axe:react:Harbor/light');
  });
});
