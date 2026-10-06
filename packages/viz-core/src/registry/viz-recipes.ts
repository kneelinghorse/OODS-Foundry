import recipes from './viz-recipes.v1.json';
import census from './viz-recipes.measured.json';

export interface VizRecipeCapability {
  chartType: string;
  specEngine: 'vega-lite' | 'echarts';
  publicSvg: boolean;
  dashboardDrawn: true | 'excluded (#881)';
  themes: { light: boolean; dark: boolean; hc: boolean };
  /** The brands this recipe was measured in (s213-m04: recorded evidence, not the list of brands a chart may use). */
  brands: string[];
  a11yDescription: boolean;
  /** Offered codes; a resolved-operand count is a separate certification field. */
  accuracyRules: string[];
  certifyCoverage: 'certified' | 'uncertified';
  /** Which data-bearing certification path the census actually exercised. */
  certifyProfile: 'cartesian' | 'echarts-data';
  /** Actual pixels or a typed renderer failure for every admitted theme/brand cell. */
  renderScopes: Array<{
    theme: 'light' | 'dark' | 'hc';
    brand: string;
    status: 'rendered' | 'typed-deferred';
    svgHash?: string;
    errors?: Array<{ code: string; message: string; severity?: string }>;
  }>;
  /** Preserve measured booleans per scope; certified coverage never implies conformance. */
  certifyScopes: Array<{
    theme: 'light' | 'dark' | 'hc';
    brand: string;
    coverage: 'certified' | 'uncertified';
    conformant: boolean | null;
    pillars: { a11yEquivalence: string; determinism: string; contrast: string; accuracy: string };
    accuracySummary: { rulesEvaluated: number; failing: number };
  }>;
  /** Actual categorical canvas grades, including failures; never exempt/unchecked. */
  contrastMeasured: Array<'light' | 'dark'>;
  /** Every brand has a measured pass in this theme; exemptions are not passes. */
  contrastPassed: Array<'light' | 'dark'>;
  chartInApp: 'placed' | 'not-placed';
  notes: string[];
}

/** Measured by the public-tool census; the contract test rejects unmeasured changes. */
export const VIZ_RECIPES: readonly VizRecipeCapability[] = recipes as VizRecipeCapability[];

/**
 * s223-m03 (#2527 ruling 17): what the census behind VIZ_RECIPES was measured on: the release version and source head it ran
 * at (archiveSha256 is null: it measured the source), the certified chart types and scopes it counted, and the registry
 * SHA-256 it stamped. Written by the census (s190-viz-census --check --stamp); health and @oods/foundry's facts.json report it.
 */
export interface VizRecipesCensus {
  schema: 'oods-viz-census-stamp/v1';
  measuredOn: { version: string; sourceHead: string; archiveSha256: null };
  dirty: boolean;
  chartTypes: number;
  certifiedScopes: number;
  registrySha256: string;
}
export const VIZ_RECIPES_CENSUS: Readonly<VizRecipesCensus> = Object.freeze(census as VizRecipesCensus);
