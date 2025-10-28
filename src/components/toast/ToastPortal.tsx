/**
 * ToastPortal Component
 *
 * Renders toasts from the queue in a fixed-position portal container.
 * Manages stacking, animations, and ARIA live regions for accessibility.
 *
 * Position defaults to top-right but can be configured via CSS variables.
 *
 * @example
 * ```tsx
 * import { ToastPortal } from './ToastPortal';
 *
 * function App() {
 *   return (
 *     <>
 *       <YourAppContent />
 *       <ToastPortal />
 *     </>
 *   );
 * }
 * ```
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toast } from '../base/Toast.js';
import { useToast, useToastQueue, type ToastInstance } from './toastService.js';

export interface ToastPortalProps {
  /** Container element selector for portal mounting */
  readonly container?: HTMLElement;
  /** Position preset: top-right, top-left, bottom-right, bottom-left */
  readonly position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Maximum number of visible toasts (others queued) */
  readonly maxVisible?: number;
  /** Additional class names */
  readonly className?: string;
}

const DEFAULT_MAX_VISIBLE = 5;

function getPortalRoot(container?: HTMLElement): HTMLElement {
  if (container) {
    return container;
  }

  if (typeof document === 'undefined') {
    // SSR guard
    return undefined as unknown as HTMLElement;
  }

  let root = document.getElementById('toast-portal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-portal-root';
    root.setAttribute('data-toast-portal', 'true');
    document.body.appendChild(root);
  }

  return root;
}

export function ToastPortal({
  container,
  position = 'top-right',
  maxVisible = DEFAULT_MAX_VISIBLE,
  className,
}: ToastPortalProps): React.ReactElement | null {
  const toastApi = useToast();
  const queue = useToastQueue();
  const portalRoot = React.useMemo(() => getPortalRoot(container), [container]);
  const toastRefs = React.useRef(new Map<string, HTMLDivElement | null>());
  const visibleToastsRef = React.useRef<readonly ToastInstance[]>([]);

  const registerToastRef = React.useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        toastRefs.current.set(id, node);
      } else {
        toastRefs.current.delete(id);
      }
    },
    []
  );

  const focusLatestToast = React.useCallback((): boolean => {
    const latest = visibleToastsRef.current[visibleToastsRef.current.length - 1];
    if (!latest) {
      return false;
    }

    const element = toastRefs.current.get(latest.id);
    if (element && typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
      return true;
    }

    return false;
  }, []);

  // Only show the most recent N toasts
  const visibleToasts = React.useMemo(() => {
    return queue.slice(-maxVisible);
  }, [queue, maxVisible]);

  React.useEffect(() => {
    visibleToastsRef.current = visibleToasts;
  }, [visibleToasts]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
        if (focusLatestToast()) {
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusLatestToast]);

  if (typeof document === 'undefined' || !portalRoot) {
    return null;
  }

  const stackClassNames = [
    'toast-portal-stack',
    `toast-portal-stack--${position}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={stackClassNames} data-position={position}>
      {visibleToasts.map((instance) => {
        const actionNode = instance.action ? (
          <button
            type="button"
            className="statusable-toast__action"
            onClick={instance.action.onClick}
          >
            {instance.action.label}
          </button>
        ) : undefined;

        return (
          <Toast
            key={instance.id}
            ref={registerToastRef(instance.id)}
            open={instance.open}
            onOpenChange={(open) => {
              if (!open) {
                toastApi.dismiss(instance.id);
              }
            }}
            status={instance.status}
            domain={instance.domain}
            tone={instance.tone}
            title={instance.title}
            description={instance.description}
            icon={instance.icon}
            action={actionNode}
            autoDismissAfter={0} // Handled by service
            dismissLabel={instance.dismissLabel}
            showIcon={instance.showIcon}
            data-toast-id={instance.id}
          />
        );
      })}
    </div>
  );

  return createPortal(content, portalRoot);
}

ToastPortal.displayName = 'OODS.ToastPortal';
