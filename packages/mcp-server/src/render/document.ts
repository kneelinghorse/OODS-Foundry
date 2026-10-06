import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UiSchema } from '../schemas/generated.js';
import { escapeHtml } from './escape-html.js';
import { ToolError } from '../errors/tool-error.js';
import { tokenPackageRoot } from '../lib/token-build.js';

export type RenderDocumentInput = {
  screenHtml: string;
  schema?: Pick<UiSchema, 'theme'>;
  brand?: string;
  theme?: string;
  title?: string;
  componentCss?: string;
  lang?: string;
  compact?: boolean;
};


// Both the source tree and the release archive keep the styles package beside mcp-server. s222-m02 (#2502 ruling 11):
// components.css imports statusables.css, then components-overlay.css (Switch and Dialog), ahead of its own rules; the
// imports are stripped here, so the files are inlined in that order.
function fullComponentCss(): string {
  const root = fileURLToPath(new URL('../../../component-styles/dist/', import.meta.url));
  // s223-m02 (#2527 ruling 11): components.css imports components-combobox.css after the overlay sheet.
  // s223-m02 (#2527 ruling 10): then components-segmented-control.css.
  return ['statusables.css', 'components-overlay.css', 'components-combobox.css', 'components-segmented-control.css', 'components.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^@import[^;]+;\s*/gm, '')).join('\n');
}

// s222-m02 (#2502 ruling 8): the body inherits the brand's sans and line height from the root rule in components.css; it
// named Arial, so every HTML render read in Arial whatever the brand.
const DOCUMENT_BASE_CSS = `
[data-oods-html-page] [hidden] { display: none !important; }
body { margin: 0; background: var(--sys-surface-canvas, Canvas); color: var(--sys-text-primary, CanvasText); }
#oods-preview-root { box-sizing: border-box; min-height: 100dvh; max-width: 90rem; margin: auto; padding: 1.5rem; }
[data-oods-component] { box-sizing: border-box; min-width: 0; }
[data-sidebar-aside="true"] { border-left: 1px solid var(--sys-border-subtle); padding-left: .5rem; }
[data-oods-surface="inverse"] { background: var(--sys-surface-inverse); color: var(--sys-text-inverse); }
`;

const DEFAULT_COMPONENT_CSS = `
#oods-preview-root {
  margin: 0;
  padding: var(--ref-space-inset-default, 24px);
  min-height: 100dvh;
  box-sizing: border-box;
  background: var(--sys-surface-canvas, var(--ref-color-neutral-50, #f8fafc));
  color: var(--sys-text-primary, var(--ref-color-neutral-900, #0f172a));
  font-family: var(--ref-typography-families-sans, Inter, "Helvetica Neue", Arial, sans-serif);
}
[data-oods-component] {
  box-sizing: border-box;
}
[data-oods-component="Button"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--sys-surface-interactive-primary-default, var(--ref-color-primary-500, #4f46e5));
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--sys-surface-interactive-primary-default, var(--ref-color-primary-500, #4f46e5));
  color: var(--sys-text-on-interactive, var(--ref-color-neutral-0, #ffffff));
  font-family: inherit;
  padding: var(--oods-size-spacing-sm, 0.5rem) var(--oods-size-spacing-md, 0.875rem);
  font-size: var(--oods-size-font-md, 16px);
}
[data-oods-component="Card"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--sys-surface-raised, var(--ref-color-neutral-0, #ffffff));
  padding: var(--ref-space-inset-compact, 8px);
}
[data-oods-component="Badge"] {
  display: inline-flex;
  border-radius: var(--ref-border-radius-pill, 999px);
  padding: 0.125rem 0.5rem;
  background: var(--sys-status-info-surface, var(--ref-color-info-100, #eef2ff));
}
[data-oods-component="Banner"] {
  border-radius: var(--ref-border-radius-md, 12px);
  border-left: 4px solid var(--sys-status-info-border, var(--ref-color-info-700, #2563eb));
  padding: var(--ref-space-inset-compact, 8px);
  background: var(--sys-status-info-surface, var(--ref-color-info-100, #eff6ff));
}
[data-oods-component="Table"] {
  width: 100%;
  border-collapse: collapse;
}
[data-oods-component="Table"] th,
[data-oods-component="Table"] td {
  border-bottom: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  text-align: left;
  padding: 0.5rem;
}
[data-oods-component="Tabs"] [role="tablist"] {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
[data-sidebar-aside="true"] {
  border-left: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  padding-left: var(--ref-space-inset-compact, 8px);
}
[data-oods-surface="inverse"] {
  background: var(--sys-surface-inverse, var(--ref-color-neutral-900, #0f172a));
  color: var(--sys-text-inverse, var(--ref-color-neutral-0, #ffffff));
}
`.trim();
// sprint-120 m02 (B1 surface-aware-text): the [data-oods-surface="inverse"] rule
// above wires the already-present --sys-text-inverse / --sys-surface-inverse tokens
// into a usable selector. It is UNCONDITIONAL and INERT — nothing in the renderer
// emits the [data-oods-surface="inverse"] marker today (only data-a2ui-surface
// exists, on a different adapter), so the rule matches ZERO nodes and no current
// render output changes. It references no [data-oods-component] selector, so the
// css-extractor folds it into baseRules → css.base (entries.size stays 7). A
// consumer that opts an element into the marker gets a dark surface + light text.
// KNOWN dark double-flip: under [data-theme="dark"] the --sys-*-inverse tokens
// themselves remap to dark values (DARK_THEME_OVERRIDES below + tokens.css), so an
// inverse element inside a dark doc flips to a LIGHT surface / DARK text — the
// cascade order is correct, just inverted-of-inverted by design.
// sprint-121 m03 (B2 geometry scalar-token contract): the Button `padding` above
// consumes --oods-size-spacing-sm/-md (the new size.* scalar contract from m01/m02)
// with the prior literals 0.5rem/0.875rem kept as var() fallbacks. When tokens.css
// is absent (compact mode) or the vars are unset, padding resolves to the EXACT
// prior values, so default rendering is byte-stable; with tokens.css loaded the vars
// resolve through size.spacing → sys → theme → ref.space.scale (8px/14px), numerically
// identical at the 16px root. (font size.font.* was seeded-not-consumed at s121; s124-m01
// now wires it — see the next block.)
// sprint-124 m01 (B2 follow-on / divergent A2, darryl's font ask): the Button `font-size`
// above consumes --oods-size-font-md with a 16px LITERAL fallback. Same padding precedent,
// applied to font: the guarantee is COMPUTED-parity, NOT byte-parity. The Button had no
// font-size and inherited the browser default 16px (#oods-preview-root sets font-family
// only), and the chain --oods-size-font-md→--sys-text-size-md→--ref-typography-sizes-md
// resolves to 16px, so the literal fallback reproduces the current rendered size exactly —
// brand-A render is unchanged. The Button-rule goldens re-bake to include the new
// declaration; an overlay-supplied measured font value now LANDS on the Button
// (resolveTokenOverlay emits --oods-size-font-md via the canonicalCssVarName path).

/**
 * CSS block that remaps --theme-* variables to --theme-dark-* under [data-theme="dark"].
 * This activates the dark semantic layer so --sys-* tokens resolve to dark values.
 * s222-m01 (#2502): with the secondary and destructive fills, the control borders, destructive text and the six status
 * solids with their text. A brand's radius and font are the same in every theme, so they need no dark remap.
 */
const DARK_THEME_OVERRIDES = `
[data-theme="dark"] {
  --theme-surface-canvas: var(--theme-dark-surface-canvas);
  --theme-surface-raised: var(--theme-dark-surface-raised);
  --theme-surface-subtle: var(--theme-dark-surface-subtle);
  --theme-surface-disabled: var(--theme-dark-surface-disabled);
  --theme-surface-backdrop: var(--theme-dark-surface-backdrop);
  --theme-surface-inverse: var(--theme-dark-surface-inverse);
  --theme-surface-interactive-primary-default: var(--theme-dark-surface-interactive-primary-default);
  --theme-surface-interactive-primary-hover: var(--theme-dark-surface-interactive-primary-hover);
  --theme-surface-interactive-primary-pressed: var(--theme-dark-surface-interactive-primary-pressed);
  --theme-surface-interactive-secondary-default: var(--theme-dark-surface-interactive-secondary-default);
  --theme-surface-interactive-secondary-hover: var(--theme-dark-surface-interactive-secondary-hover);
  --theme-surface-interactive-secondary-pressed: var(--theme-dark-surface-interactive-secondary-pressed);
  --theme-surface-interactive-destructive-default: var(--theme-dark-surface-interactive-destructive-default);
  --theme-surface-interactive-destructive-hover: var(--theme-dark-surface-interactive-destructive-hover);
  --theme-surface-interactive-destructive-pressed: var(--theme-dark-surface-interactive-destructive-pressed);
  --theme-border-subtle: var(--theme-dark-border-subtle);
  --theme-border-strong: var(--theme-dark-border-strong);
  --theme-border-interactive: var(--theme-dark-border-interactive);
  --theme-border-interactive-hover: var(--theme-dark-border-interactive-hover);
  --theme-text-primary: var(--theme-dark-text-primary);
  --theme-text-secondary: var(--theme-dark-text-secondary);
  --theme-text-muted: var(--theme-dark-text-muted);
  --theme-text-inverse: var(--theme-dark-text-inverse);
  --theme-text-accent: var(--theme-dark-text-accent);
  --theme-text-on-interactive: var(--theme-dark-text-on-interactive);
  --theme-text-disabled: var(--theme-dark-text-disabled);
  --theme-text-on-destructive: var(--theme-dark-text-on-destructive);
  --theme-icon-primary: var(--theme-dark-icon-primary);
  --theme-icon-muted: var(--theme-dark-icon-muted);
  --theme-icon-on-interactive: var(--theme-dark-icon-on-interactive);
  --theme-focus-ring-outer: var(--theme-dark-focus-ring-outer);
  --theme-focus-ring-inner: var(--theme-dark-focus-ring-inner);
  --theme-focus-text: var(--theme-dark-focus-text);
  --theme-status-info-surface: var(--theme-dark-status-info-surface);
  --theme-status-info-border: var(--theme-dark-status-info-border);
  --theme-status-info-text: var(--theme-dark-status-info-text);
  --theme-status-info-icon: var(--theme-dark-status-info-icon);
  --theme-status-info-solid: var(--theme-dark-status-info-solid);
  --theme-status-info-on-solid: var(--theme-dark-status-info-on-solid);
  --theme-status-success-surface: var(--theme-dark-status-success-surface);
  --theme-status-success-border: var(--theme-dark-status-success-border);
  --theme-status-success-text: var(--theme-dark-status-success-text);
  --theme-status-success-icon: var(--theme-dark-status-success-icon);
  --theme-status-success-solid: var(--theme-dark-status-success-solid);
  --theme-status-success-on-solid: var(--theme-dark-status-success-on-solid);
  --theme-status-warning-surface: var(--theme-dark-status-warning-surface);
  --theme-status-warning-border: var(--theme-dark-status-warning-border);
  --theme-status-warning-text: var(--theme-dark-status-warning-text);
  --theme-status-warning-icon: var(--theme-dark-status-warning-icon);
  --theme-status-warning-solid: var(--theme-dark-status-warning-solid);
  --theme-status-warning-on-solid: var(--theme-dark-status-warning-on-solid);
  --theme-status-critical-surface: var(--theme-dark-status-critical-surface);
  --theme-status-critical-border: var(--theme-dark-status-critical-border);
  --theme-status-critical-text: var(--theme-dark-status-critical-text);
  --theme-status-critical-icon: var(--theme-dark-status-critical-icon);
  --theme-status-critical-solid: var(--theme-dark-status-critical-solid);
  --theme-status-critical-on-solid: var(--theme-dark-status-critical-on-solid);
  --theme-status-neutral-surface: var(--theme-dark-status-neutral-surface);
  --theme-status-neutral-border: var(--theme-dark-status-neutral-border);
  --theme-status-neutral-text: var(--theme-dark-status-neutral-text);
  --theme-status-neutral-icon: var(--theme-dark-status-neutral-icon);
  --theme-status-neutral-solid: var(--theme-dark-status-neutral-solid);
  --theme-status-neutral-on-solid: var(--theme-dark-status-neutral-on-solid);
  --theme-status-accent-surface: var(--theme-dark-status-accent-surface);
  --theme-status-accent-border: var(--theme-dark-status-accent-border);
  --theme-status-accent-text: var(--theme-dark-status-accent-text);
  --theme-status-accent-icon: var(--theme-dark-status-accent-icon);
  --theme-status-accent-solid: var(--theme-dark-status-accent-solid);
  --theme-status-accent-on-solid: var(--theme-dark-status-accent-on-solid);
  --theme-status-archive-surface: var(--theme-dark-status-archive-surface);
  --theme-status-archive-border: var(--theme-dark-status-archive-border);
  --theme-status-archive-text: var(--theme-dark-status-archive-text);
  --theme-status-archive-icon: var(--theme-dark-status-archive-icon);
}
`.trim();

let cachedTokensCss: string | null = null;
let cachedTokensPath: string | null = null;

function loadTokensCss(): string {
  // s213-m06: the active token build, which is a team's build (its brands beside the shipped ones) when one exists.
  const tokensPath = path.join(tokenPackageRoot(), 'dist/css/tokens.css');
  if (cachedTokensPath !== tokensPath) { cachedTokensCss = null; cachedTokensPath = tokensPath; }
  if (cachedTokensCss !== null) return cachedTokensCss;
  let content: string;
  try {
    content = fs.readFileSync(tokensPath, 'utf8');
  } catch (error) {
    throw new ToolError('OODS-N011', `Token CSS is unavailable: ${error instanceof Error ? error.message : String(error)}`, { path: tokensPath });
  }
  // An in-progress rebuild must not poison the cache or return an unstyled success.
  if (!content.trim()) throw new ToolError('OODS-N011', 'Token CSS is empty; retry after the token build finishes.', { path: tokensPath });
  cachedTokensCss = inlineTokenFonts(content, path.join(path.dirname(tokensPath), '../fonts'));
  return cachedTokensCss;
}

// The root NOTICE, which the source tree and the release archive both keep four levels above this file.
const NOTICE_FILE = fileURLToPath(new URL('../../../../NOTICE', import.meta.url));
// What the token build says of the fonts (packages/tokens/scripts/build.mjs withFontFaces), true beside its NOTICE.
const FONT_COMMENT = /\/\* Geist, Geist Mono and DM Sans ship in this package \(SIL OFL 1\.1, see NOTICE\);[^*]*\*\//;

/**
 * s224-m01 (#2542 ruling 7): the fonts' notice, as a CSS comment, from NOTICE itself: each font's copyright line (the one
 * before its "licensed under the SIL Open Font License" statement) and the licence text, never retyped here. Undefined
 * when the notice cannot be read, so no font is embedded without it.
 */
function fontNotice(noticeFile: string): string | undefined {
  let notice: string;
  try {
    notice = fs.readFileSync(noticeFile, 'utf8');
  } catch {
    return undefined;
  }
  const copyrights = [...notice.matchAll(/^(Copyright .+)\n\nThis Font Software is licensed under the SIL Open Font License, Version 1\.1\./gm)].map(match => match[1]!);
  const licence = /SIL OPEN FONT LICENSE Version 1\.1 - 26 February 2007\n[\s\S]*?OTHER DEALINGS IN THE FONT SOFTWARE\./.exec(notice)?.[0];
  if (copyrights.length === 0 || !licence) return undefined;
  const text = ['Geist, Geist Mono and DM Sans are embedded below as data URIs, under the SIL Open Font License, Version 1.1.', '', ...copyrights, '', licence].join('\n');
  return `/* ${text.replace(/\*\//g, '* /')} */`;
}

/**
 * s221-m02 (#2482 ruling 6): tokens.css names its font files beside it (`url('../fonts/<file>')`), which a bundler or a
 * linked stylesheet resolves. A document that inlines the CSS has no such place to resolve them from, so each font it
 * names is embedded as a data URI: the document stays self-contained and still loads DM Sans with no network.
 * s224-m01 (#2542 ruling 7): a standalone file has no NOTICE beside it, so the comment that points there becomes the
 * fonts' copyright lines and the SIL OFL 1.1 text, which the licence asks each copy of the fonts to carry.
 */
export function inlineTokenFonts(css: string, fontsDir: string, noticeFile = NOTICE_FILE): string {
  const fonts = /url\('\.\.\/fonts\/([\w.-]+\.woff2)'\)/g;
  if (![...css.matchAll(fonts)].some(([, file]) => fs.existsSync(path.join(fontsDir, file!)))) return css;
  const notice = fontNotice(noticeFile);
  if (notice === undefined) return css;
  const noticed = FONT_COMMENT.test(css) ? css.replace(FONT_COMMENT, () => notice) : `${notice}\n${css}`;
  return noticed.replace(fonts, (reference, file: string) => {
    const font = path.join(fontsDir, file);
    return fs.existsSync(font) ? `url('data:font/woff2;base64,${fs.readFileSync(font).toString('base64')}')` : reference;
  });
}

/**
 * Clears the module-level tokens.css cache after brand.apply, or so a unit test can
 * exercise the #554 empty-read race guard (assert that a zero-length read is NOT
 * cached).
 */
export function resetTokensCssCache(): void {
  cachedTokensCss = null;
}

function normalizeTheme(input: RenderDocumentInput): string {
  return input.theme ?? input.schema?.theme ?? 'light';
}

function normalizeBrand(input: RenderDocumentInput): string {
  return input.brand ?? 'default';
}

function normalizeTitle(input: RenderDocumentInput): string {
  const raw = input.title?.trim();
  return raw && raw.length > 0 ? raw : 'OODS Preview';
}

/** Explicit legacy overlays keep their effect while default documents use the full component styles. */
function legacyButtonOverlay(css: string): string {
  const declarations = [
    ['--oods-size-spacing-sm', '--oods-button-padding-block'],
    ['--oods-size-spacing-md', '--oods-button-padding-inline'],
    ['--oods-size-font-md', '--oods-button-font-size'],
  ].filter(([source]) => new RegExp(`${source}\\s*:`).test(css))
    .map(([source, target]) => `${target}: var(${source});`);
  return declarations.length ? `[data-oods-component="Button"] { ${declarations.join(' ')} }` : '';
}

export function renderDocument(input: RenderDocumentInput): string {
  const theme = normalizeTheme(input);
  const brand = normalizeBrand(input);
  const title = normalizeTitle(input);
  const lang = input.lang?.trim() || 'en';

  const compact = input.compact ?? false;
  const tokensCss = compact ? '' : loadTokensCss();
  const componentCss = [DOCUMENT_BASE_CSS, fullComponentCss(), input.componentCss ?? '', legacyButtonOverlay(input.componentCss ?? '')].filter((entry) => entry.trim().length > 0).join('\n');

  const headParts = [
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
  ];

  if (!compact) {
    headParts.push(
      '  <style data-source="tokens">',
      tokensCss,
      '  </style>',
    );
  } else {
    headParts.push('  <!-- tokens.css omitted (compact mode) — use tokens.build to obtain -->');
  }

  if (theme === 'dark') {
    headParts.push(
      '  <style data-source="theme-overrides">',
      DARK_THEME_OVERRIDES,
      '  </style>',
    );
  }

  headParts.push(
    '  <style data-source="components">',
    componentCss,
    '  </style>',
  );

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(lang)}"${theme === 'dark' ? ' class="dark"' : ''} data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    ...headParts,
    '</head>',
    `<body data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    `  <main id="oods-preview-root">${input.screenHtml}</main>`,
    '</body>',
    '</html>',
  ].join('\n');
}

export function readTokensCssForDocument(): string {
  return loadTokensCss();
}

export function readDefaultComponentCssForDocument(): string {
  return DEFAULT_COMPONENT_CSS;
}

/**
 * s221-m01: the shipped stylesheet's top-level rules for one component (selectors naming [data-oods-component='<name>']).
 * A Grid's columns come from these rules since #2418 took the inline column template off the element, so an HTML fragment
 * that carries its own CSS needs them.
 */
export function readShippedComponentRules(component: string): string {
  const selector = `[data-oods-component='${component}']`;
  const rules: string[] = [];
  let depth = 0;
  let start = 0;
  const css = fullComponentCss().replace(/\/\*[\s\S]*?\*\//g, '');
  for (let index = 0; index < css.length; index++) {
    if (css[index] === '{') depth++;
    else if (css[index] === '}' && --depth === 0) {
      const rule = css.slice(start, index + 1).trim();
      if (rule.slice(0, rule.indexOf('{')).includes(selector) && !rule.startsWith('@')) rules.push(rule);
      start = index + 1;
    }
  }
  return rules.join('\n\n');
}

/** The shared HTML document's actual component styles, including its page defaults. */
export function readComponentCssForDocument(): string {
  return `${DOCUMENT_BASE_CSS}\n${fullComponentCss()}`;
}
