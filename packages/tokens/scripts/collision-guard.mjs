#!/usr/bin/env node
/**
 * s167 m01 — the token collision guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before s167 there was no collision guard in this repo. `build.mjs --check --verbose`
 * printed "Token collisions detected (949)" and exited 0 — that line is Style
 * Dictionary's own logger, not a gate. The only local check,
 * `build.mjs collectValidationIssues()`, looks for duplicate token NAMES on
 * `dictionary.allTokens`, which is the list AFTER Style Dictionary has already
 * deep-merged and deduped at load. It can never fire on a source collision, which is
 * why brand A shipped the forced-colors keyword `Highlight` as its default colour on
 * all five platforms for as long as it did.
 *
 * WHAT IT CHECKS
 * --------------
 * A PRE-LOAD pass: for each brand x theme scope it reads that scope's resolved file
 * list — the same list `build.mjs` hands to Style Dictionary as `source` — and flags
 * any token PATH declared in more than one file with a DIFFERENT `$value`. Whichever
 * file happens to sort last would silently win such a merge.
 *
 * WHAT IT DELIBERATELY EXEMPTS
 * ----------------------------
 * The declared overlay chain `brands/<X>/base.json` -> `brands/<X>/<theme>.json`.
 * That layering IS the scoping mechanism: brand A's dark theme is *supposed* to
 * restate all 41 of brand A's base slots with different values. A guard that red-flags
 * "any intra-scope duplicate" could never go green, because the prescribed structure
 * produces duplicates by design. The exemption is narrow — every declaration in the
 * group must live under ONE brand's directory. The separate s191 exception allows
 * only the 26 canonical viz.scale color names and viz.mark.single from src/viz-scales.json into
 * the brand base/dark/hc chain (all three scale families added in s197). s222-m02: brand bases
 * carry their own recipe's chart colours and may differ, so the scope's own brand must win
 * (isVizThemeOverlay). Other mixed shared/brand or cross-brand declarations are reported.
 *
 * Duplicates whose values are IDENTICAL are not reported: they cannot change the
 * resolved output regardless of which one wins.
 *
 * USAGE
 * -----
 *   node scripts/collision-guard.mjs             # audit packages/tokens
 *   node scripts/collision-guard.mjs --root DIR  # audit a src/ tree elsewhere
 *
 * Exits non-zero when any non-exempt collision is found.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const { oodsScoping } = require('../style-dictionary.config.cjs');

/**
 * One source pattern expanded to the files it names, relative to `root`, in the forms the
 * scoping config uses: literal segments, `*` within one segment (not matching a leading
 * dot) and `**` for any depth of folders.
 *
 * s213-m07: this was `fs.globSync`, which Node has only from 22. Since s213-m06 the npm
 * runtime ships this file and runs it to build a team's brands, on the Node floor the
 * install guide promises (20.11.1), where `create` failed with this guard's own error.
 * One walker on every Node version keeps the file list the same everywhere; a test holds
 * it equal to `fs.globSync` for every scope's patterns. No glob package: @oods/tokens has
 * none and adding one would move the lockfile.
 */
export function expandPattern(pattern, root) {
  const segments = pattern.split('/');
  const matches = [];
  const entries = (directory) => {
    try {
      return fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  const segmentMatcher = (segment) => {
    if (!segment.includes('*')) return (name) => name === segment;
    const source = segment.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
    const expression = new RegExp(`^${source}$`);
    return (name) => !name.startsWith('.') && expression.test(name);
  };
  const walk = (directory, index) => {
    const segment = segments[index];
    if (segment === '**') {
      walk(directory, index + 1);
      for (const entry of entries(directory)) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) walk(path.join(directory, entry.name), index);
      }
      return;
    }
    const accepts = segmentMatcher(segment);
    const last = index === segments.length - 1;
    for (const entry of entries(directory)) {
      if (!accepts(entry.name)) continue;
      const next = path.join(directory, entry.name);
      if (last) {
        if (entry.isFile()) matches.push(path.relative(root, next));
      } else if (entry.isDirectory()) {
        walk(next, index + 1);
      }
    }
  };
  walk(root, 0);
  return [...new Set(matches)];
}

/**
 * Expand one scope's source patterns into an ordered, de-duplicated file list.
 *
 * `build.mjs` feeds the RESULT of this function to Style Dictionary as its `source`,
 * rather than the patterns themselves. That is deliberate: it makes the list the
 * guard audits and the list Style Dictionary loads the same list by construction, so
 * the two can never drift apart on glob semantics.
 *
 * Order is significant (later files win a merge) and is preserved pattern-by-pattern
 * in the order `SHARED_SOURCE` pins; matches within a single pattern are sorted so
 * the build is deterministic across filesystems.
 */
export function resolveScopeFiles(scope, root = PACKAGE_ROOT) {
  const files = [];
  const seen = new Set();
  for (const pattern of oodsScoping.sourceForScope(scope)) {
    for (const match of expandPattern(pattern, root).sort()) {
      const normalized = match.split(path.sep).join('/');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        files.push(normalized);
      }
    }
  }
  return files;
}

/** Every `$value`-bearing leaf in a DTCG document, as [dotted.path, value] pairs. */
export function collectLeaves(node, trail = []) {
  const out = [];
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    if ('$value' in node) out.push([trail.join('.'), node.$value]);
    for (const [key, value] of Object.entries(node)) {
      if (!key.startsWith('$')) out.push(...collectLeaves(value, [...trail, key]));
    }
  }
  return out;
}

const BRAND_DIR = /^src\/tokens\/brands\/([^/]+)\//;

/** The brand a source file belongs to, or null for a global/shared file. */
function brandOf(file) {
  const match = BRAND_DIR.exec(file);
  return match ? match[1] : null;
}

/**
 * True when every declaration in a collision group lives under a single brand's
 * directory — i.e. it is the declared `base.json -> <theme>.json` overlay chain.
 */
function isDeclaredOverlayChain(declarations) {
  const brands = declarations.map((d) => brandOf(d.file));
  return brands.every((b) => b !== null) && new Set(brands).size === 1;
}

/**
 * The 26 canonical scale colors and viz.mark.single may overlay shared -> brand bases -> one theme. Every brand base
 * loads in every scope for global alias resolution. Until s222 their chart overrides had to be IDENTICAL, otherwise
 * merge order would silently choose a brand. s222-m02 (#2502 ruling 12): each brand base carries its own recipe's light
 * chart colours, so bases may differ, and the scope's own brand must be the one that wins (sourceForScope loads its base
 * last of the bases, then its theme file); isVizThemeOverlay holds that. Invented slots, mixed-theme chains, another
 * brand's theme file, and a chain where the scope's brand declares a value that another brand's base overrides, fail.
 */
export function isVizColorTokenPath(tokenPath) {
  return tokenPath === 'viz.mark.single' || /^viz\.scale\.(?:categorical\.0[1-6]|sequential\.0[1-9]|diverging\.(?:neg-0[1-5]|pos-0[1-5]|neutral))$/.test(tokenPath);
}

/**
 * `scopeBrand` is the brand of the scope the file list belongs to; without it (a bare file list) the theme file names it.
 * A scope whose brand declares no chart value for the path (a brand made before 0.4.0) emits none, so its charts keep the
 * :root value, the default brand's; the other bases' disagreement is then inert in that scope and allowed.
 */
function isVizThemeOverlay(tokenPath, declarations, scopeBrand) {
  // s213-m04: every brand's base loads in every scope, so a scope holds the shared value, at most one base per brand
  // and at most one theme file.
  if (!isVizColorTokenPath(tokenPath)
    || declarations[0]?.file !== 'src/viz-scales.json'
    || declarations.length < 2 || declarations.length > oodsScoping.BRANDS.length + 2) return false;
  const overlays = declarations.slice(1).map(({ file, value }) => {
    const match = /^src\/tokens\/brands\/([^/]+)\/(base|dark|hc)\.json$/.exec(file);
    return match && oodsScoping.BRANDS.includes(match[1]) ? { brand: match[1], theme: match[2], value, file } : null;
  });
  if (overlays.some(item => !item)) return false;
  if (new Set(overlays.map(item => item.file)).size !== overlays.length) return false;
  const bases = overlays.filter(item => item.theme === 'base');
  const themes = overlays.filter(item => item.theme !== 'base');
  if (themes.length > 1) return false;
  const [theme] = themes;
  if (theme && overlays.at(-1) !== theme) return false;
  const brand = scopeBrand ?? theme?.brand;
  // A theme file is its own scope's, last, and so wins over every base.
  if (theme) return theme.brand === brand;
  if (bases.every(item => JSON.stringify(item.value) === JSON.stringify(bases[0].value))) return true;
  if (!brand) return false;
  const own = bases.find(item => item.brand === brand);
  return !own || bases.at(-1) === own;
}

/** Non-exempt collisions within a single ordered file list; `scope` ({ brand, theme }) is the cell it belongs to. */
export function findCollisions(files, root = PACKAGE_ROOT, scope = undefined) {
  const byPath = new Map();
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    for (const [tokenPath, value] of collectLeaves(doc)) {
      if (!byPath.has(tokenPath)) byPath.set(tokenPath, []);
      byPath.get(tokenPath).push({ file, value });
    }
  }

  const violations = [];
  for (const [tokenPath, declarations] of byPath) {
    if (declarations.length < 2) continue;
    const distinct = new Set(declarations.map((d) => JSON.stringify(d.value)));
    if (distinct.size < 2) continue; // identical values cannot change the output
    if (isDeclaredOverlayChain(declarations) || isVizThemeOverlay(tokenPath, declarations, scope?.brand)) continue;
    violations.push({ tokenPath, declarations });
  }
  return violations;
}

/**
 * Audit all six brand x theme scopes. A collision in the shared layer surfaces in
 * every scope, so violations are reported once, keyed by token path, with the scopes
 * they affect listed.
 */
export function auditAllScopes(root = PACKAGE_ROOT) {
  const merged = new Map();
  const scopesChecked = [];

  for (const scope of oodsScoping.BRAND_SCOPES) {
    const label = `${scope.brand}/${scope.theme}`;
    const files = resolveScopeFiles(scope, root);
    scopesChecked.push({ scope: label, fileCount: files.length });

    for (const violation of findCollisions(files, root, scope)) {
      const existing = merged.get(violation.tokenPath);
      if (existing) existing.scopes.push(label);
      else merged.set(violation.tokenPath, { ...violation, scopes: [label] });
    }
  }

  return { violations: [...merged.values()], scopesChecked };
}

function report(root) {
  const { violations, scopesChecked } = auditAllScopes(root);

  for (const { scope, fileCount } of scopesChecked) {
    console.log(`   scope ${scope.padEnd(7)} ${fileCount} source files`);
  }

  if (violations.length === 0) {
    console.log(`✔︎ token collision guard: no non-exempt collisions across ${scopesChecked.length} scopes`);
    return 0;
  }

  console.error(`✖ token collision guard: ${violations.length} colliding token path(s)`);
  console.error('  A token path declared in more than one file with differing values is');
  console.error('  resolved by merge order, not by intent. Delete the duplicate, or move it');
  console.error('  into the brand overlay chain if it is genuinely brand-scoped.\n');
  for (const { tokenPath, declarations, scopes } of violations) {
    console.error(`  ${tokenPath}   [scopes: ${scopes.join(', ')}]`);
    for (const { file, value } of declarations) {
      console.error(`      ${file.padEnd(44)} = ${JSON.stringify(value)}`);
    }
  }
  return 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? path.resolve(process.argv[rootFlag + 1]) : PACKAGE_ROOT;
  process.exitCode = report(root);
}
