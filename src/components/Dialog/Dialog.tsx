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

  const panelClassName = ['cmp-overlay', 'cmp-dialog', className].filter(Boolean).join(' ');

  return (
    <OverlayRoot rootId={rootId}>
      <div className="cmp-overlay__root" aria-hidden={false}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={aria.ariaLabelledBy}
          aria-describedby={aria.ariaDescribedBy}
          ref={panelRef}
          tabIndex={-1}
          className={panelClassName}
          data-overlay="dialog"
        >
          {title ? (
            <h3 id={aria.ariaLabelledBy} className="cmp-dialog__title">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p id={aria.ariaDescribedBy} className="cmp-dialog__description">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        <button
          ref={backdropRef}
          aria-label="Close overlay (backdrop)"
          onClick={() => closeOnBackdrop && onOpenChange(false)}
          className="cmp-overlay__backdrop"
          data-dismiss-enabled={closeOnBackdrop ? 'true' : 'false'}
          type="button"
          tabIndex={-1}
        />
      </div>
    </OverlayRoot>
  );
}
