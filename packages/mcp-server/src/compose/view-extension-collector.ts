/**
 * View extension collector (s62-m02).
 *
 * Given a ComposedObject and a target context, gathers all view_extensions
 * for that context and returns a SlotPlan[] sorted by priority desc, then
 * trait declaration order. Each entry includes the source trait name for
 * downstream attribution.
 */

import type { ComposedObject } from '../objects/trait-composer.js';
import type { ViewExtension } from '../objects/types.js';
import { resolveTraitRecipeProps } from './trait-recipes.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SlotPlan {
  /** Component name from the view_extension */
  component: string;
  /** Trait that contributed this extension (e.g. "lifecycle/Stateful") */
  sourceTrait: string;
  /** Position hint: top, bottom, main, sidebar, before, after */
  position: string;
  /** Optional explicit slot target when projection needs exact placement. */
  targetSlot?: string;
  /** Priority for ordering (higher = earlier). Defaults to 0. */
  priority: number;
  /** Trait-defined props including field mappings */
  props: Record<string, unknown>;
}

export interface CollectResult {
  /** Ordered slot plan entries for the target context */
  plan: SlotPlan[];
  /** Warning messages (e.g., empty context) */
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Collector                                                          */
/* ------------------------------------------------------------------ */

interface RankedEntry {
  plan: SlotPlan;
  traitOrder: number;
}

type DashboardSourceContext = 'card' | 'list' | 'detail';
type DashboardTargetSlot = 'header' | 'metrics' | 'main-content' | 'sidebar';

interface ProjectedDashboardEntry extends RankedEntry {
  sourceContext: DashboardSourceContext;
  targetSlot: DashboardTargetSlot;
}

const DASHBOARD_FALLBACK_CONTEXTS: DashboardSourceContext[] = ['card', 'list', 'detail'];
const DASHBOARD_SLOT_ORDER: DashboardTargetSlot[] = ['header', 'metrics', 'main-content', 'sidebar'];
const DASHBOARD_SLOT_LIMITS: Record<DashboardTargetSlot, number> = {
  header: 1,
  metrics: 3,
  'main-content': 3,
  sidebar: 3,
};

const DASHBOARD_COMPONENT_HINTS: Record<DashboardTargetSlot, RegExp> = {
  header: /(header|title|hero|breadcrumb)/i,
  metrics: /(price|billing|amount|progress|metric|kpi)/i,
  'main-content': /(timeline|table|chart|feed|activity|audit|grid|preview|list|panel)/i,
  sidebar: /(statusbadge|messagestatusbadge|cancellation(summary|badge)|timestamp|filter|metadata)/i,
};

const DASHBOARD_CONTEXT_WEIGHTS: Record<DashboardTargetSlot, Record<DashboardSourceContext, number>> = {
  header: { card: 3, list: 2, detail: 1 },
  metrics: { card: 2, list: 3, detail: 1 },
  'main-content': { card: 1, list: 2, detail: 3 },
  sidebar: { card: 3, list: 1, detail: 2 },
};

/**
 * Collect view_extensions for a specific context from a composed object.
 *
 * Iterates the resolved traits in declaration order, extracts view_extensions
 * for the target context, and returns a SlotPlan[] sorted by:
 *   1. Priority descending (higher priority first)
 *   2. Trait declaration order ascending (earlier trait first on tie)
 */
function collectRankedEntries(
  composed: ComposedObject,
  context: string,
): RankedEntry[] {
  const ranked: RankedEntry[] = [];
  for (let traitOrder = 0; traitOrder < composed.traits.length; traitOrder++) {
    const resolved = composed.traits[traitOrder];
    const traitName = resolved.ref.name;
    const extensions: ViewExtension[] =
      resolved.definition.view_extensions?.[context] ?? [];

    for (const ext of extensions) {
      ranked.push({
        plan: {
          component: ext.component,
          sourceTrait: traitName,
          position: ext.position ?? 'main',
          priority: ext.priority ?? 0,
          props: resolveTraitRecipeProps(resolved, ext),
        },
        traitOrder,
      });
    }
  }

  return ranked;
}

function sortRankedEntries(entries: RankedEntry[]): void {
  entries.sort((a, b) => {
    if (b.plan.priority !== a.plan.priority) {
      return b.plan.priority - a.plan.priority;
    }
    return a.traitOrder - b.traitOrder;
  });
}

export function collectViewExtensions(
  composed: ComposedObject,
  context: string,
): CollectResult {
  const warnings: string[] = [];
  const ranked = collectRankedEntries(composed, context);

  // s239 (site SITE-11): an object that declares no view extensions at all, such as a fresh import, is composed from its
  // fields by design, so only a context missing beside others the object declares is worth a warning.
  const declared = Object.keys(composed.viewExtensions);
  if (ranked.length === 0 && declared.length > 0) {
    warnings.push(
      `No view_extensions found for context "${context}" in object "${composed.object.name}". ` +
        `Available contexts: ${declared.join(', ')}`,
    );
  }

  sortRankedEntries(ranked);

  return {
    plan: ranked.map((r) => r.plan),
    warnings,
  };
}

function inferDashboardTargetSlot(
  plan: SlotPlan,
  sourceContext: DashboardSourceContext,
): DashboardTargetSlot | undefined {
  const componentName = plan.component;

  if (DASHBOARD_COMPONENT_HINTS.header.test(componentName)) {
    return 'header';
  }
  if (DASHBOARD_COMPONENT_HINTS.metrics.test(componentName)) {
    return 'metrics';
  }
  if (DASHBOARD_COMPONENT_HINTS['main-content'].test(componentName)) {
    return 'main-content';
  }
  if (DASHBOARD_COMPONENT_HINTS.sidebar.test(componentName)) {
    return 'sidebar';
  }

  switch (sourceContext) {
    case 'card':
      return plan.position === 'after' ? 'metrics' : 'sidebar';
    case 'list':
      if (plan.position === 'after') return 'metrics';
      if (plan.position === 'before') return 'sidebar';
      return 'main-content';
    case 'detail':
      switch (plan.position) {
        case 'top':
        case 'sidebar':
          return 'sidebar';
        case 'bottom':
        case 'main':
          return 'main-content';
        case 'before':
          return 'header';
        case 'after':
          return 'metrics';
        default:
          return 'main-content';
      }
  }
}

function getDashboardComponentBonus(
  componentName: string,
  targetSlot: DashboardTargetSlot,
): number {
  switch (targetSlot) {
    case 'header':
      return /(header|title|hero)/i.test(componentName) ? 40 : 0;
    case 'metrics':
      if (/(progress)/i.test(componentName)) return 50;
      if (/(price|billing|amount|metric|kpi|summary)/i.test(componentName)) return 40;
      return 0;
    case 'main-content':
      if (/(timeline|table|chart|feed|activity|audit)/i.test(componentName)) return 40;
      if (/(panel|preview|grid)/i.test(componentName)) return 20;
      return 0;
    case 'sidebar':
      if (/statusbadge|messagestatusbadge/i.test(componentName)) return 45;
      if (/cancellation(summary|badge)/i.test(componentName)) return 35;
      if (/(timestamp|filter|metadata)/i.test(componentName)) return 20;
      return 0;
  }
}

function compareProjectedDashboardEntries(
  a: ProjectedDashboardEntry,
  b: ProjectedDashboardEntry,
): number {
  const scoreA = a.plan.priority
    + DASHBOARD_CONTEXT_WEIGHTS[a.targetSlot][a.sourceContext]
    + getDashboardComponentBonus(a.plan.component, a.targetSlot);
  const scoreB = b.plan.priority
    + DASHBOARD_CONTEXT_WEIGHTS[b.targetSlot][b.sourceContext]
    + getDashboardComponentBonus(b.plan.component, b.targetSlot);

  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }

  if (a.plan.priority !== b.plan.priority) {
    return b.plan.priority - a.plan.priority;
  }

  return a.traitOrder - b.traitOrder;
}

function buildPlanSignature(plan: SlotPlan): string {
  // These two Billable projections present the same amount, currency and interval. Coalesce only
  // that known pair with identical bindings/options; other components remain distinct facts.
  if (['BillingSummaryBadge', 'BillingCardMeta'].includes(plan.component)) {
    const props = Object.entries(plan.props).sort(([a], [b]) => a.localeCompare(b));
    return `${plan.sourceTrait}:billing-summary:${JSON.stringify(props)}`;
  }
  return `${plan.targetSlot ?? ''}:${plan.component}`;
}

export function collectDashboardViewExtensions(
  composed: ComposedObject,
): CollectResult {
  const direct = collectViewExtensions(composed, 'dashboard');
  if (direct.plan.some(entry => !entry.props.chart)) {
    return direct;
  }
  // A bound chart adds a projection to the existing object dashboard. It does
  // not replace the compact metric and domain panels inferred from other views.
  const chartPlan = direct.plan.map(entry => ({ ...entry, targetSlot: 'main-content' }));

  const projected: ProjectedDashboardEntry[] = [];

  for (const context of DASHBOARD_FALLBACK_CONTEXTS) {
    const ranked = collectRankedEntries(composed, context);
    for (const entry of ranked) {
      // Data-bound detail charts do not imply a dashboard placement.
      if (entry.plan.props.chart) continue;
      const targetSlot = inferDashboardTargetSlot(entry.plan, context);
      if (!targetSlot) {
        continue;
      }

      projected.push({
        ...entry,
        sourceContext: context,
        targetSlot,
      });
    }
  }

  if (projected.length === 0) {
    return { ...direct, plan: chartPlan };
  }

  const projectedPlan: SlotPlan[] = [];
  for (const slot of DASHBOARD_SLOT_ORDER) {
    const slotCandidates = projected
      .filter((entry) => entry.targetSlot === slot)
      .sort(compareProjectedDashboardEntries);
    const seen = new Set<string>();

    for (const candidate of slotCandidates) {
      const signature = buildPlanSignature(candidate.plan);
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      projectedPlan.push({
        ...candidate.plan,
        targetSlot: slot,
      });

      if (seen.size >= DASHBOARD_SLOT_LIMITS[slot]) {
        break;
      }
    }
  }

  // Compact fallbacks must not repeat a richer authored summary or the record title.
  const cancellationFields = new Set(projectedPlan.filter(entry => entry.component === 'CancellationSummary').map(entry => entry.props.cancelAtPeriodEndField));
  const headingFields = new Set(projectedPlan.filter(entry => entry.targetSlot === 'header').flatMap(entry => [entry.props.field, entry.props.titleField]));
  const meaningful = projectedPlan.filter(entry => {
    if (entry.component === 'CancellationBadge' && cancellationFields.has(entry.props.field)) return false;
    if (entry.component === 'LabelCell' && headingFields.has(entry.props.field)) return false;
    return true;
  }).map(entry => entry.component === 'RelativeTimestamp'
    ? { ...entry, props: { ...entry.props, hideWhenEmpty: true } } : entry);
  return {
    plan: [...chartPlan, ...meaningful],
    warnings: [],
  };
}
