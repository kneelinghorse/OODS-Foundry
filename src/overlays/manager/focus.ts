export type FocusTrapOptions = {
  container: HTMLElement;
  /** Optional element to restore focus to on cleanup */
  restoreTo?: HTMLElement | null;
};

/** Return tabbable/focusable elements within a container, filtered for enabled/visible-ish */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const all: HTMLElement[] = Array.from(container.querySelectorAll(selectors.join(','))) as HTMLElement[];
  return all.filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Install a simple focus trap within `container`. Returns a cleanup to remove listeners.
 */
export function focusTrap({ container }: FocusTrapOptions): () => void {
  const doc = container.ownerDocument || document;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const list = getFocusable(container);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = doc.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last?.focus?.();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus?.();
    }
  };
  doc.addEventListener('keydown', onKeyDown);
  return () => doc.removeEventListener('keydown', onKeyDown);
}

/** Capture the currently focused element and return a restore function */
export function captureFocusTarget(doc: Document = document): HTMLElement | null {
  return (doc.activeElement as HTMLElement) ?? null;
}

/** Restore focus to a previously captured element if still connected */
export function restoreFocus(target: HTMLElement | null): void {
  if (target && 'focus' in target && target.isConnected) {
    try {
      (target as any).focus();
    } catch {
      // no-op if focus fails
    }
  }
}

