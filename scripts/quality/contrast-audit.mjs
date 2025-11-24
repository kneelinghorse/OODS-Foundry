#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import Color from 'colorjs.io';
import { contrastRatio } from '@oods/a11y-tools';

const projectRoot = process.cwd();
const cssSources = [
  path.resolve(projectRoot, 'apps/explorer/src/styles/tokens.css'),
  path.resolve(projectRoot, 'apps/explorer/src/styles/layers.css'),
];

const themeOverrides = {
  light: {},
  dark: {
    '--theme-surface-canvas': '--theme-dark-surface-canvas',
    '--theme-surface-raised': '--theme-dark-surface-raised',
    '--theme-surface-subtle': '--theme-dark-surface-subtle',
    '--theme-surface-disabled': '--theme-dark-surface-disabled',
    '--theme-surface-backdrop': '--theme-dark-surface-backdrop',
    '--theme-surface-interactive-primary-default': '--theme-dark-surface-interactive-primary-default',
    '--theme-surface-interactive-primary-hover': '--theme-dark-surface-interactive-primary-hover',
    '--theme-surface-interactive-primary-pressed': '--theme-dark-surface-interactive-primary-pressed',
    '--theme-border-subtle': '--theme-dark-border-subtle',
    '--theme-border-strong': '--theme-dark-border-strong',
    '--theme-text-primary': '--theme-dark-text-primary',
    '--theme-text-secondary': '--theme-dark-text-secondary',
    '--theme-text-muted': '--theme-dark-text-muted',
    '--theme-text-inverse': '--theme-dark-text-inverse',
    '--theme-text-accent': '--theme-dark-text-accent',
    '--theme-text-on-interactive': '--theme-dark-text-on_interactive',
    '--theme-text-disabled': '--theme-dark-text-disabled',
    '--theme-status-info-surface': '--theme-dark-status-info-surface',
    '--theme-status-info-border': '--theme-dark-status-info-border',
    '--theme-status-info-text': '--theme-dark-status-info-text',
    '--theme-status-info-icon': '--theme-dark-status-info-icon',
    '--theme-status-success-surface': '--theme-dark-status-success-surface',
    '--theme-status-success-border': '--theme-dark-status-success-border',
    '--theme-status-success-text': '--theme-dark-status-success-text',
    '--theme-status-success-icon': '--theme-dark-status-success-icon',
    '--theme-status-warning-surface': '--theme-dark-status-warning-surface',
    '--theme-status-warning-border': '--theme-dark-status-warning-border',
    '--theme-status-warning-text': '--theme-dark-status-warning-text',
    '--theme-status-warning-icon': '--theme-dark-status-warning-icon',
    '--theme-status-accent-surface': '--theme-dark-status-accent-surface',
    '--theme-status-accent-border': '--theme-dark-status-accent-border',
    '--theme-status-accent-text': '--theme-dark-status-accent-text',
    '--theme-status-accent-icon': '--theme-dark-status-accent-icon',
    '--theme-status-critical-surface': '--theme-dark-status-critical-surface',
    '--theme-status-critical-border': '--theme-dark-status-critical-border',
    '--theme-status-critical-text': '--theme-dark-status-critical-text',
    '--theme-status-critical-icon': '--theme-dark-status-critical-icon',
    '--theme-status-neutral-surface': '--theme-dark-status-neutral-surface',
    '--theme-status-neutral-border': '--theme-dark-status-neutral-border',
    '--theme-status-neutral-text': '--theme-dark-status-neutral-text',
    '--theme-status-neutral-icon': '--theme-dark-status-neutral-icon',
    '--theme-focus-ring-outer': '--theme-dark-focus-ring-outer',
    '--theme-focus-ring-inner': '--theme-dark-focus-ring-inner',
    '--theme-focus-text': '--theme-dark-focus-text',
    '--theme-focus-width': '--theme-dark-focus-width',
  },
};

const TARGETS = [
  { component: 'button', state: 'default', fg: '--cmp-button-text', bg: '--cmp-button-background', threshold: 4.5 },
  { component: 'button', state: 'hover', fg: '--cmp-button-text-hover', bg: '--cmp-button-background-hover', threshold: 4.5 },
  { component: 'button', state: 'pressed', fg: '--cmp-button-text-active', bg: '--cmp-button-background-active', threshold: 4.5 },
  { component: 'button', state: 'disabled', fg: '--cmp-button-text-disabled', bg: '--cmp-button-background-disabled', threshold: 3.0 },
  { component: 'button', state: 'focus-ring', fg: '--cmp-button-focus-outer', bg: '--cmp-button-background', threshold: 3.0 },
  { component: 'input', state: 'default', fg: '--cmp-input-text', bg: '--cmp-input-background', threshold: 4.5 },
  { component: 'input', state: 'hover', fg: '--cmp-input-text', bg: '--cmp-input-background-hover', threshold: 4.5 },
  { component: 'input', state: 'active', fg: '--cmp-input-text', bg: '--cmp-input-background-active', threshold: 4.5 },
  { component: 'input', state: 'disabled', fg: '--cmp-input-text-disabled', bg: '--cmp-input-background-disabled', threshold: 3.0 },
  { component: 'input', state: 'placeholder', fg: '--cmp-input-placeholder', bg: '--cmp-input-background', threshold: 4.5 },
  { component: 'card', state: 'default', fg: '--cmp-text-body', bg: '--cmp-surface-panel', threshold: 4.5 },
  { component: 'alert-info', state: 'default', fg: '--sys-status-info-text', bg: '--sys-status-info-surface', threshold: 4.5 },
  { component: 'alert-success', state: 'default', fg: '--sys-status-success-text', bg: '--sys-status-success-surface', threshold: 4.5 },
  { component: 'alert-warning', state: 'default', fg: '--sys-status-warning-text', bg: '--sys-status-warning-surface', threshold: 4.5 },
  { component: 'alert-critical', state: 'default', fg: '--sys-status-critical-text', bg: '--sys-status-critical-surface', threshold: 4.5 },
  { component: 'badge', state: 'default', fg: '--cmp-badge-text', bg: '--cmp-badge-background', threshold: 4.5 },
  { component: 'badge', state: 'selected', fg: '--cmp-badge-text-selected', bg: '--cmp-badge-background-selected', threshold: 4.5 },
  { component: 'focus-outline', state: 'panel', fg: '--sys-focus-ring-outer', bg: '--cmp-surface-panel', threshold: 3.0 },
];

function parseCssVariables(files) {
  const map = new Map();
  const varPattern = /--([\w-]+)\s*:\s*([^;]+);/g;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const content = extractRootBlocks(raw);
    let match;
    while ((match = varPattern.exec(content)) !== null) {
      const [, name, value] = match;
      const key = `--${name}`;
      const trimmed = value.trim();
      const existing = map.get(key);
      if (existing && isComplexColor(trimmed)) {
        continue;
      }
      map.set(key, trimmed);
    }
  }
  return map;
}

function isComplexColor(value) {
  return value.includes('calc(') || value.includes('from ');
}

function extractRootBlocks(cssContent) {
  const blocks = [];
  let cursor = 0;
  while (cursor < cssContent.length) {
    const start = cssContent.indexOf(':root', cursor);
    if (start === -1) break;
    const openBrace = cssContent.indexOf('{', start);
    if (openBrace === -1) break;
    let depth = 1;
    let index = openBrace + 1;
    while (index < cssContent.length && depth > 0) {
      const char = cssContent[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      index += 1;
    }
    const body = cssContent.slice(openBrace + 1, index - 1);
    blocks.push(body);
    cursor = index;
  }
  return blocks.join('\n');
}

function createResolver(variableMap, theme) {
  const overrides = themeOverrides[theme] || {};
  const cache = new Map();

  function resolveVariable(name, seen = new Set()) {
    if (cache.has(name)) return cache.get(name);
    if (seen.has(name)) {
      throw new Error(`Circular variable resolution detected for ${name}`);
    }
    seen.add(name);

    const overrideSource = overrides[name];
    const sourceName = overrideSource || name;
    const value =
      variableMap.get(sourceName) ||
      variableMap.get(sourceName.replace(/-/g, '_')) ||
      variableMap.get(sourceName.replace(/_/g, '-'));
    if (!value) {
      throw new Error(`Variable ${name} not found (source ${sourceName})`);
    }

    const resolved = substituteVars(value, (varName) => resolveVariable(varName, seen));
    cache.set(name, resolved);
    return resolved;
  }

  return resolveVariable;
}

function substituteVars(input, resolver) {
  const varRegex = /var\((--[\w-]+)(?:,\s*([^\)]+))?\)/g;
  let output = input;
  let match;
  while ((match = varRegex.exec(output)) !== null) {
    const [, varName, fallback] = match;
    const replacement = resolver(varName) ?? fallback ?? '';
    output = output.replace(match[0], replacement);
    varRegex.lastIndex = 0;
  }
  return output;
}

function toHex(colorValue) {
  const trimmed = colorValue.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return `#${trimmed.slice(1, 7).toLowerCase()}`;
  }
  if (trimmed.startsWith('color-mix(')) {
    return mixColors(trimmed);
  }
  const color = new Color(trimmed);
  const srgb = color.to('srgb');
  const hex = srgb.toString({ format: 'hex' }).toLowerCase();
  return hex.length > 7 ? hex.slice(0, 7) : hex;
}

function mixColors(expression) {
  const normalised = expression.replace(/\s+/g, ' ').trim();
  const mixPattern =
    /^color-mix\(\s*in\s+([a-zA-Z-]+)\s*,\s*([^,]+?)\s+([\d.]+)%\s*,\s*([^,]+?)(?:\s+([\d.]+)%)?\s*\)$/;
  const match = normalised.match(mixPattern);
  if (!match) {
    throw new Error(`Unsupported color-mix expression: ${expression}`);
  }
  const [, space, aRaw, aPct, bRaw, bPct] = match;
  const aWeight = Number.parseFloat(aPct);
  const bWeight = bPct ? Number.parseFloat(bPct) : Math.max(0, 100 - aWeight);
  const total = aWeight + bWeight;
  const bRatio = total === 0 ? 0.5 : bWeight / total;
  const colorA = new Color(aRaw.trim());
  const colorB = new Color(bRaw.trim());
  const mixed = colorA.mix(colorB, bRatio, space.trim());
  const hex = mixed.to('srgb').toString({ format: 'hex', alpha: false }).toLowerCase();
  return hex.length > 7 ? hex.slice(0, 7) : hex;
}

function buildContrastMatrix(variableMap) {
  const matrix = {};
  for (const theme of Object.keys(themeOverrides)) {
    const resolve = createResolver(variableMap, theme);
    matrix[theme] = [];

    for (const target of TARGETS) {
      try {
        const fgRaw = resolve(target.fg);
        const bgRaw = resolve(target.bg);
        const fgHex = toHex(fgRaw);
        const bgHex = toHex(bgRaw);
        const ratio = Number(contrastRatio(fgHex, bgHex).toFixed(2));
        const pass = ratio >= target.threshold;
        matrix[theme].push({
          component: target.component,
          state: target.state,
          foreground: { token: target.fg, value: fgHex },
          background: { token: target.bg, value: bgHex },
          ratio,
          threshold: target.threshold,
          pass,
        });
      } catch (error) {
        matrix[theme].push({
          component: target.component,
          state: target.state,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return matrix;
}

function main() {
  const variableMap = parseCssVariables(cssSources);
  const matrix = buildContrastMatrix(variableMap);
  const payload = {
    generatedAt: new Date().toISOString(),
    sources: cssSources.map((source) => path.relative(projectRoot, source)),
    scope: {
      components: [...new Set(TARGETS.map((t) => t.component))],
      states: [...new Set(TARGETS.map((t) => t.state))],
      themes: Object.keys(themeOverrides),
    },
    matrix,
  };

  const outputPath = path.resolve(projectRoot, 'artifacts/quality/contrast-matrix.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Contrast matrix written to ${path.relative(projectRoot, outputPath)}`);
}

main();
