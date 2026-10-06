import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  installOtelTestProvider,
  type InstalledOtelTestProvider,
} from '../../test/helpers/otel-test-provider.js';
import {
  getTracer,
  initTelemetry,
  isTelemetryActive,
  recordAjvFailure,
  recordSpanError,
  resetTelemetryForTesting,
  shutdownTelemetry,
  startToolSpan,
  _envVarNames,
} from './otel.js';

describe('telemetry/otel', () => {
  describe('no-op posture when env var unset', () => {
    let savedEndpoint: string | undefined;

    beforeEach(() => {
      savedEndpoint = process.env[_envVarNames.endpoint];
      delete process.env[_envVarNames.endpoint];
      resetTelemetryForTesting();
    });

    afterEach(async () => {
      await shutdownTelemetry();
      if (savedEndpoint === undefined) {
        delete process.env[_envVarNames.endpoint];
      } else {
        process.env[_envVarNames.endpoint] = savedEndpoint;
      }
    });

    it('initTelemetry returns enabled=false when OODS_OTLP_ENDPOINT is unset', async () => {
      const result = await initTelemetry();
      expect(result.enabled).toBe(false);
      expect(result.endpoint).toBeNull();
      expect(isTelemetryActive()).toBe(false);
    });

    it('initTelemetry returns enabled=false when OODS_OTLP_ENDPOINT is empty string', async () => {
      const result = await initTelemetry({ env: { OODS_OTLP_ENDPOINT: '' } });
      expect(result.enabled).toBe(false);
    });

    it('startToolSpan + getTracer still work (no-op tracer) without active telemetry', () => {
      const span = startToolSpan({ toolName: 'design.compose', requestId: 'req-1' });
      // Verify the API contract holds — span object exists and supports .end()
      expect(span).toBeDefined();
      expect(typeof span.end).toBe('function');
      expect(() => {
        span.setAttribute('oods.test', 'ok');
        span.end();
      }).not.toThrow();
    });

    it('getTracer returns a no-op tracer (calls do not throw, do not export spans)', () => {
      const tracer = getTracer();
      const span = tracer.startSpan('test.span');
      span.setAttribute('foo', 'bar');
      span.end();
      // No assertion on exported spans — no provider is registered, so nothing is exported.
      // The point is that the no-op API surface does not throw.
      expect(true).toBe(true);
    });
  });

  describe('span emission with InMemorySpanExporter', () => {
    let testProvider: InstalledOtelTestProvider;

    beforeEach(() => {
      testProvider = installOtelTestProvider();
    });

    afterEach(async () => {
      await testProvider.uninstall();
    });

    it('startToolSpan creates a span with rpc.* + oods.* attributes', () => {
      const span = startToolSpan({
        toolName: 'design.compose',
        role: 'designer',
        requestId: 'req-42',
      });
      span.end();

      const spans = testProvider.getFinishedSpans();
      expect(spans).toHaveLength(1);
      const exported = spans[0];

      // Span name follows convention
      expect(exported.name).toBe('forge.tool.design.compose');

      // RPC semconv attributes
      expect(exported.attributes['rpc.system']).toBe('oods-forge');
      expect(exported.attributes['rpc.service']).toBe('mcp-server');
      expect(exported.attributes['rpc.method']).toBe('design.compose');

      // Custom oods.* attributes
      expect(exported.attributes['oods.role']).toBe('designer');
      expect(exported.attributes['oods.request_id']).toBe('req-42');
    });

    it('startToolSpan omits role/requestId attrs when not provided', () => {
      const span = startToolSpan({ toolName: 'health' });
      span.end();

      const exported = testProvider.getFinishedSpans()[0];
      expect(exported.attributes['oods.role']).toBeUndefined();
      expect(exported.attributes['oods.request_id']).toBeUndefined();
    });

    // s107-m01b: validate/render consolidated into the `repl` tool and apply
    // into `map`, so the priority span names are now per grouped tool (the
    // sub-action lives in the input.action discriminator, not the span name).
    it('emits the priority named span kinds (compose, repl, codegen, map)', () => {
      const targets = [
        { tool: 'design.compose', expectedName: 'forge.tool.design.compose' },
        { tool: 'repl', expectedName: 'forge.tool.repl' },
        { tool: 'code.generate', expectedName: 'forge.tool.code.generate' },
        { tool: 'map', expectedName: 'forge.tool.map' },
      ];

      for (const t of targets) {
        const span = startToolSpan({ toolName: t.tool });
        span.end();
      }

      const exported = testProvider.getFinishedSpans();
      expect(exported.map((s) => s.name)).toEqual(targets.map((t) => t.expectedName));
    });

    it('recordSpanError marks the span ERROR and records the exception', () => {
      const span = startToolSpan({ toolName: 'map.apply' });
      const error = new Error('boom');
      recordSpanError(span, error, 'SOME_CODE');
      span.end();

      const exported = testProvider.getFinishedSpans()[0];
      expect(exported.status.code).toBe(SpanStatusCode.ERROR);
      expect(exported.status.message).toBe('boom');
      expect(exported.attributes['oods.error_code']).toBe('SOME_CODE');
      expect(exported.events.some((e) => e.name === 'exception')).toBe(true);
    });

    it('recordSpanError handles non-Error throws (string)', () => {
      const span = startToolSpan({ toolName: 'health' });
      recordSpanError(span, 'plain string failure');
      span.end();

      const exported = testProvider.getFinishedSpans()[0];
      expect(exported.status.code).toBe(SpanStatusCode.ERROR);
      expect(exported.status.message).toBe('plain string failure');
      // No exception event for non-Error throws — only setStatus
      expect(exported.events.some((e) => e.name === 'exception')).toBe(false);
    });

    it('recordAjvFailure encodes layer + error count + status', () => {
      const span = startToolSpan({ toolName: 'repl.validate' });
      recordAjvFailure(span, 'input', 3);
      span.end();

      const exported = testProvider.getFinishedSpans()[0];
      expect(exported.attributes['oods.ajv_failed']).toBe(true);
      expect(exported.attributes['oods.ajv_layer']).toBe('input');
      expect(exported.attributes['oods.ajv_error_count']).toBe(3);
      expect(exported.status.code).toBe(SpanStatusCode.ERROR);
    });

    it('recordAjvFailure distinguishes input vs output layer', () => {
      const span1 = startToolSpan({ toolName: 'repl.validate' });
      recordAjvFailure(span1, 'input', 1);
      span1.end();

      const span2 = startToolSpan({ toolName: 'design.compose' });
      recordAjvFailure(span2, 'output', 2);
      span2.end();

      const exported = testProvider.getFinishedSpans();
      expect(exported[0].attributes['oods.ajv_layer']).toBe('input');
      expect(exported[1].attributes['oods.ajv_layer']).toBe('output');
    });

    it('span kind is SERVER', () => {
      const span = startToolSpan({ toolName: 'health' });
      span.end();

      // SpanKind.SERVER === 1 in OTel JS
      expect(testProvider.getFinishedSpans()[0].kind).toBe(1);
    });
  });

  describe('initTelemetry idempotency + endpoint handling', () => {
    let savedEndpoint: string | undefined;
    let savedOtelServiceName: string | undefined;

    beforeEach(() => {
      savedEndpoint = process.env[_envVarNames.endpoint];
      savedOtelServiceName = process.env.OTEL_SERVICE_NAME;
      resetTelemetryForTesting();
    });

    afterEach(async () => {
      await shutdownTelemetry();
      resetTelemetryForTesting();
      if (savedEndpoint === undefined) {
        delete process.env[_envVarNames.endpoint];
      } else {
        process.env[_envVarNames.endpoint] = savedEndpoint;
      }
      if (savedOtelServiceName === undefined) {
        delete process.env.OTEL_SERVICE_NAME;
      } else {
        process.env.OTEL_SERVICE_NAME = savedOtelServiceName;
      }
    });

    it('calling initTelemetry twice returns the same state (idempotent)', async () => {
      const first = await initTelemetry({ env: {} });
      const second = await initTelemetry({ env: { OODS_OTLP_ENDPOINT: 'http://example/v1/traces' } });
      // Second call is a no-op because already initialized
      expect(second.enabled).toBe(first.enabled);
      expect(second.endpoint).toBe(first.endpoint);
    });

    it('sets OTEL_SERVICE_NAME to default when unset and endpoint provided', async () => {
      delete process.env.OTEL_SERVICE_NAME;
      await initTelemetry({
        env: { OODS_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces' },
      });
      expect(process.env.OTEL_SERVICE_NAME).toBe('oods-forge-mcp-server');
    });

    it('does not override existing OTEL_SERVICE_NAME', async () => {
      process.env.OTEL_SERVICE_NAME = 'user-set-name';
      await initTelemetry({
        env: { OODS_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces' },
      });
      expect(process.env.OTEL_SERVICE_NAME).toBe('user-set-name');
    });

    it('honors OODS_OTLP_SERVICE_NAME override when OTEL_SERVICE_NAME unset', async () => {
      delete process.env.OTEL_SERVICE_NAME;
      await initTelemetry({
        env: {
          OODS_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
          OODS_OTLP_SERVICE_NAME: 'custom-forge-name',
        },
      });
      expect(process.env.OTEL_SERVICE_NAME).toBe('custom-forge-name');
    });

    it('exports the tool span under the configured service name (s206-m02)', async () => {
      // The env var above was never the exported name: every span left as `unknown_service:node`. This reads what a
      // collector actually receives.
      delete process.env.OTEL_SERVICE_NAME;
      const bodies: string[] = [];
      const collector = http.createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => {
          bodies.push(Buffer.concat(chunks).toString('utf8'));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{}');
        });
      });
      await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
      // An earlier test's provider still holds the global registration; this one must own it to export.
      trace.disable();
      try {
        const { port } = collector.address() as AddressInfo;
        await initTelemetry({
          env: { OODS_OTLP_ENDPOINT: `http://127.0.0.1:${port}/v1/traces`, OODS_OTLP_SERVICE_NAME: 'forge-under-test' },
        });
        startToolSpan({ toolName: 'health' }).end();
        await shutdownTelemetry(); // flushes the batch processor
        type Exported = { resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; scopeSpans: Array<{ spans: Array<{ name: string }> }> };
        const resourceSpans = bodies.flatMap((body) => (JSON.parse(body) as { resourceSpans?: Exported[] }).resourceSpans ?? []);
        expect(resourceSpans.map((entry) => entry.resource.attributes.find((attribute) => attribute.key === 'service.name')?.value.stringValue)).toEqual(['forge-under-test']);
        expect(resourceSpans.flatMap((entry) => entry.scopeSpans.flatMap((scope) => scope.spans.map((span) => span.name)))).toEqual(['forge.tool.health']);
      } finally {
        trace.disable();
        await new Promise<void>((resolve) => collector.close(() => resolve()));
      }
    });
  });
});
