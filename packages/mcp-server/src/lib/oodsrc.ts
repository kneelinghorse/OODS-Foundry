/**
 * .oodsrc project-level configuration loader.
 *
 * Reads a `.oodsrc` JSON file from the project root and provides
 * fallback defaults for pipeline, compose, and codegen tools.
 * Explicit tool params always override .oodsrc values.
 *
 * Missing or invalid .oodsrc is silently ignored — no breaking change.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CodegenFramework, CodegenStyling } from '../tools/types.js';
import { LAYOUT_INPUT_VALUES, type LayoutInput } from '../compose/layout-types.js';

export interface OodsrcConfig {
  /** Default codegen framework: react | vue | html */
  framework?: CodegenFramework;
  /** Default styling mode: inline | tokens | tailwind */
  styling?: CodegenStyling;
  /** Default TypeScript output */
  typescript?: boolean;
  /** Default brand preset */
  brand?: string;
  /** Default view context */
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline' | 'workflow';
  /** Default layout */
  layout?: LayoutInput;
  /** Default composition preferences */
  preferences?: {
    theme?: string;
    metricColumns?: number;
    fieldGroups?: number;
    tabCount?: number;
    tabLabels?: string[];
  };
  /** Default pipeline options */
  pipeline?: {
    checkA11y?: boolean;
    compact?: boolean;
  };
}

const VALID_FRAMEWORKS = new Set(['react', 'vue', 'html']);
const VALID_STYLINGS = new Set(['inline', 'tokens', 'tailwind']);
const VALID_CONTEXTS = new Set(['detail', 'list', 'form', 'timeline', 'card', 'inline', 'workflow']);
const VALID_LAYOUTS = new Set<string>(LAYOUT_INPUT_VALUES);

/** Cached config to avoid re-reading the file on every tool call within a session. */
let cachedConfig: OodsrcConfig | null = null;
let cachedPath: string | null = null;

/**
 * Validate and sanitize parsed config. Unknown keys are dropped,
 * invalid values are silently ignored.
 */
function sanitize(raw: Record<string, unknown>): OodsrcConfig {
  const config: OodsrcConfig = {};

  if (typeof raw.framework === 'string' && VALID_FRAMEWORKS.has(raw.framework)) {
    config.framework = raw.framework as CodegenFramework;
  }
  if (typeof raw.styling === 'string' && VALID_STYLINGS.has(raw.styling)) {
    config.styling = raw.styling as CodegenStyling;
  }
  if (typeof raw.typescript === 'boolean') {
    config.typescript = raw.typescript;
  }
  if (typeof raw.brand === 'string' && raw.brand.length > 0) {
    config.brand = raw.brand;
  }
  if (typeof raw.context === 'string' && VALID_CONTEXTS.has(raw.context)) {
    config.context = raw.context as OodsrcConfig['context'];
  }
  if (typeof raw.layout === 'string' && VALID_LAYOUTS.has(raw.layout)) {
    config.layout = raw.layout as OodsrcConfig['layout'];
  }

  // preferences
  if (raw.preferences && typeof raw.preferences === 'object' && !Array.isArray(raw.preferences)) {
    const prefs = raw.preferences as Record<string, unknown>;
    const p: NonNullable<OodsrcConfig['preferences']> = {};
    let hasAny = false;

    if (typeof prefs.theme === 'string' && prefs.theme.length > 0) {
      p.theme = prefs.theme; hasAny = true;
    }
    if (typeof prefs.metricColumns === 'number' && prefs.metricColumns >= 1 && prefs.metricColumns <= 12) {
      p.metricColumns = prefs.metricColumns; hasAny = true;
    }
    if (typeof prefs.fieldGroups === 'number' && prefs.fieldGroups >= 1 && prefs.fieldGroups <= 20) {
      p.fieldGroups = prefs.fieldGroups; hasAny = true;
    }
    if (typeof prefs.tabCount === 'number' && prefs.tabCount >= 1 && prefs.tabCount <= 10) {
      p.tabCount = prefs.tabCount; hasAny = true;
    }
    if (Array.isArray(prefs.tabLabels) && prefs.tabLabels.every((l: unknown) => typeof l === 'string')) {
      p.tabLabels = prefs.tabLabels as string[]; hasAny = true;
    }

    if (hasAny) config.preferences = p;
  }

  // pipeline
  if (raw.pipeline && typeof raw.pipeline === 'object' && !Array.isArray(raw.pipeline)) {
    const pipe = raw.pipeline as Record<string, unknown>;
    const pl: NonNullable<OodsrcConfig['pipeline']> = {};
    let hasAny = false;

    if (typeof pipe.checkA11y === 'boolean') {
      pl.checkA11y = pipe.checkA11y; hasAny = true;
    }
    if (typeof pipe.compact === 'boolean') {
      pl.compact = pipe.compact; hasAny = true;
    }

    if (hasAny) config.pipeline = pl;
  }

  return config;
}

/**
 * Load .oodsrc config from the given directory (or process.cwd()).
 * Returns an empty config on missing/invalid file — never throws.
 */
export function loadOodsrc(projectRoot?: string): OodsrcConfig {
  const dir = projectRoot ?? process.cwd();
  const filePath = resolve(dir, '.oodsrc');

  // Return cache if same path
  if (cachedPath === filePath && cachedConfig !== null) {
    return cachedConfig;
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      cachedConfig = {};
      cachedPath = filePath;
      return cachedConfig;
    }
    cachedConfig = sanitize(raw as Record<string, unknown>);
    cachedPath = filePath;
    return cachedConfig;
  } catch {
    // File missing, unreadable, or invalid JSON — silent fallback
    cachedConfig = {};
    cachedPath = filePath;
    return cachedConfig;
  }
}

/** Clear the cached config (useful for testing). */
export function clearOodsrcCache(): void {
  cachedConfig = null;
  cachedPath = null;
}
