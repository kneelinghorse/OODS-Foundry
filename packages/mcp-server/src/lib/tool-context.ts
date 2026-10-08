/**
 * Per-request context the stdio envelope may carry beside `input` and `role`.
 * The HTTP bridge and the stdio adapter both host the preview server and tell
 * the native process where it listens; tools that never need it ignore it.
 */
export interface ToolContext {
  previewHostUrl?: string;
  /**
   * s238 (0.10.1): set by the MCP adapter on every call from an MCP client. Such a reply is sized for the client: an
   * unset payloadMode becomes a file payload when the output would overflow one reply. The HTTP bridge and direct
   * handler calls (other tools, tests) keep their inline results.
   */
  sizedReply?: boolean;
}

export function readToolContext(value: unknown): ToolContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const context: ToolContext = {};
  if (typeof raw.previewHostUrl === 'string' && /^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(raw.previewHostUrl)) context.previewHostUrl = raw.previewHostUrl;
  if (raw.sizedReply === true) context.sizedReply = true;
  return context;
}
