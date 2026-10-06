import * as React from 'react';
import { resolveStatusIcon } from '@oods/component-contracts';
import { StatusIcon } from '../../../packages/components-react/src/status-icon.js';

/**
 * @deprecated Status marks are package-owned by @oods/components-react. s222-m02 (#2502 ruling 11): a status mark is the
 * shared SVG icon, not a Unicode glyph, so a registry icon name resolves to the same icon element the Badge and Banner
 * draw.
 */
export function resolveStatusMark(iconName: string | undefined): React.ReactElement | undefined {
  const name = resolveStatusIcon(iconName);
  return name ? React.createElement(StatusIcon, { name }) : undefined;
}
