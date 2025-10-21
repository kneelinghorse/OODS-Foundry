import { type CSSProperties, PropsWithChildren, useMemo, useRef } from 'react';
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

  const dims = useMemo(() => {
    const sizes: Record<SheetSize, number> = { sm: 300, md: 420, lg: 640 };
    const px = sizes[size];
    return { px };
  }, [size]);

  const panelStyle: CSSProperties = useMemo(() => {
    const base: CSSProperties = {
      position: 'fixed',
      background: 'var(--cmp-surface-panel)',
      color: 'var(--cmp-text-body)',
      padding: 'var(--cmp-spacing-inset-default, 1rem)',
      border: '2px solid var(--cmp-border-strong)',
    };
    if (anchor === 'right') return { ...base, top: 0, bottom: 0, right: 0, width: dims.px };
    if (anchor === 'left') return { ...base, top: 0, bottom: 0, left: 0, width: dims.px };
    if (anchor === 'top') return { ...base, top: 0, left: 0, right: 0, height: dims.px };
    return { ...base, bottom: 0, left: 0, right: 0, height: dims.px };
  }, [anchor, dims.px]);

  if (!open) return null;

  return (
    <OverlayRoot rootId={rootId}>
      <div style={{ position: 'fixed', inset: 0 }} aria-hidden={false}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          ref={panelRef}
          tabIndex={-1}
          className={className}
          style={panelStyle}
        >
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
