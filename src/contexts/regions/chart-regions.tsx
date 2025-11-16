import type { JSX, ReactNode } from 'react';
import { Card } from '../../components/base/Card.js';
import { Text } from '../../components/base/Text.js';
import type { RenderContext } from '../../types/render-context.js';
import type { ViewExtension, ViewExtensionMetadata } from '../../types/view-extension.js';

export type ChartRegionVariant = 'chart' | 'dashboard';

export interface ChartPanelDefinition<Data = unknown> {
  readonly id: string;
  readonly title: ReactNode | ((ctx: RenderContext<Data>) => ReactNode);
  readonly description?: ReactNode | ((ctx: RenderContext<Data>) => ReactNode);
  readonly render: (ctx: RenderContext<Data>) => ReactNode;
  readonly footer?: ReactNode | ((ctx: RenderContext<Data>) => ReactNode);
}

export interface CreateChartRegionExtensionsInput<Data = unknown> {
  readonly traitId: string;
  readonly panels: readonly ChartPanelDefinition<Data>[];
  readonly hero?: (ctx: RenderContext<Data>) => ReactNode;
  readonly toolbar?: (ctx: RenderContext<Data>) => ReactNode;
  readonly insights?: (ctx: RenderContext<Data>) => ReactNode;
  readonly variant?: ChartRegionVariant;
  readonly priorityBase?: number;
  readonly metadataTags?: readonly string[];
}

interface ChartPanelGridProps<Data> {
  readonly context: RenderContext<Data>;
  readonly panels: readonly ChartPanelDefinition<Data>[];
  readonly variant: ChartRegionVariant;
}

function resolveNode<Data>(
  node: ReactNode | ((ctx: RenderContext<Data>) => ReactNode),
  ctx: RenderContext<Data>
): ReactNode {
  if (typeof node === 'function') {
    return (node as (context: RenderContext<Data>) => ReactNode)(ctx);
  }
  return node;
}

function ChartPanelGrid<Data>({
  context,
  panels,
  variant,
}: ChartPanelGridProps<Data>): JSX.Element {
  const layoutClass =
    variant === 'dashboard'
      ? 'grid gap-6 lg:grid-cols-2 xl:grid-cols-3'
      : 'grid gap-6';

  return (
    <div data-chart-grid={variant} className={layoutClass}>
      {panels.map((panel) => {
        const title = resolveNode(panel.title, context);
        const description = panel.description ? resolveNode(panel.description, context) : null;
        const footer = panel.footer ? resolveNode(panel.footer, context) : null;

        return (
          <Card
            key={panel.id}
            data-chart-panel={panel.id}
            className="flex flex-col gap-4"
            elevated
          >
            <div className="flex flex-col gap-2">
              {title ? (
                <Text as="h3" size="lg" weight="semibold">
                  {title}
                </Text>
              ) : null}
              {description ? (
                <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
                  {description}
                </Text>
              ) : null}
            </div>

            <div data-chart-panel-body>{panel.render(context)}</div>
            {footer ? (
              <div
                data-chart-panel-footer
                className="border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400"
              >
                {footer}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function buildMetadata(tags: readonly string[] | undefined): ViewExtensionMetadata {
  const baseTags = new Set(tags ?? []);
  baseTags.add('chart-region');
  return {
    tags: Array.from(baseTags),
  };
}

export function createChartRegionExtensions<Data>(
  input: CreateChartRegionExtensionsInput<Data>
): ViewExtension<Data>[] {
  const {
    traitId,
    panels,
    hero,
    toolbar,
    insights,
    variant = 'chart',
    priorityBase = 40,
    metadataTags,
  } = input;

  const extensions: Array<ViewExtension<Data> | null> = [];
  const metadata = buildMetadata(metadataTags);

  if (hero) {
    extensions.push({
      id: `${traitId}:chart-hero`,
      region: 'pageHeader',
      type: 'section',
      priority: priorityBase + 20,
      metadata,
      render: (ctx) => hero(ctx),
    });
  }

  if (toolbar) {
    extensions.push({
      id: `${traitId}:chart-toolbar`,
      region: 'viewToolbar',
      type: 'section',
      priority: priorityBase + 10,
      metadata,
      render: (ctx) => toolbar(ctx),
    });
  }

  extensions.push({
    id: `${traitId}:chart-panels`,
    region: 'main',
    type: 'section',
    priority: priorityBase,
    metadata,
    render: (ctx) => <ChartPanelGrid context={ctx} panels={panels} variant={variant} />,
  });

  if (insights) {
    extensions.push({
      id: `${traitId}:chart-insights`,
      region: 'contextPanel',
      type: 'section',
      priority: priorityBase - 5,
      metadata,
      render: (ctx) => insights(ctx),
    });
  }

  return extensions.filter((entry): entry is ViewExtension<Data> => Boolean(entry));
}
