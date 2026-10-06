import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const startup = vi.hoisted(() => ({ delay: 15_000 as number | null, crash: false }));
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return { Worker: class extends EventEmitter {
    ref() { return this; }
    unref() { return this; }
    postMessage(request: { requestId: number }) {
      if (startup.delay === null) return;
      setTimeout(() => startup.crash ? this.emit('error', new Error('worker boot failed'))
        : this.emit('message', { kind: 'render-result', requestId: request.requestId, svg: '<svg/>', metrics: {} }), startup.delay);
    }
  } };
});
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); startup.delay = 15_000; startup.crash = false; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('a slow cold import can finish before MCP starts accepting tools instead of killing the server at ten seconds', async () => {
  const { warmEChartsRenderWorker } = await import('../src/echarts-renderer.js');
  const outcome = warmEChartsRenderWorker().then(() => 'ready', error => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await outcome).toBe('ready');
  expect(vi.getTimerCount()).toBe(0);
});

it('an unresponsive worker still fails startup within a bounded minute', async () => {
  startup.delay = null;
  const { warmEChartsRenderWorker } = await import('../src/echarts-renderer.js');
  let settled = false;
  const outcome = warmEChartsRenderWorker().then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await vi.advanceTimersByTimeAsync(59_999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await outcome).toMatchObject({ code: 'ECHARTS_WORKER_FAULT', message: 'ECharts worker warm-up exceeded 60 seconds.' });
  expect(vi.getTimerCount()).toBe(0);
});

it('a worker fault fails immediately instead of waiting for the startup allowance', async () => {
  startup.delay = 1; startup.crash = true;
  const { warmEChartsRenderWorker } = await import('../src/echarts-renderer.js');
  const outcome = warmEChartsRenderWorker().then(() => null, error => error);
  await vi.advanceTimersByTimeAsync(1);
  expect(await outcome).toMatchObject({ code: 'ECHARTS_WORKER_FAULT', message: 'The ECharts render worker raised an error.' });
  expect(vi.getTimerCount()).toBe(0);
});
