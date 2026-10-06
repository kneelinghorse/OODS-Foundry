/**
 * s222-m01 (#2502 rulings 2-6): a brand is a recipe, and this module turns a recipe into the brand's colours, radius and
 * font, and (s222-m02, ruling 12) its chart palettes. The palette generator (scripts/tokens/generate-palette.ts) writes
 * brands A and B with it, and brand_intake uses the same function for any recipe, so a recipe always gives the same bytes.
 *
 * THE SCALES. Every hue gets 12 light and 12 dark steps, and each step has one job (Radix Colors' structure):
 *   1-2 app backgrounds · 3-5 component backgrounds (rest, hover, selected) · 6-8 borders (subtle, strong, hover)
 *   9-10 solid fills (rest, hover) · 11-12 text (secondary, primary)
 * Accent and status hues are calibrated on Radix Colors (MIT; the notice ships in NOTICE): each step's OKLCH lightness,
 * chroma and hue offset are interpolated by hue between the two nearest Radix families (radix-calibration.json), so a
 * Radix hue gets Radix's own values. The neutral scale has the same jobs, with its lightness taken from the measured
 * neutral-first target (artifacts/product-reality/sprint-222/planning/reference-target), since Radix's grey has two
 * text steps where OODS has three text roles; its tint follows Radix slate's chroma profile.
 *
 * THE ROLES. Every colour role takes a step by its job. Where OODS grading needs a contrast a step does not reach, the
 * role takes the first step of its job group that does (the focus ring, the interactive border), or the step's colour
 * is darkened (lightened in dark) along its own hue and chroma until it passes (text on tinted surfaces, white text on
 * solid fills). Nothing takes a free-floating lightness. `explain()` lists every such adjustment.
 *
 * No dependency: the colour maths (OKLCH, sRGB, WCAG 2 contrast) is below, so the runtime can use it as shipped.
 */
import calibration from './radix-calibration.json' with { type: 'json' };

export const STEPS = 12;
export const MODES = Object.freeze(['light', 'dark']);

/* ─────────────────────────────── colour maths ─────────────────────────────── */

const toLab = ({ l, c, h }) => [l, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)];
const fromLab = ([l, a, b]) => {
  const c = Math.hypot(a, b);
  return { l, c, h: c < 1e-7 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
};

function linearRgb(color) {
  const [L, a, b] = toLab(color);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encode = (x) => (Math.abs(x) <= 0.0031308 ? 12.92 * x : Math.sign(x) * (1.055 * Math.abs(x) ** (1 / 2.4) - 0.055));

/** In sRGB, with the same tolerance as the palette checks (scripts/tokens/palette-checks.ts). */
export function inSrgb(color) {
  return linearRgb(color).map(encode).every((channel) => Number.isFinite(channel) && channel >= -0.00001 && channel <= 1.00001);
}

const round6 = (value) => Number(value.toFixed(6));
const normalize = ({ l, c, h }) => ({ l: round6(l), c: round6(c), h: round6(((h % 360) + 360) % 360) });

/** Keep lightness and hue; reduce chroma into sRGB (the generator's rule since Sprint 197). */
export function gamut(l, c, h) {
  const color = normalize({ l, c: Math.max(0, c), h });
  if (inSrgb(color)) return color;
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (inSrgb(normalize({ l: color.l, c: mid, h: color.h }))) low = mid;
    else high = mid;
  }
  return normalize({ l: color.l, c: low, h: color.h });
}

/** The CSS literal the token files hold. */
export const css = ({ l, c, h }) => `oklch(${l} ${c} ${h})`;

/** The 8-bit sRGB hex a browser paints, uppercase (the files' fallback, and what the contrast graders read). */
export function hex(color) {
  return `#${linearRgb(color).map(encode).map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

const channelLinear = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
/** WCAG 2 relative luminance from the painted hex, as @oods/a11y-tools computes it. */
function luminance(color) {
  const text = hex(color);
  const [r, g, b] = [1, 3, 5].map((i) => channelLinear(parseInt(text.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Interpolate in OKLab: t = 0 is `a`, t = 1 is `b`. */
export function mix(a, b, t) {
  const [la, lb] = [toLab(a), toLab(b)];
  const lab = la.map((value, i) => value + (lb[i] - value) * t);
  const color = fromLab(lab);
  return gamut(color.l, color.c, color.c < 1e-7 ? a.h : color.h);
}

/* ───────────────────────────────── scales ─────────────────────────────────── */

/**
 * Neutral lightness by step (OKLCH L). Light 1-7 and 10-12 and dark 1-3 and 10-12 are the measured target's values
 * (canvas #ffffff, subtle #f5f5f5, border #e5e5e5, strong border #d4d4d8, text #0a0a0a/#525252 and #fafafa/#b0b4ba/
 * #a1a1a1), light 10 sits where muted text clears 4.5:1 on step 3, and the rest follow Radix's grey.
 */
export const NEUTRAL_LIGHTNESS = Object.freeze({
  light: Object.freeze([1, 0.985, 0.97, 0.95, 0.935, 0.922, 0.871, 0.792, 0.643, 0.545, 0.439, 0.145]),
  dark: Object.freeze([0.145, 0.205, 0.269, 0.29, 0.31, 0.325, 0.37, 0.489, 0.538, 0.708, 0.769, 0.985]),
});
/** Radix slate's chroma by step, relative to its peak: a tinted neutral carries its tint where Radix's does. */
export const NEUTRAL_CHROMA = Object.freeze({
  light: Object.freeze([0.06, 0.18, 0.24, 0.29, 0.41, 0.53, 0.65, 0.94, 1, 0.88, 0.82, 0.59]),
  dark: Object.freeze([0.27, 0.27, 0.4, 0.47, 0.53, 0.67, 0.8, 1, 1, 1, 0.67, 0.2]),
});

/**
 * The Radix families the hue interpolation runs over, by the hue of their step 9. Mint and sky are left out: they are
 * Radix's bright alternates of teal and cyan, and interpolating through them would jump the lightness between hues.
 */
const RING = Object.freeze(Object.entries(calibration.families)
  .filter(([name]) => !['mint', 'sky'].includes(name))
  .map(([name, family]) => ({ name, hue: family.light[8][2], family }))
  .sort((a, b) => a.hue - b.hue));

const hueDelta = (from, to) => ((to - from + 540) % 360) - 180;

/** 12 steps for any hue, calibrated on Radix Colors. `chroma` scales the calibrated chroma (1 = Radix's). */
export function hueScale(hue, mode, chroma = 1) {
  const target = ((hue % 360) + 360) % 360;
  let upper = RING.findIndex((entry) => entry.hue >= target);
  if (upper === -1) upper = 0;
  const lower = (upper - 1 + RING.length) % RING.length;
  const a = RING[lower];
  const b = RING[upper];
  const span = (b.hue - a.hue + 360) % 360 || 360;
  const t = a === b ? 0 : ((target - a.hue + 360) % 360) / span;
  return Array.from({ length: STEPS }, (_, i) => {
    const [la, ca, ha] = a.family[mode][i];
    const [lb, cb, hb] = b.family[mode][i];
    const offset = hueDelta(a.hue, ha) + (hueDelta(b.hue, hb) - hueDelta(a.hue, ha)) * t;
    return gamut(la + (lb - la) * t, (ca + (cb - ca) * t) * chroma, target + offset);
  });
}

/** 12 neutral steps: the target's lightness, the recipe's hue and peak chroma, Radix slate's chroma profile. */
export function neutralScale(hue, chroma, mode) {
  return NEUTRAL_LIGHTNESS[mode].map((l, i) => gamut(l, chroma * NEUTRAL_CHROMA[mode][i], hue));
}

/* ───────────────────────────────── recipes ────────────────────────────────── */

/** Radix's status families: blue, green, amber, red, and a muted purple for archived records. */
export const DEFAULT_STATUS = Object.freeze({
  info: Object.freeze({ hue: 251.8, chroma: 1 }),
  success: Object.freeze({ hue: 157.7, chroma: 1 }),
  warning: Object.freeze({ hue: 84.1, chroma: 1 }),
  critical: Object.freeze({ hue: 23, chroma: 1 }),
  archive: Object.freeze({ hue: 305.9, chroma: 0.4 }),
});
export const STATUS_FAMILIES = Object.freeze(['info', 'success', 'warning', 'critical']);

/** The families the shipped package carries (@oods/tokens dist/fonts), and the stacks behind them. */
export const FONT_STACKS = Object.freeze({
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
});
export const SHIPPED_FONTS = Object.freeze(['Geist', 'DM Sans', 'Geist Mono']);

/**
 * A recipe's fields and their ranges. `primary` says which scale the primary action takes: "neutral" (near-black in
 * light, near-white in dark) or "accent" (the accent's solid step). `radius` is the control radius in px; small,
 * large, card and pill follow from it (ruling 9).
 */
export const RECIPE_FIELDS = Object.freeze({
  neutralHue: 'a hue in degrees, 0 to 360',
  neutralChroma: 'the neutral tint, 0 (grey) to 0.03',
  accentHue: 'a hue in degrees, 0 to 360',
  primary: '"neutral" or "accent"',
  radius: 'the control corner radius in px, 0 to 16',
  font: 'the sans family name, e.g. "Geist"; optional mono family in fontMono',
});

const FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,63}$/;

/** Every problem with a recipe, as [field, message]; empty when it can be built. */
export function recipeProblems(recipe) {
  const problems = [];
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return [['recipe', 'a recipe is an object']];
  const known = new Set(['neutralHue', 'neutralChroma', 'accentHue', 'primary', 'radius', 'font', 'fontMono', 'status']);
  for (const key of Object.keys(recipe)) if (!known.has(key)) problems.push([key, `${key} is not a recipe field`]);
  const number = (key, min, max) => {
    const value = recipe[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) problems.push([key, `${key} must be ${RECIPE_FIELDS[key]}`]);
  };
  number('neutralHue', 0, 360);
  number('neutralChroma', 0, 0.03);
  number('accentHue', 0, 360);
  number('radius', 0, 16);
  if (!['neutral', 'accent'].includes(recipe.primary)) problems.push(['primary', `primary must be ${RECIPE_FIELDS.primary}`]);
  if (typeof recipe.font !== 'string' || !FAMILY_NAME.test(recipe.font)) problems.push(['font', 'font must be a family name of letters, digits, spaces and hyphens']);
  if (recipe.fontMono !== undefined && (typeof recipe.fontMono !== 'string' || !FAMILY_NAME.test(recipe.fontMono))) problems.push(['fontMono', 'fontMono must be a family name of letters, digits, spaces and hyphens']);
  if (recipe.status !== undefined) {
    if (!recipe.status || typeof recipe.status !== 'object' || Array.isArray(recipe.status)) problems.push(['status', 'status is an object of families']);
    else {
      for (const [family, seed] of Object.entries(recipe.status)) {
        if (!(family in DEFAULT_STATUS)) { problems.push([`status.${family}`, `${family} is not a status family (${Object.keys(DEFAULT_STATUS).join(', ')})`]); continue; }
        if (!seed || typeof seed !== 'object' || typeof seed.hue !== 'number' || seed.hue < 0 || seed.hue > 360) problems.push([`status.${family}`, 'a status family is { hue: 0 to 360, chroma?: 0 to 1.5 }']);
        else if (seed.chroma !== undefined && (typeof seed.chroma !== 'number' || seed.chroma < 0 || seed.chroma > 1.5)) problems.push([`status.${family}.chroma`, 'chroma scales the calibrated chroma, 0 to 1.5']);
        for (const key of Object.keys(seed ?? {})) if (!['hue', 'chroma'].includes(key)) problems.push([`status.${family}.${key}`, `${key} is not a status field`]);
      }
    }
  }
  return problems;
}

/* ─────────────────────────────── contrast rules ───────────────────────────── */

/** The floors, with a margin so a rounding step between here and the grader can never flip a pass. */
const TEXT = 4.52;
const NON_TEXT = 3.02;

/** Move a colour's lightness (keeping its hue and chroma where sRGB allows) until `passes`, in `direction` (-1 darker). */
function solve(color, passes, direction, adjustments, role) {
  if (passes(color)) return color;
  let l = color.l;
  for (let i = 0; i < 200; i += 1) {
    l = Math.min(1, Math.max(0, l + direction * 0.0025));
    const next = gamut(l, color.c, color.h);
    if (passes(next)) {
      adjustments.push({ role, from: css(color), to: css(next), fromHex: hex(color), toHex: hex(next) });
      return next;
    }
    if (l === 0 || l === 1) break;
  }
  throw new Error(`recipe: ${role} cannot reach its contrast floor`);
}

const passesAll = (backgrounds, floor) => (color) => backgrounds.every((background) => contrast(color, background) >= floor);

/**
 * One mode's colour roles for a recipe, by brand-relative name (the brand files' `color.brand.<id>.<role>`), plus the
 * adjustments the contrast rules made. Values are OKLCH objects; `css()` and `hex()` serialize them.
 */
export function brandColorRoles(recipe, mode) {
  const problems = recipeProblems(recipe);
  if (problems.length > 0) throw new Error(`recipe: ${problems.map(([, message]) => message).join('; ')}`);
  const dark = mode === 'dark';
  const toward = dark ? 1 : -1; // more contrast against this mode's panels
  const adjustments = [];
  const N = neutralScale(recipe.neutralHue, recipe.neutralChroma, mode);
  const light = neutralScale(recipe.neutralHue, recipe.neutralChroma, 'light');
  const white = light[0];
  const black = light[11];
  const A = hueScale(recipe.accentHue, mode);
  const status = Object.fromEntries(Object.entries({ ...DEFAULT_STATUS, ...(recipe.status ?? {}) })
    .map(([family, seed]) => [family, hueScale(seed.hue, mode, seed.chroma ?? 1)]));
  const step = (scale, n) => scale[n - 1];
  const roles = {};

  // Surfaces: the app background, a raised panel (the canvas in light, step 2 in dark), component backgrounds.
  roles['surface.canvas'] = step(N, 1);
  roles['surface.raised'] = step(N, dark ? 2 : 1);
  roles['surface.subtle'] = step(N, 3);
  roles['surface.disabled'] = step(N, 3);
  roles['surface.backdrop'] = step(N, dark ? 1 : 12);
  roles['surface.inverse'] = step(N, 12);
  const panels = [roles['surface.canvas'], roles['surface.raised'], roles['surface.subtle']];

  /** Text on a solid fill: white when it reaches 4.5:1, else near-black. */
  const on = (fill) => (contrast(white, fill) >= TEXT ? white : black);
  /** A solid fill (step 9, hover step 10): darkened until white text reaches 4.5:1, unless it is a bright hue with dark text. */
  const solids = (scale, name) => {
    const bright = step(scale, 9).l >= 0.75 && contrast(black, step(scale, 9)) >= TEXT;
    const text = bright ? black : white;
    const ok = (color) => contrast(text, color) >= TEXT;
    const rest = solve(step(scale, 9), ok, bright ? 1 : -1, adjustments, `${name} solid`);
    const hoverStep = step(scale, 10);
    const hover = solve(ok(hoverStep) ? hoverStep : gamut(Math.min(hoverStep.l, rest.l - 0.03), hoverStep.c, hoverStep.h), ok, bright ? 1 : -1, adjustments, `${name} solid hover`);
    const pressed = solve(gamut(hover.l + (hover.l - rest.l), hover.c, hover.h), ok, bright ? 1 : -1, adjustments, `${name} solid pressed`);
    return { rest, hover, pressed, text };
  };

  // The primary action: the neutral's high-contrast solid (step 12, hover toward step 11) or the accent's solid.
  if (recipe.primary === 'neutral') {
    const rest = step(N, 12);
    roles['surface.interactive.primary.default'] = rest;
    roles['surface.interactive.primary.hover'] = mix(rest, step(N, 11), 0.65);
    roles['surface.interactive.primary.pressed'] = mix(rest, step(N, 11), 0.4);
  } else {
    const accent = solids(A, 'accent');
    roles['surface.interactive.primary.default'] = accent.rest;
    roles['surface.interactive.primary.hover'] = accent.hover;
    roles['surface.interactive.primary.pressed'] = accent.pressed;
  }
  roles['surface.interactive.secondary.default'] = step(N, 3);
  roles['surface.interactive.secondary.hover'] = step(N, 4);
  roles['surface.interactive.secondary.pressed'] = step(N, 5);
  const critical = solids(status.critical, 'critical');
  roles['surface.interactive.destructive.default'] = critical.rest;
  roles['surface.interactive.destructive.hover'] = critical.hover;
  roles['surface.interactive.destructive.pressed'] = critical.pressed;

  // Borders: dividers and card edges are steps 6 and 7 (exempt from 3:1); controls take the first neutral step from 7
  // that reaches 3:1 on the canvas and the raised panel, and hover one step further.
  roles['border.subtle'] = step(N, 6);
  roles['border.strong'] = step(N, 7);
  const controlBackgrounds = [roles['surface.canvas'], roles['surface.raised']];
  const interactiveStep = [7, 8, 9, 10, 11].find((n) => passesAll(controlBackgrounds, NON_TEXT)(step(N, n))) ?? 11;
  roles['border.interactive'] = step(N, interactiveStep);
  roles['border.interactiveHover'] = step(N, Math.min(12, interactiveStep + 1));

  // Text: steps 12 and 11; muted text is step 10, each held to 4.5:1 on every panel.
  const text = (color, role, backgrounds = panels) => solve(color, passesAll(backgrounds, TEXT), toward, adjustments, role);
  roles['text.primary'] = text(step(N, 12), 'text.primary');
  roles['text.secondary'] = text(step(N, 11), 'text.secondary');
  roles['text.muted'] = text(step(N, 10), 'text.muted');
  roles['text.inverse'] = on(roles['surface.inverse']);
  roles['text.onInteractive'] = on(roles['surface.interactive.primary.default']);
  roles['text.onDestructive'] = critical.text;
  roles['text.disabled'] = step(N, 9);
  roles['text.accent'] = text(step(A, 11), 'text.accent');

  // The focus ring: the first accent step from 8 that reaches 3:1 on the canvas, the raised panel and the primary fill,
  // else the primary text colour. The inner ring is the canvas (the 2px offset).
  const ringOk = passesAll([roles['surface.canvas'], roles['surface.raised'], roles['surface.interactive.primary.default']], NON_TEXT);
  const ringStep = [8, 9, 10, 11, 12].find((n) => ringOk(step(A, n)));
  roles['focus.ring.outer'] = ringStep ? step(A, ringStep) : roles['text.primary'];
  roles['focus.ring.inner'] = roles['surface.canvas'];
  roles['focus.text'] = roles['text.accent'];

  roles['accent.background'] = step(A, 3);
  roles['accent.border'] = step(A, 7);
  roles['accent.text'] = text(step(A, 11), 'accent.text', [...panels, step(A, 3)]);

  // Status families: a tinted surface (3), a border (7), text (11) held to 4.5:1 on the tint and the panels, an icon
  // (the first of 9-11 at 3:1), and a solid (9) with its text.
  const family = (target, name, scale, solid) => {
    const surface = step(scale, 3);
    target[`status.${name}.surface`] = surface;
    target[`status.${name}.border`] = step(scale, 7);
    target[`status.${name}.text`] = text(step(scale, 11), `status.${name}.text`, [...panels, surface]);
    const iconOk = passesAll([...panels, surface], NON_TEXT);
    const iconStep = [9, 10, 11].find((n) => iconOk(step(scale, n)));
    target[`status.${name}.icon`] = iconStep ? step(scale, iconStep) : target[`status.${name}.text`];
    if (solid) {
      target[`status.${name}.solid`] = solid.rest;
      target[`status.${name}.onSolid`] = solid.text;
    }
  };
  for (const name of STATUS_FAMILIES) family(roles, name, status[name], name === 'critical' ? critical : solids(status[name], name));
  family(roles, 'neutral', N, { rest: step(N, 12), text: on(step(N, 12)) });
  family(roles, 'accent', A, solids(A, 'accent'));
  // Archived records: the theme layer's status family that brand files do not carry (no solid).
  const themeOnly = {};
  family(themeOnly, 'archive', status.archive);

  return { roles, themeOnly, adjustments, scales: { neutral: N, accent: A, ...status } };
}

/** The radius roles in px: control r, small r-2, large r+2, card 2r, pill (ruling 9). */
export function brandRadius(recipe) {
  const r = recipe.radius;
  return { control: r, small: Math.max(0, r - 2), large: r + 2, card: r * 2, pill: 999 };
}

/** The font roles: the recipe's family, then the system stack. */
export function brandFont(recipe) {
  const quote = (name) => (/\s/.test(name) ? `'${name}'` : name);
  return { sans: `${quote(recipe.font)}, ${FONT_STACKS.sans}`, mono: `${quote(recipe.fontMono ?? 'Geist Mono')}, ${FONT_STACKS.mono}` };
}

/* ─────────────────────────────── chart palettes ───────────────────────────── */

/**
 * s222-m02 (#2502 ruling 12): charts follow the brand. Each theme's chart colours come from the recipe's scales:
 *  - categorical: six hues 60° apart, starting at the accent, each at its step 9 (the dark scale's step 9 in dark). The
 *    order puts the complement second and alternates round the wheel, so a chart with two or three series gets the most
 *    different colours first. `viz.mark.single`, the colour of a one-series chart, is the first slot: the accent's solid.
 *  - sequential: nine steps on the chart lightness ladder, the accent's step-9 hue, chroma from its step-9 chroma on
 *    Sprint 197's tone curve (0.8 of it in dark, so the scale does not glow on a dark canvas). The strongest value is the
 *    one that stands out most from the canvas: 09 is the darkest step in light and the brightest in dark.
 *  - diverging: the accent's step-9 hue below the midpoint and the critical (red) hue's above it, the same lightness and
 *    chroma on both wings, and the neutral scale at the midpoint. The wings gain emphasis away from the midpoint: they
 *    darken from a light midpoint in light and brighten from a dark one in dark.
 *  - hc: every series is CanvasText and the ordered scales are greys, as since Sprint 197; they follow no recipe.
 * Where a categorical step fails the chart grading, it moves along its own hue (lightness, chroma reduced only to stay in
 * sRGB), and explain() lists the move: first each series reaches 3:1 on the canvas (WCAG 1.4.11, certify's role C), then
 * the five after the accent take the lightness nearest their step 9 (least squares) at which every pair stays apart by
 * CIEDE2000 12 or more under normal vision and the three dichromacies (Machado 2009), the target Sprint 197 set for
 * certify's role A. If no such lightness exists, the palette that keeps them farthest apart is used.
 */
export const CATEGORICAL_OFFSETS = Object.freeze([0, 180, 60, 240, 120, 300]);
/**
 * The chart lightness ladders the chart-scale checks hold (scripts/tokens/validate-viz-scales.ts: ≥0.1 between steps).
 * s222-m02 (#2502 ruling 12): the dark ladders run the other way, so the strongest value is the brightest on the dark
 * canvas (it was the darkest, 0.16, and sank into it). Nine steps 0.1 apart span 0.8, so dark's 01 sits at 0.2, as far
 * above the canvas (0.145) as the span allows, and reads against it and the land by its hue; 09 is white.
 */
export const SEQUENTIAL_LIGHTNESS = Object.freeze({
  light: Object.freeze([0.94, 0.84, 0.74, 0.64, 0.54, 0.44, 0.34, 0.24, 0.14]),
  dark: Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]),
});
/** Diverging steps run from the midpoint outward (01 nearest it); in dark the midpoint is the darkest (s222-m02). */
export const DIVERGING_LIGHTNESS = Object.freeze({
  light: Object.freeze({ neutral: 0.82, steps: Object.freeze([0.7, 0.58, 0.46, 0.34, 0.22]) }),
  dark: Object.freeze({ neutral: 0.36, steps: Object.freeze([0.46, 0.56, 0.66, 0.76, 0.86]) }),
});
/** Certify's role-A target (s197: CIEDE2000 12, min over normal vision and the three dichromacies), with a margin. */
const DISTINCT = 12.05;
/** Above validate-viz-scales' 0.045 categorical chroma floor (certify's role-A floor is 0.03), so no series reads as grey. */
const CHART_CHROMA_FLOOR = 0.05;
/** The categorical search: lightness steps of 0.02, never darker than 0.3 or lighter than 0.93. */
const CHART_LIGHTNESS = Object.freeze({ step: 0.02, min: 0.3, max: 0.93 });
/** The hc greys keep their Sprint 197 literals, hues included (at chroma 0 a hue paints nothing). */
const HC_GREY_HUES = Object.freeze({ sequential: 265, negative: 197.5, positive: 17.5, neutral: 265 });

// Machado, Oliveira and Fernandes (2009) dichromacy matrices at severity 1, in linear sRGB: deuteran, protan, tritan. The
// same published values certify uses (packages/mcp-server/src/tools/cvd-machado.ts), so this search and the grade agree.
const MACHADO = Object.freeze([
  [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
]);
const linear8 = (channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
const encode8 = (value) => {
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(Math.min(1, Math.max(0, clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055)) * 255);
};
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
/** CIE Lab (D50, Bradford-adapted from sRGB's D65), as colorjs.io computes it for its CIEDE2000. */
function lab8(rgb) {
  const [r, g, b] = rgb.map(linear8);
  const X = 0.41239079926595934 * r + 0.357584339383878 * g + 0.1804807884018343 * b;
  const Y = 0.21263900587151027 * r + 0.715168678767756 * g + 0.07219231536073371 * b;
  const Z = 0.01933081871559182 * r + 0.11919477979462598 * g + 0.9505321522496607 * b;
  const adapted = [
    1.0479297925449969 * X + 0.022946870601609652 * Y - 0.05019226628920524 * Z,
    0.02962780877005599 * X + 0.9904344267538799 * Y - 0.017073799063418826 * Z,
    -0.009243040646204504 * X + 0.015055191490298152 * Y + 0.7518742814281371 * Z,
  ];
  const f = adapted.map((value, i) => { const t = value / D50[i]; return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116; });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
const RAD = Math.PI / 180;
const G7 = 25 ** 7;
/** CIEDE2000 (kL = kC = kH = 1). */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C7 = ((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + G7)));
  const [p1, p2] = [(1 + G) * a1, (1 + G) * a2];
  const [c1, c2] = [Math.hypot(p1, b1), Math.hypot(p2, b2)];
  const hue = (a, b) => (a === 0 && b === 0 ? 0 : ((Math.atan2(b, a) / RAD) + 360) % 360);
  const [h1, h2] = [hue(p1, b1), hue(p2, b2)];
  const difference = h2 - h1;
  const sum = h1 + h2;
  const spread = Math.abs(difference);
  const dh = c1 * c2 === 0 ? 0 : spread <= 180 ? difference : difference > 180 ? difference - 360 : difference + 360;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh * RAD) / 2);
  const Lm = (L1 + L2) / 2;
  const Cm = (c1 + c2) / 2;
  const hm = c1 * c2 === 0 ? sum : spread <= 180 ? sum / 2 : sum < 360 ? (sum + 360) / 2 : (sum - 360) / 2;
  const lsq = (Lm - 50) ** 2;
  const SL = 1 + (0.015 * lsq) / Math.sqrt(20 + lsq);
  const SC = 1 + 0.045 * Cm;
  const T = 1 - 0.17 * Math.cos((hm - 30) * RAD) + 0.24 * Math.cos(2 * hm * RAD) + 0.32 * Math.cos((3 * hm + 6) * RAD) - 0.2 * Math.cos((4 * hm - 63) * RAD);
  const SH = 1 + 0.015 * Cm * T;
  const RT = -Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * RAD) * 2 * Math.sqrt(Cm ** 7 / (Cm ** 7 + G7));
  const [dL, dC] = [(L2 - L1) / SL, (c2 - c1) / SC];
  return Math.sqrt(dL ** 2 + dC ** 2 + (dH / SH) ** 2 + RT * dC * (dH / SH));
}
/** A colour as each viewer sees it: its Lab under normal vision and under each dichromacy (from the painted hex). */
function views(color) {
  const text = hex(color);
  const rgb = [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16));
  const light = rgb.map(linear8);
  return [lab8(rgb), ...MACHADO.map((m) => lab8(m.map((row) => encode8(row[0] * light[0] + row[1] * light[1] + row[2] * light[2]))))];
}
/** Certify's role-A distance: CIEDE2000, the smallest over normal vision and the three dichromacies. */
export function distinctness(a, b) {
  const [x, y] = [views(a), views(b)];
  return Math.min(...x.map((view, i) => deltaE2000(view, y[i])));
}
const slotName = (i) => `viz.scale.categorical.0${i + 1}`;

/** The six series colours for one mode, and every move the grading made. */
function categoricalPalette(recipe, mode, canvas, adjustments) {
  const toward = mode === 'dark' ? 1 : -1;
  const steps = CATEGORICAL_OFFSETS.map((offset) => hueScale(recipe.accentHue + offset, mode)[8]);
  const onCanvas = (color) => contrast(color, canvas) >= NON_TEXT;
  const start = steps.map((color, i) => solve(color, onCanvas, toward, [], slotName(i)));
  // Candidates for the five after the accent: their own hue and chroma at each lightness step that keeps 3:1, nearest first.
  const candidates = start.map((color, i) => {
    if (i === 0) return [{ color, cost: 0, seen: views(color) }];
    const found = [];
    for (let j = -50; j <= 50; j += 1) {
      const next = gamut(color.l + j * CHART_LIGHTNESS.step, steps[i].c, steps[i].h);
      if (next.l < CHART_LIGHTNESS.min || next.l > CHART_LIGHTNESS.max || next.c < CHART_CHROMA_FLOOR || !onCanvas(next)) continue;
      found.push({ color: next, cost: (next.l - color.l) ** 2, lift: j, seen: views(next) });
    }
    return found.sort((p, q) => p.cost - q.cost || p.lift - q.lift);
  });
  const apart = (p, q) => Math.min(...p.seen.map((view, i) => deltaE2000(view, q.seen[i])));
  let best = { min: -Infinity, cost: Infinity, pick: candidates.map(() => 0) };
  const pick = [0];
  // Depth-first over the slots, cheapest first: keep the least-cost palette with every pair ≥ DISTINCT, else the one with
  // the largest smallest pair. Strict comparisons keep the first found on a tie, so the result is deterministic.
  const visit = (slot, min, cost) => {
    if (slot === candidates.length) {
      const better = min >= DISTINCT ? best.min < DISTINCT || cost < best.cost : best.min < DISTINCT && (min > best.min || (min === best.min && cost < best.cost));
      if (better) best = { min, cost, pick: pick.slice() };
      return;
    }
    for (let i = 0; i < candidates[slot].length; i += 1) {
      const spent = cost + candidates[slot][i].cost;
      if (best.min >= DISTINCT && spent >= best.cost) continue;
      const floor = best.min >= DISTINCT ? DISTINCT : best.min;
      let smallest = min;
      for (let j = 0; j < slot && smallest >= floor; j += 1) smallest = Math.min(smallest, apart(candidates[j][pick[j]], candidates[slot][i]));
      if (best.min >= DISTINCT ? smallest < DISTINCT : smallest <= best.min) continue;
      pick[slot] = i;
      visit(slot + 1, smallest, spent);
    }
  };
  visit(1, Infinity, 0);
  const colors = best.pick.map((i, slot) => candidates[slot][i].color);
  colors.forEach((color, i) => {
    if (css(color) === css(steps[i])) return;
    const reasons = [];
    if (css(start[i]) !== css(steps[i])) reasons.push('3:1 on the canvas');
    if (css(color) !== css(start[i])) reasons.push(best.min >= DISTINCT ? 'CIEDE2000 12 from every other series, in every vision' : `the farthest apart the series reach (CIEDE2000 ${best.min.toFixed(2)})`);
    adjustments.push({ role: slotName(i), from: css(steps[i]), to: css(color), fromHex: hex(steps[i]), toHex: hex(color), reason: reasons.join('; ') });
  });
  return { colors, distinctness: Number(best.min.toFixed(4)) };
}

/**
 * One theme's chart colours for a recipe (mode 'light', 'dark' or 'hc'), keyed by their path under `viz`, with every
 * move the chart grading made and the smallest CIEDE2000 between two series. Values are OKLCH objects, or a system
 * colour name in hc.
 */
export function vizPalette(recipe, mode) {
  const problems = recipeProblems(recipe);
  if (problems.length > 0) throw new Error(`recipe: ${problems.map(([, message]) => message).join('; ')}`);
  const tokens = {};
  if (mode === 'hc') {
    tokens['mark.single'] = 'CanvasText';
    for (let i = 0; i < 6; i += 1) tokens[`scale.categorical.0${i + 1}`] = 'CanvasText';
    SEQUENTIAL_LIGHTNESS.light.forEach((l, i) => { tokens[`scale.sequential.0${i + 1}`] = gamut(l, 0, HC_GREY_HUES.sequential); });
    DIVERGING_LIGHTNESS.light.steps.forEach((l, i) => {
      tokens[`scale.diverging.neg-0${i + 1}`] = gamut(l, 0, HC_GREY_HUES.negative);
      tokens[`scale.diverging.pos-0${i + 1}`] = gamut(l, 0, HC_GREY_HUES.positive);
    });
    tokens['scale.diverging.neutral'] = gamut(DIVERGING_LIGHTNESS.light.neutral, 0, HC_GREY_HUES.neutral);
    return { tokens, adjustments: [], distinctness: null };
  }
  if (!MODES.includes(mode)) throw new Error(`vizPalette: mode must be light, dark or hc, not ${mode}`);
  const adjustments = [];
  const N = neutralScale(recipe.neutralHue, recipe.neutralChroma, mode);
  const accent = hueScale(recipe.accentHue, mode)[8];
  const critical = { ...DEFAULT_STATUS.critical, ...(recipe.status?.critical ?? {}) };
  const red = hueScale(critical.hue, mode, critical.chroma ?? 1)[8];
  const { colors, distinctness: apart } = categoricalPalette(recipe, mode, N[0], adjustments);
  tokens['mark.single'] = colors[0];
  colors.forEach((color, i) => { tokens[`scale.categorical.0${i + 1}`] = color; });
  const tone = (l) => Math.sin(Math.PI * l) ** 1.3;
  SEQUENTIAL_LIGHTNESS[mode].forEach((l, i) => {
    tokens[`scale.sequential.0${i + 1}`] = gamut(l, accent.c * tone(l) * (mode === 'dark' ? 0.8 : 1), accent.h);
  });
  const { neutral, steps } = DIVERGING_LIGHTNESS[mode];
  const peak = Math.min(accent.c, red.c);
  steps.forEach((l, i) => {
    // Both wings take the smaller in-gamut chroma, so they stay symmetric in lightness and chroma.
    const chroma = Math.min(...[accent.h, red.h].map((h) => gamut(l, peak * tone(l), h).c));
    tokens[`scale.diverging.neg-0${i + 1}`] = gamut(l, chroma, accent.h);
    tokens[`scale.diverging.pos-0${i + 1}`] = gamut(l, chroma, red.h);
  });
  tokens['scale.diverging.neutral'] = gamut(neutral, recipe.neutralChroma * NEUTRAL_CHROMA[mode][7], recipe.neutralHue);
  return { tokens, adjustments, distinctness: apart };
}

/* ───────────────────────────────── documents ──────────────────────────────── */

const SYSTEM = /^(Canvas|CanvasText|Highlight|HighlightText|GrayText|LinkText|ButtonFace|ButtonText)$/;
const SOURCE = 'generated from the brand recipe by @oods/tokens recipe.mjs';

/** What a role promises, stated in its description where the brand contrast rules grade it (light and dark only). */
const CLAIMS = Object.freeze({
  'text.onInteractive': ' Foreground contrast ≥4.5:1 on its default interactive surface.',
  'focus.ring.outer': ' At least 3:1 on the canvas, the raised panel and the primary fill.',
  'border.interactive': ' At least 3:1 on the canvas and the raised panel.',
});

function colorLeaf(value, name) {
  const system = typeof value === 'string';
  const role = name.replace(/^color\.brand\.[^.]+\./, '');
  return {
    $type: 'color',
    $value: system ? value : css(value),
    $description: `${name}; ${SOURCE}.${system ? '' : CLAIMS[role] ?? ''}`,
    ...(!system ? { $extensions: { ods: { fallback: hex(value) } } } : {}),
  };
}

function put(tree, key, leaf) {
  const segments = key.split('.');
  let node = tree;
  for (const segment of segments.slice(0, -1)) node = (node[segment] ??= {});
  node[segments.at(-1)] = leaf;
}

/**
 * High contrast (ruling 6): the primary action is Highlight on HighlightText; every other surface is Canvas and its
 * text CanvasText, with a 1px CanvasText border, so the intents stay apart. Accent text is LinkText, disabled text
 * GrayText. The focus ring stays CanvasText: without forced colours macOS paints Highlight as rgba(128,188,254,.6),
 * 1.5:1 on Canvas, which ruling 7's 3:1 refuses (brand-template.cjs holds the measured values).
 */
export function hcColor(role) {
  if (role.startsWith('surface.interactive.primary.')) return 'Highlight';
  if (role === 'surface.inverse') return 'CanvasText';
  if (role.startsWith('surface.')) return 'Canvas';
  if (role === 'text.onInteractive') return 'HighlightText';
  if (role === 'text.inverse') return 'Canvas';
  if (role === 'text.accent') return 'LinkText';
  if (role === 'text.disabled') return 'GrayText';
  if (role === 'focus.ring.inner' || role === 'accent.background') return 'Canvas';
  if (role.startsWith('status.') && (role.endsWith('.surface') || role.endsWith('.solid'))) return 'Canvas';
  return 'CanvasText';
}

/** Radius and font leaves, which every theme of a brand shares; they live in the brand's base file. */
function shapeTrees(id, recipe) {
  const radius = {};
  const font = {};
  for (const [role, px] of Object.entries(brandRadius(recipe))) {
    put(radius, `radius.brand.${id}.${role}`, { $type: 'dimension', $value: `${px}px`, $description: `radius.${role}; ${SOURCE}.` });
  }
  for (const [role, stack] of Object.entries(brandFont(recipe))) {
    put(font, `font.brand.${id}.${role}`, { $type: 'fontFamily', $value: stack, $description: `font.${role}; ${SOURCE}.` });
  }
  return { ...radius, ...font };
}

/** One theme's chart tokens (theme 'base' or 'light', 'dark', 'hc') as the tree a brand file holds under `viz`. */
export function vizTree(recipe, theme) {
  const tree = {};
  for (const [key, value] of Object.entries(vizPalette(recipe, theme === 'base' ? 'light' : theme).tokens)) put(tree, key, colorLeaf(value, `viz.${key}`));
  return tree;
}

/**
 * The three brand files for a recipe, as the brands folder holds them (brands/<id>/{base,dark,hc}.json): colour roles,
 * the radius and font (base), and (s222-m02) the chart colours of each theme under `viz`.
 */
export function brandDocuments(id, recipe) {
  const documents = {};
  const report = { adjustments: {} };
  for (const theme of ['base', 'dark', 'hc']) {
    const mode = theme === 'dark' ? 'dark' : 'light';
    const { roles, adjustments } = brandColorRoles(recipe, mode);
    if (theme !== 'hc') report.adjustments[mode] = [...adjustments, ...vizPalette(recipe, mode).adjustments];
    const brand = {};
    for (const [role, value] of Object.entries(roles)) {
      put(brand, role, colorLeaf(theme === 'hc' ? hcColor(role) : value, `color.brand.${id}.${role}`));
    }
    documents[theme] = {
      $schema: 'https://design-tokens.org/dtcg/schema.json',
      color: { brand: { [id]: brand } },
      ...(theme === 'base' ? shapeTrees(id, recipe) : {}),
      viz: vizTree(recipe, theme),
    };
  }
  return { documents, report };
}

/** Every role (and, s222-m02, every chart series) that a contrast or chart rule moved off its step, for the delta report. */
export function explain(recipe) {
  return Object.fromEntries(MODES.map((mode) => [mode, [...brandColorRoles(recipe, mode).adjustments, ...vizPalette(recipe, mode).adjustments]]));
}

export { SYSTEM as SYSTEM_COLOR_PATTERN };
