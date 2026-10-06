import { trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-node';

export type InstalledOtelTestProvider = {
  exporter: InMemorySpanExporter;
  provider: BasicTracerProvider;
  getFinishedSpans: () => ReadableSpan[];
  reset: () => void;
  uninstall: () => Promise<void>;
};

export function installOtelTestProvider(): InstalledOtelTestProvider {
  const exporter = new InMemorySpanExporter();
  // OpenTelemetry 2.x (s206-m02): processors are given to the provider, and a basic provider is made global through
  // the API (only NodeTracerProvider keeps register()).
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  trace.disable();
  trace.setGlobalTracerProvider(provider);

  return {
    exporter,
    provider,
    getFinishedSpans: () => exporter.getFinishedSpans(),
    reset: () => exporter.reset(),
    uninstall: async () => {
      exporter.reset();
      await provider.shutdown();
      trace.disable();
    },
  };
}
