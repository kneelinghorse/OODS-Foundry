/**
 * Transport layer for OODS MCP tool invocation.
 *
 * Abstracts the underlying protocol (stdio for local MCP, HTTP for bridge).
 */

export interface ToolCallResult<T = unknown> {
  result: T;
}

export interface Transport {
  call<T = unknown>(tool: string, input: Record<string, unknown>): Promise<T>;
  close?(): Promise<void>;
}

export type TransportType = 'stdio' | 'http';

export interface StdioTransportOptions {
  type: 'stdio';
  command?: string;
  args?: string[];
}

export interface HttpTransportOptions {
  type: 'http';
  baseUrl: string;
  headers?: Record<string, string>;
}

export type TransportOptions = StdioTransportOptions | HttpTransportOptions;

/**
 * Stdio transport placeholder.
 *
 * @oods/sdk does not bundle an MCP stdio client implementation.
 */
export class StdioTransport implements Transport {
  readonly options: StdioTransportOptions;

  constructor(options: StdioTransportOptions = { type: 'stdio' }) {
    this.options = options;
  }

  async call<T = unknown>(tool: string, _input: Record<string, unknown>): Promise<T> {
    // Stub — no MCP stdio client is bundled with @oods/sdk.
    throw new Error(
      `StdioTransport.call is unavailable (tool: ${tool}); @oods/sdk does not bundle an MCP stdio client.`
    );
  }
}

/**
 * HTTP transport — calls MCP tools via the HTTP bridge.
 */
export class HttpTransport implements Transport {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: HttpTransportOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  async call<T = unknown>(tool: string, input: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/tools/${tool}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status} from ${tool}: ${body}`);
    }

    const json = (await response.json()) as { result: T };
    return json.result;
  }
}

/**
 * Create a transport from options, with auto-detection fallback.
 */
export function createTransport(options?: TransportOptions): Transport {
  if (!options) {
    // Auto-detect: stdio if running in an MCP-capable environment, HTTP fallback
    const bridgeUrl = process.env.OODS_BRIDGE_URL;
    if (bridgeUrl) {
      return new HttpTransport({ type: 'http', baseUrl: bridgeUrl });
    }
    return new StdioTransport({ type: 'stdio' });
  }

  switch (options.type) {
    case 'stdio':
      return new StdioTransport(options);
    case 'http':
      return new HttpTransport(options);
    default:
      throw new Error(`Unknown transport type: ${(options as TransportOptions).type}`);
  }
}
