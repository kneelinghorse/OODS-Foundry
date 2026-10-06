/** Preserve generated SVG bytes while admitting only passive, local SVG markup. */
export function assertStaticSvg(svg: string): string {
  const allowed = new Set(['svg', 'g', 'path', 'rect', 'text', 'tspan', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'defs', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc', 'pattern', 'mask', 'use']);
  function unsafe(): never { throw new Error('Expected a self-contained static SVG without scripts or external references.'); }
  // ECharts SSR carries local hover paints in CDATA and font declarations on
  // text. Validate that bounded grammar without changing the renderer's bytes.
  const paint = /^(?:#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|Canvas|CanvasText|Highlight|HighlightText|none|transparent)$/i;
  const markup = svg.replace(/<style\s*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/style>/g, (_, css: string) => {
    let remaining = css.trim();
    while (remaining) {
      const rule = /^\.oods-zr-(?:[a-zA-Z][\w-]*-)?\d+:hover\s*\{([^{}]*)\}/.exec(remaining);
      if (!rule) unsafe();
      const declarations = rule[1]!.split(';').map(value => value.trim()).filter(Boolean);
      if (!declarations.length) unsafe();
      for (const declaration of declarations) {
        const [name, value, extra] = declaration.split(':').map(part => part.trim());
        if (extra !== undefined || !value || !(
          (name === 'cursor' && value === 'pointer')
          || (name === 'pointer-events' && value === 'none')
          || (name === 'stroke-width' && /^\d+(?:\.\d+)?$/.test(value))
          || ((name === 'fill' || name === 'stroke') && paint.test(value))
        )) unsafe();
      }
      remaining = remaining.slice(rule[0].length).trim();
    }
    return '';
  });
  if (!/^<svg\b[^>]*>[\s\S]*<\/svg>\s*$/.test(markup) || /<!|<\?/i.test(markup)) unsafe();
  const decode = (value: string): string => value.replace(/&([^;]+);/g, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (named[entity]) return named[entity]!;
    if (/^#(?:x[0-9a-f]+|[0-9]+)$/i.test(entity)) {
      const code = entity[1]!.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
    }
    return unsafe();
  });
  let end = 0;
  for (const match of markup.matchAll(/<\/?([\w:-]+)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g)) {
    if (markup.slice(end, match.index).includes('<') || !allowed.has(match[1]!.toLowerCase())) unsafe();
    end = match.index! + match[0].length;
    const attributes = match[2]!.replace(/\/\s*$/, '');
    const attribute = /\s+([\w:-]+)\s*=\s*("[^"]*"|'[^']*')/y;
    let offset = 0;
    while (offset < attributes.trimEnd().length) {
      attribute.lastIndex = offset;
      const found = attribute.exec(attributes);
      if (!found) unsafe();
      offset = attribute.lastIndex;
      const name = found[1]!.toLowerCase();
      const value = decode(found[2]!.slice(1, -1));
      if (/(^|:)on/.test(name) || name === 'xml:base') unsafe();
      if (name === 'style') {
        if (!['text', 'tspan'].includes(match[1]!.toLowerCase())) unsafe();
        const declarations = value.split(';').map(part => part.trim()).filter(Boolean);
        if (!declarations.length || declarations.some(part => !/^(?:font-size:\d+(?:\.\d+)?px|font-family:(?:sans-serif|serif|monospace)|font-weight:(?:normal|bold|[1-9]00))$/.test(part))) unsafe();
      }
      if (/(^|:)href$/.test(name) && !/^#[\w:.-]+$/.test(value)) unsafe();
      if (['fill', 'stroke', 'filter', 'clip-path', 'mask', 'cursor'].includes(name) && /\\/.test(value)) unsafe();
      for (const url of value.matchAll(/url\s*\(([^)]*)\)/gi)) {
        if (!/^["']?#[\w:.-]+["']?$/.test(url[1]!.trim())) unsafe();
      }
    }
  }
  if (markup.slice(end).includes('<')) unsafe();
  return svg;
}

/**
 * True when the SVG already paints its title, so a wrapper must not repeat it as
 * visible text: Vega marks the title group with role-title-text; ECharts paints
 * the title as a text element whose whole content is the title.
 */
export function svgCarriesTitle(svg: string, title: string | undefined): boolean {
  if (!title) return false;
  if (svg.includes('role-title-text')) return true;
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  for (const match of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const content = match[1]!.replace(/<\/?tspan\b[^>]*>/g, '').trim();
    if (content === title || content === escaped) return true;
  }
  return false;
}

/** s222-m02 (#2502 ruling 12, F7): the props that carry a placed chart's dark and high-contrast renders. */
export const VIZ_THEME_SVG_PROPS = Object.freeze(['svgDark', 'svgDarkNarrow', 'svgDarkWide', 'svgHc', 'svgHcNarrow', 'svgHcWide'] as const);
export type VizThemeSvgProp = (typeof VIZ_THEME_SVG_PROPS)[number];
/** Every render prop a placed chart carries: the light (or only) renders, then the dark and hc ones. */
export const VIZ_SVG_PROPS = Object.freeze(['svg', 'svgNarrow', 'svgWide', ...VIZ_THEME_SVG_PROPS] as const);
export type VizPreviewTheme = 'light' | 'dark' | 'hc';
export type VizRenderAttribute = 'data-viz-svg' | 'data-viz-svg-narrow' | 'data-viz-svg-wide';

/** One set of a chart's renders: the design size, then the narrow and wide sizes when present. */
export interface VizPreviewLayer {
  /** The theme the renders are drawn in; absent for a chart with no dark or hc renders, whose renders show in every theme. */
  readonly theme?: VizPreviewTheme;
  readonly narrow: boolean;
  readonly wide: boolean;
  /** Each render's wrapper attribute and its checked SVG, in document order. */
  readonly renders: ReadonlyArray<readonly [VizRenderAttribute, string]>;
}

/**
 * The renders a chart preview lays out, which React, Vue and the HTML renderer all read, so the three render one markup.
 * Without a dark or hc render it is the one unthemed layer the figure has always shown (svg, svgNarrow, svgWide). With
 * them, a layer per theme (light is svg*), each wrapped in [data-viz-theme]; component-styles shows the one matching the
 * nearest [data-theme], and each wrapper repeats the figure's data-viz-narrow and data-viz-wide so the size rules apply
 * inside it. Every SVG passes assertStaticSvg.
 */
export function vizPreviewLayers(props: Readonly<Partial<Record<'svg' | 'svgNarrow' | 'svgWide' | VizThemeSvgProp, unknown>>>): VizPreviewLayer[] {
  if (typeof props.svg !== 'string') return [];
  const sets: ReadonlyArray<readonly [VizPreviewTheme, unknown, unknown, unknown]> = [
    ['light', props.svg, props.svgNarrow, props.svgWide],
    ['dark', props.svgDark, props.svgDarkNarrow, props.svgDarkWide],
    ['hc', props.svgHc, props.svgHcNarrow, props.svgHcWide],
  ];
  const themed = VIZ_THEME_SVG_PROPS.some((key) => typeof props[key] === 'string');
  return (themed ? sets : sets.slice(0, 1)).filter(([, design]) => typeof design === 'string').map(([theme, design, narrow, wide]) => ({
    ...(themed ? { theme } : {}),
    narrow: typeof narrow === 'string',
    wide: typeof wide === 'string',
    renders: [
      ['data-viz-svg', assertStaticSvg(design as string)] as const,
      ...(typeof narrow === 'string' ? [['data-viz-svg-narrow', assertStaticSvg(narrow)] as const] : []),
      ...(typeof wide === 'string' ? [['data-viz-svg-wide', assertStaticSvg(wide)] as const] : []),
    ],
  }));
}
