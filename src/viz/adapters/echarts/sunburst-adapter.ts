import type { EChartsOption, SunburstSeriesOption } from 'echarts';

import tokensBundle from '@oods/tokens';

import type { HierarchyInput } from '@/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import { getVizScaleTokens } from '@/viz/tokens/scale-token-mapper.js';

import { convertToEChartsTreeData, generateHierarchyTooltip } from './hierarchy-utils.js';

const START_ANGLE = 90;

// ECharts needs resolved colors, not CSS variables (canvas renderer can't use CSS cascade)
// Token resolution map from @oods/tokens bundle
const CSS_VARIABLE_MAP: Record<string, string> =
  (tokensBundle?.cssVariables as Record<string, string>) ?? {};

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

// UI token fallbacks (for borders, labels - these work in SVG but not canvas fill)
const BORDER_COLOR = '#e0e0e0';
const EMPHASIS_BORDER_COLOR = '#666666';
const LABEL_COLOR = '#333333';
const SURFACE_COLOR = '#ffffff';

export function adaptSunburstToECharts(spec: NormalizedVizSpec, input: HierarchyInput): EChartsOption {
  const data = convertToEChartsTreeData(input);
  const palette = buildPalette();
  const dimensions = resolveDimensions(spec);

  const series = pruneUndefined({
    type: 'sunburst' as const,
    name: spec.name ?? 'Sunburst',
    data: assignColorsToData(data, palette),
    radius: ['0%', '90%'],
    startAngle: START_ANGLE,
    sort: 'desc',
    emphasis: {
      focus: 'ancestor',
      itemStyle: {
        borderColor: EMPHASIS_BORDER_COLOR,
        borderWidth: 3,
        shadowBlur: 10,
      },
    },
    label: {
      rotate: 'radial',
      color: LABEL_COLOR,
    },
    itemStyle: {
      borderRadius: 4,
      borderWidth: 2,
      borderColor: SURFACE_COLOR,
    },
    levels: buildSunburstLevels(),
    width: dimensions.width,
    height: dimensions.height,
  }) as SunburstSeriesOption;

  return pruneUndefined({
    color: palette,
    series: [series],
    tooltip: generateHierarchyTooltip(spec, 'sunburst'),
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
  const tokens = getVizScaleTokens('categorical', { count: 9 });
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

function buildSunburstLevels(): SunburstSeriesOption['levels'] {
  return [
    {},
    {
      r0: '12%',
      r: '32%',
      label: { rotate: 'tangential' },
      itemStyle: { borderWidth: 1, borderColor: BORDER_COLOR },
    },
    {
      r0: '32%',
      r: '68%',
      label: { align: 'right' },
      itemStyle: { borderWidth: 1, borderColor: BORDER_COLOR },
    },
    {
      r0: '68%',
      r: '72%',
      label: { show: false },
      itemStyle: { borderWidth: 2, borderColor: BORDER_COLOR },
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
