#!/usr/bin/env tsx

import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = process.cwd();
const STORIES_ROOT = path.join(ROOT, 'apps', 'explorer', 'src', 'stories');
const CANARY_RELATIVE = path.join('apps', 'explorer', 'src', 'stories', '__canary__', 'BrandBleed.canary.tsx');
const CANARY_ABSOLUTE = path.join(ROOT, CANARY_RELATIVE);
/** s213-m04: every brand in the brand registry (the brands folder), so a new brand's stories are linted too. */
const BRANDS: readonly string[] = createRequire(import.meta.url)('../../packages/tokens/scripts/brand-registry.cjs').readBrandRegistry();

interface Violation {
  file: string;
  reason: string;
}

async function collectStoryFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const nested = await collectStoryFiles(entryPath);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(entryPath);
    }
  }

  return results;
}

function hasBrandAttribute(content: string, brand: string): boolean {
  const pattern = new RegExp(`data-brand\\s*=\\s*["']${brand}["']`, 'i');
  return pattern.test(content);
}

// A brand's names end where its id ends, so brand A's patterns never match a brand whose id starts with A.
function referencesBrandTokens(content: string, brand: string): boolean {
  const legacyCssVarPattern = new RegExp(`--brand${brand}(?![a-z0-9])[\\w-]*`, 'i');
  const generatedCssVarPattern = new RegExp(
    `--oods-(?:color-)?brand-${brand.toLowerCase()}-[\\w-]*`,
    'i',
  );
  const tokenPattern = new RegExp(`color\\.brand\\.${brand}(?![a-z0-9])`, 'i');
  return (
    legacyCssVarPattern.test(content) ||
    generatedCssVarPattern.test(content) ||
    tokenPattern.test(content)
  );
}

async function main(): Promise<void> {
  const storyFiles = await collectStoryFiles(STORIES_ROOT);
  if (storyFiles.length === 0) {
    console.warn('⚠︎ No story files found for brand bleed lint.');
    return;
  }

  let canaryDetected = false;
  const violations: Violation[] = [];

  for (const filePath of storyFiles) {
    const content = await readFile(filePath, 'utf8');
    const relativePath = path.relative(ROOT, filePath);

    // The first brand (registry order) whose data-brand context holds another brand's tokens names the bleed.
    let reason: string | undefined;
    for (const context of BRANDS.filter((brand) => hasBrandAttribute(content, brand))) {
      const other = BRANDS.find((brand) => brand !== context && referencesBrandTokens(content, brand));
      if (other) { reason = `Found Brand ${other} tokens within a Brand ${context} data-brand context.`; break; }
    }

    if (reason) {

      if (filePath === CANARY_ABSOLUTE) {
        canaryDetected = true;
      } else {
        violations.push({ file: relativePath, reason });
      }
    }
  }

  if (!canaryDetected) {
    console.error('✖ Brand bleed canary was not detected. Guardrail is ineffective.');
    process.exitCode = 1;
    return;
  }

  if (violations.length > 0) {
    console.error('✖ Brand bleed violations detected:');
    for (const violation of violations) {
      console.error(`  • ${violation.file}: ${violation.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('✔︎ Brand bleed lint passed (canary triggered, no additional violations).');
}

main().catch((error) => {
  console.error('✖ Brand bleed lint failed with an unexpected error.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
