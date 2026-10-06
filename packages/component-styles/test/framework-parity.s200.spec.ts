import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const requireReact = createRequire(path.join(repoRoot, 'packages/components-react/package.json'));
const requireVue = createRequire(path.join(repoRoot, 'packages/components-vue/package.json'));
const React = requireReact('react') as typeof import('react');
const { renderToStaticMarkup } = requireReact('react-dom/server') as typeof import('react-dom/server');
const ReactComponents = requireReact('@oods/components-react') as typeof import('@oods/components-react');
const { h, createSSRApp } = requireVue('vue') as typeof import('vue');
const { renderToString } = requireVue('@vue/server-renderer') as { renderToString: (app: unknown) => Promise<string> };
const VueComponents = requireVue('@oods/components-vue') as typeof import('@oods/components-vue');
const componentCss = fs.readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8').replace(/^@import[^\n]+\n/gmu, '');
const statusableCss = fs.readFileSync(path.join(repoRoot, 'src/styles/statusables.css'), 'utf8');
const tokenCss = fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8');

const INTENTS = ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const WEIGHTS = ['regular', 'medium', 'semibold'] as const;
type Case = { id: string; react: React.ReactElement; vue: ReturnType<typeof h> };
const cases: Case[] = [
  ...INTENTS.flatMap(intent => SIZES.map(size => ({ id: `button-${intent}-${size}`, react: React.createElement(ReactComponents.Button, { intent, size, content: `${intent} ${size}` }), vue: h(VueComponents.Button, { intent, size, content: `${intent} ${size}` }) }))),
  { id: 'button-disabled', react: React.createElement(ReactComponents.Button, { disabled: true, content: 'disabled' }), vue: h(VueComponents.Button, { disabled: true, content: 'disabled' }) },
  { id: 'card', react: React.createElement(ReactComponents.Card, null, 'Card body'), vue: h(VueComponents.Card, null, () => 'Card body') },
  { id: 'card-elevated', react: React.createElement(ReactComponents.Card, { elevated: true }, 'Card body'), vue: h(VueComponents.Card, { elevated: true }, () => 'Card body') },
  ...SIZES.flatMap(size => WEIGHTS.map(weight => ({ id: `text-${size}-${weight}`, react: React.createElement(ReactComponents.Text, { size, weight, content: `${size} ${weight}` }), vue: h(VueComponents.Text, { size, weight, content: `${size} ${weight}` }) }))),
];
const RAW_UTILITY = /\b(?:bg|text|hover:bg|focus-visible:outline|rounded|shadow|h|px|leading|font|border|dark:bg|dark:text)-[a-z0-9/]+\b/;
const PROPERTIES = ['min-height', 'padding', 'border-radius', 'border-width', 'font-size', 'line-height', 'font-weight', 'background-color', 'color', 'box-shadow', 'opacity', 'cursor', 'outline-width', 'outline-style', 'outline-color', 'outline-offset'];

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

async function renderVue(node: ReturnType<typeof h>) { return renderToString(createSSRApp({ render: () => node })); }
const attributes = (html: string) => {
  const open = html.match(/^<[a-z]+([^>]*)>/i)![1]!;
  return Object.fromEntries([...open.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
};

describe('s200-m02 framework parity: Button, Card and Text render identically from the cmp roles', () => {
  it('emits the same class list and no raw utility class in either framework', async () => {
    for (const item of cases) {
      const react = renderToStaticMarkup(item.react);
      const vue = await renderVue(item.vue);
      const reactAttributes = attributes(react), vueAttributes = attributes(vue);
      expect(reactAttributes.class, item.id).toBe(vueAttributes.class);
      expect(reactAttributes.class, item.id).toMatch(/^oods-(?:button|card|text)$/);
      expect(reactAttributes.class, item.id).not.toMatch(RAW_UTILITY);
      expect(vueAttributes.class, item.id).not.toMatch(RAW_UTILITY);
      for (const name of ['data-oods-component', 'data-intent', 'data-size', 'data-elevated', 'data-weight']) expect(reactAttributes[name], `${item.id} ${name}`).toBe(vueAttributes[name]);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`computes the same chrome in both frameworks for A/${theme}, on the roles`, async () => {
      const markup = await Promise.all(cases.map(async item => ({ id: item.id, react: renderToStaticMarkup(item.react), vue: await renderVue(item.vue) })));
      const page = await browser.newPage({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
      try {
        await page.setContent(`<!doctype html><html data-brand="A" data-theme="${theme}"><head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head><body style="background:var(--sys-surface-canvas);color:var(--sys-text-primary)">
          ${markup.map(item => `<div data-case="${item.id}"><div data-framework="react">${item.react}</div><div data-framework="vue">${item.vue}</div></div>`).join('')}</body></html>`);
        const observed = await page.evaluate(properties => [...document.querySelectorAll('[data-case]')].map(section => {
          const read = (framework: string) => {
            const element = section.querySelector(`[data-framework="${framework}"] > *`) as HTMLElement;
            if (element.matches('button')) element.focus();
            const style = getComputedStyle(element);
            const values = Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
            element.blur();
            return values;
          };
          return { id: section.getAttribute('data-case'), react: read('react'), vue: read('vue') };
        }), PROPERTIES);
        const differences = observed.filter(row => JSON.stringify(row.react) !== JSON.stringify(row.vue)).map(row => `${row.id}: ${JSON.stringify(row.react)} vs ${JSON.stringify(row.vue)}`);
        expect(differences).toEqual([]);
        const byId = Object.fromEntries(observed.map(row => [row.id, row.react]));
        // The roles, not utilities, decide the chrome: control heights, the card radius and shadow, the focus ring.
        // s222-m01 (#2502 rulings 4 and 9): controls are 28/32/40 at sm/md/lg with 12px padding at md, brand A's radius 6.
        // s222-m02 (#2502 ruling 11): the height alone sets the block size, so the label is the 14/20 label role with no
        // block padding, and the md button is exactly as tall as the md input beside it.
        expect(byId['button-neutral-sm']!['min-height']).toBe('28px');
        expect(byId['button-neutral-md']!['min-height']).toBe('32px');
        expect(byId['button-neutral-lg']!['min-height']).toBe('40px');
        expect(byId['button-neutral-md']!['padding']).toBe('0px 12px');
        expect(byId['button-neutral-md']!['font-size']).toBe('14px');
        expect(byId['button-neutral-md']!['line-height']).toBe('20px');
        expect(byId['button-neutral-md']!['border-radius']).toBe('6px');
        expect(byId['button-neutral-md']!['outline-width']).toBe('2px');
        expect(byId['button-neutral-md']!['outline-style']).toBe('solid');
        expect(byId['button-neutral-md']!['outline-offset']).toBe('2px');
        expect(byId['button-success-md']!['background-color']).not.toBe(byId['button-neutral-md']!['background-color']);
        expect(byId['button-disabled']!['cursor']).toBe('not-allowed');
        expect(byId['card']!['border-radius']).toBe('12px');
        expect(byId['card']!['box-shadow']).toBe('none');
        expect(byId['card-elevated']!['box-shadow']).not.toBe('none');
        expect(byId['text-sm-regular']!['font-size']).toBe('14px');
        expect(byId['text-md-regular']!['font-size']).toBe('16px');
        expect(byId['text-lg-semibold']!['font-size']).toBe('18px');
        expect(byId['text-lg-semibold']!['font-weight']).toBe('600');
        expect(byId['text-md-medium']!['font-weight']).toBe('500');
      } finally { await page.close(); }
    }, 60_000);
  }
});
