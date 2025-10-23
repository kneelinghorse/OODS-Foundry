#!/usr/bin/env node

/**
 * Storybook taxonomy fixer.
 *
 * Scans *.stories.* files and rewrites stray titles to align with the
 * canonical taxonomy. Supports --dry (default) and --apply modes.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const CANONICAL_ROOTS = new Set([
  'Foundations',
  'Components',
  'Contexts',
  'Domains',
  'Patterns',
  'Explorer',
  'Brand'
]);

const COMPONENT_BUCKET_BY_NAME = new Map([
  ['Banner', 'Statusables'],
  ['Badge', 'Statusables'],
  ['Status Chip', 'Statusables'],
  ['Toast', 'Statusables'],
  ['Dialog', 'Overlays'],
  ['Popover', 'Overlays'],
  ['Sheet', 'Overlays'],
  ['Tooltip', 'Overlays'],
  ['Table', 'Data'],
  ['Button', 'Primitives'],
  ['Checkbox', 'Primitives'],
  ['Input', 'Primitives'],
  ['Radio', 'Primitives'],
  ['Select', 'Primitives'],
  ['Tabs', 'Primitives'],
  ['Text Area', 'Primitives'],
  ['Text Field', 'Primitives'],
  ['Toggle', 'Primitives']
]);

const EXACT_TITLE_MAPPINGS = new Map([
  ['Proofs/Contexts/Domain Context Gallery', 'Contexts/Domain Context Gallery'],
  ['High Contrast/Proof Gallery', 'Brand/High Contrast/Proof Gallery'],
  ['Proofs/High Contrast/Proof Gallery', 'Brand/High Contrast/Proof Gallery'],
  ['Proofs/Components/Banner', 'Components/Statusables/Banner'],
  ['Proofs/Components/Badge', 'Components/Statusables/Badge'],
  ['Proofs/Components/Toast', 'Components/Statusables/Toast'],
  ['Proofs/Components/Status Chip', 'Components/Statusables/Status Chip'],
  ['Proofs/Components/Dialog', 'Components/Overlays/Dialog'],
  ['Proofs/Components/Popover', 'Components/Overlays/Popover'],
  ['Proofs/Components/Sheet', 'Components/Overlays/Sheet'],
  ['Proofs/Components/Tooltip', 'Components/Overlays/Tooltip'],
  ['Proofs/Components/Button', 'Components/Primitives/Button'],
  ['Proofs/Components/Checkbox', 'Components/Primitives/Checkbox'],
  ['Proofs/Components/Input', 'Components/Primitives/Input'],
  ['Proofs/Components/Radio', 'Components/Primitives/Radio'],
  ['Proofs/Components/Select', 'Components/Primitives/Select'],
  ['Proofs/Components/Tabs', 'Components/Primitives/Tabs'],
  ['Proofs/Components/Text Area', 'Components/Primitives/Text Area'],
  ['Proofs/Components/Text Field', 'Components/Primitives/Text Field'],
  ['Proofs/Components/Toggle', 'Components/Primitives/Toggle']
]);

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.storybook',
  '.turbo',
  'artifacts',
  'build',
  'chromatic-baselines',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'storybook-static',
  'tmp'
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const files = [];
  await collectStories(repoRoot, files);

  if (files.length === 0) {
    console.log('No story files discovered. Nothing to do.');
    return;
  }

  const results = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const rewrites = computeRewrites(content);
    if (rewrites.length === 0) {
      continue;
    }

    let mutated = content;
    let applied = false;

    for (const rewrite of rewrites.slice().sort((a, b) => b.start - a.start)) {
      mutated =
        mutated.slice(0, rewrite.start) + rewrite.replacement + mutated.slice(rewrite.end);
      applied = true;
    }

    if (!applied || mutated === content) {
      continue;
    }

    results.push({
      file: path.relative(repoRoot, filePath),
      updates: rewrites.map(({ previousTitle, nextTitle, reason }) => ({
        from: previousTitle,
        to: nextTitle,
        reason
      }))
    });

    if (options.apply) {
      await fs.writeFile(filePath, mutated, 'utf8');
    }
  }

  if (results.length === 0) {
    console.log('No taxonomy rewrites required.');
    return;
  }

  console.log(`${options.apply ? 'Applied' : 'Planned'} taxonomy updates:`);
  for (const entry of results) {
    console.log(`- ${entry.file}`);
    for (const update of entry.updates) {
      console.log(`    • ${update.from} → ${update.to} (${update.reason})`);
    }
  }

  if (!options.apply) {
    console.log('\nRun with --apply to persist these changes.');
  }
}

function parseArgs(argv) {
  const options = {
    apply: false,
    help: false
  };

  for (const token of argv) {
    switch (token) {
      case '--apply':
        options.apply = true;
        break;
      case '--dry':
        options.apply = false;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.warn(`Unknown option: ${token}`);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/sb-taxonomy-fix.mjs [--dry|--apply]

Scans Storybook stories and rewrites titles that fall outside the canonical taxonomy.

Options:
  --dry      Preview updates without writing files (default)
  --apply    Persist the rewrites in-place
  --help     Show this help message`);
}

async function collectStories(dir, results) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
    }
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectStories(fullPath, results);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.includes('.stories.')) {
      continue;
    }
    results.push(fullPath);
  }
}

function computeRewrites(source) {
  const rewrites = [];
  const regexp = /title\s*:\s*(['"`])([^'"`]*\/[^'"`]*)\1/g;

  for (const match of source.matchAll(regexp)) {
    if (!match || match.index == null) {
      continue;
    }
    const [full, quote, title] = match;
    const rewrite = rewriteTitle(title);
    if (!rewrite) {
      continue;
    }
    if (rewrite.nextTitle === title) {
      continue;
    }
    const replacement = full.replace(`${quote}${title}${quote}`, `${quote}${rewrite.nextTitle}${quote}`);
    rewrites.push({
      start: match.index,
      end: match.index + full.length,
      replacement,
      previousTitle: title,
      nextTitle: rewrite.nextTitle,
      reason: rewrite.reason
    });
  }

  return rewrites;
}

function rewriteTitle(title) {
  if (EXACT_TITLE_MAPPINGS.has(title)) {
    const nextTitle = EXACT_TITLE_MAPPINGS.get(title);
    return {
      nextTitle,
      reason: 'exact mapping'
    };
  }

  const segments = title.split('/').map((part) => part.trim()).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === 'High Contrast') {
    const next = ['Brand', 'High Contrast', ...segments.slice(1)].join('/');
    return validateNext(title, next, 'fold High Contrast under Brand');
  }

  if (segments[0] === 'Proofs') {
    if (segments.length === 1) {
      return null;
    }
    const [, category, ...rest] = segments;
    if (category === 'High Contrast') {
      const next = ['Brand', 'High Contrast', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs High Contrast');
    }
    if (category === 'Contexts') {
      const next = ['Contexts', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs contexts');
    }
    if (category === 'Domains') {
      const next = ['Domains', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs domains');
    }
    if (category === 'Patterns') {
      const next = ['Patterns', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs patterns');
    }
    if (category === 'Explorer') {
      const next = ['Explorer', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs explorer');
    }
    if (category === 'Components') {
      if (rest.length === 0) {
        return null;
      }
      const [firstRest, ...remaining] = rest;
      if (['Primitives', 'Statusables', 'Data', 'Overlays'].includes(firstRest)) {
        const next = ['Components', firstRest, ...remaining].join('/');
        return validateNext(title, next, 'fold Proofs components bucketed');
      }
      const inferredBucket = COMPONENT_BUCKET_BY_NAME.get(firstRest);
      if (inferredBucket) {
        const next = ['Components', inferredBucket, firstRest, ...remaining].join('/');
        return validateNext(title, next, 'map Proofs component by name');
      }
      const next = ['Components', ...rest].join('/');
      return validateNext(title, next, 'fold Proofs components generic');
    }
  }

  if (segments[0] === 'Components' && segments[1] === 'Proofs') {
    const rest = segments.slice(2);
    if (rest.length === 0) {
      return null;
    }
    const [componentName, ...remaining] = rest;
    const inferredBucket = COMPONENT_BUCKET_BY_NAME.get(componentName);
    if (!inferredBucket) {
      return null;
    }
    const next = ['Components', inferredBucket, componentName, ...remaining].join('/');
    return validateNext(title, next, 'fold Components/Proofs by name');
  }

  return null;
}

function validateNext(previous, next, reason) {
  if (next === previous) {
    return null;
  }
  const root = next.split('/')[0];
  if (!CANONICAL_ROOTS.has(root)) {
    console.warn(`Skipping rewrite for "${previous}" → "${next}" (unknown root "${root}")`);
    return null;
  }
  return { nextTitle: next, reason };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
