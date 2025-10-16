import { randomUUID } from 'node:crypto';

export type TypedError = {
  code: string;
  message: string;
  details?: unknown;
  incidentId: string;
};

export function err(code: string, message: string, details?: unknown): TypedError {
  return { code, message, details, incidentId: randomUUID() };
}

export const ERROR_CODES = {
  POLICY_DENIED: 'POLICY_DENIED',
  RATE_LIMIT: 'RATE_LIMIT',
  CONCURRENCY: 'CONCURRENCY',
  TIMEOUT: 'TIMEOUT',
  SCHEMA_INPUT: 'SCHEMA_INPUT',
  SCHEMA_OUTPUT: 'SCHEMA_OUTPUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
} as const;
