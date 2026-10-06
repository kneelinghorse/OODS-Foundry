/** @vitest-environment jsdom */
// s173 m03 (crawl 2) — the contextPanel drawer, the opt-in half of the collapse.
//
// The claims worth testing here are not "a Sheet opens" (Sheet has its own proof) but the
// three that make this composition safe to add to a design system:
//   1. Above the threshold it is INERT — same children, no wrapper element, no trigger. A
//      component that changed wide layouts would have moved every context snapshot.
//   2. Below the threshold the panel content is reachable through a labelled trigger, and
//      the dialog it opens carries the accessible name.
//   3. The threshold is the TOKEN, not a number typed into the component — so the drawer
//      appears at exactly the width the CSS releases the rail. A drawer that opened at a
//      different width than the collapse would be worse than no drawer.
//
// jsdom has no layout engine, so `offsetWidth` is 0 for everything by default and
// ResizeObserver does not exist. Both are supplied explicitly below rather than mocked away:
// the width comes from a defined property (the real code path reads offsetWidth) and the
// absent ResizeObserver exercises the component's documented window-resize fallback.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextPanelDrawer } from '../../src/components/ContextPanelDrawer';
import { VIEW_COLLAPSE_PX } from '../../src/styles/breakpoints.js';

/** A container whose offsetWidth is whatever the test says it is. */
function containerAt(width: number) {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true });
  document.body.appendChild(element);
  const ref = createRef<HTMLElement | null>() as { current: HTMLElement | null };
  ref.current = element;
  return { element, ref };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ContextPanelDrawer — wide container (s173 m03)', () => {
  it('renders its children INLINE with no trigger and no wrapper element', () => {
    const { ref } = containerAt(VIEW_COLLAPSE_PX + 1);
    const { container } = render(
      <ContextPanelDrawer containerRef={ref} label="Context panel">
        <p data-testid="panel-body">Related records</p>
      </ContextPanelDrawer>,
    );

    expect(screen.getByTestId('panel-body')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /context panel/i })).toBeNull();
    // No wrapper: the composed panel's markup above the threshold is the children, exactly.
    expect(container.firstElementChild?.tagName).toBe('P');
    expect(container.childElementCount).toBe(1);
  });
});

describe('ContextPanelDrawer — narrow container (s173 m03)', () => {
  it('puts the content behind a labelled trigger that opens a modal dialog', () => {
    const { ref } = containerAt(320);
    render(
      <ContextPanelDrawer containerRef={ref} label="Context panel" triggerLabel="Show context">
        <p data-testid="panel-body">Related records</p>
      </ContextPanelDrawer>,
    );

    const trigger = screen.getByRole('button', { name: 'Show context' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    // Closed: the content is not merely hidden, it is not rendered — so a screen reader
    // cannot reach a panel the sighted user cannot see.
    expect(screen.queryByTestId('panel-body')).toBeNull();

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByTestId('panel-body')).toBeTruthy();
    // The dialog's accessible name comes from the heading the drawer supplies.
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Context panel');

    // The trigger's own state follows. Queried through the DOM rather than by ROLE on
    // purpose: with the drawer open the trigger is outside the modal and therefore
    // aria-hidden, so it is correctly absent from the accessibility tree — asserting it is
    // still findable by role would be asserting that the modal fails to be modal. (That is
    // exactly what this test did before s173 m04 fixed useInertOutside, and it passed.)
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Show context' })).toBeNull();
  });
});

describe('ContextPanelDrawer — the threshold is the token (s173 m03)', () => {
  it('collapses at EXACTLY sys.breakpoint.md, inclusive, and not one pixel wider', () => {
    // The boundary is asserted from both sides against the token value, so the drawer and
    // the `@container (max-width: 48rem)` rule can never disagree about where they switch.
    const atThreshold = containerAt(VIEW_COLLAPSE_PX);
    render(
      <ContextPanelDrawer containerRef={atThreshold.ref} label="Panel A">
        <p>content</p>
      </ContextPanelDrawer>,
    );
    expect(screen.getByRole('button', { name: 'Panel A' })).toBeTruthy();

    document.body.innerHTML = '';
    const justOver = containerAt(VIEW_COLLAPSE_PX + 1);
    render(
      <ContextPanelDrawer containerRef={justOver.ref} label="Panel B">
        <p>content</p>
      </ContextPanelDrawer>,
    );
    expect(screen.queryByRole('button', { name: 'Panel B' })).toBeNull();
  });

  it('resolves a container ref owned by an ANCESTOR rendered in the SAME commit', async () => {
    // THE BUG THIS PINS, found by the Playwright leg and invisible to every other test here:
    // React attaches refs bottom-up, so when this hook's layout effect runs on the first
    // commit, an ancestor's ref is still null. The hook used to give up there — no container,
    // no ResizeObserver, no retry — and the drawer never appeared in a real render, while all
    // the tests above passed because they hand it an element that is already attached.
    //
    // This renders the real shape: a shell that owns the ref, with the drawer inside it.
    function Shell() {
      const shellRef = useRef<HTMLDivElement | null>(null);
      return (
        <div ref={shellRef} data-testid="shell">
          <ContextPanelDrawer containerRef={shellRef} label="Panel D">
            <p data-testid="panel-body">content</p>
          </ContextPanelDrawer>
        </div>
      );
    }

    render(<Shell />);
    // jsdom reports offsetWidth 0 for everything, so define it on the element the shell just
    // attached — the width has to come from somewhere, and this keeps the code path real.
    const shell = screen.getByTestId('shell');
    Object.defineProperty(shell, 'offsetWidth', { value: 320, configurable: true });

    // The retry lands on the next animation frame.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Panel D' })).toBeTruthy());
  });

  it('an unlaid-out container (width 0) is NOT treated as narrow', () => {
    // Otherwise every mount would flash a drawer trigger before layout, on every view.
    const { ref } = containerAt(0);
    render(
      <ContextPanelDrawer containerRef={ref} label="Panel C">
        <p data-testid="panel-body">content</p>
      </ContextPanelDrawer>,
    );
    expect(screen.queryByRole('button', { name: 'Panel C' })).toBeNull();
    expect(screen.getByTestId('panel-body')).toBeTruthy();
  });
});
