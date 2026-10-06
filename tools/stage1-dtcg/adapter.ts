// s166 m04 — Stage1 fig_local_tokens → DTCG adapter v0.
//
// Converts Stage1 fig-extract token exports ({name, kind, source, values:[{mode?, value}]})
// into DTCG ($type/$value) documents: one BASE set plus one overlay set per Figma mode,
// mirroring the packages/tokens brands/<brand>/{base,dark,…}.json shape the s167 seed needs.
//
// v0 scope: color, number, text_style. Everything
// else (string, boolean, effect_style, grid_style) is SKIPPED and counted — never silently
// absorbed. Known upstream limitations are disclosed in the coverage report, not hidden:
// aliases arrive value-resolved (Stage1 keeps reference chains internally; recovering them
// is a Stage1 ask), and null values mean the upstream library was not supplied to the
// extraction (a client question).
//
// This adapter lives in Forge and only READS Stage1 artifacts — nothing is ever written
// into Stage1's repo (standing rule: no missions in other teams' repos).

export interface FigLocalTokenValue {
  readonly mode?: string;
  readonly value: unknown;
}

export interface FigLocalToken {
  readonly name: string;
  readonly kind: string;
  readonly source?: string;
  readonly values: readonly FigLocalTokenValue[];
}

export interface FigLocalTokensFile {
  readonly kind: string;
  readonly version?: string;
  readonly generated_at?: string;
  readonly source?: { readonly file_label?: string; readonly fig_version?: number };
  readonly tokens: readonly FigLocalToken[];
}

export type DtcgNode = { [key: string]: DtcgNode | unknown };

export interface TokenCollision {
  readonly path: string;
  readonly set: string;
  readonly kept: unknown;
  readonly dropped: unknown;
}

export interface CoverageReport {
  readonly source: {
    readonly fileLabel: string;
    readonly generatedAt: string;
    readonly figVersion: number | null;
    readonly totalTokens: number;
  };
  readonly scopeKinds: readonly string[];
  readonly inScope: number;
  readonly converted: number;
  readonly unresolved: { readonly count: number; readonly names: readonly string[] };
  readonly skippedByKind: Readonly<Record<string, number>>;
  readonly baseModePolicy: string;
  readonly baseModeChoices: Readonly<Record<string, number>>;
  readonly modeSets: Readonly<Record<string, number>>;
  readonly identicalDuplicatesMerged: number;
  readonly collisions: readonly TokenCollision[];
  readonly leafGroupConflictsRenamed: readonly { readonly name: string; readonly renamedTo: string }[];
  readonly unmappedFontStyles: readonly string[];
  readonly disclosedLimitations: readonly string[];
}

export interface ConversionResult {
  readonly base: DtcgNode;
  readonly modes: Readonly<Record<string, DtcgNode>>;
  readonly report: CoverageReport;
}

export const V0_SCOPE_KINDS = ['color', 'number', 'text_style'] as const;

const BASE_MODE = 'Light';

// Figma style names + numeric strings → DTCG numeric font weights.
const FONT_WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

export function slugifyMode(mode: string): string {
  return mode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// DTCG token names must not contain {, }, ., or $ — those characters are reserved
// for the reference syntax. Segments keep their original casing and spaces.
function sanitizeSegment(segment: string): string {
  return segment.trim().replace(/[{}.$]/g, '-');
}

function tokenPathSegments(name: string): string[] {
  return name
    .split('/')
    .map(sanitizeSegment)
    .filter((segment) => segment.length > 0);
}

function mapFontWeight(fontStyle: string): { weight: number | string; mapped: boolean } {
  const numeric = Number(fontStyle);
  if (Number.isFinite(numeric) && fontStyle.trim() !== '') {
    return { weight: numeric, mapped: true };
  }
  const key = fontStyle.toLowerCase().replace(/[^a-z]/g, '').replace(/italic/g, '');
  if (key in FONT_WEIGHTS) {
    return { weight: FONT_WEIGHTS[key], mapped: true };
  }
  return { weight: fontStyle, mapped: false };
}

interface ConvertedValue {
  readonly $type: string;
  readonly $value: unknown;
}

function convertValue(
  kind: string,
  value: unknown,
  unmappedFontStyles: Set<string>
): ConvertedValue | null {
  if (value === null || value === undefined) {
    return null;
  }
  switch (kind) {
    case 'color':
      return typeof value === 'string' ? { $type: 'color', $value: value } : null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? { $type: 'number', $value: value }
        : null;
    case 'text_style': {
      if (typeof value !== 'object') {
        return null;
      }
      const style = value as { fontFamily?: unknown; fontSize?: unknown; fontStyle?: unknown };
      if (typeof style.fontFamily !== 'string' || typeof style.fontSize !== 'number') {
        return null;
      }
      const rawStyle = typeof style.fontStyle === 'string' ? style.fontStyle : 'Regular';
      const { weight, mapped } = mapFontWeight(rawStyle);
      if (!mapped) {
        unmappedFontStyles.add(rawStyle);
      }
      return {
        $type: 'typography',
        $value: {
          fontFamily: style.fontFamily,
          // Figma text styles are px-denominated.
          fontSize: `${style.fontSize}px`,
          fontWeight: weight,
          fontStyle: /italic/i.test(rawStyle) ? 'italic' : 'normal',
        },
      };
    }
    default:
      return null;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTokenLeaf(node: unknown): node is ConvertedValue {
  return typeof node === 'object' && node !== null && '$value' in (node as Record<string, unknown>);
}

// Insert a converted token at path into a DTCG tree. Returns the outcome so the
// caller can count identical merges and record first-wins collisions.
function insertToken(
  root: DtcgNode,
  segments: readonly string[],
  token: ConvertedValue
): { outcome: 'inserted' | 'identical' | 'collision'; existing?: unknown } {
  let node: DtcgNode = root;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (next === undefined) {
      const created: DtcgNode = {};
      node[segment] = created;
      node = created;
    } else if (isTokenLeaf(next)) {
      // Group-under-leaf cannot happen: leaf/group conflicts are renamed up front.
      throw new Error(`Group path collides with an existing token leaf at "${segment}"`);
    } else {
      node = next as DtcgNode;
    }
  }
  const leafKey = segments[segments.length - 1];
  const existing = node[leafKey];
  if (existing === undefined) {
    node[leafKey] = token;
    return { outcome: 'inserted' };
  }
  if (isTokenLeaf(existing) && deepEqual(existing, token)) {
    return { outcome: 'identical' };
  }
  return { outcome: 'collision', existing };
}

export function convertFigLocalTokens(file: FigLocalTokensFile): ConversionResult {
  if (file.kind !== 'fig_local_tokens') {
    throw new Error(`Unsupported input kind "${file.kind}" (expected fig_local_tokens)`);
  }

  const scope = new Set<string>(V0_SCOPE_KINDS);
  const base: DtcgNode = {};
  const modes: Record<string, DtcgNode> = {};
  const skippedByKind: Record<string, number> = {};
  const baseModeChoices: Record<string, number> = {};
  const modeSetCounts: Record<string, number> = {};
  const unresolvedNames: string[] = [];
  const collisions: TokenCollision[] = [];
  const unmappedFontStyles = new Set<string>();
  let inScope = 0;
  let converted = 0;
  let identicalDuplicatesMerged = 0;

  // Pre-scan: a token name that is ALSO a group prefix of another token cannot be a
  // DTCG leaf at that path (a node cannot carry $value and children). Rename such
  // leaves deterministically up front — order-independent, disclosed in the report.
  const scoped = file.tokens.filter((token) => scope.has(token.kind));
  const allPaths = new Set(scoped.map((token) => tokenPathSegments(token.name).join('/')));
  const allPrefixes = new Set<string>();
  for (const path of allPaths) {
    const segments = path.split('/');
    for (let i = 1; i < segments.length; i += 1) {
      allPrefixes.add(segments.slice(0, i).join('/'));
    }
  }
  const renames = new Map<string, string>();
  for (const path of allPaths) {
    if (allPrefixes.has(path)) {
      renames.set(path, `${path} (value)`);
    }
  }

  for (const token of file.tokens) {
    if (!scope.has(token.kind)) {
      skippedByKind[token.kind] = (skippedByKind[token.kind] ?? 0) + 1;
      continue;
    }
    inScope += 1;

    let segments = tokenPathSegments(token.name);
    const flatPath = segments.join('/');
    if (renames.has(flatPath)) {
      const renamed = renames.get(flatPath)!.split('/');
      segments = renamed;
    }
    if (segments.length === 0) {
      unresolvedNames.push(token.name);
      continue;
    }

    const resolvable = token.values.filter((entry) => entry.value !== null && entry.value !== undefined);
    if (resolvable.length === 0) {
      unresolvedNames.push(token.name);
      continue;
    }

    // Base = the Light-mode value when present, else the FIRST listed value (fig-extract
    // preserves Figma's collection mode order; which mode is the collection default is
    // NOT recoverable from this shape — a disclosed heuristic, not a fact).
    const baseEntry = resolvable.find((entry) => entry.mode === BASE_MODE) ?? resolvable[0];
    const baseChoice = baseEntry.mode ?? '<modeless>';
    const dtcgToken = convertValue(token.kind, baseEntry.value, unmappedFontStyles);
    if (!dtcgToken) {
      unresolvedNames.push(token.name);
      continue;
    }

    const result = insertToken(base, segments, dtcgToken);
    if (result.outcome === 'identical') {
      identicalDuplicatesMerged += 1;
    } else if (result.outcome === 'collision') {
      collisions.push({
        path: segments.join('/'),
        set: 'base',
        kept: result.existing,
        dropped: dtcgToken,
      });
    } else {
      converted += 1;
      baseModeChoices[baseChoice] = (baseModeChoices[baseChoice] ?? 0) + 1;
    }

    for (const entry of resolvable) {
      if (entry === baseEntry || entry.mode === undefined) {
        continue;
      }
      const slug = slugifyMode(entry.mode);
      if (slug.length === 0) {
        continue;
      }
      const overlayToken = convertValue(token.kind, entry.value, unmappedFontStyles);
      if (!overlayToken) {
        continue;
      }
      const overlay = (modes[slug] ??= {});
      const overlayResult = insertToken(overlay, segments, overlayToken);
      if (overlayResult.outcome === 'identical') {
        identicalDuplicatesMerged += 1;
      } else if (overlayResult.outcome === 'collision') {
        collisions.push({
          path: segments.join('/'),
          set: slug,
          kept: overlayResult.existing,
          dropped: overlayToken,
        });
      } else {
        modeSetCounts[slug] = (modeSetCounts[slug] ?? 0) + 1;
      }
    }
  }

  const report: CoverageReport = {
    source: {
      fileLabel: file.source?.file_label ?? 'unknown',
      generatedAt: file.generated_at ?? 'unknown',
      figVersion: file.source?.fig_version ?? null,
      totalTokens: file.tokens.length,
    },
    scopeKinds: [...V0_SCOPE_KINDS],
    inScope,
    converted,
    unresolved: { count: unresolvedNames.length, names: unresolvedNames },
    skippedByKind,
    baseModePolicy: `mode "${BASE_MODE}" when present, else the first listed value`,
    baseModeChoices,
    modeSets: modeSetCounts,
    identicalDuplicatesMerged,
    collisions,
    leafGroupConflictsRenamed: [...renames.entries()].map(([name, renamedTo]) => ({ name, renamedTo })),
    unmappedFontStyles: [...unmappedFontStyles],
    disclosedLimitations: [
      'Aliases arrive VALUE-RESOLVED: Stage1 fig-extract resolves reference chains to concrete values, so DTCG {token.path} reference structure is lost. Recovering chains is a Stage1 ask (message sent at sprint closeout), not a Forge-side fix.',
      'Null-valued tokens likely mean an upstream Figma library was not supplied to the extraction — a client question, flagged not guessed.',
      'Artifact staleness vs the source Figma file is unknown; re-running fig-extract on fresh exports refreshes it.',
      'Which Figma mode is each collection’s DEFAULT is not recoverable from fig_local_tokens; the base set uses the disclosed Light-or-first heuristic.',
      'Same-path same-mode value conflicts resolve FIRST-WINS and are itemized in `collisions` — none are silently dropped.',
    ],
  };

  return { base, modes, report };
}
