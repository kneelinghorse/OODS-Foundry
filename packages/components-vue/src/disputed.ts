import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { auditSummary, initialSort, nextSort, ariaSort, type SortState } from '@oods/component-contracts';
import { InlineLabel } from './breadth.js';

export const AuditSummaryCard = defineComponent({
  name: 'AuditSummaryCard', props: { id: String, title: { type: String, default: 'Audit summary' }, auditLog: Array as PropType<readonly unknown[]>, lastN: { type: Number, default: 5 }, showTransitionCount: { type: Boolean, default: true }, showLastTransitionTime: { type: Boolean, default: true }, showLastActor: { type: Boolean, default: true } },
  setup: props => () => {
    const summary = auditSummary(props);
    return h('section', { id: props.id, class: 'oods-audit-summary', 'data-oods-component': 'AuditSummaryCard', 'aria-label': props.title }, [h('h2', props.title), h('dl', [
      ...(props.showTransitionCount ? [h('dt', 'Transitions'), h('dd', summary.count)] : []),
      ...(props.showLastActor ? [h('dt', 'Last actor'), h('dd', summary.actor)] : []),
      ...(props.showLastTransitionTime ? [h('dt', 'Last transition'), h('dd', summary.at ? h('time', { datetime: summary.at }, summary.timestamp) : summary.timestamp)] : []),
    ]), summary.recent.length ? h('ol', { 'aria-label': 'Recent transitions' }, summary.recent.map((entry, index) => h('li', { key: index }, String(entry.to_state ?? 'Transition')))) : null]);
  },
});
export const SortIndicator = defineComponent({
  name: 'SortIndicator', inheritAttrs: false, props: { id: String, label: { type: String, default: 'Sort' }, sortField: String, sortDirection: String, sortActive: { type: Boolean, default: false }, triStateSort: { type: Boolean, default: true }, sortableFields: Array as PropType<readonly string[]>, defaultSortField: String, defaultSortDirection: String },
  emits: { change: (_state: SortState) => true },
  setup(props, { emit, attrs }) {
    const state = ref(initialSort(props));
    watch(() => [props.sortField, props.sortDirection, props.sortActive, props.defaultSortField, props.defaultSortDirection], () => { state.value = initialSort(props); });
    return () => h('table', { ...attrs, 'data-oods-action': undefined, id: props.id, class: 'oods-sort-indicator', 'data-oods-component': 'SortIndicator', 'aria-label': props.label }, [h('thead', [h('tr', [h('th', { scope: 'col', 'aria-sort': ariaSort(state.value) }, [
      h('button', { type: 'button', 'data-oods-action': attrs['data-oods-action'], 'aria-label': `${props.label} ${state.value.field}`, onClick: () => { const next = nextSort(state.value, props.triStateSort); state.value = next; emit('change', next); } }, `${state.value.field}: ${ariaSort(state.value)}`),
    ])])])]);
  },
});
export const TimelineEntryLabel = defineComponent({
  name: 'TimelineEntryLabel', props: { label: String, text: String, value: String, maxLength: [Number, String], compact: { type: Boolean, default: true } },
  setup: (props, { slots }) => () => h(InlineLabel, { label: props.label, text: props.text, value: props.value, maxLength: props.maxLength ?? (props.compact ? 40 : undefined), 'data-oods-component': 'TimelineEntryLabel', 'data-timeline-label': 'true', 'data-compact': props.compact }, slots),
});
