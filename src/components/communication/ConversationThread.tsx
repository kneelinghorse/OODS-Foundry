import type { JSX } from 'react';
import { useMemo } from 'react';

import type { Conversation } from '@/schemas/communication/conversation.js';
import type { Message } from '@/schemas/communication/message.js';

export interface ConversationThreadProps {
  readonly conversation: Conversation;
  readonly onReply: (parentId: string, conversationId?: string) => void;
  readonly maxDepth?: number;
}

interface ThreadNode {
  readonly message: Message;
  readonly children: ThreadNode[];
}

export function ConversationThread({
  conversation,
  onReply,
  maxDepth = 3,
}: ConversationThreadProps): JSX.Element {
  const tree = useMemo(() => buildThread(conversation.messages), [conversation.messages]);

  return (
    <div
      role="tree"
      aria-label="Conversation thread"
      className="space-y-2"
    >
      {tree.map((node) => (
        <ThreadItem
          key={node.message.id}
          node={node}
          depth={1}
          maxDepth={maxDepth}
          conversationId={conversation.id}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

interface ThreadItemProps {
  readonly node: ThreadNode;
  readonly depth: number;
  readonly maxDepth: number;
  readonly conversationId: string;
  readonly onReply: (parentId: string, conversationId?: string) => void;
}

function ThreadItem({
  node,
  depth,
  maxDepth,
  conversationId,
  onReply,
}: ThreadItemProps): JSX.Element {
  const hasChildren = node.children.length > 0;
  const clampedDepth = Math.max(1, depth);
  const indent = `calc(${clampedDepth - 1} * var(--cmp-communication-thread-indent, 1.25rem))`;

  const visibleChildren = node.children.slice(0, 5);
  const remainingCount = node.children.length - visibleChildren.length;

  return (
    <div
      role="treeitem"
      aria-level={clampedDepth}
      aria-expanded={hasChildren && depth < maxDepth}
      className="space-y-1 border-l border-[--cmp-border-subtle] pl-3"
      style={{ marginLeft: indent }}
      data-message-id={node.message.id}
    >
      <div className="flex items-start justify-between gap-2 rounded-md bg-[--cmp-surface] p-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[--sys-text-primary]">
            {typeof node.message.metadata?.subject === 'string' ? node.message.metadata.subject : 'Message'}
          </p>
          <p className="text-xs text-[--sys-text-muted]">
            From {node.message.sender_id} • Status: {node.message.status}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[--cmp-border-subtle] bg-[--cmp-surface] px-2 py-1 text-xs font-semibold text-[--sys-text-primary]"
          onClick={() => onReply(node.message.id, conversationId)}
        >
          Reply
        </button>
      </div>

      {hasChildren && depth < maxDepth ? (
        <div className="space-y-1" role="group">
          {visibleChildren.map((child) => (
            <ThreadItem
              key={child.message.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              conversationId={conversationId}
              onReply={onReply}
            />
          ))}
          {remainingCount > 0 ? (
            <p className="pl-3 text-xs text-[--sys-text-muted]">
              {remainingCount} more repl{remainingCount === 1 ? 'y' : 'ies'} hidden.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildThread(messages: readonly Message[]): ThreadNode[] {
  const byId = new Map<string, ThreadNode>();
  const roots: ThreadNode[] = [];

  for (const message of messages) {
    byId.set(message.id, { message, children: [] });
  }

  for (const message of messages) {
    const parentId = (message.metadata as { parent_message_id?: string } | undefined)?.parent_message_id;
    if (!parentId) {
      continue;
    }
    const parent = byId.get(parentId);
    const node = byId.get(message.id);
    if (!parent || !node) {
      continue;
    }
    parent.children.push(node);
  }

  for (const node of byId.values()) {
    const parentId = (node.message.metadata as { parent_message_id?: string } | undefined)?.parent_message_id;
    if (!parentId || !byId.has(parentId)) {
      roots.push(node);
    }
  }

  return roots;
}
