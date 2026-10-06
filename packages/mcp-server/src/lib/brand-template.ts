import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  BRAND_CHART_PAIRS,
  BRAND_CONTRAST_PAIRS,
  brandFlatKey,
  buildBrandContrastRules,
  evaluateContrastRules,
  normaliseColor,
  type FlatTokenMap,
} from '@oods/a11y-tools';
import { brandDocuments, recipeProblems, type BrandRecipe, type RoleAdjustment } from '@oods/tokens/recipe';
import { ToolError } from '../errors/tool-error.js';
import { tokenPackageRoot } from './token-build.js';
import { knownBrands } from './brand-registry.js';
import { isUserBrand, shippedTokenRoot, userBrandFile, userBrandIds, userBrandsDir } from './user-brands.js';

/**
 * s213-m05 — a brand made from a team's tokens.
 *
 * The token build writes the brand template (`dist/brand-template.json`, packages/tokens/scripts/brand-template.cjs):
 * every slot a brand fills in each theme, what it means, the slots a brand may not change, and the presets. From it
 * this module hands a team plain design-token documents to fill (brand-relative: `surface.canvas`, not
 * `color.brand.<id>.surface.canvas`), checks what the team fills in, and turns a brand that passes into the three files
 * the brands folder holds. Every check a build would make runs here first, so nothing is written that the build or the
 * brand contrast rules would refuse.
 */

export const BRAND_THEMES = ['base', 'dark', 'hc'] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

export interface BrandTemplateCatalogue {
  schemaVersion: number;
  defaultBrand: string;
  brandId: { pattern: string; rule: string };
  themes: Record<BrandTheme, { label: string; slots: Array<{ slot: string; type: string; meaning: string }> }>;
  fixed: Array<{ theme: BrandTheme; slot: string; value: string; reason: string }>;
  systemColours: string[];
  /** The system colours as Chromium resolves them without forced colours, per platform and color-scheme (brand-template.cjs). */
  systemColourValues: SystemColourValues;
  presets: Array<{ id: string; description: string; themes: Partial<Record<BrandTheme, BrandTheme>>; values: Record<string, string> }>;
}

export type SystemColourScheme = 'light' | 'dark';
export type SystemColourPlatform = 'macos' | 'linux';
export type SystemColourValues = { measuredIn: string } & Record<SystemColourPlatform, Record<SystemColourScheme, Record<string, string>>>;
/** Every platform and color-scheme a system-colour pair is graded under. */
const SYSTEM_COLOUR_RESOLUTIONS = (['macos', 'linux'] as const).flatMap(platform => (['light', 'dark'] as const).map(scheme => ({ platform, scheme })));

/** A theme's document: brand-relative groups of DTCG colour tokens. */
export type BrandDocument = Record<string, unknown>;
export type BrandDocuments = Partial<Record<BrandTheme, unknown>>;

export type BrandIssueRule =
  | 'brand-id-missing'
  | 'brand-id-rule'
  | 'brand-id-taken'
  | 'document-missing'
  | 'slot-missing'
  | 'slot-unknown'
  | 'slot-not-token'
  | 'type-not-color'
  | 'value-not-colour'
  | 'colour-transparent'
  | 'system-colour-outside-hc'
  | 'slot-fixed'
  | 'contrast'
  | 'hc-mixed-pair'
  | 'type-mismatch'
  | 'value-not-dimension'
  | 'value-not-font'
  | 'recipe-invalid';

export interface BrandIssue {
  rule: BrandIssueRule;
  theme?: BrandTheme;
  slot?: string;
  message: string;
  /** Contrast issues: the pair, its measured ratio and the floor it missed. */
  pair?: { id: string; foreground: string; background: string };
  ratio?: number;
  threshold?: number;
  /** High contrast, a pair of system colours: where it missed its floor, as "<platform> <color-scheme>". */
  resolutions?: string[];
  /**
   * s224-m01 (#2542 ruling 5): a chart mark that misses its floor, inherited when its value is brand A's for the theme
   * (where a template starts every slot), authored otherwise; absent when brand A's values cannot be read.
   */
  origin?: 'authored' | 'inherited';
}

export interface BrandContrastSummary {
  /** Pairs graded with a ratio. */
  graded: number;
  passed: number;
  failed: number;
  /** Pairs not graded because a colour in them is missing or does not parse (reported as its own issue). */
  ungraded: number;
  /** s222-m01: pairs this theme does not grade, each for a stated reason (@oods/a11y-tools BRAND_CONTRAST_PAIRS). */
  exempt?: number;
  /** High contrast: where its system colours were resolved to grade them (each such pair passes only if it passes in all). */
  systemColoursResolvedIn?: string;
  /**
   * s224-m01 (#2542 ruling 5): the chart marks (@oods/a11y-tools BRAND_CHART_PAIRS), the one-series colour and the six
   * series at 3:1 on the canvas, counted apart from the brand contrast rules above.
   */
  charts?: { graded: number; passed: number; failed: number; ungraded: number };
}

export interface BrandFileReceipt {
  theme: BrandTheme;
  path: string;
  sha256: string;
  bytes: number;
}

export interface BrandValidationReport {
  valid: boolean;
  brand_id: string | null;
  themes: Record<BrandTheme, { label: string; slots: number; provided: number }>;
  issues: BrandIssue[];
  contrast: Record<BrandTheme, BrandContrastSummary>;
  /** The files create would write (computed here), present when the brand id is usable and every value is a colour. */
  files?: BrandFileReceipt[];
}

const BRANDS_DIR = 'src/tokens/brands';
const DTCG_SCHEMA = 'https://design-tokens.org/dtcg/schema.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readBrandTemplate(): BrandTemplateCatalogue {
  const file = path.join(tokenPackageRoot(), 'dist/brand-template.json');
  if (!fs.existsSync(file)) {
    throw new ToolError('OODS-N024', `The brand template is not built (${file}); run the token build.`, { file });
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as BrandTemplateCatalogue;
}

/** Every `$value` leaf as [dotted path, node], skipping `$` metadata keys on groups. */
function leaves(node: unknown, trail: string[] = []): Array<[string, unknown]> {
  if (!isRecord(node)) return trail.length > 0 ? [[trail.join('.'), node]] : [];
  if ('$value' in node) return [[trail.join('.'), node]];
  return Object.entries(node).flatMap(([key, child]) => (key.startsWith('$') ? [] : leaves(child, [...trail, key])));
}

/** The shipped token package's brands folder. */
export function shippedBrandFolder(): string {
  return path.join(shippedTokenRoot(), BRANDS_DIR);
}

/**
 * Where create writes a brand (s213-m06): the team's brands folder when one is set (OODS_BRANDS_DIR; from npm,
 * ~/.oods-foundry/brands), else the shipped token package's brands folder in a source checkout. `prefix` is the path of a
 * brand's folder relative to the folder a receipt names.
 */
export function brandWriteTarget(): { kind: 'user' | 'shipped'; folder: string; prefix: string } {
  const user = userBrandsDir();
  return user ? { kind: 'user', folder: user, prefix: '' } : { kind: 'shipped', folder: shippedBrandFolder(), prefix: `${BRANDS_DIR}/` };
}

/** A brand's source file: a team brand's in its brands folder, a shipped brand's in the token package. */
export function brandSourceFile(brand: string, theme: BrandTheme): string {
  return isUserBrand(brand) ? userBrandFile(brand, theme) : path.join(shippedBrandFolder(), brand, `${theme}.json`);
}

/** A built brand's values by theme and brand-relative slot, read from its source files. */
export function brandValues(brand: string): Record<BrandTheme, Record<string, string>> {
  return Object.fromEntries(BRAND_THEMES.map(theme => {
    const file = brandSourceFile(brand, theme);
    const values: Record<string, string> = {};
    for (const [name, node] of leaves(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      if (isRecord(node) && typeof node.$value === 'string') values[brandRelative(name, brand)] = node.$value;
    }
    return [theme, values];
  })) as Record<BrandTheme, Record<string, string>>;
}

/**
 * A brand file's token name as a brand-relative slot: `color.brand.<id>.surface.canvas` is `surface.canvas`, and
 * (s222-m01, #2502 ruling 3) the brand's radius and font, `radius.brand.<id>.control` and `font.brand.<id>.sans`, are
 * `radius.control` and `font.sans`. Chart slots keep their `viz.` names.
 */
function brandRelative(name: string, brand: string): string {
  if (name.startsWith(`color.brand.${brand}.`)) return name.slice(`color.brand.${brand}.`.length);
  for (const group of ['radius', 'font']) {
    if (name.startsWith(`${group}.brand.${brand}.`)) return `${group}.${name.slice(`${group}.brand.${brand}.`.length)}`;
  }
  return name;
}

function setLeaf(document: BrandDocument, slot: string, leaf: Record<string, unknown>): void {
  const segments = slot.split('.');
  let node = document;
  for (const segment of segments.slice(0, -1)) node = (node[segment] ??= {}) as BrandDocument;
  node[segments.at(-1)!] = leaf;
}

export interface BrandTemplateSource {
  brand?: string;
  preset?: string;
  /** s222-m01 (#2502 ruling 3): a brand recipe; the template is the complete brand it gives, graded. */
  recipe?: BrandRecipe;
}

export interface BrandTemplate {
  from: { brand: string; preset?: string } | { recipe: BrandRecipe };
  slots: Record<BrandTheme, number>;
  documents: Record<BrandTheme, BrandDocument>;
  fixed: BrandTemplateCatalogue['fixed'];
  presets: Array<{ id: string; description: string }>;
  rules: string[];
  /** A recipe's brand: the grading of its documents, as validate reports it. */
  report?: BrandValidationReport;
  /** A recipe's brand: every role a contrast rule moved off its step, light and dark (recipe.mjs). */
  adjustments?: Record<'light' | 'dark', RoleAdjustment[]>;
}

/** What a filled template must satisfy, in the words the report uses. */
function templateRules(catalogue: BrandTemplateCatalogue): string[] {
  return [
    `A brand id is ${catalogue.brandId.rule}, and no existing brand's id in any case.`,
    `Each theme (base = light, dark, hc = high contrast) has every slot of the template and no other: base ${catalogue.themes.base.slots.length}, dark ${catalogue.themes.dark.slots.length}, hc ${catalogue.themes.hc.slots.length}.`,
    'Each colour slot is {"$type": "color", "$value": "<a CSS colour>"}: hex, rgb(), hsl(), oklch(), lab() or a named colour; opaque; not a reference to another token. $description is kept as written.',
    'The base theme also carries the brand\'s radius (radius.control, small, large, card, pill: {"$type": "dimension", "$value": "<0 to 999>px"}) and font (font.sans, font.mono: {"$type": "fontFamily", "$value": "<family list>"}); every theme of a brand shares them.',
    'A recipe (neutralHue, neutralChroma, accentHue, primary "neutral" or "accent", radius, font) gives a complete brand: template with from.recipe returns its documents graded, and validate and create take recipe in place of documents.',
    `System colours (${catalogue.systemColours.join(', ')}) follow the user's high-contrast settings, so only hc may use them.`,
    // s223-m03 (#2528): the 3:1 pairs include the control borders and the focus ring since s222-m01, as BRANDS.md says.
    `The light and dark themes are graded with the brand contrast rules (${BRAND_CONTRAST_PAIRS.length} pairs each: text on its surfaces at 4.5:1; status icons, control borders at rest and hovered, and the focus ring at 3:1).`,
    // s224-m01 (#2542 ruling 5): the chart marks too, so a brand whose charts would not read on its canvas is not created.
    `Every theme's chart marks are graded too (${BRAND_CHART_PAIRS.length} pairs each: the one-series colour and the six series at 3:1 on surface.canvas). A failing one says whether its value is brand A's, which a template starts from; set viz.* for your canvas.`,
    `In hc, a pair of two system colours is graded with the system colours as ${catalogue.systemColourValues.measuredIn}, and passes only if it passes in all four; a pair of two colours is graded like light and dark, and a pair of one of each is refused: the system colour could be any colour.`,
    ...catalogue.fixed.map(entry => `${entry.theme}.${entry.slot} is fixed at ${entry.value}: ${entry.reason}`),
  ];
}

/**
 * The documents a team fills in: every slot with its meaning (as `$description`) and the value it starts from. A
 * brand starts from an existing brand (brand A unless `brand` names another); a preset sets some light-theme slots
 * over the themes of that brand it names.
 */
export function brandTemplate(source: BrandTemplateSource = {}): BrandTemplate {
  const catalogue = readBrandTemplate();
  if (source.recipe !== undefined) {
    if (source.brand !== undefined || source.preset !== undefined) {
      throw new ToolError('OODS-V001', 'from.recipe gives a whole brand, so it takes no from.brand or from.preset.', { field: 'from' });
    }
    const { documents, adjustments } = recipeDocuments(source.recipe);
    return {
      from: { recipe: source.recipe },
      slots: Object.fromEntries(BRAND_THEMES.map(theme => [theme, catalogue.themes[theme].slots.length])) as Record<BrandTheme, number>,
      documents,
      fixed: catalogue.fixed,
      presets: catalogue.presets.map(({ id, description }) => ({ id, description })),
      rules: templateRules(catalogue),
      report: checkBrand({ documents }).report,
      adjustments,
    };
  }
  const brand = source.brand ?? catalogue.defaultBrand;
  if (!knownBrands().includes(brand)) {
    throw new ToolError('OODS-V001', `Unknown brand "${brand}" at from.brand; known brands are ${knownBrands().join(', ')}.`, { brand, knownBrands: knownBrands() });
  }
  const preset = source.preset === undefined ? undefined : catalogue.presets.find(entry => entry.id === source.preset);
  if (source.preset !== undefined && !preset) {
    throw new ToolError('OODS-V001', `Unknown preset "${source.preset}" at from.preset; the presets are ${catalogue.presets.map(entry => entry.id).join(', ')}.`, {
      preset: source.preset, presets: catalogue.presets.map(entry => entry.id),
    });
  }
  const values = brandValues(brand);
  const fixed = new Map(catalogue.fixed.map(entry => [`${entry.theme}.${entry.slot}`, entry]));
  const documents = {} as Record<BrandTheme, BrandDocument>;
  for (const theme of BRAND_THEMES) {
    const basis = preset?.themes[theme];
    const document: BrandDocument = {};
    for (const { slot, meaning, type } of catalogue.themes[theme].slots) {
      const pinned = fixed.get(`${theme}.${slot}`);
      const value = pinned?.value
        ?? (basis && preset && slot in preset.values ? preset.values[slot] : undefined)
        ?? (basis && !slot.startsWith('viz.') ? values[basis][slot] : undefined)
        ?? values[theme][slot];
      setLeaf(document, slot, {
        $type: type ?? 'color',
        $value: value,
        $description: pinned ? `${meaning} Fixed: ${pinned.reason}` : meaning,
      });
    }
    documents[theme] = document;
  }
  return {
    from: { brand, ...(preset ? { preset: preset.id } : {}) },
    slots: Object.fromEntries(BRAND_THEMES.map(theme => [theme, catalogue.themes[theme].slots.length])) as Record<BrandTheme, number>,
    documents,
    fixed: catalogue.fixed,
    presets: catalogue.presets.map(({ id, description }) => ({ id, description })),
    rules: templateRules(catalogue),
  };
}

type Colour = { value: string; system: boolean; hex?: string; description?: string };

/** A value as a colour, or why it is not one. System colours have no fixed value, so they carry no hex. */
function readColour(value: unknown, systemColours: ReadonlySet<string>): Colour | { problem: BrandIssueRule; message: string } {
  if (typeof value !== 'string' || value.trim() === '') return { problem: 'value-not-colour', message: `${JSON.stringify(value)} is not a colour string` };
  const text = value.trim();
  if (/^\{.*\}$/.test(text)) return { problem: 'value-not-colour', message: `${text} is a reference; a brand slot takes a colour value` };
  if (systemColours.has(text)) return { value: text, system: true };
  let hex: string;
  try {
    hex = normaliseColor(text, text);
  } catch {
    return { problem: 'value-not-colour', message: `${text} is not a CSS colour` };
  }
  if (hex.length !== 7) return { problem: 'colour-transparent', message: `${text} is not opaque, so its contrast depends on what is beneath it` };
  return { value: text, system: false, hex };
}

/** A radius slot's value: a length in px, 0 to 999. */
function dimensionProblem(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?px$/.test(value.trim())) return `${JSON.stringify(value)} is not a length in px (for example "6px")`;
  const px = Number.parseFloat(value);
  return px > 999 ? `${value} is more than 999px` : undefined;
}

/** A font slot's value: a family list of names (quoted or not), commas between; no other CSS. */
function fontProblem(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 400) return `${JSON.stringify(value)} is not a font family list`;
  const names = value.split(',').map(name => name.trim());
  const ok = names.every(name => /^'[A-Za-z0-9 \-]+'$/.test(name) || /^"[A-Za-z0-9 \-]+"$/.test(name) || /^-?[A-Za-z][A-Za-z0-9\-]*( [A-Za-z0-9\-]+)*$/.test(name));
  return ok ? undefined : `${value} is not a font family list: names of letters, digits, spaces and hyphens, quoted or not, separated by commas`;
}

type ShapeValue = { value: string; type: string; description?: string };

export interface BrandCheckOptions {
  brandId?: string;
  documents: unknown;
  /** Create: a brand id is required. */
  requireId?: boolean;
  /** brand.apply: the brand being edited in place, which keeps its own id. */
  existing?: string;
}

/** Check a filled template. Nothing is written. */
export function validateBrandDocuments(options: BrandCheckOptions): BrandValidationReport {
  return checkBrand(options).report;
}

/**
 * The check, and the three file texts it hashed when the brand id is usable and every value is a colour: create
 * writes exactly the bytes the report names.
 */
export function checkBrand(options: BrandCheckOptions): { report: BrandValidationReport; texts?: Record<BrandTheme, string> } {
  const catalogue = readBrandTemplate();
  const systemColours = new Set(catalogue.systemColours);
  const issues: BrandIssue[] = [];
  const brandId = options.brandId ?? null;

  if (brandId === null) {
    if (options.requireId) issues.push({ rule: 'brand-id-missing', message: 'A brand id is required to create a brand.' });
  } else if (!new RegExp(catalogue.brandId.pattern).test(brandId)) {
    issues.push({ rule: 'brand-id-rule', message: `"${brandId}" is not a brand id: a brand id is ${catalogue.brandId.rule}.` });
  } else if (brandId !== options.existing) {
    const taken = [...new Set([...knownBrands(), ...folderBrands()])].find(existing => existing.toLowerCase() === brandId.toLowerCase());
    if (taken) {
      issues.push({ rule: 'brand-id-taken', message: taken === brandId
        ? `Brand ${brandId} already exists; create never replaces a brand (change one with brand.apply).`
        : `"${brandId}" differs from the existing brand ${taken} only by case, so their CSS variable names would collide.` });
    }
  }

  const documents = isRecord(options.documents) ? options.documents : {};
  const fixed = new Map(catalogue.fixed.map(entry => [`${entry.theme}.${entry.slot}`, entry]));
  const colours = {} as Record<BrandTheme, Map<string, Colour>>;
  const shapes = {} as Record<BrandTheme, Map<string, ShapeValue>>;
  const themes = {} as BrandValidationReport['themes'];
  for (const theme of BRAND_THEMES) {
    const expected = catalogue.themes[theme].slots.map(entry => entry.slot);
    const expectedSet = new Set(expected);
    const types = new Map(catalogue.themes[theme].slots.map(entry => [entry.slot, entry.type ?? 'color']));
    const found = new Map<string, Colour>();
    const foundShapes = new Map<string, ShapeValue>();
    colours[theme] = found;
    shapes[theme] = foundShapes;
    const document = documents[theme];
    themes[theme] = { label: catalogue.themes[theme].label, slots: expected.length, provided: 0 };
    if (!isRecord(document)) {
      issues.push({ rule: 'document-missing', theme, message: `No ${catalogue.themes[theme].label} document (documents.${theme}).` });
      continue;
    }
    const given = leaves(document);
    themes[theme].provided = given.filter(([slot]) => expectedSet.has(slot)).length;
    for (const [slot, node] of given) {
      if (!expectedSet.has(slot)) {
        issues.push({ rule: 'slot-unknown', theme, slot, message: /^color\.brand\./.test(slot)
          ? `${theme}.${slot} is wrapped in color.brand.<id>; send brand-relative documents (surface.canvas, not color.brand.<id>.surface.canvas).`
          : `${theme}.${slot} is not a slot of the brand template.` });
        continue;
      }
      const type = types.get(slot) ?? 'color';
      if (!isRecord(node)) {
        issues.push({ rule: 'slot-not-token', theme, slot, message: `${theme}.${slot} is not a token: give {"$type": "${type}", "$value": "…"}.` });
        continue;
      }
      if (type !== 'color') {
        // s222-m01: the radius (px) and font (family list) slots.
        if ('$type' in node && node.$type !== type) {
          issues.push({ rule: 'type-mismatch', theme, slot, message: `${theme}.${slot} has $type ${JSON.stringify(node.$type)}; this slot is a ${type}.` });
        }
        const problem = type === 'dimension' ? dimensionProblem(node.$value) : fontProblem(node.$value);
        if (problem) {
          issues.push({ rule: type === 'dimension' ? 'value-not-dimension' : 'value-not-font', theme, slot, message: `${theme}.${slot}: ${problem}.` });
          continue;
        }
        foundShapes.set(slot, { value: String(node.$value).trim(), type, ...(typeof node.$description === 'string' ? { description: node.$description } : {}) });
        continue;
      }
      if ('$type' in node && node.$type !== 'color') {
        issues.push({ rule: 'type-not-color', theme, slot, message: `${theme}.${slot} has $type ${JSON.stringify(node.$type)}; every brand slot is a colour.` });
      }
      const colour = readColour(node.$value, systemColours);
      if ('problem' in colour) {
        issues.push({ rule: colour.problem, theme, slot, message: `${theme}.${slot}: ${colour.message}.` });
        continue;
      }
      if (colour.system && theme !== 'hc') {
        issues.push({ rule: 'system-colour-outside-hc', theme, slot, message: `${theme}.${slot} is the system colour ${colour.value}, which follows the user's high-contrast settings; ${catalogue.themes[theme].label} needs a colour value.` });
        continue;
      }
      const pinned = fixed.get(`${theme}.${slot}`);
      if (pinned && colour.value !== pinned.value) {
        issues.push({ rule: 'slot-fixed', theme, slot, message: `${theme}.${slot} is fixed at ${pinned.value}, not ${colour.value}: ${pinned.reason}` });
      }
      if (typeof node.$description === 'string') colour.description = node.$description;
      found.set(slot, colour);
    }
    for (const slot of expected) {
      if (!given.some(([name]) => name === slot)) issues.push({ rule: 'slot-missing', theme, slot, message: `${theme}.${slot} is missing.` });
    }
  }

  // s224-m01 (#2542 ruling 5): a failing chart mark says whether its value is brand A's for the theme, where a template
  // starts every slot (and where 0.4.1's presets left the charts), so a team knows to set viz.* itself. Read only when one
  // fails; unknown (no origin) when brand A's files cannot be read.
  let defaults: Record<BrandTheme, Record<string, string>> | null | undefined;
  const inherited = (theme: BrandTheme, slot: string, value: string): boolean | undefined => {
    if (defaults === undefined) {
      try { defaults = brandValues(catalogue.defaultBrand); } catch { defaults = null; }
    }
    return defaults ? defaults[theme]?.[slot] === value : undefined;
  };
  const contrast = {} as BrandValidationReport['contrast'];
  for (const theme of BRAND_THEMES) contrast[theme] = gradeTheme(theme, colours[theme], issues, catalogue.systemColourValues, inherited);

  const report: BrandValidationReport = { valid: issues.length === 0, brand_id: brandId, themes, issues, contrast };
  const usableId = brandId !== null && !issues.some(issue => issue.rule === 'brand-id-rule');
  const everyValue = BRAND_THEMES.every(theme => catalogue.themes[theme].slots.every(({ slot }) => colours[theme].has(slot) || shapes[theme].has(slot)));
  if (!usableId || !everyValue) return { report };
  const texts = Object.fromEntries(BRAND_THEMES.map(theme => [theme, brandFileText(brandId, theme, catalogue, colours[theme], shapes[theme])])) as Record<BrandTheme, string>;
  const { prefix } = brandWriteTarget();
  report.files = BRAND_THEMES.map(theme => ({
    theme,
    path: `${prefix}${brandId}/${theme}.json`,
    sha256: createHash('sha256').update(texts[theme]).digest('hex'),
    bytes: Buffer.byteLength(texts[theme]),
  }));
  return { report, texts };
}

/** An rgb()/rgba() system colour as an opaque hex, an alpha one composited over the same resolution's Canvas. */
function resolvedHex(value: string, canvas: string): string {
  const channels = (text: string) => text.match(/[\d.]+/g)!.map(Number);
  const [r, g, b, alpha = 1] = channels(value);
  const [cr, cg, cb] = channels(canvas);
  const mix = (channel: number, under: number) => Math.round(channel * alpha + under * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${mix(r!, cr!)}${mix(g!, cg!)}${mix(b!, cb!)}`;
}

/**
 * The brand contrast rules over one theme's colours; failures become issues. In hc, s221-m02 (#2482 ruling 3): a pair of
 * two system colours is graded as Chromium resolves them without forced colours, which a page's own high-contrast theme
 * gets, on each measured platform under a light and a dark color-scheme; it passes only if it passes in all of them.
 * s224-m01 (#2542 ruling 5): then the chart marks, graded the same way and counted apart (summary.charts). In hc they are
 * CanvasText on Canvas, two system colours, so they are measured as each resolution paints them; a fixed colour on a
 * system canvas, or the reverse, is refused as a text pair is, since its contrast would be the user's settings' to decide.
 */
function gradeTheme(theme: BrandTheme, colours: Map<string, Colour>, issues: BrandIssue[], systemColourValues: SystemColourValues,
  inherited: (theme: BrandTheme, slot: string, value: string) => boolean | undefined): BrandContrastSummary {
  // The rules name brand-scoped flat keys; one placeholder brand id serves any brand, since only the pairs matter.
  const pairs = [...BRAND_CONTRAST_PAIRS, ...BRAND_CHART_PAIRS];
  const rules = buildBrandContrastRules('x', theme === 'dark' ? 'dark' : 'base', pairs);
  const summary: BrandContrastSummary = { graded: 0, passed: 0, failed: 0, ungraded: 0, ...(theme === 'hc' ? { systemColoursResolvedIn: systemColourValues.measuredIn } : {}) };
  const charts = { graded: 0, passed: 0, failed: 0, ungraded: 0 };
  const evaluate = (resolve: (colour: Colour) => string | undefined) => {
    const map: FlatTokenMap = {};
    for (const [slot, colour] of colours) { const hex = resolve(colour); if (hex) map[brandFlatKey('x', slot)] = { value: hex } as FlatTokenMap[string]; }
    return evaluateContrastRules(map, { rules });
  };
  const evaluations = evaluate(colour => colour.hex);
  const resolved = theme !== 'hc' ? [] : SYSTEM_COLOUR_RESOLUTIONS.map(({ platform, scheme }) => {
    const values = systemColourValues[platform][scheme];
    return { label: `${platform === 'macos' ? 'macOS' : 'Linux'} ${scheme}`, evaluations: evaluate(colour => colour.system ? resolvedHex(values[colour.value]!, values.Canvas!) : colour.hex) };
  });
  pairs.forEach((pair, index) => {
    const chart = index >= BRAND_CONTRAST_PAIRS.length;
    const tally = chart ? charts : summary;
    const foreground = colours.get(pair.foreground);
    const background = colours.get(pair.background);
    if (!foreground || !background) { tally.ungraded += 1; return; }
    // s222-m01: a pair exempt in this theme is not graded while a system colour is in it (the platform decides it).
    if (pair.exempt?.theme === theme && (foreground.system || background.system)) { summary.exempt = (summary.exempt ?? 0) + 1; return; }
    // s224-m01: a failing chart mark says where its value came from, and a brand A value says how to fix it.
    const failing = () => {
      const origin = chart ? inherited(theme, pair.foreground, foreground.value) : undefined;
      return {
        from: origin === undefined ? {} : { origin: origin ? 'inherited' as const : 'authored' as const },
        fix: origin ? ` ${pair.foreground} is brand A's ${theme} value, which a template starts from; set it for this canvas.` : '',
      };
    };
    if (foreground.system !== background.system) {
      tally.failed += 1;
      const { from, fix } = failing();
      issues.push({
        rule: 'hc-mixed-pair', theme, slot: pair.foreground, pair: { id: pair.id, foreground: pair.foreground, background: pair.background }, ...from,
        message: `${theme}: ${pair.foreground} (${foreground.value}) on ${pair.background} (${background.value}) mixes a system colour with a fixed colour, so its contrast depends on the user's settings; make both system colours or both colours.${fix}`,
      });
      return;
    }
    tally.graded += 1;
    if (foreground.system) {
      const misses = resolved.map(entry => ({ label: entry.label, evaluation: entry.evaluations[index]! })).filter(entry => !entry.evaluation.passed);
      if (misses.length === 0) { tally.passed += 1; return; }
      tally.failed += 1;
      const worst = misses.reduce((low, entry) => (entry.evaluation.ratio < low.evaluation.ratio ? entry : low));
      const { from, fix } = failing();
      issues.push({
        rule: 'contrast', theme, slot: pair.foreground, pair: { id: pair.id, foreground: pair.foreground, background: pair.background },
        ratio: worst.evaluation.ratio, threshold: worst.evaluation.threshold, resolutions: misses.map(entry => entry.label), ...from,
        message: `${theme}: ${pair.foreground} (${foreground.value}) on ${pair.background} (${background.value}) is ${worst.evaluation.ratio}:1 where Chromium resolves them without forced colours (${misses.map(entry => entry.label).join(', ')}); ${pair.summary.replace(/\.$/, '')} needs ${worst.evaluation.threshold}:1.${fix}`,
      });
      return;
    }
    const evaluation = evaluations[index]!;
    if (evaluation.passed) { tally.passed += 1; return; }
    tally.failed += 1;
    const { from, fix } = failing();
    issues.push({
      rule: 'contrast', theme, slot: pair.foreground, pair: { id: pair.id, foreground: pair.foreground, background: pair.background },
      ratio: evaluation.ratio, threshold: evaluation.threshold, ...from,
      message: `${theme}: ${pair.foreground} (${foreground.value}) on ${pair.background} (${background.value}) is ${evaluation.ratio}:1; ${pair.summary.replace(/\.$/, '')} needs ${evaluation.threshold}:1.${fix}`,
    });
  });
  return { ...summary, charts };
}

/**
 * One brand file as the brands folder holds it: colour slots under color.brand.<id>, the radius and font under
 * radius.brand.<id> and font.brand.<id> (s222-m01), chart slots under viz.
 */
function brandFileText(brandId: string, theme: BrandTheme, catalogue: BrandTemplateCatalogue, colours: Map<string, Colour>, shapes: Map<string, ShapeValue>): string {
  const brand: BrandDocument = {};
  const viz: BrandDocument = {};
  const shape: BrandDocument = {};
  const meanings = new Map(catalogue.themes[theme].slots.map(entry => [entry.slot, entry.meaning]));
  for (const { slot } of catalogue.themes[theme].slots) {
    const value = shapes.get(slot);
    if (value) {
      const [group, ...rest] = slot.split('.');
      setLeaf(shape, [group, 'brand', brandId, ...rest].join('.'), { $type: value.type, $value: value.value, $description: value.description ?? meanings.get(slot) });
      continue;
    }
    const colour = colours.get(slot)!;
    const leaf: Record<string, unknown> = {
      $type: 'color',
      $value: colour.value,
      $description: colour.description ?? meanings.get(slot),
      ...(colour.hex ? { $extensions: { ods: { fallback: colour.hex } } } : {}),
    };
    if (slot.startsWith('viz.')) setLeaf(viz, slot.slice('viz.'.length), leaf);
    else setLeaf(brand, slot, leaf);
  }
  const document = { $schema: DTCG_SCHEMA, color: { brand: { [brandId]: brand } }, ...shape, ...(Object.keys(viz).length > 0 ? { viz } : {}) };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** The brand folders, the shipped package's and the team's, whether or not the build carries them yet. */
function folderBrands(): string[] {
  const folder = shippedBrandFolder();
  const shipped = fs.existsSync(folder) ? fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name) : [];
  return [...shipped, ...userBrandIds()];
}

/** A brand's files turned back into the brand-relative documents a team fills (what brand.apply checks). */
export function brandDocumentsFromFiles(brandId: string, files: Record<BrandTheme, unknown>): Record<BrandTheme, BrandDocument> {
  return Object.fromEntries(BRAND_THEMES.map(theme => {
    const file = files[theme] as Record<string, any>;
    const { brand: _brand, ...otherColour } = (file?.color ?? {}) as Record<string, unknown>;
    const own = (file?.color?.brand?.[brandId] ?? {}) as BrandDocument;
    const others = Object.fromEntries(Object.entries(file?.color?.brand ?? {}).filter(([id]) => id !== brandId));
    // Anything outside color.brand.<id>, radius.brand.<id>, font.brand.<id> and viz stays in the document, so the check
    // reports it instead of dropping it.
    const document: BrandDocument = { ...own };
    for (const group of ['radius', 'font']) {
      const tree = file?.[group];
      if (tree === undefined) continue;
      const { brand: groupBrands, ...rest } = (tree ?? {}) as Record<string, any>;
      if (groupBrands?.[brandId] !== undefined) document[group] = groupBrands[brandId];
      const strays = { ...rest, ...Object.fromEntries(Object.entries(groupBrands ?? {}).filter(([id]) => id !== brandId).map(([id, value]) => [`brand.${id}`, value])) };
      if (Object.keys(strays).length > 0) document[`${group}-other`] = strays;
    }
    if (file?.viz !== undefined) document.viz = file.viz;
    if (Object.keys(others).length > 0 || Object.keys(otherColour).length > 0) {
      document.color = { ...otherColour, ...(Object.keys(others).length > 0 ? { brand: others } : {}) };
    }
    for (const [key, value] of Object.entries(file ?? {})) {
      if (!key.startsWith('$') && !['color', 'viz', 'radius', 'font'].includes(key)) document[key] = value;
    }
    return [theme, document];
  })) as Record<BrandTheme, BrandDocument>;
}

/**
 * s222-m01 (#2502 ruling 3): the brand-relative documents a recipe gives, as a team would fill them, each slot described
 * by its meaning. Colours, radius, font and (s222-m02, ruling 12) chart colours come from the recipe (@oods/tokens/recipe,
 * the function the palette generator writes brands A and B with).
 */
export function recipeDocuments(recipe: unknown): { documents: Record<BrandTheme, BrandDocument>; adjustments: Record<'light' | 'dark', RoleAdjustment[]> } {
  const problems = recipeProblems(recipe);
  if (problems.length > 0) {
    throw new ToolError('OODS-V001', `The recipe cannot make a brand: ${problems.map(([, message]) => message).join('; ')}.`, {
      field: 'recipe', problems: problems.map(([field, message]) => ({ field, message })),
    });
  }
  const catalogue = readBrandTemplate();
  const { documents: files, report } = brandDocuments('x', recipe as BrandRecipe);
  const generated = brandDocumentsFromFiles('x', files as Record<BrandTheme, unknown>);
  const fixed = new Map(catalogue.fixed.map(entry => [`${entry.theme}.${entry.slot}`, entry]));
  const documents = {} as Record<BrandTheme, BrandDocument>;
  for (const theme of BRAND_THEMES) {
    const values = new Map(leaves(generated[theme]).map(([slot, node]) => [slot, isRecord(node) ? node.$value : undefined]));
    const document: BrandDocument = {};
    for (const { slot, meaning, type } of catalogue.themes[theme].slots) {
      const pinned = fixed.get(`${theme}.${slot}`);
      const value = pinned?.value ?? values.get(slot);
      setLeaf(document, slot, { $type: type ?? 'color', $value: value, $description: pinned ? `${meaning} Fixed: ${pinned.reason}` : meaning });
    }
    documents[theme] = document;
  }
  return { documents, adjustments: report.adjustments };
}

/** Validate a recipe: its problems as issues, or its brand checked like any documents. Nothing is written. */
export function checkRecipe(options: Omit<BrandCheckOptions, 'documents'> & { recipe: unknown }): { report: BrandValidationReport; texts?: Record<BrandTheme, string>; documents?: Record<BrandTheme, BrandDocument> } {
  const problems = recipeProblems(options.recipe);
  if (problems.length > 0) {
    const catalogue = readBrandTemplate();
    const empty = { graded: 0, passed: 0, failed: 0, ungraded: 0 };
    return {
      report: {
        valid: false,
        brand_id: options.brandId ?? null,
        themes: Object.fromEntries(BRAND_THEMES.map(theme => [theme, { label: catalogue.themes[theme].label, slots: catalogue.themes[theme].slots.length, provided: 0 }])) as BrandValidationReport['themes'],
        issues: problems.map(([field, message]) => ({ rule: 'recipe-invalid' as const, slot: field, message: `recipe.${field}: ${message}.` })),
        contrast: { base: { ...empty }, dark: { ...empty }, hc: { ...empty } },
      },
    };
  }
  const { documents } = recipeDocuments(options.recipe);
  return { ...checkBrand({ ...options, documents }), documents };
}
