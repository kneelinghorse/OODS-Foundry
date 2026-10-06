// s222-m02 (#2502 ruling 11): the stylesheets under src/components/ read tokens, not literals.
//
// Every colour, spacing, radius, type, shadow and control-height value in these stylesheets comes
// from a token that packages/tokens/dist/css/tokens.css builds. What stays literal is structure,
// and each structural literal is listed in STRUCTURAL below with its reason. A literal that is
// neither a token nor on the list fails here, and so does a list entry nothing uses any more.
//
// The sibling contract for the shared stylesheet is
// packages/component-styles/test/geometry-contract.s200.spec.ts ("carries no hard-coded chrome
// outside the documented structural list"); this file holds src/components/** to the same rule.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const componentsRoot = path.join(repoRoot, 'src/components');
const tokensCss = fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css/tokens.css'), 'utf8');
const byScope = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'packages/tokens/dist/css-variables-by-scope.json'), 'utf8'),
) as Record<string, Record<string, Record<string, string>>>;

/** Design-token namespaces. Anything else in a var() is a component's own custom property. */
const TOKEN = /^--(?:sys|cmp|ref)-/;
/** Every token tokens.css declares, under the unprefixed name the stylesheets read. */
const BUILT = new Set([...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]!));

/** A token's built value in every brand and theme scope. */
function builtValues(name: string): string[] {
  const key = `--oods-${name.slice(2)}`;
  return Object.values(byScope).flatMap((themes) =>
    Object.values(themes).flatMap((vars) => (vars[key] === undefined ? [] : [vars[key]!])),
  );
}

const normalise = (value: string) => {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const px = trimmed.match(/^(-?[\d.]+)px$/);
  if (px) return `${Number(px[1]) / 16}rem`;
  const rem = trimmed.match(/^(-?[\d.]+)rem$/);
  if (rem) return `${Number(rem[1])}rem`;
  return trimmed;
};

// ---- the scanner ----------------------------------------------------------------------------

interface Declaration {
  file: string;
  line: number;
  property: string;
  value: string;
  /** The preludes of every enclosing block, outermost first. */
  context: string[];
}

interface AtRule {
  file: string;
  line: number;
  prelude: string;
}

function cssFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return cssFiles(full);
      return entry.name.endsWith('.css') ? [full] : [];
    })
    .sort();
}

/** Comments become spaces, so every offset (and so every line number) is kept. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

function parse(file: string, source: string): { declarations: Declaration[]; atRules: AtRule[] } {
  const text = stripComments(source);
  const lineAt = (offset: number) => text.slice(0, offset).split('\n').length;
  const declarations: Declaration[] = [];
  const atRules: AtRule[] = [];
  const stack: string[] = [];
  let start = 0;
  let depth = 0;
  const flush = (end: number) => {
    const raw = text.slice(start, end);
    const offset = start + (raw.length - raw.trimStart().length);
    const body = raw.trim();
    const colon = body.indexOf(':');
    if (colon > 0) {
      declarations.push({
        file,
        line: lineAt(offset),
        property: body.slice(0, colon).trim(),
        value: body.slice(colon + 1).trim().replace(/\s+/g, ' '),
        context: [...stack],
      });
    }
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && char === '{') {
      const raw = text.slice(start, i);
      const prelude = raw.trim().replace(/\s+/g, ' ');
      if (prelude.startsWith('@')) atRules.push({ file, line: lineAt(start + (raw.length - raw.trimStart().length)), prelude });
      stack.push(prelude);
      start = i + 1;
    } else if (depth === 0 && char === ';') {
      flush(i);
      start = i + 1;
    } else if (depth === 0 && char === '}') {
      flush(i);
      stack.pop();
      start = i + 1;
    }
  }
  return { declarations, atRules };
}

interface VarCall {
  name: string;
  fallback: string | null;
}

/**
 * The value with every token var() replaced by TOKEN, and every component custom property replaced
 * by its own fallback (a component's default is a value like any other, so it is scanned too).
 */
function residual(value: string, calls: VarCall[]): string {
  let out = '';
  for (let i = 0; i < value.length; ) {
    if (!value.startsWith('var(', i)) {
      out += value[i++];
      continue;
    }
    let depth = 1;
    let j = i + 4;
    let comma = -1;
    for (; j < value.length && depth; j++) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') depth--;
      else if (value[j] === ',' && depth === 1 && comma === -1) comma = j;
    }
    const name = value.slice(i + 4, comma === -1 ? j - 1 : comma).trim();
    const fallback = comma === -1 ? null : value.slice(comma + 1, j - 1).trim();
    calls.push({ name, fallback });
    if (TOKEN.test(name)) {
      if (fallback !== null) residual(fallback, calls);
      out += ' TOKEN ';
    } else {
      out += fallback === null ? ' LOCAL ' : ` ${residual(fallback, calls)} `;
    }
    i = j;
  }
  return out;
}

// ---- what counts as a literal -----------------------------------------------------------------

const DIMENSION = /(?<![\w.#-])-?\d*\.?\d+(?:px|rem|em|ex|ch|vh|vw|vmin|vmax|svh|dvh|%|pt)(?![\w-])/gi;
const HEX = /#[0-9a-f]{3,8}\b/gi;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const SYSTEM_COLOURS = [
  'AccentColor', 'AccentColorText', 'ActiveText', 'ButtonBorder', 'ButtonFace', 'ButtonText', 'Canvas', 'CanvasText',
  'Field', 'FieldText', 'GrayText', 'Highlight', 'HighlightText', 'LinkText', 'Mark', 'MarkText', 'SelectedItem',
  'SelectedItemText', 'VisitedText',
];
const NAMED_COLOURS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
  'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
  'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
  'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
  'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal',
  'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
];
const WORD = (words: string[]) => new RegExp(`(?<![\\w-])(?:${words.join('|')})(?![\\w-])`, 'gi');
const NAMED = WORD(NAMED_COLOURS);
const SYSTEM = WORD(SYSTEM_COLOURS);
/**
 * transparent and currentColor carry no colour choice of their own, so they are not in either list. System colours are
 * the palette only where the user's own colours apply: inside forced colours or the hc theme.
 */
const FORCED_OR_HC = (context: string[]) =>
  context.some((prelude) => /@media[^{]*forced-colors\s*:\s*active/.test(prelude) || /\[data-theme=['"]?hc['"]?\]/.test(prelude));

/** Type values that must come from a type role. */
const TYPE_LITERAL: Array<[RegExp, RegExp]> = [
  [/(?:^|-)font-weight$/, /(?<![\w-])(?:\d+|bold|bolder|lighter|normal)(?![\w-])/gi],
  [/(?:^|-)line-height$/, /(?<![\w.-])\d*\.?\d+(?![\w.%-])/g],
  [/(?:^|-)font-size$/, /(?<![\w-])(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)(?![\w-])/gi],
  [/(?:^|-)font-family$/, /^(?!\s*(?:TOKEN|LOCAL|inherit)\s*$).+$/g],
];

/**
 * Structural literals: each is structure rather than chrome, matched against the whole
 * declaration ("property: value") or at-rule prelude, and each carries its reason.
 */
const STRUCTURAL: Array<[RegExp, string]> = [
  [/^border(?:-(?:top|right|bottom|left|block-start|block-end|inline-start|inline-end))?: 1px (?:solid|dashed) (?:TOKEN|LOCAL|ButtonText|ButtonBorder|CanvasText)$/, 'hairline borders and dividers'],
  [/^border-radius: 50%$/, 'round markers: the tree bullet and the step marker'],
  [/^(?:width|max-width|height|flex-basis): 100%$/, 'fluid widths: a track, a fill or a row that spans its container'],
  [/^@media \(max-width: (?:480|640)px\)$/, 'legacy phone breakpoints, pinned as literals by tests/tokens/breakpoint-keep-in-step.test.ts'],
  [/^--stepper-stroke-width: 2px$/, "fixed icon geometry: the stepper's marker ring and connector rail are one 2px stroke (ramp 050); the rail's offsets are derived from it and the marker size"],
  [/^border: 2px solid currentColor$/, 'fixed icon geometry: the tree chevron is drawn as a 2px corner stroke (ramp 050)'],
  [/^(?:width|height): 0\.(?:5|75)rem$|^margin-inline-start: 0\.125rem$/, 'fixed icon geometry of the tree: the 8px bullet and checkbox mark, the 12px chevron and its 2px optical nudge (ramps 200, 300 and 050)'],
  [/^min-width: 2rem$/, "the tree's count badges share one minimum width, so the counts line up down the tree"],
  [/^text-underline-offset: 0\.125rem$/, 'typographic geometry: a breadcrumb link underline sits 2px (ramp 050) below its text'],
  [/^max-height: (?:420|280)px$/, 'scroll regions: the tree viewport and the tag suggestion list scroll past these heights'],
  [/^max-width: 200px$/, 'a tab label truncates with an ellipsis past this width'],
  [/^min-width: (?:160|180)px$/, 'layout minimum widths of the tabs and breadcrumb overflow menus'],
  [/^min-width: min\(320px, 100%\)$/, 'layout minimum width of the address role selector, never wider than its container'],
  [/^grid-template-columns: repeat\(auto-fit, minmax\((?:240px|12rem), 1fr\)\)$/, 'layout minimum column widths of the address field grid and the tag-governance summary cards'],
  [/^min-width: 9ch$/, 'the tag input keeps room for a short word before it wraps'],
  [/^width: 40%$|^transform: translateX\((?:-100|250)%\)$/, 'the indeterminate progress bar: its length and its travel, as fractions of the track'],
  [/^line-height: 1$/, 'an icon-only box centres its glyph by its own size, not by leading'],
];

/** The literal findings of one declaration, after the structural list has had its say. */
function literalsIn(declaration: Declaration, used: Set<number>): string[] {
  const calls: VarCall[] = [];
  const rest = residual(declaration.value, calls);
  const text = `${declaration.property}: ${rest.replace(/\s+/g, ' ').trim()}`;
  const where = `${path.relative(repoRoot, declaration.file)}:${declaration.line}`;
  const findings: string[] = [];
  const structural = STRUCTURAL.findIndex(([pattern]) => pattern.test(text));
  const dimensions = rest.match(DIMENSION) ?? [];
  if (dimensions.length) {
    if (structural === -1) findings.push(...dimensions.map((literal) => `${where} dimension ${literal} in "${declaration.property}: ${declaration.value}"`));
    else used.add(structural);
  }
  const colours = [...(rest.match(HEX) ?? []), ...(rest.match(COLOUR_FUNCTION) ?? []), ...(rest.match(NAMED) ?? [])];
  if (!FORCED_OR_HC(declaration.context)) colours.push(...(rest.match(SYSTEM) ?? []));
  findings.push(...colours.map((literal) => `${where} colour ${literal} in "${declaration.property}: ${declaration.value}"`));
  for (const [property, pattern] of TYPE_LITERAL) {
    if (!property.test(declaration.property)) continue;
    const literals = rest.trim().match(pattern) ?? [];
    if (!literals.length) continue;
    if (structural === -1) findings.push(...literals.map((literal) => `${where} type ${literal.trim()} in "${declaration.property}: ${declaration.value}"`));
    else used.add(structural);
  }
  return findings;
}

/** Token var() calls that name a token tokens.css does not build. */
function unbuiltTokens(list: Declaration[]): string[] {
  return list.flatMap((declaration) => {
    const calls: VarCall[] = [];
    residual(declaration.value, calls);
    return calls
      .filter((call) => TOKEN.test(call.name) && !BUILT.has(call.name))
      .map((call) => `${path.relative(repoRoot, declaration.file)}:${declaration.line} ${call.name} is not a built token`);
  });
}

/** Token var() fallbacks that nest another var() or differ from the token's built value in some scope. */
function staleFallbacks(list: Declaration[]): string[] {
  return list.flatMap((declaration) => {
    const calls: VarCall[] = [];
    residual(declaration.value, calls);
    const where = `${path.relative(repoRoot, declaration.file)}:${declaration.line}`;
    return calls.flatMap((call) => {
      if (!TOKEN.test(call.name) || call.fallback === null || !BUILT.has(call.name)) return [];
      if (call.fallback.includes('var(')) return [`${where} ${call.name} nests a fallback: ${call.fallback}`];
      const values = builtValues(call.name);
      if (!values.length) return [`${where} ${call.name} has no scoped value to check its fallback ${call.fallback} against`];
      const differs = [...new Set(values.filter((value) => normalise(value) !== normalise(call.fallback!)))];
      return differs.length ? [`${where} ${call.name} fallback ${call.fallback} differs from its built value ${differs.join(' / ')}`] : [];
    });
  });
}

// ---- the contract -----------------------------------------------------------------------------

const files = cssFiles(componentsRoot);
const parsed = files.map((file) => parse(file, fs.readFileSync(file, 'utf8')));
const declarations = parsed.flatMap((sheet) => sheet.declarations);
const atRules = parsed.flatMap((sheet) => sheet.atRules);

function scan() {
  const used = new Set<number>();
  const literals = declarations.flatMap((declaration) => literalsIn(declaration, used));
  for (const rule of atRules) {
    if (!/^@(?:media|container|supports)/.test(rule.prelude)) continue;
    const dimensions = rule.prelude.match(DIMENSION) ?? [];
    if (!dimensions.length) continue;
    const structural = STRUCTURAL.findIndex(([pattern]) => pattern.test(rule.prelude));
    if (structural === -1) literals.push(...dimensions.map((literal) => `${path.relative(repoRoot, rule.file)}:${rule.line} dimension ${literal} in "${rule.prelude}"`));
    else used.add(structural);
  }
  return { literals, used };
}

describe('s222-m02 src/components stylesheets: on tokens (#2502 ruling 11)', () => {
  it('scans every stylesheet under src/components', () => {
    // The operand is real: the nine component stylesheets, each with declarations to judge.
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const sheet of parsed) expect(sheet.declarations.length, path.relative(repoRoot, sheet.declarations[0]?.file ?? '')).toBeGreaterThan(0);
  });

  it('carries no literal colour, dimension or type value outside the documented structural list', () => {
    const { literals } = scan();
    expect(literals, `${literals.length} literals:\n${literals.join('\n')}`).toEqual([]);
  });

  it('keeps every structural entry in use, so the list cannot hide a literal that has gone', () => {
    const { used } = scan();
    const unused = STRUCTURAL.map((entry, index) => [index, entry] as const).filter(([index]) => !used.has(index)).map(([, [, reason]]) => reason);
    expect(unused).toEqual([]);
  });

  it('reads only tokens that tokens.css builds', () => {
    const missing = unbuiltTokens(declarations);
    expect(missing, `${missing.length} unbuilt tokens:\n${missing.join('\n')}`).toEqual([]);
  });

  it('gives a token var() no fallback, or one equal to its built value in every brand and theme', () => {
    const problems = staleFallbacks(declarations);
    expect(problems, `${problems.length} fallbacks:\n${problems.join('\n')}`).toEqual([]);
  });

  it('DISCRIMINATES: a literal, an unbuilt token and a stale fallback are each caught', () => {
    // Proves the matcher on the shapes it exists to catch, so a green run is not a blind one.
    const probe = parse(path.join(componentsRoot, 'probe.css'), [
      '.probe { padding: 14px; color: #fff; background: rgb(0 0 0); border-color: red; font-weight: 600; outline-color: Highlight; }',
      '.probe { --probe-font-weight: 500; font-family: var(--probe-family, system-ui, sans-serif); }',
      '.probe { gap: var(--sys-stack-xs, 12px); color: var(--sys-text-on_accent); background: var(--sys-surface-raised, Canvas); }',
      '.probe { padding: var(--sys-inset-sm, 0.75rem); border: 1px solid var(--sys-border-subtle); border-radius: 50%; }',
      '@media (forced-colors: active) { .probe { border-color: CanvasText; } }',
    ].join('\n'));
    const found = probe.declarations.flatMap((declaration) => literalsIn(declaration, new Set()));
    expect(found.map((finding) => finding.split(' ').slice(1, 3).join(' '))).toEqual([
      'dimension 14px', 'colour #fff', 'colour rgb(', 'colour red', 'type 600', 'colour Highlight', 'type 500', 'type system-ui,',
    ]);
    expect(unbuiltTokens(probe.declarations).map((problem) => problem.split(' ')[1])).toEqual(['--sys-text-on_accent']);
    // 12px is not the 8px stack-xs, and Canvas is not the raised surface; 0.75rem is inset-sm exactly, so it passes.
    expect(staleFallbacks(probe.declarations).map((problem) => problem.split(' ')[1])).toEqual(['--sys-stack-xs', '--sys-surface-raised']);
  });

  it('DISCRIMINATES against a shipped file: putting a literal back into category-tree.css is rejected', () => {
    // The probe proves the matcher; this proves the matcher reads the stylesheet that ships.
    const file = path.join(componentsRoot, 'classification/category-tree.css');
    const source = fs.readFileSync(file, 'utf8');
    const mutated = source.replace('border-radius: var(--sys-radius-card);', 'border-radius: 0.75rem;');
    expect(mutated).not.toBe(source);
    const findings = parse(file, mutated).declarations.flatMap((declaration) => literalsIn(declaration, new Set()));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('dimension 0.75rem in "border-radius: 0.75rem"');
  });
});
