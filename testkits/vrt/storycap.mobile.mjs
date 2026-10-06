#!/usr/bin/env node
/**
 * s173 m04 (crawl 3) — a 375px capture, over an EXPLICIT story list.
 *
 * WHAT THIS IS NOT: a screenshot gate. The images are local artefacts for a human to look at
 * while working on the collapse; nothing compares them to a baseline and nothing fails on
 * them. A committed mobile screenshot corpus was declined for this sprint — the baselines
 * would be platform-dependent, no CI runner regenerates them, and Chromatic's
 * autoAcceptChanges:'main' would have ratified whatever the first run happened to produce.
 * The mobile guarantees are BEHAVIOURAL and live in testkits/vrt/stories/mobile/*.spec.ts.
 *
 * WHY AN EXPLICIT LIST, and not the vrt-critical tag: the desktop harness captures whatever
 * carries the tag, which is how a story ends up in a corpus by accident. A phone-width
 * capture of a component designed for a wide canvas is noise, so the list below is the set of
 * stories that actually mean something at 375 — and adding to it is a deliberate edit.
 *
 * Usage:
 *   pnpm run build-storybook && npx serve storybook-static -l 6006   (or any static server)
 *   node testkits/vrt/storycap.mobile.mjs --baseURL http://127.0.0.1:6006 [--out DIR]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

/** The stories worth looking at on a phone. Explicit, by id. */
const MOBILE_STORY_IDS = [
  'contexts-view-collapse--rail-at-wide-container',
  'contexts-view-collapse--rail-at-narrow-container',
  'contexts-view-collapse--drawer-at-wide-container',
  'contexts-view-collapse--drawer-at-narrow-container',
  'components-navigation-breadcrumbs--responsive-narrow-viewport',
  'components-navigation-pagination--mobile-collapsed',
  'components-navigation-tabs--with-overflow',
];

const VIEWPORT = { width: 375, height: 812 };

const log = (...args) => console.log('[mobile-storycap]', ...args);
const warn = (...args) => console.warn('[mobile-storycap]', ...args);

function parseArgs(argv) {
  const args = { baseURL: process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006', out: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseURL' && argv[i + 1]) args.baseURL = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
  }
  return args;
}

/** The stabiliser, applied per NAVIGATION — a style tag does not survive page.goto. */
async function injectStabilizers(page) {
  await page.addStyleTag({
    content: '*{animation: none !important; transition: none !important;} html,body{scroll-behavior:auto !important;}',
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = args.out ?? path.join(process.cwd(), 'artifacts', 'vrt', 'mobile-375');
  fs.mkdirSync(outDir, { recursive: true });

  const index = await fetch(new URL('/index.json', args.baseURL)).then((response) => {
    if (!response.ok) throw new Error(`Storybook index not reachable at ${args.baseURL} (${response.status})`);
    return response.json();
  });
  const known = new Set(Object.keys(index.entries ?? index.stories ?? {}));

  // FAIL LOUD on a stale list: a renamed story would otherwise silently drop out of the set
  // and the run would still report success with fewer images.
  const missing = MOBILE_STORY_IDS.filter((id) => !known.has(id));
  if (missing.length) {
    throw new Error(
      `These story ids are in the mobile list but not in this Storybook build: ${missing.join(', ')}. ` +
        'Fix the list or the story id — a shrinking capture set must not be silent.',
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true });
  const page = await context.newPage();

  let captured = 0;
  for (const id of MOBILE_STORY_IDS) {
    const url = `${args.baseURL}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await injectStabilizers(page);

    const outPath = path.join(outDir, `${id}.png`);
    const root = page.locator('#storybook-root');
    const box = (await root.count()) ? await root.boundingBox() : null;
    if (box) {
      await page.screenshot({ path: outPath, clip: box });
    } else {
      warn('no #storybook-root for', id, '— full page');
      await page.screenshot({ path: outPath, fullPage: true });
    }
    captured += 1;
    log('✓', path.relative(process.cwd(), outPath));
  }

  await browser.close();
  log(`Captured ${captured} story/stories at ${VIEWPORT.width}x${VIEWPORT.height} in ${path.relative(process.cwd(), outDir)}`);
}

main().catch((error) => {
  console.error('[mobile-storycap] ERROR:', error?.message ?? error);
  process.exitCode = 1;
});
