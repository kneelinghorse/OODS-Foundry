/**
 * Timeline layout template (s86-m02).
 *
 * Vertical chronological stack for event/history/audit contexts.
 * Header + N entry slots for temporal content.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── header   – slot: title + date range / filters
 *   └── entries  – Stack: chronological event list
 *       ├── entry-0  – slot: first timeline event
 *       ├── entry-1  – slot: second timeline event
 *       └── ...      – additional entry slots
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

export interface TimelineOptions {
  /** Number of entry slots (default: 5). */
  entryCount?: number;
  /** Theme token (optional). */
  theme?: string;
}

export function timelineTemplate(opts: TimelineOptions = {}): TemplateResult {
  resetIdCounter();
  const {
    entryCount = 5,
    theme,
  } = opts;

  const slots: Slot[] = [
    { name: 'header', description: 'Timeline header with title and date range', intent: 'page-header', required: true },
  ];

  // -- header --
  const header: UiElement = {
    id: uid('timeline-header'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    children: [slotElement('header', 'page-header', 'Text')],
  };

  // -- entry slots --
  const entryChildren: UiElement[] = [];
  for (let i = 0; i < entryCount; i++) {
    const slotName = `entry-${i}`;
    slots.push({
      name: slotName,
      description: `Timeline event ${i + 1}`,
      intent: 'timeline-entry',
      required: i === 0,
    });
    entryChildren.push({
      id: uid('timeline-entry'),
      component: 'Card',
      layout: { type: 'stack', gapToken: 'cluster-tight' },
      style: { spacingToken: 'inset-default' },
      children: [slotElement(slotName, 'timeline-entry')],
    });
  }

  const entriesContainer: UiElement = {
    id: uid('timeline-entries'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: entryChildren,
  };

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-timeline'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [header, entriesContainer],
  };

  return { schema: wrapSchema(screen, theme), slots };
}
