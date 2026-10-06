/**
 * s221-m02: what @oods/tokens ships for the website's findings 2, 3 and 6 (message 16978d69) and its font request
 * (message dfc707d1), each held where a person would see it fail.
 * - High contrast (ruling 3): outside forced colours HighlightText is black on a macOS dark Canvas and white on a Linux
 *   light one, and GrayText is 3.94:1 on white. So in the hc scopes HighlightText paints only text on the Highlight
 *   interactive surface, GrayText only disabled text, and the focus ring on Canvas is CanvasText.
 * - Any scope (ruling 4): a custom property resolves its var() where it is declared, so a panel with its own data-brand
 *   and data-theme kept the page's --sys-* roles and component colours. Measured in Chromium, a nested scope now paints
 *   what a page in that scope paints.
 * - Font (ruling 6): DM Sans ships in the package, declared by tokens.css beside it, with its licence and provenance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../../..');
const tokensDir = path.join(root, 'packages/tokens');
const tokensCss = fs.readFileSync(path.join(tokensDir, 'dist/css/tokens.css'), 'utf8');
// The component stylesheet as it ships, without its package @import of the tokens (the page inlines them first).
const componentCss = ['statusables.css', 'components.css']
  .map(file => fs.readFileSync(path.join(root, 'packages/component-styles/dist', file), 'utf8').replace(/^@import[^\n]+\n/gmu, '')).join('\n');
const byScope = JSON.parse(fs.readFileSync(path.join(tokensDir, 'dist/css-variables-by-scope.json'), 'utf8'));

describe('s221-m02 high contrast: CanvasText on Canvas, HighlightText only on Highlight', () => {
  for (const brand of ['A', 'B']) {
    const hc: Record<string, string> = byScope[brand].hc;
    const roles = (value: string) => Object.keys(hc).filter(name => /^--oods-(?:sys|cmp)-/.test(name) && hc[name] === value).sort();

    it(`brand ${brand}: HighlightText paints only text on the interactive surface`, () => {
      expect(roles('HighlightText').filter(name => !/on-interactive/.test(name))).toEqual([]);
      expect(hc['--oods-sys-text-on-interactive']).toBe('HighlightText');
      expect(hc['--oods-sys-surface-interactive-primary-default']).toBe('Highlight');
    });

    it(`brand ${brand}: secondary, muted, status text and icons and the focus ring are CanvasText; GrayText is only disabled text`, () => {
      for (const role of ['text-secondary', 'text-muted', 'focus-ring-outer', 'focus-text',
        ...['info', 'success', 'warning', 'critical', 'accent'].flatMap(status => [`status-${status}-text`, `status-${status}-icon`])]) {
        expect(hc[`--oods-sys-${role}`], role).toBe('CanvasText');
      }
      expect(roles('GrayText').filter(name => !/disabled/.test(name))).toEqual([]);
    });
  }
});

describe('s221-m02 a theme set on any element', () => {
  let browser: Browser;
  beforeAll(async () => { browser = await chromium.launch(); });
  afterAll(async () => { await browser?.close(); });

  const sysRoles = [...new Set([...tokensCss.matchAll(/^\s*(--sys-[\w-]+)\s*:/gm)].map(match => match[1]!))];
  // A design-system Button beside the probe: the hc component rules must also stop at a panel that sets another theme.
  const probe = `<div id="probe" style="background:var(--sys-surface-canvas);color:var(--sys-text-primary);border:1px solid var(--cmp-border-default)">probe<button class="oods-button" data-oods-component="Button" data-intent="primary">Save</button></div>`;
  async function measure(html: string): Promise<{ roles: Record<string, string>; paint: Record<string, string> }> {
    const page = await browser.newPage();
    try {
      await page.setContent(html);
      return await page.evaluate((names) => {
        const style = getComputedStyle(document.querySelector('#probe')!);
        return { roles: Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()])),
          paint: { background: style.backgroundColor, color: style.color, border: style.borderTopColor,
            button: getComputedStyle(document.querySelector('#probe button')!).backgroundColor } };
      }, sysRoles);
    } finally { await page.close(); }
  }
  const page = (brand: string, theme: string, body: string) => `<!doctype html><html data-brand="${brand}" data-theme="${theme}"><head><style>${tokensCss}\n${componentCss}</style></head><body>${body}</body></html>`;

  for (const [outer, inner] of [[['A', 'light'], ['A', 'dark']], [['A', 'light'], ['B', 'hc']], [['B', 'dark'], ['A', 'light']], [['B', 'hc'], ['A', 'dark']]] as const) {
    it(`a ${inner.join('/')} panel inside a ${outer.join('/')} page paints as a ${inner.join('/')} page does`, async () => {
      const nested = await measure(page(outer[0], outer[1], `<section data-brand="${inner[0]}" data-theme="${inner[1]}">${probe}</section>`));
      const reference = await measure(page(inner[0], inner[1], probe));
      const pageItself = await measure(page(outer[0], outer[1], probe));
      expect(sysRoles.length).toBeGreaterThan(100);
      expect(nested.roles).toEqual(reference.roles);
      expect(nested.paint).toEqual(reference.paint);
      expect(nested.paint).not.toEqual(pageItself.paint);
    });
  }
});

// s222-m01 (#2503): Geist and Geist Mono are the default faces and DM Sans stays for the brands that name it; each is
// shipped the same way s221-m02 shipped DM Sans.
describe('s221-m02 the shipped fonts come with the tokens', () => {
  const notice = fs.readFileSync(path.join(tokensDir, 'NOTICE'), 'utf8');
  const faces = [...tokensCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(match => match[1]!);

  it('declares each face with a file beside the stylesheet, never a network URL', () => {
    expect(faces.length).toBe(6);
    expect(faces.map(face => /font-family:\s*'([^']+)'/.exec(face)?.[1]).sort()).toEqual(['DM Sans', 'DM Sans', 'Geist', 'Geist', 'Geist Mono', 'Geist Mono']);
    for (const face of faces) {
      const file = /url\('\.\.\/fonts\/([\w.-]+\.woff2)'\)/.exec(face)?.[1];
      expect(file, face).toBeTruthy();
      expect(fs.existsSync(path.join(tokensDir, 'dist/fonts', file!))).toBe(true);
    }
    expect(tokensCss).not.toMatch(/url\(['"]?https?:/);
  });

  it('names every font file with its sha256 in NOTICE under the SIL Open Font License 1.1', () => {
    expect(notice).toContain('SIL OPEN FONT LICENSE Version 1.1');
    for (const file of fs.readdirSync(path.join(tokensDir, 'dist/fonts'))) {
      const sha = createHash('sha256').update(fs.readFileSync(path.join(tokensDir, 'dist/fonts', file))).digest('hex');
      expect(notice, file).toContain(`dist/fonts/${file}`);
      expect(notice, file).toContain(sha);
    }
  });

  it('names its fallbacks once quoted, so each is a font family a browser can match', () => {
    const sans = /--ref-typography-families-sans:\s*([^;]+);/.exec(tokensCss)![1]!;
    expect(sans).toBe("Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif");
    expect(tokensCss).not.toMatch(/'"|"'/);
  });
});
