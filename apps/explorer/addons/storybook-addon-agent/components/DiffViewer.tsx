import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { styled } from 'storybook/theming';
import type { PlanDiff, PlanDiffChange } from '../types.js';

type ViewMode = 'unified' | 'split' | 'json';

type DiffViewerProps = {
  diffs?: PlanDiff[] | null;
  loading?: boolean;
  autoFocus?: boolean;
};

type UnifiedRenderItem =
  | {
      kind: 'line';
      key: string;
      variant: 'header' | 'add' | 'remove' | 'context';
      text: string;
    }
  | {
      kind: 'fold';
      key: string;
      blockKey: string;
      collapsed: boolean;
      count: number;
    };

type SplitRenderItem =
  | {
      kind: 'row';
      key: string;
      variant: 'header' | 'add' | 'remove' | 'context';
      left: string | null;
      right: string | null;
    }
  | {
      kind: 'fold';
      key: string;
      blockKey: string;
      collapsed: boolean;
      count: number;
    };

type JsonStatus = 'added' | 'removed' | 'changed' | 'unchanged';

type JsonRenderItem = {
  key: string;
  depth: number;
  status: JsonStatus;
  label: string;
  value: string;
};

type DiffModel = {
  diff: PlanDiff;
  unified: UnifiedRenderItem[];
  split: SplitRenderItem[];
  json: JsonRenderItem[];
  hasStructured: boolean;
};

const CONTEXT_COLLAPSE_THRESHOLD = 6;
const LINE_HEIGHT = 24;
const SPLIT_LINE_HEIGHT = 28;
const JSON_LINE_HEIGHT = 24;
const OVERSCAN = 6;
const DEFAULT_VIEWPORT_HEIGHT = 320;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ToggleGroup = styled.div`
  display: inline-flex;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 6px;
  overflow: hidden;
  background: #f6f6f9;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  position: relative;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  background: ${({ $active }) => ($active ? '#1858ff' : 'transparent')};
  color: ${({ $active }) => ($active ? '#ffffff' : '#1f1f27')};
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;

  &:not(:last-child) {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
  }

  &:focus-visible {
    outline: 2px solid #1858ff;
    outline-offset: 1px;
  }

  &:hover:not(:disabled):not([aria-pressed='true']) {
    background: rgba(24, 88, 255, 0.12);
  }

  &:disabled {
    color: rgba(31, 31, 39, 0.5);
    cursor: not-allowed;
    background: transparent;
  }
`;

const LoadingBlock = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 18px;
  background: repeating-linear-gradient(
    -45deg,
    rgba(31, 31, 39, 0.08),
    rgba(31, 31, 39, 0.08) 12px,
    rgba(31, 31, 39, 0.12) 12px,
    rgba(31, 31, 39, 0.12) 24px
  );
  animation: shimmer 1.4s linear infinite;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);

  @keyframes shimmer {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 54px 54px;
    }
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

const DiffSection = styled.section`
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 1px 1px rgba(15, 17, 26, 0.04);
`;

const DiffHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  background: rgba(15, 17, 26, 0.04);
  border-bottom: 1px solid rgba(15, 17, 26, 0.06);
`;

const FilePath = styled.span`
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-variant-ligatures: none;
`;

const Summary = styled.span`
  color: rgba(31, 31, 39, 0.7);
`;

const SplitHeaderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(15, 17, 26, 0.03);
  border-bottom: 1px solid rgba(15, 17, 26, 0.06);

  span {
    color: rgba(31, 31, 39, 0.75);
  }
`;

const JsonFallback = styled.div`
  padding: 12px;
  font-size: 12px;
  color: rgba(31, 31, 39, 0.68);
  background: rgba(24, 88, 255, 0.06);
  border-top: 1px solid rgba(24, 88, 255, 0.12);
`;

const JsonEmpty = styled.div`
  padding: 12px;
  font-size: 12px;
  color: rgba(31, 31, 39, 0.68);
  background: rgba(15, 17, 26, 0.03);
  border-top: 1px solid rgba(15, 17, 26, 0.06);
`;

type VirtualizedListProps<T extends { key: string }> = {
  items: readonly T[];
  renderItem: (item: T) => ReactElement;
  lineHeight: number;
  className: string;
  ariaLabel: string;
};

function VirtualizedList<T extends { key: string }>({
  items,
  renderItem,
  lineHeight,
  className,
  ariaLabel,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
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

  const totalHeight = items.length * lineHeight;
  const effectiveViewport = viewportHeight || DEFAULT_VIEWPORT_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - OVERSCAN);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + effectiveViewport) / lineHeight) + OVERSCAN);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div ref={containerRef} className={className} onScroll={handleScroll} role="region" aria-label={ariaLabel}>
      <div className="agent-panel__diff-virtual-canvas" style={{ height: totalHeight }}>
        {visibleItems.map((item, index) => {
          const itemIndex = startIndex + index;
          return (
            <div
              key={item.key}
              className="agent-panel__diff-virtual-item"
              style={{ top: itemIndex * lineHeight, height: lineHeight }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatUnifiedLine(changeType: 'add' | 'remove' | 'context', value: string): string {
  if (changeType === 'add') return `+ ${value}`;
  if (changeType === 'remove') return `- ${value}`;
  return `  ${value}`;
}

function valueWithMarker(
  changeType: 'add' | 'remove' | 'context',
  side: 'left' | 'right',
  value: string | null
): string | null {
  if (value == null) return null;
  if (changeType === 'add' && side === 'right') return `+ ${value}`;
  if (changeType === 'remove' && side === 'left') return `- ${value}`;
  return value;
}

function buildDiffModel(diff: PlanDiff, expandedBlocks: Record<string, boolean>): DiffModel {
  const unified: UnifiedRenderItem[] = [];
  const split: SplitRenderItem[] = [];
  let contextIndex = 0;

  const pushContext = (
    buffer: PlanDiffChange[],
    blockKeyBase: string,
    expandedBlocksRef: Record<string, boolean>
  ) => {
    if (buffer.length === 0) return;
    const blockKey = `${blockKeyBase}::ctx-${contextIndex++}`;
    const shouldCollapse = buffer.length >= CONTEXT_COLLAPSE_THRESHOLD;
    if (shouldCollapse) {
      const isExpanded = expandedBlocksRef[blockKey] === true;
      unified.push({
        kind: 'fold',
        key: `${blockKey}::fold-unified`,
        blockKey,
        collapsed: !isExpanded,
        count: buffer.length,
      });
      split.push({
        kind: 'fold',
        key: `${blockKey}::fold-split`,
        blockKey,
        collapsed: !isExpanded,
        count: buffer.length,
      });
      if (isExpanded) {
        buffer.forEach((ctx, idx) => {
          const unifiedKey = `${blockKey}::u-${idx}`;
          const splitKey = `${blockKey}::s-${idx}`;
          unified.push({
            kind: 'line',
            key: unifiedKey,
            variant: 'context',
            text: formatUnifiedLine('context', ctx.value),
          });
          split.push({
            kind: 'row',
            key: splitKey,
            variant: 'context',
            left: ctx.value,
            right: ctx.value,
          });
        });
      }
    } else {
      buffer.forEach((ctx, idx) => {
        const unifiedKey = `${blockKey}::ctx-u-${idx}`;
        const splitKey = `${blockKey}::ctx-s-${idx}`;
        unified.push({
          kind: 'line',
          key: unifiedKey,
          variant: 'context',
          text: formatUnifiedLine('context', ctx.value),
        });
        split.push({
          kind: 'row',
          key: splitKey,
          variant: 'context',
          left: ctx.value,
          right: ctx.value,
        });
      });
    }
    buffer.length = 0;
  };

  diff.hunks.forEach((hunk, hunkIndex) => {
    const headerKey = `${diff.path}::${hunkIndex}::header`;
    unified.push({
      kind: 'line',
      key: `${headerKey}::u`,
      variant: 'header',
      text: hunk.header,
    });
    split.push({
      kind: 'row',
      key: `${headerKey}::s`,
      variant: 'header',
      left: hunk.header,
      right: hunk.header,
    });

    const contextBuffer: PlanDiffChange[] = [];
    hunk.changes.forEach((change, changeIndex) => {
      if (change.type === 'context') {
        contextBuffer.push(change);
        return;
      }

      pushContext(contextBuffer, `${diff.path}::${hunkIndex}`, expandedBlocks);

      const changeKeyBase = `${diff.path}::${hunkIndex}::change-${changeIndex}`;
      unified.push({
        kind: 'line',
        key: `${changeKeyBase}::u`,
        variant: change.type,
        text: formatUnifiedLine(change.type, change.value),
      });

      if (change.type === 'add') {
        split.push({
          kind: 'row',
          key: `${changeKeyBase}::s`,
          variant: 'add',
          left: null,
          right: valueWithMarker('add', 'right', change.value),
        });
      } else if (change.type === 'remove') {
        split.push({
          kind: 'row',
          key: `${changeKeyBase}::s`,
          variant: 'remove',
          left: valueWithMarker('remove', 'left', change.value),
          right: null,
        });
      } else {
        split.push({
          kind: 'row',
          key: `${changeKeyBase}::s`,
          variant: 'context',
          left: change.value,
          right: change.value,
        });
      }
    });

    pushContext(contextBuffer, `${diff.path}::${hunkIndex}`, expandedBlocks);
  });

  const json = buildJsonItems(diff);
  const hasStructured = diff.structured?.type === 'json' && (diff.structured.before !== undefined || diff.structured.after !== undefined);

  return { diff, unified, split, json, hasStructured };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return '__undefined__';
  if (value === null) return 'null';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalJson(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function describeValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const count = value.length;
    return `[${count} item${count === 1 ? '' : 's'}]`;
  }
  if (isPlainObject(value)) {
    const count = Object.keys(value).length;
    return `{${count} key${count === 1 ? '' : 's'}}`;
  }
  return JSON.stringify(value);
}

function computeJsonStatus(beforeValue: unknown, afterValue: unknown): JsonStatus {
  if (beforeValue === undefined && afterValue === undefined) return 'unchanged';
  if (beforeValue === undefined) return 'added';
  if (afterValue === undefined) return 'removed';
  return canonicalJson(beforeValue) === canonicalJson(afterValue) ? 'unchanged' : 'changed';
}

function computeJsonSummary(status: JsonStatus, beforeValue: unknown, afterValue: unknown): string {
  switch (status) {
    case 'added':
      return describeValue(afterValue);
    case 'removed':
      return describeValue(beforeValue);
    case 'changed': {
      const beforeLabel = describeValue(beforeValue);
      const afterLabel = describeValue(afterValue);
      return `${beforeLabel} → ${afterLabel}`;
    }
    default:
      return describeValue(afterValue ?? beforeValue);
  }
}

function buildJsonItems(diff: PlanDiff): JsonRenderItem[] {
  const structured = diff.structured;
  if (!structured || structured.type !== 'json') {
    return [];
  }

  const items: JsonRenderItem[] = [];
  const visit = (
    label: string,
    beforeValue: unknown,
    afterValue: unknown,
    depth: number,
    path: readonly string[]
  ) => {
    const status = computeJsonStatus(beforeValue, afterValue);
    const key = `${diff.path}::json::${path.join('/') || label || 'root'}`;
    items.push({
      key,
      depth,
      status,
      label,
      value: computeJsonSummary(status, beforeValue, afterValue),
    });

    const beforeKind = Array.isArray(beforeValue) ? 'array' : isPlainObject(beforeValue) ? 'object' : 'scalar';
    const afterKind = Array.isArray(afterValue) ? 'array' : isPlainObject(afterValue) ? 'object' : 'scalar';
    const kind = afterKind !== 'scalar' ? afterKind : beforeKind;

    if (kind === 'array') {
      const beforeArray = Array.isArray(beforeValue) ? beforeValue : [];
      const afterArray = Array.isArray(afterValue) ? afterValue : [];
      const length = Math.max(beforeArray.length, afterArray.length);
      for (let index = 0; index < length; index += 1) {
        const childLabel = `[${index}]`;
        visit(childLabel, beforeArray[index], afterArray[index], depth + 1, [...path, childLabel]);
      }
      return;
    }

    if (kind === 'object') {
      const beforeObject = isPlainObject(beforeValue) ? beforeValue : {};
      const afterObject = isPlainObject(afterValue) ? afterValue : {};
      const keys = Array.from(new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])).sort();
      keys.forEach((keyName) => {
        visit(
          keyName,
          (beforeObject as Record<string, unknown>)[keyName],
          (afterObject as Record<string, unknown>)[keyName],
          depth + 1,
          [...path, keyName]
        );
      });
    }
  };

  visit('(root)', structured.before, structured.after, 0, ['root']);
  return items;
}

export function DiffViewer({ diffs, loading = false, autoFocus = false }: DiffViewerProps) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ViewMode>('unified');
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (autoFocus && focusRef.current) {
      focusRef.current.focus();
    }
  }, [autoFocus]);

  const diffModels = useMemo(
    () => (diffs ? diffs.map((diff) => buildDiffModel(diff, expandedBlocks)) : []),
    [diffs, expandedBlocks]
  );

  const hasDiffs = diffModels.length > 0;
  const hasStructured = diffModels.some((model) => model.hasStructured);

  useEffect(() => {
    if (mode === 'json' && !hasStructured) {
      setMode('unified');
    }
  }, [mode, hasStructured]);

  const toggleBlock = useCallback((blockKey: string) => {
    setExpandedBlocks((prev) => ({
      ...prev,
      [blockKey]: !prev[blockKey],
    }));
  }, []);

  const renderUnifiedItem = useCallback(
    (item: UnifiedRenderItem) => {
      if (item.kind === 'fold') {
        const verb = item.collapsed ? 'Show' : 'Hide';
        const lineLabel = item.count === 1 ? 'unchanged line' : 'unchanged lines';
        return (
          <button
            type="button"
            className="agent-panel__diff-fold"
            onClick={() => toggleBlock(item.blockKey)}
            aria-expanded={!item.collapsed}
          >
            {verb} {item.count} {lineLabel}
          </button>
        );
      }

      return (
        <pre className={`agent-panel__diff-line agent-panel__diff-line--${item.variant}`} aria-label={item.variant}>
          {item.text}
        </pre>
      );
    },
    [toggleBlock]
  );

  const renderSplitItem = useCallback(
    (item: SplitRenderItem) => {
      if (item.kind === 'fold') {
        const verb = item.collapsed ? 'Show' : 'Hide';
        const lineLabel = item.count === 1 ? 'unchanged line' : 'unchanged lines';
        return (
          <div className="agent-panel__diff-split-fold">
            <button
              type="button"
              className="agent-panel__diff-fold"
              onClick={() => toggleBlock(item.blockKey)}
              aria-expanded={!item.collapsed}
            >
              {verb} {item.count} {lineLabel}
            </button>
          </div>
        );
      }

      if (item.variant === 'header') {
        return <div className="agent-panel__diff-hunk-header">{item.left || item.right || ''}</div>;
      }

      const leftText = item.left ?? '';
      const rightText = item.right ?? '';
      return (
        <div className={`agent-panel__diff-split-row agent-panel__diff-split-row--${item.variant}`}>
          <pre className="agent-panel__diff-split-cell" aria-label={`${item.variant} original`}>
            {leftText}
          </pre>
          <pre className="agent-panel__diff-split-cell" aria-label={`${item.variant} proposed`}>
            {rightText}
          </pre>
        </div>
      );
    },
    [toggleBlock]
  );

  const renderJsonItem = useCallback((item: JsonRenderItem) => {
    return (
      <div
        className={`agent-panel__diff-json-line agent-panel__diff-json-line--${item.status}`}
        role="row"
        aria-label={`${item.status} ${item.label}`}
      >
        <span className="agent-panel__diff-json-label" style={{ paddingLeft: item.depth * 16 }}>
          {item.label}
        </span>
        <span className="agent-panel__diff-json-value">{item.value}</span>
      </div>
    );
  }, []);

  return (
    <Container tabIndex={-1} ref={focusRef} aria-live="polite">
      <div>
        <ToggleGroup role="radiogroup" aria-label="Diff view mode">
          <ToggleButton
            type="button"
            onClick={() => setMode('unified')}
            $active={mode === 'unified'}
            aria-pressed={mode === 'unified'}
          >
            Unified
          </ToggleButton>
          <ToggleButton
            type="button"
            onClick={() => setMode('split')}
            $active={mode === 'split'}
            aria-pressed={mode === 'split'}
          >
            Split
          </ToggleButton>
          <ToggleButton
            type="button"
            onClick={() => setMode('json')}
            $active={mode === 'json'}
            aria-pressed={mode === 'json'}
            disabled={!hasStructured}
            title={hasStructured ? 'Semantic JSON diff view' : 'JSON mode available when plan provides structured data'}
          >
            JSON
          </ToggleButton>
        </ToggleGroup>
      </div>

      {loading ? (
        <LoadingBlock role="status">Generating preview…</LoadingBlock>
      ) : !hasDiffs ? (
        <EmptyState role="status">
          No changes detected. The plan does not propose any file modifications.
        </EmptyState>
      ) : (
        diffModels.map((model) => (
          <DiffSection key={model.diff.path}>
            <DiffHeader>
              <FilePath>{model.diff.path}</FilePath>
              {model.diff.summary ? (
                <Summary>
                  +{model.diff.summary.additions} / -{model.diff.summary.deletions}
                </Summary>
              ) : null}
            </DiffHeader>

            {mode === 'split' ? (
              <>
                <SplitHeaderRow aria-hidden="true">
                  <span>Original</span>
                  <span>Proposed</span>
                </SplitHeaderRow>
                <VirtualizedList
                  key={`${model.diff.path}::split`}
                  items={model.split}
                  renderItem={renderSplitItem}
                  lineHeight={SPLIT_LINE_HEIGHT}
                  className="agent-panel__diff-scroll agent-panel__diff-scroll--split"
                  ariaLabel={`Split diff view for ${model.diff.path}`}
                />
              </>
            ) : mode === 'json' ? (
              model.hasStructured ? (
                model.json.length ? (
                  <VirtualizedList
                    key={`${model.diff.path}::json`}
                    items={model.json}
                    renderItem={renderJsonItem}
                    lineHeight={JSON_LINE_HEIGHT}
                    className="agent-panel__diff-scroll agent-panel__diff-scroll--json"
                    ariaLabel={`Structured JSON diff for ${model.diff.path}`}
                  />
                ) : (
                  <JsonEmpty role="status">Structured JSON detected, but no differences found.</JsonEmpty>
                )
              ) : (
                <JsonFallback role="status">
                  Structured JSON output was not supplied for this diff. Switch back to Unified view to inspect textual
                  changes.
                </JsonFallback>
              )
            ) : (
              <VirtualizedList
                key={`${model.diff.path}::unified`}
                items={model.unified}
                renderItem={renderUnifiedItem}
                lineHeight={LINE_HEIGHT}
                className="agent-panel__diff-scroll agent-panel__diff-scroll--unified"
                ariaLabel={`Unified diff view for ${model.diff.path}`}
              />
            )}
          </DiffSection>
        ))
      )}
    </Container>
  );
}
