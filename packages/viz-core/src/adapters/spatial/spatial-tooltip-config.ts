// Spatial tooltip field builders + ECharts formatter (sprint-112 m01 port).
//
// Slim port of src/viz/tooltip/spatial-tooltip-config.ts. The source pulled in
// luxon (DateTime) and @/services/time (TimeService) for date formatting; both
// are OUT of the headless beachhead (@/services/time is the excluded time/network
// boundary, and luxon is not a viz-core dependency). The geo tooltips only render
// region names, numeric values, and lng/lat coords — never Date objects — so the
// luxon/TimeService date paths are dropped. A Date that does slip through is
// rendered as a deterministic ISO-8601 string (NOT String(Date), which is
// locale/timezone-dependent and would break the Q1 determinism moat).
//
// Mirrors the s111 convention: the formatter is a function closure that the
// viz.render JSON projection drops (the option is the transmittable artifact);
// it is kept verbatim-in-spirit so the ported adapters compile and behave as in
// src/, and the field builders stay unit-testable.

export interface SpatialTooltipField {
  readonly field: string;
  readonly title: string;
  readonly pathPrefix?: string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

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

export function createFlowLineTooltipFields(options: {
  readonly originLongitudeField: string;
  readonly originLatitudeField: string;
  readonly destinationLongitudeField: string;
  readonly destinationLatitudeField: string;
  readonly strengthField?: string;
  readonly extraFields?: readonly string[];
}): readonly SpatialTooltipField[] {
  const fields: SpatialTooltipField[] = [
    { field: options.originLongitudeField, title: 'Origin longitude' },
    { field: options.originLatitudeField, title: 'Origin latitude' },
    { field: options.destinationLongitudeField, title: 'Destination longitude' },
    { field: options.destinationLatitudeField, title: 'Destination latitude' },
  ];

  if (options.strengthField) {
    fields.push({ field: options.strengthField, title: 'Strength' });
  }

  (options.extraFields ?? []).forEach((field) => {
    fields.push({ field, title: toTitle(field) });
  });

  return fields;
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

    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
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
