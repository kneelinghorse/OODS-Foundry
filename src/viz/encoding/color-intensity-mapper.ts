import tokensBundle from '@oods/tokens';
import { getVizScaleTokens } from '../tokens/scale-token-mapper.js';

const CSS_VARIABLE_MAP: Record<string, string> = (tokensBundle?.cssVariables as Record<string, string>) ?? {};

export interface ColorIntensityMapperOptions {
  readonly stops?: number;
  readonly min?: number;
  readonly max?: number;
  readonly reverse?: boolean;
}

export interface ColorIntensityMapper {
  readonly tokens: readonly string[];
  readonly min: number;
  readonly max: number;
  mapToCss(value: number | null | undefined): string | undefined;
  normalize(value: number | null | undefined): number | undefined;
  gradient(direction?: 'horizontal' | 'vertical'): string;
  cssColors(): readonly string[];
  resolvedColors(): readonly string[];
}

const DEFAULT_STOP_COUNT = 7;

export function createColorIntensityMapper(options: ColorIntensityMapperOptions = {}): ColorIntensityMapper {
  const stops = clampCount(options.stops ?? DEFAULT_STOP_COUNT);
  const tokens = getVizScaleTokens('sequential', { count: stops, reverse: options.reverse }).slice();
  const normalizedTokens = tokens.length > 0 ? tokens : ['--viz-scale-sequential-05'];

  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  let max = Number.isFinite(options.max) ? Number(options.max) : min + 1;
  if (max <= min) {
    max = min + 1;
  }

  const cssColors = normalizedTokens.map((token) => buildCssVarReference(token));

  return {
    tokens: normalizedTokens,
    min,
    max,
    mapToCss(value) {
      const normalized = normalizeValue(value, min, max);
      if (normalized === undefined) {
        return undefined;
      }
      const index = Math.min(cssColors.length - 1, Math.max(0, Math.floor(normalized * cssColors.length)));
      return cssColors[index];
    },
    normalize(value) {
      return normalizeValue(value, min, max);
    },
    gradient(direction = 'horizontal') {
      const stopsDefinition = cssColors.map((color, index) => {
        if (cssColors.length === 1) {
          return `${color} 0%`;
        }
        const percent = (index / (cssColors.length - 1)) * 100;
        return `${color} ${percent.toFixed(2)}%`;
      });
      const axis = direction === 'vertical' ? 'to top' : 'to right';
      return `linear-gradient(${axis}, ${stopsDefinition.join(', ')})`;
    },
    cssColors() {
      return [...cssColors];
    },
    resolvedColors() {
      return normalizedTokens.map((token) => resolveColorValue(token) ?? buildCssVarReference(token));
    },
  };
}

function clampCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_STOP_COUNT;
  }
  return Math.min(9, Math.max(2, Math.round(value)));
}

function normalizeValue(value: number | null | undefined, min: number, max: number): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) {
    return 0.5;
  }
  const normalized = (numeric - min) / span;
  if (!Number.isFinite(normalized)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, normalized));
}

function buildCssVarReference(token: string): string {
  const normalized = normalizeTokenName(token);
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  const color = lookupTokenValue(normalized) ?? (prefixed ? lookupTokenValue(prefixed) : undefined);
  const converted = color ? formatColorValue(color) : undefined;

  if (prefixed && converted) {
    return `var(${normalized}, var(${prefixed}, ${converted}))`;
  }
  if (prefixed) {
    return `var(${normalized}, var(${prefixed}))`;
  }
  if (converted) {
    return `var(${normalized}, ${converted})`;
  }
  return `var(${normalized})`;
}

function resolveColorValue(token: string): string | undefined {
  const normalized = normalizeTokenName(token);
  const value = lookupTokenValue(normalized);
  if (value) {
    return formatColorValue(value);
  }
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  if (!prefixed) {
    return undefined;
  }
  const fallback = lookupTokenValue(prefixed);
  return fallback ? formatColorValue(fallback) : undefined;
}

function lookupTokenValue(name: string): string | undefined {
  return CSS_VARIABLE_MAP[name];
}

function normalizeTokenName(name: string): string {
  if (!name.startsWith('--')) {
    return `--${name}`;
  }
  return name;
}

function formatColorValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    const converted = convertOklchToRgb(trimmed);
    return converted ?? trimmed;
  }
  return trimmed;
}

function convertOklchToRgb(input: string): string | undefined {
  const parsed = parseOklch(input);
  if (!parsed) {
    return undefined;
  }
  const { l, c, h } = parsed;
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;

  const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
  const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
  const s1 = l - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l1 ** 3;
  const m3 = m1 ** 3;
  const s3 = s1 ** 3;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const r = linearToSrgb(rLinear);
  const g = linearToSrgb(gLinear);
  const blue = linearToSrgb(bLinear);

  const clampChannel = (channel: number): number => Math.round(Math.min(255, Math.max(0, channel * 255)));

  return `rgb(${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(blue)})`;
}

function linearToSrgb(value: number): number {
  if (value <= 0.0) {
    return 0;
  }
  if (value >= 1.0) {
    return 1;
  }
  if (value <= 0.0031308) {
    return 12.92 * value;
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function parseOklch(value: string): { l: number; c: number; h: number } | undefined {
  const match = value
    .replace(/deg/gi, '')
    .replace(/\s+/g, ' ')
    .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);

  if (!match) {
    return undefined;
  }

  const [, lRaw, cRaw, hRaw] = match;
  const l = parseComponent(lRaw, true);
  const c = parseComponent(cRaw, false);
  const h = parseFloat(hRaw);

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
    return undefined;
  }

  return { l, c, h };
}

function parseComponent(value: string, isLightness: boolean): number {
  if (value.endsWith('%') && isLightness) {
    return parseFloat(value.slice(0, -1)) / 100;
  }
  return parseFloat(value);
}

