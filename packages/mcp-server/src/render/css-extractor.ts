import { readDefaultComponentCssForDocument, readShippedComponentRules, readTokensCssForDocument } from './document.js';

const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const COMPONENT_SELECTOR_RE = /\[data-oods-component="([^"]+)"\]/g;

export type CssExtractionOutput = {
  cssRefs: string[];
  css: Record<string, string>;
};

function toComponentRef(componentName: string): string {
  return `cmp.${componentName.trim().toLowerCase()}.base`;
}

function parseComponentNames(selectorBlock: string): string[] {
  const names = new Set<string>();
  for (const match of selectorBlock.matchAll(COMPONENT_SELECTOR_RE)) {
    const name = match[1]?.trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

function formatRule(selectorBlock: string, declarationBlock: string): string {
  return `${selectorBlock.trim()} {\n${declarationBlock.trim()}\n}`;
}

let cachedComponentCssEntries: Map<string, string> | null = null;

export function extractComponentCssEntries(componentCss = readDefaultComponentCssForDocument()): Map<string, string> {
  const baseRules: string[] = [];
  const componentRules = new Map<string, string[]>();

  for (const match of componentCss.matchAll(RULE_RE)) {
    const selectorBlock = match[1] ?? '';
    const declarationBlock = match[2] ?? '';
    const rule = formatRule(selectorBlock, declarationBlock);
    const componentNames = parseComponentNames(selectorBlock);

    if (componentNames.length === 1) {
      const ref = toComponentRef(componentNames[0]);
      const existing = componentRules.get(ref) ?? [];
      existing.push(rule);
      componentRules.set(ref, existing);
      continue;
    }

    baseRules.push(rule);
  }

  const entries = new Map<string, string>();
  entries.set('css.base', baseRules.join('\n\n').trim());

  for (const [ref, rules] of componentRules.entries()) {
    entries.set(ref, rules.join('\n\n').trim());
  }

  return entries;
}

function getDefaultComponentCssEntries(): Map<string, string> {
  if (cachedComponentCssEntries === null) {
    cachedComponentCssEntries = extractComponentCssEntries();
  }
  return cachedComponentCssEntries;
}

function pushRef(cssRefs: string[], css: Record<string, string>, ref: string, content: string): void {
  if (cssRefs.includes(ref)) return;
  cssRefs.push(ref);
  css[ref] = content;
}

export function getCssForComponents(components: string[], includeCss: boolean): CssExtractionOutput {
  const cssRefs: string[] = [];
  const css: Record<string, string> = {};
  const entries = getDefaultComponentCssEntries();

  pushRef(cssRefs, css, 'css.base', entries.get('css.base') ?? '');

  if (includeCss) {
    pushRef(cssRefs, css, 'css.tokens', readTokensCssForDocument());
  }

  const seen = new Set<string>();
  for (const componentName of components) {
    const normalized = componentName.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const ref = toComponentRef(normalized);
    // s221-m01: the legacy fragment CSS has no Grid rule, and a Grid's columns come from the shipped one since #2418, so a
    // fragment's Grid laid out as one column.
    const componentCss = entries.get(ref) ?? (normalized === 'grid' ? readShippedComponentRules('Grid') : undefined);
    if (!componentCss) continue;

    pushRef(cssRefs, css, ref, componentCss);
  }

  return { cssRefs, css };
}
