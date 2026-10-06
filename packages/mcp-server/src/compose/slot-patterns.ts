import { unitFieldLabel } from './unit-field-label.js';
/**
 * Composite slot patterns — field group assembly (s73-m04).
 *
 * When a slot represents a field group, generate composite UiElement
 * structures instead of a single component:
 *
 *   - field-pair:   Label + Input (for form fields)
 *   - metric-card:  Label + Value + Badge (for dashboard KPIs)
 *   - field-group:  Heading + Stack of field-pairs (for form sections)
 *
 * These patterns produce valid UiElement subtrees that codegen emitters
 * can handle via existing field prop wiring.
 */

import type { UiElement } from '../schemas/generated.js';
import type { FieldDefinition } from '../objects/types.js';
import { uid } from './templates/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SlotPatternType = 'field-pair' | 'metric-card' | 'field-group';

export interface SlotPatternResult {
  /** The composite UiElement tree */
  element: UiElement;
  /** Which pattern was used */
  pattern: SlotPatternType;
  /** Field names consumed by this pattern */
  fieldsUsed: string[];
}

/* ------------------------------------------------------------------ */
/*  Pattern: field-pair (Label + Input)                                */
/* ------------------------------------------------------------------ */

/**
 * Generate a Label + Input pair for a single form field.
 * Used in form contexts where each field needs a label.
 */
export function fieldPairPattern(
  fieldName: string,
  fieldDef: FieldDefinition,
): SlotPatternResult {
  const inputComponent = selectInputComponent(fieldDef);
  const label = humanizeFieldName(fieldName);

  const element: UiElement = {
    id: uid('field-pair'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-tight' },
    children: [
      {
        id: uid('fp-label'),
        component: 'Text',
        props: { as: 'label', field: fieldName },
        meta: { label: `${label} label` },
      },
      {
        id: uid('fp-input'),
        component: inputComponent,
        props: { field: fieldName, placeholder: label },
      },
    ],
  };

  return {
    element,
    pattern: 'field-pair',
    fieldsUsed: [fieldName],
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern: metric-card (Label + Value + optional Badge)              */
/* ------------------------------------------------------------------ */

/**
 * Generate a metric card for a KPI-type field.
 * Used in dashboard contexts for numeric/currency/percentage fields.
 */
export function metricCardPattern(
  fieldName: string,
  fieldDef: FieldDefinition,
  semanticType?: string,
): SlotPatternResult {
  const label = humanizeFieldName(fieldName);
  const valueComponent = selectValueComponent(fieldDef, semanticType);

  const children: UiElement[] = [
    {
      id: uid('mc-label'),
      component: 'Text',
      props: { as: 'span', variant: 'caption' },
      meta: { label: `${label} label` },
    },
    {
      id: uid('mc-value'),
      component: valueComponent,
      props: { field: fieldName },
    },
  ];

  // Add a trend badge for numeric fields
  if (fieldDef.type === 'number' || fieldDef.type === 'integer') {
    children.push({
      id: uid('mc-badge'),
      component: 'Badge',
      props: { variant: 'subtle' },
      meta: { label: `${label} trend` },
    });
  }

  const element: UiElement = {
    id: uid('metric-card'),
    component: 'Card',
    layout: { type: 'stack', gapToken: 'cluster-tight' },
    style: { spacingToken: 'inset-default' },
    props: { field: fieldName },
    children,
  };

  return {
    element,
    pattern: 'metric-card',
    fieldsUsed: [fieldName],
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern: field-group (Heading + Stack of field-pairs)              */
/* ------------------------------------------------------------------ */

/**
 * Generate a field group with a heading and multiple field-pairs.
 * Used in form contexts for grouping related fields.
 */
export function fieldGroupPattern(
  groupLabel: string,
  fields: Array<[string, FieldDefinition]>,
): SlotPatternResult {
  const fieldPairs = fields.map(([name, def]) => fieldPairPattern(name, def));

  const element: UiElement = {
    id: uid('field-group'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [
      {
        id: uid('fg-heading'),
        component: 'Text',
        props: { as: 'h2' },
        meta: { label: groupLabel },
      },
      ...fieldPairs.map(fp => fp.element),
    ],
  };

  return {
    element,
    pattern: 'field-group',
    fieldsUsed: fields.map(([name]) => name),
  };
}

/* ------------------------------------------------------------------ */
/*  Context-aware pattern selection                                    */
/* ------------------------------------------------------------------ */

export type CompositionContext = 'form' | 'dashboard' | 'detail' | 'list';

/**
 * Select the appropriate pattern for a field based on composition context.
 * Returns undefined if no composite pattern applies (use default single-component).
 */
export function selectPattern(
  fieldName: string,
  fieldDef: FieldDefinition,
  context: CompositionContext,
  semanticType?: string,
): SlotPatternResult | undefined {
  switch (context) {
    case 'form':
      return fieldPairPattern(fieldName, fieldDef);

    case 'dashboard':
      if (isKpiField(fieldDef, semanticType)) {
        return metricCardPattern(fieldName, fieldDef, semanticType);
      }
      return undefined;

    case 'detail':
    case 'list':
      // Detail/list don't use composite patterns by default
      return undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const KPI_TYPES = new Set(['integer', 'number']);
const KPI_SEMANTIC_TYPES = new Set(['currency', 'percentage', 'rating', 'count', 'metric']);

function isKpiField(fieldDef: FieldDefinition, semanticType?: string): boolean {
  if (semanticType && KPI_SEMANTIC_TYPES.has(semanticType)) return true;
  return KPI_TYPES.has(fieldDef.type);
}

function selectInputComponent(fieldDef: FieldDefinition): string {
  if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
    return 'Select';
  }
  switch (fieldDef.type) {
    case 'boolean': return 'Toggle';
    case 'date':
    case 'datetime': return 'DatePicker';
    case 'array': return 'TagInput';
    default: return 'Input';
  }
}

function selectValueComponent(fieldDef: FieldDefinition, semanticType?: string): string {
  if (semanticType === 'currency') return 'Text';
  if (semanticType === 'percentage') return 'Text';
  if (semanticType === 'status') return 'StatusBadge';
  if (fieldDef.validation?.enum) return 'Badge';
  return 'Text';
}

function humanizeFieldName(fieldName: string): string {
  const unitLabel = unitFieldLabel(fieldName);
  if (unitLabel) return unitLabel;
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\s/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
