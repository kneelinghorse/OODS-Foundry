import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bridgeOrigin } from '../bridge.js';
import type { ArtifactRunFile } from '../types.js';

type FileTableProps = {
  files: ArtifactRunFile[];
  loading: boolean;
  error: string | null;
  labelledBy: string;
  onCopyStatus: (message: string) => void;
};

const ROW_HEIGHT = 48;
const DEFAULT_VIEWPORT_HEIGHT = 320;
const OVERSCAN = 6;

function formatSize(size: number | null): string {
  if (typeof size !== 'number' || Number.isNaN(size)) return '—';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = size / 1024;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function FileTable({ files, loading, error, labelledBy, onCopyStatus }: FileTableProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const virtualized = files.length > 200;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    node.scrollTop = 0;
    setScrollTop(0);
  }, [files]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const handleScroll = () => setScrollTop(node.scrollTop);
    node.addEventListener('scroll', handleScroll);

    const updateHeight = () => setViewportHeight(node.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
    updateHeight();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeight);
      observer.observe(node);
    }

    return () => {
      node.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const visibleRange = useMemo(() => {
    if (!virtualized) {
      return { start: 0, end: files.length };
    }
    const approxVisible = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN;
    const maxStart = Math.max(files.length - approxVisible, 0);
    const start = Math.max(Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN, 0);
    const clampedStart = Math.min(start, maxStart);
    const end = Math.min(clampedStart + approxVisible, files.length);
    return { start: clampedStart, end };
  }, [files.length, scrollTop, viewportHeight, virtualized]);

  const topSpacer = virtualized ? visibleRange.start * ROW_HEIGHT : 0;
  const bottomSpacer = virtualized ? (files.length - visibleRange.end) * ROW_HEIGHT : 0;
  const visibleFiles = files.slice(visibleRange.start, visibleRange.end);

  const handleCopy = useCallback(
    async (file: ArtifactRunFile) => {
      if (!file.sha256) return;
      if (!navigator?.clipboard?.writeText) {
        onCopyStatus('Clipboard access not available in this context.');
        return;
      }
      try {
        await navigator.clipboard.writeText(file.sha256);
        setCopiedId(file.id);
        onCopyStatus(`Copied full hash for ${file.name}.`);
        if (copyTimeoutRef.current != null) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => setCopiedId(null), 2500);
      } catch {
        onCopyStatus(`Unable to copy hash for ${file.name}.`);
      }
    },
    [onCopyStatus]
  );

  if (loading) {
    return (
      <div className="artifact-filetable__status" role="status">
        Loading artifacts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="artifact-filetable__status artifact-filetable__status--error" role="alert">
        {error}
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="artifact-filetable__empty" role="note">
        No artifacts available for this run.
      </div>
    );
  }

  return (
    <div ref={viewportRef} className="artifact-filetable__viewport" role="presentation">
      <table className="artifact-filetable" aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Purpose</th>
            <th scope="col">Size</th>
            <th scope="col">SHA256</th>
            <th scope="col">Open</th>
          </tr>
        </thead>
        <tbody>
          {topSpacer > 0 && (
            <tr aria-hidden="true" className="artifact-filetable__spacer">
              <td colSpan={5} style={{ height: `${topSpacer}px` }} />
            </tr>
          )}
          {visibleFiles.map((file) => {
            const shortHash = file.sha256 ? file.sha256.slice(0, 8) : '—';
            const isCopied = copiedId === file.id;
            return (
              <tr key={file.id}>
                <th scope="row">
                  <span className="artifact-filetable__filename">{file.name}</span>
                </th>
                <td>{file.purpose ?? '—'}</td>
                <td>{formatSize(file.size ?? null)}</td>
                <td>
                  {file.sha256 ? (
                    <div className="artifact-filetable__hash">
                      <code>{shortHash}</code>
                      <button
                        type="button"
                        className="artifact-filetable__copy"
                        onClick={() => void handleCopy(file)}
                        disabled={!file.sha256}
                      >
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <a
                    href={`${bridgeOrigin}${file.openUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="artifact-filetable__open"
                  >
                    Open
                  </a>
                </td>
              </tr>
            );
          })}
          {bottomSpacer > 0 && (
            <tr aria-hidden="true" className="artifact-filetable__spacer">
              <td colSpan={5} style={{ height: `${bottomSpacer}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
