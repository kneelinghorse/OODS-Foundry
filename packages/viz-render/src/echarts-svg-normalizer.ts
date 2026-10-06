import { createFirstAppearanceRemap } from "./first-appearance-remap.js";

const GENERATED_TOKEN_SOURCE = String.raw`zr\d+-(?:cls-\d+|ani-\d+|[sgpc]\d+)`;
const EXACT_GENERATED_TOKEN = new RegExp(`^${GENERATED_TOKEN_SOURCE}$`);
const TOKEN_BOUNDARY = String.raw`[A-Za-z0-9_-]`;

interface TokenOccurrence {
  readonly start: number;
  readonly end: number;
  readonly token: string;
}

/**
 * Return the ECharts/zrender structural tokens in first-appearance order.
 *
 * This is intentionally not a search for token-shaped text. Only definition
 * and reference positions that can affect SVG structure are admitted.
 */
export function discoverEChartsStructuralTokens(
  svg: string,
): readonly string[] {
  const occurrences = discoverStructuralOccurrences(svg);
  return [
    ...createFirstAppearanceRemap(
      occurrences.map(({ token }) => token),
      (_index, token) => token,
    ).keys(),
  ];
}

/**
 * Normalize ECharts/zrender allocator tokens without changing authored SVG.
 *
 * All admitted token families share one first-appearance map. Replacements are
 * applied only at the structural spans discovered from the original document,
 * so identical text in labels, ARIA/ecmeta metadata, geometry, transforms, or
 * unrelated attributes is preserved byte-for-byte.
 */
export function normalizeEChartsSvg(svg: string): string {
  const occurrences = discoverStructuralOccurrences(svg);
  const replacements = createFirstAppearanceRemap(
    occurrences.map(({ token }) => token),
    (index) => `oods-zr-${index}`,
  );

  if (occurrences.length === 0) {
    return svg;
  }

  let cursor = 0;
  let normalized = "";
  for (const occurrence of occurrences) {
    normalized += svg.slice(cursor, occurrence.start);
    normalized += replacements.get(occurrence.token) ?? occurrence.token;
    cursor = occurrence.end;
  }
  return normalized + svg.slice(cursor);
}

function discoverStructuralOccurrences(
  svg: string,
): readonly TokenOccurrence[] {
  const occurrences: TokenOccurrence[] = [];
  const markup = /<style\b[^>]*>[\s\S]*?<\/style\s*>|<[^>]+>/gi;

  for (const match of svg.matchAll(markup)) {
    const fragment = match[0];
    const fragmentStart = match.index ?? 0;
    if (/^<style\b/i.test(fragment)) {
      discoverStyleBlock(fragment, fragmentStart, occurrences);
    } else if (!/^<\s*(?:\/|!|\?)/.test(fragment)) {
      discoverTagAttributes(fragment, fragmentStart, occurrences);
    }
  }

  return dedupeAndSortOccurrences(occurrences);
}

function discoverTagAttributes(
  tag: string,
  tagStart: number,
  occurrences: TokenOccurrence[],
): void {
  const attribute = /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const match of tag.matchAll(attribute)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? "";
    const quote = match[2] === undefined ? "'" : '"';
    const valueStart =
      tagStart + (match.index ?? 0) + match[0].indexOf(quote) + 1;

    if (name === "id") {
      addExactToken(value, valueStart, occurrences);
    } else if (name === "class") {
      addWhitespaceSeparatedTokens(value, valueStart, occurrences);
    } else if (isPaintReferenceName(name)) {
      addUrlReferences(value, valueStart, occurrences);
    } else if (name === "animation" || name === "animation-name") {
      addBareTokenReferences(value, valueStart, occurrences);
    } else if (name === "style") {
      discoverCssDeclarations(value, valueStart, occurrences);
    }
  }
}

function discoverStyleBlock(
  styleElement: string,
  elementStart: number,
  occurrences: TokenOccurrence[],
): void {
  const openEnd = styleElement.indexOf(">");
  const closeStart = styleElement.toLowerCase().lastIndexOf("</style");
  if (openEnd < 0 || closeStart < openEnd) {
    return;
  }

  const css = styleElement.slice(openEnd + 1, closeStart);
  const cssStart = elementStart + openEnd + 1;
  const searchable = maskCssCommentsAndStrings(css);

  // zrender class/id selectors are structural links to class/id attributes.
  const selectorPrelude = /([^{}]+)(?=\{)/g;
  for (const match of searchable.matchAll(selectorPrelude)) {
    const prelude = match[1];
    const preludeStart = cssStart + (match.index ?? 0);
    const selectorToken = new RegExp(
      `(?:\\.|#)(${GENERATED_TOKEN_SOURCE})(?!${TOKEN_BOUNDARY})`,
      "g",
    );
    for (const tokenMatch of prelude.matchAll(selectorToken)) {
      const token = tokenMatch[1];
      const relativeStart =
        (tokenMatch.index ?? 0) + tokenMatch[0].length - token.length;
      addOccurrence(token, preludeStart + relativeStart, occurrences);
    }
  }

  // Animation names are bare identifiers in definitions and declarations.
  const keyframes = new RegExp(
    `@(?:-webkit-)?keyframes\\s+(${GENERATED_TOKEN_SOURCE})(?!${TOKEN_BOUNDARY})`,
    "gi",
  );
  for (const match of searchable.matchAll(keyframes)) {
    const token = match[1];
    const relativeStart = (match.index ?? 0) + match[0].lastIndexOf(token);
    addOccurrence(token, cssStart + relativeStart, occurrences);
  }

  discoverCssDeclarations(searchable, cssStart, occurrences);
}

function discoverCssDeclarations(
  css: string,
  cssStart: number,
  occurrences: TokenOccurrence[],
): void {
  const declaration =
    /(?:^|[;{])\s*((?:-(?:webkit|moz)-)?(?:fill|stroke|filter|clip-path|animation(?:-name)?))\s*:\s*([^;}]+)/gi;

  for (const match of css.matchAll(declaration)) {
    const property = match[1].replace(/^-(?:webkit|moz)-/i, "").toLowerCase();
    const value = match[2];
    const valueStart =
      cssStart + (match.index ?? 0) + match[0].lastIndexOf(value);
    if (isPaintReferenceName(property)) {
      addUrlReferences(value, valueStart, occurrences);
    } else {
      addBareTokenReferences(value, valueStart, occurrences);
    }
  }
}

function addExactToken(
  value: string,
  valueStart: number,
  occurrences: TokenOccurrence[],
): void {
  if (EXACT_GENERATED_TOKEN.test(value)) {
    addOccurrence(value, valueStart, occurrences);
  }
}

function addWhitespaceSeparatedTokens(
  value: string,
  valueStart: number,
  occurrences: TokenOccurrence[],
): void {
  for (const match of value.matchAll(/\S+/g)) {
    if (EXACT_GENERATED_TOKEN.test(match[0])) {
      addOccurrence(match[0], valueStart + (match.index ?? 0), occurrences);
    }
  }
}

function addUrlReferences(
  value: string,
  valueStart: number,
  occurrences: TokenOccurrence[],
): void {
  const reference = new RegExp(
    `url\\(\\s*(["']?)#(${GENERATED_TOKEN_SOURCE})(?!${TOKEN_BOUNDARY})\\1\\s*\\)`,
    "g",
  );
  for (const match of value.matchAll(reference)) {
    const token = match[2];
    const relativeStart = (match.index ?? 0) + match[0].indexOf(token);
    addOccurrence(token, valueStart + relativeStart, occurrences);
  }
}

function addBareTokenReferences(
  value: string,
  valueStart: number,
  occurrences: TokenOccurrence[],
): void {
  const reference = new RegExp(
    `(?<!${TOKEN_BOUNDARY})(${GENERATED_TOKEN_SOURCE})(?!${TOKEN_BOUNDARY})`,
    "g",
  );
  for (const match of value.matchAll(reference)) {
    addOccurrence(match[1], valueStart + (match.index ?? 0), occurrences);
  }
}

function addOccurrence(
  token: string,
  start: number,
  occurrences: TokenOccurrence[],
): void {
  occurrences.push({ start, end: start + token.length, token });
}

function dedupeAndSortOccurrences(
  occurrences: readonly TokenOccurrence[],
): readonly TokenOccurrence[] {
  const byStart = new Map<number, TokenOccurrence>();
  for (const occurrence of occurrences) {
    byStart.set(occurrence.start, occurrence);
  }
  return [...byStart.values()].sort((left, right) => left.start - right.start);
}

function maskCssCommentsAndStrings(css: string): string {
  const masked = css.split("");
  let index = 0;

  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      const limit = end < 0 ? css.length : end + 2;
      for (let cursor = index; cursor < limit; cursor += 1) {
        masked[cursor] = " ";
      }
      index = limit;
      continue;
    }

    const quote = css[index];
    if (quote === '"' || quote === "'") {
      let cursor = index + 1;
      while (cursor < css.length) {
        if (css[cursor] === "\\") {
          cursor += 2;
        } else if (css[cursor] === quote) {
          cursor += 1;
          break;
        } else {
          cursor += 1;
        }
      }
      // Quoted URL fragments are structural paint references, not authored CSS
      // strings. Keep them searchable while still masking ordinary string data.
      if (/url\(\s*$/i.test(css.slice(0, index))) {
        index = cursor;
        continue;
      }
      for (let maskedIndex = index; maskedIndex < cursor; maskedIndex += 1) {
        masked[maskedIndex] = " ";
      }
      index = cursor;
      continue;
    }

    index += 1;
  }

  return masked.join("");
}

function isPaintReferenceName(name: string): boolean {
  return (
    name === "fill" ||
    name === "stroke" ||
    name === "filter" ||
    name === "clip-path"
  );
}
