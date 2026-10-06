/**
 * Per-request context the stdio envelope may carry beside `input` and `role`.
 * The HTTP bridge and the stdio adapter both host the preview server and tell
 * the native process where it listens; tools that never need it ignore it.
 */
export interface ToolContext {
  previewHostUrl?: string;
}

export function readToolContext(value: unknown): ToolContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const context: ToolContext = {};
  if (typeof raw.previewHostUrl === 'string' && /^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(raw.previewHostUrl)) context.previewHostUrl = raw.previewHostUrl;
  return context;
}
