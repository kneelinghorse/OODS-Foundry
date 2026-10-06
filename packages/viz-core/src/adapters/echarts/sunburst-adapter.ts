// Sunburst ECharts adapter (sprint-111 m03 port from
// src/viz/adapters/echarts/sunburst-adapter.ts). Pure TS, spec+data DECOUPLED:
// the hierarchy data arrives as the SEPARATE `input` param, NOT through the IR.
// Reuses the already-ported hierarchy-utils (treemap shares them) and the shared
// token-resolver. Echarts is a TYPE-only import (erased at build).

import type { EChartsOption, SunburstSeriesOption } from 'echarts';

import type { HierarchyInput } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';
import { applyHcEchartsChrome, resolveOodsEchartsChrome, type OodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';
import { getVizScaleTokens } from '../../tokens/scale-token-mapper.js';

import { convertToEChartsTreeData, generateHierarchyTooltip } from './hierarchy-utils.js';
import { resolveTokenToColor, type TokenScope } from './token-resolver.js';
import { paintedTitle } from '../../spec/title-placement.js';

const START_ANGLE = 90;

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

// Chrome (borders, arc label, ring-separator, background, title) now comes from the
// shared OODS resolver — resolveOodsEchartsChrome (sprint-145 m02). The raw-hex UI
// consts were replaced by token-resolved values; SERIES colours are untouched
// (chrome-only guardrail, memo §3).

export function adaptSunburstToECharts(spec: NormalizedVizSpec, input: HierarchyInput, scope: TokenScope = {}): EChartsOption {
  const data = convertToEChartsTreeData(input);
  const palette = buildPalette(scope);
  const chrome = resolveOodsEchartsChrome(spec, scope);
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
        borderColor: chrome.emphasisBorder,
        borderWidth: 3,
        shadowBlur: 10,
      },
    },
    // Arc labels sit ON the coloured arc → the legibility mechanism (§5).
    label: {
      rotate: 'radial',
      ...chrome.onTileLabelMechanism,
    },
    // The series border is the ring SEPARATOR (by-usage → surface-canvas), not a tile
    // separator — same const name as treemap's fill, different role (memo §2).
    itemStyle: {
      borderRadius: 4,
      borderWidth: 2,
      borderColor: chrome.surfaceFill,
    },
    levels: buildSunburstLevels(scope.theme === 'hc' ? chrome.background : chrome.tileBorder),
    width: dimensions.width,
    height: dimensions.height,
  }) as SunburstSeriesOption;

  return applyHcEchartsChrome(pruneUndefined({
    backgroundColor: chrome.background,
    color: palette,
    series: [series],
    tooltip: generateHierarchyTooltip(spec, 'sunburst'),
    aria: { enabled: true, description: spec.a11y?.description },
    title: paintedTitle(spec) ? { text: paintedTitle(spec), textStyle: { color: chrome.title } } : undefined,
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
  }), chrome, scope) as unknown as EChartsOption;
}

function buildPalette(scope: TokenScope): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 9 });
  const resolved = tokens.map((token) => resolveTokenToColor(token, scope));

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
 * Each coloured node's descendants take its colour.
 */
function assignColorsToData(
  data: Record<string, unknown>[],
  palette: readonly string[]
): Record<string, unknown>[] {
  // If we have a single root with children, color the children
  if (data.length === 1 && Array.isArray(data[0].children) && (data[0].children as unknown[]).length > 0) {
    const root = data[0];
    const coloredChildren = (root.children as Record<string, unknown>[]).map((child, index) => withBranchColor(child, palette[index % palette.length]!));
    return [{ ...root, children: coloredChildren }];
  }

  // Multiple roots or flat data - color each top-level node
  return data.map((node, index) => withBranchColor(node, palette[index % palette.length]!));
}

/**
 * s222-m02 (#2502 ruling 12): the colour goes down the whole branch. Left to ECharts, a descendant takes the palette
 * colour of the single root's name, lifted toward white by depth, so every branch's descendants drew slot 1's tint; with
 * brand A's recipe that tint (#7E97E8) is 2.83:1 on the light canvas, under WCAG 1.4.11's 3:1, while every slot itself
 * is held to 3:1. The ring borders separate the levels.
 */
function withBranchColor(node: Record<string, unknown>, color: string): Record<string, unknown> {
  const children = Array.isArray(node.children) ? { children: (node.children as Record<string, unknown>[]).map((child) => withBranchColor(child, color)) } : {};
  return { ...node, itemStyle: { ...(node.itemStyle as Record<string, unknown> | undefined), color }, ...children };
}

function resolveDimensions(spec: NormalizedVizSpec): { width?: number; height?: number } {
  const layout = spec.config?.layout;
  return {
    width: typeof layout?.width === 'number' ? layout.width : undefined,
    height: typeof layout?.height === 'number' ? layout.height : undefined,
  };
}

function buildSunburstLevels(borderColor: OodsEchartsChrome['tileBorder']): SunburstSeriesOption['levels'] {
  return [
    {},
    {
      r0: '12%',
      r: '32%',
      label: { rotate: 'tangential' },
      itemStyle: { borderWidth: 1, borderColor },
    },
    {
      r0: '32%',
      r: '68%',
      label: { align: 'right' },
      itemStyle: { borderWidth: 1, borderColor },
    },
    {
      r0: '68%',
      r: '72%',
      label: { show: false },
      itemStyle: { borderWidth: 2, borderColor },
    },
  ];
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
