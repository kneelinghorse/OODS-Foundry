import { PropsWithChildren, useId, useMemo, useRef } from 'react';
import { OverlayRoot } from '../../overlays/manager/OverlayRoot';
import { useEscapeRoutes, useFocusManagement, useInertOutside } from '../../overlays/manager/hooks';

export type DialogProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  labelledBy?: string;
  describedBy?: string;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  rootId?: string;
  className?: string;
}>;

/** Accessible modal dialog built on the Overlay Manager hooks */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  labelledBy,
  describedBy,
  closeOnEsc = true,
  closeOnBackdrop = false,
  rootId,
  className,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);

  // Manage outside inertness and focus trapping
  useInertOutside(open, panelRef.current);
  useFocusManagement(open, panelRef);
  useEscapeRoutes(
    () => {
      if (closeOnEsc) onOpenChange(false);
    },
    closeOnBackdrop ? backdropRef : null
  );

  const autoIds = {
    titleId: useId(),
    descId: useId(),
  };
  const aria = useMemo(() => {
    const ariaLabelledBy = labelledBy || (title ? autoIds.titleId : undefined);
    const ariaDescribedBy = describedBy || (description ? autoIds.descId : undefined);
    return { ariaLabelledBy, ariaDescribedBy };
  }, [labelledBy, describedBy, title, description, autoIds.titleId, autoIds.descId]);

  if (!open) return null;

  return (
    <OverlayRoot rootId={rootId}>
      <div
        style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}
        aria-hidden={false}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={aria.ariaLabelledBy}
          aria-describedby={aria.ariaDescribedBy}
          ref={panelRef}
          tabIndex={-1}
          className={className}
          style={{
            background: 'var(--cmp-surface-panel)',
            color: 'var(--cmp-text-body)',
            padding: 'var(--cmp-spacing-inset-default, 1rem)',
            minWidth: 320,
            border: '2px solid var(--cmp-border-strong)',
            borderRadius: 8,
            boxShadow: '0 24px 56px -16px rgba(15,23,42,0.24)'
          }}
        >
          {title ? (
            <h3 id={aria.ariaLabelledBy} style={{ marginTop: 0 }}>
              {title}
            </h3>
          ) : null}
          {description ? (
            <p id={aria.ariaDescribedBy} style={{ marginTop: 4 }}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
        <button
          ref={backdropRef}
          aria-label="Close overlay (backdrop)"
          onClick={() => closeOnBackdrop && onOpenChange(false)}
          style={{ position: 'fixed', inset: 0, background: 'transparent', border: 'none' }}
          tabIndex={-1}
        />
      </div>
    </OverlayRoot>
  );
}
