import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SUPPORTED_COMPONENT_THEME_CELLS } from '../src/index.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const componentCss = fs
  .readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8')
  .replace(/^@import[^\n]+\n/gmu, '');
const statusableCss = fs.readFileSync(path.join(repoRoot, 'src/styles/statusables.css'), 'utf8');
const tokenCss = fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8');

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

describe('Sprint 182 shared component-style browser corrections', () => {
  for (const cell of SUPPORTED_COMPONENT_THEME_CELLS) {
    for (const forcedColors of ['none', 'active'] as const) {
      it(`s185-m02 preserves visible color labels in ${cell.brand}/${cell.theme}, forcedColors=${forcedColors}`, async () => {
        const page = await browser.newPage({ forcedColors, viewport: { width: 640, height: 480 } });
        await page.setContent(`<!doctype html>
          <html data-brand="${cell.brand}" data-theme="${cell.theme}">
            <head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head>
            <body style="background:var(--sys-surface-canvas);color:var(--sys-text-primary)">
              <span id="system-pair" style="color:CanvasText;background:Canvas">System pair</span>
              <span data-oods-component="ColorSwatch" style="--oods-swatch-color:red">
                <span data-oods-swatch-chip="true" aria-hidden="true"></span>
                <span data-oods-swatch-label="true">Critical red</span>
              </span>
              ${['subtle', 'solid'].map((emphasis) => `
                <span data-oods-component="ColorizedBadge" data-emphasis="${emphasis}" style="--oods-badge-color:red">
                  <span class="oods-badge__icon" aria-hidden="true"><span data-oods-badge-marker="true"></span></span>
                  <span class="oods-badge__label"><span data-oods-badge-label="true">Past due</span></span>
                </span>`).join('')}
            </body>
          </html>`);
        const proof = await page.evaluate(() => {
          const systemPair = getComputedStyle(document.querySelector('#system-pair')!);
          const body = getComputedStyle(document.body);
          return {
            system: { color: systemPair.color, background: systemPair.backgroundColor },
            components: [...document.querySelectorAll('[data-oods-component]')].map((component) => {
              const rootStyle = getComputedStyle(component);
              const label = component.querySelector<HTMLElement>('[data-oods-swatch-label], [data-oods-badge-label]')!;
              const marker = component.querySelector<HTMLElement>('[data-oods-swatch-chip], [data-oods-badge-marker]')!;
              const style = getComputedStyle(label);
              return {
                text: label.innerText,
                labelWidth: label.getBoundingClientRect().width,
                labelHeight: label.getBoundingClientRect().height,
                visibility: style.visibility,
                color: style.color,
                background: rootStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? body.backgroundColor : rootStyle.backgroundColor,
                markerColor: getComputedStyle(marker).backgroundColor,
                markerWidth: marker.getBoundingClientRect().width,
                markerHeight: marker.getBoundingClientRect().height,
              };
            }),
          };
        });
        expect(proof.components.map((component) => component.text)).toEqual(['Critical red', 'Past due', 'Past due']);
        for (const component of proof.components) {
          expect(component.visibility).toBe('visible');
          expect(component.labelWidth).toBeGreaterThan(0);
          expect(component.labelHeight).toBeGreaterThan(0);
          expect(component.markerWidth).toBeGreaterThan(2);
          expect(component.markerHeight).toBeGreaterThan(2);
          expect(component.color).not.toBe(component.background);
          if (cell.theme === 'hc' || forcedColors === 'active') {
            expect(component.color).toBe(proof.system.color);
            expect(component.background).toBe(proof.system.background);
            expect(component.markerColor).toBe(proof.system.color);
          } else {
            expect(component.markerColor).toBe('rgb(255, 0, 0)');
          }
        }
        await page.close();
      }, 30_000);
    }
  }

  for (const cell of SUPPORTED_COMPONENT_THEME_CELLS) {
    it(`s192-m05 preserves nested collection row text contrast in ${cell.brand}/${cell.theme}`, async () => {
      const page = await browser.newPage({ forcedColors: cell.theme === 'hc' ? 'active' : 'none' });
      try {
        await page.setContent(`<html data-brand="${cell.brand}" data-theme="${cell.theme}"><head><style>${tokenCss}\n${componentCss}</style></head><body style="background:var(--sys-surface-canvas);color:var(--sys-text-primary)">
          <button class="oods-button oods-collection-row" data-oods-component="Button" data-intent="neutral"><span data-oods-component="Text">Record label</span><span data-oods-component="LabelCell"><span data-oods-label-cell-description>Record description</span></span></button></body></html>`);
        const ratios = await page.evaluate(() => {
          const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
          const luminance = (color: string) => {
            context.fillStyle = color; context.fillRect(0, 0, 1, 1);
            const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
            return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
          };
          const background = luminance(getComputedStyle(document.querySelector('button')!).backgroundColor);
          return [...document.querySelectorAll('[data-oods-component="Text"], [data-oods-label-cell-description]')].map(node => {
            const foreground = luminance(getComputedStyle(node).color);
            return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
          });
        });
        expect(ratios).toHaveLength(2);
        for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
      } finally { await page.close(); }
    });
  }

  it('s182-m01b keeps the Brand B light enabled action at or above 4.5:1', async () => {
    const page = await browser.newPage({
      colorScheme: 'light',
      forcedColors: 'none',
      viewport: { width: 480, height: 240 },
    });
    await page.setContent(`<!doctype html>
      <html data-brand="B" data-theme="light">
        <head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head>
        <body>
          <button class="oods-button" data-oods-component="Button" data-intent="primary" type="button"
            style="--cmp-button-background:var(--sys-surface-interactive-primary-default);--cmp-button-text:var(--sys-text-on-interactive)">Update card</button>
        </body>
      </html>`);

    const proof = await page.locator('.oods-button').evaluate((element) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas color resolver unavailable.');
      const rgba = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = '#010203';
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const luminance = ([red, green, blue]: number[]) => {
        const channels = [red, green, blue].map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const style = getComputedStyle(element);
      const foreground = luminance(rgba(style.color));
      const background = luminance(rgba(style.backgroundColor));
      return {
        color: style.color,
        background: style.backgroundColor,
        contrastRatio: (Math.max(foreground, background) + 0.05)
          / (Math.min(foreground, background) + 0.05),
        text: element.textContent?.trim(),
      };
    });

    expect(proof.text).toBe('Update card');
    expect(proof.color).not.toBe(proof.background);
    expect(proof.contrastRatio).toBeGreaterThanOrEqual(4.5);
    await page.close();
  }, 30_000);

  it('makes every locked style state observable without utility CSS', async () => {
    const page = await browser.newPage({
      colorScheme: 'light',
      viewport: { width: 1024, height: 1600 },
    });
    const statusStyle = [
      '--cmp-badge-background:var(--sys-status-critical-surface)',
      '--cmp-badge-border:var(--sys-status-critical-border)',
      '--cmp-badge-text:var(--sys-status-critical-text)',
    ].join(';');
    const bannerStyle = [
      '--cmp-banner-background:var(--sys-status-critical-surface)',
      '--cmp-banner-border:var(--sys-status-critical-border)',
      '--cmp-banner-text:var(--sys-status-critical-text)',
    ].join(';');
    await page.setContent(`<!doctype html>
      <html data-brand="A" data-theme="light">
        <head>
          <style>${tokenCss}\n${statusableCss}\n${componentCss}</style>
          <style>button, input, select, textarea { font: inherit; }</style>
        </head>
        <body>
          <span id="badge-subtle" class="oods-badge" data-oods-component="Badge" data-tone="critical" data-emphasis="subtle" style="${statusStyle}">Subtle</span>
          <span id="badge-solid" class="oods-badge" data-oods-component="Badge" data-tone="critical" data-emphasis="solid" style="${statusStyle}">Solid</span>
          <section id="banner-subtle" class="oods-banner" data-oods-component="Banner" data-tone="critical" data-emphasis="subtle" style="${bannerStyle}">Subtle</section>
          <section id="banner-solid" class="oods-banner" data-oods-component="Banner" data-tone="critical" data-emphasis="solid" style="${bannerStyle}">Solid</section>
          <section id="banner-react" class="oods-banner statusable-banner" data-oods-component="Banner">
            <div class="oods-banner__content statusable-banner__content"><strong class="oods-banner__title statusable-banner__title">Payment failed</strong></div>
          </section>
          <section id="banner-vue" class="oods-banner" data-oods-component="Banner">
            <div class="oods-banner-content"><strong class="oods-banner-title">Payment failed</strong></div>
          </section>
          <section id="banner-generic" class="statusable-banner"><strong class="statusable-banner__title">Generic status title</strong></section>
          <span id="probe-critical-solid" style="background:var(--sys-status-critical-solid);color:var(--sys-status-critical-on-solid)">Probe</span>

          ${['neutral', 'primary', 'secondary', 'success', 'warning', 'danger']
            .map((intent) => `<button id="button-${intent}" class="oods-button" data-oods-component="Button" data-intent="${intent}" data-size="md">${intent}</button>`)
            .join('')}
          <button id="button-sm" class="oods-button" data-oods-component="Button" data-intent="secondary" data-size="sm">Small</button>
          <button id="button-lg" class="oods-button" data-oods-component="Button" data-intent="primary" data-size="lg">Large</button>

          ${['sm', 'md', 'lg']
            .map((size) => `<span id="text-${size}" class="oods-text" data-oods-component="Text" data-size="${size}" data-weight="regular">${size}</span>`)
            .join('')}
          ${['normal', 'medium', 'semibold']
            .map((weight) => `<span id="text-${weight}" class="oods-text" data-oods-component="Text" data-size="md" data-weight="${weight}">${weight}</span>`)
            .join('')}

          ${['compact', 'default', 'comfortable']
            .map((density) => `<table id="table-${density}" class="oods-table" data-oods-component="Table" data-density="${density}"><tbody><tr><td>Cell</td></tr></tbody></table>`)
            .join('')}

          ${['sm', 'md', 'lg']
            .map((size) => `<div id="tabs-${size}" class="oods-tabs" data-oods-component="Tabs" data-size="${size}"><div class="oods-tab-list"><button class="oods-tab" role="tab" aria-selected="true">Tab</button></div></div>`)
            .join('')}
        </body>
      </html>`);

    const proof = await page.evaluate(() => {
      const colors = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          background: style.backgroundColor,
          border: style.borderTopColor,
          color: style.color,
        };
      };
      const button = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          ...colors(selector),
          boxSizing: style.boxSizing,
          minHeight: style.minHeight,
          fontSize: style.fontSize,
          paddingBlock: style.paddingBlock,
          paddingInline: style.paddingInline,
        };
      };
      const text = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return { fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
      };
      const cell = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(`${selector} td`)!);
        return { fontSize: style.fontSize, paddingBlock: style.paddingBlock, paddingInline: style.paddingInline };
      };
      const tab = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(`${selector} .oods-tab`)!);
        return { fontSize: style.fontSize, paddingBlock: style.paddingBlock, paddingInline: style.paddingInline };
      };
      return {
        badgeSubtle: colors('#badge-subtle'),
        badgeSolid: colors('#badge-solid'),
        criticalSolid: colors('#probe-critical-solid'),
        bannerSubtle: colors('#banner-subtle'),
        bannerSolid: colors('#banner-solid'),
        bannerTitleWeights: ['react', 'vue', 'generic'].map((variant) => text(`#banner-${variant} strong`).fontWeight),
        intents: Object.fromEntries(
          ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger']
            .map((intent) => [intent, button(`#button-${intent}`)]),
        ),
        buttonSm: button('#button-sm'),
        buttonLg: button('#button-lg'),
        text: Object.fromEntries(
          ['sm', 'md', 'lg', 'normal', 'medium', 'semibold']
            .map((value) => [value, text(`#text-${value}`)]),
        ),
        tables: Object.fromEntries(
          ['compact', 'default', 'comfortable']
            .map((density) => [density, cell(`#table-${density}`)]),
        ),
        tabs: Object.fromEntries(
          ['sm', 'md', 'lg'].map((size) => [size, tab(`#tabs-${size}`)]),
        ),
      };
    });

    // s222-m02 (#2502 ruling 11): a subtle badge and banner share the tint and text; solid is the tone's solid fill with
    // its graded text, not the reversed tint, for both.
    expect(proof.bannerSubtle.background).toBe(proof.badgeSubtle.background);
    expect(proof.bannerSubtle.color).toBe(proof.badgeSubtle.color);
    expect({ background: proof.badgeSolid.background, color: proof.badgeSolid.color }).toEqual({ background: proof.criticalSolid.background, color: proof.criticalSolid.color });
    expect({ background: proof.bannerSolid.background, color: proof.bannerSolid.color }).toEqual({ background: proof.criticalSolid.background, color: proof.criticalSolid.color });
    expect(proof.badgeSolid.background).not.toBe(proof.badgeSubtle.color);
    // Folding statusables into root CSS preserves OODS title emphasis without changing generic statusables. s222-m02:
    // the OODS title is 600, the heading weight, as the generic one is.
    expect(proof.bannerTitleWeights).toEqual(['600', '600', '600']);
    // s222-m02 (#2502 ruling 11): neutral is the outline look on the raised surface, so the six intents are six fills and
    // brand A's near-black primary is the only solid neutral one.
    expect(new Set(Object.values(proof.intents).map((intent) => intent.background))).toHaveLength(6);
    expect(proof.intents.primary.background).not.toBe(proof.intents.neutral.background);
    // s222-m01 (#2502 ruling 9): controls are 28/32/40 with 10/12/16px padding. s222-m02: the height alone centres the
    // label (14/20, 16/24 at lg), so there is no block padding.
    expect(proof.intents.primary).toMatchObject({
      boxSizing: 'border-box', minHeight: '32px', fontSize: '14px',
      paddingBlock: '0px', paddingInline: '12px',
    });
    expect(proof.buttonSm).toMatchObject({
      boxSizing: 'border-box', minHeight: '28px', fontSize: '14px',
      paddingBlock: '0px', paddingInline: '10px',
    });
    expect(proof.buttonLg).toMatchObject({
      boxSizing: 'border-box', minHeight: '40px', fontSize: '16px',
      paddingBlock: '0px', paddingInline: '16px',
    });

    // s222-m02 (#2502 ruling 8): sm and md are the body roles, 14/20 and 16/24.
    expect(proof.text.sm).toMatchObject({ fontSize: '14px', fontWeight: '400', lineHeight: '20px' });
    expect(proof.text.md).toMatchObject({ fontSize: '16px', fontWeight: '400', lineHeight: '24px' });
    // s222-m01 (#2502 ruling 8): the large text step is 18px (heading-md's size).
    expect(proof.text.lg).toMatchObject({ fontSize: '18px', fontWeight: '400', lineHeight: '25.2px' });
    expect(proof.text.normal.fontWeight).toBe('400');
    expect(proof.text.medium.fontWeight).toBe('500');
    expect(proof.text.semibold.fontWeight).toBe('600');

    // s222-m02 (#2502 rulings 9 and 11): rows take their height from the row tokens (44, 36 dense), so cells carry only
    // inline padding, 12 (8 dense), at the small body size.
    expect(proof.tables.compact).toEqual({ fontSize: '14px', paddingBlock: '0px', paddingInline: '8px' });
    expect(proof.tables.default).toEqual({ fontSize: '14px', paddingBlock: '0px', paddingInline: '12px' });
    expect(proof.tables.comfortable).toEqual(proof.tables.default);

    // s222-m02 (#2502 ruling 8): tabs are the label role, 14px (16 at lg).
    expect(proof.tabs.sm).toEqual({ fontSize: '14px', paddingBlock: '8px', paddingInline: '10px' });
    expect(proof.tabs.md).toEqual({ fontSize: '14px', paddingBlock: '10px', paddingInline: '12px' });
    expect(proof.tabs.lg).toEqual({ fontSize: '16px', paddingBlock: '12px', paddingInline: '16px' });
    await page.close();
  }, 30_000);

  it('styles classed and raw native fields without boxing Vue-shaped wrappers', async () => {
    const page = await browser.newPage({
      colorScheme: 'light',
      viewport: { width: 640, height: 640 },
    });
    await page.setContent(`<!doctype html>
      <html data-brand="A" data-theme="light">
        <head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head>
        <body>
          <div id="vue-input-wrapper" class="oods-field" data-oods-component="Input">
            <label for="vue-input">Email</label>
            <input id="vue-input" class="oods-field-control">
          </div>
          <div id="vue-date-wrapper" class="oods-date-picker" data-oods-component="DatePicker">
            <div id="vue-date-field" class="oods-field" data-oods-component="Input">
              <label for="vue-date">Renewal date</label>
              <input id="vue-date" class="oods-field-control" type="date">
            </div>
          </div>
          <div id="vue-select-wrapper" class="oods-field" data-oods-component="Select">
            <label for="vue-select">Plan</label>
            <select id="vue-select" class="oods-field-control"><option>Pro</option></select>
          </div>
          <div id="vue-textarea-wrapper" class="oods-field" data-oods-component="Textarea">
            <label for="vue-textarea">Notes</label>
            <textarea id="vue-textarea" class="oods-field-control">Notes</textarea>
          </div>
          <input id="raw-input" data-oods-component="Input">
          <input id="raw-date" data-oods-component="DatePicker" type="date">
          <select id="raw-select" data-oods-component="Select"><option>Pro</option></select>
          <textarea id="raw-textarea" data-oods-component="Textarea">Notes</textarea>
        </body>
      </html>`);

    const proof = await page.evaluate(() => {
      const box = (selector: string) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          background: style.backgroundColor,
          borderWidth: style.borderTopWidth,
          boxSizing: style.boxSizing,
          paddingBlock: style.paddingBlock,
          paddingInline: style.paddingInline,
        };
      };
      return {
        wrappers: [
          '#vue-input-wrapper',
          '#vue-date-wrapper',
          '#vue-date-field',
          '#vue-select-wrapper',
          '#vue-textarea-wrapper',
        ].map(box),
        controls: [
          '#vue-input',
          '#vue-date',
          '#vue-select',
          '#vue-textarea',
          '#raw-input',
          '#raw-date',
          '#raw-select',
          '#raw-textarea',
        ].map(box),
      };
    });

    for (const wrapper of proof.wrappers) {
      expect(wrapper).toMatchObject({
        background: 'rgba(0, 0, 0, 0)',
        borderWidth: '0px',
        boxSizing: 'content-box',
        paddingBlock: '0px',
        paddingInline: '0px',
      });
    }
    // s222-m02 (#2502 ruling 9): the md control height sets an input's and a select's block size, so they carry no block
    // padding; a textarea grows by its rows with 8px block padding.
    const textareas = new Set([3, 7]);
    for (const [index, control] of proof.controls.entries()) {
      expect(control).toMatchObject({
        borderWidth: '1px',
        boxSizing: 'border-box',
        paddingBlock: textareas.has(index) ? '8px' : '0px',
        paddingInline: '12px',
      });
      expect(control.background).not.toBe('rgba(0, 0, 0, 0)');
    }
    await page.close();
  }, 30_000);

  for (const brand of ['A', 'B'] as const) {
    it(`${brand} light/dark keeps the default disabled label distinct from its surface`, async () => {
      for (const theme of ['light', 'dark'] as const) {
        const page = await browser.newPage({
          colorScheme: theme,
          viewport: { width: 480, height: 240 },
        });
        await page.setContent(`<!doctype html>
          <html data-brand="${brand}" data-theme="${theme}">
            <head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head>
            <body><button class="oods-button" data-oods-component="Button" type="button" disabled>Unavailable</button></body>
          </html>`);
        const proof = await page.locator('.oods-button').evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            color: style.color,
            background: style.backgroundColor,
            text: element.textContent?.trim(),
          };
        });
        expect(proof.text).toBe('Unavailable');
        expect(proof.color, `${brand}/${theme}`).not.toBe(proof.background);
        await page.close();
      }
    }, 30_000);

    for (const forcedColors of ['none', 'active'] as const) {
      it(`${brand}/hc keeps status, validation, disabled, and dismiss controls legible with forcedColors=${forcedColors}`, async () => {
        const page = await browser.newPage({
          colorScheme: 'dark',
          forcedColors,
          viewport: { width: 800, height: 600 },
        });
        await page.setContent(`<!doctype html>
          <html data-brand="${brand}" data-theme="hc">
            <head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head>
            <body>
              <span class="oods-badge" data-oods-component="Badge" data-tone="critical" data-emphasis="solid"
                style="--cmp-badge-background:var(--sys-status-critical-surface);--cmp-badge-border:var(--sys-status-critical-border);--cmp-badge-text:var(--sys-status-critical-text)">Past due</span>
              <section class="oods-banner" data-oods-component="Banner" data-tone="critical" data-emphasis="subtle"
                style="--cmp-banner-background:var(--sys-status-critical-surface);--cmp-banner-border:var(--sys-status-critical-border);--cmp-banner-text:var(--sys-status-critical-text)">
                <span>Payment failed</span><button class="oods-banner-dismiss" type="button" aria-label="Dismiss">×</button>
              </section>
              <p class="oods-field-error">Enter a valid email</p>
              <button class="oods-button" data-oods-component="Button" type="button"
                style="--cmp-button-background:var(--sys-surface-interactive-primary-default);--cmp-button-text:var(--sys-text-on-interactive)">Update card</button>
              <button class="oods-button" data-oods-component="Button" type="button" disabled>Unavailable</button>
            </body>
          </html>`);

        const proof = await page.evaluate(() => {
          const colors = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector)!;
            const style = getComputedStyle(element);
            return {
              color: style.color,
              background: style.backgroundColor,
              border: style.borderColor,
              text: element.textContent?.trim(),
              forcedColorAdjust: style.forcedColorAdjust,
            };
          };
          const dismiss = document.querySelector<HTMLElement>('.oods-banner-dismiss')!;
          const dismissRect = dismiss.getBoundingClientRect();
          return {
            body: colors('body'),
            badge: colors('.oods-badge'),
            banner: colors('.oods-banner'),
            validation: colors('.oods-field-error'),
            enabled: colors('.oods-button:not(:disabled)'),
            disabled: colors('.oods-button:disabled'),
            dismiss: {
              ...colors('.oods-banner-dismiss'),
              width: dismissRect.width,
              height: dismissRect.height,
              label: dismiss.getAttribute('aria-label'),
            },
          };
        });

        expect(proof.badge.text).toBe('Past due');
        expect(proof.badge.color).toBe(proof.body.color);
        expect(proof.badge.color).not.toBe(proof.badge.background);
        expect(proof.banner.color).toBe(proof.body.color);
        expect(proof.banner.color).not.toBe(proof.banner.background);
        expect(proof.validation.color).toBe(proof.body.color);
        expect(proof.enabled.text).toBe('Update card');
        expect(proof.enabled.color).not.toBe(proof.enabled.background);
        expect(proof.enabled.forcedColorAdjust).toBe(forcedColors === 'active' ? 'none' : 'auto');
        expect(proof.disabled.text).toBe('Unavailable');
        expect(proof.disabled.color).not.toBe(proof.disabled.background);
        expect(proof.dismiss.label).toBe('Dismiss');
        // s222-m02 (#2502 ruling 11): the dismiss is a ghost icon button at the small control height, 28px.
        expect(proof.dismiss.width).toBe(28);
        expect(proof.dismiss.height).toBe(28);
        await page.close();
      }, 30_000);
    }
  }
});

describe('Research detail sidebar readability', () => {
  for (const theme of ['light', 'dark']) {
    it(`keeps claim and provenance regions separate at phone and desktop widths (${theme})`, async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(`<html data-brand="A" data-theme="${theme}"><head><style>${tokenCss}\n${componentCss}</style></head><body>
          <div data-layout="sidebar" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,24rem);gap:24px">
            <div data-sidebar-main><p>A research claim must stay readable beside its classification and source provenance.</p></div>
            <aside data-sidebar-aside><p>Supporting evidence — source and disposition</p></aside>
          </div></body></html>`);
        for (const width of [390, 820, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          const bounds = await page.evaluate(() => {
            const main = document.querySelector('[data-sidebar-main]')!.getBoundingClientRect();
            const aside = document.querySelector('[data-sidebar-aside]')!.getBoundingClientRect();
            return { main: main.toJSON(), aside: aside.toJSON(), documentWidth: document.documentElement.scrollWidth };
          });
          expect(bounds.documentWidth).toBe(width);
          if (width === 390) {
            expect(bounds.main.width).toBeGreaterThan(300);
            expect(bounds.aside.top).toBeGreaterThanOrEqual(bounds.main.bottom);
          } else {
            expect(bounds.aside.left).toBeGreaterThanOrEqual(bounds.main.right);
          }
        }
      } finally { await page.close(); }
    });
  }
});
