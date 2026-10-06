import { normaliseColor } from "@oods/a11y-tools";
import type { EChartsPrimaryType } from "./echarts-primary.js";

export interface EChartsRoleAAssignmentInput {
  readonly chartType: EChartsPrimaryType;
  /** The exact JSON-safe object returned by projectEChartsOption. */
  readonly projectedOption: Readonly<Record<string, unknown>>;
  /** Normalized or CSS-form paints observed on actual chart geometry. */
  readonly realizedPaints: readonly string[];
}

export type EChartsRoleAAssignmentResult =
  | {
      readonly status: "assigned";
      readonly categoryKeys: readonly string[];
      /** N-long: duplicates occur only when the emitted palette genuinely recycles. */
      readonly roleAAssignment: readonly string[];
    }
  | {
      readonly status: "not-applicable";
      readonly reason: "geo-contrast-exempt";
      readonly categoryKeys: readonly [];
      readonly roleAAssignment: readonly [];
    }
  | {
      readonly status: "ungradeable";
      readonly reason:
        | "missing-semantic-metadata"
        | "unreadable-semantic-paint"
        | "semantic-paint-not-rendered";
      readonly categoryKeys: readonly string[];
      readonly roleAAssignment: readonly [];
    };

interface SemanticEntry {
  readonly key: string;
  readonly paint: unknown;
}

const GEO_TYPES = new Set<EChartsPrimaryType>([
  "choropleth",
  "bubble_map",
  "flow_map",
]);
const UNREADABLE_PAINT_KEYWORDS = new Set([
  "none",
  "transparent",
  "source",
  "target",
]);

/**
 * Derive Role A from semantic category metadata in the exact projected option.
 *
 * Path counts and ecmeta_data_index are deliberately absent from this module. SVG
 * extraction supplies only the realized-paint filter; it cannot change category n.
 */
export function deriveEChartsRoleAAssignment(
  input: EChartsRoleAAssignmentInput,
): EChartsRoleAAssignmentResult {
  if (GEO_TYPES.has(input.chartType)) {
    return {
      status: "not-applicable",
      reason: "geo-contrast-exempt",
      categoryKeys: [],
      roleAAssignment: [],
    };
  }

  const entries = semanticEntries(input.chartType, input.projectedOption);
  if (!entries || entries.length === 0) {
    return ungradeable("missing-semantic-metadata", []);
  }

  const categoryKeys = entries.map(({ key }) => key);
  const assignment: string[] = [];
  for (const { paint } of entries) {
    const normalized = normalizeSolidPaint(paint);
    if (!normalized) {
      return ungradeable("unreadable-semantic-paint", categoryKeys);
    }
    assignment.push(normalized);
  }

  const realized = new Set(
    input.realizedPaints
      .map((paint) => normalizeSolidPaint(paint))
      .filter((paint): paint is string => paint !== undefined),
  );
  if (assignment.some((paint) => !realized.has(paint))) {
    return ungradeable("semantic-paint-not-rendered", categoryKeys);
  }

  return { status: "assigned", categoryKeys, roleAAssignment: assignment };
}

function semanticEntries(
  chartType: EChartsPrimaryType,
  option: Readonly<Record<string, unknown>>,
): readonly SemanticEntry[] | undefined {
  const series = firstRecord(option.series);
  if (!series) {
    return undefined;
  }

  switch (chartType) {
    case "treemap":
    case "sunburst":
      return hierarchyEntries(series);
    case "sankey":
      return entriesFromRecords(recordArray(series.data));
    case "chord":
      return entriesFromRecords(recordArray(series.nodes));
    case "force_graph":
      return forceCategoryEntries(recordArray(series.categories));
    default:
      return undefined;
  }
}

function hierarchyEntries(
  series: Readonly<Record<string, unknown>>,
): readonly SemanticEntry[] | undefined {
  const data = recordArray(series.data);
  if (!data || data.length === 0) {
    return undefined;
  }
  const rootChildren =
    data.length === 1 ? recordArray(data[0].children) : undefined;
  const firstVisibleLevel =
    rootChildren && rootChildren.length > 0 ? rootChildren : data;
  return entriesFromRecords(firstVisibleLevel);
}

function entriesFromRecords(
  records: readonly Readonly<Record<string, unknown>>[] | undefined,
): readonly SemanticEntry[] | undefined {
  if (!records || records.length === 0) {
    return undefined;
  }
  const entries: SemanticEntry[] = [];
  for (const record of records) {
    const key = semanticKey(record);
    if (!key) {
      return undefined;
    }
    entries.push({ key, paint: itemPaint(record) });
  }
  return entries;
}

function forceCategoryEntries(
  categories: readonly Readonly<Record<string, unknown>>[] | undefined,
): readonly SemanticEntry[] | undefined {
  if (!categories || categories.length === 0) {
    return undefined;
  }

  const byName = new Map<string, unknown>();
  for (const category of categories) {
    const name = typeof category.name === "string" ? category.name : "";
    if (name.length === 0) {
      continue;
    }
    const paint = itemPaint(category);
    if (byName.has(name) && byName.get(name) !== paint) {
      return undefined;
    }
    byName.set(name, paint);
  }
  if (byName.size === 0) {
    return undefined;
  }

  return [...byName]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, paint]) => ({ key, paint }));
}

function semanticKey(
  record: Readonly<Record<string, unknown>>,
): string | undefined {
  const candidate = record.name ?? record.id;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
}

function itemPaint(record: Readonly<Record<string, unknown>>): unknown {
  const itemStyle = asRecord(record.itemStyle);
  return itemStyle?.color;
}

function normalizeSolidPaint(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const candidate = value.trim();
  const lower = candidate.toLowerCase();
  if (
    candidate.length === 0 ||
    UNREADABLE_PAINT_KEYWORDS.has(lower) ||
    lower.startsWith("url(") ||
    lower.startsWith("var(")
  ) {
    return undefined;
  }
  try {
    const normalized = normaliseColor(
      candidate,
      "ECharts Role-A semantic paint",
    );
    return /^#[0-9a-f]{6}$/i.test(normalized)
      ? normalized.toUpperCase()
      : undefined;
  } catch {
    return undefined;
  }
}

function recordArray(
  value: unknown,
): readonly Readonly<Record<string, unknown>>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const records: Readonly<Record<string, unknown>>[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      return undefined;
    }
    records.push(record);
  }
  return records;
}

function firstRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return Array.isArray(value) ? asRecord(value[0]) : asRecord(value);
}

function asRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function ungradeable(
  reason: Extract<
    EChartsRoleAAssignmentResult,
    { status: "ungradeable" }
  >["reason"],
  categoryKeys: readonly string[],
): EChartsRoleAAssignmentResult {
  return { status: "ungradeable", reason, categoryKeys, roleAAssignment: [] };
}
