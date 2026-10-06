import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  type ComponentPublicInstance,
  type PropType,
} from 'vue';

import type { ComponentSize, TabItem } from './types.js';

function itemDisabled(item: TabItem): boolean {
  return item.disabled === true || item.isDisabled === true;
}

function enabledItems(items: readonly TabItem[]): readonly TabItem[] {
  return items.filter((item) => !itemDisabled(item));
}

function initialTabId(items: readonly TabItem[], preferred?: string): string {
  if (preferred && items.some((item) => item.id === preferred && !itemDisabled(item))) return preferred;
  return enabledItems(items)[0]?.id ?? '';
}

function domId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

export const Tabs = defineComponent({
  name: 'OodsTabs',
  props: {
    items: { type: Array as PropType<readonly TabItem[]>, default: () => [] },
    selectedId: String,
    defaultSelectedId: String,
    size: { type: String as PropType<ComponentSize>, default: 'md' },
    overflowLabel: { type: String, default: 'More' },
    ariaLabel: { type: String, default: 'Tabs' },
  },
  emits: {
    'update:selectedId': (_id: string) => true,
    change: (_id: string) => true,
  },
  setup(props, { emit, slots }) {
    const baseId = domId(useId());
    const internalSelectedId = ref(initialTabId(props.items, props.defaultSelectedId));
    const activeId = computed(() => (
      props.selectedId !== undefined
        ? initialTabId(props.items, props.selectedId)
        : initialTabId(props.items, internalSelectedId.value)
    ));
    const tabRefs = new Map<string, HTMLButtonElement>();
    const tabWidths = new Map<string, number>();
    const listRef = ref<HTMLElement>();
    const visibleLimit = ref(Number.POSITIVE_INFINITY);
    const overflowOpen = ref(false);
    let resizeObserver: ResizeObserver | undefined;

    const visibleItems = computed(() => {
      if (visibleLimit.value >= props.items.length) return [...props.items];
      const count = Math.max(1, visibleLimit.value);
      const visible = props.items.slice(0, count);
      const active = props.items.find((item) => item.id === activeId.value);
      if (active && !visible.some((item) => item.id === active.id)) {
        visible.splice(Math.max(visible.length - 1, 0), 1, active);
        visible.sort((left, right) => (
          props.items.findIndex((item) => item.id === left.id)
          - props.items.findIndex((item) => item.id === right.id)
        ));
      }
      return visible;
    });
    const overflowItems = computed(() => (
      props.items.filter((item) => !visibleItems.value.some((visible) => visible.id === item.id))
    ));

    const tabId = (id: string) => `oods-${baseId}-tab-${domId(id)}`;
    const panelId = (id: string) => `oods-${baseId}-panel-${domId(id)}`;

    const focusTab = (id: string) => nextTick(() => tabRefs.get(id)?.focus());
    const selectTab = (id: string) => {
      const item = props.items.find((candidate) => candidate.id === id);
      if (!item || itemDisabled(item)) return;
      if (props.selectedId === undefined) internalSelectedId.value = id;
      emit('update:selectedId', id);
      emit('change', id);
      void focusTab(id);
    };

    const onTabKeydown = (event: KeyboardEvent, currentId: string) => {
      const available = enabledItems(props.items);
      if (available.length === 0) return;
      const currentIndex = Math.max(available.findIndex((item) => item.id === currentId), 0);
      let nextIndex: number | undefined;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % available.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + available.length) % available.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = available.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      selectTab(available[nextIndex].id);
    };

    const recalculateOverflow = () => {
      const list = listRef.value;
      if (!list || list.clientWidth <= 0 || props.items.length <= 1) {
        visibleLimit.value = Number.POSITIVE_INFINITY;
        return;
      }
      for (const [id, element] of tabRefs) {
        if (element.offsetWidth > 0) tabWidths.set(id, element.offsetWidth);
      }
      const widths = props.items.map((item) => tabWidths.get(item.id) ?? 120);
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total <= list.clientWidth) {
        visibleLimit.value = Number.POSITIVE_INFINITY;
        return;
      }
      const availableWidth = Math.max(list.clientWidth - 96, 0);
      let usedWidth = 0;
      let count = 0;
      for (const width of widths) {
        if (count > 0 && usedWidth + width > availableWidth) break;
        usedWidth += width;
        count += 1;
      }
      visibleLimit.value = Math.max(1, count);
    };

    watch(
      () => props.items,
      (items) => {
        if (!items.some((item) => item.id === internalSelectedId.value && !itemDisabled(item))) {
          internalSelectedId.value = initialTabId(items, props.defaultSelectedId);
        }
        void nextTick(recalculateOverflow);
      },
    );

    onMounted(() => {
      void nextTick(recalculateOverflow);
      if (typeof ResizeObserver === 'function' && listRef.value) {
        resizeObserver = new ResizeObserver(recalculateOverflow);
        resizeObserver.observe(listRef.value);
      } else if (typeof window !== 'undefined') {
        window.addEventListener('resize', recalculateOverflow);
      }
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', recalculateOverflow);
    });

    return () => h('div', {
      class: 'oods-tabs',
      'data-oods-component': 'Tabs',
      'data-size': props.size,
    }, [
      h('div', {
        ref: listRef,
        class: 'oods-tab-list',
        role: 'tablist',
        'aria-label': props.ariaLabel,
      }, [
        ...visibleItems.value.map((item) => h('button', {
          key: item.id,
          ref: (element: Element | ComponentPublicInstance | null) => {
            if (element instanceof HTMLButtonElement) tabRefs.set(item.id, element);
            else tabRefs.delete(item.id);
          },
          id: tabId(item.id),
          class: 'oods-tab',
          type: 'button',
          role: 'tab',
          disabled: itemDisabled(item),
          tabindex: item.id === activeId.value ? 0 : -1,
          'aria-selected': item.id === activeId.value,
          'aria-controls': panelId(item.id),
          'data-tab-id': item.id,
          onClick: () => selectTab(item.id),
          onKeydown: (event: KeyboardEvent) => onTabKeydown(event, item.id),
        }, slots.itemLabel?.({ item, selected: item.id === activeId.value }) ?? [item.label])),
        // s224-m01 (#2542 ruling 2): the overflow markup is React's too: both class families, the trigger's data
        // attribute and aria-current="true" on an item.
        overflowItems.value.length > 0
          ? h('div', { class: 'oods-tabs-overflow oods-tabs__overflow' }, [
              h('button', {
                type: 'button',
                class: 'oods-tabs-overflow-trigger',
                'aria-label': `${props.overflowLabel} tabs`,
                'aria-haspopup': 'menu',
                'aria-expanded': overflowOpen.value,
                'data-tabs-overflow-trigger': 'true',
                onClick: () => { overflowOpen.value = !overflowOpen.value; },
              }, props.overflowLabel),
              overflowOpen.value
                ? h('div', { class: 'oods-tabs-overflow-menu', role: 'menu' }, overflowItems.value.map((item) => (
                    h('button', {
                      key: item.id,
                      type: 'button',
                      role: 'menuitem',
                      disabled: itemDisabled(item),
                      'aria-current': item.id === activeId.value ? 'true' : undefined,
                      onClick: () => {
                        selectTab(item.id);
                        overflowOpen.value = false;
                      },
                    }, [item.label])
                  )))
                : null,
            ])
          : null,
      ]),
      ...props.items.map((item) => h('div', {
        key: item.id,
        id: panelId(item.id),
        class: 'oods-tab-panel',
        role: 'tabpanel',
        tabindex: 0,
        hidden: item.id !== activeId.value,
        'aria-labelledby': tabId(item.id),
      }, slots.panel?.({ item, selected: item.id === activeId.value }) ?? [item.panel])),
    ]);
  },
});
