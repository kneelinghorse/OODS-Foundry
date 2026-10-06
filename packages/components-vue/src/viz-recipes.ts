import { defineComponent, h, ref, watch, useId, type PropType } from 'vue';
import { editVizIntent, vizControlFields, vizFieldValue, vizSummaryRows, VIZ_CONTROL_TITLES, type VizIntentFragment, type VizControlId, type VizControlField, type VizSummaryId, type VizChannel } from '@oods/component-contracts';
import { Input, Select } from './fields.js';
import { Badge, Text } from './primitives.js';
import { ColorSwatch, VizAreaPreview } from './breadth.js';

function controls(id: VizControlId) {
  return defineComponent({ name: id, props: { id: String, title: String, value: Object as PropType<VizIntentFragment>, channel: { type: String as PropType<'x' | 'y'>, default: 'x' }, disabled: Boolean }, emits: { change: (_value: VizIntentFragment) => true }, setup(props, { emit }) {
    const generatedId = useId(); const current = ref<VizIntentFragment>(props.value ?? {}); const drafts = ref<Record<string, string>>({}); const errors = ref<Record<string, string | undefined>>({});
    watch(() => props.value, value => { current.value = value ?? {}; drafts.value = {}; errors.value = {}; }, { deep: true });
    const update = (field: VizControlField, text: string) => {
      const result = editVizIntent(current.value, field, text);
      drafts.value = { ...drafts.value, [field.key]: text }; errors.value = { ...errors.value, [field.key]: result.error };
      if (result.value) { current.value = result.value; emit('change', result.value); }
    };
    return () => h('fieldset', { id: props.id, class: 'oods-viz-controls oods-trait-recipe', 'data-oods-component': id, disabled: props.disabled }, [h('legend', props.title ?? VIZ_CONTROL_TITLES[id]), ...vizControlFields(id, props.channel).map(field => {
      const text = drafts.value[field.key] ?? vizFieldValue(current.value, field.key);
      const common = { key: field.key, id: `${props.id ?? generatedId}-${field.key.replace('.', '-')}`, name: field.key, label: field.label, modelValue: text, validation: errors.value[field.key] ? { state: 'error' as const, message: errors.value[field.key]! } : undefined, 'onUpdate:modelValue': (value: string) => update(field, value) };
      return field.type === 'select' ? h(Select, { ...common, options: [...(!field.options?.includes(text) ? [{ value: text, label: text || 'Choose option', disabled: true }] : []), ...field.options!.map(value => ({ value, label: value }))] }) : h(Input, { ...common, type: field.type === 'number' ? 'number' : 'text', min: field.min === undefined ? undefined : String(field.min), max: field.max === undefined ? undefined : String(field.max), step: field.step === undefined ? undefined : String(field.step) });
    }), ...((id === 'VizColorControls' || id === 'VizColorLegendConfig') ? [h('div', { class: 'oods-viz-swatches' }, current.value.encodings?.color?.range?.map((color, index) => h(ColorSwatch, { key: index, color, label: `Category color ${index + 1}: ${color}` })))] : []), ...(id === 'VizShapeLegend' ? [h(Text, { content: `Shape field: ${current.value.encodings?.shape?.field || 'Not bound'}` })] : [])]);
  } });
}
function summary(id: VizSummaryId) {
  return defineComponent({ name: id, props: { id: String, title: String, value: Object as PropType<VizIntentFragment>, channel: { type: String as PropType<VizChannel>, default: 'x' } }, setup(props) {
    return () => {
      const rows = vizSummaryRows(id, props.value ?? {}, props.channel);
      if (id === 'VizEncodingBadge' || id === 'VizRoleBadge') return h('span', { id: props.id, 'data-oods-component': id }, [h(Badge, { content: rows.map(([label, text]) => `${label}: ${text}`).join(' · ') })]);
      const title = props.title ?? id.replace(/^Viz/, '').replace(/Summary$/, '') + ' summary';
      return h('section', { id: props.id, class: 'oods-trait-recipe', 'data-oods-component': id, 'aria-label': title }, [h('h2', title), h('dl', rows.map(([label, text]) => h('div', { key: label }, [h('dt', label), h('dd', [h(Text, { content: text })])])))]);
    };
  } });
}
function preview(id: string, type: string) {
  return defineComponent({ name: id, props: { svg: String, svgNarrow: String, svgWide: String, svgDark: String, svgDarkNarrow: String, svgDarkWide: String, svgHc: String, svgHcNarrow: String, svgHcWide: String, title: String, description: String, width: Number, height: Number }, setup(props, { slots }) {
    return () => h(VizAreaPreview, { ...props, title: props.title ?? `${type[0].toUpperCase()}${type.slice(1)} chart`, 'data-oods-component': id, 'data-viz-preview-type': type }, { default: slots.default ?? (() => h(Text, { content: 'No rendered chart supplied' })) });
  } });
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
