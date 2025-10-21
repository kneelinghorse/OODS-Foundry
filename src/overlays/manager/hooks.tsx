import { useEffect, useMemo, useRef, useState } from 'react';
import { captureFocusTarget, focusTrap, getFocusable, restoreFocus } from './focus';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    const update = () => setReduced(!!m.matches);
    update();
    m.addEventListener?.('change', update);
    return () => m.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

/** Create or return a stable overlay root portal element */
export function usePortalRoot(id = 'oods-overlay-root'): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const doc = document;
    let node = doc.getElementById(id) as HTMLElement | null;
    if (!node) {
      node = doc.createElement('div');
      node.id = id;
      // Rely on tokenized z-index; do not use numeric literals
      node.style.position = 'relative';
      node.style.zIndex = 'var(--sys-z-overlay, var(--cmp-z-overlay))';
      doc.body.appendChild(node);
    }
    setHost(node);
    return () => {
      // keep root for reuse across overlays
    };
  }, [id]);
  return host;
}

/** Toggle inert-like state for siblings outside the provided element. We use aria-hidden for broad support. */
export function useInertOutside(active: boolean, overlayElement: HTMLElement | null): void {
  useEffect(() => {
    if (!overlayElement) return;
    const doc = overlayElement.ownerDocument || document;
    const bodyChildren = Array.from(doc.body.children) as HTMLElement[];
    const toToggle = bodyChildren.filter((el) => !overlayElement.contains(el) && el.id !== 'oods-overlay-root');
    toToggle.forEach((el) => {
      if (active) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
    });
    return () => {
      toToggle.forEach((el) => el.removeAttribute('aria-hidden'));
    };
  }, [active, overlayElement]);
}

/** Install ESC and optional backdrop click handlers */
export function useEscapeRoutes(onClose: () => void, backdropRef?: React.RefObject<HTMLElement>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const backdrop = backdropRef?.current ?? null;
    const onClick = (e: Event) => {
      if (e.target === backdrop) onClose();
    };
    if (backdrop) backdrop.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (backdrop) backdrop.removeEventListener('click', onClick);
    };
  }, [onClose, backdropRef?.current]);
}

/** Manage focus on open/close for the given panel element */
export function useFocusManagement(open: boolean, panelRef: React.RefObject<HTMLElement>) {
  const restoreTargetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (open) {
      restoreTargetRef.current = captureFocusTarget(panel.ownerDocument || document);
      let cleanup: (() => void) | undefined;
      const tick = () => {
        const list = getFocusable(panel);
        (list[0] ?? panel).focus();
        cleanup = focusTrap({ container: panel });
      };
      // Defer to ensure portal content is committed
      const t = setTimeout(tick, 0);
      return () => {
        clearTimeout(t);
        cleanup?.();
      };
    }
    restoreFocus(restoreTargetRef.current);
    return undefined;
  }, [open, panelRef]);
}
