/**
 * Viz Trait Resolution Engine
 *
 * Resolves viz trait names (from objects or explicit input) into structured
 * configuration for internal trait inspection. Handles all 19 viz trait categories:
 *   - Mark traits (6): bar, line, area, point, scatter, heatmap → chart type
 *   - Encoding traits (6): position-x, position-y, color, size, opacity, shape → axis/scale config
 *   - Layout traits (3): layer, facet, concat → composition strategy
 *   - Scale traits (2): linear, temporal → scale type config
 *   - Interaction traits (2): tooltip, highlight → interaction components
 */

export type ChartType = 'bar' | 'line' | 'area' | 'point' | 'scatter' | 'heatmap';

export interface DataBindings {
  x?: string;
  y?: string;
  color?: string;
  size?: string;
  opacity?: string;
  shape?: string;
}

import type { FieldDefinition } from '../objects/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ScaleType = 'linear' | 'temporal';
export type LayoutStrategy = 'layer' | 'facet' | 'concat' | 'single';

export interface EncodingConfig {
  channel: 'x' | 'y' | 'color' | 'size' | 'opacity' | 'shape';
  traitName: string;
  defaultScale: ScaleType;
  axisTitle?: string;
}

export interface LayoutConfig {
  strategy: LayoutStrategy;
  traitName?: string;
}

export interface ScaleConfig {
  type: ScaleType;
  traitName: string;
}

export interface InteractionConfig {
  type: 'tooltip' | 'highlight';
  traitName: string;
  component: string;
}

export interface VizTraitResolution {
  chartType: ChartType | null;
  markTraits: string[];
  encodings: EncodingConfig[];
  layout: LayoutConfig;
  scales: ScaleConfig[];
  interactions: InteractionConfig[];
  allResolved: string[];
  unrecognized: string[];
}

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */

/**
 * Normalize trait names from various formats to kebab-case:
 *   - "MarkBar" → "mark-bar"
 *   - "viz/MarkBar" → "mark-bar"
 *   - "mark-bar" → "mark-bar" (no-op)
 *   - "EncodingPositionX" → "encoding-position-x"
 */
function normalizeTraitName(raw: string): string {
  // Strip path prefix (e.g., "viz/MarkBar" → "MarkBar")
  const name = raw.includes('/') ? raw.split('/').pop()! : raw;

  // If already kebab-case, return as-is
  if (name.includes('-') && name === name.toLowerCase()) {
    return name;
  }

  // Convert PascalCase to kebab-case
  return name
    .replace(/([A-Z])/g, (_m, p1, offset) => (offset > 0 ? '-' : '') + p1.toLowerCase())
    .replace(/--+/g, '-');
}

/* ------------------------------------------------------------------ */
/*  Trait classification maps                                          */
/* ------------------------------------------------------------------ */

const MARK_TRAITS: Record<string, ChartType> = {
  'mark-bar': 'bar',
  'mark-line': 'line',
  'mark-area': 'area',
  'mark-point': 'point',
  'mark-scatter': 'scatter',
  'mark-heatmap': 'heatmap',
};

const ENCODING_TRAITS: Record<string, Omit<EncodingConfig, 'traitName'>> = {
  'encoding-position-x': { channel: 'x', defaultScale: 'linear', axisTitle: 'X Axis' },
  'encoding-position-y': { channel: 'y', defaultScale: 'linear', axisTitle: 'Y Axis' },
  'encoding-color': { channel: 'color', defaultScale: 'linear' },
  'encoding-size': { channel: 'size', defaultScale: 'linear' },
  'encoding-opacity': { channel: 'opacity', defaultScale: 'linear' },
  'encoding-shape': { channel: 'shape', defaultScale: 'linear' },
};

const LAYOUT_TRAITS: Record<string, LayoutStrategy> = {
  'layout-layer': 'layer',
  'layout-facet': 'facet',
  'layout-concat': 'concat',
};

const SCALE_TRAITS: Record<string, ScaleType> = {
  'scale-linear': 'linear',
  'scale-temporal': 'temporal',
};

const INTERACTION_TRAITS: Record<string, { type: 'tooltip' | 'highlight'; component: string }> = {
  'interaction-tooltip': { type: 'tooltip', component: 'VizTooltip' },
  'interaction-highlight': { type: 'highlight', component: 'VizHighlight' },
};

const ALL_VIZ_TRAIT_NAMES = new Set([
  ...Object.keys(MARK_TRAITS),
  ...Object.keys(ENCODING_TRAITS),
  ...Object.keys(LAYOUT_TRAITS),
  ...Object.keys(SCALE_TRAITS),
  ...Object.keys(INTERACTION_TRAITS),
]);

/* ------------------------------------------------------------------ */
/*  Resolution engine                                                  */
/* ------------------------------------------------------------------ */

export function resolveVizTraits(rawTraits: string[]): VizTraitResolution {
  const normalized = rawTraits.map((t) => ({ raw: t, norm: normalizeTraitName(t) }));

  let chartType: ChartType | null = null;
  const markTraits: string[] = [];
  const encodings: EncodingConfig[] = [];
  let layout: LayoutConfig = { strategy: 'single' };
  const scales: ScaleConfig[] = [];
  const interactions: InteractionConfig[] = [];
  const allResolved: string[] = [];
  const unrecognized: string[] = [];

  for (const { raw, norm } of normalized) {
    // Mark traits
    if (MARK_TRAITS[norm]) {
      chartType = MARK_TRAITS[norm];
      markTraits.push(norm);
      allResolved.push(raw);
      continue;
    }

    // Encoding traits
    if (ENCODING_TRAITS[norm]) {
      const config = ENCODING_TRAITS[norm];
      encodings.push({ ...config, traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Layout traits
    if (LAYOUT_TRAITS[norm]) {
      layout = { strategy: LAYOUT_TRAITS[norm], traitName: norm };
      allResolved.push(raw);
      continue;
    }

    // Scale traits
    if (SCALE_TRAITS[norm]) {
      scales.push({ type: SCALE_TRAITS[norm], traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Interaction traits
    if (INTERACTION_TRAITS[norm]) {
      const config = INTERACTION_TRAITS[norm];
      interactions.push({ ...config, traitName: norm });
      allResolved.push(raw);
      continue;
    }

    // Not a viz trait — may be a non-viz trait from the object
    if (!ALL_VIZ_TRAIT_NAMES.has(norm)) {
      unrecognized.push(raw);
    }
  }

  return {
    chartType,
    markTraits,
    encodings,
    layout,
    scales,
    interactions,
    allResolved,
    unrecognized,
  };
}

/**
 * Apply scale trait resolution to encoding config.
 * If a temporal scale is present, update x-axis default to temporal.
 */
export function applyScalesToEncodings(resolution: VizTraitResolution): VizTraitResolution {
  const hasTemporal = resolution.scales.some((s) => s.type === 'temporal');
  if (!hasTemporal) return resolution;

  const updatedEncodings = resolution.encodings.map((enc) => {
    // Temporal scale upgrades x-axis default
    if (enc.channel === 'x') {
      return { ...enc, defaultScale: 'temporal' as ScaleType };
    }
    return enc;
  });

  return { ...resolution, encodings: updatedEncodings };
}

/* ------------------------------------------------------------------ */
/*  Object field → encoding auto-binding                              */
/* ------------------------------------------------------------------ */

const TEMPORAL_TYPES = new Set(['datetime', 'date', 'timestamp']);
const NUMERIC_TYPES = new Set(['number', 'integer', 'float', 'decimal']);

/** Semantic types that strongly indicate a temporal field. */
const TEMPORAL_SEMANTICS = new Set(['timestamp', 'datetime', 'date']);
/** Semantic types that strongly indicate a numeric/metric field. */
const NUMERIC_SEMANTICS = new Set([
  'currency', 'percentage', 'rating', 'count', 'metric',
]);
/** Semantic types that indicate a categorical field. */
const CATEGORICAL_SEMANTICS = new Set(['status', 'identifier', 'category']);

export interface AutoBindingResult {
  dataBindings: DataBindings;
  encodings: EncodingConfig[];
  scales: ScaleConfig[];
  fieldsMapped: string[];
}

/**
 * Infer data bindings from object schema fields.
 *
 * Rules:
 *   - First temporal field → x-axis (with temporal scale)
 *   - First numeric field → y-axis (with linear scale)
 *   - First enum field → color
 *   - Second numeric field → size (if available)
 *
 * Explicit dataBindings from the user override auto-bound fields.
 */
export function inferDataBindings(
  fields: Record<string, FieldDefinition>,
  semantics?: Record<string, { semantic_type: string }>,
  existingBindings?: DataBindings,
): AutoBindingResult {
  const bindings: DataBindings = { ...existingBindings };
  const encodings: EncodingConfig[] = [];
  const scales: ScaleConfig[] = [];
  const fieldsMapped: string[] = [];

  const temporalFields: string[] = [];
  const numericFields: string[] = [];
  const categoricalFields: string[] = [];

  for (const [name, def] of Object.entries(fields)) {
    const sem = semantics?.[name]?.semantic_type;

    // Classify by semantic type first, then by field type
    if (sem && TEMPORAL_SEMANTICS.has(sem) || TEMPORAL_TYPES.has(def.type)) {
      temporalFields.push(name);
    } else if (sem && NUMERIC_SEMANTICS.has(sem) || NUMERIC_TYPES.has(def.type)) {
      numericFields.push(name);
    } else if (def.validation?.enum && def.validation.enum.length > 0) {
      categoricalFields.push(name);
    } else if (sem && CATEGORICAL_SEMANTICS.has(sem)) {
      categoricalFields.push(name);
    }
  }

  // x-axis: prefer temporal, fallback to first categorical
  if (!bindings.x) {
    const xField = temporalFields[0] ?? categoricalFields[0];
    if (xField) {
      bindings.x = xField;
      fieldsMapped.push(xField);
      const isTemporal = TEMPORAL_TYPES.has(fields[xField].type) ||
        (semantics?.[xField]?.semantic_type && TEMPORAL_SEMANTICS.has(semantics[xField].semantic_type));
      const scale: ScaleType = isTemporal ? 'temporal' : 'linear';
      encodings.push({
        channel: 'x',
        traitName: 'auto:field-binding',
        defaultScale: scale,
        axisTitle: xField.replace(/_/g, ' '),
      });
      if (isTemporal) {
        scales.push({ type: 'temporal', traitName: 'auto:temporal-scale' });
      }
    }
  }

  // y-axis: first numeric field
  if (!bindings.y && numericFields.length > 0) {
    const yField = numericFields[0];
    bindings.y = yField;
    fieldsMapped.push(yField);
    encodings.push({
      channel: 'y',
      traitName: 'auto:field-binding',
      defaultScale: 'linear',
      axisTitle: yField.replace(/_/g, ' '),
    });
    scales.push({ type: 'linear', traitName: 'auto:linear-scale' });
  }

  // color: first categorical (enum) field
  if (!bindings.color && categoricalFields.length > 0) {
    // Don't use a field already bound to x
    const colorField = categoricalFields.find(f => f !== bindings.x);
    if (colorField) {
      bindings.color = colorField;
      fieldsMapped.push(colorField);
      encodings.push({
        channel: 'color',
        traitName: 'auto:field-binding',
        defaultScale: 'linear',
      });
    }
  }

  // size: second numeric field (if available)
  if (!bindings.size && numericFields.length > 1) {
    const sizeField = numericFields[1];
    bindings.size = sizeField;
    fieldsMapped.push(sizeField);
    encodings.push({
      channel: 'size',
      traitName: 'auto:field-binding',
      defaultScale: 'linear',
    });
  }

  return { dataBindings: bindings, encodings, scales, fieldsMapped };
}
