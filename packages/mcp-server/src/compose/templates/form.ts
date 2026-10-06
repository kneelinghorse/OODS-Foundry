/**
 * Form layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── title      – slot: form heading
 *   ├── fields     – Stack with N field groups
 *   └── actions    – inline action bar (submit / cancel)
 */
import type { UiElement } from '../../schemas/generated.js';
import {
  type Slot,
  type TemplateResult,
  resetIdCounter,
  uid,
  wrapSchema,
  slotElement,
} from './types.js';

export interface FormOptions {
  /** Number of field groups / sections (default: 3). */
  fieldGroups?: number;
  /** Optional per-slot metadata for field groups. */
  fieldSlots?: Array<{
    description?: string;
    intent?: string;
    required?: boolean;
  }>;
  /** Show a banner above the form (e.g. validation summary) (default: false). */
  includeBanner?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function formTemplate(opts: FormOptions = {}): TemplateResult {
  resetIdCounter();
  const {
    fieldGroups = 3,
    fieldSlots,
    includeBanner = false,
    theme,
  } = opts;
  const resolvedFieldSlots = fieldSlots && fieldSlots.length > 0
    ? fieldSlots
    : Array.from({ length: fieldGroups }, (_, idx) => ({
      description: `Form field group ${idx + 1}`,
      intent: 'form-input',
      required: idx === 0,
    }));

  const slots: Slot[] = [
    { name: 'title', description: 'Form heading', intent: 'page-header', required: true },
  ];

  // Add per-field-group slots
  for (let i = 0; i < resolvedFieldSlots.length; i++) {
    const fieldSlot = resolvedFieldSlots[i];
    slots.push({
      name: `field-${i}`,
      description: fieldSlot.description ?? `Form field group ${i + 1}`,
      intent: fieldSlot.intent ?? 'form-input',
      required: fieldSlot.required ?? i === 0,
    });
  }

  const children: UiElement[] = [];

  // -- optional banner --
  if (includeBanner) {
    slots.push({
      name: 'banner',
      description: 'Validation or info banner',
      intent: 'status-indicator',
      required: false,
    });
    children.push({
      id: uid('form-banner'),
      component: 'Banner',
      children: [slotElement('banner', 'status-indicator', 'Text')],
    });
  }

  // -- title slot --
  children.push({
    id: uid('form-title'),
    component: 'Text',
    props: { as: 'h1' },
    meta: { intent: 'slot:title', label: 'title' },
  });

  // -- field groups --
  const fieldChildren: UiElement[] = [];
  for (let i = 0; i < resolvedFieldSlots.length; i++) {
    const fieldSlot = resolvedFieldSlots[i];
    fieldChildren.push({
      id: uid('form-field-group'),
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'cluster-tight' },
      children: [slotElement(`field-${i}`, fieldSlot.intent ?? 'form-input')],
    });
  }
  children.push({
    id: uid('form-fields'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: fieldChildren,
  });

  // -- action bar (pre-filled, not a slot — submit button has known defaults) --
  children.push({
    id: uid('form-actions'),
    component: 'Stack',
    layout: { type: 'inline', align: 'end' },
    children: [{
      id: uid('form-submit'),
      component: 'Button',
      props: { label: 'Save', type: 'submit' },
    }],
  });

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-form'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children,
  };

  return { schema: wrapSchema(screen, theme), slots };
}
