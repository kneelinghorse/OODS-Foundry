/**
 * Dashboard layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── header        – slot: page title / breadcrumbs
 *   ├── metrics-grid  – Grid with N metric cards
 *   └── body (sidebar layout)
 *       ├── main-content – slot: primary content area
 *       └── sidebar      – slot: side panel / filters
 */
import type { UiElement } from '../../schemas/generated.js';
import type { DashboardSectionPlan, DashboardSectionSlot } from '../intent-sections.js';
import {
  type Slot,
  type TemplateResult,
  resetIdCounter,
  uid,
  wrapSchema,
  slotElement,
} from './types.js';

export interface DashboardOptions {
  /** Number of metric card columns (default: 4). */
  metricColumns?: number;
  /** Whether to include the sidebar (default: true). */
  includeSidebar?: boolean;
  /** Optional long-form dashboard section plan. */
  sectionPlan?: DashboardSectionPlan;
  /** Theme token (optional). */
  theme?: string;
}

function makeSlotDescriptor(
  slotName: string,
  description: string,
  intent: string,
  required: boolean,
): DashboardSectionSlot {
  return {
    slotName,
    description,
    intent,
    required,
    zone: slotName.startsWith('sidebar')
      ? 'sidebar'
      : slotName === 'metrics' || slotName.startsWith('metrics-section-')
        ? 'metrics'
        : 'main',
    context: [],
  };
}

function buildSectionNode(section: DashboardSectionSlot): UiElement {
  return {
    id: uid('dashboard-section'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-tight' },
    children: [
      ...(section.title ? [{
        id: uid('dashboard-section-title'),
        component: 'Text',
        props: { text: section.title },
      } satisfies UiElement] : []),
      slotElement(section.slotName, section.intent),
    ],
  };
}

export function dashboardTemplate(opts: DashboardOptions = {}): TemplateResult {
  resetIdCounter();
  const { metricColumns = 4, includeSidebar = true, sectionPlan, theme } = opts;

  const metricSections = sectionPlan?.metrics.length
    ? sectionPlan.metrics
    : [makeSlotDescriptor('metrics', 'Metric display cards', 'metrics-display', true)];
  const mainSections = sectionPlan?.main.length
    ? sectionPlan.main
    : [makeSlotDescriptor('main-content', 'Primary content area', 'data-display', true)];
  const sidebarSections = sectionPlan?.sidebar.length
    ? sectionPlan.sidebar
    : [makeSlotDescriptor('sidebar', 'Side panel for filters or navigation', 'navigation-panel', false)];
  const useStructuredSections = Boolean(sectionPlan?.expanded);

  const slots: Slot[] = [
    { name: 'header', description: 'Page header area', intent: 'page-header', required: true },
    ...metricSections.map((section) => ({
      name: section.slotName,
      description: section.description,
      intent: section.intent,
      required: section.required,
    })),
    ...mainSections.map((section) => ({
      name: section.slotName,
      description: section.description,
      intent: section.intent,
      required: section.required,
    })),
  ];

  // -- header slot --
  const header: UiElement = {
    id: uid('dashboard-header'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    children: [slotElement('header', 'page-header', 'Text')],
  };

  // -- metrics grid --
  const metricsGrid: UiElement = {
    id: uid('dashboard-metrics'),
    component: 'Grid',
    // s206-m01: `gap` takes the Grid's own sizes; 'cluster-default' is a layout gapToken name the Grid passed through
    // as an invalid CSS value, so the metric cards had no gap at all.
    props: { columns: metricColumns, gap: 'md' },
    children: useStructuredSections
      ? metricSections.map(buildSectionNode)
      : [slotElement(metricSections[0].slotName, metricSections[0].intent)],
  };

  // -- main content --
  const mainContent: UiElement = {
    id: uid('dashboard-main'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: useStructuredSections
      ? mainSections.map(buildSectionNode)
      : [slotElement(mainSections[0].slotName, mainSections[0].intent)],
  };

  // -- body (with or without sidebar) --
  let body: UiElement;
  if (includeSidebar) {
    slots.push(...sidebarSections.map((section) => ({
      name: section.slotName,
      description: section.description,
      intent: section.intent,
      required: section.required,
    })));

    body = {
      id: uid('dashboard-body'),
      component: 'Card',
      layout: { type: 'sidebar', gapToken: 'cluster-default' },
      children: [
        mainContent,
        {
          id: uid('dashboard-sidebar'),
          component: 'Stack',
          layout: { type: 'stack', gapToken: 'cluster-tight' },
          style: { spacingToken: 'inset-default' },
          children: useStructuredSections
            ? sidebarSections.map(buildSectionNode)
            : [slotElement(sidebarSections[0].slotName, sidebarSections[0].intent)],
        },
      ],
    };
  } else {
    body = mainContent;
  }

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-dashboard'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [header, metricsGrid, body],
  };

  return { schema: wrapSchema(screen, theme), slots };
}
