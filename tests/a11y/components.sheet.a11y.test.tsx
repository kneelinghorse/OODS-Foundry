import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Sheet } from '../../src/components/Sheet/Sheet';
import { ContextPanelDrawer } from '../../src/components/ContextPanelDrawer';

describe('Sheet (a11y smoke)', () => {
  it('exposes role=dialog and aria-modal', () => {
    render(
      <Sheet open onOpenChange={() => {}} anchor="right" size="md">
        <button>ok</button>
      </Sheet>
    );
    const dlg = screen.getByRole('dialog') as HTMLElement;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });
});

// s173 m03 — the composed contextPanel drawer. Sheet's own guarantees are proven above; what
// this adds is that the COMPOSITION keeps them: a drawer that opened an unnamed dialog, or
// that dismissed on Esc without telling its trigger, would pass every Sheet test and still be
// unusable with a screen reader.
describe('ContextPanelDrawer over Sheet (a11y)', () => {
  function narrowContainer() {
    const element = document.createElement('div');
    Object.defineProperty(element, 'offsetWidth', { value: 320, configurable: true });
    document.body.appendChild(element);
    return { current: element } as { current: HTMLElement | null };
  }

  it('the opened drawer is a NAMED modal dialog, named by the panel it replaced', () => {
    render(
      <ContextPanelDrawer containerRef={narrowContainer()} label="Filters">
        <p>filter content</p>
      </ContextPanelDrawer>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    // getByRole with a name only resolves if the accessible name computation succeeds — so
    // this asserts the aria-labelledby wiring, not merely that a heading exists.
    const dlg = screen.getByRole('dialog', { name: 'Filters' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });

  it('Esc closes the drawer AND returns the trigger to its collapsed state', () => {
    render(
      <ContextPanelDrawer containerRef={narrowContainer()} label="Filters">
        <p data-testid="drawer-body">filter content</p>
      </ContextPanelDrawer>
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('drawer-body')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('drawer-body')).toBeNull();
    // The state the trigger ADVERTISES has to follow the state it is in.
    expect(screen.getByRole('button', { name: 'Filters' }).getAttribute('aria-expanded')).toBe('false');
  });
});
