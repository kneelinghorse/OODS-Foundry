#!/usr/bin/env node
// Light/Dark snapshot harness
// Captures all stories tagged with `vrt-critical` in Storybook for light and dark modes.
// Usage:
//  1) Start Storybook: cd app && npm run storybook
//  2) node app/testkits/vrt/storycap.lightdark.mjs --out artifacts/vrt/lightdark/local [--baseURL http://127.0.0.1:6006]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORY_TAG = 'vrt-critical';

const log = (...args) => console.log('[ld-storycap]', ...args);
const warn = (...args) => console.warn('[ld-storycap]', ...args);

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
  // Storybook >=7: { entries: { id: { id, title, name, type, tags? } } }
  // Storybook <=6: { stories: { id: { id, title, name, kind, parameters } } }
  if (index.entries) {
    return Object.values(index.entries).map((e) => ({ id: e.id, title: e.title, name: e.name, type: e.type, tags: e.tags || [] }));
  }
  if (index.stories) {
    return Object.values(index.stories).map((e) => {
      const isDocs = typeof e.id === 'string' && e.id.endsWith('--docs');
      const tags = Array.isArray(e.tags) ? e.tags : [];
      return { id: e.id, title: e.title || e.kind, name: e.name, type: isDocs ? 'docs' : 'story', tags };
    });
  }
  throw new Error('Unrecognized Storybook index format');
}

function filterVrtCritical(entries) {
  // Prefer entries explicitly tagged; tolerate index formats without tags by falling back to heuristic
  const tagged = entries.filter((e) => Array.isArray(e.tags) && e.tags.includes(STORY_TAG));
  if (tagged.length) return tagged;
  // Heuristic fallback: include entries with names containing 'States' from Components.* and core patterns
  return entries.filter((e) => /^(Components|Patterns|Explorer)\b/.test(e.title) && /states/i.test(e.name || ''));
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
  const outRoot = args.out || path.join(process.cwd(), 'artifacts', 'vrt', 'lightdark', buildId);
  const outLight = path.join(outRoot, 'light');
  const outDark = path.join(outRoot, 'dark');
  ensureDir(outLight);
  ensureDir(outDark);

  log('Base URL:', args.baseURL);
  const ready = await waitForServer(args.baseURL, 20000);
  if (!ready) {
    throw new Error(`Storybook not reachable at ${args.baseURL}. Start it with \`npm run storybook\` (dev) or serve \`storybook-static\`.`);
  }

  const { json: indexJson } = await fetchIndexJson(args.baseURL);
  const entries = normalizeEntries(indexJson);
  const targets = filterVrtCritical(entries);

  if (!targets.length) {
    throw new Error('No stories tagged with vrt-critical found.');
  }
  log(`Found ${targets.length} targets`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Disable animations for stability
  await page.addStyleTag({
    content: '*{animation: none !important; transition: none !important;} html,body{scroll-behavior:auto !important;}',
  });

  const modes = [
    { name: 'light', globals: 'theme:light', outDir: outLight },
    { name: 'dark', globals: 'theme:dark', outDir: outDark },
  ];

  let captured = 0;
  for (const t of targets) {
    const isDocsId = t.id.endsWith('--docs');
    const viewMode = isDocsId ? 'docs' : 'story';
    for (const m of modes) {
      const url = `${args.baseURL}/iframe.html?id=${encodeURIComponent(t.id)}&viewMode=${viewMode}&globals=${encodeURIComponent(m.globals)}`;

      const titleSlug = sanitize(t.title.replace(/\//g, '-'));
      const nameSlug = sanitize(t.name || (isDocsId ? 'docs' : 'page'));
      const fileName = `${titleSlug}--${nameSlug}.png`;
      const outPath = path.join(m.outDir, fileName);

      log(`[${m.name}] → Navigating`, url);
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 });

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
  }

  await browser.close();
  log(`Completed Light/Dark capture: ${captured} image(s) at ${path.relative(process.cwd(), outRoot)}`);
}

main().catch((err) => {
  console.error('[ld-storycap] ERROR:', err?.message || err);
  process.exitCode = 1;
});

