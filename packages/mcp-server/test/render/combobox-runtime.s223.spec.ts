/**
 * s223-m02 (#2527 ruling 11): the HTML renderer's Combobox and its inline runtime script, loaded as a page in Chromium and
 * driven key by key, the same walk as React's combobox.spec.tsx and Vue's combobox.spec.ts. A static page gets the same
 * behaviour as the frameworks: filtering, the keyboard, picking with the change report, the outside click, disabled
 * options skipped. The script is scoped to its combobox, runs once, leaks no globals, and without it the input still shows
 * the chosen label.
 */
import { createRequire } from 'node:module';

import { sharedScenarios } from '@oods/component-contracts';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { JSDOM } from 'jsdom';
import { chromium, type Browser, type Page } from 'playwright';
import { createElement } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderMappedComponent } from '../../src/render/component-map.js';
import { renderDocument } from '../../src/render/document.js';
import type { UiElement } from '../../src/schemas/generated.js';

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');
const example = sharedScenarios.find((scenario) => scenario.oodsComponentId === 'Combobox')!;

/** A render as its element tree: tags, sorted attributes (style normalized) and text; the node id and scripts aside. */
function tree(html: string): string {
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => attribute.name !== 'data-oods-node-id')
      .map((attribute) => [attribute.name.toLowerCase(), attribute.name === 'hidden' ? '' : attribute.name === 'style' ? attribute.value.replace(/\s+/g, '').replace(/;$/, '') : attribute.value])
      .sort(([a], [b]) => (a! < b! ? -1 : 1)).map(([name, value]) => `${name}=${value}`).join(' ');
    const text = [...element.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent?.trim()).join('');
    return `<${element.tagName.toLowerCase()} ${attributes}>${text}${[...element.children].filter((child) => child.tagName !== 'SCRIPT').map(walk).join('')}</>`;
  };
  return walk(new JSDOM(`<body>${html}</body>`).window.document.body.firstElementChild!);
}
let browser: Browser;

beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

function page(props: Record<string, unknown> = {}): string {
  const node = { id: 'country-node', component: 'Combobox', props: { ...example.props, id: 'country', ...props } } as UiElement;
  return renderDocument({ screenHtml: `<main><button type="button">Before</button>${renderMappedComponent(node)}<button type="button">After</button></main>`, brand: 'A', theme: 'light' });
}

async function load(props: Record<string, unknown> = {}, javaScriptEnabled = true): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 640, height: 640 }, javaScriptEnabled });
  const view = await context.newPage();
  await view.setContent(page(props));
  if (javaScriptEnabled) {
    await view.evaluate(() => {
      const scope = window as unknown as { __changes: Array<{ value: unknown; from: string }> };
      scope.__changes = [];
      document.addEventListener('change', (event) => scope.__changes.push({ value: (event as CustomEvent).detail?.value ?? null, from: (event.target as Element).tagName.toLowerCase() + ((event.target as HTMLInputElement).type === 'hidden' ? '[hidden]' : '') }));
    });
  }
  return view;
}

/** What the screen and the ARIA state say. */
const read = (view: Page) => view.evaluate(() => {
  const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const id = input.getAttribute('aria-activedescendant');
  const popup = document.querySelector<HTMLElement>('.oods-combobox__popup')!;
  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  return {
    value: input.value,
    expanded: input.getAttribute('aria-expanded'),
    popupShown: getComputedStyle(popup).display !== 'none',
    active: id ? document.getElementById(id)?.textContent ?? null : null,
    activeId: id,
    painted: options.filter((option) => option.dataset.active === 'true').map((option) => option.textContent),
    visible: options.filter((option) => getComputedStyle(option).display !== 'none').map((option) => option.textContent),
    selected: options.filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.textContent),
    checkShown: options.filter((option) => getComputedStyle(option.querySelector('.oods-combobox__check')!).visibility === 'visible').map((option) => option.textContent),
    empty: document.querySelector('.oods-combobox__empty')?.textContent ?? null,
    focused: document.activeElement === input,
    changes: (window as unknown as { __changes: Array<{ value: unknown; from: string }> }).__changes,
  };
});

async function keys(view: Page, ...names: string[]) {
  for (const name of names) await view.keyboard.press(name);
}

describe('HTML Combobox runtime (data-oods-runtime="combobox")', () => {
  it('Down opens the list at the first option and moves, skipping the disabled one and wrapping', async () => {
    const view = await load();
    await view.focus('#country');
    expect(await read(view)).toMatchObject({ expanded: 'false', popupShown: false, active: null });
    await keys(view, 'ArrowDown');
    expect(await read(view)).toMatchObject({ expanded: 'true', popupShown: true, active: 'Australia', painted: ['Australia'] });
    await keys(view, 'ArrowDown', 'ArrowDown', 'ArrowDown');
    expect((await read(view)).active).toBe('Germany');
    await keys(view, 'ArrowDown');
    expect((await read(view)).active).toBe('Mexico');
    await keys(view, 'ArrowDown', 'ArrowDown');
    expect((await read(view)).active).toBe('United States');
    await keys(view, 'ArrowDown');
    expect(await read(view)).toMatchObject({ active: 'Australia', focused: true });
    await view.context().close();
  });

  it('Up moves back and wraps; with the list closed it opens the list at the last option', async () => {
    const view = await load();
    await view.focus('#country');
    await keys(view, 'ArrowUp');
    expect(await read(view)).toMatchObject({ expanded: 'true', active: 'United States' });
    await keys(view, 'ArrowUp', 'ArrowUp');
    expect((await read(view)).active).toBe('Mexico');
    await keys(view, 'ArrowUp');
    expect((await read(view)).active).toBe('Germany');
    await keys(view, 'Home', 'ArrowUp');
    expect((await read(view)).active).toBe('United States');
    await view.context().close();
  });

  it('Home and End go to the ends of an open list, and move the caret while it is closed', async () => {
    const view = await load();
    await view.focus('#country');
    await keys(view, 'Home');
    expect(await view.evaluate(() => document.querySelector<HTMLInputElement>('#country')!.selectionStart)).toBe(0);
    await keys(view, 'End');
    expect(await view.evaluate(() => document.querySelector<HTMLInputElement>('#country')!.selectionStart)).toBe('Canada'.length);
    expect((await read(view)).expanded).toBe('false');
    await keys(view, 'ArrowDown', 'End');
    expect((await read(view)).active).toBe('United States');
    await keys(view, 'Home');
    expect((await read(view)).active).toBe('Australia');
    await view.context().close();
  });

  it('Enter picks the active option, closes the list, moves the check mark and reports one change', async () => {
    const view = await load();
    await view.focus('#country');
    expect((await read(view)).checkShown).toEqual(['Canada']);
    await keys(view, 'ArrowDown', 'ArrowDown', 'ArrowDown');
    expect((await read(view)).active).toBe('France');
    await keys(view, 'Enter');
    expect(await read(view)).toMatchObject({ value: 'France', expanded: 'false', popupShown: false, activeId: null, selected: ['France'], checkShown: ['France'], changes: [{ value: 'fr', from: 'div' }] });
    // Enter with the list closed does nothing, so a form around the field can submit.
    await keys(view, 'Enter');
    expect((await read(view)).changes).toHaveLength(1);
    await view.context().close();
  });

  it('Enter while an input method composes text picks nothing; the next plain Enter picks', async () => {
    const view = await load();
    await view.focus('#country');
    await keys(view, 'ArrowDown', 'ArrowDown', 'ArrowDown');
    await view.dispatchEvent('#country', 'keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    expect(await read(view)).toMatchObject({ expanded: 'true', active: 'France', changes: [] });
    await keys(view, 'Enter');
    expect((await read(view)).changes).toEqual([{ value: 'fr', from: 'div' }]);
    await view.context().close();
  });

  it('typing filters by a case-insensitive match on the label; an empty result says No matches and picks nothing', async () => {
    const view = await load();
    await view.fill('#country', '');
    await view.locator('#country').pressSequentially('uNiTeD');
    expect(await read(view)).toMatchObject({ expanded: 'true', visible: ['United Kingdom', 'United States'], activeId: null, empty: '' });
    await keys(view, 'ArrowDown', 'ArrowDown');
    expect((await read(view)).active).toBe('United States');
    await view.fill('#country', '');
    await view.locator('#country').pressSequentially('KING');
    expect((await read(view)).visible).toEqual(['United Kingdom']);
    await view.fill('#country', '');
    await view.locator('#country').pressSequentially('zz');
    expect(await read(view)).toMatchObject({ visible: [], empty: 'No matches', popupShown: true });
    expect(await view.evaluate(() => document.querySelector('.oods-combobox__empty')!.closest('[role="option"], [role="listbox"]'))).toBeNull();
    await keys(view, 'ArrowDown', 'Enter');
    expect(await read(view)).toMatchObject({ activeId: null, value: 'zz', changes: [] });
    await view.context().close();
  });

  it('Escape closes the list and keeps the text; a second Escape clears the field and reports an empty value', async () => {
    const view = await load();
    await view.fill('#country', '');
    await view.locator('#country').pressSequentially('ger');
    expect((await read(view)).expanded).toBe('true');
    await keys(view, 'Escape');
    expect(await read(view)).toMatchObject({ expanded: 'false', value: 'ger', changes: [] });
    await keys(view, 'Escape');
    expect(await read(view)).toMatchObject({ value: '', selected: [], changes: [{ value: '', from: 'div' }] });
    await keys(view, 'Escape');
    expect((await read(view)).changes).toHaveLength(1);
    await view.context().close();
  });

  it('Tab closes the list without picking, and leaving the field restores the chosen label', async () => {
    const view = await load();
    await view.fill('#country', '');
    await view.locator('#country').pressSequentially('fr');
    await keys(view, 'ArrowDown');
    expect((await read(view)).activeId).toBe('country-option-2');
    await keys(view, 'Tab');
    expect(await view.evaluate(() => document.activeElement?.textContent)).toBe('After');
    expect(await read(view)).toMatchObject({ expanded: 'false', value: 'Canada', changes: [] });
    await view.context().close();
  });

  it('a click opens the list, a click on an option picks it, a disabled option cannot be picked, and an outside click closes it', async () => {
    const view = await load();
    await view.click('#country');
    expect(await read(view)).toMatchObject({ expanded: 'true', visible: ['Australia', 'Canada', 'France', 'Germany', 'Japan', 'Mexico', 'United Kingdom', 'United States'] });
    // Playwright waits for an aria-disabled option to become enabled, so the click on Japan is forced.
    await view.click('[role="option"][data-value="jp"]', { force: true });
    expect(await read(view)).toMatchObject({ expanded: 'true', focused: true, changes: [] });
    await view.hover('[role="option"][data-value="mx"]');
    expect((await read(view)).activeId).toBe('country-option-5');
    await view.click('[role="option"][data-value="mx"]');
    expect(await read(view)).toMatchObject({ value: 'Mexico', expanded: 'false', focused: true, changes: [{ value: 'mx', from: 'div' }] });
    await view.click('#country');
    expect((await read(view)).expanded).toBe('true');
    await view.mouse.click(600, 600);
    expect(await read(view)).toMatchObject({ expanded: 'false', popupShown: false });
    expect((await read(view)).changes).toHaveLength(1);
    await view.context().close();
  });

  it('a named field reports the change from its hidden input, which carries the value rather than the label', async () => {
    const view = await load({ name: 'country' });
    expect(await view.inputValue('input[type="hidden"][name="country"]')).toBe('ca');
    await view.focus('#country');
    await keys(view, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
    expect(await view.inputValue('input[type="hidden"][name="country"]')).toBe('fr');
    expect((await read(view)).changes).toEqual([{ value: 'fr', from: 'input[hidden]' }]);
    expect(await view.getAttribute('#country', 'name')).toBeNull();
    await view.context().close();
  });

  it('a disabled combobox never opens', async () => {
    const view = await load({ disabled: true });
    await view.click('#country', { force: true });
    expect((await read(view)).expanded).toBe('false');
    await view.context().close();
  });

  it('runs once per combobox, stays scoped to it and leaks no globals', async () => {
    const view = await load();
    // A second copy of the script placed right after the same combobox finds it ready and adds no second set of handlers.
    await view.evaluate(() => {
      const original = document.querySelector('script[data-oods-runtime="combobox"]')!;
      const copy = document.createElement('script');
      copy.dataset.oodsRuntime = 'combobox';
      copy.textContent = original.textContent;
      original.before(copy);
    });
    await view.focus('#country');
    await keys(view, 'ArrowDown', 'ArrowDown');
    expect((await read(view)).active).toBe('Canada');
    expect(await view.evaluate(() => ['root', 'input', 'popup', 'list', 'options', 'query', 'active', 'pick', 'report', 'filter'].filter((name) => Object.prototype.hasOwnProperty.call(window, name)))).toEqual([]);
    expect(await view.evaluate(() => document.querySelector('[data-oods-component="Combobox"]')!.getAttribute('data-oods-combobox-ready'))).toBe('true');
    await view.context().close();
  });

  // The site shows one documented markup; a static page must be the React and Vue component, not a look-alike.
  it('writes the markup React and Vue render, element for element and attribute for attribute', async () => {
    const variants = [example.props, { ...example.props, size: 'lg', name: 'country', required: true, disabled: true, validation: { state: 'error', message: 'Choose a country' } }];
    for (const props of variants) {
      const react = tree(renderReact(createElement(ReactComponents.Combobox as never, props)));
      const vue = tree(await renderVue(h(VueComponents.Combobox, props)));
      const html = tree(renderMappedComponent({ id: 'node', component: 'Combobox', props } as UiElement));
      expect(vue).toBe(react);
      expect(html).toBe(react);
    }
  });

  // Authored strings are text: none can open an element or end the runtime script.
  it('escapes every authored string, so the runtime is the only script', () => {
    const hostile = '"><script>alert(1)</script>';
    const html = renderMappedComponent({ id: 'node', component: 'Combobox', props: {
      id: `x${hostile}`, label: hostile, placeholder: hostile, help: hostile, name: hostile, value: hostile,
      options: [{ value: hostile, label: hostile }, { value: 'ok', label: 'OK' }], validation: { state: 'error', message: hostile },
    } } as UiElement);
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('<script data-oods-runtime="combobox">');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toMatch(/="[^"]*"><script>/);
  });

  it('without the script the input still shows the chosen label', async () => {
    const view = await load({}, false);
    expect(await view.inputValue('#country')).toBe('Canada');
    expect(await view.getAttribute('#country', 'aria-expanded')).toBe('false');
    expect(await view.locator('.oods-combobox__popup').isHidden()).toBe(true);
    await view.context().close();
  });
});
