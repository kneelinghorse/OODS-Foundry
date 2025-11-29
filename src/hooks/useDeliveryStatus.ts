import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryStatus } from '@/traits/communication/sla-monitor.js';

export interface DeliveryStatusSnapshot {
  readonly status: DeliveryStatus;
  readonly retryCount: number;
  readonly updatedAt: string;
}

export interface DeliveryStatusClient {
  fetchStatus(messageId: string): Promise<DeliveryStatusSnapshot>;
}

export interface UseDeliveryStatusOptions {
  readonly messageId?: string;
  readonly client: DeliveryStatusClient;
  readonly pollIntervalMs?: number;
}

export interface UseDeliveryStatusResult {
  readonly status: DeliveryStatus;
  readonly retryCount: number;
  readonly updatedAt: string | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
}

export function useDeliveryStatus(options: UseDeliveryStatusOptions): UseDeliveryStatusResult {
  const { messageId, client, pollIntervalMs = 5000 } = options;

  const [status, setStatus] = useState<DeliveryStatus>('queued');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const lastSnapshotRef = useRef<DeliveryStatusSnapshot | null>(null);
  const timerRef = useRef<number | null>(null);

  const effectiveInterval = Math.max(pollIntervalMs, 5000);

  const refresh = useCallback(async (): Promise<void> => {
    if (!messageId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await client.fetchStatus(messageId);
      const merged = mergeSnapshots(lastSnapshotRef.current, snapshot);
      lastSnapshotRef.current = merged;

      setStatus(merged.status);
      setRetryCount(merged.retryCount);
      setUpdatedAt(merged.updatedAt);
    } catch (unknownError) {
      const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to fetch delivery status.');
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [client, messageId]);

  useEffect(() => {
    lastSnapshotRef.current = null;
    setStatus('queued');
    setRetryCount(0);
    setUpdatedAt(null);
    setError(null);

    if (!messageId) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    void refresh();

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setInterval(() => {
      void refresh();
    }, effectiveInterval);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [effectiveInterval, messageId, refresh]);

  const result: UseDeliveryStatusResult = useMemo(
    () => ({
      status,
      retryCount,
      updatedAt,
      loading,
      error,
      refresh,
    }),
    [status, retryCount, updatedAt, loading, error, refresh]
  );

  return result;
}

function mergeSnapshots(
  previous: DeliveryStatusSnapshot | null,
  next: DeliveryStatusSnapshot
): DeliveryStatusSnapshot {
  if (!previous) {
    return next;
  }

  const order: Record<DeliveryStatus, number> = {
    queued: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    failed: 4,
    retried: 5,
    retry_exhausted: 6,
  };

  const previousRank = order[previous.status] ?? 0;
  const nextRank = order[next.status] ?? 0;

  if (nextRank >= previousRank) {
    return next;
  }

  return {
    status: previous.status,
    retryCount: Math.max(previous.retryCount, next.retryCount),
    updatedAt: previous.updatedAt,
  };
}

