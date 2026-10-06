import { PropsWithChildren, useRef, useCallback, useMemo, useState } from 'react';
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

  /*
   * s173 m04 — THE PANEL ARRIVES A RENDER LATE, and both overlay hooks used to miss it.
   *
   * The panel mounts inside `OverlayRoot`, whose portal host is created in an EFFECT. So on
   * the render that opens the overlay there is no panel yet: `panelRef.current` is null when
   * `useInertOutside` reads it, and `useFocusManagement`'s effect — keyed on `[open,
   * panelRef]`, neither of which changes when the panel finally mounts — never re-runs. The
   * measured consequence was that the FIRST open of any Sheet or Dialog moved no focus, trapped
   * no focus and inerted nothing; the second open worked, because by then the portal host
   * existed. Found by the mobile drawer's Playwright leg: after tapping the trigger, focus
   * stayed on the trigger and two Tabs walked out of the dialog into the page behind it.
   *
   * A CALLBACK REF fixes it deterministically, with no timer and no retry: the element becomes
   * STATE the moment React attaches it, and the memoised ref object handed to the hooks changes
   * identity at that point, so the effect re-runs exactly once, when there is something to act
   * on. `panelRef` is kept in step for any imperative reader.
   */
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanelElement(node);
  }, []);
  const attachedPanelRef = useMemo(() => ({ current: panelElement }), [panelElement]);

  useInertOutside(open, panelElement);
  useFocusManagement(open, attachedPanelRef);
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
          ref={attachPanel}
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
