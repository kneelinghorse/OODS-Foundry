/**
 * Detail layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── header           – slot: entity title + badges
 *   └── body (sidebar)
 *       ├── tabs section  – Tabs with N panels
 *       └── metadata      – slot: metadata sidebar
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

export interface DetailOptions {
  /** Number of tab panels (default: 3). */
  tabCount?: number;
  /** Tab labels (defaults to "Tab 1", "Tab 2", …). */
  tabLabels?: string[];
  /** Include metadata sidebar (default: true). */
  includeMetaSidebar?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function detailTemplate(opts: DetailOptions = {}): TemplateResult {
  resetIdCounter();
  const {
    tabCount = 3,
    tabLabels,
    includeMetaSidebar = true,
    theme,
  } = opts;

  const slots: Slot[] = [
    { name: 'header', description: 'Entity header with title and status', intent: 'page-header', required: true },
  ];

  // -- header slot --
  const header: UiElement = {
    id: uid('detail-header'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    children: [slotElement('header', 'page-header', 'Text')],
  };

  // -- tab panels --
  const tabChildren: UiElement[] = [];
  for (let i = 0; i < tabCount; i++) {
    const label = tabLabels?.[i] ?? `Tab ${i + 1}`;
    const slotName = `tab-${i}`;
    slots.push({
      name: slotName,
      description: `Content for "${label}" tab`,
      intent: 'data-display',
      required: i === 0,
    });
    tabChildren.push({
      id: uid('detail-tab-panel'),
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'cluster-default' },
      props: { label },
      children: [slotElement(slotName, 'data-display')],
    });
  }

  const tabsElement: UiElement = {
    id: uid('detail-tabs'),
    component: 'Tabs',
    children: tabChildren,
  };

  // -- body (with or without metadata sidebar) --
  let body: UiElement;
  if (includeMetaSidebar) {
    slots.push({
      name: 'metadata',
      description: 'Metadata sidebar (dates, owner, status)',
      intent: 'metadata-display',
      required: false,
    });

    body = {
      id: uid('detail-body'),
      component: 'Card',
      layout: { type: 'sidebar', gapToken: 'cluster-default' },
      children: [
        tabsElement,
        {
          id: uid('detail-meta'),
          component: 'Stack',
          layout: { type: 'stack', gapToken: 'cluster-tight' },
          style: { spacingToken: 'inset-default' },
          children: [slotElement('metadata', 'metadata-display')],
        },
      ],
    };
  } else {
    body = tabsElement;
  }

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-detail'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [header, body],
  };

  return { schema: wrapSchema(screen, theme), slots };
}
