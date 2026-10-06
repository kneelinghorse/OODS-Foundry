// Treemap ECharts adapter (sprint-111 m01 port from
// src/viz/adapters/echarts/treemap-adapter.ts). Pure TS, spec+data DECOUPLED:
// the hierarchy data arrives as the SEPARATE `input` param, NOT through the IR.
// Echarts is a TYPE-only import (erased at build). The ~70-LOC token-resolution
// block that used to live here is now shared via ./token-resolver.

import type { EChartsOption, TreemapSeriesOption } from 'echarts';

import type { HierarchyInput } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';
import { applyHcEchartsChrome, resolveOodsEchartsChrome, type OodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';
import { getVizScaleTokens } from '../../tokens/scale-token-mapper.js';

import { convertToEChartsTreeData, generateHierarchyTooltip } from './hierarchy-utils.js';
import { resolveTokenToColor, type TokenScope } from './token-resolver.js';
import { paintedTitle } from '../../spec/title-placement.js';

const TREEMAP_SQUARE_RATIO = 1.618;

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
];

// Chrome (borders, labels, surfaces, background, title) now comes from the shared OODS
// resolver — resolveOodsEchartsChrome (sprint-145 m02). The raw-hex UI consts
// (#e0e0e0/#666666/#333333/#1a1a1a/#ffffff) were replaced by token-resolved values;
// SERIES colours (FALLBACK_PALETTE / itemStyle.color) are untouched (chrome-only
// guardrail, memo §3).

interface InteractionFlags {
  readonly drilldown: boolean;
  readonly zoom: boolean;
  readonly breadcrumb: boolean;
}

export function adaptTreemapToECharts(spec: NormalizedVizSpec, input: HierarchyInput, scope: TokenScope = {}): EChartsOption {
  const data = convertToEChartsTreeData(input);
  const palette = buildPalette(scope);
  const chrome = resolveOodsEchartsChrome(spec, scope);
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
      // Breadcrumb sits ON the canvas: fill + border are chrome surfaces, text is
      // on-canvas (text-primary, graded).
      itemStyle: {
        color: chrome.surfaceFill,
        borderColor: chrome.tileBorder,
        textStyle: { color: chrome.labelOnCanvas },
      },
      emphasis: { itemStyle: { color: chrome.surfaceFill, borderColor: chrome.tileBorder, textStyle: { color: chrome.labelOnCanvas } } },
      textStyle: { color: chrome.labelOnCanvas },
    },
    // Node + header labels sit ON the coloured tile → the legibility mechanism (§5), not
    // a fixed colour (the §4 sweep proved none is legible on all 6 hues).
    label: {
      show: true,
      formatter: '{b}',
      ...chrome.onTileLabelMechanism,
    },
    upperLabel: {
      show: true,
      height: 28,
      ...chrome.onTileLabelMechanism,
    },
    itemStyle: {
      borderColor: chrome.tileBorder,
      borderWidth: 1,
      gapWidth: 1,
    },
    levels: buildTreemapLevels(scope.theme === 'hc' ? chrome.background : chrome.tileBorder, scope.theme === 'hc'),
    emphasis: {
      focus: 'ancestor',
      itemStyle: {
        borderColor: chrome.emphasisBorder,
        borderWidth: 2,
        shadowBlur: 2,
        shadowColor: scope.theme === 'hc' ? chrome.background : 'rgba(0, 0, 0, 0.05)',
      },
    },
  }) as TreemapSeriesOption;

  return applyHcEchartsChrome(pruneUndefined({
    backgroundColor: chrome.background,
    color: palette,
    series: [series],
    tooltip: generateHierarchyTooltip(spec, 'treemap'),
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
  const tokens = getVizScaleTokens('categorical', { count: 8 });
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

function buildTreemapLevels(borderColor: OodsEchartsChrome['tileBorder'], hc = false): TreemapSeriesOption['levels'] {
  return [
    {
      // Prevent native level-0 palette interpolation; nodes carry their own literals.
      ...(hc ? { color: [] } : {}),
      itemStyle: { borderWidth: 0, gapWidth: 4 },
      upperLabel: { show: false },
    },
    {
      itemStyle: { borderWidth: 2, gapWidth: 2, borderColor },
    },
    {
      itemStyle: { borderWidth: 1, gapWidth: 1, borderColor },
    },
  ];
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
