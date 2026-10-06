/**
 * @oods/sdk — Typed TypeScript client for the OODS Foundry MCP server.
 *
 * Usage:
 *   import { OodsClient } from '@oods/sdk';
 *   const client = new OodsClient();
 *   const result = await client.call('health', {});
 */

export { OodsClient } from './client.js';
export type { OodsClientOptions } from './client.js';

export {
  createTransport,
  StdioTransport,
  HttpTransport,
} from './transport.js';
export type {
  Transport,
  TransportType,
  TransportOptions,
  StdioTransportOptions,
  HttpTransportOptions,
} from './transport.js';

// Re-export all tool input/output types
export type * from './types.js';
