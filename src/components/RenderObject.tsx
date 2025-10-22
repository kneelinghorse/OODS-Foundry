import * as React from 'react';
import type { ReactNode } from 'react';
import { composeExtensions } from '../compositor/composeExtensions.js';
import { buildRenderContext } from '../context/buildRenderContext.js';
import { getContextComponent, type ContextKind } from '../contexts/index.js';
import type { ObjectSpec, RenderContext } from '../types/render-context.js';
import type { RegionMap } from '../types/regions.js';
import type { ViewExtension } from '../types/view-extension.js';
import { resolveTraitExtensions, type TraitViewErrorDetails } from '../traits/adapter.js';
import { renderReport, type RenderReportPayload } from './renderReport.js';
import { ViewContainer } from '../engine/render/ViewContainer.js';
import { collectContributionExtensions } from '../engine/contributions/index.js';

export interface RenderObjectProps<Data = unknown> {
  readonly object: ObjectSpec<Data>;
  readonly context: ContextKind;
  readonly data: Data;
  readonly debug?: boolean;
  readonly className?: string;
}

function useTraitExtensions<Data>(
  object: ObjectSpec<Data>,
  contextKind: ContextKind,
  renderContext: RenderContext<Data>,
  onTraitViewError?: (details: TraitViewErrorDetails<Data>) => void
): ViewExtension<Data>[] {
  return React.useMemo(() => {
    const baseExtensions = resolveTraitExtensions<Data>(
      object,
      renderContext,
      onTraitViewError
        ? {
            onTraitViewError,
          }
        : undefined
    );

    const contributionExtensions = collectContributionExtensions<Data>({
      object,
      context: contextKind,
      renderContext,
    });

    return baseExtensions.concat(contributionExtensions);
  }, [object, renderContext, contextKind, onTraitViewError]);
}

function useRegionMap<Data>(
  extensions: readonly ViewExtension<Data>[],
  renderContext: RenderContext<Data>
): RegionMap {
  return React.useMemo<RegionMap>(
    () => composeExtensions<Data>(extensions, renderContext) as RegionMap,
    [extensions, renderContext]
  );
}

function useRenderDebug<Data>(
  enabled: boolean | undefined,
  object: ObjectSpec<Data>,
  context: ContextKind,
  regions: RegionMap,
  extensions: readonly ViewExtension<Data>[]
): RenderReportPayload | null {
  const report = React.useMemo<RenderReportPayload | null>(() => {
    if (!enabled) {
      return null;
    }
    return renderReport(object, context, regions, extensions);
  }, [enabled, object, context, regions, extensions]);

  React.useEffect(() => {
    if (!enabled || !report) {
      return;
    }

    const label = `[RenderObject] ${object.name ?? object.id} → ${context}`;
    if (typeof console !== 'undefined') {
      console.groupCollapsed?.(label);
      console.table?.(
        report.regions.map((entry) => ({
          region: entry.region,
          hasContent: entry.hasContent,
          extensions: entry.extensionIds.join(', '),
        }))
      );
      console.info?.('Traits', report.traits);
      console.info?.('Total extensions', report.totalExtensions);
      console.groupEnd?.();
    }
  }, [enabled, report, object, context]);

  return report;
}

export const RenderObject: React.FC<RenderObjectProps> = ({
  object,
  context,
  data,
  debug,
  className,
}) => {
  const renderContext = React.useMemo(
    () =>
      buildRenderContext({
        object,
        data,
      }),
    [object, data]
  );

  const traitErrorLogger = React.useCallback(
    (details: TraitViewErrorDetails<unknown>) => {
      if (!debug) {
        return;
      }

      const objectLabel = object.name ?? object.id;
      const traitLabel = details.trait.id ?? 'unknown-trait';
      const label = `[RenderObject] Trait view failed for "${traitLabel}" on "${objectLabel}" (${context})`;

      if (typeof console !== 'undefined') {
        console.groupCollapsed?.(label);
        console.error?.(details.error);
        console.groupEnd?.();
      }
    },
    [debug, object, context]
  );

  const extensions = useTraitExtensions(
    object,
    context,
    renderContext,
    debug ? traitErrorLogger : undefined
  );
  const regions = useRegionMap(extensions, renderContext);
  const report = useRenderDebug(debug, object, context, regions, extensions);

  const ContextComponent = React.useMemo(() => getContextComponent(context), [context]);

  const content = React.useMemo<ReactNode>(() => {
    const renderedContext = (
      <ViewContainer context={context} regions={regions} className={className}>
        {(containerAttributes) => (
          <ContextComponent regions={regions} containerProps={containerAttributes} />
        )}
      </ViewContainer>
    );

    if (!debug || !report) {
      return renderedContext;
    }

    return (
      <div
        data-render-debug="true"
        style={{
          display: 'grid',
          gap: 'var(--view-gap-default)',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <div data-debug-pane="view">{renderedContext}</div>
        <pre data-render-report>
          {JSON.stringify(report, null, 2)}
        </pre>
      </div>
    );
  }, [className, context, debug, report, ContextComponent, regions]);

  return <>{content}</>;
};

RenderObject.displayName = 'RenderObject';

export type { ContextKind, RenderReportPayload };
