// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import React, { useCallback, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  OverlayRoot,
  useEscapeRoutes,
  useFocusManagement,
  useInertOutside,
} from '../../src/overlays/manager/index.js';
import * as focus from '../../src/overlays/manager/focus.js';

function FocusHarness({ backdropAsNode = false }: { backdropAsNode?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const [backdropNode, setBackdropNode] = useState<HTMLButtonElement | null>(null);

  useInertOutside(open, panelElement);
  useFocusManagement(open, panelRef);
  useEscapeRoutes(() => setOpen(false), backdropAsNode ? backdropNode : backdropRef);

  const assignPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanelElement(node);
  }, []);

  const assignBackdrop = useCallback((node: HTMLButtonElement | null) => {
    backdropRef.current = node;
    setBackdropNode(node);
  }, []);

  return (
    <div data-testid="fixture">
      <div data-testid="outside">
        <button data-testid="trigger" onClick={() => setOpen(true)}>
          Open Overlay
        </button>
        <a href="#" onClick={(event) => event.preventDefault()}>
          Outside link
        </a>
      </div>

      {open && (
        <OverlayRoot>
          <div>
            <div role="dialog" ref={assignPanel} tabIndex={-1} aria-modal="true">
              <input data-testid="first-input" />
              <button data-testid="close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <button
              type="button"
              ref={assignBackdrop}
              data-testid="backdrop"
              aria-label="Backdrop"
            />
          </div>
        </OverlayRoot>
      )}
    </div>
  );
}

describe('overlay manager edge cases', () => {
  it('captureFocusTarget and restoreFocus return focus to the original element', () => {
    const button = document.createElement('button');
    button.textContent = 'trigger';
    document.body.append(button);
    button.focus();

    const captured = focus.captureFocusTarget(document);
    expect(captured).toBe(button);

    const other = document.createElement('button');
    other.textContent = 'other';
    document.body.append(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    focus.restoreFocus(captured);
    expect(document.activeElement).toBe(button);

    other.remove();
    button.remove();
  });

  it('marks outside content inert while open and restores when closed', async () => {
    const r = render(<FocusHarness />);
    const trigger = r.getByTestId('trigger');
    const outsideContainer = r.container;

    expect(outsideContainer.getAttribute('aria-hidden')).toBeNull();
    fireEvent.click(trigger);

    await waitFor(() => expect(outsideContainer.getAttribute('aria-hidden')).toBe('true'));

    fireEvent.click(r.getByTestId('close'));
    await waitFor(() => expect(outsideContainer.getAttribute('aria-hidden')).toBeNull());
  });

  it('focus trap cycles between first and last focusable elements', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    first.textContent = 'first';
    const last = document.createElement('button');
    last.textContent = 'last';
    container.append(first, last);
    document.body.append(container);

    first.focus();
    const cleanup = focus.focusTrap({ container });
    try {
      last.focus();
      const wrap = new KeyboardEvent('keydown', { key: 'Tab' });
      document.dispatchEvent(wrap);
      expect(document.activeElement).toBe(first);

      const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
      document.dispatchEvent(reverse);
      expect(document.activeElement).toBe(last);
    } finally {
      cleanup();
      container.remove();
    }
  });

  it('supports escape routes with direct nodes and ref objects', async () => {
    const onClose = vi.fn();
    function HarnessWithSpies() {
      const [open, setOpen] = useState(true);
      const panelRef = useRef<HTMLDivElement | null>(null);
      const [backdropNode, setBackdropNode] = useState<HTMLButtonElement | null>(null);
      useFocusManagement(open, panelRef);
      useEscapeRoutes(
        () => {
          onClose();
          setOpen(false);
        },
        backdropNode
      );
      return (
        <>
          <div data-testid="outside-alternate">Outside</div>
          {open ? (
            <OverlayRoot>
              <div>
                <div role="dialog" aria-modal="true" ref={panelRef} tabIndex={-1}>
                  <input data-testid="focus-sink" />
                </div>
                <button
                  ref={setBackdropNode}
                  data-testid="backdrop-direct"
                  aria-label="Backdrop direct"
                  type="button"
                />
              </div>
            </OverlayRoot>
          ) : null}
        </>
      );
    }

    const r = render(<HarnessWithSpies />);
    const trapInput = await r.findByTestId('focus-sink');
    trapInput.focus();
    await waitFor(() => expect(document.activeElement).toBe(trapInput));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    r.rerender(<FocusHarness backdropAsNode />);
    const trigger = r.getByTestId('trigger');
    fireEvent.click(trigger);
    const backdrop = await r.findByTestId('backdrop');
    fireEvent.click(backdrop);

    await waitFor(() => expect(r.queryByRole('dialog')).toBeNull());
  });
});
