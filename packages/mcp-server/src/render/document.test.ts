import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inlineTokenFonts, readTokensCssForDocument, renderDocument, resetTokensCssCache } from './document.js';

describe('renderDocument', () => {
  it('produces a valid standalone HTML5 document with defaults', () => {
    const html = renderDocument({
      screenHtml: '<section data-oods-component="Card">Hello</section>',
    });

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="en" data-theme="light" data-brand="default">');
    expect(html).toContain('<head>');
    expect(html).toContain('<body data-theme="light" data-brand="default">');
    expect(html).toContain('<main id="oods-preview-root"><section data-oods-component="Card">Hello</section></main>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('uses provided schema theme and explicit brand/title overrides', () => {
    const html = renderDocument({
      screenHtml: '<div>Preview</div>',
      schema: { theme: 'dark' },
      brand: 'A',
      title: 'Workbench Preview',
    });

    expect(html).toContain('<html lang="en" class="dark" data-theme="dark" data-brand="A">');
    expect(html).toContain('<body data-theme="dark" data-brand="A">');
    expect(html).toContain('<title>Workbench Preview</title>');
  });

  it('inlines tokens CSS and component CSS blocks', () => {
    const html = renderDocument({
      screenHtml: '<div>Tokens</div>',
      componentCss: '.custom-preview { outline: 1px solid red; }',
    });
    const tokensCss = readTokensCssForDocument();

    expect(tokensCss.length).toBeGreaterThan(0);
    expect(html).toContain('<style data-source="tokens">');
    expect(html).toContain('<style data-source="components">');
    expect(html).toContain('--ref-border-radius-md');
    expect(html).toContain("[data-oods-component='Button']");
    expect(html).toContain('.custom-preview { outline: 1px solid red; }');
  });

  it('uses --sys-* semantic tokens in component CSS', () => {
    const html = renderDocument({ screenHtml: '<div>Test</div>' });

    expect(html).toContain('var(--sys-surface-canvas');
    expect(html).toContain('var(--sys-text-primary');
    expect(html).toContain('var(--sys-surface-interactive-primary-default');
    expect(html).toContain('var(--sys-text-on-interactive');
    expect(html).toContain('var(--sys-border-subtle');
    expect(html).toContain('var(--sys-surface-raised');
    expect(html).toContain('var(--cmp-button-background');
    // Reference tokens remain as fallbacks
    expect(html).toContain('var(--sys-surface-canvas');
    expect(html).toContain('var(--ref-border-radius-md');
  });

  it('wires the inverse-surface tokens into an inert [data-oods-surface="inverse"] rule (sprint-120 m02)', () => {
    // B1 surface-aware-text: the rule consumes the already-present --sys-text-inverse
    // + --sys-surface-inverse tokens. It is a pure-projection (#875) addition — a
    // string assertion is the right test because NOTHING emits the marker, so there
    // is no end-to-end behavior to exercise; this guards against the wiring regressing.
    const html = renderDocument({ screenHtml: '<div>Test</div>' });
    const inverseBlock = html.slice(html.indexOf('[data-oods-surface="inverse"]'));

    expect(html).toContain('[data-oods-surface="inverse"]');
    expect(inverseBlock).toContain('var(--sys-surface-inverse');
    expect(inverseBlock).toContain('var(--sys-text-inverse');
    // Full token CSS supplies the semantic scope for this document.
  });

  it('forces the Button to inherit the surface sans font (sprint-119 m02)', () => {
    // A native <button> does NOT inherit font-family by default (the UA paints it
    // in -webkit-small-control), so without an explicit `inherit` a tokens-styled
    // Button renders in the platform font instead of the root's font.family.sans
    // (#oods-preview-root sets --ref-typography-families-sans). `inherit` resolves
    // up to that root rule — and to a brand override delivered via the client overlay.
    const html = renderDocument({ screenHtml: '<div>Test</div>' });
    const buttonBlock = html.slice(html.indexOf("[data-oods-component='Button']"));
    expect(buttonBlock).toContain('font: inherit;');
  });

  it('injects dark theme overrides when theme is dark', () => {
    const html = renderDocument({
      screenHtml: '<div>Dark</div>',
      theme: 'dark',
    });

    expect(html).toContain('<style data-source="theme-overrides">');
    expect(html).toContain('--theme-surface-canvas: var(--theme-dark-surface-canvas)');
    expect(html).toContain('--theme-text-primary: var(--theme-dark-text-primary)');
    expect(html).toContain('--theme-text-muted: var(--theme-dark-text-muted)');
    expect(html).toContain('--theme-border-subtle: var(--theme-dark-border-subtle)');
    expect(html).toContain('--theme-status-info-surface: var(--theme-dark-status-info-surface)');
  });

  it('does not inject dark theme overrides for light theme', () => {
    const html = renderDocument({
      screenHtml: '<div>Light</div>',
      theme: 'light',
    });

    expect(html).not.toContain('data-source="theme-overrides"');
  });

  it('escapes title/attributes and returns well-formed closing tags', () => {
    const html = renderDocument({
      screenHtml: '<div>Escaped</div>',
      title: '<unsafe>',
      theme: 'light"quoted',
      brand: "default'brand",
    });

    expect(html).toContain('<title>&lt;unsafe&gt;</title>');
    expect(html).toContain('data-theme="light&quot;quoted"');
    expect(html).toContain('data-brand="default&#39;brand"');
    expect(html.endsWith('</html>')).toBe(true);
  });

  // s222-m02 (#2502 ruling 8): the page takes the brand's sans from the root rule; the base CSS named Arial for the body, so
  // every HTML render read in Arial whatever the brand.
  it('lets the body inherit the brand font instead of naming one', () => {
    const html = renderDocument({ screenHtml: '<div>Test</div>', brand: 'B' });
    expect(html).not.toMatch(/body \{[^}]*font-family/);
    expect(html).toContain('font-family: var(--sys-font-sans);');
  });

  // s222-m02 (#2502 rulings 9 and 11): the shipped button is its control height with 12px side padding and the label role;
  // no block padding sets its height.
  it('uses the same button geometry and font tokens as the shipped component stylesheet', () => {
    const html = renderDocument({ screenHtml: '<div>Test</div>' });
    expect(html).toContain('--oods-button-block-size: var(--cmp-button-height, 2rem)');
    expect(html).toContain('--oods-button-padding-inline: var(--cmp-button-padding-inline, 0.75rem)');
    expect(html).toContain('--oods-button-font-size: var(--sys-text-scale-label-font-size, 14px)');
    expect(html).toContain('padding: var(--oods-button-padding-block, 0) var(--oods-button-padding-inline);');
  });

  it.each([
    ['--oods-size-spacing-sm', '--oods-button-padding-block'],
    ['--oods-size-spacing-md', '--oods-button-padding-inline'],
    ['--oods-size-font-md', '--oods-button-font-size'],
  ])('keeps the explicit legacy %s overlay connected to the real button property %s', (source, target) => {
    const html = renderDocument({ screenHtml: '<div>Test</div>', componentCss: `:root { ${source}: 10px; }` });
    expect(html).toContain(`${target}: var(${source});`);
    // The target is read, with or without a fallback (s222-m02: the block padding defaults to 0).
    expect(html).toMatch(new RegExp(`var\\(${target}[,)]`));
    expect(renderDocument({ screenHtml: '<div>Test</div>' })).not.toContain(`${target}: var(${source});`);
  });

  it('inlines an inline tokenOverlay :root override into the components <style> (sprint-121 m05)', () => {
    // The repl render path resolves a tokenOverlay to a scoped :root{} block and passes it as
    // componentCss; renderDocument must emit it into the raw <style data-source="components">.
    const overlayBlock = ':root {\n  --oods-size-spacing-sm: 10px;\n}\n';
    const html = renderDocument({ screenHtml: '<div>Test</div>', componentCss: overlayBlock });
    const componentsStyle = html.slice(html.indexOf('<style data-source="components">'));
    expect(componentsStyle).toContain(':root {\n  --oods-size-spacing-sm: 10px;\n}');
    // ...and the Button still references that exact var, so the override actually lands on it.
    expect(componentsStyle).toContain('var(--oods-size-spacing-sm)');
  });

  it('omits any token override when no componentCss overlay is supplied (default-absent) (sprint-121 m05)', () => {
    const html = renderDocument({ screenHtml: '<div>Test</div>' });
    expect(html).not.toContain('--oods-size-spacing-sm: 10px');
  });
});

describe('s224-m01 (#2542 ruling 7): an HTML document that embeds the fonts carries their notice', () => {
  // The SIL OFL 1.1 asks every copy of the fonts to carry their copyright notice and the licence. A generated HTML file
  // embeds Geist, Geist Mono and DM Sans and travels on its own, so 0.4.1's comment ("SIL OFL 1.1, see NOTICE") pointed at
  // a file it never had beside it.
  const notice = fs.readFileSync(fileURLToPath(new URL('../../../../NOTICE', import.meta.url)), 'utf8');
  const licence = notice.slice(notice.indexOf('SIL OPEN FONT LICENSE Version 1.1'), notice.indexOf('OTHER DEALINGS IN THE FONT SOFTWARE.') + 'OTHER DEALINGS IN THE FONT SOFTWARE.'.length);
  const copyrights = ['Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)', 'Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)'];
  const fontsDir = fileURLToPath(new URL('../../../tokens/dist/fonts', import.meta.url));
  const stylesheet = "/* Geist, Geist Mono and DM Sans ship in this package (SIL OFL 1.1, see NOTICE); they load from ../fonts beside this file. */\n@font-face { font-family: 'Geist'; src: url('../fonts/geist-latin-wght-normal.woff2') format('woff2'); }";

  it('carries each font\'s copyright line and the licence text, read from NOTICE, ahead of the fonts it embeds', () => {
    resetTokensCssCache();
    const html = renderDocument({ screenHtml: '<div>Fonts</div>' });
    expect(html).toContain("url('data:font/woff2;base64,");
    expect(html).not.toContain('see NOTICE');
    expect(licence.length).toBeGreaterThan(4000);
    expect(html).toContain(licence);
    for (const line of copyrights) {
      expect(notice, line).toContain(line);
      expect(html, line).toContain(line);
    }
    expect(html.indexOf(licence)).toBeLessThan(html.indexOf('data:font/woff2'));
  });

  it('embeds no font without the notice: an unreadable NOTICE leaves the stylesheet as it was', () => {
    expect(inlineTokenFonts(stylesheet, fontsDir, '/nonexistent/NOTICE')).toBe(stylesheet);
    const inlined = inlineTokenFonts(stylesheet, fontsDir);
    expect(inlined).toContain("url('data:font/woff2;base64,");
    expect(inlined).toContain(copyrights[1]);
    expect(inlined).not.toContain('see NOTICE');
    // A stylesheet that names no font it can embed is left alone, and no NOTICE is read for it.
    expect(inlineTokenFonts(':root { --x: 1; }', fontsDir, '/nonexistent/NOTICE')).toBe(':root { --x: 1; }');
  });
});

describe('loadTokensCss empty-read race guard (sprint-124 m04 / #554)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetTokensCssCache();
  });

  it('does NOT cache a zero-length read — a mid-rebuild rimraf must not poison the cache', () => {
    // WHY this matters: caching '' from a transient empty read makes EVERY later
    // render serve empty tokens.css, faking a size/render regression (#554/#902).
    // The guard must keep '' uncached so the next render re-reads after the rebuild.
    resetTokensCssCache();
    const spy = vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    // Rebuild in flight: report the missing styling and retry on the next read.
    expect(readTokensCssForDocument).toThrow(expect.objectContaining({ opiCode: 'OODS-N011' }));
    // Rebuild completes; the very next read MUST re-read and pick up the content.
    spy.mockReturnValue(':root { --proof: 1; }');
    expect(readTokensCssForDocument()).toBe(':root { --proof: 1; }');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('caches a non-empty read once — steady state does not re-read on the second call', () => {
    resetTokensCssCache();
    const spy = vi.spyOn(fs, 'readFileSync').mockReturnValue(':root { --x: 1; }');
    expect(readTokensCssForDocument()).toBe(':root { --x: 1; }');
    expect(readTokensCssForDocument()).toBe(':root { --x: 1; }');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports missing tokens and retries rather than caching an unstyled success', () => {
    resetTokensCssCache();
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw err;
    });
    expect(readTokensCssForDocument).toThrow(expect.objectContaining({ opiCode: 'OODS-N011' }));
    expect(readTokensCssForDocument).toThrow(expect.objectContaining({ opiCode: 'OODS-N011' }));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
