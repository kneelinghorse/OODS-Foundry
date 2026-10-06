import { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Explorer/Proofs/Overlay Contract',
};

export default meta;
type Story = StoryObj;

function getFocusable(container: unknown): any[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const host = container as any;
  const list: any[] = Array.from(host?.querySelectorAll?.(selectors.join(',')) ?? []);
  return list.filter((el) => !el?.hasAttribute?.('disabled') && !el?.getAttribute?.('aria-hidden')) as any[];
}

export const ContractProof: Story = {
  render: () => <OverlayProof />,
};

function OverlayProof() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const doc: any = (globalThis as any).document;
    if (open && doc) {
      lastFocused.current = (doc.activeElement as HTMLElement) ?? null;
      const panel = panelRef.current as any;
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel)?.focus?.();
      const onKeyDown = (e: any) => {
        if (e?.key === 'Escape') {
          setOpen(false);
        }
        if (e?.key === 'Tab') {
          const els = getFocusable(panel);
          if (!els.length) return;
          const first = els[0];
          const last = els[els.length - 1];
          const active = doc.activeElement as any;
          if (e.shiftKey && active === first) {
            e.preventDefault();
            last?.focus?.();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first?.focus?.();
          }
        }
      };
      doc.addEventListener('keydown', onKeyDown);
      return () => doc.removeEventListener('keydown', onKeyDown);
    }
    if (!open && lastFocused.current) {
      (lastFocused.current as any)?.focus?.();
    }
    return undefined;
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
        <div className="cmp-overlay__root" aria-hidden={false}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-title"
            ref={panelRef}
            className="cmp-overlay cmp-dialog"
            tabIndex={-1}
          >
            <h3 id="overlay-title" className="cmp-dialog__title">Overlay Contract Proof</h3>
            <p>Tab cycles within, ESC closes, backdrop clickable.</p>
            <input placeholder="Focusable input" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="cmp-button" data-tone="accent" onClick={() => (globalThis as any).alert?.('confirm') || console.log('confirm')}>Confirm</button>
              <button className="cmp-button" data-variant="outline" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          <button
            aria-label="Close overlay (backdrop)"
            onClick={() => setOpen(false)}
            className="cmp-overlay__backdrop"
            type="button"
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  );
}
