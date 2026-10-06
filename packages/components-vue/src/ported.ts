import { currencyMinorUnits, formatDateTime, formatReadOnlyValue } from '@oods/component-contracts';
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  useId,
  type PropType,
  type Slots,
  type VNode,
  type VNodeChild,
} from 'vue';

import { Badge } from './primitives.js';
import { statusIcon } from './status-icon.js';
import { Input } from './fields.js';
import {
  buildPaginationItems,
  formatPrice,
  getPortedStatusPresentation,
  normalizeTimelineEvents,
  relativeTimestampLabel,
  statusLabel,
  type TimelineEvent,
} from './ported-core.js';
import type { ComponentEmphasis, ComponentTone } from './types.js';

export type StatusBadgeProps = {
  content?: string | number;
  status?: string;
  value?: string;
  label?: string;
  domain?: string;
  tone?: ComponentTone | 'lifecycle';
  emphasis?: ComponentEmphasis;
  showIcon?: boolean;
  field?: string;
  statusField?: string;
  domainField?: string;
  readOnly?: boolean;
  compact?: boolean;
  variant?: string;
};

export type PriceBadgeProps = {
  amountCents?: number;
  unitAmountCents?: number;
  amount?: number;
  unitAmount?: number;
  currency?: string;
  currencyCode?: string;
  label?: string;
  value?: string | number;
  emphasis?: ComponentEmphasis;
  field?: string;
  amountField?: string;
  currencyField?: string;
  intervalField?: string;
  minorUnitsParameter?: string;
};

export type TimelineProps = {
  title?: string;
  source?: readonly unknown[];
  events?: readonly unknown[];
  history?: readonly unknown[];
  entries?: readonly unknown[];
  stateHistory?: readonly unknown[];
  auditLog?: readonly unknown[];
  status?: string;
  allowedTransitions?: readonly string[];
  showActorId?: boolean;
  showReason?: boolean;
  maxVisible?: number;
  field?: string;
  historyField?: string;
  statesParameter?: string;
  auditLogField?: string;
  createdField?: string;
  updatedField?: string;
  eventField?: string;
  eventTimestampField?: string;
  eventOptionsParameter?: string;
  showFromState?: boolean;
};

export type CancellationSummaryProps = {
  title?: string;
  label?: string;
  cancelAtPeriodEnd?: boolean;
  requestedAt?: string;
  reason?: string;
  code?: string;
  field?: string;
  cancelAtPeriodEndField?: string;
  requestedAtField?: string;
  reasonField?: string;
  codeField?: string;
};

export type SearchInputProps = {
  id?: string;
  label?: string;
  modelValue?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  clearable?: boolean;
  debounceMs?: number;
  debounce?: number;
  minQueryLength?: number;
  disabled?: boolean;
  field?: string;
  placeholderParameter?: string;
  debounceParameter?: string;
  minQueryLengthParameter?: string;
  clearableParameter?: string;
};

export type PaginationBarProps = {
  page?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  pageSizeOptions?: readonly number[];
  showPageSizeSelector?: boolean;
  showGotoPage?: boolean;
  showItemRange?: boolean;
  pageField?: string;
  pageSizeField?: string;
  totalItemsField?: string;
  totalPagesField?: string;
  pageSizeOptionsParameter?: string;
  showPageSizeSelectorParameter?: string;
  showGotoPageParameter?: string;
  showItemRangeParameter?: string;
};

export type RelativeTimestampProps = {
  datetime?: string;
  timestamp?: string;
  value?: string;
  updatedAt?: string;
  createdAt?: string;
  relative?: string;
  label?: string;
  text?: string;
  timezone?: string;
  hideWhenEmpty?: boolean;
  now?: string | number | Date;
  field?: string;
  fallbackField?: string;
  timezoneParameter?: string;
};

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

function firstArray(...values: unknown[]): unknown[] {
  return values.find((value): value is unknown[] => Array.isArray(value)) ?? [];
}

function mergedClass(componentClass: string, value: unknown): unknown[] {
  return value ? [componentClass, value] : [componentClass];
}

export const StatusBadge = defineComponent({
  name: 'OodsStatusBadge',
  inheritAttrs: false,
  props: {
    content: { type: [String, Number] as PropType<string | number>, default: undefined },
    status: String,
    value: String,
    label: String,
    domain: { type: String, default: 'subscription' },
    tone: String as PropType<ComponentTone | 'lifecycle'>,
    emphasis: { type: String as PropType<ComponentEmphasis>, default: 'subtle' },
    showIcon: { type: Boolean, default: true },
    field: String,
    statusField: String,
    domainField: String,
    readOnly: Boolean,
    compact: Boolean,
    variant: String,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const status = props.status ?? props.value ?? 'unknown';
      const presentation = getPortedStatusPresentation(props.domain, status);
      const tone = props.tone === 'lifecycle' ? presentation.tone : props.tone ?? presentation.tone;
      const ariaLabel = stringValue(attrs['aria-label']) ?? props.label ?? `Status: ${presentation.label}`;
      return h(Badge, {
        ...attrs,
        class: mergedClass('oods-status-badge', attrs.class),
        content: slots.default ? undefined : props.content ?? presentation.label,
        status,
        domain: props.domain,
        tone,
        emphasis: props.variant === 'solid' ? 'solid' : props.emphasis,
        title: stringValue(attrs.title) ?? presentation.description,
        'aria-label': ariaLabel,
        'data-oods-component': 'StatusBadge',
      }, props.showIcon && presentation.icon && !slots.icon
        ? { ...slots, icon: () => statusIcon(presentation.icon!) }
        : slots);
    };
  },
});

function currencyLabel(
  amountCents: number | undefined,
  amount: number | undefined,
  currency: string | undefined,
  minorUnits?: number,
): string | undefined {
  const normalizedAmount = amountCents !== undefined ? amountCents / currencyMinorUnits(currency, minorUnits) : amount;
  if (normalizedAmount === undefined || !Number.isFinite(normalizedAmount)) return undefined;
  if (!currency) return formatPrice(undefined, normalizedAmount, undefined);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(normalizedAmount);
  } catch {
    return formatPrice(undefined, normalizedAmount, currency);
  }
}

export const PriceBadge = defineComponent({
  name: 'OodsPriceBadge',
  inheritAttrs: false,
  props: {
    amountCents: Number,
    unitAmountCents: Number,
    minorUnits: Number,
    amount: Number,
    unitAmount: Number,
    currency: String,
    currencyCode: String,
    label: String,
    value: [String, Number] as PropType<string | number>,
    emphasis: { type: String as PropType<ComponentEmphasis>, default: 'subtle' },
    field: String,
    amountField: String,
    currencyField: String,
    intervalField: String,
    minorUnitsParameter: String,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const currency = props.currency ?? props.currencyCode;
      const cents = props.amountCents ?? props.unitAmountCents;
      const amount = props.amount ?? props.unitAmount;
      const content = props.label
        ?? props.value
        ?? currencyLabel(cents, amount, currency, props.minorUnits)
        ?? 'Price';
      return h(Badge, {
        ...attrs,
        class: mergedClass('oods-price-badge', attrs.class),
        content,
        emphasis: props.emphasis,
        title: stringValue(attrs.title) ?? props.label,
        'data-oods-component': 'PriceBadge',
        'data-price': 'true',
        'data-badge-variant': 'price',
        'data-currency': currency?.toUpperCase(),
      }, slots);
    };
  },
});

type TimelineConfiguration = {
  componentId: 'StatusTimeline' | 'AuditTimeline';
  defaultTitle: string;
  timelineType: 'status' | 'audit';
};

const timelineProps = {
  title: String,
  source: Array as PropType<unknown[]>,
  events: Array as PropType<unknown[]>,
  history: Array as PropType<unknown[]>,
  entries: Array as PropType<unknown[]>,
  stateHistory: Array as PropType<unknown[]>,
  auditLog: Array as PropType<unknown[]>,
  status: String,
  allowedTransitions: Array as PropType<string[]>,
  showActorId: { type: Boolean, default: true },
  showReason: { type: Boolean, default: true },
  maxVisible: Number,
  field: String,
  historyField: String,
  statesParameter: String,
  auditLogField: String,
  createdField: String,
  updatedField: String,
  eventField: String,
  eventTimestampField: String,
  eventOptionsParameter: String,
  showFromState: Boolean,
} as const;

function renderTimelineEvent(
  event: TimelineEvent,
  index: number,
  showActorId: boolean,
  showReason: boolean,
): VNode {
  return h('li', { key: `${event.timestamp ?? 'event'}-${index}` }, [
    h('article', { class: 'oods-timeline__event', 'data-timeline-event': 'true' }, [
      h('p', { class: 'oods-timeline__label', 'data-timeline-label': 'true' }, event.label),
      event.timestamp
        ? h('time', { 'data-timeline-time': 'true', datetime: event.timestamp }, formatDateTime(event.timestamp))
        : null,
      event.detail ? h('p', { class: 'oods-timeline__detail', 'data-timeline-detail': 'true' }, event.detail) : null,
      showActorId && event.actorId
        ? h('p', { class: 'oods-timeline__actor', 'data-timeline-actor': 'true' }, `Actor: ${event.actorId}`)
        : null,
      showReason && event.reason
        ? h('p', { class: 'oods-timeline__reason', 'data-timeline-reason': 'true' }, `Reason: ${event.reason}`)
        : null,
    ]),
  ]);
}

function timelineComponent(configuration: TimelineConfiguration) {
  return defineComponent({
    name: `Oods${configuration.componentId}`,
    inheritAttrs: false,
    props: timelineProps,
    setup(props, { attrs, slots }) {
      return () => {
        const rawEvents = configuration.componentId === 'StatusTimeline'
          ? firstArray(props.source, props.events, props.history, props.entries, props.stateHistory)
          : firstArray(props.source, props.events, props.history, props.entries, props.auditLog);
        const normalized = normalizeTimelineEvents(rawEvents);
        const events = props.maxVisible === undefined
          ? normalized
          : normalized.slice(0, Math.max(0, Math.floor(props.maxVisible)));
        const title = props.title ?? configuration.defaultTitle;
        const slottedEvents = slots.default?.();
        return h('div', {
          ...attrs,
          class: mergedClass(`oods-timeline oods-${configuration.timelineType}-timeline`, attrs.class),
          role: 'log',
          'aria-label': stringValue(attrs['aria-label']) ?? title,
          'data-oods-component': configuration.componentId,
          'data-timeline-type': configuration.timelineType,
        }, [
          h('h2', { class: 'oods-timeline__title', 'data-timeline-title': 'true' }, title),
          props.status
            ? h('p', { class: 'oods-timeline__current', 'data-timeline-current': 'true' }, `Current status: ${statusLabel(props.status)}`)
            : null,
          props.allowedTransitions?.length
            ? h('p', { 'data-timeline-transitions': 'true' }, `Allowed transitions: ${props.allowedTransitions.join(', ')}`)
            : null,
          h('ol', { class: 'oods-timeline__events', 'data-timeline-events': 'true' }, slottedEvents?.length
            ? slottedEvents
            : events.length
              ? events.map((event, index) => renderTimelineEvent(
                  event,
                  index,
                  props.showActorId,
                  props.showReason,
                ))
              : [h('li', { 'data-timeline-empty': 'true' }, 'No events')]),
        ]);
      };
    },
  });
}

export const StatusTimeline = timelineComponent({
  componentId: 'StatusTimeline',
  defaultTitle: 'Status Timeline',
  timelineType: 'status',
});

export const AuditTimeline = timelineComponent({
  componentId: 'AuditTimeline',
  defaultTitle: 'Audit Timeline',
  timelineType: 'audit',
});

function slotSummaryValue(slots: Slots): VNodeChild | undefined {
  const nodes = slots.default?.() ?? [];
  for (const node of nodes) {
    if (typeof node.children === 'string') {
      const text = node.children.trim().toLowerCase();
      if (text === 'true') return true;
      if (text === 'false') return false;
      if (node.children.length > 0) return node.children;
    }
  }
  return undefined;
}

function summaryEntry(label: string, value: VNodeChild, key: string): VNode {
  return h('div', { key, 'data-summary-item': 'true' }, [
    h('dt', label),
    h('dd', [value]),
  ]);
}

export const CancellationSummary = defineComponent({
  name: 'OodsCancellationSummary',
  inheritAttrs: false,
  props: {
    title: String,
    label: String,
    cancelAtPeriodEnd: { type: Boolean, default: undefined },
    requestedAt: String,
    reason: String,
    code: String,
    field: String,
    cancelAtPeriodEndField: String,
    requestedAtField: String,
    reasonField: String,
    codeField: String,
    // s224-m01 (#2542 ruling 6): Boolean first, as the badges' hideWhenFalse is (a bare attribute casts to true).
    hideWhenDefault: { type: [Boolean, String], default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const slotValue = slotSummaryValue(slots);
      const cancellationValue = props.cancelAtPeriodEnd ?? slotValue;
      // "Cancel at period end: No" alone only states the default, so a detail page asking to hide it shows no card; a
      // scheduled cancellation, or one with a request time, reason, code or authored content, keeps it.
      if (props.hideWhenDefault === true && props.cancelAtPeriodEnd === false && !props.requestedAt && !props.reason && !props.code
        && slotValue === undefined) return null;
      const rows: VNode[] = [];
      if (cancellationValue !== undefined) {
        rows.push(summaryEntry(
          'Cancel at period end',
          typeof cancellationValue === 'boolean'
            ? cancellationValue ? 'Yes' : 'No'
            : cancellationValue,
          'cancel-at-period-end',
        ));
      }
      if (props.requestedAt) {
        rows.push(summaryEntry(
          'Requested at',
          h('time', { datetime: props.requestedAt }, formatDateTime(props.requestedAt)),
          'requested-at',
        ));
      }
      if (props.reason) rows.push(summaryEntry('Reason', props.reason, 'reason'));
      if (props.code) rows.push(summaryEntry('Code', formatReadOnlyValue(props.code, 'string', true), 'code'));
      return h('section', {
        ...attrs,
        class: mergedClass('oods-cancellation-summary', attrs.class),
        'data-oods-component': 'CancellationSummary',
        'data-summary-type': 'cancellation',
        'data-cancellation-state': props.cancelAtPeriodEnd === undefined
          ? undefined
          : String(props.cancelAtPeriodEnd),
      }, [
        h('h2', { 'data-summary-title': 'true' }, props.title ?? props.label ?? 'Cancellation Summary'),
        h('dl', rows),
      ]);
    };
  },
});

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

export const SearchInput = defineComponent({
  name: 'OodsSearchInput',
  inheritAttrs: false,
  props: {
    id: String,
    label: String,
    modelValue: String,
    value: String,
    defaultValue: { type: String, default: '' },
    placeholder: { type: String, default: 'Search…' },
    clearable: { type: Boolean, default: true },
    debounceMs: { type: Number, default: 0 },
    debounce: Number,
    minQueryLength: { type: Number, default: 0 },
    disabled: Boolean,
    field: String,
    placeholderParameter: String,
    debounceParameter: String,
    minQueryLengthParameter: String,
    clearableParameter: String,
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    valueChange: (_value: string) => true,
    update: (_value: string) => true,
    input: (_value: string) => true,
    search: (_value: string) => true,
    clear: () => true,
  },
  setup(props, { attrs, emit }) {
    const generatedId = useId();
    const internalValue = ref(props.defaultValue);
    const currentValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    let timer: ReturnType<typeof setTimeout> | undefined;
    onBeforeUnmount(() => {
      if (timer !== undefined) clearTimeout(timer);
    });

    const emitSearch = (value: string) => {
      if (value.length < Math.max(0, props.minQueryLength) && value.length !== 0) return;
      emit('valueChange', value);
      emit('update', value);
      emit('search', value);
    };
    const scheduleSearch = (value: string) => {
      if (timer !== undefined) clearTimeout(timer);
      const debounceMs = Math.max(0, props.debounceMs || props.debounce || 0);
      if (debounceMs > 0) {
        timer = setTimeout(() => emitSearch(value), debounceMs);
      } else {
        emitSearch(value);
      }
    };
    const updateValue = (value: string) => {
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = value;
      emit('update:modelValue', value);
      emit('input', value);
      scheduleSearch(value);
    };
    const clear = () => {
      if (props.disabled || currentValue.value.length === 0) return;
      if (timer !== undefined) clearTimeout(timer);
      updateValue('');
      emit('clear');
    };
    const searchNow = () => {
      if (!props.disabled) {
        if (timer !== undefined) clearTimeout(timer);
        emitSearch(currentValue.value);
      }
    };

    return () => {
      const id = props.id ?? `oods-search-${generatedId.replace(/:/g, '')}`;
      const ariaLabel = stringValue(attrs['aria-label']) ?? props.label ?? props.placeholder;
      return h('div', {
        ...attrs,
        class: mergedClass('oods-search-input', attrs.class),
        role: 'search',
        'aria-label': ariaLabel,
        'data-oods-component': 'SearchInput',
        'data-behavioral': 'search',
      }, [
        h(Input, {
          id,
          label: props.label,
          type: 'search',
          value: currentValue.value,
          placeholder: props.placeholder,
          disabled: props.disabled,
          inputClass: 'oods-search-input__control',
          'aria-label': props.label ? undefined : ariaLabel,
          onInput: (value: string) => updateValue(value),
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Escape') clear();
            // Enter searches at once and never submits a form the field sits in, as when the root was its own form.
            if (event.key === 'Enter') { event.preventDefault(); searchNow(); }
          },
        }),
        props.clearable && currentValue.value
          ? h('button', {
              type: 'button',
              class: 'oods-search-input__clear',
              'data-search-clear': 'true',
              'aria-label': 'Clear search',
              disabled: props.disabled,
              onClick: clear,
            }, [statusIcon('x')])
          : null,
      ]);
    };
  },
});

export const PaginationBar = defineComponent({
  name: 'OodsPaginationBar',
  inheritAttrs: false,
  props: {
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 25 },
    totalItems: { type: Number, default: 0 },
    totalPages: Number,
    pageSizeOptions: { type: Array as PropType<number[]>, default: () => [10, 25, 50, 100] },
    showPageSizeSelector: Boolean,
    showGotoPage: Boolean,
    showItemRange: { type: Boolean, default: true },
    pageField: String,
    pageSizeField: String,
    totalItemsField: String,
    totalPagesField: String,
    pageSizeOptionsParameter: String,
    showPageSizeSelectorParameter: String,
    showGotoPageParameter: String,
    showItemRangeParameter: String,
  },
  emits: {
    'update:page': (_page: number) => true,
    pageChange: (_page: number) => true,
    change: (_page: number) => true,
    update: (_page: number) => true,
    pageSizeChange: (_pageSize: number) => true,
  },
  setup(props, { attrs, emit }) {
    const generatedId = useId().replace(/:/g, '');
    const gotoPage = ref('');
    const count = computed(() => props.totalPages
      ?? (props.pageSize > 0 ? Math.ceil(props.totalItems / props.pageSize) : 0));
    const pagination = computed(() => buildPaginationItems({
      page: props.page,
      count: count.value,
    }));
    const setPage = (page: number) => {
      if (pagination.value.count === 0) return;
      const nextPage = Math.max(1, Math.min(Math.floor(page), pagination.value.count));
      if (nextPage === pagination.value.page) return;
      emit('update:page', nextPage);
      emit('pageChange', nextPage);
      emit('change', nextPage);
      emit('update', nextPage);
    };
    const submitGoto = (event: Event) => {
      event.preventDefault();
      const nextPage = Number(gotoPage.value);
      if (Number.isFinite(nextPage)) setPage(nextPage);
    };

    return () => {
      const { page, count: totalPages, items } = pagination.value;
      return h('nav', {
        ...attrs,
        class: mergedClass('oods-pagination-bar', attrs.class),
        'aria-label': stringValue(attrs['aria-label']) ?? 'Pagination',
        'data-oods-component': 'PaginationBar',
        'data-behavioral': 'pagination',
      }, [
        props.showItemRange
          ? h('span', { 'data-pagination-count': 'true' }, `${props.totalItems} ${props.totalItems === 1 ? 'record' : 'records'}`)
          : null,
        // s211-m02: on one page the range only repeats the count ("15 records Showing 1–15 of 15").
        props.showItemRange && props.totalItems > 0 && totalPages > 1 ? h('span', { 'data-pagination-range': 'true' }, `Showing ${(page - 1) * Math.max(1, props.pageSize) + 1}–${Math.min(page * Math.max(1, props.pageSize), props.totalItems)} of ${props.totalItems}`) : null,
        // s210-m01: one page needs no page controls; the count and range above already say what is shown.
        totalPages > 1 ? h('ul', { class: 'oods-pagination-bar__pages' }, items.map((item, index) => {
          if (item.type === 'ellipsis') {
            return h('li', { key: `ellipsis-${item.index ?? index}`, 'aria-hidden': 'true' }, '…');
          }
          const label = item.type === 'page'
            ? `Page ${item.page}`
            : item.type === 'previous'
              ? 'Previous page'
              : 'Next page';
          const content = item.type === 'page'
            ? String(item.page)
            : item.type === 'previous' ? '‹' : '›';
          return h('li', { key: `${item.type}-${item.page}` }, [
            h('button', {
              type: 'button',
              'data-pagination-page': item.type === 'page' ? item.page : undefined,
              'data-pagination-prev': item.type === 'previous' ? 'true' : undefined,
              'data-pagination-next': item.type === 'next' ? 'true' : undefined,
              'aria-label': label,
              'aria-current': item.selected ? 'page' : undefined,
              disabled: item.disabled,
              onClick: () => item.page !== undefined && setPage(item.page),
            }, content),
          ]);
        })) : null,
        totalPages > 1 ? h('span', { 'data-pagination-current': 'true' }, `Page ${page} of ${Math.max(1, totalPages)}`) : null,
        props.showPageSizeSelector
          ? h('label', { class: 'oods-pagination-size' }, [
              h('span', 'Items per page'),
              h('select', {
                value: props.pageSize,
                onChange: (event: Event) => {
                  const nextSize = Number((event.target as HTMLSelectElement).value);
                  if (Number.isFinite(nextSize) && nextSize > 0 && nextSize !== props.pageSize) {
                    emit('pageSizeChange', nextSize);
                  }
                },
              }, props.pageSizeOptions.map((option) => h('option', { value: option }, String(option)))),
            ])
          : null,
        props.showGotoPage
          ? h('form', { class: 'oods-pagination-goto', onSubmit: submitGoto }, [
              h('label', { for: `oods-pagination-goto-${generatedId}` }, 'Go to page'),
              h('input', {
                id: `oods-pagination-goto-${generatedId}`,
                type: 'number',
                min: 1,
                max: totalPages,
                value: gotoPage.value,
                onInput: (event: Event) => { gotoPage.value = inputValue(event); },
              }),
              h('button', { type: 'submit' }, 'Go'),
            ])
          : null,
      ]);
    };
  },
});

export const RelativeTimestamp = defineComponent({
  name: 'OodsRelativeTimestamp',
  inheritAttrs: false,
  props: {
    datetime: String,
    timestamp: String,
    value: String,
    updatedAt: String,
    createdAt: String,
    relative: String,
    label: String,
    text: String,
    timezone: String,
    hideWhenEmpty: Boolean,
    now: [String, Number, Date] as PropType<string | number | Date>,
    field: String,
    fallbackField: String,
    timezoneParameter: String,
  },
  setup(props, { attrs }) {
    return () => {
      const datetime = firstDefined(
        props.datetime,
        props.timestamp,
        props.value,
        props.updatedAt,
        props.createdAt,
      ) ?? '';
      if (props.hideWhenEmpty && (!datetime || Number.isNaN(Date.parse(datetime)))) return null;
      const absolute = formatDateTime(datetime, { timeZone: props.timezone });
      // An empty or unreadable value reads "Unknown time", as React and the HTML renderer show it (s222 ruling 16).
      const content = firstDefined(
        props.relative,
        props.label,
        props.text,
        !absolute ? 'Unknown time' : props.now === undefined ? absolute : relativeTimestampLabel(datetime, props.now),
      ) ?? '';
      return h('time', {
        ...attrs,
        class: mergedClass('oods-relative-timestamp', attrs.class),
        datetime: datetime || undefined,
        title: stringValue(attrs.title) ?? absolute,
        'data-oods-component': 'RelativeTimestamp',
      }, content);
    };
  },
});

export type { PaginationItem, StatusPresentation, TimelineEvent } from './ported-core.js';
