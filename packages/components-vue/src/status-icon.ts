import { h, type VNode } from 'vue';
import { STATUS_ICON_SHAPES, STATUS_ICON_SVG_ATTRS, type StatusIconName } from '@oods/component-contracts';

// s222-m02 (#2502 ruling 11): a status mark is the shared SVG icon, drawn in the text colour; React, Vue and HTML draw the
// same shapes from @oods/component-contracts.
export function statusIcon(name: StatusIconName): VNode {
  return h('svg', { ...STATUS_ICON_SVG_ATTRS }, STATUS_ICON_SHAPES[name].map((shape) => h(shape.tag, { ...shape.attrs })));
}
