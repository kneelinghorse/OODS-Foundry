'use strict';
/**
 * s213-m04 — the brand registry. A brand is its folder: `src/tokens/brands/<id>/{base,dark,hc}.json`.
 *
 * Every build-time list of brands is read from here: the Style Dictionary scopes and shared layer
 * (style-dictionary.config.cjs), the scoped CSS variables and the brand list build-entry.mjs writes,
 * the collision guard, and the repository's governance, lint and grading scripts. The server and the
 * preview read the list the build wrote (`dist/brands.json`) and check it against this folder.
 *
 * The alias file a brand used to need (`aliases/brand-<id>.json`, twenty `brand.<id>.*` names pointing at
 * `color.brand.<id>.*`) is generated from ALIAS_TEMPLATE, so adding a brand is adding its three files.
 */
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BRANDS_DIR = 'src/tokens/brands';
/**
 * Where the generated alias files go: the folder the hand-written ones lived in, so every token keeps its recorded
 * source path and A and B build byte-identical. Gitignored, and not published (package.json `files` is dist).
 */
const ALIASES_DIR = 'src/tokens/aliases';
const BRAND_FILES = Object.freeze(['base', 'dark', 'hc']);
/** Brand A's base doubles as the bare `:root` and the non-CSS platforms (memo SS3 D2); it must exist. */
const DEFAULT_BRAND = 'A';
/**
 * Capitals then digits (`A`, `ACME`, `A1`), or a letter then lower-case letters and digits (`Acme`, `acme2`); at most
 * 32 characters. The id is a CSS attribute value (`[data-brand='<id>']`), a token path segment (`color.brand.<id>`)
 * and part of every brand CSS variable name. Style Dictionary kebab-cases that name, and readers of the variables
 * (dashboards, contrast rules) lower-case the id, so the id must be one kebab-casing leaves whole: `AcmeCorp` would
 * become `acme-corp`. For the same reason no two ids may differ only by case.
 */
const BRAND_ID = /^(?=.{1,32}$)(?:[A-Z]+[0-9]*|[A-Za-z][a-z0-9]*)$/;
const BRAND_ID_RULE = 'capitals then digits (A, ACME, A1), or a letter then lower-case letters and digits (Acme, acme2), at most 32 characters';

/**
 * The alias names every brand exposes: [alias path under `brand.<id>`, target under `color.brand.<id>`, what it is].
 * Captured from the hand-written brand-A.json and brand-B.json, which were identical but for the id.
 */
const ALIAS_TEMPLATE = Object.freeze([
  ['surface.canvas', 'surface.canvas', 'canvas surface'],
  ['surface.raised', 'surface.raised', 'raised surface'],
  ['surface.subtle', 'surface.subtle', 'subtle surface'],
  ['surface.interactivePrimary', 'surface.interactive.primary.default', 'primary interactive background'],
  ['text.primary', 'text.primary', 'primary text'],
  ['text.secondary', 'text.secondary', 'secondary text'],
  ['text.muted', 'text.muted', 'muted text'],
  ['text.onInteractive', 'text.onInteractive', 'interactive foreground'],
  ['border.subtle', 'border.subtle', 'subtle border'],
  ['border.strong', 'border.strong', 'strong border'],
  ...['info', 'success', 'warning', 'critical', 'neutral'].flatMap(status => [
    [`status.${status}.surface`, `status.${status}.surface`, `${status} surface`],
    [`status.${status}.text`, `status.${status}.text`, `${status} text`],
  ]),
]);

/**
 * The brands in the folder, sorted. Throws, naming every problem, when a folder is not a usable brand: an id
 * outside BRAND_ID, a missing file, a file that declares another brand's tokens, two ids that differ only by case,
 * or no brand A. Nothing is skipped silently.
 */
function readBrandRegistry(root = PACKAGE_ROOT) {
  const directory = path.join(root, BRANDS_DIR);
  const names = fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const problems = [];
  const brands = [];
  const byFoldedId = new Map();
  for (const id of names) {
    const where = `${BRANDS_DIR}/${id}`;
    if (!BRAND_ID.test(id)) {
      problems.push(`${where}: a brand id is ${BRAND_ID_RULE}`);
      continue;
    }
    const missing = BRAND_FILES.filter(file => !fs.existsSync(path.join(directory, id, `${file}.json`)));
    if (missing.length > 0) {
      problems.push(`${where}: missing ${missing.map(file => `${file}.json`).join(', ')}`);
      continue;
    }
    for (const file of BRAND_FILES) {
      let declared;
      try {
        declared = Object.keys(JSON.parse(fs.readFileSync(path.join(directory, id, `${file}.json`), 'utf8'))?.color?.brand ?? {});
      } catch (error) {
        problems.push(`${where}/${file}.json: not JSON (${error.message})`);
        continue;
      }
      if (declared.length !== 1 || declared[0] !== id) {
        problems.push(`${where}/${file}.json: declares color.brand.${declared.join(', color.brand.') || '<nothing>'}; a brand's files declare only color.brand.${id}`);
      }
    }
    const folded = id.toLowerCase();
    if (byFoldedId.has(folded)) {
      problems.push(`${where}: differs from ${BRANDS_DIR}/${byFoldedId.get(folded)} only by case, so their CSS variable names would collide`);
      continue;
    }
    byFoldedId.set(folded, id);
    brands.push(id);
  }
  if (problems.length === 0 && !brands.includes(DEFAULT_BRAND)) {
    problems.push(`${BRANDS_DIR}/${DEFAULT_BRAND}: missing; brand ${DEFAULT_BRAND} is the default scope`);
  }
  if (problems.length > 0) {
    throw new Error(`Brand registry (${directory}):\n  - ${problems.join('\n  - ')}`);
  }
  return Object.freeze(brands);
}

/** The alias document for one brand, byte for byte what the hand-written files held. */
function brandAliasDocument(id) {
  const brand = { $description: `Semantic aliases for Brand ${id} tokens shared across build pipelines.` };
  for (const [alias, target, meaning] of ALIAS_TEMPLATE) {
    const segments = alias.split('.');
    let node = brand;
    for (const segment of segments.slice(0, -1)) node = node[segment] ??= {};
    node[segments.at(-1)] = {
      $type: 'color',
      $value: `{color.brand.${id}.${target}}`,
      $description: `Alias for Brand ${id} ${meaning}.`,
    };
  }
  return { $schema: 'https://design-tokens.org/dtcg/schema.json', brand: { [id]: brand } };
}

/**
 * Write each brand's alias file under ALIASES_DIR and remove a `brand-*.json` left from a brand that is gone.
 * Idempotent: a file is rewritten only when its bytes would change, so loading the config twice never touches the
 * disk twice.
 */
function writeBrandAliases(brands, root = PACKAGE_ROOT) {
  const directory = path.join(root, ALIASES_DIR);
  fs.mkdirSync(directory, { recursive: true });
  const wanted = new Map(brands.map(id => [`brand-${id}.json`, `${JSON.stringify(brandAliasDocument(id), null, 2)}\n`]));
  for (const name of fs.readdirSync(directory)) {
    if (/^brand-.+\.json$/.test(name) && !wanted.has(name)) fs.rmSync(path.join(directory, name), { force: true });
  }
  for (const [name, text] of wanted) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
  }
  return directory;
}

module.exports = {
  PACKAGE_ROOT,
  BRANDS_DIR,
  ALIASES_DIR,
  BRAND_FILES,
  BRAND_ID,
  BRAND_ID_RULE,
  DEFAULT_BRAND,
  ALIAS_TEMPLATE,
  readBrandRegistry,
  brandAliasDocument,
  writeBrandAliases,
};
