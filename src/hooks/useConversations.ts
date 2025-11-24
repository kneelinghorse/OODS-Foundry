import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';

import type { Conversation } from '@/schemas/communication/conversation.js';
import type { Message } from '@/schemas/communication/message.js';

export interface ConversationsClient {
  listConversations(): Promise<Conversation[]>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  addReply(conversationId: string, message: Message): Promise<Message>;
}

export interface UseConversationsOptions {
  readonly client: ConversationsClient;
  readonly autoRefreshIntervalMs?: number;
}

export interface UseConversationsResult {
  readonly conversations: readonly Conversation[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly createConversation: (conversation: Conversation) => Promise<void>;
  readonly addReply: (conversationId: string, message: Message) => Promise<void>;
  readonly refetch: () => Promise<void>;
}

export function useConversations(options: UseConversationsOptions): UseConversationsResult {
  const { client, autoRefreshIntervalMs = 0 } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<number | null>(null);

  const loadConversations = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await client.listConversations();
      setConversations(sortConversations(payload));
    } catch (unknownError) {
      const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to load conversations.');
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadConversations();

    if (!autoRefreshIntervalMs || autoRefreshIntervalMs <= 0) {
      return;
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setInterval(() => {
      void loadConversations();
    }, autoRefreshIntervalMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefreshIntervalMs, loadConversations]);

  const createConversation = useCallback(
    async (conversation: Conversation): Promise<void> => {
      try {
        const created = await client.createConversation(conversation);
        setConversations((previous) => sortConversations([created, ...previous]));
      } catch (unknownError) {
        const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to create conversation.');
        setError(nextError);
      }
    },
    [client]
  );

  const addReply = useCallback(
    async (conversationId: string, message: Message): Promise<void> => {
      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, message],
                  updated_at: message.created_at ?? conversation.updated_at,
                }
              : conversation
          )
        )
      );

      try {
        const persisted = await client.addReply(conversationId, message);
        setConversations((previous) =>
          sortConversations(
            previous.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    messages: conversation.messages.map((entry) =>
                      entry.id === persisted.id ? persisted : entry
                    ),
                    updated_at: persisted.created_at ?? conversation.updated_at,
                  }
                : conversation
            )
          )
        );
      } catch (unknownError) {
        const nextError = unknownError instanceof Error ? unknownError : new Error('Failed to add reply.');
        setError(nextError);
      }
    },
    [client]
  );

  const refetch = useCallback(async (): Promise<void> => {
    await loadConversations();
  }, [loadConversations]);

  const result: UseConversationsResult = useMemo(
    () => ({
      conversations,
      isLoading,
      error,
      createConversation,
      addReply,
      refetch,
    }),
    [conversations, isLoading, error, createConversation, addReply, refetch]
  );

  return result;
}

function sortConversations(entries: readonly Conversation[]): Conversation[] {
  const cloned = [...entries];
  cloned.sort((left, right) => {
    const leftTimestamp = resolveTimestamp(left);
    const rightTimestamp = resolveTimestamp(right);
    return rightTimestamp.localeCompare(leftTimestamp);
  });
  return cloned;
}

function resolveTimestamp(conversation: Conversation): string {
  const candidate = conversation.updated_at ?? conversation.created_at;
  const dateTime = DateTime.fromISO(candidate, { zone: 'utc' });
  if (!dateTime.isValid) {
    return '';
  }
  return dateTime.toISO() ?? '';
}

