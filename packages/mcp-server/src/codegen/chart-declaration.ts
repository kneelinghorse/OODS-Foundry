import type { UiElement } from '../schemas/generated.js';

const previewTypes: Readonly<Record<string, string>> = {
  VizAreaPreview: 'area',
  VizMarkPreview: 'bar',
  VizLinePreview: 'line',
  VizGraphPreview: 'force_graph',
  VizPointPreview: 'scatter',
  VizScatterPreview: 'scatter',
  VizHeatmapPreview: 'heatmap',
};

export function isChartPreview(component: string): boolean {
  return Object.hasOwn(previewTypes, component);
}

export function chartMatchesPreview(node: UiElement): boolean {
  return isChartPreview(node.component) && previewTypes[node.component] === node.chart?.chartType;
}

export function chartNodes(nodes: UiElement[]): UiElement[] {
  return nodes.flatMap(node => [...(node.chart ? [node] : []), ...chartNodes(node.children ?? [])]);
}
