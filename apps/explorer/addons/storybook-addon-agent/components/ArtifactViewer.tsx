import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchRunDiagnostics,
  fetchRunFiles,
  fetchRunSummaries,
} from '../bridge.js';
import type { ArtifactRunFile, ArtifactRunSummary } from '../types.js';
import { FileTable } from './FileTable.js';
import { RunList } from './RunList.js';
import '../styles/artifacts.css';

type ArtifactViewerProps = {
  headingId: string;
};

export function ArtifactViewer({ headingId }: ArtifactViewerProps) {
  const srId = useId();
  const [srMessage, setSrMessage] = useState('');
  const [runs, setRuns] = useState<ArtifactRunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRunRef = useRef<string | null>(null);
  const [files, setFiles] = useState<ArtifactRunFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<unknown>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [runListOpen, setRunListOpen] = useState(false);

  useEffect(() => {
    selectedRunRef.current = selectedRunId;
  }, [selectedRunId]);

  const loadRuns = useCallback(
    async (maintainSelection: boolean) => {
      setRunsLoading(true);
      setRunsError(null);
      setSrMessage('Loading run history…');
      try {
        const data = await fetchRunSummaries();
        setRuns(data);
        const previous = selectedRunRef.current;
        if (!data.length) {
          setSelectedRunId(null);
          setSrMessage('No runs recorded yet.');
          return;
        }
        if (!maintainSelection || !previous || !data.some((run) => run.id === previous)) {
          setSelectedRunId(data[0].id);
          setSrMessage('Latest run ready in viewer.');
        } else {
          setSrMessage('Run history refreshed.');
        }
      } catch (err: any) {
        const message = err?.message ?? 'Failed to load run history.';
        setRuns([]);
        setSelectedRunId(null);
        setRunsError(message);
        setSrMessage(message);
      } finally {
        setRunsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadRuns(true);
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setFiles([]);
      setFilesError(null);
      return;
    }
    let cancelled = false;
    setFilesLoading(true);
    setFilesError(null);
    setSrMessage('Loading artifacts for selected run…');
    fetchRunFiles(selectedRunId)
      .then((data) => {
        if (cancelled) return;
        setFiles(data);
        setSrMessage(`Loaded ${data.length} artifacts for selected run.`);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message = err?.message ?? 'Unable to load artifacts for this run.';
        setFiles([]);
        setFilesError(message);
        setSrMessage(message);
      })
      .finally(() => {
        if (!cancelled) {
          setFilesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setDiagnostics(null);
      setDiagnosticsError(null);
      return;
    }
    let cancelled = false;
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    fetchRunDiagnostics(selectedRunId)
      .then((payload) => {
        if (cancelled) return;
        setDiagnostics(payload);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message = err?.message ?? 'Unable to load diagnostics for this run.';
        setDiagnostics(null);
        setDiagnosticsError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setDiagnosticsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runs.find((run) => run.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const handleSelectLatest = useCallback(() => {
    if (!runs.length) return;
    setSelectedRunId(runs[0].id);
    setSrMessage('Latest run selected.');
  }, [runs]);

  const handleRefresh = useCallback(() => {
    void loadRuns(true);
  }, [loadRuns]);

  const handleRunPick = useCallback((run: ArtifactRunSummary) => {
    setSelectedRunId(run.id);
    setSrMessage(`Selected run ${run.summary}.`);
  }, []);

  return (
    <div className="artifact-viewer" aria-labelledby={headingId}>
      <div id={srId} className="artifact-viewer__sr" aria-live="polite">
        {srMessage}
      </div>
      <div className="artifact-viewer__toolbar">
        <div className="artifact-viewer__toolbar-main">
          <span className="artifact-viewer__label">Selected run</span>
          <strong className="artifact-viewer__value">{selectedRun?.summary ?? '—'}</strong>
        </div>
        <div className="artifact-viewer__toolbar-actions">
          <button
            type="button"
            className="artifact-viewer__btn"
            onClick={handleRefresh}
            disabled={runsLoading}
          >
            {runsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="artifact-viewer__btn"
            onClick={() => setRunListOpen(true)}
            disabled={runsLoading || runs.length === 0}
          >
            Run history…
          </button>
          <button
            type="button"
            className="artifact-viewer__btn artifact-viewer__btn--primary"
            onClick={handleSelectLatest}
            disabled={!runs.length || (runs[0]?.id ?? null) === selectedRunId}
          >
            Latest run
          </button>
        </div>
      </div>
      {runsError ? (
        <div className="artifact-viewer__status artifact-viewer__status--error" role="alert">
          {runsError}
        </div>
      ) : null}
      {selectedRun && (
        <div className="artifact-viewer__meta">
          {selectedRun.tool && <span className="artifact-viewer__meta-item">{selectedRun.tool}</span>}
          <span className="artifact-viewer__meta-item">{selectedRun.date}</span>
        </div>
      )}
      <FileTable
        files={files}
        loading={filesLoading}
        error={filesError}
        labelledBy={headingId}
        onCopyStatus={setSrMessage}
      />
      <div className="artifact-viewer__diagnostics">
        <details>
          <summary>Diagnostics payload</summary>
          {diagnosticsLoading ? (
            <div role="status">Loading diagnostics…</div>
          ) : diagnosticsError ? (
            <div role="alert">{diagnosticsError}</div>
          ) : diagnostics ? (
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          ) : (
            <p>No diagnostics published for this run.</p>
          )}
        </details>
      </div>
      <RunList
        runs={runs}
        open={runListOpen}
        currentRunId={selectedRunId}
        onSelect={handleRunPick}
        onClose={() => setRunListOpen(false)}
      />
    </div>
  );
}
