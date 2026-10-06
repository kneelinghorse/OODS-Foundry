'use strict';
/**
 * s213-m05 — the brand template: every slot a brand fills, what each one means, the slots a brand may not change, and
 * the presets a brand can start from. build-entry.mjs writes it to `dist/brand-template.json`, which ships in the
 * package and the runtime; brand.intake reads it to hand a team the template and to check what the team fills in.
 *
 * The slots are the default brand's (brand A's files define the set every brand has). A slot's meaning is the
 * description of the system token that paints it (`sys.<slot>`, else the first `sys.*` token whose value is
 * `{theme.<slot>}`, which each brand scope binds to the brand's value), so the template says what the design system
 * already says. The few slots no system token describes, and the chart scales, take theirs from the tables below.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PACKAGE_ROOT, BRANDS_DIR, BRAND_FILES, BRAND_ID, BRAND_ID_RULE, DEFAULT_BRAND } = require('./brand-registry.cjs');

const PRESETS_DIR = 'src/presets';
const THEME_LABELS = Object.freeze({ base: 'light', dark: 'dark', hc: 'high contrast' });

/**
 * CSS Color 4 system colours. Under forced colours the user's settings supply them; outside forced colours (a page's own
 * high-contrast theme) the browser does, so brand.intake grades high-contrast pairs with the values below.
 */
const SYSTEM_COLOURS = Object.freeze([
  'AccentColor', 'AccentColorText', 'ActiveText', 'ButtonBorder', 'ButtonFace', 'ButtonText', 'Canvas', 'CanvasText',
  'Field', 'FieldText', 'GrayText', 'Highlight', 'HighlightText', 'LinkText', 'Mark', 'MarkText', 'SelectedItem',
  'SelectedItemText', 'VisitedText',
]);

/**
 * s221-m02 (#2482 ruling 3): the system colours as Chromium resolves them with no forced colours, under a light and a
 * dark color-scheme, measured on 2026-09-29 in Chromium 141.0.7390.37 (Playwright 1.56.1) on the build's macOS machine
 * and in the pinned Linux image (mcr.microsoft.com/playwright@sha256:f1e7e010…). Highlight, HighlightText and
 * SelectedItem differ by platform (on macOS they follow the system's highlight colour), so a pair is graded under all
 * four; Windows was not measured. Receipt: artifacts/product-reality/sprint-221/m02/system-colours.json.
 */
const SYSTEM_COLOUR_VALUES = Object.freeze({
  measuredIn: 'Chromium 141.0.7390.37 without forced colours (macOS and Linux, light and dark color-scheme), 2026-09-29',
  macos: Object.freeze({
    light: Object.freeze({
      Canvas: 'rgb(255, 255, 255)', CanvasText: 'rgb(0, 0, 0)', LinkText: 'rgb(0, 0, 238)',
      VisitedText: 'rgb(85, 26, 139)', ActiveText: 'rgb(255, 0, 0)', ButtonFace: 'rgb(239, 239, 239)',
      ButtonText: 'rgb(0, 0, 0)', ButtonBorder: 'rgb(0, 0, 0)', Field: 'rgb(255, 255, 255)',
      FieldText: 'rgb(0, 0, 0)', Highlight: 'rgba(128, 188, 254, 0.6)', HighlightText: 'rgb(0, 0, 0)',
      SelectedItem: 'rgb(179, 215, 255)', SelectedItemText: 'rgb(0, 0, 0)', Mark: 'rgb(255, 255, 0)',
      MarkText: 'rgb(0, 0, 0)', GrayText: 'rgb(128, 128, 128)', AccentColor: 'rgb(0, 0, 0)',
      AccentColorText: 'rgb(0, 0, 0)',
    }),
    dark: Object.freeze({
      Canvas: 'rgb(18, 18, 18)', CanvasText: 'rgb(255, 255, 255)', LinkText: 'rgb(158, 158, 255)',
      VisitedText: 'rgb(208, 173, 240)', ActiveText: 'rgb(255, 0, 0)', ButtonFace: 'rgb(107, 107, 107)',
      ButtonText: 'rgb(255, 255, 255)', ButtonBorder: 'rgb(255, 255, 255)', Field: 'rgb(59, 59, 59)',
      FieldText: 'rgb(255, 255, 255)', Highlight: 'rgba(179, 215, 255, 0.8)', HighlightText: 'rgb(0, 0, 0)',
      SelectedItem: 'rgb(153, 200, 255)', SelectedItemText: 'rgb(59, 59, 59)', Mark: 'rgb(255, 255, 0)',
      MarkText: 'rgb(0, 0, 0)', GrayText: 'rgb(128, 128, 128)', AccentColor: 'rgb(255, 255, 255)',
      AccentColorText: 'rgb(255, 255, 255)',
    }),
  }),
  linux: Object.freeze({
    light: Object.freeze({
      Canvas: 'rgb(255, 255, 255)', CanvasText: 'rgb(0, 0, 0)', LinkText: 'rgb(0, 0, 238)',
      VisitedText: 'rgb(85, 26, 139)', ActiveText: 'rgb(255, 0, 0)', ButtonFace: 'rgb(239, 239, 239)',
      ButtonText: 'rgb(0, 0, 0)', ButtonBorder: 'rgb(0, 0, 0)', Field: 'rgb(255, 255, 255)',
      FieldText: 'rgb(0, 0, 0)', Highlight: 'rgba(0, 65, 198, 0.8)', HighlightText: 'rgb(255, 255, 255)',
      SelectedItem: 'rgb(25, 103, 210)', SelectedItemText: 'rgb(255, 255, 255)', Mark: 'rgb(255, 255, 0)',
      MarkText: 'rgb(0, 0, 0)', GrayText: 'rgb(128, 128, 128)', AccentColor: 'rgb(0, 0, 0)',
      AccentColorText: 'rgb(0, 0, 0)',
    }),
    dark: Object.freeze({
      Canvas: 'rgb(18, 18, 18)', CanvasText: 'rgb(255, 255, 255)', LinkText: 'rgb(158, 158, 255)',
      VisitedText: 'rgb(208, 173, 240)', ActiveText: 'rgb(255, 0, 0)', ButtonFace: 'rgb(107, 107, 107)',
      ButtonText: 'rgb(255, 255, 255)', ButtonBorder: 'rgb(255, 255, 255)', Field: 'rgb(59, 59, 59)',
      FieldText: 'rgb(255, 255, 255)', Highlight: 'rgba(0, 65, 198, 0.8)', HighlightText: 'rgb(255, 255, 255)',
      SelectedItem: 'rgb(153, 200, 255)', SelectedItemText: 'rgb(59, 59, 59)', Mark: 'rgb(255, 255, 0)',
      MarkText: 'rgb(0, 0, 0)', GrayText: 'rgb(128, 128, 128)', AccentColor: 'rgb(255, 255, 255)',
      AccentColorText: 'rgb(255, 255, 255)',
    }),
  }),
});

/** Brand slots no system token describes. */
const SLOT_MEANINGS = Object.freeze({
  'text.onInteractive': 'Text and icons on the primary interactive surface (buttons and selected controls).',
  'accent.background': 'Background of an accent panel.',
  'accent.border': 'Border of an accent panel.',
  'accent.text': 'Text on an accent panel.',
});

/** Chart slots, by family. */
const CHART_MEANINGS = Object.freeze([
  [/^viz\.mark\.single$/, () => 'Colour of a chart that draws a single series.'],
  [/^viz\.scale\.categorical\.0(\d)$/, n => `Series colour ${n} of 6, for categories that have no order.`],
  [/^viz\.scale\.sequential\.0(\d)$/, n => `Step ${n} of 9 of the ordered scale (01 is the low end).`],
  [/^viz\.scale\.diverging\.neg-0(\d)$/, n => `Step ${n} of 5 below the midpoint of the diverging scale.`],
  [/^viz\.scale\.diverging\.pos-0(\d)$/, n => `Step ${n} of 5 above the midpoint of the diverging scale.`],
  [/^viz\.scale\.diverging\.neutral$/, () => 'Midpoint of the diverging scale.'],
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every `$value` leaf as [dotted path, node]. */
function leaves(node, trail = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  if ('$value' in node) return [[trail.join('.'), node]];
  return Object.entries(node).flatMap(([key, child]) => key.startsWith('$') ? [] : leaves(child, [...trail, key]));
}

/**
 * A brand file's leaves with brand-relative slot names: `color.brand.<id>.surface.canvas` becomes `surface.canvas`, and
 * (s222-m01) the brand's radius and font, `radius.brand.<id>.control` and `font.brand.<id>.sans`, become `radius.control`
 * and `font.sans`.
 */
function brandSlots(document, id) {
  const relative = (name) => {
    if (name.startsWith(`color.brand.${id}.`)) return name.slice(`color.brand.${id}.`.length);
    for (const group of ['radius', 'font']) if (name.startsWith(`${group}.brand.${id}.`)) return `${group}.${name.slice(`${group}.brand.${id}.`.length)}`;
    return name;
  };
  return leaves(document).map(([name, node]) => [relative(name), node]);
}

/** `theme.<slot>` → the system tokens that read it, from every token source but the brands and their aliases. */
function systemReaders(root) {
  const readers = new Map();
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['brands', 'aliases'].includes(entry.name)) visit(file);
      } else if (entry.name.endsWith('.json')) {
        for (const [name, node] of leaves(readJson(file))) {
          const target = typeof node.$value === 'string' ? /^\{theme\.(.+)\}$/.exec(node.$value)?.[1] : undefined;
          if (target && name.startsWith('sys.')) readers.set(target, [...(readers.get(target) ?? []), [name, node.$description]]);
        }
      }
    }
  };
  visit(path.join(root, 'src/tokens'));
  return readers;
}

function meaningOf(slot, readers) {
  for (const [pattern, text] of CHART_MEANINGS) {
    const match = pattern.exec(slot);
    if (match) return text(match[1]);
  }
  if (SLOT_MEANINGS[slot]) return SLOT_MEANINGS[slot];
  // Brand slots are camelCase (text.onDestructive); the theme slots the system tokens read are kebab-case.
  const themeSlot = slot.split('.').map(segment => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('.');
  const mapped = readers.get(slot) ?? readers.get(themeSlot) ?? [];
  const own = mapped.find(([name]) => name === `sys.${slot}` || name === `sys.${themeSlot}`) ?? mapped[0];
  if (!own?.[1]) throw new Error(`brand template: no meaning for slot ${slot}; add it to SLOT_MEANINGS in scripts/brand-template.cjs`);
  return own[1];
}

/**
 * The presets, each checked against the slots: a preset may set only light-theme brand slots that exist and are not
 * fixed, and says which of the default brand's themes each theme of a brand made from it starts from.
 */
function readPresets(root, slotNames, fixed) {
  const directory = path.join(root, PRESETS_DIR);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    const id = name.slice(0, -'.json'.length);
    const document = readJson(path.join(directory, name));
    const themes = document.$extensions?.ods?.preset?.themes;
    const problems = [];
    if (!themes || typeof themes !== 'object' || Object.keys(themes).length === 0) problems.push('$extensions.ods.preset.themes is missing');
    for (const [theme, basis] of Object.entries(themes ?? {})) {
      if (!BRAND_FILES.includes(theme) || !BRAND_FILES.includes(basis)) problems.push(`themes.${theme}: "${basis}" is not a brand theme (${BRAND_FILES.join(', ')})`);
    }
    const values = {};
    for (const [slot, node] of leaves(document)) {
      if (!slotNames.has(slot)) problems.push(`${slot} is not a brand slot`);
      else if (fixed.has(slot)) problems.push(`${slot} is fixed`);
      else values[slot] = node.$value;
    }
    if (problems.length > 0) throw new Error(`brand template: preset ${PRESETS_DIR}/${name}:\n  - ${problems.join('\n  - ')}`);
    return { id, description: document.$description ?? '', themes, values };
  });
}

/** The template catalogue build-entry.mjs writes to dist/brand-template.json. */
function buildBrandTemplate(root = PACKAGE_ROOT) {
  const readers = systemReaders(root);
  const themes = {};
  // s222-m02 (#2502 ruling 12): no slot is fixed. Until then a light-theme chart colour had to be the same in every brand,
  // because every brand's base loads in every scope; now each scope loads its own base last, so a brand sets its own
  // light chart colours as it does its dark and high-contrast ones (style-dictionary.config.cjs sourceForScope).
  const fixed = [];
  for (const theme of BRAND_FILES) {
    const slots = brandSlots(readJson(path.join(root, BRANDS_DIR, DEFAULT_BRAND, `${theme}.json`)), DEFAULT_BRAND);
    themes[theme] = {
      label: THEME_LABELS[theme],
      slots: slots.map(([slot, node]) => ({ slot, type: node.$type, meaning: meaningOf(slot, readers) })),
    };
  }
  const baseSlots = new Set(themes.base.slots.map(entry => entry.slot));
  return {
    schemaVersion: 1,
    defaultBrand: DEFAULT_BRAND,
    brandId: { pattern: BRAND_ID.source, rule: BRAND_ID_RULE },
    themes,
    fixed,
    systemColours: SYSTEM_COLOURS,
    systemColourValues: SYSTEM_COLOUR_VALUES,
    presets: readPresets(root, baseSlots, new Set(fixed.map(entry => entry.slot))),
  };
}

module.exports = { PRESETS_DIR, SYSTEM_COLOURS, SYSTEM_COLOUR_VALUES, buildBrandTemplate };
