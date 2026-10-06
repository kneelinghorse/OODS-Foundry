import { h, type Component, type Slot } from 'vue';
import type { SharedScenario } from '@oods/component-contracts';
import * as components from '../src/index.js';

const eventListeners: Record<string, string> = {
  Banner: 'onDismiss', Button: 'onActivate', Input: 'onInput', Textarea: 'onInput', TagInput: 'onInput',
  Table: 'onRowActivate', PaginationBar: 'onPageChange', SearchInput: 'onUpdate',
  // s222-m02 (#2502 ruling 11): Switch emits change (the default listener); Dialog emits close.
  Dialog: 'onClose',
};
export function renderSharedScenario(scenario: SharedScenario, onEvent?: (value?: unknown) => void) {
  const implementation = components[scenario.oodsComponentId as keyof typeof components] as Component;
  if (!implementation) throw new Error(`Unimplemented shared Vue scenario: ${scenario.id}`);
  const slots: Record<string, Slot> = Object.fromEntries(Object.entries(scenario.slots).map(([name, value]) => [name,
    () => Array.isArray(value) ? value.map((entry, index) => h('span', { key: index }, String(entry))) : h('span', {}, String(value)),
  ]));
  return h(implementation, { ...scenario.props, [eventListeners[scenario.oodsComponentId] ?? 'onChange']: onEvent }, slots);
}
