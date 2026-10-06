export type EChartsRoleCUngradeableReason =
  | "MALFORMED_SVG"
  | "NO_CHART_ELEMENTS"
  | "NO_SOLID_CARRIER_PAINTS";

export interface EChartsRoleCPaintExtraction {
  readonly status: "ok" | "ungradeable";
  readonly roleCPaints: readonly string[];
  readonly chartElementCount: number;
  readonly unresolvedPaintCount: number;
  readonly reason?: EChartsRoleCUngradeableReason;
}

interface SvgStartElement {
  readonly attributes: ReadonlyMap<string, string>;
}

interface SvgParseResult {
  readonly malformed: boolean;
  readonly elements: readonly SvgStartElement[];
}

type ParsedPaint =
  | { readonly kind: "solid"; readonly value: string }
  | { readonly kind: "unresolved" }
  | { readonly kind: "ignored" };

// Chrome is decided by the element a paint sits on, never by its value
// (s223-m02, #2527 ruling 13 d). Until then any carrier paint equal to a colour
// found anywhere in the option under areaColor, backgroundColor, borderColor or
// textBorderColor was dropped, so a data shape painted exactly a chrome colour
// was never graded. On a chart carrier only two parts are chrome:
//  - a treemap node's background tile. TreemapView draws every node's border
//    as a rect filled with the node's border colour beneath its content
//    (Z2_BG < Z2_CONTENT), so the first carrier rendered for a treemap node is
//    its border, whatever its colour;
//  - a filled shape's outline, when its stroke is a borderColor configured by
//    the series that drew it. A map series draws its regions with its geo
//    component's itemStyle, so that component's borderColor counts too.
// The canvas, label halos and the land a geo component draws are never chart
// carriers. Every other carrier paint is data and is graded, even when it
// equals the canvas, a border or the land.
const BORDER_COLOR_KEY = "bordercolor";
const CHROME_SCAN_SKIP_KEYS = new Set([
  "__registration",
  "raw",
  "rawproperties",
  "usermeta",
]);

/**
 * Extract distinct visible Role-C carrier paints from normalized ECharts SVG.
 *
 * The parser walks XML start tags and quoted attributes. It never searches text
 * for tag-shaped strings, never treats element names as datum semantics, and
 * never deduplicates by ecmeta_data_index (node/edge indexes collide). Only an
 * exact ecmeta_ssr_type="chart" carrier participates; legend and untagged chrome
 * stay out. Paints retain first-rendered order and canonicalize to six-digit hex.
 *
 * Opacity is used only as a visibility gate. A visible solid source color is
 * retained when opacity is non-zero; no alpha-composited contrast is claimed.
 * Sankey's url() link gradients remain unresolved/excluded until a sampling and
 * compositing contract exists. If no solid carrier survives, the extraction is
 * ungradeable rather than an affirmative empty/pass result.
 */
export function extractEChartsRoleCPaints(
  svg: string,
  projectedOption: Readonly<Record<string, unknown>>,
): EChartsRoleCPaintExtraction {
  const parsed = parseSvgStartElements(svg);
  if (parsed.malformed) {
    return ungradeable("MALFORMED_SVG", 0, 0);
  }

  const roleCPaints = new Set<string>();
  const borderPaintsBySeries = new Map<string, ReadonlySet<string>>();
  const treemapNodes = new Set<string>();
  let chartElementCount = 0;
  let unresolvedPaintCount = 0;

  for (const element of parsed.elements) {
    if (element.attributes.get("ecmeta_ssr_type") !== "chart") continue;
    chartElementCount += 1;

    const seriesIndex = element.attributes.get("ecmeta_series_index") ?? "";
    const series = itemAt(projectedOption.series, seriesIndex);
    if (series?.type === "treemap") {
      const node = `${seriesIndex}:${element.attributes.get("ecmeta_data_index") ?? ""}`;
      if (!treemapNodes.has(node)) {
        treemapNodes.add(node);
        continue;
      }
    }

    if (isHidden(element.attributes)) continue;
    const filled =
      isChannelVisible(element.attributes, "fill") &&
      parseSolidPaint(element.attributes.get("fill") ?? "").kind !== "ignored";
    for (const channel of ["fill", "stroke"] as const) {
      if (!isChannelVisible(element.attributes, channel)) continue;
      const raw = element.attributes.get(channel);
      if (raw === undefined) continue;

      const paint = parseSolidPaint(raw);
      if (paint.kind === "unresolved") {
        unresolvedPaintCount += 1;
      } else if (paint.kind === "solid") {
        if (channel === "stroke" && filled) {
          let borders = borderPaintsBySeries.get(seriesIndex);
          if (!borders) {
            borders = seriesBorderPaints(projectedOption, series);
            borderPaintsBySeries.set(seriesIndex, borders);
          }
          if (borders.has(paint.value)) continue;
        }
        roleCPaints.add(paint.value);
      }
    }
  }

  if (chartElementCount === 0) {
    return ungradeable("NO_CHART_ELEMENTS", 0, unresolvedPaintCount);
  }
  if (roleCPaints.size === 0) {
    return ungradeable(
      "NO_SOLID_CARRIER_PAINTS",
      chartElementCount,
      unresolvedPaintCount,
    );
  }
  return {
    status: "ok",
    roleCPaints: [...roleCPaints],
    chartElementCount,
    unresolvedPaintCount,
  };
}

function ungradeable(
  reason: EChartsRoleCUngradeableReason,
  chartElementCount: number,
  unresolvedPaintCount: number,
): EChartsRoleCPaintExtraction {
  return {
    status: "ungradeable",
    roleCPaints: [],
    chartElementCount,
    unresolvedPaintCount,
    reason,
  };
}

function isHidden(attributes: ReadonlyMap<string, string>): boolean {
  const display = attributes.get("display")?.trim().toLowerCase();
  const visibility = attributes.get("visibility")?.trim().toLowerCase();
  return (
    display === "none" ||
    visibility === "hidden" ||
    visibility === "collapse" ||
    isZero(attributes.get("opacity"))
  );
}

function isChannelVisible(
  attributes: ReadonlyMap<string, string>,
  channel: "fill" | "stroke",
): boolean {
  if (isZero(attributes.get(`${channel}-opacity`))) return false;
  return channel !== "stroke" || !isZero(attributes.get("stroke-width"));
}

function isZero(value: string | undefined): boolean {
  if (value === undefined || value.trim() === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed <= 0;
}

function parseSolidPaint(raw: string): ParsedPaint {
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (value === "" || lower === "none" || lower === "transparent") {
    return { kind: "ignored" };
  }
  if (/^url\s*\(/i.test(value)) {
    return { kind: "unresolved" };
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const expanded =
      hex.length === 3
        ? hex
            .split("")
            .map((channel) => channel + channel)
            .join("")
        : hex;
    return { kind: "solid", value: `#${expanded.toUpperCase()}` };
  }

  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(
    value,
  );
  if (!rgb) return { kind: "ignored" };
  const channels = rgb.slice(1).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) {
    return { kind: "ignored" };
  }
  return {
    kind: "solid",
    value: `#${channels
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`,
  };
}

/** The series or component at an option index; a lone object is index 0. */
function itemAt(
  value: unknown,
  index: string | number,
): Readonly<Record<string, unknown>> | undefined {
  const position = Number(index);
  if (
    String(index).trim() === "" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    return undefined;
  }
  const item = Array.isArray(value)
    ? value[position]
    : position === 0
      ? value
      : undefined;
  return item !== null && typeof item === "object" && !Array.isArray(item)
    ? (item as Readonly<Record<string, unknown>>)
    : undefined;
}

/**
 * The borderColor paints a series configures, and its geo component's when it
 * is a map series drawn on one.
 */
function seriesBorderPaints(
  option: Readonly<Record<string, unknown>>,
  series: Readonly<Record<string, unknown>> | undefined,
): ReadonlySet<string> {
  if (!series) return new Set();
  const geo =
    series.type === "map" && typeof series.geoIndex === "number"
      ? itemAt(option.geo, series.geoIndex)
      : undefined;
  return collectBorderPaints(geo ? [series, geo] : [series]);
}

function collectBorderPaints(roots: readonly unknown[]): ReadonlySet<string> {
  const paints = new Set<string>();
  const pending: Array<{ readonly key?: string; readonly value: unknown }> =
    roots.map((value) => ({ value }));
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop()!;
    const key = current.key?.toLowerCase();
    if (key === BORDER_COLOR_KEY && typeof current.value === "string") {
      const paint = parseSolidPaint(current.value);
      if (paint.kind === "solid") paints.add(paint.value);
    }

    if (
      current.value === null ||
      typeof current.value !== "object" ||
      visited.has(current.value)
    )
      continue;
    visited.add(current.value);
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child });
      continue;
    }
    for (const [childKey, child] of Object.entries(
      current.value as Record<string, unknown>,
    )) {
      if (!CHROME_SCAN_SKIP_KEYS.has(childKey.toLowerCase())) {
        pending.push({ key: childKey, value: child });
      }
    }
  }
  return paints;
}

function parseSvgStartElements(svg: string): SvgParseResult {
  const elements: SvgStartElement[] = [];
  const openTags: string[] = [];
  let cursor = 0;

  while (cursor < svg.length) {
    const tagStart = svg.indexOf("<", cursor);
    if (tagStart < 0) break;

    if (svg.startsWith("<!--", tagStart)) {
      const end = svg.indexOf("-->", tagStart + 4);
      if (end < 0) return { malformed: true, elements };
      cursor = end + 3;
      continue;
    }
    if (svg.startsWith("<![CDATA[", tagStart)) {
      const end = svg.indexOf("]]>", tagStart + 9);
      if (end < 0) return { malformed: true, elements };
      cursor = end + 3;
      continue;
    }
    if (svg.startsWith("<?", tagStart)) {
      const end = svg.indexOf("?>", tagStart + 2);
      if (end < 0) return { malformed: true, elements };
      cursor = end + 2;
      continue;
    }
    if (svg.startsWith("<!", tagStart)) {
      const end = svg.indexOf(">", tagStart + 2);
      if (end < 0) return { malformed: true, elements };
      cursor = end + 1;
      continue;
    }

    let index = tagStart + 1;
    const closing = svg[index] === "/";
    if (closing) index += 1;
    index = skipWhitespace(svg, index);
    const name = readXmlName(svg, index);
    if (!name) return { malformed: true, elements };
    index = name.end;

    if (closing) {
      index = skipWhitespace(svg, index);
      if (svg[index] !== ">" || openTags.pop() !== name.value.toLowerCase()) {
        return { malformed: true, elements };
      }
      cursor = index + 1;
      continue;
    }

    const attributes = new Map<string, string>();
    let selfClosing = false;
    let tagClosed = false;
    while (index < svg.length) {
      index = skipWhitespace(svg, index);
      if (svg[index] === ">") {
        index += 1;
        tagClosed = true;
        break;
      }
      if (svg[index] === "/" && svg[index + 1] === ">") {
        index += 2;
        selfClosing = true;
        tagClosed = true;
        break;
      }

      const attributeName = readXmlName(svg, index);
      if (!attributeName) return { malformed: true, elements };
      index = skipWhitespace(svg, attributeName.end);
      if (svg[index] !== "=") return { malformed: true, elements };
      index = skipWhitespace(svg, index + 1);
      const quote = svg[index];
      if (quote !== '"' && quote !== "'") return { malformed: true, elements };
      const valueStart = index + 1;
      const valueEnd = svg.indexOf(quote, valueStart);
      if (valueEnd < 0) return { malformed: true, elements };
      const normalizedName = attributeName.value.toLowerCase();
      if (attributes.has(normalizedName)) return { malformed: true, elements };
      attributes.set(normalizedName, svg.slice(valueStart, valueEnd));
      index = valueEnd + 1;
    }
    if (!tagClosed) return { malformed: true, elements };

    elements.push({ attributes });
    if (!selfClosing) openTags.push(name.value.toLowerCase());
    cursor = index;
  }

  return { malformed: openTags.length > 0, elements };
}

function skipWhitespace(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && /\s/.test(value[cursor])) cursor += 1;
  return cursor;
}

function readXmlName(
  value: string,
  start: number,
): { readonly value: string; readonly end: number } | undefined {
  if (!/[A-Za-z_:]/.test(value[start] ?? "")) return undefined;
  let end = start + 1;
  while (end < value.length && /[A-Za-z0-9_.:-]/.test(value[end])) end += 1;
  return { value: value.slice(start, end), end };
}
