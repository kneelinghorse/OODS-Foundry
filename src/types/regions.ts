import type { ReactNode } from 'react';

/**
 * Canonical region contract for view composition.
 * These IDs represent the normalized slots that view extensions target.
 */

export const REGION_ORDER = [
  'globalNavigation',
  'pageHeader',
  'breadcrumbs',
  'viewToolbar',
  'main',
  'contextPanel',
] as const;

export type CanonicalRegionID = typeof REGION_ORDER[number];
export type CanonicalRegionId = CanonicalRegionID;

export type RegionMap = Record<CanonicalRegionID, ReactNode>;

const CANONICAL_REGION_SET = new Set<CanonicalRegionID>(REGION_ORDER);

export function isCanonicalRegionId(value: string): value is CanonicalRegionID {
  if (typeof value !== 'string') {
    return false;
  }

  return CANONICAL_REGION_SET.has(value.trim() as CanonicalRegionID);
}

const LEGACY_REGION_ALIASES: Readonly<Record<string, CanonicalRegionID>> = Object.freeze({
  globalnavigation: 'globalNavigation',
  nav: 'globalNavigation',
  shell: 'globalNavigation',
  header: 'pageHeader',
  pageheader: 'pageHeader',
  badges: 'pageHeader',
  meta: 'pageHeader',
  title: 'pageHeader',
  breadcrumbs: 'breadcrumbs',
  trail: 'breadcrumbs',
  actions: 'viewToolbar',
  viewtoolbar: 'viewToolbar',
  toolbar: 'viewToolbar',
  filters: 'viewToolbar',
  main: 'main',
  body: 'main',
  content: 'main',
  statusbanner: 'main',
  timeline: 'contextPanel',
  feed: 'main',
  aside: 'contextPanel',
  sidebar: 'contextPanel',
  contextpanel: 'contextPanel',
  attachments: 'contextPanel',
  comments: 'contextPanel',
  details: 'contextPanel',
  footer: 'main',
});

export function resolveCanonicalRegionId(value: string): CanonicalRegionID | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (isCanonicalRegionId(trimmed)) {
    return trimmed;
  }

  const legacyKey = trimmed.toLowerCase();
  return LEGACY_REGION_ALIASES[legacyKey] ?? null;
}

export const LEGACY_REGION_MAP: Readonly<Record<string, CanonicalRegionID>> =
  LEGACY_REGION_ALIASES;
