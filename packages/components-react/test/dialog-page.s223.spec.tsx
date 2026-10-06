/* @vitest-environment jsdom */
/**
 * s223-m02 (#2527 ruling 13b): a modal Dialog keeps the page behind it still and gives the page back exactly as it was. The
 * page's own inline overflow and padding are set before each test, so "restored" means those values, not merely "not
 * hidden". A click on the backdrop reports close; a click on the dialog's own padding, or a press that began inside it and
 * ended on the backdrop (text selected and dragged out), does not.
 *
 * jsdom has no showModal(); the stand-in below opens and closes the element as the browser's does, so the component takes
 * its modal path. A real browser runs the same checks in artifacts/product-reality/sprint-223/m02/gaps.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialog } from '../src/index.js';

const page = document.documentElement;
const native = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };

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
afterEach(() => { cleanup(); page.removeAttribute('style'); });

function Harness({ initial = true, onClose }: { initial?: boolean; onClose?: () => void }) {
  const [open, setOpen] = React.useState(initial);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <Dialog id="archive" open={open} title="Archive workspace" onClose={() => { onClose?.(); setOpen(false); }}>
        Invoices stay in the archive for 30 days.
      </Dialog>
    </>
  );
}

const expectRestored = () => {
  expect(page.style.overflow).toBe('scroll');
  expect(page.style.paddingRight).toBe('3px');
};

describe('Dialog keeps the page still while it is open (s223-m02)', () => {
  it('locks page scroll when it opens and restores the page exactly when the consumer closes it', () => {
    const { rerender } = render(<Dialog id="archive" open title="Archive workspace" onClose={() => undefined} />);
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
    expect(page.style.overflow).toBe('hidden');
    rerender(<Dialog id="archive" open={false} title="Archive workspace" onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { hidden: true }).hasAttribute('open')).toBe(false);
    expectRestored();
  });

  it('restores the page when Escape closes it, and locks it again when it reopens', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(page.style.overflow).toBe('hidden');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expectRestored();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(page.style.overflow).toBe('hidden');
  });

  it('restores the page when it unmounts while open, and when the browser closes it under an open prop', () => {
    const first = render(<Dialog id="first" open title="First" />);
    expect(page.style.overflow).toBe('hidden');
    first.unmount();
    expectRestored();
    const onClose = vi.fn();
    render(<Dialog id="second" open title="Second" onClose={onClose} />);
    // A close request the browser would not let be cancelled: the element closes while open is still true.
    act(() => { (screen.getByRole('dialog') as HTMLDialogElement).close(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expectRestored();
  });

  it('holds one lock for every open dialog and gives the page back when the last one closes', () => {
    const { rerender } = render(<><Dialog id="a" open title="A" /><Dialog id="b" open title="B" /></>);
    rerender(<><Dialog id="a" open={false} title="A" /><Dialog id="b" open title="B" /></>);
    expect(page.style.overflow).toBe('hidden');
    rerender(<><Dialog id="a" open={false} title="A" /><Dialog id="b" open={false} title="B" /></>);
    expectRestored();
  });

  it('leaves the page alone when it is shown in place (modal false)', () => {
    render(<Dialog id="inline" open modal={false} title="Shown in place" />);
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
    expectRestored();
  });
});

describe('Dialog closes on a backdrop click (s223-m02)', () => {
  // The dialog's box; a backdrop click reaches the dialog element itself at a point outside it.
  const box = () => {
    const dialog = screen.getByRole('dialog');
    dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400, width: 400, height: 300, x: 100, y: 100, toJSON: () => ({}) });
    return dialog;
  };

  it('reports close for a press and click on the backdrop, and the page is restored', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = box();
    fireEvent.mouseDown(dialog, { clientX: 20, clientY: 20 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute('open')).toBe(false);
    expectRestored();
  });

  it('stays open for a click on its own padding, a click on its content, and a press dragged out to the backdrop', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = box();
    fireEvent.mouseDown(dialog, { clientX: 110, clientY: 110 });
    fireEvent.click(dialog, { clientX: 110, clientY: 110 });
    fireEvent.mouseDown(screen.getByText('Invoices stay in the archive for 30 days.'), { clientX: 200, clientY: 200 });
    fireEvent.click(screen.getByText('Invoices stay in the archive for 30 days.'), { clientX: 200, clientY: 200 });
    // Pressed on the content, released on the backdrop: the click lands on the dialog element outside its box.
    fireEvent.mouseDown(screen.getByText('Invoices stay in the archive for 30 days.'), { clientX: 200, clientY: 200 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(page.style.overflow).toBe('hidden');
  });
});
