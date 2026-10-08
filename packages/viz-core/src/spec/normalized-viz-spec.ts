import Ajv, { type ErrorObject, type JSONSchemaType, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import schema from './normalized-viz-spec.schema.json' with { type: 'json' };
import type { NormalizedVizSpecV01 } from './normalized-viz-spec.types.js';

export type {
  // Core IR shapes — first-class public library-consumer contract (sprint-152 F1,
  // item #16). `Mark` (incl. `Mark.from`) + the `datasets` map (typed via
  // NormalizedVizSpec['datasets']) let a build-time importer author a layered spec
  // by NAME (e.g. Forge-Demos "Demo 03" Hero B, marks[1].from='gov_median') without
  // reaching into a deep @/ path. See docs/viz/normalized-viz-spec.md.
  Mark,
  DataSource,
  EncodingMap,
  Transform,
  TraitBinding,
  InteractionTrait,
  InteractionSelection,
  IntervalSelection,
  InteractionRule,
  LayoutDefinition,
  LayoutFacet,
  LayoutLayer,
  LayoutConcat,
  ConcatSection,
  SharedScaleConfig,
  LayoutProjection,
  FacetField,
  SectionFilter,
} from './normalized-viz-spec.types.js';

export type NormalizedVizSpec = NormalizedVizSpecV01;

export interface NormalizedVizSpecValidationError {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface VizSpecValidationResult {
  readonly valid: boolean;
  readonly errors: readonly NormalizedVizSpecValidationError[];
}

export class NormalizedVizSpecError extends Error {
  public readonly errors: readonly NormalizedVizSpecValidationError[];

  constructor(message: string, errors: readonly NormalizedVizSpecValidationError[]) {
    super(message);
    this.name = 'NormalizedVizSpecError';
    this.errors = errors;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const typedSchema = schema as unknown as JSONSchemaType<NormalizedVizSpec>;
const validator: ValidateFunction<NormalizedVizSpec> = ajv.compile(typedSchema);

/**
 * The `keyword` of a validation error for chart input that names a resource to load or
 * link to (s239). The schema still describes DataSource.url, so the published IR shape is
 * unchanged, but a chart renders only the data it carries and no output may reference an
 * external resource: Vega's default Node loader fetches an http(s) `url` and reads a
 * `file://` one, and a viewer showing an SVG or an ECharts option loads its images and
 * follows its links. The free-form blocks (marks[].options, config.mark,
 * transforms[].params) reach Vega-Lite unchanged, so the whole spec is checked; inline
 * rows are data, not addresses.
 */
export const EXTERNAL_RESOURCE_KEYWORD = 'externalResource';

/**
 * Keys whose value is loaded or followed: an address or link (url, href, an ECharts link
 * or sublink) or an ECharts image source (a pattern fill, a label or rich-text background,
 * a graphic image). Refused with whatever value they hold, data: URIs included.
 */
const REFERENCE_KEYS: ReadonlySet<string> = new Set(['url', 'href', 'link', 'sublink', 'image']);

/** An ECharts image symbol (series or item symbol, legend icon, decal), or a CSS/SVG url() aimed outside the document. */
const REFERENCE_VALUE = /^\s*image:\/\/|url\(\s*['"]?\s*(?!#)[^\s'")]/i;

/** Values drawn only as escaped text, never as a paint, symbol or style. */
const TEXT_KEYS: ReadonlySet<string> = new Set(['name', 'title', 'description', 'ariaLabel', 'summary', 'keyFindings', 'caption']);

const GEO_DATA_KEYS: ReadonlySet<string> = new Set(['rows', 'geojson', 'topojson']);
const OPERAND_KEYS: ReadonlySet<string> = new Set(['tooltip']);
const NO_KEYS: ReadonlySet<string> = new Set();

export function validateNormalizedVizSpec(input: unknown): VizSpecValidationResult {
  const valid = validator(input);
  const isRows = (path: readonly string[], key: string): boolean =>
    (key === 'values' && path[path.length - 1] === 'data') || (key === 'datasets' && path.length === 0);
  const errors = [...(valid ? [] : formatErrors(validator.errors ?? [])), ...externalReferenceErrors(input, [], isRows, NO_KEYS)];

  if (errors.length === 0) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors,
  };
}

export function assertNormalizedVizSpec(input: unknown): NormalizedVizSpec {
  const result = validateNormalizedVizSpec(input);

  if (result.valid) {
    return input as NormalizedVizSpec;
  }

  // Callers report only the message, so a refused address names itself and its remedy there.
  const external = result.errors.filter((error) => error.keyword === EXTERNAL_RESOURCE_KEYWORD);
  throw new NormalizedVizSpecError(
    external.length > 0 ? external.map((error) => error.message).join(' ') : 'Normalized Viz Spec validation failed',
    [...result.errors],
  );
}

export function isNormalizedVizSpec(input: unknown): input is NormalizedVizSpec {
  return validateNormalizedVizSpec(input).valid;
}

export const normalizedVizSpecSchema = schema;

/**
 * Refusals for a chart's data operand (s239): the hierarchy, sankey, chord, network or geo
 * branch at `path` in the caller's input, which viz_render and dashboard_render draw and
 * artifact_certify grades. Node and link fields are copied into ECharts data items, where
 * ECharts reads them as options, so they are checked like a spec, and an item tooltip is
 * refused too because ECharts renders it as HTML. Geo rows and inline geometry are data
 * that ECharts never reads as options.
 */
export function externalOperandErrors(path: readonly string[], operand: unknown): NormalizedVizSpecValidationError[] {
  const geo = path[path.length - 1] === 'geo';
  const isData = (at: readonly string[], key: string): boolean => geo && at.length === path.length && GEO_DATA_KEYS.has(key);
  return externalReferenceErrors(operand, path, isData, OPERAND_KEYS);
}

function externalReferenceErrors(
  input: unknown,
  root: readonly string[],
  isData: (path: readonly string[], key: string) => boolean,
  refusedKeys: ReadonlySet<string>,
): NormalizedVizSpecValidationError[] {
  const errors: NormalizedVizSpecValidationError[] = [];
  const visit = (value: unknown, path: readonly string[], owner: string): void => {
    if (typeof value === 'string') {
      if (!TEXT_KEYS.has(owner) && REFERENCE_VALUE.test(value)) errors.push(referenceError(path));
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const list = Array.isArray(value);
    for (const [key, child] of Object.entries(value)) {
      if (isData(path, key)) continue;
      const at = [...path, key];
      if (!list && (REFERENCE_KEYS.has(key) || refusedKeys.has(key))) errors.push(referenceError(at));
      else visit(child, at, list ? owner : key);
    }
  };
  visit(input, root, '');
  return errors;
}

function referenceError(path: readonly string[]): NormalizedVizSpecValidationError {
  const field = (segments: readonly string[]): string =>
    segments.reduce((name, segment) => (/^\d+$/.test(segment) ? `${name}[${segment}]` : name ? `${name}.${segment}` : segment), '');
  const key = path[path.length - 1];
  const message = key === 'tooltip'
    ? `${field(path)} is not accepted: an item tooltip is rendered as HTML, which can load images and follow links, and OODS Foundry builds every chart's tooltip itself. Remove it.`
    : `${field(path)} is not accepted: OODS Foundry renders charts from inline data only, so chart input cannot name a URL, file, image or link. ${
      key === 'url' && path[path.length - 2] === 'data' ? `Pass the rows inline as ${field([...path.slice(0, -1), 'values'])} instead.` : 'Remove it.'}`;
  return { path: `/${path.join('/')}`, keyword: EXTERNAL_RESOURCE_KEYWORD, message };
}

function formatErrors(errors: ErrorObject[]): NormalizedVizSpecValidationError[] {
  return errors.map((error) => ({
    path: error.instancePath === '' ? '/' : error.instancePath,
    message: error.message ?? 'Validation error',
    keyword: error.keyword,
  }));
}
