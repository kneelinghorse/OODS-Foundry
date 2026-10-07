import path from 'node:path';
import { createHash } from 'node:crypto';
import postcss, { type AnyNode } from 'postcss';
import { parse } from 'parse5';
import Color from 'colorjs.io';
import { contrastRatio } from '@oods/a11y-tools';
import { readTokenScopes, tokenPackageRoot } from '../lib/token-build.js';
import { readComponentCssForDocument } from '../render/document.js';
import { ToolError } from '../errors/tool-error.js';
import type { ReplIssue, UiSchema } from '../schemas/generated.js';

type StyleRule = { selector: string; declarations: Record<string, string>; keys: string[]; media: string };
type Pair = StyleRule & { foreground: string; background?: string; threshold: number; contrastKind: 'text' | 'non-text' };
type Element = { tagName?: string; attrs?: Array<{ name: string; value: string }>; childNodes?: Element[]; value?: string; parentNode?: Element };
export const SCREEN_RULES = ['document-language', 'document-title', 'main-landmark', 'unique-id', 'aria-reference', 'control-name', 'image-alt', 'svg-name-description', 'heading-name-order'] as const;
const NOT_CHECKED = ['Browser-computed colour and layout', 'Keyboard, focus order and interaction', 'Screen-reader behavior', 'Dynamic CSS, inherited surfaces without a declared pair, and operating-system colours', 'Standalone fills, borders and selector combinations without a declared text/icon pair'];
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const attr = (node: Element, name: string) => node.attrs?.find(entry => entry.name === name)?.value;
const content = (node: Element): string => ['script', 'style'].includes(node.tagName ?? '') || attr(node, 'aria-hidden') === 'true' ? '' : (node.value ?? '') + (node.childNodes ?? []).map(content).join(' ');
const identities = (selector: string) => [
  ...[...selector.matchAll(/data-oods-component\s*=\s*['"]([^'"]+)['"]/g)].map(match => `component:${match[1]}`),
  ...[...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => `class:${match[1]}`),
];

/** Derive normal text/icon pairs and their variable overrides from the styles actually shipped to components. */
function stylesheetPairs(css: string): Pair[] {
  const rules: StyleRule[] = [];
  postcss.parse(css).walkRules(rule => {
    const declarations: Record<string, string> = {};
    rule.nodes.forEach(node => { if (node.type === 'decl') declarations[node.prop] = node.value; });
    const media: string[] = [];
    for (let parent: AnyNode | undefined = rule.parent; parent; parent = parent.parent) if (parent.type === 'atrule') media.push(parent.params);
    rules.push({ selector: rule.selector, declarations, keys: identities(rule.selector), media: media.join(' ') });
  });
  const color = (rule: StyleRule) => rule.declarations.color;
  const background = (rule: StyleRule) => rule.declarations['background-color'] ?? rule.declarations.background;
  const pairs: Pair[] = [];
  for (const rule of rules) {
    const base = rules.filter(candidate => color(candidate) && background(candidate) && !candidate.media && candidate.keys.some(key => rule.keys.includes(key)) && (() => {
      const position = rule.selector.indexOf(candidate.selector);
      const suffix = position < 0 ? undefined : rule.selector.slice(position + candidate.selector.length);
      return suffix !== undefined && (suffix === '' || suffix.startsWith(':') && !suffix.startsWith('::') || suffix.startsWith('['));
    })())
      .sort((a, b) => a.selector.length - b.selector.length)[0];
    const overridesPair = Object.keys(rule.declarations).some(key => key.startsWith('--') && /(?:background|foreground|text|surface)(?:-|$)/.test(key));
    if (!color(rule) && !background(rule) && !(base && overridesPair)) continue;
    const foreground = color(rule) ?? (base && color(base));
    if (!foreground) continue;
    const contrastKind = /icon|\b(?:svg|progress|meter)\b/.test(rule.selector) ? 'non-text' : 'text';
    // The shared hover/active rules consume variables supplied by each intent. Grading
    // them against only the generic button base invents a colour pair no intent renders.
    const intents = base && rule.keys.includes('component:Button') && /:(?:hover|active)\b/.test(rule.selector) && !/data-intent/.test(rule.selector)
      ? rules.filter(candidate => candidate.selector.startsWith(base.selector) && /data-intent/.test(candidate.selector)
        && !/:(?:hover|active|disabled)\b/.test(candidate.selector) && Object.keys(candidate.declarations).some(key => key.startsWith('--oods-button-')))
      : [];
    for (const intent of intents.length ? intents : [undefined]) pairs.push({ ...rule,
      selector: intent ? intent.selector + rule.selector.slice(base!.selector.length) : rule.selector,
      declarations: { ...base?.declarations, ...intent?.declarations, ...rule.declarations }, foreground,
      background: background(rule) ?? (base && background(base)), contrastKind, threshold: contrastKind === 'non-text' ? 3 : 4.5 });
  }
  return pairs;
}

function resolveValue(expression: string | undefined, values: Record<string, string>, depth = 0): string | undefined {
  if (!expression || depth > 32) return undefined;
  // Parse balanced calls: a resolved fallback can itself contain colour functions.
  let resolved = expression;
  for (let pass = 0; resolved.includes('var(') && pass < 32; pass += 1) {
    const start = resolved.indexOf('var(');
    let nesting = 1, end = start + 4, comma = -1;
    for (; end < resolved.length && nesting; end += 1) {
      if (resolved[end] === '(') nesting += 1;
      else if (resolved[end] === ')') nesting -= 1;
      else if (resolved[end] === ',' && nesting === 1 && comma < 0) comma = end;
    }
    if (nesting) return undefined;
    const key = resolved.slice(start + 4, comma < 0 ? end - 1 : comma).trim();
    const fallback = comma < 0 ? undefined : resolved.slice(comma + 1, end - 1).trim();
    const value = resolveValue(values[key] ?? fallback, values, depth + 1);
    if (value === undefined) return undefined;
    resolved = resolved.slice(0, start) + value + resolved.slice(end);
  }
  if (resolved.includes('var(')) return undefined;
  return resolved.trim();
}

function opaqueHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const colour = new Color(value).to('srgb');
    if (colour.alpha !== 1) return undefined;
    return colour.toGamut({ method: 'clip' }).toString({ format: 'hex', collapse: false });
  } catch { return undefined; } // System colours and dynamic CSS are explicitly reported as unmeasured below.
}

function inScope(pair: Pair, brand: string, theme: string): boolean {
  const brands = [...pair.selector.matchAll(/data-brand\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  const themes = [...pair.selector.matchAll(/data-theme\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1] === 'base' ? 'light' : match[1]);
  return (!brands.length || brands.includes(brand)) && (!themes.length || themes.includes(theme))
    && (!/forced-colors\s*:\s*active/.test(pair.media) || theme === 'hc')
    && (!/prefers-color-scheme\s*:\s*dark/.test(pair.media) || theme === 'dark');
}

function inspectScreen(html: string) {
  const elements: Element[] = [];
  const visit = (node: Element) => { if (node.tagName) elements.push(node); node.childNodes?.forEach(visit); };
  visit(parse(html) as Element);
  const findings: ReplIssue[] = [];
  const issue = (code: string, message: string, node?: Element) => findings.push({ code, message, severity: 'warning', ...(node ? { path: attr(node, 'id') ?? node.tagName } : {}) });
  const ids = new Map<string, Element>();
  for (const node of elements) {
    const id = attr(node, 'id');
    if (id) { if (ids.has(id)) issue('A11Y_DUPLICATE_ID', `Rendered id "${id}" is duplicated.`, node); else ids.set(id, node); }
  }
  const visible = (node: Element): boolean => attr(node, 'hidden') === undefined && attr(node, 'aria-hidden') !== 'true' && (!node.parentNode || visible(node.parentNode));
  const named = (node: Element): string => attr(node, 'aria-labelledby')?.split(/\s+/).map(id => ids.has(id) ? content(ids.get(id)!) : '').join(' ').trim()
    || attr(node, 'aria-label')?.trim() || attr(node, 'alt')?.trim() || '';
  if (!elements.some(node => node.tagName === 'html' && attr(node, 'lang')?.trim())) issue('A11Y_LANGUAGE', 'The document has no language.');
  if (!elements.some(node => node.tagName === 'title' && content(node).trim())) issue('A11Y_TITLE', 'The document has no title.');
  if (elements.filter(node => visible(node) && (node.tagName === 'main' || attr(node, 'role') === 'main')).length !== 1) issue('A11Y_MAIN', 'The visible document must have one main landmark.');
  let heading = 0;
  for (const node of elements.filter(visible)) {
    for (const property of ['aria-labelledby', 'aria-describedby']) for (const id of (attr(node, property) ?? '').split(/\s+/).filter(Boolean)) {
      if (!ids.has(id)) issue('A11Y_ARIA_REFERENCE', `${property} names missing id "${id}".`, node);
    }
    if (/^h[1-6]$/.test(node.tagName ?? '')) {
      const level = Number(node.tagName![1]);
      if (!content(node).trim() && !named(node)) issue('A11Y_HEADING_NAME', 'Heading has no name.', node);
      if (heading && level > heading + 1) issue('A11Y_HEADING_ORDER', `Heading level jumps from ${heading} to ${level}.`, node);
      heading = level;
    }
    if (['input', 'select', 'textarea'].includes(node.tagName ?? '') && attr(node, 'type') !== 'hidden') {
      const label = elements.find(candidate => candidate.tagName === 'label' && attr(candidate, 'for') === attr(node, 'id') && attr(node, 'id'));
      let parent = node.parentNode;
      while (parent && parent.tagName !== 'label') parent = parent.parentNode;
      if (!named(node) && !(label && content(label).trim()) && !(parent && content(parent).trim())) issue('A11Y_CONTROL_NAME', 'Form control has no associated label or accessible name.', node);
    }
    if ((node.tagName === 'button' || node.tagName === 'a' && attr(node, 'href') !== undefined) && !named(node) && !content(node).trim()) issue('A11Y_CONTROL_NAME', 'Interactive control has no accessible name.', node);
    if (node.tagName === 'img' && attr(node, 'alt') === undefined && !named(node)) issue('A11Y_IMAGE_ALT', 'Image has no alternative text or explicit empty alt.', node);
    if (node.tagName === 'svg' && attr(node, 'role') === 'img') {
      if (!named(node) && !node.childNodes?.some(child => child.tagName === 'title' && content(child).trim())) issue('A11Y_SVG_NAME', 'Chart SVG has no accessible name.', node);
      if (!attr(node, 'aria-description') && !attr(node, 'aria-describedby') && !node.childNodes?.some(child => child.tagName === 'desc' && content(child).trim())) issue('A11Y_SVG_DESCRIPTION', 'Chart SVG has no accessible description.', node);
    }
  }
  const keys = new Set(elements.flatMap(node => [
    ...(attr(node, 'data-oods-component') ? [`component:${attr(node, 'data-oods-component')}`] : []),
    ...(attr(node, 'class') ?? '').split(/\s+/).filter(Boolean).map(name => `class:${name}`),
  ]));
  return { keys, components: [...keys].filter(key => key.startsWith('component:')).map(key => key.slice(10)).sort(),
    report: { renderer: 'repl.render/document', htmlSha256: digest(html), rulesChecked: [...SCREEN_RULES], findings } };
}

export async function checkBuiltScreen(schema?: UiSchema) {
  let screen: ReturnType<typeof inspectScreen> | undefined;
  if (schema) {
    const { handle } = await import('../tools/repl.render.js');
    const rendered = await handle({ schema, apply: true, output: { format: 'document', compact: false, payloadMode: 'inline' } });
    if (rendered.status !== 'ok' || !rendered.html) throw new ToolError('OODS-S012', `Accessibility screen render failed: ${rendered.errors.map(error => error.message).join('; ')}`, { errors: rendered.errors });
    screen = inspectScreen(rendered.html);
  }
  const css = readComponentCssForDocument();
  const screenKeys = screen?.keys;
  const pairs = stylesheetPairs(css).filter(pair => !screenKeys || !pair.keys.length || pair.keys.some(key => screenKeys.has(key)));
  let scopes: ReturnType<typeof readTokenScopes>;
  try { scopes = readTokenScopes(); } catch (error) {
    throw new ToolError('OODS-N011', `Built token scopes could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Object.keys(scopes).length) throw new ToolError('OODS-N011', 'No built token scopes are available for accessibility checks.');
  const colours = new Map<string, string | undefined>();
  const hex = (value: string | undefined) => {
    if (!value) return undefined;
    if (!colours.has(value)) colours.set(value, opaqueHex(value));
    return colours.get(value);
  };
  const rules = Object.entries(scopes).flatMap(([brand, themes]) => Object.entries(themes).flatMap(([theme, variables]) => {
    const tokens = Object.fromEntries(Object.entries(variables).flatMap(([key, value]) => [[key, value], [key.replace(/^--oods-/, '--'), value]]));
    return pairs.filter(pair => inScope(pair, brand, theme)).map((pair, index) => {
      const values = { ...tokens, ...Object.fromEntries(Object.entries(pair.declarations).filter(([key]) => key.startsWith('--'))) };
      const foreground = resolveValue(pair.foreground, values), background = resolveValue(pair.background, values);
      const fg = hex(foreground), bg = hex(background);
      const ratio = fg && bg ? Number(contrastRatio(fg, bg).toFixed(4)) : null;
      const disabled = /:disabled|\[disabled\]/.test(pair.selector.replace(/:not\(:disabled\)/g, ''));
      const status = disabled ? 'not-applicable' : ratio === null ? 'unmeasured' : ratio >= pair.threshold ? 'pass' : 'fail';
      return { ruleId: `${brand}/${theme}/css-${index + 1}`, brand, theme, selector: pair.selector, target: pair.selector,
        foreground: { token: pair.foreground, value: foreground ?? null, hex: fg ?? null }, background: { token: pair.background ?? null, value: background ?? null, hex: bg ?? null },
        contrastKind: pair.contrastKind, threshold: pair.threshold, ratio, passed: status === 'pass', status,
        ...(disabled ? { reason: 'Inactive controls are exempt from this contrast threshold.' } : ratio === null ? { reason: 'The declared pair needs an inherited surface, dynamic CSS, alpha compositing or operating-system colours; no measured pass is claimed.' } : {}) };
    });
  }));
  const failed = rules.filter(rule => rule.status === 'fail').length;
  const screenFindings = screen?.report.findings.length ?? 0;
  const unmeasured = rules.filter(rule => rule.status === 'unmeasured').length;
  return { generatedAt: new Date().toISOString(), tokenSource: path.join(tokenPackageRoot(), 'dist/css-variables-by-scope.json'),
    pairSource: { source: 'shared component-styles declarations', sha256: digest(css), selection: 'All declared variants of the rendered components; no browser cascade or paint claim.' },
    scopes: Object.entries(scopes).flatMap(([brand, themes]) => Object.keys(themes).map(theme => ({ brand, theme, checks: rules.filter(rule => rule.brand === brand && rule.theme === theme).length }))),
    summary: { totalChecks: rules.length, passed: rules.filter(rule => rule.status === 'pass').length,
      failed, screenFindings, unmeasured, notApplicable: rules.filter(rule => rule.status === 'not-applicable').length, complianceStatus: failed || screenFindings ? 'issues-found' : unmeasured ? 'partial' : 'checks-passed' },
    rules, ...(screen ? { components: screen.components, screen: screen.report } : {}), notChecked: NOT_CHECKED };
}

export function accessibilityWarnings(report: Awaited<ReturnType<typeof checkBuiltScreen>>): ReplIssue[] {
  return [...report.screen?.findings ?? [], ...report.rules.filter(rule => rule.status === 'fail').map(rule => ({ code: 'A11Y_CONTRAST', severity: 'warning' as const,
    message: `${rule.brand}/${rule.theme}: ${rule.selector} fails the declared token-pair check.`, hint: `${rule.ratio}:1, minimum ${rule.threshold}:1.` })),
    ...(report.summary.unmeasured ? [{ code: 'A11Y_UNMEASURED', severity: 'warning' as const, message: `${report.summary.unmeasured} declared token pairs need browser/OS or inherited-surface information. No pass is claimed for them.` }] : [])];
}
