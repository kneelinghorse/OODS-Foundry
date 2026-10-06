import * as React from 'react';
import { editVizIntent, vizControlFields, vizFieldValue, vizSummaryRows, VIZ_CONTROL_TITLES, type VizIntentFragment, type VizControlId, type VizControlField, type VizSummaryId, type VizChannel } from '@oods/component-contracts';
import type { VizAreaPreviewProps } from './types.js';
import { Input, Select } from './fields.js';
import { Badge, Text } from './presentational.js';
import { ColorSwatch, VizAreaPreview } from './breadth.js';

export interface VizControlsProps { id?: string; title?: string; value?: VizIntentFragment; channel?: 'x' | 'y'; disabled?: boolean; onChange?: (value: VizIntentFragment) => void }
function controls(id: VizControlId) {
  const Component = ({ id: htmlId, title = VIZ_CONTROL_TITLES[id], value, channel = 'x', disabled, onChange }: VizControlsProps) => {
    const generatedId = React.useId();
    const [current, setCurrent] = React.useState<VizIntentFragment>(value ?? {});
    const [drafts, setDrafts] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});
    React.useEffect(() => { setCurrent(value ?? {}); setDrafts({}); setErrors({}); }, [value]);
    const update = (field: VizControlField, text: string) => {
      const result = editVizIntent(current, field, text);
      setDrafts(previous => ({ ...previous, [field.key]: text }));
      setErrors(previous => ({ ...previous, [field.key]: result.error }));
      if (result.value) { setCurrent(result.value); onChange?.(result.value); }
    };
    return <fieldset id={htmlId} className="oods-viz-controls oods-trait-recipe" data-oods-component={id} disabled={disabled}><legend>{title}</legend>{vizControlFields(id, channel).map(field => {
      const fieldId = `${htmlId ?? generatedId}-${field.key.replace('.', '-')}`;
      const text = drafts[field.key] ?? vizFieldValue(current, field.key);
      const validation = errors[field.key] ? { state: 'error' as const, message: errors[field.key] } : undefined;
      return field.type === 'select'
        ? <Select key={field.key} id={fieldId} name={field.key} label={field.label} value={text} options={[...(!field.options?.includes(text) ? [{ value: text, label: text || 'Choose option', disabled: true }] : []), ...field.options!.map(value => ({ value, label: value }))]} validation={validation} onValueChange={value => update(field, value)} />
        : <Input key={field.key} id={fieldId} name={field.key} label={field.label} value={text} type={field.type === 'number' ? 'number' : 'text'} min={field.min} max={field.max} step={field.step} validation={validation} onValueChange={value => update(field, value)} />;
    })}{(id === 'VizColorControls' || id === 'VizColorLegendConfig') && <div className="oods-viz-swatches">{current.encodings?.color?.range?.map((color, index) => <ColorSwatch key={index} color={color} label={`Category color ${index + 1}: ${color}`} />)}</div>}{id === 'VizShapeLegend' && <Text content={`Shape field: ${current.encodings?.shape?.field || 'Not bound'}`} />}</fieldset>;
  };
  Component.displayName = `OODS.${id}`;
  return Component;
}

export interface VizSummaryProps { id?: string; title?: string; value?: VizIntentFragment; channel?: VizChannel }
function summary(id: VizSummaryId) {
  return function VizSummary({ id: htmlId, title, value = {}, channel = 'x' }: VizSummaryProps) {
    const rows = vizSummaryRows(id, value, channel);
    if (id === 'VizEncodingBadge' || id === 'VizRoleBadge') return <span id={htmlId} data-oods-component={id}><Badge content={rows.map(([label, text]) => `${label}: ${text}`).join(' · ')} /></span>;
    const heading = title ?? id.replace(/^Viz/, '').replace(/Summary$/, '') + ' summary';
    return <section id={htmlId} className="oods-trait-recipe" data-oods-component={id} aria-label={heading}><h2>{heading}</h2><dl>{rows.map(([label, text]) => <div key={label}><dt>{label}</dt><dd><Text content={text} /></dd></div>)}</dl></section>;
  };
}

function preview(id: string, type: string) {
  return function VizPreview({ title = `${type[0].toUpperCase()}${type.slice(1)} chart`, children, ...props }: VizAreaPreviewProps) {
    return <VizAreaPreview {...props} title={title} data-oods-component={id} data-viz-preview-type={type}>{children ?? <Text content="No rendered chart supplied" />}</VizAreaPreview>;
  };
}

export const VizAreaControls = controls('VizAreaControls');
export const VizAxisControls = controls('VizAxisControls');
export const VizColorControls = controls('VizColorControls');
export const VizHeatmapControls = controls('VizHeatmapControls');
export const VizLineControls = controls('VizLineControls');
export const VizMarkControls = controls('VizMarkControls');
export const VizOpacityControls = controls('VizOpacityControls');
export const VizPointControls = controls('VizPointControls');
export const VizScaleControls = controls('VizScaleControls');
export const VizScatterControls = controls('VizScatterControls');
export const VizShapeControls = controls('VizShapeControls');
export const VizSizeControls = controls('VizSizeControls');
export const VizColorLegendConfig = controls('VizColorLegendConfig');
export const VizShapeLegend = controls('VizShapeLegend');
export const VizAxisSummary = summary('VizAxisSummary');
export const VizOpacitySummary = summary('VizOpacitySummary');
export const VizScaleSummary = summary('VizScaleSummary');
export const VizSizeSummary = summary('VizSizeSummary');
export const VizEncodingBadge = summary('VizEncodingBadge');
export const VizRoleBadge = summary('VizRoleBadge');
export const VizHeatmapPreview = preview('VizHeatmapPreview', 'heatmap');
export const VizGraphPreview = preview('VizGraphPreview', 'force_graph');
export const VizLinePreview = preview('VizLinePreview', 'line');
export const VizMarkPreview = preview('VizMarkPreview', 'bar');
export const VizPointPreview = preview('VizPointPreview', 'scatter');
export const VizScatterPreview = preview('VizScatterPreview', 'scatter');
