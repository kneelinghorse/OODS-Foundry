#!/usr/bin/env node
/**
 * Automated accessibility scanner for Storybook stories
 * Uses Playwright + axe-core to detect actual violations in rendered stories
 *
 * Usage:
 *   node scripts/a11y-scan-story.mjs components-navigation-breadcrumbs--long-path-with-overflow
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const axeCore = require('axe-core');

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const SCAN_MODE = process.env.STORYBOOK_SCAN_MODE ?? 'manager'; // 'manager' (preview iframe) or 'iframe'
const storyId = process.argv[2];

export async function runAxeOnTarget(target, storyId, storyUrl) {
  // Wait for story to render
  await target.waitForSelector('#storybook-root', { timeout: 10000 });
  await target.waitForTimeout(500); // Let any animations settle

  // Inject axe-core
  await target.addScriptTag({ content: axeCore.source });

  // Run axe scan using a context similar to Storybook's addon-a11y:
  // include the full document body, excluding Storybook UI chrome.
  const results = await target.evaluate(async () => {
    const context = {
      include: document.body,
      exclude: ['.sb-wrapper', '#storybook-docs', '#storybook-highlights-root'],
    };

    // eslint-disable-next-line no-undef
    return await window.axe.run(context, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      },
    });
  });

  // Format results
  console.log('='.repeat(80));
  console.log(`Story: ${storyId}`);
  console.log(`Source: ${storyUrl}`);
  console.log('='.repeat(80));

  if (results.violations.length === 0) {
    console.log('✅ No violations found!\n');
  } else {
    console.log(`❌ Found ${results.violations.length} violation(s):\n`);

    results.violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.id} (${violation.impact})`);
      console.log(`   ${violation.description}`);
      console.log(`   Help: ${violation.helpUrl}`);
      console.log(`   Affected elements: ${violation.nodes.length}`);

      violation.nodes.forEach((node, nodeIndex) => {
        console.log(`\n   Element ${nodeIndex + 1}:`);
        console.log(`     Target: ${node.target.join(' ')}`);
        console.log(
          `     HTML: ${node.html.substring(0, 100)}${
            node.html.length > 100 ? '...' : ''
          }`,
        );
        console.log(
          `     Message: ${
            node.failureSummary || node.any[0]?.message || 'See help URL'
          }`,
        );

        // Show contrast info if available
        if (node.any[0]?.data) {
          const data = node.any[0].data;
          if (data.contrastRatio) {
            console.log(
              `     Contrast: ${data.contrastRatio.toFixed(
                2,
              )}:1 (expected ${data.expectedContrastRatio}:1)`,
            );
            console.log(`     Foreground: ${data.fgColor}`);
            console.log(`     Background: ${data.bgColor}`);
          }
        }
      });
      console.log('');
    });
  }

  console.log('='.repeat(80));
  console.log(
    `Total: ${results.violations.length} violations, ${results.passes.length} passes`,
  );
  console.log('='.repeat(80) + '\n');

  // Return structured data
  return {
    storyId,
    url: storyUrl,
    mode: SCAN_MODE,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        message: n.failureSummary || n.any[0]?.message,
        data: n.any[0]?.data,
      })),
    })),
    summary: {
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    },
  };
}

export async function scanStory(storyId) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Prefer scanning via the Storybook manager (same environment as the a11y panel)
    // by targeting the preview iframe. Fallback to direct iframe.html if needed.
    const managerUrl = `${STORYBOOK_URL}/?path=/story/${storyId}`;
    const iframeUrl = `${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`;

    let target = null;
    let effectiveUrl = iframeUrl;

    if (SCAN_MODE !== 'iframe') {
      console.log(`\n🔍 Scanning via manager preview: ${managerUrl}\n`);
      await page.goto(managerUrl, { waitUntil: 'networkidle' });

      // Wait for the preview iframe to load the story
      let frame = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        frame = page
          .frames()
          .find(
            (f) =>
              f.url().includes('iframe.html') && f.url().includes(`id=${storyId}`),
          );
        if (frame) {
          break;
        }
        await page.waitForTimeout(500);
      }

      if (frame) {
        target = frame;
        effectiveUrl = managerUrl;
      } else {
        console.warn(
          '[a11y-scan] Preview iframe not found for manager URL, falling back to direct iframe.html',
        );
      }
    }

    if (!target) {
      const storyUrl = iframeUrl;
      console.log(`\n🔍 Scanning via iframe: ${storyUrl}\n`);
      await page.goto(storyUrl, { waitUntil: 'networkidle' });
      target = page;
      effectiveUrl = storyUrl;
    }

    return await runAxeOnTarget(target, storyId, effectiveUrl);
  } finally {
    await browser.close();
  }
}

// Run scan when invoked directly as a CLI script
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!storyId) {
    console.error('Usage: node scripts/a11y-scan-story.mjs <story-id>');
    console.error(
      'Example: node scripts/a11y-scan-story.mjs components-navigation-breadcrumbs--long-path-with-overflow',
    );
    process.exit(1);
  }
  // eslint-disable-next-line unicorn/prefer-top-level-await
  scanStory(storyId)
    .then((results) => {
      // Write results to file
      const fs = require('fs');
      const path = require('path');
      const outputDir = 'artifacts/quality';
      const outputFile = path.join(outputDir, 'last-scan-result.json');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`📄 Results saved to: ${outputFile}\n`);

      process.exit(results.summary?.violations > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Scan failed:', error);
      process.exit(1);
    });
}
