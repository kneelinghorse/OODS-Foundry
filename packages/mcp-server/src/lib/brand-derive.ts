import Color from 'colorjs.io';
import type { BrandRecipe } from '@oods/tokens/recipe';
import { ToolError } from '../errors/tool-error.js';

export type BrandDeriveHints = Partial<Record<'accent' | 'neutral' | 'radius' | 'font' | 'fontMono', string>>;
type Token = { path: string; type: string; value: unknown };
type Source = { path: string; value: unknown; resolvedValue: unknown };
export interface BrandDerivation {
  action: 'derive';
  recipe: Partial<BrandRecipe>;
  provenance: Record<string, { sources: Source[]; rule: string }>;
  gaps: Array<{ field: string; reason: string; candidates: string[] }>;
  warnings: string[];
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value: number) => Number(value.toFixed(6));
const circularMedian = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  let cut = 0, widest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const gap = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360) - sorted[i];
    if (gap > widest) { widest = gap; cut = (i + 1) % sorted.length; }
  }
  const start = sorted[cut];
  return median(sorted.map(hue => hue < start ? hue + 360 : hue)) % 360;
};

/** s228: infer only what the document supports; create remains the grading and writing boundary. */
export function deriveBrand(tokens: unknown, hints: BrandDeriveHints = {}): BrandDerivation {
  if (!object(tokens)) throw new ToolError('OODS-V001', 'derive takes a DTCG object in tokens.', { field: 'tokens' });
  const result: BrandDerivation = { action: 'derive', recipe: {}, provenance: {}, gaps: [], warnings: [] };
  const leaves: Token[] = [];
  function visit(node: Record<string, unknown>, parts: string[], inheritedType: string): void {
    const type = typeof node.$type === 'string' ? node.$type : inheritedType;
    if ('$value' in node) { leaves.push({ path: parts.join('.'), type, value: node.$value }); return; }
    for (const [key, value] of Object.entries(node)) if (!key.startsWith('$') && object(value)) visit(value, [...parts, key], type);
  }
  visit(tokens, [], '');
  const byPath = new Map(leaves.map(token => [token.path, token]));
  const resolved = new Map<string, unknown>();
  function resolve(token: Token, seen = new Set<string>()): unknown {
    if (resolved.has(token.path)) return resolved.get(token.path);
    if (seen.has(token.path)) throw new Error(`alias cycle at ${token.path}`);
    const alias = typeof token.value === 'string' && /^\{([^{}]+)\}$/.exec(token.value);
    if (!alias) return token.value;
    const target = byPath.get(alias[1]);
    if (!target) throw new Error(`alias target ${alias[1]} is missing`);
    seen.add(token.path);
    const value = resolve(target, seen);
    // A DTCG alias without an explicit or inherited type takes its target’s type.
    if (!token.type) token.type = target.type;
    return value;
  }
  for (const token of leaves) {
    try { resolved.set(token.path, resolve(token)); }
    catch (error) { result.warnings.push(`${token.path}: ${String(error instanceof Error ? error.message : error)}.`); }
  }
  function candidates(type: string, pattern: RegExp, hint?: string): Token[] {
    if (hint !== undefined) {
      const token = byPath.get(hint);
      if (!token || token.type !== type) {
        result.warnings.push(`Hint ${hint} does not name a ${type} token.`);
        return [];
      }
      return [token];
    }
    return leaves.filter(token => token.type === type && pattern.test(token.path));
  }
  function record(field: string, selected: Token[], rule: string): void {
    result.provenance[field] = { sources: selected.map(token => ({ path: token.path, value: token.value, resolvedValue: resolved.get(token.path) })), rule };
  }
  function gap(field: string, reason: string, considered: Token[], hint?: string): void {
    result.gaps.push({ field, reason, candidates: hint ? [hint] : considered.map(token => token.path) });
  }
  const colors = new Map<string, { l: number; c: number; h: number }>();
  for (const token of leaves.filter(token => token.type === 'color' && resolved.has(token.path))) {
    try {
      const value = resolved.get(token.path);
      let color: Color;
      if (typeof value === 'string') color = new Color(value);
      else if (object(value) && typeof value.colorSpace === 'string' && Array.isArray(value.components)) {
        if (value.components.length !== 3) throw new Error('a colour needs three components');
        const space = value.colorSpace === 'display-p3' ? 'p3' : value.colorSpace;
        color = new Color(space, value.components.map(component => component === 'none' ? NaN : Number(component)) as [number, number, number], typeof value.alpha === 'number' ? value.alpha : 1);
      } else throw new Error('expected a CSS colour or DTCG color value');
      if (Number(color.alpha) !== 1) throw new Error('transparent colours cannot define a brand recipe');
      // The CSS parser retains numeric metadata as boxed Number values.
      const [l, c, h] = color.to('oklch').coords.map(Number);
      if (!Number.isFinite(l) || !Number.isFinite(c) || c < 0) throw new Error('invalid OKLCH lightness or chroma');
      // A grey has no hue. Keep its chroma evidence, but never invent a hue to fill a recipe gap.
      colors.set(token.path, { l, c, h: Number.isFinite(h) ? ((h % 360) + 360) % 360 : NaN });
    } catch (error) { result.warnings.push(`${token.path}: ${error instanceof Error ? error.message : String(error)}.`); }
  }
  const neutral = candidates('color', /gray|grey|neutral|slate|zinc|stone/i, hints.neutral);
  const low = neutral.filter(token => colors.has(token.path) && colors.get(token.path)!.c <= 0.03);
  for (const [field, coordinate] of [['neutralHue', 'h'], ['neutralChroma', 'c']] as const) {
    const selected = low.filter(token => Number.isFinite(colors.get(token.path)![coordinate]));
    if (selected.length) {
      result.recipe[field] = round((coordinate === 'h' ? circularMedian : median)(selected.map(token => colors.get(token.path)![coordinate])));
      record(field, selected, `${hints.neutral ? 'Explicit neutral hint; ' : ''}${coordinate === 'h' ? 'Circular median OKLCH hue (cut at the widest gap)' : 'median OKLCH chroma'} of neutral colours with chroma ≤ 0.03.`);
    } else gap(field, `No usable low-chroma neutral ${coordinate === 'h' ? 'hue (achromatic colours have no hue)' : 'colour'}.`, neutral, hints.neutral);
  }
  function middleColor(considered: Token[]): Token | undefined {
    const usable = considered.filter(token => Number.isFinite(colors.get(token.path)?.h));
    const steps = usable.filter(token => /(?:^|\.)(500|600)(?:\.|$)/.test(token.path));
    // Stable sort keeps document order on a lightness tie.
    return (steps.length ? steps : usable).sort((a, b) => Math.abs(colors.get(a.path)!.l - 0.5) - Math.abs(colors.get(b.path)!.l - 0.5))[0];
  }
  const accents = candidates('color', /primary|accent|brand/i, hints.accent);
  const accent = middleColor(accents);
  if (accent) {
    result.recipe.accentHue = round(colors.get(accent.path)!.h);
    record('accentHue', [accent], hints.accent ? 'Explicit accent hint, read in OKLCH.' : 'Accent colour nearest OKLCH lightness 0.5, preferring a 500 or 600 step; document order breaks ties.');
  } else gap('accentHue', 'No usable accent colour with a hue.', accents, hints.accent);
  result.recipe.primary = accent ? 'accent' : 'neutral';
  record('primary', accent ? [accent] : [], accent ? 'An accent was found, so primary is accent.' : 'No accent was found, so primary is neutral; accentHue remains a gap.');

  const radii = candidates('dimension', /radius/i, hints.radius);
  const px = new Map<string, number>();
  for (const token of radii) {
    const value = resolved.get(token.path);
    const match = typeof value === 'string' ? /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem)$/i.exec(value.trim()) : null;
    const amount = match ? Number(match[1]) : object(value) && typeof value.value === 'number' ? value.value : NaN;
    const unit = match ? match[2].toLowerCase() : object(value) ? value.unit : undefined;
    if (Number.isFinite(amount) && (unit === 'px' || unit === 'rem')) px.set(token.path, amount * (unit === 'rem' ? 16 : 1));
    else result.warnings.push(`${token.path}: radius needs a finite px or rem dimension.`);
  }
  if (px.size) {
    const raw = median([...px.values()]);
    result.recipe.radius = round(Math.max(0, Math.min(16, raw)));
    if (raw < 0 || raw > 16) result.warnings.push(`Radius median ${raw}px was clamped to ${result.recipe.radius}px (recipe range 0–16).`);
    record('radius', radii.filter(token => px.has(token.path)), `${hints.radius ? 'Explicit radius hint; ' : ''}median dimension in px (rem × 16), clamped to 0–16.`);
  } else gap('radius', 'No usable radius dimension in px or rem.', radii, hints.radius);

  for (const [field, pattern] of [['font', /sans|body|base/i], ['fontMono', /mono/i]] as const) {
    const fonts = candidates('fontFamily', pattern, hints[field]);
    const token = fonts[0];
    const raw = token && resolved.get(token.path);
    const first = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw.split(',')[0] : undefined;
    const family = typeof first === 'string' ? first.trim().replace(/^(['"])(.*)\1$/, '$2') : '';
    if (/^[A-Za-z0-9][A-Za-z0-9 \-]{0,63}$/.test(family)) {
      result.recipe[field] = family;
      record(field, [token], `${hints[field] ? 'Explicit hint' : 'First matching fontFamily in document order'}; first family of a list, stripped of quotes.`);
      if (Array.isArray(raw) && raw.length > 1 || typeof raw === 'string' && raw.includes(',')) result.warnings.push(`${token.path}: only the first font family is used; the recipe generates its fallback stack.`);
    } else if (field === 'font' || token || hints[field]) gap(field, 'No usable family name (letters, digits, spaces and hyphens, at most 64 characters).', fonts, hints[field]);
  }
  for (const [status, pattern] of [['success', /success/i], ['warning', /warning/i], ['critical', /error|danger|critical/i], ['info', /info/i]] as const) {
    const selected = middleColor(candidates('color', pattern));
    if (selected) {
      (result.recipe.status ??= {})[status] = { hue: round(colors.get(selected.path)!.h) };
      record(`status.${status}.hue`, [selected], 'Status colour nearest OKLCH lightness 0.5, preferring 500 or 600; error and danger map to critical.');
    }
  }
  return result;
}
