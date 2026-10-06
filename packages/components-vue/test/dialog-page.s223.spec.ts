/**
 * s223-m02 (#2527 ruling 13b): a modal Dialog keeps the page behind it still and gives the page back exactly as it was. The
 * page's own inline overflow and padding are set before each test, so "restored" means those values, not merely "not
 * hidden". A click on the backdrop emits close; a click on the dialog's own padding, or a press that began inside it and
 * ended on the backdrop (text selected and dragged out), does not.
 *
 * jsdom has no showModal(); the stand-in below opens and closes the element as the browser's does, so the component takes
 * its modal path. A real browser runs the same checks in artifacts/product-reality/sprint-223/m02/gaps.
 */
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Dialog } from '../src/index.js';

const page = document.documentElement;
const native = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };
const mounted: VueWrapper[] = [];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterAll(() => Object.assign(HTMLDialogElement.prototype, native));
beforeEach(() => { page.style.overflow = 'scroll'; page.style.paddingRight = '3px'; });
afterEach(() => { for (const wrapper of mounted.splice(0)) if (wrapper.exists()) wrapper.unmount(); page.removeAttribute('style'); });

/** The consumer owns open: close sets it false, as an app does. */
const Harness = defineComponent({
  props: { initial: { type: Boolean, default: true } },
  emits: ['closed'],
  setup(props, { emit, expose }) {
    const open = ref(props.initial);
    expose({ open });
    return () => [
      h('button', { type: 'button', onClick: () => { open.value = true; } }, 'Open'),
      h(Dialog, { id: 'archive', open: open.value, title: 'Archive workspace', onClose: () => { emit('closed'); open.value = false; } },
        { default: () => 'Invoices stay in the archive for 30 days.' }),
    ];
  },
});

const track = <T extends VueWrapper>(wrapper: T): T => { mounted.push(wrapper); return wrapper; };
const settle = async () => { await nextTick(); await nextTick(); };
const expectRestored = () => {
  expect(page.style.overflow).toBe('scroll');
  expect(page.style.paddingRight).toBe('3px');
};

describe('Dialog keeps the page still while it is open (s223-m02)', () => {
  it('locks page scroll when it opens and restores the page exactly when the consumer closes it', async () => {
    const wrapper = track(mount(Dialog, { props: { id: 'archive', open: true, title: 'Archive workspace' }, attachTo: document.body }));
    await settle();
    expect(wrapper.element.hasAttribute('open')).toBe(true);
    expect(page.style.overflow).toBe('hidden');
    await wrapper.setProps({ open: false });
    await settle();
    expect(wrapper.element.hasAttribute('open')).toBe(false);
    expectRestored();
  });

  it('restores the page when Escape closes it, and locks it again when it reopens', async () => {
    const wrapper = track(mount(Harness, { attachTo: document.body }));
    await settle();
    expect(page.style.overflow).toBe('hidden');
    await wrapper.find('dialog').trigger('keydown', { key: 'Escape' });
    await settle();
    expect(wrapper.emitted('closed')).toHaveLength(1);
    expectRestored();
    await wrapper.find('button').trigger('click');
    await settle();
    expect(page.style.overflow).toBe('hidden');
  });

  it('restores the page when it unmounts while open, and when the browser closes it under an open prop', async () => {
    const first = mount(Dialog, { props: { id: 'first', open: true, title: 'First' }, attachTo: document.body });
    await settle();
    expect(page.style.overflow).toBe('hidden');
    first.unmount();
    expectRestored();
    const second = track(mount(Dialog, { props: { id: 'second', open: true, title: 'Second' }, attachTo: document.body }));
    await settle();
    // A close request the browser would not let be cancelled: the element closes while open is still true.
    (second.element as HTMLDialogElement).close();
    await settle();
    expect(second.emitted('close')).toHaveLength(1);
    expectRestored();
  });

  it('holds one lock for every open dialog and gives the page back when the last one closes', async () => {
    const Two = defineComponent({
      props: { a: Boolean, b: Boolean },
      setup: props => () => [h(Dialog, { id: 'a', open: props.a, title: 'A' }), h(Dialog, { id: 'b', open: props.b, title: 'B' })],
    });
    const wrapper = track(mount(Two, { props: { a: true, b: true }, attachTo: document.body }));
    await settle();
    expect(wrapper.findAll('dialog').map(dialog => dialog.element.hasAttribute('open'))).toEqual([true, true]);
    await wrapper.setProps({ a: false, b: true });
    await settle();
    expect(page.style.overflow).toBe('hidden');
    await wrapper.setProps({ a: false, b: false });
    await settle();
    expectRestored();
  });

  it('leaves the page alone when it is shown in place (modal false)', async () => {
    const wrapper = track(mount(Dialog, { props: { id: 'inline', open: true, modal: false, title: 'Shown in place' }, attachTo: document.body }));
    await settle();
    expect(wrapper.element.hasAttribute('open')).toBe(true);
    expectRestored();
  });
});

describe('Dialog closes on a backdrop click (s223-m02)', () => {
  // The dialog's box; a backdrop click reaches the dialog element itself at a point outside it.
  const box = (dialog: Element) => {
    dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400, width: 400, height: 300, x: 100, y: 100, toJSON: () => ({}) });
    return dialog;
  };

  it('emits close for a press and click on the backdrop, and the page is restored', async () => {
    const wrapper = track(mount(Harness, { attachTo: document.body }));
    await settle();
    const dialog = box(wrapper.find('dialog').element);
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 20 }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }));
    await settle();
    expect(wrapper.emitted('closed')).toHaveLength(1);
    expect(dialog.hasAttribute('open')).toBe(false);
    expectRestored();
  });

  it('stays open for a click on its own padding, a click on its content, and a press dragged out to the backdrop', async () => {
    const wrapper = track(mount(Harness, { attachTo: document.body }));
    await settle();
    const dialog = box(wrapper.find('dialog').element);
    const body = wrapper.find('.oods-dialog__body').element;
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 110, clientY: 110 }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 110, clientY: 110 }));
    body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200 }));
    body.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
    // Pressed on the content, released on the backdrop: the click lands on the dialog element outside its box.
    body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200 }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }));
    await settle();
    expect(wrapper.emitted('closed')).toBeUndefined();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(page.style.overflow).toBe('hidden');
  });
});
