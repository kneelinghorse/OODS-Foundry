#!/usr/bin/env node
/**
 * Aggregate accessibility scan for all Storybook stories.
 *
 * - Loads Storybook's index.json to discover stories
 * - Runs the per-story scanner for each story (manager preview DOM)
 * - Writes a summary of stories with violations to:
 *     artifacts/quality/story-a11y-violations.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getStoryIndex() {
  const indexUrl = `${STORYBOOK_URL}/index.json`;
  const response = await fetch(indexUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load Storybook index.json from ${indexUrl} (status ${response.status})`,
    );
  }
  return response.json();
}

async function main() {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'a11y-scan-story.mjs'))
    .href;
  const { scanStory } = await import(moduleUrl);

  const index = await getStoryIndex();
  const entries = index.entries ?? {};

  const stories = Object.values(entries).filter(
    (entry) => entry.type === 'story',
  );

  console.log(
    `Found ${stories.length} story entries in Storybook index.json (v${index.v}).`,
  );

  const violations = [];

  // Scan stories sequentially to avoid overloading Storybook / Playwright
  for (const entry of stories) {
    const { id, title, name, importPath } = entry;
    console.log(`\n=== Scanning story: ${id} (${title} - ${name}) ===`);

    try {
      const result = await scanStory(id);
      const count = result.summary?.violations ?? 0;

      if (count > 0) {
        violations.push({
          storyId: id,
          title,
          name,
          importPath,
          url: result.url,
          mode: result.mode,
          summary: result.summary,
          violations: result.violations,
        });
        console.log(
          `→ Recorded ${count} violation(s) for ${id} (${title} - ${name}).`,
        );
      } else {
        console.log(`→ No violations for ${id}.`);
      }
    } catch (error) {
      console.error(`Scan failed for ${id}:`, error);
    }
  }

  const outputDir = path.resolve(process.cwd(), 'artifacts', 'quality');
  const outputFile = path.join(outputDir, 'story-a11y-violations.json');

  fs.mkdirSync(outputDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    storybookUrl: STORYBOOK_URL,
    indexVersion: index.v,
    totalStories: stories.length,
    storiesWithViolations: violations.length,
    entries: violations,
  };

  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(
    `\nSaved aggregated violations for ${violations.length} stor${
      violations.length === 1 ? 'y' : 'ies'
    } to ${outputFile}.`,
  );
}

// Run as CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Node 20+ has global fetch; if unavailable, this will throw early.
  // eslint-disable-next-line unicorn/prefer-top-level-await
  main().catch((error) => {
    console.error('❌ Aggregated story scan failed:', error);
    process.exit(1);
  });
}

