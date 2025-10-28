/**
 * Toast Queue Service
 *
 * Provides an imperative API for displaying toast notifications with automatic queuing,
 * stacking, and timeout management. Integrates with Statusables tokens for visual consistency.
 *
 * @example
 * ```tsx
 * import { toast } from './toastService';
 *
 * // Show a success toast
 * toast.show({ intent: 'success', title: 'Saved successfully!' });
 *
 * // Show with custom action
 * toast.show({
 *   intent: 'info',
 *   title: 'Update available',
 *   action: { label: 'Update now', onClick: () => console.log('Updating...') }
 * });
 *
 * // Show sticky toast (manual dismiss only)
 * toast.show({ intent: 'error', title: 'Critical error', duration: 0 });
 * ```
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { StatusDomain, StatusTone } from '../statusables/statusRegistry.js';
import TimeService from '../../services/time/index.js';

export type ToastIntent = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastOptions {
  /** Visual intent mapping to Statusables tokens */
  readonly intent?: ToastIntent;
  /** Domain-specific status (if using status-based tokens) */
  readonly status?: string;
  /** Domain for status resolution */
  readonly domain?: StatusDomain;
  /** Direct tone override */
  readonly tone?: StatusTone;
  /** Main message */
  readonly title: string;
  /** Additional detail text */
  readonly description?: string;
  /** Custom icon element */
  readonly icon?: ReactNode;
  /** Action button/link */
  readonly action?: ToastAction;
  /** Auto-dismiss timeout in ms (0 = sticky/no auto-dismiss) */
  readonly duration?: number;
  /** Whether to show dismiss button */
  readonly isDismissible?: boolean;
  /** Custom dismiss label for a11y */
  readonly dismissLabel?: string;
  /** Override to show/hide icon */
  readonly showIcon?: boolean;
}

export interface ToastInstance extends ToastOptions {
  readonly id: string;
  readonly createdAt: number;
  readonly open: boolean;
}

export type ToastSubscriber = (toasts: readonly ToastInstance[]) => void;

const INTENT_TO_TONE_MAP: Record<ToastIntent, StatusTone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'critical',
};

const DEFAULT_DURATION = 5000;
const DEFAULT_DURATION_WITH_ACTION = 9600;

class ToastManager {
  private queue: ToastInstance[] = [];
  private subscribers: Set<ToastSubscriber> = new Set();
  private counter = 0;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Internal method to clear all state (for testing only) */
  public _resetForTesting(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reset queue
    this.queue = [];

    // Notify subscribers of empty queue
    this.notify();
  }

  private generateId(): string {
    this.counter += 1;
    const timestamp = TimeService.nowSystem().toMillis();
    return `toast-${this.counter}-${timestamp}`;
  }

  private notify(): void {
    const snapshot = Object.freeze([...this.queue]);
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private scheduleAutoDismiss(instance: ToastInstance): void {
    const resolveDuration = (): number => {
      if (instance.duration !== undefined) {
        return instance.duration;
      }
      return instance.action ? DEFAULT_DURATION_WITH_ACTION : DEFAULT_DURATION;
    };

    const duration = resolveDuration();

    if (duration <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.dismiss(instance.id);
    }, duration);

    this.timers.set(instance.id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  public show(options: ToastOptions): string {
    const intent = options.intent ?? 'info';
    const resolvedTone = options.tone ?? INTENT_TO_TONE_MAP[intent];

    const instance: ToastInstance = {
      id: this.generateId(),
      createdAt: TimeService.nowSystem().toMillis(),
      open: true,
      ...options,
      intent,
      tone: resolvedTone,
      isDismissible: options.isDismissible ?? true,
    };

    this.queue.push(instance);
    this.scheduleAutoDismiss(instance);
    this.notify();

    return instance.id;
  }

  public dismiss(id: string): void {
    this.clearTimer(id);

    const index = this.queue.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }

    // Mark as closed first for animation
    this.queue[index] = { ...this.queue[index], open: false };
    this.notify();

    // Remove from queue after animation duration
    setTimeout(() => {
      this.queue = this.queue.filter((item) => item.id !== id);
      this.notify();
    }, 300);
  }

  public dismissAll(): void {
    const ids = this.queue.map((item) => item.id);
    for (const id of ids) {
      this.dismiss(id);
    }
  }

  public subscribe(callback: ToastSubscriber): () => void {
    this.subscribers.add(callback);
    callback(Object.freeze([...this.queue]));

    return () => {
      this.subscribers.delete(callback);
    };
  }

  public getQueue(): readonly ToastInstance[] {
    return Object.freeze([...this.queue]);
  }
}

const manager = new ToastManager();

/**
 * Toast imperative API
 *
 * @example
 * ```tsx
 * toast.show({ intent: 'success', title: 'Operation complete!' });
 * toast.dismiss(toastId);
 * toast.dismissAll();
 * ```
 */
export interface ToastAPI {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  subscribe: (callback: ToastSubscriber) => () => void;
  getQueue: () => readonly ToastInstance[];
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  _resetForTesting: () => void;
}

export const toast: ToastAPI = {
  /**
   * Display a new toast notification
   * @returns Toast ID for manual dismissal
   */
  show: (options: ToastOptions): string => manager.show(options),

  /**
   * Dismiss a specific toast by ID
   */
  dismiss: (id: string): void => manager.dismiss(id),

  /**
   * Dismiss all active toasts
   */
  dismissAll: (): void => manager.dismissAll(),

  /**
   * Subscribe to toast queue changes
   * @returns Unsubscribe function
   */
  subscribe: (callback: ToastSubscriber): (() => void) => manager.subscribe(callback),

  /**
   * Get current toast queue snapshot
   */
  getQueue: (): readonly ToastInstance[] => manager.getQueue(),

  /**
   * @internal Reset manager state (testing only)
   */
  success: (title: string, description?: string): string =>
    manager.show({ intent: 'success', title, description }),
  error: (title: string, description?: string): string =>
    manager.show({ intent: 'error', title, description }),
  warning: (title: string, description?: string): string =>
    manager.show({ intent: 'warning', title, description }),
  info: (title: string, description?: string): string =>
    manager.show({ intent: 'info', title, description }),
  _resetForTesting: (): void => manager._resetForTesting(),
};

export const ToastContext = createContext<ToastAPI>(toast);

export interface ToastProviderProps {
  readonly children?: ReactNode;
  readonly value?: ToastAPI;
}

/**
 * React provider that exposes the toast API via context. Consumers can override the API
 * for testing or custom queue implementations.
 */
export function ToastProvider({ children, value }: ToastProviderProps): ReactElement {
  return createElement(ToastContext.Provider, {
    value: value ?? toast,
    children,
  });
}

export function useToast(): ToastAPI {
  return useContext(ToastContext);
}

/**
 * Subscribes the component to toast queue updates, returning a stable snapshot.
 */
export function useToastQueue(): readonly ToastInstance[] {
  const toastApi = useToast();
  const [queue, setQueue] = useState<readonly ToastInstance[]>(() => toastApi.getQueue());

  useEffect(() => toastApi.subscribe(setQueue), [toastApi]);

  return queue;
}
