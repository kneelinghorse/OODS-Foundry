/**
 * Landing / content-page layout template (s106-m04).
 *
 * Content/marketing page layout for The Academy's landing-page work and any
 * non-data-object page. Before this layout, "landing page" intents collided
 * with the detail layout (the unqualified 'page' keyword routed to detail/Tabs).
 *
 * Unlike the data-view layouts (detail/list/form/…), a content page is not
 * bound to an object schema — it composes from intent alone, reusing the
 * existing intent-only slot-filling path. Long-form intent sections enrich the
 * section slots automatically via the generic slot-context-override path.
 *
 * Structure:
 *   Stack (root, vertical page)
 *   ├── hero        – headline / value proposition  (slot: hero)
 *   │   └── hero-cta – primary call-to-action       (slot: hero-cta)
 *   ├── sections    – N content sections            (slots: section-0..N-1)
 *   ├── cta         – closing call-to-action         (slot: cta, optional)
 *   └── footer      – footer links / metadata        (slot: footer, optional)
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

export interface LandingOptions {
  /** Number of content section slots between the hero and the closing CTA (default: 3). */
  sectionCount?: number;
  /** Include a closing call-to-action slot (default: true). */
  includeCta?: boolean;
  /** Include a footer slot (default: true). */
  includeFooter?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function landingTemplate(opts: LandingOptions = {}): TemplateResult {
  resetIdCounter();
  const { sectionCount = 3, includeCta = true, includeFooter = true, theme } = opts;
  // Clamp to a sane range so a stray preference can't explode the tree.
  const safeSectionCount = Math.min(Math.max(Math.trunc(sectionCount), 1), 12);

  const slots: Slot[] = [
    { name: 'hero', description: 'Hero headline and value proposition', intent: 'page-header', required: true },
    { name: 'hero-cta', description: 'Primary call-to-action in the hero', intent: 'action-button', required: true },
  ];

  const children: UiElement[] = [];

  // -- hero --
  children.push({
    id: uid('landing-hero'),
    component: 'Stack',
    layout: { type: 'stack', align: 'center', gapToken: 'cluster-default' },
    children: [
      slotElement('hero', 'page-header', 'Text'),
      slotElement('hero-cta', 'action-button', 'Button'),
    ],
  });

  // -- content sections --
  const sectionChildren: UiElement[] = [];
  for (let i = 0; i < safeSectionCount; i++) {
    const name = `section-${i}`;
    slots.push({ name, description: `Content section ${i + 1}`, intent: 'data-display', required: false });
    sectionChildren.push({
      id: uid(`landing-${name}`),
      component: 'Card',
      layout: { type: 'stack', gapToken: 'cluster-tight' },
      style: { spacingToken: 'inset-default' },
      children: [slotElement(name, 'data-display')],
    });
  }
  children.push({
    id: uid('landing-sections'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: sectionChildren,
  });

  // -- closing CTA --
  if (includeCta) {
    slots.push({ name: 'cta', description: 'Closing call-to-action', intent: 'action-button', required: false });
    children.push({
      id: uid('landing-cta'),
      component: 'Stack',
      layout: { type: 'inline', align: 'center' },
      children: [slotElement('cta', 'action-button', 'Button')],
    });
  }

  // -- footer --
  if (includeFooter) {
    slots.push({ name: 'footer', description: 'Footer links or metadata', intent: 'data-display', required: false });
    children.push({
      id: uid('landing-footer'),
      component: 'Stack',
      layout: { type: 'inline', align: 'space-between' },
      children: [slotElement('footer', 'data-display')],
    });
  }

  // -- landing root (vertical page stack) --
  const screen: UiElement = {
    id: uid('screen-landing'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children,
  };

  return { schema: wrapSchema(screen, theme), slots };
}
