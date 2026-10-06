export type AdapterExit = { code: number | null; signal: NodeJS.Signals | null };
export class McpClient {
  // s211-m03: `command`/`args` start the server another way, as the npm package's `npx -y <tarball>` does.
  constructor(options: { adapterPath?: string; command?: string; args?: string[]; cwd: string; env: NodeJS.ProcessEnv });
  /** Everything the server wrote to standard error so far (the launcher's first-start sentence among it). */
  readonly stderrBuffer: string;
  readonly calledTools: Set<string>;
  readonly child: import('node:child_process').ChildProcessWithoutNullStreams;
  request<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  notify(method: string, params?: unknown): void;
  callTool<T = unknown>(name: string, args: unknown, expectedError?: string): Promise<T>;
  waitForExit(timeoutMs: number): Promise<AdapterExit | null>;
  closeStdinAndObserve(): Promise<AdapterExit & { exited: boolean }>;
  terminate(signal?: NodeJS.Signals): Promise<AdapterExit & {
    requestedSignal: NodeJS.Signals;
    forcedKill: boolean;
    alreadyExited: boolean;
  }>;
}
