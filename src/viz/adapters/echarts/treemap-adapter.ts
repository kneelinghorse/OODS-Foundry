import type { EChartsOption, TreemapSeriesOption } from 'echarts';

import tokensBundle from '@oods/tokens';

import type { HierarchyInput } from '@/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import { getVizScaleTokens } from '@/viz/tokens/scale-token-mapper.js';

import { convertToEChartsTreeData, generateHierarchyTooltip } from './hierarchy-utils.js';

const TREEMAP_SQUARE_RATIO = 1.618;

// ECharts needs resolved colors, not CSS variables (canvas renderer can't use CSS cascade)
// Token resolution map from @oods/tokens bundle
const CSS_VARIABLE_MAP: Record<string, string> =
  (tokensBundle?.cssVariables as Record<string, string>) ?? {};

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
];

// UI token fallbacks (for borders, labels - these work in SVG but not canvas fill)
const BORDER_COLOR = '#e0e0e0';
const EMPHASIS_BORDER_COLOR = '#666666';
const LABEL_COLOR = '#333333';
const HEADER_COLOR = '#1a1a1a';
const SURFACE_COLOR = '#ffffff';

interface InteractionFlags {
  readonly drilldown: boolean;
  readonly zoom: boolean;
  readonly breadcrumb: boolean;
}

export function adaptTreemapToECharts(spec: NormalizedVizSpec, input: HierarchyInput): EChartsOption {
  const data = convertToEChartsTreeData(input);
  const palette = buildPalette();
  const dimensions = resolveDimensions(spec);
  const interactions = extractInteractionFlags(spec);

  const series = pruneUndefined({
    type: 'treemap' as const,
    name: spec.name ?? 'Treemap',
    data: assignColorsToData(data, palette),
    width: dimensions.width,
    height: dimensions.height,
    squareRatio: TREEMAP_SQUARE_RATIO,
    roam: interactions.zoom,
    nodeClick: interactions.drilldown ? 'zoomToNode' : false,
    breadcrumb: {
      show: interactions.breadcrumb,
      itemStyle: {
        color: SURFACE_COLOR,
        borderColor: BORDER_COLOR,
      },
      textStyle: { color: LABEL_COLOR },
    },
    label: {
      show: true,
      formatter: '{b}',
      color: LABEL_COLOR,
    },
    upperLabel: {
      show: true,
      height: 28,
      color: HEADER_COLOR,
    },
    itemStyle: {
      borderColor: BORDER_COLOR,
      borderWidth: 1,
      gapWidth: 1,
    },
    levels: buildTreemapLevels(),
    emphasis: {
      focus: 'ancestor',
      itemStyle: {
        borderColor: EMPHASIS_BORDER_COLOR,
        borderWidth: 2,
        shadowBlur: 2,
        shadowColor: 'rgba(0, 0, 0, 0.05)',
      },
    },
  }) as TreemapSeriesOption;

  return pruneUndefined({
    color: palette,
    series: [series],
    tooltip: generateHierarchyTooltip(spec, 'treemap'),
    aria: { enabled: true, description: spec.a11y?.description },
    title: spec.name ? { text: spec.name } : undefined,
    usermeta: {
      oods: pruneUndefined({
        specId: spec.id,
        name: spec.name,
        theme: spec.config?.theme,
        tokens: spec.config?.tokens,
        layout: spec.config?.layout,
        a11y: spec.a11y,
      }),
    },
  }) as unknown as EChartsOption;
}

function buildPalette(): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 8 });
  const resolved = tokens.map(resolveTokenToColor);

  // If no tokens resolved, use fallback palette
  if (resolved.every((c) => c === undefined)) {
    return FALLBACK_PALETTE;
  }

  return resolved.map((color, i) => color ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]);
}

/**
 * Assign colors from palette to the first visible level of data nodes.
 * For hierarchical data with a single root, colors go on the root's children.
 * For multiple roots, colors go on each root.
 * ECharts inherits colors down the hierarchy from these nodes.
 */
function assignColorsToData(
  data: Record<string, unknown>[],
  palette: readonly string[]
): Record<string, unknown>[] {
  // If we have a single root with children, color the children
  if (data.length === 1 && Array.isArray(data[0].children) && (data[0].children as unknown[]).length > 0) {
    const root = data[0];
    const coloredChildren = (root.children as Record<string, unknown>[]).map((child, index) => ({
      ...child,
      itemStyle: {
        ...(child.itemStyle as Record<string, unknown> | undefined),
        color: palette[index % palette.length],
      },
    }));
    return [{ ...root, children: coloredChildren }];
  }

  // Multiple roots or flat data - color each top-level node
  return data.map((node, index) => ({
    ...node,
    itemStyle: {
      ...(node.itemStyle as Record<string, unknown> | undefined),
      color: palette[index % palette.length],
    },
  }));
}

function resolveDimensions(spec: NormalizedVizSpec): { width?: number; height?: number } {
  const layout = spec.config?.layout;
  return {
    width: typeof layout?.width === 'number' ? layout.width : undefined,
    height: typeof layout?.height === 'number' ? layout.height : undefined,
  };
}

function extractInteractionFlags(spec: NormalizedVizSpec): InteractionFlags {
  const inline = (spec as { interaction?: { drilldown?: boolean; zoom?: boolean; breadcrumb?: boolean } }).interaction ?? {};
  const interactions = spec.interactions ?? [];
  const hasZoomInteraction = interactions.some(
    (interaction) => (interaction.rule as { bindTo?: string } | undefined)?.bindTo === 'zoom'
  );

  return {
    drilldown: inline.drilldown ?? true,
    zoom: inline.zoom ?? hasZoomInteraction ?? false,
    breadcrumb: inline.breadcrumb ?? true,
  };
}

function buildTreemapLevels(): TreemapSeriesOption['levels'] {
  return [
    {
      itemStyle: { borderWidth: 0, gapWidth: 4 },
      upperLabel: { show: false },
    },
    {
      itemStyle: { borderWidth: 2, gapWidth: 2, borderColor: BORDER_COLOR },
    },
    {
      itemStyle: { borderWidth: 1, gapWidth: 1, borderColor: BORDER_COLOR },
    },
  ];
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

// ============================================================================
// Token Resolution Utilities (ECharts canvas needs actual colors, not CSS vars)
// ============================================================================

function resolveTokenToColor(token: string): string | undefined {
  const normalized = normalizeTokenName(token);
  const value = lookupTokenValue(normalized);
  if (value) {
    return formatColorValue(value);
  }
  // Try with --oods- prefix fallback
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  if (!prefixed) {
    return undefined;
  }
  const fallback = lookupTokenValue(prefixed);
  return fallback ? formatColorValue(fallback) : undefined;
}

function normalizeTokenName(name: string): string {
  return name.startsWith('--') ? name : `--${name}`;
}

function lookupTokenValue(name: string): string | undefined {
  return CSS_VARIABLE_MAP[name];
}

function formatColorValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(trimmed) ?? trimmed;
  }
  return trimmed;
}

function convertOklchToRgb(input: string): string | undefined {
  const match = input
    .replace(/deg/gi, '')
    .replace(/\s+/g, ' ')
    .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);

  if (!match) return undefined;

  const [, lRaw, cRaw, hRaw] = match;
  const l = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const c = parseFloat(cRaw);
  const h = parseFloat(hRaw);

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
    return undefined;
  }

  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;

  const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
  const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
  const s1 = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l1 ** 3;
  const m3 = m1 ** 3;
  const s3 = s1 ** 3;

  const linearToSrgb = (v: number): number => {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const clamp = (ch: number): number => Math.round(Math.min(255, Math.max(0, ch * 255)));

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return `rgb(${clamp(linearToSrgb(rLinear))}, ${clamp(linearToSrgb(gLinear))}, ${clamp(linearToSrgb(bLinear))})`;
}
