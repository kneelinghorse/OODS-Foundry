import type { ComponentType } from 'react';
import { CardView } from './CardView.js';
import { DetailView } from './DetailView.js';
import { FormView } from './FormView.js';
import { InlineView } from './InlineView.js';
import { ListView } from './ListView.js';
import { TimelineView } from './TimelineView.js';
import { ChartView } from './ChartView.js';
import { DashboardView } from './DashboardView.js';
import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';

export type ContextKind =
  | 'list'
  | 'detail'
  | 'form'
  | 'timeline'
  | 'card'
  | 'inline'
  | 'chart'
  | 'dashboard';

export type ContextComponent = ComponentType<{
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}>;

const CONTEXT_REGISTRY: Record<ContextKind, ContextComponent> = Object.freeze({
  list: ListView,
  detail: DetailView,
  form: FormView,
  timeline: TimelineView,
  card: CardView,
  inline: InlineView,
  chart: ChartView,
  dashboard: DashboardView,
});

export function getContextComponent(kind: ContextKind): ContextComponent {
  const component = CONTEXT_REGISTRY[kind];
  if (!component) {
    throw new Error(`Unknown render context "${kind}".`);
  }
  return component;
}

export function listContextKinds(): ContextKind[] {
  return Object.keys(CONTEXT_REGISTRY) as ContextKind[];
}

export {
  CardView,
  DetailView,
  FormView,
  InlineView,
  ListView,
  TimelineView,
  ChartView,
  DashboardView,
};
