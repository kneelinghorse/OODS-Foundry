import { DateTime } from 'luxon';
import TimeService from '@/services/time/index.js';

export interface SpatialTooltipField {
  readonly field: string;
  readonly title: string;
  readonly pathPrefix?: string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const DATE_FORMAT = DateTime.DATE_MED;

export function createChoroplethTooltipFields(options: {
  readonly regionField?: string;
  readonly valueField: string;
  readonly extraFields?: readonly string[];
}): readonly SpatialTooltipField[] {
  const { regionField = 'name', valueField, extraFields = [] } = options;
  const base: SpatialTooltipField[] = [
    { field: regionField, title: 'Region', pathPrefix: 'properties.' },
    { field: valueField, title: 'Value', pathPrefix: 'properties.' },
  ];

  const extras = extraFields.map<SpatialTooltipField>((field) => ({
    field,
    title: toTitle(field),
    pathPrefix: 'properties.',
  }));

  return [...base, ...extras];
}

export function createBubbleTooltipFields(options: {
  readonly longitudeField: string;
  readonly latitudeField: string;
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly categoryField?: string;
  readonly extraFields?: readonly string[];
}): readonly SpatialTooltipField[] {
  const fields: SpatialTooltipField[] = [
    { field: options.longitudeField, title: 'Longitude' },
    { field: options.latitudeField, title: 'Latitude' },
  ];

  if (options.categoryField) {
    fields.push({ field: options.categoryField, title: 'Category' });
  }

  if (options.sizeField) {
    fields.push({ field: options.sizeField, title: 'Size' });
  }

  if (options.colorField) {
    fields.push({ field: options.colorField, title: 'Color' });
  }

  (options.extraFields ?? []).forEach((field) => {
    fields.push({ field, title: toTitle(field) });
  });

  return fields;
}

export function buildVegaLiteTooltip(fields: readonly SpatialTooltipField[]): Array<Record<string, unknown>> {
  return fields.map((field) => ({
    field: withPrefix(field.field, field.pathPrefix),
    title: field.title,
  }));
}

export function buildEChartsTooltipFormatter(
  fields: readonly SpatialTooltipField[]
): (params: { readonly data?: Record<string, unknown>; readonly name?: string }) => string {
  return (params) => {
    const source = extractTooltipSource(params);
    const rows = fields.map((field) => {
      const value = source[stripPrefix(field.field)] ?? source[field.field];
      return `<div class="oods-viz-tooltip__row"><span class="oods-viz-tooltip__label">${field.title}</span><span class="oods-viz-tooltip__value">${formatTooltipValue(value)}</span></div>`;
    });

    return `<div class="oods-viz-tooltip oods-viz-tooltip--spatial"><div class="oods-viz-tooltip__content">${rows.join(
      ''
    )}</div></div>`;
  };
}

export function formatTooltipValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number') {
    return NUMBER_FORMAT.format(value);
  }

  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return NUMBER_FORMAT.format(numeric);
    }

    const parsedIso = DateTime.fromISO(value, { setZone: true });
    if (parsedIso.isValid) {
      return parsedIso.toLocaleString(DATE_FORMAT);
    }

    return value;
  }

  if (value instanceof Date) {
    const dt = TimeService.fromDatabase(value);
    return dt.toLocaleString(DATE_FORMAT);
  }

  if (Array.isArray(value)) {
    return value.map(formatTooltipValue).join(', ');
  }

  return String(value);
}

function toTitle(field: string): string {
  return field
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function withPrefix(field: string, prefix?: string): string {
  if (!prefix) {
    return field;
  }
  return field.startsWith(prefix) ? field : `${prefix}${field}`;
}

function stripPrefix(field: string): string {
  return field.replace(/^properties\./, '');
}

function extractTooltipSource(params: { readonly data?: Record<string, unknown>; readonly name?: string }): Record<string, unknown> {
  const candidate = (params.data ?? {}) as Record<string, unknown>;

  if (candidate.rawProperties && typeof candidate.rawProperties === 'object') {
    return candidate.rawProperties as Record<string, unknown>;
  }

  if (candidate.raw && typeof candidate.raw === 'object') {
    return candidate.raw as Record<string, unknown>;
  }

  if (candidate.value && typeof candidate.value === 'object' && Array.isArray(candidate.value)) {
    return {
      value: candidate.value[2],
      longitude: candidate.value[0],
      latitude: candidate.value[1],
      name: params.name,
    };
  }

  return candidate;
}
