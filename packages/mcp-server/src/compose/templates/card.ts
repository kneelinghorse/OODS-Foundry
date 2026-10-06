/**
 * Card layout template (s86-m02).
 *
 * Compact single-panel layout for summary/preview contexts.
 * No tabs, no sidebar — just header, body, and optional footer.
 *
 * Structure:
 *   Card (root)
 *   ├── header  – slot: entity title + status badge
 *   ├── body    – slot: primary content (data display)
 *   └── footer  – slot: optional actions or metadata
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

export interface CardOptions {
  /** Include footer actions slot (default: true). */
  includeFooter?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function cardTemplate(opts: CardOptions = {}): TemplateResult {
  resetIdCounter();
  const {
    includeFooter = true,
    theme,
  } = opts;

  const slots: Slot[] = [
    { name: 'header', description: 'Card header with title and status', intent: 'page-header', required: true },
    { name: 'body', description: 'Primary card content', intent: 'data-display', required: true },
  ];

  const children: UiElement[] = [];

  // -- header --
  children.push({
    id: uid('card-header'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    style: { spacingToken: 'inset-squish' },
    children: [slotElement('header', 'page-header', 'Text')],
  });

  // -- body --
  // s223-m01 (#2527 ruling 6): the body lines up under the title. The card already pads its content (24px); an inset
  // here indented every body line 24px past the title.
  children.push({
    id: uid('card-body'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-tight' },
    children: [slotElement('body', 'data-display')],
  });

  // -- footer --
  if (includeFooter) {
    slots.push({
      name: 'footer',
      description: 'Card footer with actions or metadata',
      intent: 'action-button',
      required: false,
    });
    children.push({
      id: uid('card-footer'),
      component: 'Stack',
      layout: { type: 'inline', align: 'end' },
      style: { spacingToken: 'inset-squish' },
      children: [slotElement('footer', 'action-button', 'Button')],
    });
  }

  // -- card root --
  const screen: UiElement = {
    id: uid('screen-card'),
    component: 'Card',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children,
  };

  return { schema: wrapSchema(screen, theme), slots };
}
