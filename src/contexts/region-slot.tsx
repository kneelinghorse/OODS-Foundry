import { createElement, type ReactNode } from 'react';
import type { JSX } from 'react';
import type { CanonicalRegionID } from '../types/regions.js';

export interface RegionSlotOptions {
  readonly as?: keyof JSX.IntrinsicElements;
  readonly required?: boolean;
  readonly props?: Record<string, unknown>;
}

export function renderRegionSlot(
  region: CanonicalRegionID,
  content: ReactNode,
  options: RegionSlotOptions = {}
): ReactNode | null {
  const { as: element = 'div', required = false, props = {} } = options;
  const elementTag = (element ?? 'div') as keyof JSX.IntrinsicElements;

  if (!required && (content === undefined || content === null || content === false)) {
    return null;
  }

  return createElement(
    elementTag,
    {
      'data-region': region,
      'data-region-required': required ? 'true' : undefined,
      ...props,
    },
    content ?? null
  );
}
