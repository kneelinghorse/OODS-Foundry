import { COMPONENT_STYLE_IDS, COMPONENT_STYLE_VERSION } from './index.js';

/** @deprecated Compatibility metadata for the former eight root families. */
export const PORTED_COMPONENT_STYLE_VERSION = COMPONENT_STYLE_VERSION;

const historicalIds = [
  'StatusBadge',
  'PriceBadge',
  'StatusTimeline',
  'AuditTimeline',
  'CancellationSummary',
  'SearchInput',
  'PaginationBar',
  'RelativeTimestamp',
] as const;

export const PORTED_COMPONENT_STYLE_IDS = historicalIds.filter(id => COMPONENT_STYLE_IDS.includes(id));

export type PortedComponentStyleId = typeof PORTED_COMPONENT_STYLE_IDS[number];
