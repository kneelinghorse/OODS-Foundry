import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssVariablesByScope } from '@oods/tokens';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const tokenRoot = path.join(repoRoot, 'packages/tokens/src/tokens');
const json = (file: string) => JSON.parse(fs.readFileSync(path.join(tokenRoot, file), 'utf8'));
const css = fs.readFileSync(path.join(packageRoot, 'src/components.css'), 'utf8');
const portedCss = fs.readFileSync(path.join(packageRoot, 'src/components-ported.css'), 'utf8');
// s222-m02 (#2502 ruling 11): the Switch and Dialog sheet components.css imports is held to the same contract.
const overlayCss = fs.readFileSync(path.join(packageRoot, 'src/components-overlay.css'), 'utf8');
// s223-m02 (#2527 ruling 11): and the Combobox sheet.
const comboboxCss = fs.readFileSync(path.join(packageRoot, 'src/components-combobox.css'), 'utf8');
// s223-m02 (#2527 ruling 10): and the SegmentedControl sheet.
const segmentedCss = fs.readFileSync(path.join(packageRoot, 'src/components-segmented-control.css'), 'utf8');
const appCss = fs.readFileSync(path.join(repoRoot, 'packages/mcp-server/src/codegen/workflow-emitter.ts'), 'utf8').match(/const APP_CSS = `([\s\S]*?)`;/)![1]!;

type Leaf = { $type: string; $value: unknown; $description?: string };
function leaves(node: unknown, trail: string[] = []): Array<[string, Leaf]> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  const record = node as Record<string, unknown>;
  if ('$value' in record) return [[trail.join('.'), record as Leaf]];
  return Object.entries(record).filter(([key]) => !key.startsWith('$')).flatMap(([key, value]) => leaves(value, [...trail, key]));
}
const reference = (value: unknown) => typeof value === 'string' ? value.match(/^\{([\w.-]+)\}$/)?.[1] : undefined;
const GEOMETRY_TYPES = new Set(['dimension', 'shadow']);
// s222-m01 (#2502 ruling 9): 700 (28px, the small control), 900 and 1100 (the dense and default table rows) and 1600 (64px).
const RAMP = { '050': '0.125rem', '100': '0.25rem', '150': '0.375rem', '200': '0.5rem', '250': '0.625rem', '300': '0.75rem', '400': '1rem', '500': '1.25rem', '600': '1.5rem', '700': '1.75rem', '800': '2rem', '900': '2.25rem', '1000': '2.5rem', '1100': '2.75rem', '1200': '3rem', '1600': '4rem' };

// Tokens in a scope, with the --oods- prefix folded away for the four namespaces the CSS reads.
const scopeTokens = (brand: 'A' | 'B', theme: 'light' | 'dark' | 'hc') => Object.fromEntries(
  Object.entries((cssVariablesByScope as Record<string, Record<string, Record<string, string>>>)[brand]![theme]!)
    .map(([name, value]) => [name.replace(/^--oods-(?=(?:ref|theme|sys|cmp)-)/, '--'), value]),
);

/** Outer var() calls with their raw fallback text. */
function varCalls(source: string): Array<{ name: string; fallback: string | null; line: number }> {
  const calls = [];
  for (let i = 0; i < source.length; i++) {
    if (!source.startsWith('var(', i)) continue;
    const match = /^var\(\s*(--[\w-]+)\s*/.exec(source.slice(i))!;
    let end = i + 4, depth = 1;
    for (; end < source.length && depth; end++) { if (source[end] === '(') depth++; else if (source[end] === ')') depth--; }
    const tail = source.slice(i + match[0].length, end - 1).trim();
    calls.push({ name: match[1]!, fallback: tail.startsWith(',') ? tail.slice(1).trim() : null, line: source.slice(0, i).split('\n').length });
    i = end - 1;
  }
  return calls;
}
const GEOMETRY_NAME = /(?:spacing|space-|inset|stack|inline|gap|padding|radius|height|width|size|font|weight|line-height|indicator|offset|blur|spread)/;
const normalizeLength = (value: string) => {
  const trimmed = value.trim();
  const px = trimmed.match(/^(-?[\d.]+)px$/); if (px) return `${Number(px[1]) / 16}rem`;
  const rem = trimmed.match(/^(-?[\d.]+)rem$/); if (rem) return `${Number(rem[1])}rem`;
  const percent = trimmed.match(/^(-?[\d.]+)%$/); if (percent) return `${Number(percent[1]) / 100}`;
  const number = trimmed.match(/^(-?[\d.]+)$/); if (number) return `${Number(number[1])}`;
  return trimmed;
};

describe('s200-m02 geometry contract: one scale, consumed', () => {
  const sys = Object.fromEntries(leaves(json('base/system/component-roles.json')));
  const sysAll = Object.fromEntries(fs.readdirSync(path.join(tokenRoot, 'base/system')).filter(file => file.endsWith('.json')).flatMap(file => leaves(json(`base/system/${file}`))));
  const cmp = Object.fromEntries(leaves(json('component/roles.json')));

  it('publishes the reference ramp beside the space scale, on the 4px unit', () => {
    const ramp = Object.fromEntries(leaves(json('base/reference/space.scale.json')).filter(([name]) => name.startsWith('ref.space.ramp.')).map(([name, leaf]) => [name.slice('ref.space.ramp.'.length), leaf.$value]));
    expect(ramp).toEqual(RAMP);
    expect(leaves(json('base/reference/space.scale.json')).find(([name]) => name === 'ref.space.scale.sm')![1].$value).toBe('8px');
  });

  it('resolves every sys geometric role to a reference token or a named ramp entry, never a literal', () => {
    const geometric = Object.entries(sys).filter(([, leaf]) => GEOMETRY_TYPES.has(leaf.$type));
    expect(geometric.length).toBeGreaterThanOrEqual(40);
    for (const [name, leaf] of geometric) {
      const target = reference(leaf.$value);
      expect(target, `${name} = ${JSON.stringify(leaf.$value)}`).toBeDefined();
      // s222-m01 (#2502 rulings 3 and 9): radius comes from the brand, through the theme layer every brand scope re-binds.
      expect(target, name).toMatch(/^(?:ref\.space\.ramp\.\d+|ref\.border\.(?:radius|width)\.[\w-]+|ref\.space\.[\w.]+|shadow\.elevation\.(?:card|overlay)|sys\.(?:space|text)\.[\w.-]+|ref\.typography\.[\w.-]+|theme\.radius\.[\w-]+)$/);
      if (target!.startsWith('ref.space.ramp.')) expect(RAMP).toHaveProperty(target!.slice('ref.space.ramp.'.length));
    }
  });

  it('resolves every cmp geometric role to a sys role', () => {
    const geometric = Object.entries(cmp).filter(([, leaf]) => GEOMETRY_TYPES.has(leaf.$type));
    expect(geometric.length).toBeGreaterThanOrEqual(40);
    for (const [name, leaf] of geometric) {
      const target = reference(leaf.$value);
      expect(target, `${name} = ${JSON.stringify(leaf.$value)}`).toMatch(/^sys\./);
      expect(sysAll[target!], `${name} -> ${target}`).toBeDefined();
    }
  });

  it('defines stack-lg, stack-xl and the focus offset, and the elevation scale has consumers', () => {
    expect(reference(sys['sys.stack-lg']!.$value)).toBe('ref.space.ramp.600');
    expect(reference(sys['sys.stack-xl']!.$value)).toBe('ref.space.ramp.800');
    expect(reference(cmp['cmp.spacing-stack-lg']!.$value)).toBe('sys.stack-lg');
    expect(reference(cmp['cmp.spacing-stack-xl']!.$value)).toBe('sys.stack-xl');
    const focus = Object.fromEntries(leaves(json('base/system/focus.json')));
    expect(reference(focus['sys.focus.offset']!.$value)).toBe('ref.border.width.bold');
    expect(reference(cmp['cmp.focus-offset']!.$value)).toBe('sys.focus.offset');
    expect(reference(sys['sys.shadow-panel']!.$value)).toBe('shadow.elevation.card');
    expect(reference(sys['sys.shadow-overlay']!.$value)).toBe('shadow.elevation.overlay');
    expect(reference(cmp['cmp.card-shadow']!.$value)).toBe('sys.shadow-panel');
    expect(reference(cmp['cmp.shadow-overlay']!.$value)).toBe('sys.shadow-overlay');
    // The built parts are consumed by the shared stylesheet in both themes and by the generated shell.
    for (const part of ['offset-x', 'offset-y', 'blur', 'spread', 'color']) {
      expect(css).toContain(`var(--cmp-card-shadow-${part}, `);
      expect(css).toContain(`var(--cmp-shadow-overlay-${part}, `);
      expect(css).toContain(`--cmp-card-shadow-${part}: var(--theme-dark-shadow-elevation-card-${part});`);
      expect(css).toContain(`--cmp-shadow-overlay-${part}: var(--theme-dark-shadow-elevation-overlay-${part});`);
      expect(appCss).toContain(`var(--cmp-card-shadow-${part})`);
    }
    const light = scopeTokens('A', 'light');
    expect(light['--cmp-spacing-stack-lg']).toBe('1.5rem');
    expect(light['--cmp-spacing-stack-xl']).toBe('2rem');
    expect(light['--cmp-focus-offset']).toBe('2px');
    // s222-m01 (#2502 rulings 4, 9 and 10): brand A's radius is 6 (cards 12); a raised card is a soft 8px drop and an
    // overlay a 16px one under its 1px border.
    expect(light['--cmp-card-radius']).toBe('12px');
    expect(light['--cmp-button-radius']).toBe('6px');
    expect(light['--cmp-card-shadow-blur']).toBe('8px');
    expect(light['--cmp-shadow-overlay-blur']).toBe('16px');
    expect(Object.keys(light).filter(name => /^--oods-shadow-elevation-/.test(name))).toHaveLength(10);
  });

  // s222-m01 (#2502 ruling 8): the type scale is 12/14/16/18/24/30 plus display 48/64/80; a chart title keeps heading-lg's
  // 24px, so chart type sizes do not move.
  it('pins the type scale, with chart titles still at heading-lg 24px', () => {
    const typography = Object.fromEntries(leaves(json('base/typography.json')));
    expect(Object.fromEntries(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].map(size => [size, typography[`ref.typography.sizes.${size}`]!.$value]))).toEqual({ xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '24px', xxl: '30px' });
    expect(typography['text.scale.heading-lg.fontSize']?.$value ?? (typography['text.scale.heading-lg'] as Leaf | undefined)?.$value).toBeDefined();
    const light = scopeTokens('A', 'light');
    expect(light['--sys-text-scale-heading-lg-font-size']).toBe('24px');
    expect(light['--sys-text-scale-heading-xl-font-size']).toBe('30px');
    expect(light['--sys-text-scale-caption-font-size']).toBe('12px');
    expect(light['--sys-text-scale-label-md-font-size']).toBe('14px');
    expect(light['--sys-text-size-md']).toBe('16px');
  });

  it('paints focus through one rule per stylesheet with the token width, colour and offset', () => {
    const focusRules = (source: string) => [...source.matchAll(/([^{}]+):focus-visible\s*\{([^{}]*)\}/g)].filter(([, , body]) => /outline/.test(body));
    const shared = focusRules(css);
    expect(shared).toHaveLength(1);
    expect(shared[0]![2]).toContain('outline: var(--cmp-focus-width, 2px) solid var(--cmp-focus-outer, Highlight);');
    expect(shared[0]![2]).toContain('outline-offset: var(--cmp-focus-offset, 2px);');
    for (const selector of ['.oods-button', "[data-oods-component='Button']", '.oods-field-control', '.oods-tab', '[data-oods-component] input', '[data-oods-component] select', '[data-oods-component] textarea', '[data-oods-component] button', "[data-oods-component='Checkbox']", "[data-oods-component] [role='menuitem']"]) {
      expect(shared[0]![1], selector).toContain(selector);
    }
    // The alias-era duplicate paints no focus of its own; its families are covered by the shared rule.
    expect(focusRules(portedCss)).toHaveLength(0);
    expect(focusRules(overlayCss)).toHaveLength(0);
    expect(focusRules(comboboxCss)).toHaveLength(0);
    expect(focusRules(segmentedCss)).toHaveLength(0);
    expect(css).not.toMatch(/outline-offset:\s*\d/);
    expect(appCss).toContain('.workflow-app :focus-visible { outline: var(--cmp-focus-width) solid var(--cmp-focus-outer); outline-offset: var(--cmp-focus-offset); }');
  });

  it('gives every geometry variable one fallback equal to its token value', () => {
    const light = scopeTokens('A', 'light');
    const problems: string[] = [];
    for (const [file, source] of [['components.css', css], ['components-ported.css', portedCss], ['components-overlay.css', overlayCss], ['components-combobox.css', comboboxCss], ['components-segmented-control.css', segmentedCss]] as const) {
      for (const call of varCalls(source)) {
        if (!/^--(?:cmp|sys|ref)-/.test(call.name) || !GEOMETRY_NAME.test(call.name)) continue;
        if (call.fallback === null) continue;
        if (call.fallback.includes('var(')) { problems.push(`${file}:${call.line} ${call.name} nests a fallback: ${call.fallback}`); continue; }
        const token = light[call.name];
        if (token === undefined) { problems.push(`${file}:${call.line} ${call.name} is not a built token`); continue; }
        if (normalizeLength(call.fallback) !== normalizeLength(token)) problems.push(`${file}:${call.line} ${call.name} fallback ${call.fallback} differs from token ${token}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('carries no hard-coded chrome outside the documented structural list', () => {
    // Literals that are structure, not chrome: hairline borders, rails, fixed icon geometry, layout minimums, breakpoints.
    const documented: Array<[RegExp, string]> = [
      [/border(?:-block-end|-inline-start)?: 1px (?:solid|dashed)/, 'hairline borders and rails'],
      [/inline-size: 1\.25rem;|block-size: 1\.25rem;/, 'colour swatch chip: fixed icon geometry'],
      [/inline-size: 0\.75rem;|block-size: 0\.75rem;/, 'badge marker: fixed icon geometry'],
      [/border-radius: 50%;/, 'round marker'],
      [/inline-size: min\(100%, var\(--oods-viz-width, 640px\)\)|min-block-size: var\(--oods-viz-height, 360px\)/, 'empty preview frame dimensions from the component props'],
      [/inline-size: 100%|max-inline-size: 100%|width: 100%|flex-basis: auto; width: 100%/, 'fluid widths'],
      [/minmax\(min\(100%, (?:14rem|240px)\), 1fr\)|flex: 1 1 (?:180|140)px|min-width: min\(180px, 100%\)/, 'layout minimum widths'],
      [/@media \(max-width: (?:40rem|600px)\)/, 'phone breakpoints'],
      [/caption\[data-visually-hidden='true'\] \{ position: absolute; inline-size: 1px; block-size: 1px; margin: -1px;/, 'the visually hidden caption: a 1px box that keeps the accessible name (Sprint 222 m02, #2502 ruling 11)'],
      [/--oods-dialog-max-inline-size: (?:25|32|40)rem;/, "a dialog's largest width from its size prop: sm 400px, md 512px, lg 640px (Sprint 222 m02, #2502 ruling 11)"],
      [/inline-size: min\(100%, var\(--oods-dialog-max-inline-size\)\);|inline-size: min\(100% - 2 \* var\(--sys-inset-md\), var\(--oods-dialog-max-inline-size\)\);|max-block-size: calc\(100% - 2 \* var\(--sys-inset-md\)\);/, 'a dialog fills its column up to its size, and a modal one keeps the inset from the viewport edge (Sprint 222 m02)'],
      [/^\s*block-size: 100%;$/, "a segmented control's radio fills its segment, so the shared focus ring is drawn on the segment (Sprint 223 m02, #2527 ruling 10)"],
      // s224-m01 (#2542 ruling 2): the Tabs "More" menu opens under its trigger the same way.
      [/^\s*inset-block-start: 100%;$/, "a combobox's popup opens right under its control (Sprint 223 m02, #2527 ruling 11), and the Tabs \"More\" menu under its trigger (Sprint 224 m01, #2542 ruling 2)"],
      [/box-shadow: inset 0 0 0 1px CanvasText;/,"a borderless badge's high-contrast outline, drawn inside its 20px pill (Sprint 222 m02, #2502 ruling 11)"],
      [/background: color-mix\(in oklab, currentColor 12%, transparent\)/, "the banner dismiss's hover tints the banner's own text colour, whatever its tone (Sprint 222 m02, #2502 ruling 11)"],
      [/@media \(min-width: 48rem\)/, "the width from which a record's read-only rows take two columns (Sprint 221 m02, #2482 ruling 7)"],
      [/@container \(max-width: 600px\)/, "a placed chart's narrow-render breakpoint, measured on the figure (Sprint 202 m01)"],
      [/@container \(min-width: 900px\)/, "a placed chart's wide-render breakpoint, measured on the figure (Sprint 213 m01)"],
      [/^:where\(\[data-viz-svg-wide\]\) > svg \{ max-inline-size: calc\(1130px \* 1\.25\); \}$/, "the wide render grows to 1.25 times its 1130px width and no further (Sprint 213 m01, #2347)"],
      [/grid-template-columns: repeat\(var\(--oods-grid-columns, auto-fit\), minmax\(min\(100%, var\(--oods-grid-min-column, 16rem\)\), 1fr\)\)/, 'grid column minimum from the component prop'],
      [/grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, max\(var\(--oods-grid-min-column, 16rem\), \(100% - \(var\(--oods-grid-columns\) - 1\) \* var\(--oods-layout-gap, var\(--cmp-spacing-stack-default, 1rem\)\)\) \/ var\(--oods-grid-columns\)\)\), 1fr\)\)/, 'a numeric column count as a maximum: its share of the container, never below the column minimum (Sprint 206)'],
    ];
    const strip = (line: string) => { let out = '', i = 0; while (i < line.length) { if (line.startsWith('var(', i)) { let depth = 1, j = i + 4; while (j < line.length && depth) { if (line[j] === '(') depth++; else if (line[j] === ')') depth--; j++; } out += 'VAR'; i = j; } else out += line[i++]; } return out; };
    const undocumented: string[] = [];
    const used = new Set<number>();
    for (const [file, source] of [['components.css', css], ['components-ported.css', portedCss], ['components-overlay.css', overlayCss], ['components-combobox.css', comboboxCss], ['components-segmented-control.css', segmentedCss]] as const) {
      source.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
        if (!/(?<![\w.-])\d*\.?\d+(?:px|rem|%)(?![\w-])/.test(strip(line))) return;
        const match = documented.findIndex(([pattern]) => pattern.test(line));
        if (match === -1) undocumented.push(`${file}:${index + 1} ${trimmed.slice(0, 120)}`); else used.add(match);
      });
    }
    expect(undocumented).toEqual([]);
    expect(documented.map((_, index) => index).filter(index => !used.has(index)).map(index => documented[index]![1])).toEqual([]);
  });

  it('puts the generated shell on the token font stack, type scale, spacing, radius and shadow', () => {
    expect(appCss).not.toMatch(/system-ui/);
    // Structure the shell keeps as literals: hairline borders, the page width, a layout minimum, the phone breakpoint.
    const structural = [/border: 1px solid/, /max-width: 68\.75rem/, /max-width: 100%/, /flex: 1 1 180px/, /@media \(max-width: 600px\)/, /inset: 100% 0 auto auto/];
    const strip = (line: string) => { let out = '', i = 0; while (i < line.length) { if (line.startsWith('var(', i)) { let depth = 1, j = i + 4; while (j < line.length && depth) { if (line[j] === '(') depth++; else if (line[j] === ')') depth--; j++; } out += 'VAR'; i = j; } else out += line[i++]; } return out; };
    const literals = appCss.split('\n').filter(line => /(?<![\w.-])\d*\.?\d+(?:px|rem|%)(?![\w-])/.test(strip(line)) && !structural.some(pattern => pattern.test(line)));
    expect(literals).toEqual([]);
    expect(appCss).toContain('font-family: var(--sys-text-scale-body-md-font-family)');
    expect(appCss).toContain('.workflow-heading h1 { margin: var(--cmp-spacing-stack-xs) 0 var(--cmp-spacing-stack-lg); font-family: var(--sys-text-scale-heading-xl-font-family); font-size: var(--sys-text-scale-heading-xl-font-size);');
    expect(appCss).toContain('.workflow-eyebrow { margin: 0; color: var(--sys-text-secondary); font-family: var(--sys-text-scale-caption-font-family); font-size: var(--sys-text-scale-caption-font-size);');
    expect(appCss).toContain('border-radius: var(--cmp-card-radius)');
    expect(appCss).toContain('.workflow-heading h1 { font-size: var(--sys-text-scale-heading-lg-font-size); }');
  });
});
