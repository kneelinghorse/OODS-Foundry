import {
  trace,
  SpanStatusCode,
  SpanKind,
  type Tracer,
  type Span,
  type Attributes,
} from '@opentelemetry/api';

const TRACER_NAME = 'oods-forge-mcp';
const TRACER_VERSION = '0.1.0';

const ENV_ENDPOINT = 'OODS_OTLP_ENDPOINT';
const ENV_SERVICE_NAME = 'OODS_OTLP_SERVICE_NAME';
const ENV_HEADERS = 'OODS_OTLP_HEADERS';

const DEFAULT_SERVICE_NAME = 'oods-forge-mcp-server';

type ShutdownFn = () => Promise<void>;

let initialized = false;
let shutdownFn: ShutdownFn | null = null;
let activeEndpoint: string | null = null;

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

export function isTelemetryActive(): boolean {
  return activeEndpoint !== null;
}

export function getActiveEndpoint(): string | null {
  return activeEndpoint;
}

function parseHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function initTelemetry(options: { env?: NodeJS.ProcessEnv } = {}): Promise<{ enabled: boolean; endpoint: string | null }> {
  if (initialized) {
    return { enabled: activeEndpoint !== null, endpoint: activeEndpoint };
  }
  initialized = true;

  const env = options.env ?? process.env;
  const endpoint = env[ENV_ENDPOINT];
  if (!endpoint || endpoint.trim().length === 0) {
    return { enabled: false, endpoint: null };
  }

  // Honor OTEL_SERVICE_NAME standard env var; otherwise set a sensible default
  // (overridable via OODS_OTLP_SERVICE_NAME).
  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = env[ENV_SERVICE_NAME] || DEFAULT_SERVICE_NAME;
  }

  const headers = parseHeaders(env[ENV_HEADERS]);

  const [{ NodeTracerProvider, BatchSpanProcessor }, { OTLPTraceExporter }, { resourceFromAttributes }] = await Promise.all([
    import('@opentelemetry/sdk-trace-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/resources'),
  ]);

  const exporter = new OTLPTraceExporter({
    url: endpoint,
    headers,
  });

  // OpenTelemetry 2.x (s206-m02): span processors are given to the provider; addSpanProcessor is gone. The service
  // name travels as the provider's resource: no tracer provider reads OTEL_SERVICE_NAME by itself (only the NodeSDK
  // runs the environment detector), so on 1.x and 2.x alike every span had exported as `unknown_service:node`.
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': process.env.OTEL_SERVICE_NAME }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  activeEndpoint = endpoint;
  shutdownFn = async () => {
    try {
      await provider.shutdown();
    } catch {
      // Swallow shutdown errors — we are already exiting.
    }
  };

  return { enabled: true, endpoint };
}

export async function shutdownTelemetry(): Promise<void> {
  if (shutdownFn) {
    await shutdownFn();
    shutdownFn = null;
  }
  activeEndpoint = null;
  initialized = false;
}

export function resetTelemetryForTesting(): void {
  initialized = false;
  shutdownFn = null;
  activeEndpoint = null;
}

export type ToolSpanAttributes = {
  toolName: string;
  role?: string;
  requestId?: string;
};

export function startToolSpan(attrs: ToolSpanAttributes): Span {
  const tracer = getTracer();
  const spanName = `forge.tool.${attrs.toolName}`;
  const initialAttributes: Attributes = {
    'rpc.system': 'oods-forge',
    'rpc.service': 'mcp-server',
    'rpc.method': attrs.toolName,
  };
  if (attrs.role) initialAttributes['oods.role'] = attrs.role;
  if (attrs.requestId) initialAttributes['oods.request_id'] = attrs.requestId;
  return tracer.startSpan(spanName, {
    kind: SpanKind.SERVER,
    attributes: initialAttributes,
  });
}

export function recordSpanError(span: Span, error: unknown, code?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message });
  if (error instanceof Error) {
    span.recordException(error);
  }
  if (code) {
    span.setAttribute('oods.error_code', code);
  }
}

export function recordAjvFailure(span: Span, layer: 'input' | 'output', errorCount: number): void {
  span.setAttribute('oods.ajv_failed', true);
  span.setAttribute('oods.ajv_layer', layer);
  span.setAttribute('oods.ajv_error_count', errorCount);
  span.setStatus({ code: SpanStatusCode.ERROR, message: `AJV ${layer} validation failed` });
}

export const _envVarNames = {
  endpoint: ENV_ENDPOINT,
  serviceName: ENV_SERVICE_NAME,
  headers: ENV_HEADERS,
};
