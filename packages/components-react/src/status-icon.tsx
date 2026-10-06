import * as React from 'react';
import { STATUS_ICON_SHAPES, STATUS_ICON_SVG_ATTRS, type StatusIconName } from '@oods/component-contracts';

// s222-m02 (#2502 ruling 11): a status mark is the shared SVG icon, drawn in the text colour; React, Vue and HTML draw the
// same shapes from @oods/component-contracts.
const REACT_NAMES: Record<string, string> = {
  viewBox: 'viewBox', fill: 'fill', stroke: 'stroke', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin', 'aria-hidden': 'aria-hidden', focusable: 'focusable',
};
const svgProps = Object.fromEntries(Object.entries(STATUS_ICON_SVG_ATTRS).map(([name, value]) => [REACT_NAMES[name] ?? name, value]));

export function StatusIcon({ name }: { readonly name: StatusIconName }): React.ReactElement {
  return (
    <svg {...svgProps}>
      {STATUS_ICON_SHAPES[name].map((shape, index) => React.createElement(shape.tag, { key: index, ...shape.attrs }))}
    </svg>
  );
}
