#!/usr/bin/env node
// High-Contrast (forced-colors) snapshot harness
// Captures a focused set of Storybook stories/docs with Playwright under forced-colors: active
// Usage: node app/testkits/vrt/storycap.hc.mjs --out artifacts/vrt/hc/local [--baseURL http://127.0.0.1:6006]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = (...args) => console.log('[hc-storycap]', ...args);
const warn = (...args) => console.warn('[hc-storycap]', ...args);

const sanitize = (value) =>
  String(value)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

function parseArgs(argv) {
  const args = { baseURL: process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006', out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--baseURL' && argv[i + 1]) {
      args.baseURL = argv[++i];
    } else if (a === '--out' && argv[i + 1]) {
      args.out = argv[++i];
    }
  }
  return args;
}

function defaultBuildId() {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return process.env.GITHUB_RUN_ID || process.env.GITHUB_SHA || `local-${stamp}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchIndexJson(baseURL) {
  const endpoints = ['/index.json', '/stories.json'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(new URL(ep, baseURL));
      if (res.ok) {
        const json = await res.json();
        return { endpoint: ep, json };
      }
    } catch (e) {
      // try next
    }
  }
  throw new Error(`Unable to fetch Storybook index from ${baseURL} (tried ${endpoints.join(', ')})`);
}

function normalizeEntries(index) {
  // Storybook >=7: { entries: { id: { id, title, name, type } } }
  // Storybook <=6: { stories: { id: { id, title, name, kind, parameters } } }
  if (index.entries) {
    return Object.values(index.entries).map((e) => ({ id: e.id, title: e.title, name: e.name, type: e.type }));
  }
  if (index.stories) {
    return Object.values(index.stories).map((e) => {
      const isDocs = typeof e.id === 'string' && e.id.endsWith('--docs');
      return { id: e.id, title: e.title || e.kind, name: e.name, type: isDocs ? 'docs' : 'story' };
    });
  }
  throw new Error('Unrecognized Storybook index format');
}

function resolveTargets(entries) {
  // Desired set (~10): Foundations.Colors (docs), 4 Components (primary), 4 Contexts (docs), PageHeader default
  // Titles in Storybook may be formatted with '/' or '.' separators. Normalize by creating a map with both.
  const desired = [
    // Foundations
    { titles: ['Foundations/Colors/Theme 0', 'Foundations/Colors', 'Foundations.Colors'], prefer: 'docs' },
    // Components
    { titles: ['Components/Button'], name: 'Primary' },
    { titles: ['Components/Badge'], name: 'Primary' },
    { titles: ['Components/Banner'], name: 'Primary' },
    { titles: ['Components/Input'], name: 'Primary' },
    // Newly added components (Sprint 08)
    { titles: ['Components/TextArea', 'Components.TextArea'], name: 'Primary' },
    { titles: ['Components/Checkbox', 'Components.Checkbox'], name: 'Primary' },
    { titles: ['Components/Radio', 'Components.Radio'], name: 'Primary' },
    { titles: ['Components/Toggle', 'Components.Toggle'], name: 'Primary' },
    { titles: ['Components/Select', 'Components.Select'], name: 'Primary' },
    { titles: ['Components/Tabs', 'Components.Tabs'], name: 'Primary' },
    { titles: ['Components/Tooltip', 'Components.Tooltip'], name: 'Primary' },
    { titles: ['Components/Toast', 'Components.Toast'], name: 'Primary' },
  // Contexts
  { titles: ['Docs/Contexts/List'], prefer: 'docs' },
  { titles: ['Docs/Contexts/Detail'], prefer: 'docs' },
  { titles: ['Docs/Contexts/Form'], prefer: 'docs' },
  { titles: ['Docs/Contexts/Timeline'], prefer: 'docs' },
  { titles: ['Docs/Contexts/Dark'], prefer: 'docs' },
    // Patterns
    { titles: ['Patterns/Form', 'Patterns.Form'], prefer: 'docs' },
    // Page header (round to ~10 total)
    { titles: ['Components/PageHeader'], name: 'Default' },
    // Base primitives
    { titles: ['Base/Button'], name: 'Primary' },
    { titles: ['Base/Badge'], name: 'Primary' },
    // Explorer showcase
    { titles: ['Explorer/StatusChip'], name: 'SubscriptionStates' },
  // Foundations (additional)
  { titles: ['Docs/Foundations/Borders'], prefer: 'docs' },
  { titles: ['Docs/Foundations/Motion'], prefer: 'docs' },
  { titles: ['Docs/Foundations/Shadows'], prefer: 'docs' },
  { titles: ['Docs/Foundations/Typography'], prefer: 'docs' },
  // A11y contract page
  { titles: ['Docs/Accessibility/Contract A11y'], prefer: 'docs' },
    // Object renderers
    { titles: ['Subscription/RenderObject'], name: 'ActiveDetail' },
    { titles: ['User/RenderObject'], name: 'ActiveDetail' },
  ];

  // Index by title
  const byTitle = new Map();
  for (const e of entries) {
    const list = byTitle.get(e.title) || [];
    list.push(e);
    byTitle.set(e.title, list);
  }

  const chosen = [];
  for (const spec of desired) {
    let list = [];
    for (const t of spec.titles) {
      list = byTitle.get(t) || list;
      if (list.length) break;
    }
    if (!list.length) {
      warn('No entries for titles:', spec.titles.join(' | '));
      continue;
    }
    let pick = null;
    if (spec.name) {
      pick = list.find((e) => e.name === spec.name) || null;
    }
    if (!pick && spec.prefer === 'docs') {
      pick = list.find((e) => e.type === 'docs') || null;
    }
    if (!pick) {
      pick = list.find((e) => e.type === 'story') || list[0];
    }
    if (pick) chosen.push(pick);
  }
  return chosen;
}

async function waitForServer(baseURL, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(new URL('/', baseURL));
      if (res.ok) return true;
    } catch (_) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const buildId = defaultBuildId();
  const outRoot = args.out || path.join(process.cwd(), 'artifacts', 'vrt', 'hc', buildId);
  ensureDir(outRoot);

  log('Base URL:', args.baseURL);
  const ready = await waitForServer(args.baseURL, 20000);
  if (!ready) {
    throw new Error(`Storybook not reachable at ${args.baseURL}. Start it with \`npm run storybook\` (dev) or serve \`storybook-static\`.`);
  }

  const { json: indexJson } = await fetchIndexJson(args.baseURL);
  const entries = normalizeEntries(indexJson);
  const targets = resolveTargets(entries);

  if (!targets.length) {
    throw new Error('No target stories/docs found for HC capture.');
  }
  log(`Found ${targets.length} targets`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Try to force HC using emulateMedia (supported in recent Playwright)
  try {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    log('Applied emulateMedia forcedColors: active');
  } catch (e) {
    warn('emulateMedia forcedColors not supported in this Playwright version; HC CSS may not activate');
  }

  // Disable animations for stability
  await page.addStyleTag({
    content: '*{animation: none !important; transition: none !important;} html,body{scroll-behavior:auto !important;}',
  });

  let captured = 0;
  for (const t of targets) {
    const isDocsId = t.id.endsWith('--docs');
    const viewMode = isDocsId ? 'docs' : 'story';
    const url = `${args.baseURL}/iframe.html?id=${encodeURIComponent(t.id)}&viewMode=${viewMode}`;

    const titleSlug = sanitize(t.title.replace(/\//g, '-'));
    const nameSlug = sanitize(t.name || (isDocsId ? 'docs' : 'page'));
    const fileName = `${titleSlug}--${nameSlug}.png`;
    const outPath = path.join(outRoot, fileName);

    log('→ Navigating', url);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    // Storybook root ensures we capture content only
    const root = page.locator('#storybook-root');
    const hasRoot = await root.count();
    if (!hasRoot) {
      warn('No #storybook-root for', t.id, 'falling back to full page screenshot');
      await page.screenshot({ path: outPath, fullPage: true });
    } else {
      const box = await root.boundingBox();
      if (box) {
        await page.screenshot({ path: outPath, clip: box });
      } else {
        await page.screenshot({ path: outPath, fullPage: true });
      }
    }
    captured++;
    log('✓ Saved', path.relative(process.cwd(), outPath));
  }

  await browser.close();
  log(`Completed HC capture: ${captured} image(s) at ${path.relative(process.cwd(), outRoot)}`);
}

main().catch((err) => {
  console.error('[hc-storycap] ERROR:', err?.message || err);
  process.exitCode = 1;
});
