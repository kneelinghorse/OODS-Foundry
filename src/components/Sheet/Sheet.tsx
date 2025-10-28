import { PropsWithChildren, useRef } from 'react';
import { OverlayRoot } from '../../overlays/manager/OverlayRoot';
import { useEscapeRoutes, useFocusManagement, useInertOutside } from '../../overlays/manager/hooks';

export type SheetAnchor = 'top' | 'right' | 'bottom' | 'left';
export type SheetSize = 'sm' | 'md' | 'lg';

export type SheetProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor?: SheetAnchor;
  size?: SheetSize;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  rootId?: string;
  className?: string;
  labelledBy?: string;
}>;

/** Edge-anchored overlay panel (aka Sheet/Drawer) */
export function Sheet({
  open,
  onOpenChange,
  anchor = 'right',
  size = 'md',
  closeOnEsc = true,
  closeOnBackdrop = true,
  rootId,
  className,
  labelledBy,
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);

  useInertOutside(open, panelRef.current);
  useFocusManagement(open, panelRef);
  useEscapeRoutes(
    () => {
      if (closeOnEsc) onOpenChange(false);
    },
    closeOnBackdrop ? backdropRef : null
  );

  if (!open) return null;

  const panelClassName = ['cmp-overlay', 'cmp-sheet', className].filter(Boolean).join(' ');

  return (
    <OverlayRoot rootId={rootId}>
      <div className="cmp-overlay__root" data-overlay-anchor={anchor} aria-hidden={false}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          ref={panelRef}
          tabIndex={-1}
          className={panelClassName}
          data-overlay="sheet"
          data-anchor={anchor}
          data-size={size}
        >
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
