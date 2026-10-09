/**
 * s221-m02 (#2482 ruling 3; the website's finding 2, message 16978d69): brand_intake grades a high-contrast theme's pairs
 * of system colours as Chromium resolves them without forced colours, instead of reporting them "exempt".
 *
 * Why: a page's own high-contrast switch does not turn forced colours on, so the browser, not the user's settings,
 * supplies Canvas, GrayText and HighlightText. There GrayText on Canvas is 3.94:1 and HighlightText on a dark-scheme
 * Canvas is black on near black; "65 exempt" let both ship in brands A and B and in every brand made from the template.
 * Highlight and HighlightText differ by platform, so a pair passes only if it passes on macOS and Linux, light and dark.
 */
import { describe, expect, it } from 'vitest';
import { handle as intake } from '../../src/tools/brand.read.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const set = (document: any, slot: string, value: string) => { slot.split('.').reduce((node, key) => node[key], document).$value = value; };
const template = async () => clone((await intake({ action: 'template' } as never) as any).documents);
const validate = async (documents: unknown) => await intake({ action: 'validate', documents } as never) as any;

describe('s221-m02 high contrast is graded where Chromium resolves its system colours', () => {
  it('passes the template brand (brand A\'s high contrast): every text and icon on Canvas is CanvasText', async () => {
    const report = await validate(await template());
    expect(report.issues).toEqual([]);
    // s222-m01 (#2502 ruling 7): 84 pairs; the focus ring on the primary fill is the one not graded in hc, because the fill
    // is the platform's Highlight and the ring CanvasText, and a 2px Canvas gap keeps them apart.
    expect(report.contrast.hc).toMatchObject({ graded: 83, passed: 83, failed: 0, ungraded: 0, exempt: 1 });
    expect(report.contrast.hc.systemColoursResolvedIn).toMatch(/^Chromium [\d.]+ without forced colours \(macOS and Linux, light and dark/);
  });

  it('fails GrayText secondary text on Canvas, 3.95:1 in both light schemes', async () => {
    const documents = await template();
    set(documents.hc, 'text.secondary', 'GrayText');
    const report = await validate(documents);
    const onCanvas = report.issues.find((issue: any) => issue.pair?.id === 'text-secondary-on-canvas');
    expect(onCanvas).toMatchObject({ rule: 'contrast', theme: 'hc', ratio: 3.95, threshold: 4.5, resolutions: ['macOS light', 'Linux light'] });
    expect(report.valid).toBe(false);
  });

  it('fails HighlightText status text on Canvas: black on a dark Canvas on macOS, white on white on Linux', async () => {
    const documents = await template();
    set(documents.hc, 'status.info.text', 'HighlightText');
    const report = await validate(documents);
    const onCanvas = report.issues.find((issue: any) => issue.pair?.id === 'status-info-text-on-canvas');
    expect(onCanvas).toMatchObject({ rule: 'contrast', theme: 'hc', ratio: 1, resolutions: ['macOS dark', 'Linux light'] });
  });

  it('keeps HighlightText on the Highlight interactive surface, which passes on both platforms and schemes', async () => {
    const documents = await template();
    expect([['text.onInteractive', 'HighlightText'], ['surface.interactive.primary.default', 'Highlight']]
      .map(([slot]) => slot.split('.').reduce((node: any, key) => node[key], documents.hc).$value)).toEqual(['HighlightText', 'Highlight']);
    const report = await validate(documents);
    expect(report.issues.filter((issue: any) => issue.pair?.id?.startsWith('on-interactive'))).toEqual([]);
  });

  it('still refuses a pair that mixes a system colour with a fixed colour', async () => {
    const documents = await template();
    set(documents.hc, 'text.primary', '#000000');
    const report = await validate(documents);
    expect(report.issues.some((issue: any) => issue.rule === 'hc-mixed-pair' && issue.pair.id === 'text-primary-on-canvas')).toBe(true);
  });
});
