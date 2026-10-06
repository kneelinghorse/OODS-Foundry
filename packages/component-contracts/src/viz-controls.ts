/** The Cartesian subset of viz.render's public input, without its data operand. */
export type VizChartType = 'bar' | 'line' | 'area' | 'scatter' | 'heatmap';
export type VizChannel = 'x' | 'y' | 'color' | 'size' | 'shape';
export type VizScale = 'linear' | 'temporal' | 'log' | 'sqrt' | 'band' | 'point' | 'diverging';
export interface VizFieldBinding {
  field: string;
  type?: 'quantitative' | 'temporal' | 'nominal' | 'ordinal';
  scale?: VizScale;
  title?: string;
  sort?: 'none' | 'ascending' | 'descending';
}
export interface VizColorBinding extends VizFieldBinding { range?: string[] }
export interface VizIntentFragment {
  chartType?: VizChartType;
  encodings?: { x?: VizFieldBinding; y?: VizFieldBinding; color?: VizColorBinding; size?: VizFieldBinding; shape?: VizFieldBinding };
  opacity?: number;
}
export const VIZ_CONTROL_IDS = ['VizAreaControls', 'VizAxisControls', 'VizColorControls', 'VizHeatmapControls', 'VizLineControls', 'VizMarkControls', 'VizOpacityControls', 'VizPointControls', 'VizScaleControls', 'VizScatterControls', 'VizShapeControls', 'VizSizeControls', 'VizColorLegendConfig', 'VizShapeLegend'] as const;
export type VizControlId = typeof VIZ_CONTROL_IDS[number];
export const VIZ_SUMMARY_IDS = ['VizAxisSummary', 'VizOpacitySummary', 'VizScaleSummary', 'VizSizeSummary', 'VizEncodingBadge', 'VizRoleBadge'] as const;
export type VizSummaryId = typeof VIZ_SUMMARY_IDS[number];
export const VIZ_PREVIEW_TYPES = { VizGraphPreview: 'force_graph', VizHeatmapPreview: 'heatmap', VizLinePreview: 'line', VizMarkPreview: 'bar', VizPointPreview: 'scatter', VizScatterPreview: 'scatter' } as const;
export const VIZ_CONTROL_TITLES: Record<VizControlId, string> = {
  VizAreaControls: 'Area chart', VizAxisControls: 'Axis', VizColorControls: 'Color encoding', VizHeatmapControls: 'Heatmap', VizLineControls: 'Line chart', VizMarkControls: 'Chart mark', VizOpacityControls: 'Mark opacity', VizPointControls: 'Point chart', VizScaleControls: 'Scale', VizScatterControls: 'Scatter chart', VizShapeControls: 'Shape encoding', VizSizeControls: 'Size encoding', VizColorLegendConfig: 'Color legend', VizShapeLegend: 'Shape legend',
};
export interface VizControlField { key: string; label: string; type: 'text' | 'number' | 'select' | 'colors'; options?: readonly string[]; min?: number; max?: number; step?: number }
const field = (channel: VizChannel, label: string): VizControlField => ({ key: `${channel}.field`, label, type: 'text' });
const scale = (channel: VizChannel): VizControlField => ({ key: `${channel}.scale`, label: 'Scale', type: 'select', options: ['linear', 'temporal', 'log', 'sqrt', 'band', 'point', 'diverging'] });
const opacity: VizControlField = { key: 'opacity', label: 'Opacity', type: 'select', options: ['0', '0.2', '0.4', '0.6', '0.8', '1'], min: 0, max: 1 };
const xy = [field('x', 'X field'), field('y', 'Y field')];

export function vizControlFields(id: VizControlId, channel: 'x' | 'y' = 'x'): readonly VizControlField[] {
  switch (id) {
    case 'VizAxisControls': return [field(channel, 'Axis field'), { key: `${channel}.title`, label: 'Axis title', type: 'text' }, { key: `${channel}.sort`, label: 'Sort', type: 'select', options: ['none', 'ascending', 'descending'] }];
    case 'VizScaleControls': return [field(channel, 'Scale field'), scale(channel)];
    case 'VizColorControls': case 'VizColorLegendConfig': return [field('color', 'Color field'), { key: 'color.range', label: 'Category colors', type: 'colors' }];
    case 'VizOpacityControls': return [opacity];
    case 'VizSizeControls': return [field('size', 'Size field'), scale('size')];
    case 'VizShapeControls': case 'VizShapeLegend': return [field('shape', 'Shape field')];
    case 'VizMarkControls': return [{ key: 'chartType', label: 'Chart type', type: 'select', options: ['bar', 'line', 'area', 'scatter', 'heatmap'] }, ...xy];
    case 'VizPointControls': return [...xy, field('shape', 'Shape field')];
    case 'VizScatterControls': return [...xy, field('size', 'Size field')];
    case 'VizLineControls': return [...xy, { key: 'x.sort', label: 'X sort', type: 'select', options: ['none', 'ascending', 'descending'] }];
    case 'VizAreaControls': return [...xy, opacity];
    case 'VizHeatmapControls': return [...xy, field('color', 'Intensity field')];
  }
}

export function defaultVizIntent(id: VizControlId | VizSummaryId): VizIntentFragment {
  if (id === 'VizOpacityControls' || id === 'VizOpacitySummary') return { opacity: 0.8 };
  if (id === 'VizAxisControls' || id === 'VizAxisSummary' || id === 'VizEncodingBadge') return { encodings: { x: { field: 'period', title: 'Period', sort: 'ascending' } } };
  if (id === 'VizScaleControls' || id === 'VizScaleSummary') return { encodings: { x: { field: 'value', scale: 'linear' } } };
  if (id === 'VizSizeControls' || id === 'VizSizeSummary') return { encodings: { size: { field: 'size', scale: 'linear' } } };
  if (id === 'VizColorControls' || id === 'VizColorLegendConfig') return { encodings: { color: { field: 'category', type: 'nominal', range: ['#2563eb', '#b45309'] } } };
  if (id === 'VizShapeControls' || id === 'VizShapeLegend') return { encodings: { shape: { field: 'category', type: 'nominal' } } };
  if (id === 'VizRoleBadge') return { chartType: 'bar' };
  const chartType: VizChartType = id === 'VizLineControls' ? 'line' : id === 'VizAreaControls' ? 'area' : id === 'VizHeatmapControls' ? 'heatmap' : id === 'VizMarkControls' ? 'bar' : 'scatter';
  const point = chartType === 'scatter';
  return { chartType, encodings: { x: { field: point ? 'value' : 'period', type: point ? 'quantitative' : 'nominal', ...(chartType === 'line' ? { sort: 'ascending' as const } : {}) }, y: { field: point ? 'other' : chartType === 'heatmap' ? 'category' : 'value', type: chartType === 'heatmap' ? 'nominal' : 'quantitative' }, ...(chartType === 'heatmap' ? { color: { field: 'value', type: 'quantitative' as const } } : {}), ...(id === 'VizPointControls' ? { shape: { field: 'category', type: 'nominal' as const } } : {}), ...(id === 'VizScatterControls' ? { size: { field: 'size', type: 'quantitative' as const } } : {}) }, ...(chartType === 'area' ? { opacity: 0.8 } : {}) };
}

export function vizFieldValue(value: VizIntentFragment, key: string): string {
  if (key === 'chartType') return value.chartType ?? 'bar';
  if (key === 'opacity') return value.opacity === undefined ? '' : String(value.opacity);
  const [channel, property] = key.split('.') as [VizChannel, keyof VizColorBinding];
  const result = (value.encodings?.[channel] as VizColorBinding | undefined)?.[property];
  return Array.isArray(result) ? result.join(', ') : result ?? '';
}

/** Invalid numeric/color/empty field edits stay local and never reach the renderer. */
export function editVizIntent(value: VizIntentFragment, field: VizControlField, text: string): { value?: VizIntentFragment; error?: string } {
  let next: string | number | string[] = text;
  if (field.key === 'opacity') {
    next = Number(text);
    if (!text.trim() || !Number.isFinite(next) || next < (field.min ?? -Infinity) || next > (field.max ?? Infinity)) return { error: 'Enter an opacity between 0 and 1.' };
  } else if (field.type === 'colors') {
    next = text.split(',').map(color => color.trim());
    if (next.length < 2 || next.some(color => !/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color))) return { error: 'Enter at least two comma-separated hex colors.' };
  } else if (field.key.endsWith('.field') && !text.trim()) return { error: 'Enter a data field name.' };
  if (field.options && !field.options.includes(text)) return { error: 'Choose a declared option.' };
  if (field.key === 'chartType') return { value: { ...value, chartType: text as VizChartType } };
  if (field.key === 'opacity') return { value: { ...value, opacity: next as number } };
  const [channel, property] = field.key.split('.') as [VizChannel, string];
  if (property !== 'field' && !value.encodings?.[channel]?.field) return { error: 'Choose a data field before editing this binding.' };
  return { value: { ...value, encodings: { ...value.encodings, [channel]: { ...value.encodings?.[channel], [property]: next } } } };
}

export function vizSummaryRows(id: VizSummaryId, value: VizIntentFragment, channel: VizChannel = 'x'): Array<[string, string]> {
  if (id === 'VizRoleBadge') return [['Chart', value.chartType ?? 'Not selected']];
  if (id === 'VizOpacitySummary') return [['Opacity', value.opacity === undefined ? 'Renderer default' : String(value.opacity)]];
  const binding = value.encodings?.[id === 'VizSizeSummary' ? 'size' : channel];
  if (id === 'VizEncodingBadge') return [[channel.toUpperCase(), binding?.field ?? 'Not bound']];
  return [['Field', binding?.field ?? 'Not bound'], ...(id === 'VizAxisSummary' ? [['Title', binding?.title ?? 'Field name'], ['Sort', binding?.sort ?? 'none']] : [['Scale', binding?.scale ?? 'Inferred']])] as Array<[string, string]>;
}

/** Reject data operands and unsupported control values at generated-target validation. */
export function isVizIntentFragment(value: unknown): value is VizIntentFragment {
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  if (!record(value) || Object.keys(value).some(key => !['chartType', 'encodings', 'opacity'].includes(key))) return false;
  if (value.chartType !== undefined && (typeof value.chartType !== 'string' || !['bar', 'line', 'area', 'scatter', 'heatmap'].includes(value.chartType))) return false;
  if (value.opacity !== undefined && (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1)) return false;
  if (value.encodings === undefined) return true;
  if (!record(value.encodings)) return false;
  return Object.entries(value.encodings).every(([channel, binding]) => {
    if (!['x', 'y', 'color', 'size', 'shape'].includes(channel) || !record(binding) || typeof binding.field !== 'string' || !binding.field.trim()) return false;
    const allowed = ['field', 'type', 'scale', 'title', 'sort', ...(channel === 'color' ? ['range'] : [])];
    if (Object.keys(binding).some(key => !allowed.includes(key))) return false;
    if (binding.title !== undefined && typeof binding.title !== 'string') return false;
    if (binding.type !== undefined && (typeof binding.type !== 'string' || !['quantitative', 'temporal', 'nominal', 'ordinal'].includes(binding.type))) return false;
    if (binding.scale !== undefined && (typeof binding.scale !== 'string' || !['linear', 'temporal', 'log', 'sqrt', 'band', 'point', 'diverging'].includes(binding.scale))) return false;
    if (binding.sort !== undefined && (typeof binding.sort !== 'string' || !['none', 'ascending', 'descending'].includes(binding.sort))) return false;
    return binding.range === undefined || (Array.isArray(binding.range) && binding.range.length >= 2 && binding.range.every(color => typeof color === 'string' && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color)));
  });
}
