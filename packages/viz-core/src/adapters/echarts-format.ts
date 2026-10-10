import { numberFormatLocale, timeFormatDefaultLocale } from 'vega-format';

/** JSON data, never executable callback source. Locale is explicit so the receiving client's defaults cannot change money. */
export interface EChartsWireFormat {
  version: 1;
  field: string;
  temporal?: boolean;
  format?: string;
  currency?: string;
  locale: { decimal: string; thousands: string; grouping: number[]; currency: [string, string] };
}

export function formatEChartsValue(binding: EChartsWireFormat): ((value: unknown) => string) | undefined {
  if (binding.version !== 1) throw new Error('Unsupported OODS ECharts format version.');
  if (binding.format === undefined) return undefined;
  if (binding.temporal) {
    const format = timeFormatDefaultLocale().utcFormat(binding.format);
    return value => format(new Date(value as string | number));
  }
  const format = numberFormatLocale(binding.locale).formatFloat(binding.format);
  return value => format(Number(value));
}

/** Restore Forge's declared axis/tooltip formats after JSON transport; never evaluates supplied code. */
export function restoreEChartsFormats<T extends Record<string, any>>(input: T): T {
  const output: Record<string, any> = { ...input };
  const fieldsFormatter = (fields: any[]) => createTooltipFormatter(fields.map(field => field.field),
    new Map(fields.map(field => [field.field, formatEChartsValue(field)])));
  for (const name of ['xAxis', 'yAxis'] as const) {
    if (!input[name]) continue;
    const restore = (axis: Record<string, any>) => {
      const binding = axis.axisLabel?.__oodsFormat;
      return binding ? { ...axis, axisLabel: { ...axis.axisLabel, formatter: formatEChartsValue(binding) } } : axis;
    };
    output[name] = Array.isArray(input[name]) ? input[name].map(restore) : restore(input[name]);
  }
  const contract = input.tooltip?.__oodsFormat;
  if (contract?.version === 1) {
    let formatter: (params: unknown) => string;
    if (Array.isArray(contract.series)) {
      const formatters = contract.series.map(fieldsFormatter);
      formatter = params => {
        const items = Array.isArray(params) ? params : [params];
        return items.map((item: any) => {
          const format = formatters[(item?.seriesIndex ?? 0) % formatters.length];
          const name = items.length > 1 && item?.seriesName ? `<div class="oods-viz-tooltip__label">${escapeHtml(item.seriesName)}</div>` : '';
          return name + (format?.(item) ?? '');
        }).join('');
      };
    } else formatter = fieldsFormatter(contract.fields ?? []);
    output.tooltip = { ...input.tooltip, formatter };
  }
  return output as T;
}

export function escapeHtml(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function createTooltipFormatter(fields: readonly string[], formatters: ReadonlyMap<string, ((value: unknown) => string) | undefined>): (params: unknown) => string {
  return (params: unknown) => {
    const datum = extractDatum(params);

    if (!datum) {
      return '';
    }

    const rows = fields
      .map((field) => {
        const raw = datum[field as keyof typeof datum];
        const value = raw == null ? '—' : formatters.get(field)?.(raw) ?? raw;
        return `<div class="oods-viz-tooltip__row"><span class="oods-viz-tooltip__label">${escapeHtml(field)}: </span><span class="oods-viz-tooltip__value">${escapeHtml(value)}</span></div>`;
      })
      .join('');

    return `<div class="oods-viz-tooltip__content">${rows}</div>`;
  };
}

function extractDatum(params: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(params)) {
    const [first] = params;
    if (first && typeof first === 'object' && first !== null && typeof (first as { data?: unknown }).data === 'object') {
      return (first as { data: Record<string, unknown> }).data;
    }
    return undefined;
  }

  if (params && typeof params === 'object') {
    const record = params as { data?: unknown };
    if (record.data && typeof record.data === 'object') {
      return record.data as Record<string, unknown>;
    }
  }

  return undefined;
}

