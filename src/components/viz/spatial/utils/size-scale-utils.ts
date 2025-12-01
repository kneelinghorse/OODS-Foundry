/**
 * Size Scale Utilities
 *
 * Utilities for creating perceptual size scales for bubble/symbol maps.
 */

import * as d3Scale from 'd3-scale';
import type { SizeScaleType } from '../../../../types/viz/spatial.js';

/**
 * Generic size scale interface.
 */
export interface SizeScale {
  type: SizeScaleType;
  domain: [number, number];
  range: [number, number];
  getValue: (value: number | null | undefined) => number;
}

function sanitizeRange(range: [number, number]): [number, number] {
  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [4, 40];
  }
  if (min === max) {
    return [min, min + 1];
  }
  return min < max ? [min, max] : [max, min];
}

function sanitizeDomain(domain: [number, number], fallback: [number, number]): [number, number] {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return fallback;
  }
  if (min === max) {
    return [min, min + 1];
  }
  return [min, max];
}

/**
 * Linear size scale (direct radius mapping).
 */
export function createLinearSizeScale(domain: [number, number], range: [number, number]): SizeScale {
  const normalizedRange = sanitizeRange(range);
  const normalizedDomain = sanitizeDomain(domain, [0, 1]);
  const scale = d3Scale.scaleLinear().domain(normalizedDomain).range(normalizedRange).clamp(true);

  return {
    type: 'linear',
    domain: normalizedDomain,
    range: normalizedRange,
    getValue: (value: number | null | undefined): number => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return normalizedRange[0];
      }
      return scale(value);
    },
  };
}

/**
 * Square-root size scale (perceptually accurate for area encoding).
 */
export function createSqrtSizeScale(domain: [number, number], range: [number, number]): SizeScale {
  const normalizedRange = sanitizeRange(range);
  const safeDomain: [number, number] = [
    Math.max(0, domain[0]),
    Math.max(domain[0], domain[1], 0),
  ];
  const normalizedDomain = sanitizeDomain(safeDomain, [0, 1]);
  const scale = d3Scale.scaleSqrt().domain(normalizedDomain).range(normalizedRange).clamp(true);

  return {
    type: 'sqrt',
    domain: normalizedDomain,
    range: normalizedRange,
    getValue: (value: number | null | undefined): number => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return normalizedRange[0];
      }
      return scale(value);
    },
  };
}

/**
 * Logarithmic size scale (for wide-ranging values).
 */
export function createLogSizeScale(domain: [number, number], range: [number, number]): SizeScale {
  const normalizedRange = sanitizeRange(range);
  const min = Math.max(Math.min(...domain.filter(Number.isFinite) as number[]), Number.EPSILON);
  const max = Math.max(domain[1], min + Number.EPSILON);
  const normalizedDomain: [number, number] = sanitizeDomain([min, max], [1, 10]);
  const scale = d3Scale.scaleLog().domain(normalizedDomain).range(normalizedRange).clamp(true);

  return {
    type: 'log',
    domain: normalizedDomain,
    range: normalizedRange,
    getValue: (value: number | null | undefined): number => {
      if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
        return normalizedRange[0];
      }
      return scale(value);
    },
  };
}

/**
 * Resolve radius for a value using the provided scale.
 */
export function getSizeForValue(scale: SizeScale, value: number | null | undefined): number {
  return scale.getValue(value);
}
