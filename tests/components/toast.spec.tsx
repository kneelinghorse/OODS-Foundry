/* @vitest-environment jsdom */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastPortal } from '../../src/components/toast/ToastPortal.js';
import {
  toast,
  ToastProvider,
  useToastQueue,
} from '../../src/components/toast/toastService.js';

describe('toast service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast._resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    toast._resetForTesting();
  });

  describe('toast.show()', () => {
    it('adds a toast to the queue and returns an ID', () => {
      const id = toast.show({ intent: 'info', title: 'Test toast' });

      expect(id).toMatch(/^toast-\d+-\d+$/);

      const queue = toast.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.title).toBe('Test toast');
    });

    it('maps intents to tones and supports overrides', () => {
      toast.show({ intent: 'success', title: 'Success' });
      toast.show({ intent: 'error', title: 'Error' });
      toast.show({ intent: 'info', tone: 'accent', title: 'Custom' });

      const queue = toast.getQueue();
      expect(queue[0]?.tone).toBe('success');
      expect(queue[1]?.tone).toBe('critical');
      expect(queue[2]?.tone).toBe('accent');
    });

    it('respects custom dismissibility', () => {
      toast.show({ intent: 'info', title: 'Dismissible default' });
      toast.show({ intent: 'info', title: 'Sticky', isDismissible: false });

      const queue = toast.getQueue();
      expect(queue[0]?.isDismissible).toBe(true);
      expect(queue[1]?.isDismissible).toBe(false);
    });
  });

  describe('queue management', () => {
    it('stacks toasts in FIFO order', () => {
      const id1 = toast.show({ intent: 'info', title: 'First' });
      const id2 = toast.show({ intent: 'success', title: 'Second' });
      const id3 = toast.show({ intent: 'warning', title: 'Third' });

      const queue = toast.getQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0]?.id).toBe(id1);
      expect(queue[1]?.id).toBe(id2);
      expect(queue[2]?.id).toBe(id3);
    });

    it('dismisses toasts by ID and in bulk', () => {
      const id1 = toast.show({ intent: 'info', title: 'First' });
      toast.show({ intent: 'info', title: 'Second' });

      toast.dismiss(id1);
      vi.advanceTimersByTime(300);
      expect(toast.getQueue()).toHaveLength(1);

      toast.dismissAll();
      vi.advanceTimersByTime(300);
      expect(toast.getQueue()).toHaveLength(0);
    });
  });

  describe('timeouts', () => {
    it('auto-dismisses after the default duration', () => {
      toast.show({ intent: 'info', title: 'Auto dismiss' });

      vi.advanceTimersByTime(5000);
      expect(toast.getQueue()[0]?.open).toBe(false);

      vi.advanceTimersByTime(300);
      expect(toast.getQueue()).toHaveLength(0);
    });

    it('extends duration when actions are present', () => {
      toast.show({
        intent: 'info',
        title: 'With action',
        action: { label: 'Undo', onClick: () => {} },
      });

      vi.advanceTimersByTime(5000);
      expect(toast.getQueue()).toHaveLength(1);

      vi.advanceTimersByTime(4600);
      expect(toast.getQueue()[0]?.open).toBe(false);
    });

    it('supports custom durations and sticky mode', () => {
      toast.show({ intent: 'info', title: 'Custom duration', duration: 2000 });
      toast.show({ intent: 'error', title: 'Sticky', duration: 0 });

      vi.advanceTimersByTime(2000);
      expect(toast.getQueue()[0]?.open).toBe(false);

      vi.advanceTimersByTime(300);
      expect(toast.getQueue()).toHaveLength(1);
      expect(toast.getQueue()[0]?.open).toBe(true);

      vi.advanceTimersByTime(10000);
      expect(toast.getQueue()[0]?.open).toBe(true);
    });
  });

  describe('subscriptions and helpers', () => {
    it('notifies subscribers with immutable snapshots', () => {
      const snapshots: readonly unknown[][] = [];

      const unsubscribe = toast.subscribe((queue) => {
        snapshots.push(queue);
      });

      toast.show({ intent: 'info', title: 'First' });
      toast.show({ intent: 'info', title: 'Second' });

      expect(snapshots.length).toBeGreaterThan(1);
      expect(() => {
        // @ts-expect-error verifying immutability
        snapshots[0]?.push('mutate');
      }).toThrow();

      unsubscribe();
    });

    it('exposes useToastQueue hook to subscribers', async () => {
      const HookProbe: React.FC = () => {
        const queue = useToastQueue();
        return <div data-testid="count">{queue.length}</div>;
      };

      const Wrapper: React.FC = () => (
        <ToastProvider>
          <HookProbe />
        </ToastProvider>
      );

      const { getByTestId } = render(<Wrapper />);
      expect(getByTestId('count').textContent).toBe('0');

      await act(async () => {
        toast.show({ intent: 'success', title: 'Hook toast' });
      });

      expect(getByTestId('count').textContent).toBe('1');
    });
  });

  describe('convenience helpers', () => {
    it('provides shorthand methods for intents', () => {
      toast.success('Success message');
      expect(toast.getQueue()[0]?.intent).toBe('success');

      toast.error('Error message', 'Details');
      expect(toast.getQueue()[1]?.description).toBe('Details');

      toast.warning('Warning message');
      expect(toast.getQueue()[2]?.intent).toBe('warning');

      toast.info('Info message');
      expect(toast.getQueue()[3]?.intent).toBe('info');
    });
  });
});

describe('ToastPortal', () => {
  beforeEach(() => {
    toast._resetForTesting();
  });

  afterEach(() => {
    toast._resetForTesting();
    const portalRoot = document.getElementById('toast-portal-root');
    portalRoot?.remove();
  });

  it('renders role=status toasts from the queue', async () => {
    render(<ToastPortal />);

    await act(async () => {
      toast.show({ intent: 'success', title: 'Success toast' });
    });

    await waitFor(() => {
      const portal = document.getElementById('toast-portal-root');
      const toastElement = portal?.querySelector('[role="status"]');
      expect(toastElement).toBeTruthy();
      expect(toastElement?.textContent).toContain('Success toast');
    });
  });

  it('stacks multiple toasts without exceeding maxVisible', async () => {
    render(<ToastPortal maxVisible={2} />);

    await act(async () => {
      toast.success('First');
      toast.success('Second');
      toast.success('Third');
    });

    await waitFor(() => {
      const portal = document.getElementById('toast-portal-root');
      const toasts = portal?.querySelectorAll('[role="status"]');
      expect(toasts?.length).toBe(2);
    });
  });

  it('applies position modifiers for placement', async () => {
    render(<ToastPortal position="bottom-left" />);

    await act(async () => {
      toast.show({ intent: 'info', title: 'Test positioning' });
    });

    await waitFor(() => {
      const portal = document.getElementById('toast-portal-root');
      const stack = portal?.querySelector('.toast-portal-stack');
      expect(stack?.classList.contains('toast-portal-stack--bottom-left')).toBe(true);
    });
  });

  it('removes toasts after dismissal', async () => {
    render(<ToastPortal />);

    let id: string;
    await act(async () => {
      id = toast.show({ intent: 'info', title: 'Dismissible' });
    });

    await waitFor(() => {
      const portal = document.getElementById('toast-portal-root');
      expect(portal?.querySelector('[role="status"]')).toBeTruthy();
    });

    await act(async () => {
      toast.dismiss(id!);
    });

    await waitFor(
      () => {
        const portal = document.getElementById('toast-portal-root');
        expect(portal?.querySelector('[role="status"]')).toBeFalsy();
      },
      { timeout: 3000 }
    );
  });

  it('renders action buttons when provided', async () => {
    const handleAction = vi.fn();
    render(<ToastPortal />);

    await act(async () => {
      toast.show({
        intent: 'info',
        title: 'With action',
        action: { label: 'Undo', onClick: handleAction },
      });
    });

    await waitFor(
      () => {
        const portal = document.getElementById('toast-portal-root');
        const actionButton = portal?.querySelector('.statusable-toast__action');
        expect(actionButton).toBeTruthy();
        expect(actionButton?.textContent).toBe('Undo');
      },
      { timeout: 3000 }
    );
  });

  it('supports focus shortcut to highlight latest toast', async () => {
    const Harness: React.FC = () => (
      <>
        <button type="button" data-testid="focus-sink">
          Focus sink
        </button>
        <ToastPortal />
      </>
    );

    const { getByTestId } = render(<Harness />);

    await act(async () => {
      toast.show({ intent: 'info', title: 'Shortcut toast' });
    });

    let toastElement: Element | null = null;

    await waitFor(() => {
      const portal = document.getElementById('toast-portal-root');
      toastElement = portal?.querySelector('[data-toast-id]');
      expect(toastElement).toBeTruthy();
    });

    getByTestId('focus-sink').focus();
    expect(document.activeElement).toBe(getByTestId('focus-sink'));

    const keyboardEvent = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true });
    document.dispatchEvent(keyboardEvent);

    await waitFor(() => {
      expect(document.activeElement).toBe(toastElement);
    });
  });
});
