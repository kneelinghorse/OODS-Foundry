/** Types for recipe.mjs (shipped as @oods/tokens/recipe): a brand recipe and the brand it gives. */
export interface Oklch { l: number; c: number; h: number }
export type Mode = 'light' | 'dark';
export type StatusFamily = 'info' | 'success' | 'warning' | 'critical' | 'archive';

export interface BrandRecipe {
  /** The neutral's hue in degrees. */
  neutralHue: number;
  /** The neutral's tint, 0 (grey) to 0.03. */
  neutralChroma: number;
  /** The accent's hue in degrees (links, focus, selection; the primary action when primary is "accent"). */
  accentHue: number;
  /** Which scale the primary action takes. */
  primary: 'neutral' | 'accent';
  /** The control corner radius in px (0 to 16); small, large, card and pill follow from it. */
  radius: number;
  /** The sans family, e.g. "Geist". */
  font: string;
  /** The mono family; default "Geist Mono". */
  fontMono?: string;
  /** Status hues; each defaults to Radix Colors' blue, green, amber, red, and a muted purple for archive. */
  status?: Partial<Record<StatusFamily, { hue: number; chroma?: number }>>;
}

export interface RoleAdjustment {
  role: string; from: string; to: string; fromHex: string; toHex: string;
  /** Chart series (s222-m02): which chart grading moved it (3:1 on the canvas, or CIEDE2000 from the other series). */
  reason?: string;
}

export declare const STEPS: 12;
export declare const MODES: readonly Mode[];
export declare const SHIPPED_FONTS: readonly string[];
export declare const RECIPE_FIELDS: Readonly<Record<string, string>>;
export declare const DEFAULT_STATUS: Readonly<Record<StatusFamily, { hue: number; chroma: number }>>;
export declare const NEUTRAL_LIGHTNESS: Readonly<Record<Mode, readonly number[]>>;
export declare const NEUTRAL_CHROMA: Readonly<Record<Mode, readonly number[]>>;

export declare function inSrgb(color: Oklch): boolean;
export declare function gamut(l: number, c: number, h: number): Oklch;
export declare function css(color: Oklch): string;
export declare function hex(color: Oklch): string;
export declare function contrast(a: Oklch, b: Oklch): number;
export declare function mix(a: Oklch, b: Oklch, t: number): Oklch;
export declare function hueScale(hue: number, mode: Mode, chroma?: number): Oklch[];
export declare function neutralScale(hue: number, chroma: number, mode: Mode): Oklch[];
/** Every problem with a recipe as [field, message]; empty when it can be built. */
export declare function recipeProblems(recipe: unknown): Array<[string, string]>;
export declare function brandColorRoles(recipe: BrandRecipe, mode: Mode): {
  roles: Record<string, Oklch>;
  themeOnly: Record<string, Oklch>;
  adjustments: RoleAdjustment[];
  scales: Record<string, Oklch[]>;
};
export declare function brandRadius(recipe: BrandRecipe): { control: number; small: number; large: number; card: number; pill: number };
export declare function brandFont(recipe: BrandRecipe): { sans: string; mono: string };
export declare function hcColor(role: string): string;
/** s222-m02: the chart palette rules (see recipe.mjs, "chart palettes"). */
export declare const CATEGORICAL_OFFSETS: readonly number[];
export declare const SEQUENTIAL_LIGHTNESS: Readonly<Record<Mode, readonly number[]>>;
export declare const DIVERGING_LIGHTNESS: Readonly<Record<Mode, { neutral: number; steps: readonly number[] }>>;
export declare function deltaE2000(a: readonly [number, number, number], b: readonly [number, number, number]): number;
/** Certify's role-A distance between two colours: CIEDE2000, the smallest over normal vision and three dichromacies. */
export declare function distinctness(a: Oklch, b: Oklch): number;
/** One theme's chart colours, keyed by their path under `viz` (OKLCH, or a system colour in hc), with the grading's moves. */
export declare function vizPalette(recipe: BrandRecipe, mode: Mode | 'hc'): {
  tokens: Record<string, Oklch | string>;
  adjustments: RoleAdjustment[];
  /** The smallest role-A distance between two series; null in hc. */
  distinctness: number | null;
};
/** One theme's chart tokens as the DTCG tree a brand file holds under `viz`. */
export declare function vizTree(recipe: BrandRecipe, theme: 'base' | Mode | 'hc'): Record<string, unknown>;
/** The three brand files for a recipe, as the brands folder holds them: colour roles, radius and font, and chart colours. */
export declare function brandDocuments(
  id: string,
  recipe: BrandRecipe,
): { documents: Record<'base' | 'dark' | 'hc', Record<string, unknown>>; report: { adjustments: Record<Mode, RoleAdjustment[]> } };
export declare function explain(recipe: BrandRecipe): Record<Mode, RoleAdjustment[]>;
