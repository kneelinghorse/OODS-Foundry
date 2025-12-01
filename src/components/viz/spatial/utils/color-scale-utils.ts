/**
 * Color Scale Utilities
 *
 * Utilities for creating and using color scales for choropleth maps.
 * Based on d3-scale patterns.
 */

import * as d3Scale from 'd3-scale';
import type { ColorScaleType } from '../../../../types/viz/spatial.js';

/**
 * Color scale interface.
 */
export interface ColorScale {
  type: ColorScaleType;
  domain: number[];
  range: string[];
  getValue: (value: number | null | undefined) => string;
  thresholds?: number[];
}

/**
 * Creates a quantize color scale (equal-interval breaks).
 * Good for uniformly distributed data.
 *
 * @param domain - [min, max] data extent
 * @param range - Array of color values (token references or hex)
 * @returns Color scale
 */
export function createQuantizeScale(domain: [number, number], range: string[]): ColorScale {
  const scale = d3Scale.scaleQuantize<string>().domain(domain).range(range);

  return {
    type: 'quantize',
    domain,
    range,
    getValue: (value: number | null | undefined): string => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return range[0]; // Default to first color
      }
      return scale(value);
    },
  };
}

/**
 * Creates a quantile color scale (equal-count breaks).
 * Good for skewed data distributions.
 *
 * @param values - Array of all data values for quantile calculation
 * @param range - Array of color values (token references or hex)
 * @returns Color scale
 */
export function createQuantileScale(values: number[], range: string[]): ColorScale {
  // Filter out null/undefined/non-finite values
  const validValues = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));

  if (validValues.length === 0) {
    // Fallback for empty data
    return {
      type: 'quantile',
      domain: [0, 0],
      range,
      getValue: (): string => range[0],
    };
  }

  const scale = d3Scale.scaleQuantile<string>().domain(validValues).range(range);

  const quantiles = scale.quantiles();
  const domain: [number, number] = [Math.min(...validValues), Math.max(...validValues)];

  return {
    type: 'quantile',
    domain,
    range,
    thresholds: quantiles,
    getValue: (value: number | null | undefined): string => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return range[0];
      }
      return scale(value);
    },
  };
}

/**
 * Creates a threshold color scale (custom breaks).
 * Good for meaningful categories (e.g., poverty rates: <5%, 5-10%, 10-20%, >20%).
 *
 * @param thresholds - Array of threshold values (e.g., [5, 10, 20])
 * @param range - Array of color values (length must be thresholds.length + 1)
 * @returns Color scale
 */
export function createThresholdScale(thresholds: number[], range: string[]): ColorScale {
  if (range.length !== thresholds.length + 1) {
    throw new Error(
      `Range length (${range.length}) must be thresholds length (${thresholds.length}) + 1`
    );
  }

  const scale = d3Scale.scaleThreshold<number, string>().domain(thresholds).range(range);

  const domain: [number, number] = [
    thresholds.length > 0 ? Math.min(...thresholds) : 0,
    thresholds.length > 0 ? Math.max(...thresholds) : 0,
  ];

  return {
    type: 'threshold',
    domain,
    range,
    thresholds,
    getValue: (value: number | null | undefined): string => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return range[0];
      }
      return scale(value);
    },
  };
}

/**
 * Gets color for a value using a color scale.
 *
 * @param scale - The color scale
 * @param value - The data value
 * @returns Color string
 */
export function getColorForValue(
  scale: ColorScale,
  value: number | null | undefined
): string {
  return scale.getValue(value);
}

/**
 * Creates a linear color scale (continuous interpolation).
 * Good for continuous data with smooth transitions.
 *
 * @param domain - [min, max] data extent
 * @param range - Array of color values (2+ colors)
 * @returns Color scale
 */
export function createLinearScale(domain: [number, number], range: string[]): ColorScale {
  if (range.length < 2) {
    throw new Error(`Linear scale requires at least 2 colors in range`);
  }

  const scale = d3Scale.scaleLinear<string>().domain(domain).range(range);

  return {
    type: 'linear',
    domain,
    range,
    getValue: (value: number | null | undefined): string => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return range[0];
      }
      return scale(value);
    },
  };
}

/**
 * Calculates suggested number of color classes based on data size.
 *
 * @param dataSize - Number of data points
 * @returns Suggested number of color classes (3-7)
 */
export function suggestColorClassCount(dataSize: number): number {
  if (dataSize < 10) return 3;
  if (dataSize < 30) return 4;
  if (dataSize < 100) return 5;
  if (dataSize < 300) return 6;
  return 7;
}
