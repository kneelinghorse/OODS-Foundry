import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

type NormalizedTransformEntry = NonNullable<NormalizedVizSpec['transforms']>[number];
type RawStackParams = NormalizedTransformEntry['params'];

export type StackOffsetMode = 'zero' | 'normalize';

export interface StackSortField {
  readonly field: string;
  readonly order?: 'ascending' | 'descending';
}

export interface StackTransformConfig {
  readonly stack: string;
  readonly groupby?: readonly string[];
  readonly sort?: readonly StackSortField[];
  readonly offset?: StackOffsetMode;
  readonly as?: readonly [string, string];
}

export interface StackTransformMetadata {
  readonly fields: readonly [string, string];
  readonly stackField: string;
  readonly groupby: readonly string[];
  readonly offset: StackOffsetMode;
}

export interface StackTransformResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly metadata: StackTransformMetadata;
}

export interface AppliedStackTransform {
  readonly spec: NormalizedVizSpec;
  readonly metadata?: StackTransformMetadata & { readonly valueField: string };
}

const DEFAULT_AS: readonly [string, string] = ['stack_start', 'stack_end'];

interface GroupedRow {
  readonly original: Record<string, unknown>;
  readonly index: number;
}

interface GroupedBucket {
  readonly key: string;
  readonly rows: GroupedRow[];
}

export function stackTransform(
  rows: readonly Record<string, unknown>[],
  config: StackTransformConfig
): StackTransformResult {
  if (!Array.isArray(rows)) {
    return {
      rows: [],
      metadata: {
        fields: resolveOutputFields(config.as),
        stackField: config.stack,
        groupby: normalizeGroupFields(config.groupby),
        offset: resolveOffset(config.offset),
      },
    };
  }

  const stackField = config.stack;
  if (typeof stackField !== 'string' || stackField.trim() === '') {
    throw new Error('stackTransform requires params.stack (measure field)');
  }

  const outputFields = resolveOutputFields(config.as);
  const groupFields = normalizeGroupFields(config.groupby);
  const offset = resolveOffset(config.offset);
  const grouped = groupRows(rows, groupFields);
  const transformed: Record<string, unknown>[] = [];

  for (const bucket of grouped) {
    const sorted = sortGroupRows(bucket.rows, config.sort);
    transformed.push(
      ...stackGroupRows(sorted, stackField, outputFields, offset)
    );
  }

  return {
    rows: transformed,
    metadata: {
      fields: outputFields,
      stackField,
      groupby: groupFields,
      offset,
    },
  };
}

export function applyStackTransformsToSpec(spec: NormalizedVizSpec): AppliedStackTransform {
  const transforms: NormalizedTransformEntry[] = Array.isArray(spec.transforms) ? spec.transforms : [];
  const candidates = transforms.filter(isStackTransformCandidate);
  if (candidates.length === 0) {
    return { spec };
  }

  if (!Array.isArray(spec.data.values)) {
    return { spec };
  }

  const clone = cloneSpec(spec);
  const remainingTransforms = transforms.filter((transform) => !isStackTransformCandidate(transform));
  let values: Record<string, unknown>[] = Array.isArray(clone.data.values) ? [...clone.data.values] : [];
  let metadata: (StackTransformMetadata & { readonly valueField: string }) | undefined;

  for (const transform of candidates) {
    const params = normalizeStackParams(transform.params);
    if (!params) {
      continue;
    }
    const result = stackTransform(values, params);
    values = result.rows.map((row) => ({ ...row }));
    metadata = {
      ...result.metadata,
      valueField: params.stack,
    };
  }

  clone.data.values = values;
  clone.transforms = remainingTransforms.length > 0 ? remainingTransforms : undefined;

  return {
    spec: clone,
    metadata,
  };
}

function stackGroupRows(
  rows: readonly GroupedRow[],
  stackField: string,
  outputFields: readonly [string, string],
  offset: StackOffsetMode
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return [];
  }

  const [startField, endField] = outputFields;
  const positives = offset === 'normalize' ? sumPositive(rows, stackField) : undefined;
  const negatives = offset === 'normalize' ? sumNegative(rows, stackField) : undefined;
  const positiveScale = positives && positives > 0 ? positives : 1;
  const negativeScale = negatives && negatives > 0 ? negatives : 1;
  let positiveCursor = 0;
  let negativeCursor = 0;

  return rows.map((entry) => {
    const value = toNumber(entry.original[stackField]);
    if (value >= 0) {
      const normalized = offset === 'normalize' ? value / positiveScale : value;
      const start = positiveCursor;
      const end = positiveCursor + normalized;
      positiveCursor = end;
      return annotateRow(entry.original, startField, endField, start, end);
    }

    const normalized = offset === 'normalize' ? Math.abs(value) / negativeScale : Math.abs(value);
    const start = negativeCursor - normalized;
    const end = negativeCursor;
    negativeCursor = start;
    return annotateRow(entry.original, startField, endField, start, end);
  });
}

function annotateRow(
  input: Record<string, unknown>,
  startField: string,
  endField: string,
  start: number,
  end: number
): Record<string, unknown> {
  return {
    ...input,
    [startField]: start,
    [endField]: end,
  };
}

function sumPositive(rows: readonly GroupedRow[], stackField: string): number {
  return rows.reduce((total, row) => {
    const value = toNumber(row.original[stackField]);
    return value > 0 ? total + value : total;
  }, 0);
}

function sumNegative(rows: readonly GroupedRow[], stackField: string): number {
  return rows.reduce((total, row) => {
    const value = toNumber(row.original[stackField]);
    return value < 0 ? total + Math.abs(value) : total;
  }, 0);
}

function resolveOutputFields(as?: readonly [string, string]): readonly [string, string] {
  if (Array.isArray(as) && as.length === 2) {
    const [start, end] = as;
    if (typeof start === 'string' && typeof end === 'string' && start.trim() && end.trim()) {
      return [start, end];
    }
  }
  return DEFAULT_AS;
}

function normalizeGroupFields(groupby?: readonly string[]): string[] {
  if (!Array.isArray(groupby) || groupby.length === 0) {
    return [];
  }
  return groupby.filter((field): field is string => typeof field === 'string' && field.trim() !== '');
}

function resolveOffset(offset?: StackOffsetMode): StackOffsetMode {
  if (offset === 'normalize') {
    return 'normalize';
  }
  return 'zero';
}

function groupRows(rows: readonly Record<string, unknown>[], groupFields: readonly string[]): GroupedBucket[] {
  if (groupFields.length === 0) {
    return [{ key: '__all__', rows: rows.map((row, index) => ({ original: row, index })) }];
  }

  const buckets = new Map<string, GroupedRow[]>();
  rows.forEach((row, index) => {
    const key = groupFields.map((field) => stringifyValue(row[field as keyof typeof row])).join('||');
    const bucket = buckets.get(key);
    const groupedRow: GroupedRow = { original: row, index };
    if (bucket) {
      bucket.push(groupedRow);
    } else {
      buckets.set(key, [groupedRow]);
    }
  });

  return Array.from(buckets.entries()).map(([key, bucketRows]) => ({
    key,
    rows: bucketRows,
  }));
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function sortGroupRows(rows: readonly GroupedRow[], sortFields?: readonly StackSortField[]): GroupedRow[] {
  if (!Array.isArray(sortFields) || sortFields.length === 0) {
    return [...rows];
  }

  return [...rows].sort((a, b) => {
    for (const field of sortFields) {
      const aValue = a.original[field.field];
      const bValue = b.original[field.field];
      if (aValue === bValue) {
        continue;
      }
      const orderMultiplier = field.order === 'descending' ? -1 : 1;
      return compareValues(aValue, bValue) * orderMultiplier;
    }
    return a.index - b.index;
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? 0 : value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function cloneSpec<T>(input: T): T {
  const { structuredClone } = globalThis as { structuredClone?: <U>(value: U) => U };
  if (typeof structuredClone === 'function') {
    return structuredClone(input);
  }
  return JSON.parse(JSON.stringify(input)) as T;
}

function isStackTransformCandidate(transform: NormalizedTransformEntry): transform is NormalizedTransformEntry & {
  type: 'stack';
  params?: RawStackParams;
} {
  return Boolean(transform) && transform.type === 'stack';
}

function normalizeStackParams(params?: RawStackParams): StackTransformConfig | undefined {
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  const record = params as Record<string, unknown>;
  const stackField = typeof record.stack === 'string' ? record.stack.trim() : '';

  if (!stackField) {
    return undefined;
  }

  const groupby = Array.isArray(record.groupby)
    ? record.groupby.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : undefined;

  const sort = Array.isArray(record.sort)
    ? record.sort
        .map((entry): StackSortField | undefined => {
          if (!entry || typeof entry !== 'object') {
            return undefined;
          }
          const sortRecord = entry as Record<string, unknown>;
          const field = typeof sortRecord.field === 'string' ? sortRecord.field : undefined;
          if (!field) {
            return undefined;
          }
          const normalizedOrder: StackSortField['order'] =
            sortRecord.order === 'descending' ? 'descending' : 'ascending';
          return { field, order: normalizedOrder };
        })
        .filter((entry): entry is StackSortField => entry !== undefined)
    : undefined;

  const offset = record.offset === 'normalize' ? 'normalize' : 'zero';

  const asFields =
    Array.isArray(record.as) &&
    record.as.length === 2 &&
    typeof record.as[0] === 'string' &&
    typeof record.as[1] === 'string'
      ? [record.as[0], record.as[1]] as [string, string]
      : undefined;

  return {
    stack: stackField,
    groupby,
    sort,
    offset,
    as: asFields,
  };
}
