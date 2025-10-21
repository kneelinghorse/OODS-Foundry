import React, { PropsWithChildren, ReactElement, cloneElement, useEffect, useId, useRef, useState } from 'react';
import { OverlayRoot, useEscapeRoutes, useFocusManagement } from '../../overlays/manager';

export type PopoverProps = PropsWithChildren<{
  trigger: ReactElement;
  title?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
}>;

/** Accessible, dismissible popover with focus management */
export function Popover({ trigger, title, children, open, defaultOpen, onOpenChange, id }: PopoverProps) {
  const panelId = (id ?? useId()).replace(/:/g, '');
  const [uncontrolledOpen, setUncontrolled] = useState(!!defaultOpen);
  const actualOpen = open ?? uncontrolledOpen;
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };

  // Position near anchor
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!actualOpen) return;
    const update = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [actualOpen]);

  // Dismissal routes
  useEscapeRoutes(() => setOpen(false), null);
  useEffect(() => {
    if (!actualOpen) return;
    const onDown = (e: MouseEvent) => {
      const p = panelRef.current;
      const a = anchorRef.current;
      const t = e.target as Node | null;
      if (p && a && t && !p.contains(t) && !a.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [actualOpen]);

  // Focus management while open
  useFocusManagement(actualOpen, panelRef);

  const trig = React.Children.only(trigger) as ReactElement;
  const setAnchor = (el: HTMLElement | null) => {
    anchorRef.current = el;
    const childRef: any = (trig as any).ref;
    if (typeof childRef === 'function') childRef(el);
    else if (childRef && 'current' in childRef) childRef.current = el;
  };

  const labelledProps = title ? { 'aria-label': title } : {};

  return (
    <>
      {cloneElement(trig, {
        ref: setAnchor,
        'aria-haspopup': 'dialog',
        'aria-expanded': actualOpen,
        'aria-controls': panelId,
        onClick: (e: any) => {
          trig.props.onClick?.(e);
          setOpen(!actualOpen);
        },
      })}
      {actualOpen && pos && (
        <OverlayRoot>
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal={false}
            {...labelledProps}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-50%)',
              background: 'var(--cmp-surface-panel)',
              color: 'var(--cmp-text-body)',
              border: '1px solid var(--cmp-border-strong)',
              borderRadius: '0.5rem',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--cmp-border-strong) 35%, transparent), var(--cmp-shadow-overlay)',
              padding: 12,
              minWidth: 240,
              maxWidth: 420,
              width: 'max-content',
              zIndex: 1000,
            }}
          >
            {title ? (
              <div id={`${panelId}-label`} style={{ fontWeight: 600, marginBottom: 8 }}>
                {title}
              </div>
            ) : null}
            <div>{children}</div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </OverlayRoot>
      )}
    </>
  );
}

export default Popover;
