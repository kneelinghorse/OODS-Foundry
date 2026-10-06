import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock('../../src/tools/registry.js', () => ({ resolveToolRegistry: () => ({ enabled: ['health'], unknownExtras: [] }) }));
vi.mock('../../src/tools/health.js', () => ({ handle: mocks.handle }));
vi.mock('../../src/security/policy.js', () => ({ isAllowed: () => ({ allowed: true }), tryAcquireSlot: () => true, releaseSlot: vi.fn(), tryConsumeToken: () => true, timeoutMsFor: () => 5 }));
vi.mock('../../src/lib/user-brands.js', () => ({ prepareUserBrands: async () => ({ action: 'none' }) }));
vi.mock('@oods/viz-render', () => ({ warmEChartsRenderWorker: async () => {} }));
vi.mock('../../src/telemetry/otel.js', () => ({ initTelemetry: async () => ({ enabled: false }), shutdownTelemetry: async () => {}, startToolSpan: () => ({ end() {} }), recordSpanError() {}, recordAjvFailure() {} }));

let listener: (chunk: string) => Promise<void>;
const signals = ['SIGTERM', 'SIGINT'] as const;
const originalSignals = new Map(signals.map(signal => [signal, process.listeners(signal)]));
const originalData = process.stdin.listeners('data');
beforeAll(async () => {
  await import('../../src/index.js');
  listener = process.stdin.listeners('data').find(candidate => !originalData.includes(candidate)) as typeof listener;
  expect(listener).toBeTypeOf('function');
});
afterAll(() => {
  process.stdin.removeListener('data', listener);
  for (const signal of signals) for (const handler of process.listeners(signal)) if (!originalSignals.get(signal)!.includes(handler)) process.removeListener(signal, handler);
});

async function request() {
  const outputs: string[] = [];
  const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => { outputs.push(String(chunk)); return true; });
  try { await listener(JSON.stringify({ id: 'dispatch-proof', tool: 'health', input: {} }) + '\n'); }
  finally { write.mockRestore(); }
  return JSON.parse(outputs.find(line => line.includes('dispatch-proof'))!);
}

describe('dispatch preserves actionable OODS error identity (s225-m02)', () => {
  it('a handler timeout keeps S002 and retryable=true instead of becoming BAD_REQUEST', async () => {
    mocks.handle.mockImplementationOnce(() => new Promise(() => {}));
    const response = await request();
    expect(response.error).toMatchObject({ code: 'OODS-S002', details: { category: 'server_error', retryable: true, context: { timeoutMs: 5 } } });
  });
  it('an unexpected handler exception becomes S003 with its incident and message', async () => {
    mocks.handle.mockRejectedValueOnce(new Error('unexpected handler failure'));
    const response = await request();
    expect(response.error).toMatchObject({ code: 'OODS-S003', message: 'unexpected handler failure', details: { category: 'server_error', retryable: false } });
    expect(response.error.incidentId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
