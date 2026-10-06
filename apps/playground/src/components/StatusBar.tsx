type Props = {
  bridgeOk: boolean | null;
  loading: boolean;
  error: string | null;
  metrics: {
    totalNodes: number;
    componentsUsed: number;
    fieldsBound: number;
    fieldsOmitted?: Array<{ field: string; reason: string }>;
    responseBytes: number;
  } | null;
  pipeline: {
    steps: string[];
    stepLatency?: Record<string, number>;
    duration: number;
  } | null;
  summary: string | null;
};

function formatError(error: string): { label: string; detail: string } {
  // Parse [step] prefix if present
  const match = error.match(/^\[(\w+)\]\s*(.+)/);
  if (match) {
    return { label: match[1], detail: match[2] };
  }
  return { label: 'Error', detail: error };
}

export function StatusBar({ bridgeOk, loading, error, metrics, pipeline, summary }: Props) {
  const err = error ? formatError(error) : null;

  return (
    <div className="flex items-center gap-4 px-5 py-1.5 border-t border-gray-800 bg-gray-900/80 text-xs shrink-0">
      {/* Bridge status */}
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            bridgeOk === null ? 'bg-gray-600' : bridgeOk ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        <span className="text-gray-500">
          {bridgeOk === null ? 'Connecting...' : bridgeOk ? 'Bridge' : 'Bridge offline'}
        </span>
      </span>

      {/* Error */}
      {err && (
        <span className="flex items-center gap-1.5 text-red-400 truncate max-w-lg" title={error ?? undefined}>
          <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-mono text-[10px]">
            {err.label}
          </span>
          <span className="truncate">{err.detail}</span>
        </span>
      )}

      {/* Summary */}
      {!error && summary && (
        <span className="text-gray-400 truncate">{summary}</span>
      )}

      <span className="flex-1" />

      {/* Fields omitted indicator */}
      {metrics?.fieldsOmitted && metrics.fieldsOmitted.length > 0 && (
        <span
          className="text-yellow-500/80 cursor-help"
          title={metrics.fieldsOmitted.map((f) => `${f.field}: ${f.reason}`).join('\n')}
        >
          {metrics.fieldsOmitted.length} fields omitted
        </span>
      )}

      {/* Metrics */}
      {metrics && (
        <span className="text-gray-500">
          {metrics.componentsUsed} components, {metrics.fieldsBound} fields
        </span>
      )}

      {/* Pipeline duration */}
      {pipeline && (
        <span className="text-gray-600 font-mono">
          {pipeline.duration}ms
        </span>
      )}

      {loading && <span className="text-indigo-400">Running...</span>}
    </div>
  );
}
