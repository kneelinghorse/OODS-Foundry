import { createError, type StructuredError } from './registry.js';

/**
 * Throwable error that carries a registered OODS error code.
 * Tool handlers throw ToolError; the framework converts it
 * to a structured response automatically.
 */
export class ToolError extends Error {
  readonly opiCode: string;
  readonly details?: unknown;

  constructor(code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'ToolError';
    this.opiCode = code;
    this.details = details;
  }

  toStructured(): StructuredError {
    return createError(this.opiCode, {
      message: this.message,
      details: this.details,
    });
  }
}

export function isToolError(value: unknown): value is ToolError {
  return value instanceof ToolError;
}
