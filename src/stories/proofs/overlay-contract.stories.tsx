import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Proofs/Overlay Contract',
};

export default meta;
type Story = StoryObj;

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]','button:not([disabled])','textarea:not([disabled])','input:not([disabled])',
    'select:not([disabled])','[tabindex]:not([tabindex="-1"])'
  ];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
  return nodes.filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  // Use tokenized backdrop tone; mix to achieve scrim effect with safe fallback
  backgroundColor: 'var(--cmp-surface-backdrop)',
  background: 'color-mix(in oklch, var(--cmp-surface-backdrop) 55%, transparent)',
};
const panelStyles: React.CSSProperties = {
  // Tokenized panel and text colours
  background: 'var(--cmp-surface-panel)',
  color: 'var(--cmp-text-body)',
  padding: 'var(--cmp-spacing-inset-default, 1rem)',
  minWidth: 320,
  // Tokenized border emphasis for HC/brand contrast
  border: '2px solid var(--cmp-border-strong)',
  borderRadius: 8,
  // Keep a shadow for non-HC; forced-colors will ignore it and rely on border
  boxShadow: '0 24px 56px -16px rgba(15,23,42,0.24)'
};

export const ContractProof: Story = {
  render: () => <OverlayProof />,
};

function OverlayProof() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocused.current = (document.activeElement as HTMLElement) ?? null;
      const panel = panelRef.current!;
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { setOpen(false); }
        if (e.key === 'Tab') {
          const els = getFocusable(panel);
          if (!els.length) return;
          const first = els[0];
          const last = els[els.length - 1];
          const active = document.activeElement as HTMLElement;
          if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    } else if (lastFocused.current) {
      lastFocused.current.focus();
    }
  }, [open]);

  const outsideInertProps = useMemo(() => ({ 'aria-hidden': open ? true : undefined }), [open]);

  return (
    <div>
      <div {...outsideInertProps}>
        <p>Page content (inert while overlay is open):</p>
        <button onClick={() => setOpen(true)}>Open Overlay</button>
        <button disabled>Disabled</button>
        <a href="#" onClick={(e) => e.preventDefault()}>Focusable Link</a>
      </div>

      {open && (
        <div style={overlayStyles} aria-hidden={false}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-title"
            ref={panelRef}
            style={panelStyles}
            tabIndex={-1}
          >
            <h3 id="overlay-title" style={{ marginTop: 0, color: 'var(--cmp-text-body)' }}>Overlay Contract Proof</h3>
            <p>Tab cycles within, ESC closes, backdrop clickable.</p>
            <input placeholder="Focusable input" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="cmp-button" data-tone="accent" onClick={() => alert('confirm')}>Confirm</button>
              <button className="cmp-button" data-variant="outline" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          <button
            aria-label="Close overlay (backdrop)"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'transparent', border: 'none' }}
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  );
}
