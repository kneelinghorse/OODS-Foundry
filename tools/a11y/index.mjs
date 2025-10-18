#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import Color from 'colorjs.io';
import { chromium } from 'playwright';
import { contrastRatio } from './contrast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const TOKEN_SOURCE = require.resolve('@oods/tokens/tailwind');
const REPORT_PATH = path.resolve(__dirname, './reports/a11y-report.json');
const BASELINE_PATH = path.resolve(__dirname, './baseline/a11y-baseline.json');
const GUARDRAILS_PATH = path.resolve(__dirname, './guardrails/relative-color.csv');
const CONTRACT_PATH = path.resolve(__dirname, '../../testing/a11y/aria-contract.json');
const STORYBOOK_STATIC_DIR = path.resolve(__dirname, '../../storybook-static');
const AXE_MINIFIED_PATH = require.resolve('axe-core/axe.min.js');
const DEFAULT_FAIL_IMPACTS = ['serious', 'critical'];
const STORY_LOAD_TIMEOUT_MS = 8000;
const STORY_POST_LOAD_WAIT_MS = 250;

const RANGE_TOLERANCE = 0.001;

const RULES = [
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.canvas',
    foreground: 'sys.text.primary',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Primary text on the default surface must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.canvas',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.canvas',
    threshold: 4.5,
    summary: 'Dark theme primary text on canvas must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.raised',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.raised',
    threshold: 4.5,
    summary: 'Dark theme primary text on raised surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.subtle',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.subtle',
    threshold: 4.5,
    summary: 'Dark theme primary text on subtle surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'inverse-text',
    target: 'sys.text.inverse on sys.surface.inverse',
    foreground: 'sys.text.inverse',
    background: 'sys.surface.inverse',
    threshold: 4.5,
    summary: 'Inverse text must meet 4.5:1 contrast on inverse surfaces.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.raised',
    foreground: 'sys.text.primary',
    background: 'sys.surface.raised',
    threshold: 4.5,
    summary: 'Primary text on raised surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.subtle',
    foreground: 'sys.text.primary',
    background: 'sys.surface.subtle',
    threshold: 4.5,
    summary: 'Primary text on subtle surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.secondary on sys.surface.canvas',
    foreground: 'sys.text.secondary',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Secondary headings on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.muted on sys.surface.canvas',
    foreground: 'sys.text.muted',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Muted body text on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.accent on sys.surface.canvas',
    foreground: 'sys.text.accent',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Inline links on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.info.text on sys.status.info.surface',
    foreground: 'sys.status.info.text',
    background: 'sys.status.info.surface',
    threshold: 4.5,
    summary: 'Info text inside info surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.success.text on sys.status.success.surface',
    foreground: 'sys.status.success.text',
    background: 'sys.status.success.surface',
    threshold: 4.5,
    summary: 'Success text inside success surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.warning.text on sys.status.warning.surface',
    foreground: 'sys.status.warning.text',
    background: 'sys.status.warning.surface',
    threshold: 4.5,
    summary: 'Warning text inside warning surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.critical.text on sys.status.critical.surface',
    foreground: 'sys.status.critical.text',
    background: 'sys.status.critical.surface',
    threshold: 4.5,
    summary: 'Critical text inside critical surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.info.icon on sys.status.info.surface',
    foreground: 'sys.status.info.icon',
    background: 'sys.status.info.surface',
    threshold: 3,
    summary: 'Info icons inside info surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.success.icon on sys.status.success.surface',
    foreground: 'sys.status.success.icon',
    background: 'sys.status.success.surface',
    threshold: 3,
    summary: 'Success icons inside success surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.warning.icon on sys.status.warning.surface',
    foreground: 'sys.status.warning.icon',
    background: 'sys.status.warning.surface',
    threshold: 3,
    summary: 'Warning icons inside warning surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.critical.icon on sys.status.critical.surface',
    foreground: 'sys.status.critical.icon',
    background: 'sys.status.critical.surface',
    threshold: 3,
    summary: 'Critical icons inside critical surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.accent.text on sys.status.accent.surface',
    foreground: 'sys.status.accent.text',
    background: 'sys.status.accent.surface',
    threshold: 4.5,
    summary: 'Accent text inside accent surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.accent.icon on sys.status.accent.surface',
    foreground: 'sys.status.accent.icon',
    background: 'sys.status.accent.surface',
    threshold: 3,
    summary: 'Accent icons inside accent surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.neutral.text on sys.status.neutral.surface',
    foreground: 'sys.status.neutral.text',
    background: 'sys.status.neutral.surface',
    threshold: 4.5,
    summary: 'Neutral text inside neutral surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.neutral.icon on sys.status.neutral.surface',
    foreground: 'sys.status.neutral.icon',
    background: 'sys.status.neutral.surface',
    threshold: 3,
    summary: 'Neutral icons inside neutral surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.canvas',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.canvas',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against the default surface.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.raised',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.raised',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against raised surfaces.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.subtle',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.subtle',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against subtle surfaces.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.default',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.default',
    threshold: 4.5,
    summary: 'Interactive text on the default primary surface must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.hover',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.hover',
    threshold: 4.5,
    summary: 'Interactive text on hover states must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.pressed',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.pressed',
    threshold: 4.5,
    summary: 'Interactive text on pressed states must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.default',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.default',
    threshold: 4.5,
    summary: 'Dark theme interactive text on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.hover',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.hover',
    threshold: 4.5,
    summary: 'Dark theme interactive text on hover surfaces must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.pressed',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.pressed',
    threshold: 4.5,
    summary: 'Dark theme interactive text on pressed surfaces must remain AA compliant.'
  }
];

function toSegments(tokenPath) {
  return tokenPath.split('.').map((segment) => segment.trim()).filter(Boolean);
}

async function loadTokenTree() {
  const raw = await readFile(TOKEN_SOURCE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed?.tokens) {
    throw new Error(`Unable to load tokens from ${TOKEN_SOURCE}`);
  }
  return parsed.tokens;
}

function resolveTokenNode(tree, tokenPath) {
  const segments = toSegments(tokenPath);
  let current = tree;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      throw new Error(`Token path "${tokenPath}" could not be resolved.`);
    }

    let key = segment;
    if (!(key in current)) {
      const alternatives = new Set([segment.replace(/-/g, '_'), segment.replace(/_/g, '-')]);
      for (const alt of alternatives) {
        if (alt && alt in current) {
          key = alt;
          break;
        }
      }
    }

    if (!(key in current)) {
      throw new Error(`Token path "${tokenPath}" could not be resolved.`);
    }

    current = current[key];
  }

  if (!current || typeof current !== 'object' || !('$value' in current)) {
    throw new Error(`Token path "${tokenPath}" does not reference a token with a $value.`);
  }

  return current;
}

function resolveToken(tree, tokenPath, seen = new Set()) {
  if (seen.has(tokenPath)) {
    throw new Error(`Circular token alias detected at "${tokenPath}".`);
  }
  seen.add(tokenPath);

  const node = resolveTokenNode(tree, tokenPath);
  const value = node.$value;

  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const aliasPath = value.slice(1, -1);
    return resolveToken(tree, aliasPath, seen);
  }

  if (typeof value !== 'string') {
    throw new Error(`Token "${tokenPath}" does not resolve to a string value.`);
  }

  return { node, value };
}

function normaliseColor(token, tokenPath) {
  const fallback = token.node?.$extensions?.ods?.fallback;
  if (fallback && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(fallback)) {
    return fallback;
  }

  const trimmed = token.value.trim();
  if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('oklch')) {
    try {
      const colour = new Color(trimmed);
      return colour
        .to('srgb')
        .toString({ format: 'hex', collapse: false })
        .toUpperCase();
    } catch (error) {
      throw new Error(`Unable to convert "${trimmed}" from ${tokenPath} to hex: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Token "${tokenPath}" resolved to an unsupported colour format "${trimmed}".`);
}

function resolveColor(tree, tokenPath) {
  const token = resolveToken(tree, tokenPath);
  return normaliseColor(token, tokenPath);
}

function parseOklchComponents(rawValue, tokenPath) {
  const value = String(rawValue ?? '').trim();
  try {
    const colour = new Color(value);
    const { l, c, h } = colour.oklch;
    const hue = Number.isFinite(h) ? h : 0;
    return { l, c, h: hue };
  } catch (error) {
    throw new Error(`Unable to parse "${value}" from ${tokenPath} as OKLCH: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hueDelta(baseHue, derivedHue) {
  const base = Number.isFinite(baseHue) ? baseHue : 0;
  const derived = Number.isFinite(derivedHue) ? derivedHue : 0;
  return ((derived - base + 540) % 360) - 180;
}

function formatSigned(value, digits = 4) {
  const formatted = value.toFixed(digits);
  return value >= 0 ? `+${formatted}` : formatted;
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

async function loadGuardrailConfig() {
  let raw;
  try {
    raw = await readFile(GUARDRAILS_PATH, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read guardrail dataset at ${GUARDRAILS_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const rows = lines.filter((line) => line.length > 0 && !line.startsWith('#'));

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].split(',').map((header) => header.trim());
  return rows.slice(1).map((line, index) => {
    const columns = line.split(',').map((column) => column.trim());
    if (columns.length !== headers.length) {
      throw new Error(`Guardrail CSV row ${index + 2} expected ${headers.length} columns but received ${columns.length}.`);
    }

    const entry = {};
    headers.forEach((header, columnIndex) => {
      entry[header] = columns[columnIndex];
    });

    const numeric = (fieldName) => {
      const value = entry[fieldName];
      if (value === undefined || value === '') {
        return null;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        throw new Error(`Guardrail CSV row ${index + 2} column "${fieldName}" must be numeric. Received "${value}".`);
      }
      return asNumber;
    };

    if (!entry.base_token) {
      throw new Error(`Guardrail CSV row ${index + 2} is missing "base_token".`);
    }
    if (!entry.derived_token) {
      throw new Error(`Guardrail CSV row ${index + 2} is missing "derived_token".`);
    }

    return {
      id: entry.id ?? `${entry.usage ?? 'guardrail'}-${entry.theme ?? 'default'}-${entry.state ?? 'state'}`,
      usage: entry.usage ?? 'unknown',
      theme: entry.theme ?? 'default',
      state: entry.state ?? 'state',
      baseToken: entry.base_token,
      derivedToken: entry.derived_token,
      deltaLMin: numeric('delta_l_min'),
      deltaLMax: numeric('delta_l_max'),
      deltaCMin: numeric('delta_c_min'),
      deltaCMax: numeric('delta_c_max'),
      deltaHMax: numeric('delta_h_max'),
      contrastForeground: entry.contrast_foreground_token ? entry.contrast_foreground_token : null,
      contrastBackground: entry.contrast_background_token ? entry.contrast_background_token : null,
      contrastThreshold: numeric('contrast_threshold')
    };
  });
}

async function loadContractDefinition() {
  let raw;
  try {
    raw = await readFile(CONTRACT_PATH, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Accessibility contract not found at ${CONTRACT_PATH}.`);
    }
    throw new Error(`Unable to read accessibility contract at ${CONTRACT_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.stories) || parsed.stories.length === 0) {
      throw new Error('Accessibility contract must include a non-empty "stories" array.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Accessibility contract JSON is invalid: ${error.message}`);
    }
    throw error;
  }
}

async function ensureStorybookBuildExists() {
  const iframePath = path.join(STORYBOOK_STATIC_DIR, 'iframe.html');
  try {
    await stat(iframePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Storybook static build not found at ${STORYBOOK_STATIC_DIR}. Run "pnpm run build-storybook" before executing the accessibility contract.`
      );
    }
    throw error;
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.mjs':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function startStorybookServer(rootDir) {
  const safeRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
        const decodedPath = decodeURIComponent(requestUrl.pathname);
        const resolvedPath = path.join(rootDir, decodedPath);
        const normalisedPath = path.normalize(resolvedPath);

        if (normalisedPath !== rootDir && !normalisedPath.startsWith(safeRoot)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let finalPath = normalisedPath;
        let stats;
        try {
          stats = await stat(finalPath);
        } catch {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        if (stats.isDirectory()) {
          finalPath = path.join(finalPath, 'index.html');
        }

        const contentType = contentTypeFor(finalPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        const stream = createReadStream(finalPath);
        stream.on('error', (error) => {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : String(error));
        });
        stream.pipe(res);
      } catch (error) {
        res.statusCode = 500;
        res.end(error instanceof Error ? error.message : String(error));
      }
    });

    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({ server, port: address.port });
      } else {
        reject(new Error('Failed to determine Storybook static server address.'));
      }
    });
  });
}

function buildStoryUrl(port, storyId, query) {
  const url = new URL(`http://127.0.0.1:${port}/iframe.html`);
  url.searchParams.set('id', storyId);
  url.searchParams.set('viewMode', 'story');
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  if (trimmedQuery) {
    const extraParams = new URLSearchParams(trimmedQuery);
    extraParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
}

function extractNodeTargets(node) {
  if (!node) {
    return [];
  }
  const targets = Array.isArray(node.target) ? node.target : [];
  return targets.map((target) => String(target ?? '').trim()).filter(Boolean);
}

function formatViolationDetails(violation) {
  const nodes = Array.isArray(violation?.nodes) ? violation.nodes : [];
  return {
    id: violation?.id ?? 'unknown',
    impact: violation?.impact ?? null,
    help: violation?.help ?? '',
    description: violation?.description ?? '',
    helpUrl: violation?.helpUrl ?? '',
    nodes: nodes.map((node) => ({
      target: extractNodeTargets(node).join(' '),
      html: node?.html ?? '',
      failureSummary: node?.failureSummary ?? ''
    }))
  };
}

function violationSummary(violations, storyUrl) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return '';
  }
  const [first] = violations;
  const targets = Array.isArray(first?.nodes)
    ? first.nodes
        .flatMap((node) => extractNodeTargets(node))
        .filter(Boolean)
        .join(', ')
    : '';
  const headline = [
    first?.id ?? 'violation',
    first?.impact ? `(${first.impact})` : '',
    first?.help ?? first?.description ?? ''
  ]
    .filter(Boolean)
    .join(' ');
  const targetSuffix = targets ? ` → nodes: ${targets}` : '';
  return `${violations.length} violation(s). ${headline}${targetSuffix}. Inspect ${storyUrl}`;
}

async function evaluateContractStories(contract) {
  if (!contract || !Array.isArray(contract.stories) || contract.stories.length === 0) {
    return [];
  }

  await ensureStorybookBuildExists();

  const { server, port } = await startStorybookServer(STORYBOOK_STATIC_DIR);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const failImpacts = Array.isArray(contract.failOnImpact) && contract.failOnImpact.length > 0
    ? [...contract.failOnImpact]
    : [...DEFAULT_FAIL_IMPACTS];
  const failImpactSet = new Set(failImpacts.map((value) => String(value).toLowerCase()));

  const runOnly = contract.axe?.runOnly ?? null;
  const rules = contract.axe?.rules ?? null;

  const results = [];

  try {
    for (const story of contract.stories) {
      const variants = Array.isArray(story?.variants) && story.variants.length > 0
        ? story.variants
        : [{ name: 'Default', query: story?.query ?? '' }];

      for (const variant of variants) {
        const labelParts = [story?.title ?? story.id];
        if (variant?.name) {
          labelParts.push(variant.name);
        }
        const targetLabel = labelParts.join(' • ');
        const ruleId = `story:${story.id}${variant?.name ? `::${variant.name}` : ''}`;
        const storyUrl = buildStoryUrl(port, story.id, variant?.query ?? story?.query ?? '');
        const summary = `Axe contract (WCAG 2.x serious/critical) must pass without violations for ${story.id}.`;

        let pass = false;
        let failureSummary = '';
        let details = {};
        const startedAt = Date.now();

        try {
          await page.goto(storyUrl, { waitUntil: 'networkidle', timeout: STORY_LOAD_TIMEOUT_MS });
          await page.waitForTimeout(STORY_POST_LOAD_WAIT_MS);

          const hasAxe = await page.evaluate(() => Boolean(window.axe));
          if (!hasAxe) {
            await page.addScriptTag({ path: AXE_MINIFIED_PATH });
          }

          const axePayload = await page.evaluate(
            async ({ runOnly: runOnlyOptions, rules: runRules }) => {
              const options = {};
              if (runOnlyOptions) {
                options.runOnly = runOnlyOptions;
              }
              if (runRules) {
                options.rules = runRules;
              }
              return window.axe.run(document, options);
            },
            { runOnly, rules }
          );

          const violations = Array.isArray(axePayload?.violations) ? axePayload.violations : [];
          const filteredViolations = violations.filter((violation) => {
            if (!violation?.impact) {
              return true;
            }
            return failImpactSet.has(String(violation.impact).toLowerCase());
          });

          pass = filteredViolations.length === 0;
          failureSummary = pass ? '' : violationSummary(filteredViolations, storyUrl);

          details = {
            storyId: story.id,
            variant: variant?.name ?? null,
            url: storyUrl,
            tags: Array.isArray(story?.tags) ? story.tags : [],
            failOnImpact: [...failImpactSet],
            violations: filteredViolations.map((violation) => formatViolationDetails(violation)),
            incomplete: Array.isArray(axePayload?.incomplete)
              ? axePayload.incomplete.map((violation) => formatViolationDetails(violation))
              : [],
            durationMs: Date.now() - startedAt
          };
        } catch (error) {
          pass = false;
          failureSummary = `[contract] Failed to evaluate ${story.id}${variant?.name ? ` (${variant.name})` : ''}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          details = {
            storyId: story.id,
            variant: variant?.name ?? null,
            url: storyUrl,
            tags: Array.isArray(story?.tags) ? story.tags : [],
            error: error instanceof Error ? error.stack ?? error.message : String(error),
            durationMs: Date.now() - startedAt
          };
        }

        results.push({
          ruleId,
          checkType: 'contract',
          target: targetLabel,
          summary,
          pass,
          failureSummary,
          details
        });
      }
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return results;
}

function evaluateGuardrails(tree, guardrails) {
  if (!Array.isArray(guardrails) || guardrails.length === 0) {
    return [];
  }

  return guardrails.map((guardrail) => {
    const baseToken = resolveToken(tree, guardrail.baseToken);
    const derivedToken = resolveToken(tree, guardrail.derivedToken);

    const baseOklchRaw = parseOklchComponents(baseToken.value, guardrail.baseToken);
    const derivedOklchRaw = parseOklchComponents(derivedToken.value, guardrail.derivedToken);

    const deltaL = derivedOklchRaw.l - baseOklchRaw.l;
    const deltaC = derivedOklchRaw.c - baseOklchRaw.c;
    const deltaH = hueDelta(baseOklchRaw.h, derivedOklchRaw.h);
    const deltaHAbs = Math.abs(deltaH);

    const checks = [];
    const failures = [];

    if (guardrail.deltaLMin != null && guardrail.deltaLMax != null) {
      const pass = deltaL >= guardrail.deltaLMin - RANGE_TOLERANCE && deltaL <= guardrail.deltaLMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaL',
        pass,
        actual: deltaL,
        expectedMin: guardrail.deltaLMin,
        expectedMax: guardrail.deltaLMax
      });
      if (!pass) {
        failures.push(`ΔL ${formatSigned(deltaL)} outside [${guardrail.deltaLMin}, ${guardrail.deltaLMax}].`);
      }
    }

    if (guardrail.deltaCMin != null && guardrail.deltaCMax != null) {
      const pass = deltaC >= guardrail.deltaCMin - RANGE_TOLERANCE && deltaC <= guardrail.deltaCMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaC',
        pass,
        actual: deltaC,
        expectedMin: guardrail.deltaCMin,
        expectedMax: guardrail.deltaCMax
      });
      if (!pass) {
        failures.push(`ΔC ${formatSigned(deltaC)} outside [${guardrail.deltaCMin}, ${guardrail.deltaCMax}].`);
      }
    }

    if (guardrail.deltaHMax != null) {
      const pass = deltaHAbs <= guardrail.deltaHMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaH',
        pass,
        actual: deltaHAbs,
        expectedMax: guardrail.deltaHMax
      });
      if (!pass) {
        failures.push(`ΔH ${deltaHAbs.toFixed(4)} exceeds ${guardrail.deltaHMax}.`);
      }
    }

    let contrastRatioValue;
    let baseContrastRatio;
    if (guardrail.contrastThreshold != null) {
      const foregroundPath = guardrail.contrastForeground ?? null;
      const backgroundPath = guardrail.contrastBackground ?? guardrail.derivedToken;
      if (!foregroundPath) {
        throw new Error(`Guardrail "${guardrail.id}" specifies a contrast threshold but no foreground token.`);
      }
      const foregroundHex = resolveColor(tree, foregroundPath);
      const derivedHex = resolveColor(tree, backgroundPath);
      contrastRatioValue = contrastRatio(foregroundHex, derivedHex);
      const pass = contrastRatioValue + Number.EPSILON >= guardrail.contrastThreshold;
      checks.push({
        type: 'contrast',
        pass,
        ratio: contrastRatioValue,
        threshold: guardrail.contrastThreshold,
        foreground: foregroundPath,
        background: backgroundPath
      });
      if (!pass) {
        failures.push(`Contrast ${contrastRatioValue.toFixed(2)}:1 below ${guardrail.contrastThreshold}:1.`);
      }

      try {
        const baseHex = resolveColor(tree, guardrail.baseToken);
        baseContrastRatio = contrastRatio(foregroundHex, baseHex);
      } catch {
        baseContrastRatio = null;
      }
    }

    const pass = checks.every((check) => check.pass);

    const baseOklch = {
      l: Number(baseOklchRaw.l.toFixed(4)),
      c: Number(baseOklchRaw.c.toFixed(4)),
      h: Number(baseOklchRaw.h.toFixed(2))
    };
    const derivedOklch = {
      l: Number(derivedOklchRaw.l.toFixed(4)),
      c: Number(derivedOklchRaw.c.toFixed(4)),
      h: Number(derivedOklchRaw.h.toFixed(2))
    };

    return {
      ruleId: `guardrail:${guardrail.id}`,
      checkType: 'guardrail',
      target: `${titleCase(guardrail.usage)} (${titleCase(guardrail.theme)}) • ${titleCase(guardrail.state)}`,
      summary: [
        `Derived token ${guardrail.derivedToken} must remain within guardrail Δ ranges of ${guardrail.baseToken}.`,
        guardrail.contrastThreshold != null
          ? `Maintain ≥${guardrail.contrastThreshold}:1 contrast using ${guardrail.contrastForeground ?? guardrail.contrastBackground ?? guardrail.derivedToken}.`
          : null
      ].filter(Boolean).join(' '),
      pass,
      failureSummary: failures.join(' '),
      ratio: typeof contrastRatioValue === 'number' ? Number(contrastRatioValue.toFixed(2)) : undefined,
      threshold: guardrail.contrastThreshold ?? undefined,
      metrics: {
        deltaL: Number(deltaL.toFixed(4)),
        deltaC: Number(deltaC.toFixed(4)),
        deltaH: Number(deltaH.toFixed(4)),
        baseToken: guardrail.baseToken,
        derivedToken: guardrail.derivedToken,
        baseOklch,
        derivedOklch,
        contrast: contrastRatioValue == null
          ? null
          : {
              ratio: Number(contrastRatioValue.toFixed(2)),
              threshold: guardrail.contrastThreshold,
              baseRatio: baseContrastRatio == null ? null : Number(baseContrastRatio.toFixed(2)),
              foreground: guardrail.contrastForeground,
              background: guardrail.contrastBackground ?? guardrail.derivedToken
            }
      },
      details: {
        usage: guardrail.usage,
        theme: guardrail.theme,
        state: guardrail.state,
        checks
      }
    };
  });
}

async function generateReport() {
  const tree = await loadTokenTree();

  const contrastResults = RULES.map((rule) => {
    const foreground = resolveColor(tree, rule.foreground);
    const background = resolveColor(tree, rule.background);

    const ratio = contrastRatio(foreground, background);
    const pass = ratio + Number.EPSILON >= rule.threshold;
    const ratioRounded = Number(ratio.toFixed(2));

    return {
      ruleId: rule.ruleId,
      checkType: 'contrast',
      target: rule.target,
      summary: rule.summary,
      ratio: ratioRounded,
      threshold: rule.threshold,
      pass,
      failureSummary: pass
        ? ''
        : `Expected contrast ratio >= ${rule.threshold}, but received ${ratioRounded}.`,
      details: {
        foreground: rule.foreground,
        background: rule.background
      }
    };
  });

  const guardrailConfig = await loadGuardrailConfig();
  const guardrailResults = evaluateGuardrails(tree, guardrailConfig);

  const contractDefinition = await loadContractDefinition();
  const contractResults = await evaluateContractStories(contractDefinition);

  const results = [...contrastResults, ...guardrailResults, ...contractResults];

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      contrast: contrastResults.length,
      guardrails: guardrailResults.length,
      contract: contractResults.length,
      overall: results.length
    },
    sections: {
      contrast: contrastResults,
      guardrails: guardrailResults,
      contract: contractResults
    },
    results
  };
}

async function ensureReportDir() {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
}

async function writeReport(report) {
  await ensureReportDir();
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function fingerprint(entry) {
  return `${entry.ruleId}::${entry.target}::${entry.summary}`;
}

async function loadBaseline() {
  const raw = await readFile(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const violations = Array.isArray(parsed?.violations) ? parsed.violations : [];
  return {
    ...parsed,
    violations
  };
}

async function runCheck() {
  const report = await generateReport();
  await writeReport(report);

  const contrastResults = Array.isArray(report.sections?.contrast) ? report.sections.contrast : [];
  const guardrailResults = Array.isArray(report.sections?.guardrails) ? report.sections.guardrails : [];
  const contractResults = Array.isArray(report.sections?.contract) ? report.sections.contract : [];

  const contrastPasses = contrastResults.filter((item) => item.pass).length;
  const guardrailPasses = guardrailResults.filter((item) => item.pass).length;
  const contractPasses = contractResults.filter((item) => item.pass).length;
  const totalPasses = report.results.filter((item) => item.pass).length;
  const totalFailures = report.results.length - totalPasses;

  const summaryParts = [];
  if (contrastResults.length > 0) {
    summaryParts.push(`contrast ${contrastPasses}/${contrastResults.length}`);
  }
  if (guardrailResults.length > 0) {
    summaryParts.push(`guardrails ${guardrailPasses}/${guardrailResults.length}`);
  }
  if (contractResults.length > 0) {
    summaryParts.push(`contract ${contractPasses}/${contractResults.length}`);
  }
  summaryParts.push(`total ${totalPasses}/${report.results.length}`);

  console.log(`[a11y] Report written to ${path.relative(process.cwd(), REPORT_PATH)} (${summaryParts.join(', ')}).`);

  if (totalFailures > 0) {
    console.warn('[a11y] Accessibility contrast/guardrail/contract violations detected. Run "pnpm run a11y:diff" to compare against the baseline.');
  }
}

async function runDiff() {
  const report = await generateReport();
  await writeReport(report);

  let baseline;
  try {
    baseline = await loadBaseline();
  } catch (error) {
    console.error(`[a11y] Failed to read baseline from ${BASELINE_PATH}.`);
    throw error;
  }

  const baselineFingerprints = new Set(
    baseline.violations.map((violation) => fingerprint(violation))
  );
  const currentViolations = report.results.filter((item) => !item.pass);

  const newViolations = currentViolations.filter(
    (violation) => !baselineFingerprints.has(fingerprint(violation))
  );

  const resolvedViolations = baseline.violations.filter(
    (violation) => !currentViolations.some(
      (current) => fingerprint(current) === fingerprint(violation)
    )
  );

  if (newViolations.length > 0) {
    console.error('[a11y] New accessibility guardrail/contrast/contract violations detected:');
    for (const violation of newViolations) {
      const label = violation.checkType ? `[${violation.checkType}] ` : '';
      const hasRatio = typeof violation.ratio === 'number' && typeof violation.threshold === 'number';
      const ratioPart = hasRatio ? ` — ratio ${violation.ratio} (threshold ${violation.threshold})` : '';
      console.error(`  • ${label}${violation.target}${ratioPart}`);
      if (violation.failureSummary) {
        console.error(`    ↳ ${violation.failureSummary}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (resolvedViolations.length > 0) {
    console.log('[a11y] Existing baseline violations now passing:');
    for (const violation of resolvedViolations) {
      console.log(`  • ${violation.target}`);
    }
    console.log('[a11y] Consider updating the baseline with "node tools/a11y/index.mjs baseline".');
  }

  console.log('[a11y] No new accessibility guardrail, contrast, or contract violations detected.');
}

async function runBaselineUpdate() {
  const report = await generateReport();
  await writeReport(report);

  const violations = report.results.filter((item) => !item.pass);
  const baseline = {
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(path.dirname(BASELINE_PATH), REPORT_PATH),
    fingerprintFields: ['ruleId', 'target', 'summary'],
    violations
  };

  await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
  await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');

  console.log(`[a11y] Baseline updated with ${violations.length} violation(s).`);
}

async function main() {
  const [, , rawCommand] = process.argv;
  const command = rawCommand ?? 'check';

  try {
    if (command === 'check') {
      await runCheck();
    } else if (command === 'diff') {
      await runDiff();
    } else if (command === 'baseline') {
      await runBaselineUpdate();
    } else {
      console.error(`[a11y] Unknown command "${command}". Expected "check", "diff", or "baseline".`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[a11y] An error occurred while evaluating contrast rules.');
    if (error instanceof Error) {
      console.error(`      ${error.message}`);
    } else {
      console.error(`      ${String(error)}`);
    }
    process.exitCode = 1;
  }
}

await main();
