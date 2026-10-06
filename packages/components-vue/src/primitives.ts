import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, useId, watch, type PropType, type VNodeChild } from 'vue';
import { statusIcon } from './status-icon.js';

import type {
  ButtonIntent,
  ButtonSize,
  ComponentEmphasis,
  ComponentSize,
  ComponentTone,
  LayoutGap,
  TextElement,
} from './types.js';

const toneProp = String as PropType<ComponentTone>;
const emphasisProp = String as PropType<ComponentEmphasis>;
const sizeProp = String as PropType<ComponentSize>;

const STATUS_TONES: Readonly<Record<string, ComponentTone>> = {
  active: 'success',
  paid: 'success',
  success: 'success',
  successful: 'success',
  future: 'info',
  pending: 'info',
  pending_cancellation: 'info',
  posted: 'info',
  processing: 'info',
  trialing: 'accent',
  caution: 'warning',
  warning: 'warning',
  delinquent: 'critical',
  error: 'critical',
  failed: 'critical',
  past_due: 'critical',
  unpaid: 'critical',
};

const DOMAIN_STATUS_TONES: Readonly<Record<string, Readonly<Record<string, ComponentTone>>>> = {
  subscription: {
    future: 'info',
    trialing: 'accent',
    active: 'success',
    paused: 'neutral',
    pending_cancellation: 'info',
    past_due: 'critical',
    unpaid: 'critical',
    terminated: 'neutral',
  },
  invoice: {
    draft: 'neutral',
    posted: 'info',
    paid: 'success',
    past_due: 'critical',
    void: 'neutral',
  },
};

function normalizeStatus(status?: string): string {
  return status?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
}

function resolveTone(tone?: ComponentTone, status?: string, domain?: string): ComponentTone {
  const normalizedStatus = normalizeStatus(status);
  const normalizedDomain = domain?.trim().toLowerCase() ?? '';
  return tone
    ?? DOMAIN_STATUS_TONES[normalizedDomain]?.[normalizedStatus]
    ?? STATUS_TONES[normalizedStatus]
    ?? 'neutral';
}

function tokenTone(tone: ComponentTone): ComponentTone {
  if (tone === 'positive') return 'success';
  if (tone === 'danger') return 'critical';
  return tone;
}

function statusLabel(status?: string): string {
  return normalizeStatus(status)
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function slotOrValue(slot: (() => VNodeChild) | undefined, value: VNodeChild): VNodeChild {
  return slot ? slot() : value;
}

export const Badge = defineComponent({
  name: 'OodsBadge',
  props: {
    content: { type: [String, Number] as PropType<string | number>, default: undefined },
    status: String,
    domain: { type: String, default: 'subscription' },
    tone: toneProp,
    emphasis: { type: emphasisProp, default: 'subtle' },
    icon: { type: [String, Number, Object] as PropType<VNodeChild>, default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      const tone = resolveTone(props.tone, props.status, props.domain);
      const palette = tokenTone(tone);
      return h('span', {
        class: 'oods-badge',
        'data-oods-component': 'Badge',
        'data-status': props.status,
        'data-domain': props.domain,
        'data-tone': tone,
        'data-emphasis': props.emphasis,
        style: {
          '--cmp-badge-background': `var(--sys-status-${palette}-surface)`,
          '--cmp-badge-border': `var(--sys-status-${palette}-border)`,
          '--cmp-badge-text': `var(--sys-status-${palette}-text)`,
        },
      }, [
        props.icon || slots.icon
          ? h('span', { class: 'oods-badge__icon', 'aria-hidden': 'true' }, [slotOrValue(slots.icon, props.icon)])
          : null,
        h('span', { class: 'oods-badge__label' }, [slotOrValue(slots.default, props.content ?? statusLabel(props.status))]),
      ]);
    };
  },
});

export const Banner = defineComponent({
  name: 'OodsBanner',
  props: {
    title: { type: String, default: '' },
    detail: { type: String, default: '' },
    content: { type: [String, Number] as PropType<string | number>, default: '' },
    status: String,
    domain: { type: String, default: 'subscription' },
    tone: toneProp,
    emphasis: { type: emphasisProp, default: 'subtle' },
    dismissLabel: String,
  },
  emits: {
    dismiss: () => true,
  },
  setup(props, { emit, slots }) {
    return () => {
      const tone = resolveTone(props.tone, props.status, props.domain);
      const palette = tokenTone(tone);
      return h('div', {
        class: 'oods-banner',
        'data-oods-component': 'Banner',
        'data-status': props.status,
        'data-domain': props.domain,
        'data-tone': tone,
        'data-emphasis': props.emphasis,
        role: tone === 'critical' || tone === 'danger' ? 'alert' : 'status',
        'aria-live': tone === 'critical' || tone === 'danger' ? 'assertive' : 'polite',
        style: {
          '--cmp-banner-background': `var(--sys-status-${palette}-surface)`,
          '--cmp-banner-border': `var(--sys-status-${palette}-border)`,
          '--cmp-banner-text': `var(--sys-status-${palette}-text)`,
        },
      }, [
        h('div', { class: 'oods-banner__content' }, [
          props.title || props.status || slots.title
            ? h('strong', { class: 'oods-banner__title' }, [
                slotOrValue(slots.title, props.title || statusLabel(props.status)),
              ])
            : null,
          props.detail ? h('p', { class: 'oods-banner__detail' }, props.detail) : null,
          slots.default || props.content
            ? h(slots.default ? 'div' : 'p', { class: 'oods-banner__body' }, [slotOrValue(slots.default, props.content)])
            : null,
          slots.actions ? h('div', { class: 'oods-banner__actions' }, slots.actions()) : null,
        ]),
        props.dismissLabel
          ? h('button', {
              type: 'button',
              class: 'oods-banner-dismiss oods-banner__dismiss',
              'aria-label': props.dismissLabel,
              onClick: () => emit('dismiss'),
            }, [statusIcon('x')])
          : null,
      ]);
    };
  },
});

// Intent, size, radius and focus are painted by @oods/component-styles from the
// cmp roles through data-intent and data-size; no utility class carries chrome.
export const Button = defineComponent({
  name: 'OodsButton',
  props: {
    content: { type: [String, Number] as PropType<string | number>, default: '' },
    intent: { type: String as PropType<ButtonIntent>, default: 'neutral' },
    size: { type: String as PropType<ButtonSize>, default: 'md' },
    disabled: Boolean,
    type: { type: String as PropType<'button' | 'submit' | 'reset'>, default: 'button' },
  },
  emits: {
    activate: (_event: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    return () => h('button', {
      type: props.type,
      disabled: props.disabled,
      class: 'oods-button',
      'data-oods-component': 'Button',
      'data-intent': props.intent,
      'data-size': props.size,
      style: {
        '--cmp-button-background': 'var(--sys-surface-interactive-primary-default)',
        '--cmp-button-background-hover': 'var(--sys-surface-interactive-primary-hover)',
        '--cmp-button-background-disabled': 'var(--sys-surface-disabled)',
        '--cmp-button-border': 'var(--sys-border-subtle)',
        '--cmp-button-text': 'var(--sys-text-on-interactive)',
        '--cmp-button-text-disabled': 'var(--sys-text-disabled)',
      },
      onClick: (event: MouseEvent) => emit('activate', event),
    }, [slotOrValue(slots.default, props.content)]);
  },
});

const canShowModal = () =>
  typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';

// s223-m02 (#2527 ruling 13b): while a modal dialog is open the page behind it does not scroll. Every open dialog shares one
// lock, and when the last one closes the page's own inline overflow and right padding (the padding stands in for the
// scrollbar the lock hides, so nothing shifts) come back exactly as they were.
let pageLocks = 0;
let pageStyle: { overflow: string; paddingRight: string } | undefined;
function lockPageScroll(): () => void {
  const page = document.documentElement;
  if (pageLocks++ === 0) {
    const scrollbar = window.innerWidth - page.clientWidth;
    pageStyle = { overflow: page.style.overflow, paddingRight: page.style.paddingRight };
    if (scrollbar > 0) page.style.paddingRight = `${parseFloat(getComputedStyle(page).paddingRight) + scrollbar}px`;
    page.style.overflow = 'hidden';
  }
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    if (--pageLocks === 0 && pageStyle) {
      page.style.overflow = pageStyle.overflow;
      page.style.paddingRight = pageStyle.paddingRight;
      pageStyle = undefined;
    }
  };
}

/** A click on a modal dialog's backdrop reaches the dialog element itself, at a point outside its box. */
const outsideBox = (event: MouseEvent, dialog: Element) => {
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
};

// s222-m02 (#2502 ruling 11): one markup with React and the HTML renderer: a native dialog named by its h2 title and
// described by its description, a close button, the body and a footer of actions. The consumer owns open; the close
// button, Escape and a browser close request emit close, and the dialog stays open until open becomes false. On the
// server and until it is mounted, open is the open attribute; in a browser a modal dialog then opens with showModal(),
// so the attribute is never Vue's to write while the dialog is in the top layer. modal false keeps it in place.
export const Dialog = defineComponent({
  name: 'OodsDialog',
  props: {
    id: String,
    open: Boolean,
    modal: { type: Boolean, default: true },
    title: { type: String, default: '' },
    description: String,
    dismissLabel: { type: String, default: 'Close' },
    size: { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'md' },
    actions: { type: [String, Number, Object, Array] as PropType<VNodeChild>, default: undefined },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const generatedId = useId().replace(/[^\w-]/g, '');
    const dialogId = computed(() => props.id || `oods-dialog-${generatedId}`);
    const element = ref<HTMLDialogElement | null>(null);
    const mounted = ref(false);
    const managed = computed(() => props.modal && mounted.value && canShowModal());
    let unlockScroll: (() => void) | undefined;
    let pressedBackdrop = false;
    const releaseScroll = () => {
      unlockScroll?.();
      unlockScroll = undefined;
    };
    const sync = () => {
      const dialog = element.value;
      if (!dialog || !managed.value) return;
      // The page stays put while the dialog is open modally; its close event, or unmounting, releases it.
      if (props.open && !dialog.open) {
        dialog.showModal();
        unlockScroll ??= lockPageScroll();
      } else if (!props.open && dialog.open) dialog.close();
    };
    onMounted(() => { mounted.value = true; });
    onBeforeUnmount(releaseScroll);
    watch([() => props.open, managed], sync, { flush: 'post' });
    const requestClose = (event: Event) => {
      event.preventDefault();
      emit('close');
    };

    return () => {
      const titleId = `${dialogId.value}-title`;
      const descriptionId = `${dialogId.value}-description`;
      const actions = slotOrValue(slots.actions, props.actions);
      return h('dialog', {
        ref: element,
        id: dialogId.value,
        class: 'oods-dialog',
        'data-oods-component': 'Dialog',
        'data-size': props.size,
        'aria-labelledby': titleId,
        'aria-describedby': props.description ? descriptionId : undefined,
        open: managed.value ? undefined : props.open,
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === 'Escape' && !event.defaultPrevented) requestClose(event);
        },
        onCancel: requestClose,
        // A close event from moving a mounted dialog into the top layer finds it open again, and is not reported. Any other
        // close releases the page; when the browser closed it (a close request it would not let be cancelled) while open is
        // still true, it is reported.
        onClose: () => {
          if (element.value?.open) return;
          releaseScroll();
          if (props.open) emit('close');
        },
        onMousedown: (event: MouseEvent) => {
          pressedBackdrop = managed.value && event.target === event.currentTarget && outsideBox(event, event.currentTarget as Element);
        },
        // s223-m02 (#2527 ruling 13b): a click on the backdrop emits close, as the close control does. A press that began
        // inside the dialog (text selected and dragged out) is not a backdrop click.
        onClick: (event: MouseEvent) => {
          const backdrop = pressedBackdrop && event.target === event.currentTarget && outsideBox(event, event.currentTarget as Element);
          pressedBackdrop = false;
          if (backdrop) emit('close');
        },
      }, [
        h('div', { class: 'oods-dialog__header' }, [
          h('div', { class: 'oods-dialog__heading' }, [
            h('h2', { id: titleId, class: 'oods-dialog__title' }, props.title),
            props.description ? h('p', { id: descriptionId, class: 'oods-dialog__description' }, props.description) : null,
          ]),
          h('button', {
            type: 'button',
            class: 'oods-dialog__close',
            'aria-label': props.dismissLabel,
            onClick: () => emit('close'),
          }, [statusIcon('x')]),
        ]),
        slots.default ? h('div', { class: 'oods-dialog__body' }, slots.default()) : null,
        actions !== undefined && actions !== null && actions !== '' ? h('div', { class: 'oods-dialog__footer' }, [actions]) : null,
      ]);
    };
  },
});

const SAFE_CARD_ELEMENTS = new Set(['div', 'article', 'section', 'aside']);

export const Card = defineComponent({
  name: 'OodsCard',
  props: {
    elevated: Boolean,
    as: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () => h(SAFE_CARD_ELEMENTS.has(props.as) ? props.as : 'div', {
      class: 'oods-card',
      'data-oods-component': 'Card',
      'data-elevated': String(props.elevated),
    }, slots.default?.());
  },
});

const GAP_VALUES: Readonly<Record<string, string>> = {
  xs: 'var(--cmp-spacing-inline-xs, 0.5rem)',
  sm: 'var(--cmp-spacing-inline-sm, 0.75rem)',
  md: 'var(--cmp-spacing-stack-default, 1rem)',
  lg: 'var(--cmp-spacing-stack-lg, 1.5rem)',
  xl: 'var(--cmp-spacing-stack-xl, 2rem)',
};

function resolveGap(gap: LayoutGap): string {
  return GAP_VALUES[gap] ?? gap;
}

/** A numeric column count is a maximum the shared CSS wraps below (s206-m01); `auto-fit` has none. */
function maxColumns(columns: number | string): number | undefined {
  const count = Number(columns);
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

export const Grid = defineComponent({
  name: 'OodsGrid',
  props: {
    columns: { type: [Number, String] as PropType<number | string>, default: 'auto-fit' },
    minColumnWidth: { type: String, default: '16rem' },
    gap: { type: String as PropType<LayoutGap>, default: 'md' },
    align: { type: String, default: 'stretch' },
    justify: { type: String, default: 'normal' },
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'oods-grid',
      'data-oods-component': 'Grid',
      'data-max-columns': maxColumns(props.columns),
      style: {
        '--oods-grid-columns': String(props.columns),
        '--oods-grid-min-column': props.minColumnWidth,
        '--oods-layout-gap': resolveGap(props.gap),
        '--oods-layout-align': props.align,
        '--oods-layout-justify': props.justify,
      },
    }, slots.default?.());
  },
});

export const Stack = defineComponent({
  name: 'OodsStack',
  props: {
    direction: { type: String as PropType<'row' | 'column'>, default: 'column' },
    gap: { type: String as PropType<LayoutGap>, default: 'md' },
    align: { type: String, default: 'stretch' },
    justify: { type: String, default: 'flex-start' },
    wrap: Boolean,
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'oods-stack',
      'data-oods-component': 'Stack',
      style: {
        '--oods-stack-direction': props.direction,
        '--oods-stack-wrap': props.wrap ? 'wrap' : 'nowrap',
        '--oods-layout-gap': resolveGap(props.gap),
        '--oods-layout-align': props.align,
        '--oods-layout-justify': props.justify,
      },
    }, slots.default?.());
  },
});

const SAFE_TEXT_ELEMENTS: ReadonlySet<string> = new Set<TextElement>([
  'span', 'p', 'strong', 'em', 'small', 'div', 'label',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

export const Text = defineComponent({
  name: 'OodsText',
  props: {
    content: { type: [String, Number] as PropType<string | number>, default: '' },
    label: String,
    as: { type: String as PropType<TextElement>, default: 'span' },
    size: { type: sizeProp, default: 'md' },
    weight: { type: String, default: 'normal' },
  },
  setup(props, { slots }) {
    return () => h(SAFE_TEXT_ELEMENTS.has(props.as) ? props.as : 'span', {
      class: 'oods-text',
      'data-oods-component': 'Text',
      'data-size': props.size,
      'data-weight': props.weight,
      'aria-description': props.label,
    }, [slotOrValue(slots.default, props.content)]);
  },
});
