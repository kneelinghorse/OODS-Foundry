import { componentContracts } from '@oods/component-contracts';
import { unitFieldLabel } from './unit-field-label.js';
/**
 * Tab/section label generator (s62-m05).
 *
 * For object-aware composition, derives meaningful tab labels from trait
 * categories instead of generic "Tab 1", "Tab 2", "Tab 3". Groups
 * view_extensions by trait category and maps categories to human-readable
 * labels. User-provided tabLabels in preferences take precedence.
 */

import type { ComposedObject, ResolvedTrait } from '../objects/trait-composer.js';
import type { ViewExtension } from '../objects/types.js';
import type { UiElement, UiSchema } from '../schemas/generated.js';

/** Names identify controls; descriptions belong in their separate help text. */
/**
 * traits/core/Provenanced (s205-m03): the wording a person reads beside each provenance value. "Provenance method"
 * says what the field is called; "Obtained by" says what the value means.
 */
const PROVENANCE_LABELS: Record<string, string> = {
  provenance_source: 'Source', provenance_record: 'Record', provenance_locator: 'Read from',
  provenance_method: 'Obtained by', provenance_at: 'Obtained',
};

export function fieldLabel(name: string, _description?: string): string {
  if (PROVENANCE_LABELS[name]) return PROVENANCE_LABELS[name]!;
  const unitLabel = unitFieldLabel(name);
  if (unitLabel) return unitLabel;
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Shared fields explain user choices without exposing trait implementation notes. */
export function fieldHelp(name: string, description?: string): string | undefined {
  const help: Record<string, string> = {
    status: 'Choose the current status.',
    billing_interval: 'How often this record is billed.',
    unit_label: 'Unit name shown beside quantities.',
    rollover_strategy: 'What happens to unused units at the end of the period.',
    preference_namespaces: 'Preference groups available for this record.',
    cancellation_reason_code: 'Choose the reason for cancellation.',
    preference_version: 'Version of this record’s preferences.',
    owner_type: 'Choose the kind of owner.',
    owner_id: 'Identifier of the owner.',
    label: 'Name shown for this record.',
    placeholder: 'Shown when the label is empty.',
    tag_count: 'Number of tags assigned to this record.',
  };
  return description ? help[name] ?? description : undefined;
}

/** Resolve anonymous form-slot labels before framework normalization can emit Field N. */
export function populateFieldLabels(schema: UiSchema): void {
  const visit = (node: UiElement): void => {
    const field = node.props?.field;
    const entry = typeof field === 'string' ? schema.objectSchema?.[field] : undefined;
    const anonymousSlot = node.props?.label === undefined && /^field-\d+$/.test(node.meta?.label ?? '');
    const placeholder = typeof node.props?.label === 'string' && /^Field \d+$/.test(node.props.label);
    const contract = (componentContracts as Readonly<Record<string, { props: readonly string[] } | undefined>>)[node.component];
    if ((!contract || contract.props.includes('label')) && entry && typeof field === 'string' && (anonymousSlot || placeholder || node.props?.label === entry.description)) {
      node.props = { ...node.props, label: fieldLabel(field) };
    }
    node.children?.forEach(visit);
  };
  schema.screens.forEach(visit);
}

/* ------------------------------------------------------------------ */
/*  Category → label mapping                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  lifecycle: 'Status & History',
  financial: 'Billing',
  content: 'Content',
  core: 'Overview',
  behavioral: 'Behavior',
  visual: 'Appearance',
  structural: 'Structure',
  viz: 'Visualization',
};

/**
 * Resolve a human-readable label for a trait category.
 * Falls back to Title Case of the category name.
 */
function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? titleCase(category);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LabelResult {
  /** Generated tab/section labels, one per trait category group */
  labels: string[];
  /** Number of view_extensions per label group */
  groupSizes: number[];
  /** Warnings (e.g., single category producing single tab) */
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Label generation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract the trait category from a resolved trait.
 * Uses the trait definition's category field, falling back to
 * extracting the directory prefix from the trait ref name (e.g., "lifecycle/Stateful" → "lifecycle").
 */
function getTraitCategory(trait: ResolvedTrait): string {
  const definedCategory = trait.definition.trait.category;
  if (definedCategory) return definedCategory;

  // Fallback: extract from ref name if category-qualified
  const slash = trait.ref.name.indexOf('/');
  if (slash > 0) return trait.ref.name.slice(0, slash);

  return 'general';
}

/**
 * Generate tab/section labels from trait categories for a given context.
 *
 * Groups view_extensions by their source trait's category,
 * orders groups by total priority (highest first),
 * and maps each group to a human-readable label.
 *
 * @param composed - The composed object with resolved traits
 * @param context - View context (detail, list, form, etc.)
 * @param userLabels - Optional user-provided labels that override generated ones
 */
export function generateLabels(
  composed: ComposedObject,
  context: string,
  userLabels?: string[],
): LabelResult {
  const warnings: string[] = [];

  // Build category → extensions mapping with priority tracking
  const categoryGroups = new Map<string, { extensions: ViewExtension[]; totalPriority: number }>();

  for (const resolved of composed.traits) {
    const category = getTraitCategory(resolved);
    const extensions: ViewExtension[] = resolved.definition.view_extensions?.[context] ?? [];

    if (extensions.length === 0) continue;

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, { extensions: [], totalPriority: 0 });
    }

    const group = categoryGroups.get(category)!;
    for (const ext of extensions) {
      group.extensions.push(ext);
      group.totalPriority += ext.priority ?? 0;
    }
  }

  // No categories found
  if (categoryGroups.size === 0) {
    warnings.push(
      `No trait categories with view_extensions for context "${context}". ` +
        'Labels cannot be generated.',
    );
    return { labels: [], groupSizes: [], warnings };
  }

  // Sort groups by total priority descending
  const sortedGroups = Array.from(categoryGroups.entries()).sort(
    (a, b) => b[1].totalPriority - a[1].totalPriority,
  );

  // Generate labels
  const labels = sortedGroups.map(([category]) => categoryLabel(category));
  const groupSizes = sortedGroups.map(([, group]) => group.extensions.length);

  // Apply user overrides
  if (userLabels && userLabels.length > 0) {
    for (let i = 0; i < Math.min(userLabels.length, labels.length); i++) {
      labels[i] = userLabels[i];
    }
  }

  // Warn for single category
  if (labels.length === 1) {
    warnings.push(
      `Object "${composed.object.name}" has a single trait category group for context "${context}". ` +
        'Consider using a single-section layout instead of tabs.',
    );
  }

  return { labels, groupSizes, warnings };
}
