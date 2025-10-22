import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OverlayRoot, useEscapeRoutes, useFocusManagement, useInertOutside } from '../../overlays/manager';

const meta: Meta = {
  title: 'Explorer/Proofs/Overlay Manager',
};

export default meta;
type Story = StoryObj;

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  // Tokenized backdrop surface
  background: 'color-mix(in oklch, var(--cmp-surface-backdrop) 55%, transparent)',
};
const panelStyles: React.CSSProperties = {
  background: 'var(--cmp-surface-panel)',
  color: 'var(--cmp-text-body)',
  padding: 'var(--cmp-spacing-inset-default, 1rem)',
  minWidth: 320,
  border: '2px solid var(--cmp-border-strong)',
  borderRadius: 8,
};

export const ManagerProof: Story = {
  render: () => <OverlayManagerProof />,
};

function OverlayManagerProof() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);

  // Make outside content inert while open
  const inertProps = useMemo(() => ({ 'aria-hidden': open ? true : undefined }), [open]);
  useInertOutside(open, panelRef.current);
  useFocusManagement(open, panelRef);
  useEscapeRoutes(() => setOpen(false), backdropRef);

  return (
    <div>
      <div {...inertProps}>
        <p>Page content (inert while overlay is open):</p>
        <button onClick={() => setOpen(true)}>Open Overlay</button>
        <button disabled>Disabled</button>
        <a href="#" onClick={(e) => e.preventDefault()}>Focusable Link</a>
      </div>

      {open && (
        <OverlayRoot>
          <div style={overlayStyles} aria-hidden={false}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="overlay-manager-title"
              ref={panelRef}
              style={panelStyles}
              tabIndex={-1}
            >
              <h3 id="overlay-manager-title" style={{ marginTop: 0 }}>Overlay Manager Proof</h3>
              <p>Tab cycles within, ESC closes, backdrop clickable.</p>
              <input placeholder="Focusable input" />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="cmp-button" data-tone="accent" onClick={() => (globalThis as any).alert?.('confirm') || console.log('confirm')}>Confirm</button>
                <button className="cmp-button" data-variant="outline" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
            <button
              aria-label="Close overlay (backdrop)"
              ref={backdropRef}
              style={{ position: 'fixed', inset: 0, background: 'transparent', border: 'none' }}
              tabIndex={-1}
            />
          </div>
        </OverlayRoot>
      )}
    </div>
  );
}
