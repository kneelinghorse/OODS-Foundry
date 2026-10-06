import Color from 'colorjs.io';
import postcss from 'postcss';
import { deriveBrand, type BrandDerivation, type BrandDeriveHints } from './brand-derive.js';
import { ToolError } from '../errors/tool-error.js';

/** Read the light theme only. CSS is parsed as data: imports, plugins and declarations never execute. */
export function deriveBrandFromCss(css: string, hints: BrandDeriveHints = {}): BrandDerivation {
  let sheet: ReturnType<typeof postcss.parse>;
  try { sheet = postcss.parse(css); }
  catch (error) { throw new ToolError('OODS-V001', `Cannot read shadcn theme CSS: ${error instanceof Error ? error.message : String(error)}`, { field: 'css' }); }
  const properties = new Map<string, string>();
  sheet.walkRules(node => {
    if (node.selectors.some(selector => [':root', 'html'].includes(selector))) {
      for (const declaration of node.nodes) if (declaration.type === 'decl' && declaration.prop.startsWith('--')) properties.set(declaration.prop, declaration.value);
    }
  });
  sheet.walkAtRules('theme', node => {
    if (node.params.trim() === 'inline') {
      for (const declaration of node.nodes ?? []) if (declaration.type === 'decl' && ['--font-sans', '--font-mono'].includes(declaration.prop)) properties.set(declaration.prop, declaration.value);
    }
  });
  const chromatic = (name: string) => {
    try {
      const color = new Color(properties.get(name) ?? '');
      return Number(color.alpha) === 1 && Number(color.to('oklch').coords[1]) > 0.03;
    } catch { return false; }
  };
  // Reuse DTCG's colour, circular median, dimension and family rules; preserve the CSS names in the receipt.
  const tokens: Record<string, unknown> = { neutral: {} };
  const paths = new Map<string, string>();
  const used = new Set<string>();
  const select = (key: string, name: string, type: string, font = false) => {
    paths.set(key, name); used.add(name);
    const raw = properties.get(name);
    if (raw === undefined) return;
    const reference = font && /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw.trim());
    const value = reference ? properties.get(reference[1]) ?? raw : raw;
    if (reference) used.add(reference[1]);
    const token = { $type: type, $value: value };
    if (key.startsWith('neutral.')) (tokens.neutral as Record<string, unknown>)[key.slice(8)] = token;
    else tokens[key] = token;
  };
  const neutrals = hints.neutral ? [hints.neutral] : ['--background', '--foreground', '--card', '--muted', '--border', '--input'];
  for (const [index, name] of neutrals.entries()) select(`neutral.${index}`, name, 'color');
  const accent = hints.accent ?? (chromatic('--primary') ? '--primary' : '--ring');
  if (chromatic(accent)) select('accent', accent, 'color');
  select('radius', hints.radius ?? '--radius', 'dimension');
  select('fontSans', hints.font ?? '--font-sans', 'fontFamily', true);
  select('fontMono', hints.fontMono ?? '--font-mono', 'fontFamily', true);
  select('critical', '--destructive', 'color');
  const result = deriveBrand(tokens);
  for (const evidence of Object.values(result.provenance)) for (const source of evidence.sources) {
    const name = paths.get(source.path)!;
    source.path = name;
    source.value = properties.get(name);
  }
  for (const gap of result.gaps) gap.candidates = gap.candidates.map(candidate => paths.get(candidate) ?? candidate);
  const candidates: Record<string, string[]> = {
    accentHue: hints.accent ? [hints.accent] : ['--primary', '--ring'],
    neutralHue: neutrals, neutralChroma: neutrals,
    radius: [hints.radius ?? '--radius'], font: [hints.font ?? '--font-sans'], fontMono: [hints.fontMono ?? '--font-mono'],
  };
  for (const gap of result.gaps) if (!gap.candidates.length) gap.candidates = candidates[gap.field] ?? [];
  if (!result.recipe.fontMono && !result.gaps.some(gap => gap.field === 'fontMono')) result.gaps.push({ field: 'fontMono', reason: 'No usable --font-mono family, directly or through one var() reference.', candidates: candidates.fontMono });
  result.recipe.primary = chromatic('--primary') ? 'accent' : 'neutral';
  result.provenance.primary = {
    sources: properties.has('--primary') ? [{ path: '--primary', value: properties.get('--primary'), resolvedValue: properties.get('--primary') }] : [],
    rule: '--primary with OKLCH chroma > 0.03 selects accent; otherwise primary is neutral. No accent is invented.',
  };
  if (result.provenance.accentHue) result.provenance.accentHue.rule = `${hints.accent ? 'Explicit CSS accent hint' : 'Chromatic --primary, otherwise chromatic --ring'}; opaque OKLCH chroma > 0.03.`;
  else result.gaps.find(gap => gap.field === 'accentHue')!.reason = 'No opaque chromatic accent (OKLCH chroma > 0.03); choose an accent hue before creating a brand.';
  result.warnings = result.warnings.map(warning => {
    for (const [key, name] of paths) if (warning.startsWith(`${key}:`)) return `${name}${warning.slice(key.length)}`;
    return warning;
  });
  used.add('--primary'); used.add('--ring');
  const ignored = [...properties.keys()].filter(name => !used.has(name));
  if (ignored.length) result.warnings.push(`Ignored custom properties: ${ignored.join(', ')}. They do not define this recipe.`);
  return result;
}
