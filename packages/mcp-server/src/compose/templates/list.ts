/**
 * List layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── toolbar     – inline: search slot + filter slot + actions
 *   ├── items       – Stack: scrollable item list slot
 *   └── pagination  – inline: page controls slot
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

export interface ListOptions {
  /** A single inline record has no collection query or editable filter toolbar. */
  inline?: boolean;
  /** Include search input in toolbar (default: true). */
  includeSearch?: boolean;
  /** Include filter controls in toolbar (default: true). */
  includeFilters?: boolean;
  /** Include pagination footer (default: true). */
  includePagination?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function listTemplate(opts: ListOptions = {}): TemplateResult {
  resetIdCounter();
  const {
    inline = false,
    includeSearch = !inline,
    includeFilters = !inline,
    includePagination = !inline,
    theme,
  } = opts;

  const slots: Slot[] = [
    { name: 'items', description: inline ? 'Inline record label' : 'Scrollable list of items', intent: inline ? 'label-display' : 'data-list', required: true },
  ];

  const children: UiElement[] = [];

  // -- toolbar --
  const toolbarChildren: UiElement[] = [];

  if (includeSearch) {
    slots.push({
      name: 'search',
      description: 'Search input',
      intent: 'search-input',
      required: false,
    });
    toolbarChildren.push(slotElement('search', 'search-input', 'SearchInput'));
  }

  if (includeFilters) {
    slots.push({
      name: 'filters',
      description: 'Filter controls',
      intent: 'filter-control',
      required: false,
    });
    toolbarChildren.push(slotElement('filters', 'filter-control', 'Select'));
  }

  // Always add a toolbar actions slot for bulk actions / create button
  if (!inline) slots.push({
    name: 'toolbar-actions',
    description: 'Toolbar action buttons',
    intent: 'action-button',
    required: false,
  });
  if (!inline) toolbarChildren.push(slotElement('toolbar-actions', 'action-button', 'Button'));

  if (toolbarChildren.length) children.push({
    id: uid('list-toolbar'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    children: toolbarChildren,
  });

  // -- item list --
  children.push({
    id: uid('list-items'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-tight' },
    children: [inline ? slotElement('items', 'label-display', 'InlineLabel') : slotElement('items', 'data-list')],
  });

  // -- pagination --
  if (includePagination) {
    slots.push({
      name: 'pagination',
      description: 'Page navigation controls',
      intent: 'pagination-control',
      required: false,
    });
    children.push({
      id: uid('list-pagination'),
      component: 'Stack',
      layout: { type: 'inline', align: 'center' },
      children: [slotElement('pagination', 'pagination-control', 'Text')],
    });
  }

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-list'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children,
  };

  return { schema: wrapSchema(screen, theme), slots };
}
