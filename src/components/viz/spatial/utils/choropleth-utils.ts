/**
 * Choropleth Utilities
 *
 * Utilities specific to choropleth map visualizations.
 */

import type { Feature } from 'geojson';
import type { DataRecord } from '../../../../viz/adapters/spatial/geo-data-joiner.js';
import type { ColorScale } from './color-scale-utils.js';

/**
 * Color assignment for a feature.
 */
export interface ColorAssignment {
  featureId: string | number | undefined;
  value: number | null;
  color: string;
}

/**
 * Legend stop for a color scale.
 */
export interface LegendStop {
  color: string;
  label: string;
  value?: number;
  range?: [number, number];
}

/**
 * Calculates the data domain (min, max) for a given field.
 *
 * @param data - Array of data records
 * @param valueField - Field name containing numeric values
 * @returns [min, max] tuple
 */
export function calculateDomain(data: DataRecord[], valueField: string): [number, number] {
  if (data.length === 0) {
    return [0, 0];
  }

  const values = data
    .map((record) => {
      const value = record[valueField];
      return typeof value === 'number' ? value : null;
    })
    .filter((v): v is number => v !== null && Number.isFinite(v));

  if (values.length === 0) {
    return [0, 0];
  }

  return [Math.min(...values), Math.max(...values)];
}

/**
 * Assigns colors to features based on data values and a color scale.
 *
 * @param features - Array of GeoJSON features
 * @param joinedData - Map of joined data (key -> data record)
 * @param scale - Color scale to use
 * @param valueField - Field name containing numeric values
 * @param geoJoinKey - Key field in feature properties
 * @returns Array of color assignments
 */
export function assignColors(
  features: Feature[],
  joinedData: Map<string, DataRecord>,
  scale: ColorScale,
  valueField: string,
  geoJoinKey: string
): ColorAssignment[] {
  return features.map((feature) => {
    const featureId = feature.id;
    const properties = feature.properties || {};
    const joinKeyValue = properties[geoJoinKey];

    // Try to get joined data
    let value: number | null = null;
    if (joinKeyValue !== undefined && joinKeyValue !== null) {
      const normalizedKey = String(joinKeyValue).trim().toLowerCase();
      const dataRecord = joinedData.get(normalizedKey);

      if (dataRecord) {
        const rawValue = dataRecord[valueField];
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          value = rawValue;
        }
      }
    }

    // Get color from scale
    const color = scale.getValue(value);

    return {
      featureId,
      value,
      color,
    };
  });
}

/**
 * Generates legend stops from a color scale.
 *
 * @param scale - Color scale
 * @param formatValue - Optional function to format numeric values
 * @returns Array of legend stops
 */
export function generateLegendStops(
  scale: ColorScale,
  formatValue?: (value: number) => string
): LegendStop[] {
  const format = formatValue || ((v: number) => v.toLocaleString());

  const { type, domain, range, thresholds } = scale;

  if (type === 'threshold' && thresholds) {
    // For threshold scales, create stops for each range
    const stops: LegendStop[] = [];

    // First range: < first threshold
    stops.push({
      color: range[0],
      label: `< ${format(thresholds[0])}`,
      range: [domain[0], thresholds[0]],
    });

    // Middle ranges
    for (let i = 0; i < thresholds.length - 1; i++) {
      stops.push({
        color: range[i + 1],
        label: `${format(thresholds[i])} - ${format(thresholds[i + 1])}`,
        range: [thresholds[i], thresholds[i + 1]],
      });
    }

    // Last range: >= last threshold
    stops.push({
      color: range[range.length - 1],
      label: `≥ ${format(thresholds[thresholds.length - 1])}`,
      range: [thresholds[thresholds.length - 1], domain[1]],
    });

    return stops;
  }

  if (type === 'quantile' && thresholds) {
    // For quantile scales, create stops for each quantile
    const stops: LegendStop[] = [];

    // First quantile
    stops.push({
      color: range[0],
      label: `${format(domain[0])} - ${format(thresholds[0])}`,
      range: [domain[0], thresholds[0]],
    });

    // Middle quantiles
    for (let i = 0; i < thresholds.length - 1; i++) {
      stops.push({
        color: range[i + 1],
        label: `${format(thresholds[i])} - ${format(thresholds[i + 1])}`,
        range: [thresholds[i], thresholds[i + 1]],
      });
    }

    // Last quantile
    stops.push({
      color: range[range.length - 1],
      label: `${format(thresholds[thresholds.length - 1])} - ${format(domain[1])}`,
      range: [thresholds[thresholds.length - 1], domain[1]],
    });

    return stops;
  }

  if (type === 'quantize') {
    // For quantize scales, divide domain evenly
    const [min, max] = domain;
    const stepSize = (max - min) / range.length;

    return range.map((color, i) => {
      const start = min + i * stepSize;
      const end = min + (i + 1) * stepSize;

      return {
        color,
        label: `${format(start)} - ${format(end)}`,
        range: [start, end] as [number, number],
      };
    });
  }

  if (type === 'linear') {
    // For linear scales, create interpolated stops
    const [min, max] = domain;
    const stepSize = (max - min) / (range.length - 1);

    return range.map((color, i) => {
      const value = min + i * stepSize;
      return {
        color,
        label: format(value),
        value,
      };
    });
  }

  // Fallback: just return colors
  return range.map((color, i) => ({
    color,
    label: `Class ${i + 1}`,
  }));
}

/**
 * Finds the feature with a given ID.
 *
 * @param features - Array of features
 * @param featureId - Feature ID to find
 * @returns Feature or undefined
 */
export function findFeatureById(
  features: Feature[],
  featureId: string | number
): Feature | undefined {
  return features.find((f) => f.id === featureId || String(f.id) === String(featureId));
}

/**
 * Extracts all values from data for a given field.
 *
 * @param data - Array of data records
 * @param valueField - Field name
 * @returns Array of numeric values (nulls filtered out)
 */
export function extractValues(data: DataRecord[], valueField: string): number[] {
  return data
    .map((record) => {
      const value = record[valueField];
      return typeof value === 'number' ? value : null;
    })
    .filter((v): v is number => v !== null && Number.isFinite(v));
}
