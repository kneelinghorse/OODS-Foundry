import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '@/schemas/communication/message.js';
import TimeService from '@/services/time/index.js';

export interface MessagesPage {
  readonly messages: readonly Message[];
  readonly hasMore: boolean;
}

export interface UseMessagesOptions {
  readonly fetchPage: (cursor?: string) => Promise<MessagesPage>;
  readonly markAsRead?: (id: string) => Promise<void> | void;
  readonly initialCursor?: string;
}

export interface UseMessagesResult {
  readonly messages: readonly Message[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasMore: boolean;
  readonly loadMore: () => Promise<void>;
  readonly markAsRead: (id: string) => Promise<void>;
}

export function useMessages(options: UseMessagesOptions): UseMessagesResult {
  const { fetchPage, markAsRead: remoteMarkAsRead, initialCursor } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadingRef = useRef(false);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingRef.current || !hasMore) {
      return;
    }
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const page = await fetchPage(cursor);
      setHasMore(page.hasMore);

      setMessages((previous) => {
        const merged = mergeMessages(previous, page.messages);
        const last = merged[merged.length - 1];
        if (last?.created_at) {
          setCursor(last.created_at);
        }
        return merged;
      });
    } catch (unknownError) {
      const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to load messages.');
      setError(nextError);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [cursor, fetchPage, hasMore]);

  useEffect(() => {
    void loadMore();
  }, [loadMore]);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === id
            ? {
                ...message,
                status: 'read',
                read_at: message.read_at ?? TimeService.toIsoString(TimeService.nowSystem()),
              }
            : message
        )
      );

      if (!remoteMarkAsRead) {
        return;
      }

      try {
        await remoteMarkAsRead(id);
      } catch (unknownError) {
        const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to mark message as read.');
        setError(nextError);
      }
    },
    [remoteMarkAsRead]
  );

  const result: UseMessagesResult = useMemo(
    () => ({
      messages,
      isLoading,
      error,
      hasMore,
      loadMore,
      markAsRead,
    }),
    [messages, isLoading, error, hasMore, loadMore, markAsRead]
  );

  return result;
}

function mergeMessages(
  previous: readonly Message[],
  incoming: readonly Message[]
): Message[] {
  if (incoming.length === 0) {
    return [...previous];
  }

  const byId = new Map<string, Message>();
  for (const message of previous) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const left = a.created_at ?? '';
    const right = b.created_at ?? '';
    return left.localeCompare(right);
  });

  return merged;
}

