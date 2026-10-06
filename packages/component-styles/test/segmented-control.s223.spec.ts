import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * s223-m02 (#2527 ruling 10, #2502 ruling 9): the SegmentedControl look, measured in Chromium on the shipped stylesheet.
 * A size is the button's height at that size; the track is the subtle fill, the checked segment the raised surface with
 * a hairline ring and primary text, the others muted, every label at the control weight; in high contrast the checked
 * segment is Highlight with HighlightText and the others Canvas with a CanvasText border; the focus ring is the segment's.
 */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const requireReact = createRequire(path.join(repoRoot, 'packages/components-react/package.json'));
const React = requireReact('react') as typeof import('react');
const { renderToStaticMarkup } = requireReact('react-dom/server') as typeof import('react-dom/server');
const { Button, SegmentedControl } = requireReact('@oods/components-react') as typeof import('@oods/components-react');
const read = (file: string) => fs.readFileSync(path.join(packageRoot, file), 'utf8');
const componentsCss = read('src/components.css');
const shippedCss = [fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8'),
  ...[...componentsCss.matchAll(/^@import "\.\/([^"]+)";/gm)].map(([, file]) => (file === 'statusables.css'
    ? fs.readFileSync(path.join(repoRoot, 'src/styles/statusables.css'), 'utf8') : read(`src/${file}`))),
  componentsCss].map(css => css.replace(/^@import[^;]+;\s*/gm, '')).join('\n');

const SIZES = { xs: 24, sm: 28, md: 32, lg: 40 } as const;
const options = [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }];
const markup = Object.entries(SIZES).map(([size]) => `<section data-size-case="${size}"><button type="button" id="before-${size}">Before</button>${renderToStaticMarkup(
  React.createElement(SegmentedControl, { id: `period-${size}`, label: 'Billing period', options, value: 'quarterly', size: size as keyof typeof SIZES, onValueChange() {} }),
)}${renderToStaticMarkup(React.createElement(Button, { size: size as keyof typeof SIZES, content: 'Save' }))}</section>`).join('');

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

async function open(brand: 'A' | 'B', theme: 'light' | 'dark' | 'hc'): Promise<Page> {
  const page = await browser.newPage({ colorScheme: theme === 'light' ? 'light' : 'dark', forcedColors: theme === 'hc' ? 'active' : 'none' });
  await page.setContent(`<!doctype html><html data-brand="${brand}" data-theme="${theme}"><head><style>${shippedCss}</style></head><body style="background:var(--sys-surface-canvas)">${markup}</body></html>`);
  return page;
}

/** The computed colours of the checked and an unchecked segment, and what each role resolves to in the same page. */
const paints = (page: Page, roles: Record<string, [property: string, value: string]>) => page.evaluate((roles) => {
  const resolve = (property: string, value: string) => {
    const probe = document.createElement('span'); probe.style.setProperty(property, value); document.body.append(probe);
    const resolved = getComputedStyle(probe).getPropertyValue(property); probe.remove(); return resolved;
  };
  const segment = (checked: boolean) => [...document.querySelectorAll('[data-size-case="md"] .oods-segmented-control__option')]
    .find(option => Boolean(option.querySelector('input:checked')) === checked)!;
  const style = (element: Element) => { const value = getComputedStyle(element); return { background: value.backgroundColor, border: value.borderTopColor, color: value.color, weight: value.fontWeight }; };
  return { checked: style(segment(true)), unchecked: style(segment(false)),
    track: getComputedStyle(document.querySelector('[data-size-case="md"] [role="radiogroup"]')!).backgroundColor,
    roles: Object.fromEntries(Object.entries(roles).map(([name, [property, value]]) => [name, resolve(property, value)])) };
}, roles);

describe('s223-m02 SegmentedControl: one control height per size, on the roles', () => {
  for (const brand of ['A', 'B'] as const) it(`${brand}: each size is the button's height (24/28/32/40), with equal segments`, async () => {
    const page = await open(brand, 'light');
    try {
      const observed = await page.evaluate(() => [...document.querySelectorAll('[data-size-case]')].map(section => ({
        size: section.getAttribute('data-size-case'),
        control: section.querySelector('[role="radiogroup"]')!.getBoundingClientRect().height,
        button: section.querySelector('.oods-button')!.getBoundingClientRect().height,
        widths: [...section.querySelectorAll('.oods-segmented-control__option')].map(option => Math.round(option.getBoundingClientRect().width * 100)),
      })));
      for (const row of observed) {
        expect(row.control, `${brand} ${row.size}`).toBe(SIZES[row.size as keyof typeof SIZES]);
        expect(row.button, `${brand} ${row.size}`).toBe(row.control);
        expect(new Set(row.widths).size, `${brand} ${row.size} equal segments`).toBe(1);
      }
    } finally { await page.close(); }
  }, 60_000);

  for (const theme of ['light', 'dark'] as const) it(`A/${theme}: the checked segment is raised, ringed and primary; the others muted; all at 500`, async () => {
    const page = await open('A', theme);
    try {
      const seen = await paints(page, {
        raised: ['background-color', 'var(--sys-surface-raised)'], ring: ['border-top-color', 'var(--sys-border-subtle)'],
        primary: ['color', 'var(--sys-text-primary)'], muted: ['color', 'var(--sys-text-muted)'],
        fill: ['background-color', 'var(--sys-surface-interactive-secondary-default)'],
      });
      expect(seen.checked).toEqual({ background: seen.roles.raised, border: seen.roles.ring, color: seen.roles.primary, weight: '500' });
      expect(seen.unchecked).toMatchObject({ color: seen.roles.muted, weight: '500', background: 'rgba(0, 0, 0, 0)' });
      expect(seen.track).toBe(seen.roles.fill);
    } finally { await page.close(); }
  }, 60_000);

  it('hc: the checked segment is Highlight with HighlightText; the others Canvas and CanvasText with a CanvasText border', async () => {
    const page = await open('B', 'hc');
    try {
      const seen = await paints(page, { highlight: ['background-color', 'Highlight'], highlightText: ['color', 'HighlightText'],
        canvas: ['background-color', 'Canvas'], canvasText: ['color', 'CanvasText'] });
      expect(seen.checked).toMatchObject({ background: seen.roles.highlight, color: seen.roles.highlightText });
      expect(seen.unchecked).toMatchObject({ background: seen.roles.canvas, border: seen.roles.canvasText, color: seen.roles.canvasText });
    } finally { await page.close(); }
  }, 60_000);

  it('keeps every label whole: five options at md fit a 390px phone without cutting a label or scrolling the page', async () => {
    const five = ['Day', 'Week', 'Month', 'Quarter', 'Year'].map(label => ({ value: label.toLowerCase(), label }));
    const page = await browser.newPage({ viewport: { width: 390, height: 300 } });
    try {
      await page.setContent(`<!doctype html><html data-brand="A" data-theme="light"><head><style>${shippedCss}</style></head><body style="margin:0;padding:16px">${renderToStaticMarkup(
        React.createElement(SegmentedControl, { id: 'phone', label: 'Reporting period', options: five, defaultValue: 'week' }))}</body></html>`);
      const fit = await page.evaluate(() => {
        const track = document.querySelector('[role="radiogroup"]')!.getBoundingClientRect();
        const field = document.querySelector('[data-oods-component="SegmentedControl"]')!.getBoundingClientRect();
        const labels = [...document.querySelectorAll('.oods-segmented-control__label')] as HTMLElement[];
        return { inField: track.right <= field.right + 0.5, pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          cut: labels.filter(label => label.getBoundingClientRect().width + 0.5 < label.scrollWidth).length };
      });
      expect(fit).toEqual({ inField: true, pageScrolls: false, cut: 0 });
    } finally { await page.close(); }
  }, 60_000);

  it('Tab lands on the checked option, and the shared focus ring outlines its whole segment', async () => {
    const page = await open('A', 'light');
    try {
      await page.focus('#before-md');
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const active = document.activeElement as HTMLInputElement;
        const segment = active.closest('.oods-segmented-control__option') as HTMLElement;
        const a = active.getBoundingClientRect(); const s = segment.getBoundingClientRect(); const style = getComputedStyle(active);
        return { value: active.value, visible: active.matches(':focus-visible'), outline: `${style.outlineWidth} ${style.outlineStyle}`,
          fills: Math.abs(a.width - segment.clientWidth) < 0.5 && Math.abs(a.height - segment.clientHeight) < 0.5 && Math.abs(a.left - s.left - segment.clientLeft) < 0.5 };
      });
      expect(focus).toEqual({ value: 'quarterly', visible: true, outline: '2px solid', fills: true });
    } finally { await page.close(); }
  }, 60_000);
});
