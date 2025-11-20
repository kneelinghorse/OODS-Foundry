import type {
  QueueAckToken,
  QueueDequeueOptions,
  QueueEntry,
  QueueMessage,
  QueueNackOptions,
  QueuePeekOptions,
  QueuePurgeOptions,
  QueueStats,
} from '@/traits/communication/runtime-types.js';

export interface QueueAdapterOptions {
  readonly name?: string;
}

export interface QueueAdapter<TPayload> {
  enqueue(message: QueueMessage<TPayload>): Promise<void>;
  dequeue(options?: QueueDequeueOptions): Promise<QueueEntry<TPayload> | null>;
  ack(token: QueueAckToken): Promise<void>;
  nack(token: QueueAckToken, options?: QueueNackOptions): Promise<void>;
  peek(options?: QueuePeekOptions): Promise<readonly QueueMessage<TPayload>[]>;
  stats(): Promise<QueueStats>;
  purge?(options?: QueuePurgeOptions): Promise<void>;
}
