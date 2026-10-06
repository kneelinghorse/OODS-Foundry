/**
 * s171 m04 — the mobile-output honesty oracle.
 *
 * Reads the two EMITTED mobile artifacts (`packages/tokens/dist/ios-swift/OodsTokens.swift`,
 * `packages/tokens/dist/compose/OodsTokens.kt`) plus the untouched web tailwind artifact as
 * the source-value witness, and holds the emission to the s171 memo's policies:
 *
 *   • every value compiles as a typed literal (shape regex per line) — no oklch(), no bare
 *     identifiers, no ms-suffixed or comma-list values;
 *   • magnitude pins, one per value class, so a silently re-introduced ×16 rem assumption
 *     (or a dropped ÷100, or an unconverted duration) reds its own family;
 *   • the sp/dp/multiplier/em binding follows the committed path manifest (counts pinned
 *     27/24/18/105 with one literal member per class named OUTSIDE the manifest);
 *   • colour output is CSS-Color-4 gamut MAPPING, not naive channel clipping — both are
 *     computed here, in-test, for every divergent table row, and the emitted bytes must
 *     equal toGamut and differ from clip (a clip implementation cannot green);
 *   • the deferred classes (54 easing curves, 14 font stacks) are disclosed in the emitted
 *     headers with exact counts — silence is not allowed to read as coverage.
 *
 * Run `pnpm --filter @oods/tokens run build` first; the dist files are gitignored and this
 * oracle fails loudly when they are missing (CI's coverage job builds tokens before tests).
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import ColorJs from 'colorjs.io';

import {
  MOBILE_DIMENSION_CLASSES,
  MOBILE_DEFERRED_TYPES,
  mobileDimensionClass,
} from '../../packages/tokens/scripts/mobile-manifest.mjs';

const PKG = path.resolve(process.cwd(), 'packages/tokens');
const SWIFT_PATH = path.join(PKG, 'dist/ios-swift/OodsTokens.swift');
const KOTLIN_PATH = path.join(PKG, 'dist/compose/OodsTokens.kt');
const TAILWIND_PATH = path.join(PKG, 'dist/tailwind/tokens.json');
const GAMUT_TABLE_PATH = path.join(PKG, 'scripts/oklch-gamut-table.json');

for (const file of [SWIFT_PATH, KOTLIN_PATH, TAILWIND_PATH]) {
  if (!existsSync(file)) {
    throw new Error(
      `mobile-output oracle: missing ${file} — run \`pnpm --filter @oods/tokens run build\` first`,
    );
  }
}

const swiftText = readFileSync(SWIFT_PATH, 'utf8');
const kotlinText = readFileSync(KOTLIN_PATH, 'utf8');
const tailwind = JSON.parse(readFileSync(TAILWIND_PATH, 'utf8')) as {
  flat: Record<string, { value: unknown; path: string[] }>;
};
const gamutTable = JSON.parse(readFileSync(GAMUT_TABLE_PATH, 'utf8')) as {
  rows: Array<{ oklch: string; mappedHex: string }>;
};

/** SD `name/camel` over the token path (verified below: every manifest path must resolve). */
function camelName(tokenPath: string[]): string {
  const parts = tokenPath.flatMap((segment) => segment.split(/[-_ ]/)).filter(Boolean);
  return parts
    .map((part, index) => (index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function parseConstants(text: string, lineRe: RegExp): Map<string, string> {
  const constants = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = line.match(lineRe);
    if (match) {
      constants.set(match[1], match[2].trim());
    }
  }
  return constants;
}

// Swift lines carry an optional trailing `/** … */` doc comment; Kotlin lines do not.
const swiftConstants = parseConstants(swiftText, /^\s*public static let (\w+) = (.+?)(?:\s*\/\*\*.*\*\/)?$/);
const kotlinConstants = parseConstants(kotlinText, /^\s{2}val (\w+) = (.+)$/);

/** Source-value classes, derived from the UNTOUCHED web artifact (value shapes, not $type). */
type SourceClass = 'color' | 'duration' | 'easing' | 'fontStack' | 'other';
function sourceClass(value: unknown): SourceClass {
  if (typeof value !== 'string') return 'other';
  if (/^(oklch\(|#|rgba?\()/.test(value)) return 'color';
  if (/^\d+(\.\d+)?ms$/.test(value)) return 'duration';
  if (value.startsWith('cubic-bezier(')) return 'easing';
  if (value.includes(',')) return 'fontStack';
  return 'other';
}

const flatEntries = Object.values(tailwind.flat);
const byClass = new Map<SourceClass, Array<{ path: string[]; value: string }>>();
for (const entry of flatEntries) {
  const cls = sourceClass(entry.value);
  if (!byClass.has(cls)) byClass.set(cls, []);
  byClass.get(cls)!.push({ path: entry.path, value: entry.value as string });
}

const srgbBytes = (color: InstanceType<typeof ColorJs>) =>
  color.coords.map((coord: number) => Math.min(255, Math.max(0, Math.round(coord * 255))));
const bytesToHex = (bytes: number[]) =>
  `#${bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
const swiftChannels = (bytes: number[]) => bytes.map((byte) => (byte / 255).toFixed(3));

describe('mobile output — census and shape', () => {
  // S222 m02: m01 set these pins before its last token changes (its ramp steps and the move of control paddings, table
  // rows and the control icon onto the rem ramp), so they were stale at its commit; the counts below are what the committed
  // m01 build emits, and m02 adds no mobile constant (both emit the same 1265 names).
  // S222 m01: +299 — the 12-step light and dark reference scales for seven colour families (replacing the 50–950
  // ramps), 21 new colour roles in each brand base and both theme layers, each brand's radius and font, the type roles
  // (display, heading-md/sm, label, mono) and the density tokens; 22 of them are font stacks, which stay deferred.
  // S212 m03: +1 — viz.mark.single, the governed single-series mark colour (#2327). S211 m02: +1 — sys.page-gutter, the one left edge of a generated page. S206 m01: +8 — the four accent status colours in each base brand namespace. S200 m02: +78 geometry tokens (the rem ramp, linked sys roles, expanded panel/overlay shadows, cmp roles). S197: +48 reference/dark colors; s192 m02: +134 component/system aliases; s178 m02: +6 exactly — three base focus colours for each brand. The 18 authored cells
  // collapse to the two base brand namespaces in the flat/mobile artifact; dark and hc stay
  // scoped web output. The dimension manifest counts (27/24/18/130/47) and the deferral
  // subtraction (54 easings + 14 font stacks) remain unmoved.
  it('emits exactly 1265 constants per file (1355 − 54 easing − 36 font stacks), identical name sets', () => {
    expect(flatEntries.length).toBe(1355);
    expect(swiftConstants.size).toBe(1265);
    expect(kotlinConstants.size).toBe(1265);
    expect([...swiftConstants.keys()].sort()).toEqual([...kotlinConstants.keys()].sort());
  });

  it('contains zero oklch( occurrences in either file', () => {
    expect(swiftText.includes('oklch(')).toBe(false);
    expect(kotlinText.includes('oklch(')).toBe(false);
  });

  it('every Swift value matches a compilable typed-literal shape (no bare identifiers)', () => {
    const shape =
      /^(UIColor\(red: \d+\.\d{3}, green: \d+\.\d{3}, blue: \d+\.\d{3}, alpha: \d+(\.\d+)?\)|CGFloat\(-?\d+(\.\d+)?\)|TimeInterval\(\d+(\.\d+)?\)|"[^"]*"|-?\d+(\.\d+)?)$/;
    const offenders = [...swiftConstants.entries()].filter(([, value]) => !shape.test(value));
    expect(offenders).toEqual([]);
  });

  it('every Kotlin value matches a compilable typed-literal shape (no bare identifiers)', () => {
    const shape =
      /^(Color\(0x[0-9A-F]{8}\)|(\(-\d+(\.\d+)?\)|\d+(\.\d+)?)\.(dp|sp|em)|"[^"]*"|-?\d+(\.\d+)?)$/;
    const offenders = [...kotlinConstants.entries()].filter(([, value]) => !shape.test(value));
    expect(offenders).toEqual([]);
  });

  it('emits no constant for any deferred token (54 easing + 36 font stacks stay out of both files)', () => {
    const easings = byClass.get('easing') ?? [];
    const fontStacks = byClass.get('fontStack') ?? [];
    expect(easings.length).toBe(MOBILE_DEFERRED_TYPES.cubicBezier);
    expect(fontStacks.length).toBe(MOBILE_DEFERRED_TYPES.fontFamily);
    for (const entry of [...easings, ...fontStacks]) {
      const name = camelName(entry.path);
      expect(swiftConstants.has(name), `Swift should not emit deferred ${name}`).toBe(false);
      expect(kotlinConstants.has(name), `Kotlin should not emit deferred ${name}`).toBe(false);
    }
  });

  it('both headers disclose the deferral with exact counts', () => {
    for (const text of [swiftText, kotlinText]) {
      const header = text.split('\n').slice(0, 25).join('\n');
      expect(header).toContain(`${MOBILE_DEFERRED_TYPES.cubicBezier} easing curves`);
      expect(header).toContain(`${MOBILE_DEFERRED_TYPES.fontFamily} font stacks`);
    }
  });
});

describe('mobile output — the path manifest binding', () => {
  // s222-m01 (#2502 rulings 8-9): the type roles' px line heights are their own class (1:1 like font sizes), the display
  // roles keep a unitless line height, and the radius, table and control-block tokens are px.
  it('pins the manifest class counts to the census 28/18/20/21/135 and the 54 rem-authored roles', () => {
    expect(MOBILE_DIMENSION_CLASSES.fontSize.length).toBe(28);
    expect(MOBILE_DIMENSION_CLASSES.lineHeight.length).toBe(18);
    expect(MOBILE_DIMENSION_CLASSES.lineHeightPx.length).toBe(20);
    expect(MOBILE_DIMENSION_CLASSES.letterSpacing.length).toBe(21);
    expect(MOBILE_DIMENSION_CLASSES.spacing.length).toBe(135);
    expect(MOBILE_DIMENSION_CLASSES.spacingRem.length).toBe(54);
  });

  it('pins one literal member per class, named OUTSIDE the manifest', () => {
    expect(mobileDimensionClass('sys.text.scale.body-md.fontSize')).toBe('fontSize');
    expect(mobileDimensionClass('ref.typography.line-height.loose')).toBe('lineHeight');
    expect(mobileDimensionClass('ref.typography.letter-spacing.wide')).toBe('letterSpacing');
    expect(mobileDimensionClass('ref.space.inset.compact')).toBe('spacing');
  });

  it('every manifest path resolves to an emitted constant in both files', () => {
    const allPaths = Object.values(MOBILE_DIMENSION_CLASSES).flat();
    expect(allPaths.length).toBe(276);
    for (const tokenPath of allPaths) {
      const name = camelName(tokenPath.split('.'));
      expect(swiftConstants.has(name), `Swift missing ${tokenPath} → ${name}`).toBe(true);
      expect(kotlinConstants.has(name), `Kotlin missing ${tokenPath} → ${name}`).toBe(true);
    }
  });

  it('fontSize class emits Compose .sp and spacing class emits .dp (the split keys on the manifest)', () => {
    for (const tokenPath of [...MOBILE_DIMENSION_CLASSES.fontSize, ...MOBILE_DIMENSION_CLASSES.lineHeightPx]) {
      expect(kotlinConstants.get(camelName(tokenPath.split('.')))).toMatch(/^\d+(\.\d+)?\.sp$/);
    }
    for (const tokenPath of MOBILE_DIMENSION_CLASSES.spacing) {
      expect(kotlinConstants.get(camelName(tokenPath.split('.')))).toMatch(/^(\(-\d+(\.\d+)?\)|\d+(\.\d+)?)\.dp$/);
    }
  });
});

describe('mobile output — magnitude pins, one per value class', () => {
  const pins: Array<[name: string, swift: string, kotlin: string]> = [
    // Explicit s192 rem reference: 0.5rem becomes 8pt/dp; px remains 1:1.
    ['sysControlGap', 'CGFloat(8)', '8.dp'],
    ['cmpBadgeGap', 'CGFloat(4)', '4.dp'],
    // px spacing — 1:1
    ['refSpaceInsetCompact', 'CGFloat(8)', '8.dp'],
    ['refBorderWidthHairline', 'CGFloat(1)', '1.dp'],
    ['refBorderRadiusPill', 'CGFloat(999)', '999.dp'],
    // fontSize — pt / .sp
    ['sysTextScaleBodyMdFontSize', 'CGFloat(16)', '16.sp'],
    // lineHeight — a role's px line height is 1:1 (pt / .sp); a unitless one stays a multiplier
    ['sysTextScaleBodyMdLineHeight', 'CGFloat(24)', '24.sp'],
    ['sysTextScaleDisplayLgLineHeight', '1.05', '1.05'],
    ['refTypographyLineHeightLoose', '1.6', '1.6'],
    // letterSpacing — em number
    ['refTypographyLetterSpacingWide', '0.08', '0.08.em'],
    // duration — seconds vs milliseconds
    ['motionDurationBase', 'TimeInterval(0.18)', '180'],
  ];

  for (const [name, swiftValue, kotlinValue] of pins) {
    it(`pins ${name} = ${swiftValue} (Swift) / ${kotlinValue} (Kotlin)`, () => {
      expect(swiftConstants.get(name)).toBe(swiftValue);
      expect(kotlinConstants.get(name)).toBe(kotlinValue);
    });
  }

  it('no NONZERO emitted px dimension equals 16× its px source (the ×16 rem assumption is dead)', () => {
    const pxPaths = [...MOBILE_DIMENSION_CLASSES.spacing, ...MOBILE_DIMENSION_CLASSES.fontSize];
    const flatByPath = new Map(flatEntries.map((entry) => [entry.path.join('.'), entry]));
    const zeroSources: string[] = [];
    for (const tokenPath of pxPaths) {
      const source = flatByPath.get(tokenPath);
      expect(source, `tailwind witness missing for ${tokenPath}`).toBeDefined();
      const sourcePx = Number(String(source!.value).replace(/px$/, ''));
      const name = camelName(tokenPath.split('.'));
      const swiftNumber = Number(swiftConstants.get(name)!.match(/^CGFloat\((-?\d+(\.\d+)?)\)$/)?.[1]);
      const kotlinNumber = Number(kotlinConstants.get(name)!.match(/^\(?(-?\d+(\.\d+)?)\)?\.(dp|sp)$/)?.[1]);
      if (sourcePx === 0) {
        zeroSources.push(tokenPath);
        expect(swiftNumber).toBe(0);
        expect(kotlinNumber).toBe(0);
        continue;
      }
      expect(swiftNumber, `${name}: ×16 damage (Swift)`).not.toBe(16 * sourcePx);
      expect(kotlinNumber, `${name}: ×16 damage (Kotlin)`).not.toBe(16 * sourcePx);
      // The 1:1 policy itself:
      expect(swiftNumber).toBe(sourcePx);
      expect(kotlinNumber).toBe(sourcePx);
    }
    // Exactly the 0px shadow offsets are the zero-source exclusions: the reference and theme
    // elevations plus, since Sprint 200 m02, the sys and cmp roles that resolve to them.
    expect(zeroSources.sort()).toEqual([
      'cmp.card-shadow.offsetX',
      'cmp.shadow-overlay.offsetX',
      'cmp.shadow-panel.offsetX',
      'shadow.elevation.card.offsetX',
      'shadow.elevation.overlay.offsetX',
      'sys.shadow-overlay.offsetX',
      'sys.shadow-panel.offsetX',
      'theme-dark.shadow.elevation.card.offsetX',
      'theme-dark.shadow.elevation.overlay.offsetX',
      // s222-m01 (#2502 ruling 10): dark elevation is a ring, so its drop offset and blur are zero too.
      'theme-dark.shadow.elevation.card.offsetY',
      'theme-dark.shadow.elevation.card.blur',
      'theme-dark.shadow.elevation.overlay.offsetY',
      'theme-dark.shadow.elevation.overlay.blur',
      'theme.shadow.elevation.card.offsetX',
      'theme.shadow.elevation.overlay.offsetX',
    ].filter((tokenPath) => Number(String(new Map(flatEntries.map((e) => [e.path.join('.'), e.value])).get(tokenPath)).replace(/px$/, '')) === 0).sort());
  });
});

describe('mobile output — anti-gaming, value-position anchored', () => {
  it('emits ≥395 typed colour constants per file (UIColor( / Color(0x at the value position)', () => {
    const swiftColours = [...swiftConstants.values()].filter((value) => value.startsWith('UIColor(')).length;
    const kotlinColours = [...kotlinConstants.values()].filter((value) => value.startsWith('Color(0x')).length;
    expect(swiftColours).toBeGreaterThanOrEqual(395);
    expect(kotlinColours).toBeGreaterThanOrEqual(395);
  });

  it('emits zero quoted-string values for colour-class or duration-class tokens', () => {
    const guarded = [...(byClass.get('color') ?? []), ...(byClass.get('duration') ?? [])];
    expect(guarded.length).toBe(532 + 5 + 1 + 108 + 184); // S222 m01 adds 184 colours: the 12-step light and dark scales for seven families in place of the 50–950 ramps, and 21 new roles in each brand base and each theme layer. S197 adds 48 reference/dark colors; S200 m02 adds the five expanded shadow colours; S206 m01 the eight base accent status colours; S212 m03 viz.mark.single; 108 durations stay fixed.
    for (const entry of guarded) {
      const name = camelName(entry.path);
      expect(swiftConstants.get(name)?.startsWith('"'), `Swift ${name} is a quoted string`).toBe(false);
      expect(kotlinConstants.get(name)?.startsWith('"'), `Kotlin ${name} is a quoted string`).toBe(false);
    }
  });
});

describe('mobile output — gamut mapping, not channel clipping (the m02 table assertion)', () => {
  const rows = gamutTable.rows.map((row) => {
    const source = new ColorJs(row.oklch);
    const mapped = srgbBytes(source.to('srgb').toGamut({ method: 'css' }));
    const clipped = srgbBytes(source.to('srgb').toGamut({ method: 'clip' }));
    const deltaE = new ColorJs('srgb', mapped.map((byte) => byte / 255)).deltaE2000(
      new ColorJs('srgb', clipped.map((byte) => byte / 255)),
    );
    return { ...row, mapped, clipped, deltaE };
  });
  const divergent = rows.filter((row) => row.deltaE > 1);

  it('the committed table has 42 rows, each out of sRGB gamut, each mappedHex reproducible in-test', () => {
    expect(rows.length).toBe(42);
    for (const row of rows) {
      expect(new ColorJs(row.oklch).to('srgb').inGamut(), `${row.oklch} claims out-of-gamut`).toBe(false);
      expect(bytesToHex(row.mapped), `${row.oklch} table drift`).toBe(row.mappedHex);
    }
  });

  it('has ≥10 divergent rows (clip vs toGamut ΔE00 > 1) including brand B’s interactive primary', () => {
    expect(divergent.length).toBeGreaterThanOrEqual(10);
    const divergentValues = divergent.map((row) => row.oklch);
    expect(divergentValues).toContain('oklch(0.535 0.18 232)'); // brand B interactive primary
  });

  it('brand A’s interactive primary maps and clips to the SAME bytes — measured fact, so it cannot discriminate (memo expectation corrected s171-m04)', () => {
    // The s171 memo predicted BOTH brands' primaries among the divergent rows; measurement
    // says brand A's oklch(0.56 0.19 43) yields ΔE00 = 0 between CSS gamut mapping and
    // naive clipping (both #C93E00). Asserted here so the fact is pinned, not silently lost.
    const brandA = rows.find((row) => row.oklch === 'oklch(0.56 0.19 43)');
    expect(brandA).toBeDefined();
    expect(brandA!.deltaE).toBe(0);
    expect(bytesToHex(brandA!.mapped)).toBe('#C93E00');
    expect(bytesToHex(brandA!.clipped)).toBe('#C93E00');
  });

  it('emits every historical divergent color through the real mobile build — clipping cannot pass when the live palette is in gamut', () => {
    // S197 deliberately gamut-reduces palette chroma, so the historical out-of-gamut
    // colors no longer have live carriers. Feed them to the UNMODIFIED production
    // builder in an isolated package and inspect its emitted Swift/Kotlin literals.
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'oods-mobile-gamut-'));
    const fixture = path.join(temporary, 'tokens'); mkdirSync(fixture);
    try {
      for (const file of ['src', 'scripts', 'style-dictionary.config.cjs', 'package.json']) cpSync(path.join(PKG, file), path.join(fixture, file), { recursive: true });
      symlinkSync(path.join(PKG, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
      symlinkSync(path.resolve('node_modules'), path.join(temporary, 'node_modules'), 'dir');
      writeFileSync(path.join(fixture, 'src/mobile-gamut-fixture.json'), JSON.stringify({ fixture: Object.fromEntries(
        divergent.map((row, index) => [`color-${index}`, { $type: 'color', $value: row.oklch }]),
      ) }));
      const built = spawnSync(process.execPath, [path.join(fixture, 'scripts/build.mjs')], { encoding: 'utf8', timeout: 30_000 });
      expect(built.status, built.stdout + built.stderr).toBe(0);
      const fixtureSwift = parseConstants(readFileSync(path.join(fixture, 'dist/ios-swift/OodsTokens.swift'), 'utf8'), /^\s*public static let (\w+) = (.+?)(?:\s*\/\*\*.*\*\/)?$/);
      const fixtureKotlin = parseConstants(readFileSync(path.join(fixture, 'dist/compose/OodsTokens.kt'), 'utf8'), /^\s{2}val (\w+) = (.+)$/);
    for (const [index, row] of divergent.entries()) {
      const mappedKotlin = `Color(0xFF${row.mapped.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')})`;
      const clippedKotlin = `Color(0xFF${row.clipped.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')})`;
      const [mr, mg, mb] = swiftChannels(row.mapped);
      const [cr, cg, cb] = swiftChannels(row.clipped);
      const mappedSwift = `UIColor(red: ${mr}, green: ${mg}, blue: ${mb}, alpha: 1)`;
      const clippedSwift = `UIColor(red: ${cr}, green: ${cg}, blue: ${cb}, alpha: 1)`;
        const name = camelName(['fixture', `color-${index}`]);
        expect(fixtureKotlin.get(name), `Kotlin ${name} must be the toGamut mapping`).toBe(mappedKotlin);
        expect(fixtureKotlin.get(name), `Kotlin ${name} must NOT be the naive clip`).not.toBe(clippedKotlin);
        expect(fixtureSwift.get(name), `Swift ${name} must be the toGamut mapping`).toBe(mappedSwift);
        expect(fixtureSwift.get(name), `Swift ${name} must NOT be the naive clip`).not.toBe(clippedSwift);
      }
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
});
