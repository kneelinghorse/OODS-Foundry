import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { styled } from 'storybook/theming';
import { artifactHref } from '../bridge.js';
import type { ArtifactInfo } from '../types.js';

type ArtifactListProps = {
  artifacts: string[];
  artifactsDetail?: ArtifactInfo[];
  transcriptPath: string | null;
  bundleIndexPath: string | null;
  diagnosticsPath: string | null;
  caption?: string;
};

type ArtifactRow = {
  key: string;
  name: string;
  path: string;
  purpose?: string | null;
  sha256?: string | null;
  shortSha?: string | null;
  sizeLabel?: string | null;
  href: string | null;
};

const ROW_HEIGHT = 48;
const DEFAULT_VIEWPORT_HEIGHT = 320;
const OVERSCAN = 6;

const TableWrapper = styled.div`
  max-height: 360px;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 1px 0 rgba(15, 17, 26, 0.04);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 480px;

  caption {
    text-align: left;
    font-weight: 600;
    margin-bottom: 10px;
    color: rgba(31, 31, 39, 0.85);
    padding: 12px 12px 0;
  }

  thead th {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(31, 31, 39, 0.7);
    padding: 8px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(15, 17, 26, 0.03);
  }

  tbody th,
  tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    vertical-align: middle;
  }

  tbody tr:last-of-type th,
  tbody tr:last-of-type td {
    border-bottom: none;
  }
`;

const EmptyState = styled.div`
  border: 1px dashed rgba(0, 0, 0, 0.18);
  border-radius: 6px;
  padding: 14px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  background: rgba(248, 248, 252, 0.8);
`;

const ArtifactLink = styled.a`
  color: #1858ff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid #1858ff;
    outline-offset: 2px;
  }
`;

const Muted = styled.span`
  color: rgba(31, 31, 39, 0.55);
`;

const HashStack = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const HashCode = styled.code`
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  background: rgba(24, 88, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  color: rgba(24, 88, 255, 0.9);
`;

const CopyButton = styled.button`
  font-size: 11px;
  border: 1px solid rgba(24, 88, 255, 0.4);
  border-radius: 4px;
  background: rgba(24, 88, 255, 0.08);
  color: #1858ff;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 120ms ease;

  &:hover {
    background: rgba(24, 88, 255, 0.14);
  }

  &:focus-visible {
    outline: 2px solid #1858ff;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const ActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 4px;
  border: 1px solid rgba(31, 31, 39, 0.18);
  color: rgba(31, 31, 39, 0.8);
  background: rgba(15, 17, 26, 0.04);
  text-decoration: none;
  min-width: 52px;
  transition: background 120ms ease, border 120ms ease;

  &:hover {
    background: rgba(15, 17, 26, 0.08);
  }

  &:focus-visible {
    outline: 2px solid #1858ff;
    outline-offset: 2px;
  }
`;

const ConfidentialNote = styled.p`
  margin: 8px 0 0;
  font-size: 11px;
  color: rgba(31, 31, 39, 0.58);
`;

function formatSize(sizeBytes: number | null | undefined): string | null {
  if (sizeBytes == null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

function buildRows(props: ArtifactListProps): ArtifactRow[] {
  const rows: ArtifactRow[] = [];
  const seen = new Set<string>();

  const pushRow = (row: ArtifactRow) => {
    if (!row.key || seen.has(row.key)) return;
    seen.add(row.key);
    rows.push(row);
  };

  const appendWithLabel = (path: string | null, overrides: Partial<ArtifactRow>) => {
    if (!path) return;
    const href = artifactHref(path);
    pushRow({
      key: path,
      name: overrides.name || basename(path),
      path,
      purpose: overrides.purpose ?? null,
      sha256: overrides.sha256 ?? null,
      shortSha: overrides.sha256 ? overrides.sha256.slice(0, 8) : null,
      sizeLabel: overrides.sizeLabel ?? null,
      href,
    });
  };

  appendWithLabel(props.transcriptPath, {
    name: 'transcript.json',
    purpose: 'Conversational log (auditable)',
  });

  appendWithLabel(props.bundleIndexPath, {
    name: 'bundle_index.json',
    purpose: 'Integrity manifest (sha256 map)',
  });

  appendWithLabel(props.diagnosticsPath, {
    purpose: 'Diagnostics bundle',
  });

  if (props.artifactsDetail && props.artifactsDetail.length) {
    props.artifactsDetail.forEach((detail) => {
      const href = artifactHref(detail.path);
      pushRow({
        key: detail.path,
        name: detail.name || basename(detail.path),
        path: detail.path,
        purpose: detail.purpose ?? null,
        sha256: detail.sha256 ?? null,
        shortSha: detail.sha256 ? detail.sha256.slice(0, 8) : null,
        sizeLabel: formatSize(detail.sizeBytes),
        href,
      });
    });
  } else if (props.artifacts.length) {
    props.artifacts.forEach((path) => {
      const href = artifactHref(path);
      pushRow({
        key: path,
        name: basename(path),
        path,
        purpose: null,
        sha256: null,
        shortSha: null,
        sizeLabel: null,
        href,
      });
    });
  }

  return rows;
}

function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Clipboard API unavailable'));
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        resolve();
      } else {
        reject(new Error('Copy command rejected'));
      }
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err instanceof Error ? err : new Error('Copy command failed'));
    }
  });
}

export function ArtifactList({
  artifacts,
  artifactsDetail,
  transcriptPath,
  bundleIndexPath,
  diagnosticsPath,
  caption = 'Artifacts',
}: ArtifactListProps) {
  const rows = useMemo(
    () =>
      buildRows({
        artifacts,
        artifactsDetail,
        transcriptPath,
        bundleIndexPath,
        diagnosticsPath,
        caption,
      }),
    [artifacts, artifactsDetail, transcriptPath, bundleIndexPath, diagnosticsPath, caption]
  );

  const hasRows = rows.length > 0;
  const virtualizationEnabled = rows.length > 12;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const entry = entries[0];
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const effectiveViewport = viewportHeight || DEFAULT_VIEWPORT_HEIGHT;
  const startIndex = virtualizationEnabled ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
  const endIndex = virtualizationEnabled
    ? Math.min(rows.length, Math.ceil((scrollTop + effectiveViewport) / ROW_HEIGHT) + OVERSCAN)
    : rows.length;
  const visibleRows = rows.slice(startIndex, endIndex);
  const beforeSpacer = virtualizationEnabled ? startIndex * ROW_HEIGHT : 0;
  const afterSpacer = virtualizationEnabled ? (rows.length - endIndex) * ROW_HEIGHT : 0;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetHandle = useRef<number | null>(null);

  const handleCopy = useCallback(async (row: ArtifactRow) => {
    if (!row.sha256) return;
    try {
      await copyTextToClipboard(row.sha256);
      setCopiedKey(row.key);
      if (copyResetHandle.current) {
        window.clearTimeout(copyResetHandle.current);
      }
      copyResetHandle.current = window.setTimeout(() => {
        setCopiedKey((current) => (current === row.key ? null : current));
      }, 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  useEffect(
    () => () => {
      if (copyResetHandle.current) {
        window.clearTimeout(copyResetHandle.current);
      }
    },
    []
  );

  if (!hasRows) {
    return (
      <EmptyState role="status">
        No artifacts produced yet. Run the tool to generate new outputs.
      </EmptyState>
    );
  }

  return (
    <div>
      <TableWrapper ref={scrollRef} onScroll={handleScroll} role="region" aria-live="polite">
        <Table aria-rowcount={rows.length}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Artifact</th>
              <th scope="col">Purpose</th>
              <th scope="col">Size</th>
              <th scope="col">SHA-256</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {virtualizationEnabled && beforeSpacer > 0 ? (
              <tr className="agent-panel__artifact-spacer" aria-hidden="true">
                <td colSpan={5}>
                  <div style={{ height: beforeSpacer }} />
                </td>
              </tr>
            ) : null}

            {visibleRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.href ? (
                    <ArtifactLink href={row.href} target="_blank" rel="noopener noreferrer">
                      {row.name}
                    </ArtifactLink>
                  ) : (
                    <Muted>{row.name}</Muted>
                  )}
                </th>
                <td>{row.purpose || <Muted>—</Muted>}</td>
                <td>{row.sizeLabel || <Muted>—</Muted>}</td>
                <td>
                  {row.sha256 ? (
                    <HashStack>
                      <HashCode>{row.shortSha}</HashCode>
                      <CopyButton type="button" onClick={() => void handleCopy(row)}>
                        {copiedKey === row.key ? 'Copied' : 'Copy'}
                      </CopyButton>
                      {copiedKey === row.key ? (
                        <span className="agent-panel__sr-only" role="status">
                          Copied full SHA for {row.name}
                        </span>
                      ) : null}
                    </HashStack>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </td>
                <td>
                  {row.href ? (
                    <ActionLink
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${row.name} in a new tab`}
                    >
                      Open
                    </ActionLink>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </td>
              </tr>
            ))}

            {virtualizationEnabled && afterSpacer > 0 ? (
              <tr className="agent-panel__artifact-spacer" aria-hidden="true">
                <td colSpan={5}>
                  <div style={{ height: afterSpacer }} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrapper>
      <ConfidentialNote>Artifacts may contain confidential data. Share and store with care.</ConfidentialNote>
    </div>
  );
}
