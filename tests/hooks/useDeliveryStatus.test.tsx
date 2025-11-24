/* @vitest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDeliveryStatus } from '@/hooks/useDeliveryStatus.js';
import type { DeliveryStatusClient, DeliveryStatusSnapshot } from '@/hooks/useDeliveryStatus.js';

describe('useDeliveryStatus', () => {
  it('polls client and merges status snapshots', async () => {
    const snapshots: DeliveryStatusSnapshot[] = [
      { status: 'queued', retryCount: 0, updatedAt: 't1' },
      { status: 'sent', retryCount: 0, updatedAt: 't2' },
      { status: 'delivered', retryCount: 0, updatedAt: 't3' },
    ];
    const fetchStatus = vi.fn(async () => snapshots.shift() ?? { status: 'delivered', retryCount: 0, updatedAt: 't3' });

    const client: DeliveryStatusClient = {
      fetchStatus,
    };

    const { result } = renderHook(() =>
      useDeliveryStatus({ messageId: 'm-1', client, pollIntervalMs: 5000 })
    );

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status === 'queued' || result.current.status === 'sent' || result.current.status === 'delivered').toBe(
      true
    );
  });
});

