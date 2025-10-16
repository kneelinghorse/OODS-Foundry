import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';

export type BridgeErrorDetails = {
  details?: unknown;
  incidentId?: string;
};

const CODE_ALIASES: Record<string, string> = {
  RATE_LIMIT: 'RATE_LIMITED',
  CONCURRENCY: 'RATE_LIMITED',
  SCHEMA_INPUT: 'VALIDATION_ERROR',
  SCHEMA_OUTPUT: 'VALIDATION_ERROR',
  BAD_REQUEST: 'VALIDATION_ERROR',
  UNKNOWN_TOOL: 'VALIDATION_ERROR',
  FORBIDDEN_TOOL: 'POLICY_DENIED',
  READ_ONLY_TOOL: 'POLICY_DENIED',
  READ_ONLY_ENFORCED: 'POLICY_DENIED',
  MISSING_TOKEN: 'POLICY_DENIED',
  INVALID_TOKEN: 'POLICY_DENIED',
  PROCESS_EXIT: 'RUN_ERROR',
};

export function normalizeRunErrorCode(code?: string): string {
  if (!code) return 'RUN_ERROR';
  const upper = code.toUpperCase();
  return CODE_ALIASES[upper] ?? upper;
}

export function statusForCode(code: string): number {
  switch (code) {
    case 'POLICY_DENIED':
      return 403;
    case 'RATE_LIMITED':
      return 429;
    case 'TIMEOUT':
      return 504;
    case 'VALIDATION_ERROR':
      return 422;
    default:
      return 400;
  }
}

export function buildErrorPayload(code: string, message: string, options: BridgeErrorDetails = {}) {
  const payload: {
    error: {
      code: string;
      message: string;
      incidentId: string;
      details?: unknown;
    };
  } = {
    error: {
      code,
      message,
      incidentId: options.incidentId ?? randomUUID(),
    },
  };
  if (options.details !== undefined) {
    payload.error.details = options.details;
  }
  return payload;
}

export function sendError(reply: FastifyReply, statusCode: number, code: string, message: string, options?: BridgeErrorDetails) {
  return reply.code(statusCode).send(buildErrorPayload(code, message, options));
}
