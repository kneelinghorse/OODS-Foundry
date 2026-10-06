import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// s222-m02 (#2502 ruling 8): a heading inside a component reads on the type scale. A browser-default h2 (a bold 24px line)
// or h3 (bold 18.72px) beside the 600-weight role headings is what made 0.3 screens look unfinished, so every heading
// that any component's documented example renders must match one of the type roles' size, line height and weight.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const requireReact = createRequire(path.join(repoRoot, 'packages/components-react/package.json'));
const React = requireReact('react') as typeof import('react');
const { renderToStaticMarkup } = requireReact('react-dom/server') as typeof import('react-dom/server');
const ReactComponents = requireReact('@oods/components-react') as Record<string, unknown>;
const { componentContracts, sharedScenarios } = requireReact('@oods/component-contracts') as {
  componentContracts: Record<string, { events: string[] }>;
  sharedScenarios: Array<{ oodsComponentId: string; props?: Record<string, unknown>; slots?: Record<string, unknown> }>;
};
const componentCss = fs.readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8').replace(/^@import[^\n]+\n/gmu, '');
const statusableCss = fs.readFileSync(path.join(repoRoot, 'src/styles/statusables.css'), 'utf8');
const tokenCss = fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8');
const ROLES = ['display-lg', 'display-md', 'display-sm', 'heading-xl', 'heading-lg', 'heading-md', 'heading-sm', 'body-md', 'body-sm', 'label', 'label-md', 'caption', 'mono'];

// The documented example, built as the markup-parity check and the site build it: a handler per event, the default slot
// as text, actions as Buttons, any other slot as text.
function example(id: string): React.ReactElement | null {
  const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === id);
  const component = ReactComponents[id] as React.ComponentType<Record<string, unknown>> | undefined;
  if (!scenario || !component) return null;
  const handlers = Object.fromEntries(componentContracts[id]!.events.map((event) => [`on${event[0]!.toUpperCase()}${event.slice(1)}`, () => {}]));
  const named: Record<string, unknown> = {};
  let children: React.ReactNode;
  for (const [slot, value] of Object.entries(scenario.slots ?? {})) {
    const items = Array.isArray(value) ? value.map(String) : value === undefined || value === null ? [] : [String(value)];
    if (slot === 'default') children = Array.isArray(value) ? items.map((item, index) => React.createElement('div', { key: index }, item)) : items[0];
    else if (slot === 'actions') named.actions = items.map((item, index) => React.createElement(ReactComponents.Button as React.ComponentType<Record<string, unknown>>, { key: index, content: item }));
    else named[slot] = items.join(' ');
  }
  return React.createElement(component, { ...scenario.props, ...handlers, ...named }, children);
}

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

describe('s222-m02 headings inside components sit on the type roles', () => {
  it('renders no browser-default heading in any documented example', async () => {
    const ids = Object.keys(componentContracts).sort();
    const cases = ids.flatMap((id) => {
      const element = example(id);
      return element ? [`<section data-case="${id}">${renderToStaticMarkup(element)}</section>`] : [];
    });
    expect(cases.length).toBeGreaterThanOrEqual(100);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.setContent(`<!doctype html><html data-brand="A" data-theme="light"><head><style>${tokenCss}\n${statusableCss}\n${componentCss}</style></head><body>${cases.join('')}</body></html>`);
      const observed = await page.evaluate((roles) => {
        const read = (element: Element) => { const style = getComputedStyle(element); return `${style.fontSize}/${style.lineHeight}/${style.fontWeight}`; };
        const probe = document.createElement('span');
        document.body.append(probe);
        const triples = roles.map((role) => {
          probe.style.fontSize = `var(--sys-text-scale-${role}-font-size)`;
          probe.style.lineHeight = `var(--sys-text-scale-${role}-line-height)`;
          probe.style.fontWeight = `var(--sys-text-scale-${role}-font-weight)`;
          return read(probe);
        });
        const headings = [...document.querySelectorAll('[data-case] :is(h1, h2, h3, h4, h5, h6)')].map((heading) => ({
          id: (heading.closest('[data-case]') as HTMLElement).dataset.case, tag: heading.tagName.toLowerCase(), text: heading.textContent?.trim().slice(0, 40), style: read(heading),
        }));
        return { triples, headings };
      }, ROLES);
      // The roles resolve (a missing token would read as the probe's inherited 16px/24px/400 for all of them).
      expect(new Set(observed.triples).size).toBeGreaterThanOrEqual(9);
      expect(observed.headings.length).toBeGreaterThanOrEqual(20);
      expect(observed.headings.filter((heading) => !observed.triples.includes(heading.style))).toEqual([]);
    } finally { await page.close(); }
  }, 60_000);
});
