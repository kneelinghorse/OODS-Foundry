import {
  useEffect,
  useId,
  useRef,
} from 'react';
import type { ArtifactRunSummary } from '../types.js';

type RunListProps = {
  runs: ArtifactRunSummary[];
  open: boolean;
  currentRunId: string | null;
  onSelect: (run: ArtifactRunSummary) => void;
  onClose: () => void;
};

export function RunList({ runs, open, currentRunId, onSelect, onClose }: RunListProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const dialogNode = dialogRef.current;
      const timeout = window.setTimeout(() => {
        firstButtonRef.current?.focus();
        dialogNode?.scrollTo({ top: 0 });
      }, 10);
      return () => window.clearTimeout(timeout);
    }
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus({ preventScroll: true });
      previousFocusRef.current = null;
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="artifact-runlist__backdrop" role="presentation" onClick={onClose}>
      <div
        className="artifact-runlist__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="artifact-runlist__header">
          <h3 id={headingId}>Run history</h3>
          <button type="button" className="artifact-runlist__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="artifact-runlist__body">
          {runs.length === 0 ? (
            <p>No runs recorded yet.</p>
          ) : (
            <ul className="artifact-runlist__list">
              {runs.map((run, index) => {
                const isCurrent = run.id === currentRunId;
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      className="artifact-runlist__item"
                      onClick={() => {
                        onSelect(run);
                        onClose();
                      }}
                      ref={index === 0 ? firstButtonRef : undefined}
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      <span className="artifact-runlist__item-title">{run.summary}</span>
                      <span className="artifact-runlist__item-meta">
                        {run.tool ? `${run.tool} • ` : ''}
                        {run.date}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
