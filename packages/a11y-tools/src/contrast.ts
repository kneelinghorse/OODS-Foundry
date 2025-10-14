/**
 * Convert a channel value (0-255) to linear light.
 */
export function toLinear(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

/**
 * Parse a hex colour into RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalised = hex.replace('#', '').trim();
  if (![3, 6].includes(normalised.length)) {
    throw new Error(`Unsupported colour format "${hex}". Expected #rgb or #rrggbb.`);
  }

  const expanded =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised;

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    throw new Error(`Unable to parse colour value "${hex}".`);
  }

  return { r, g, b };
}

/**
 * Calculate the relative luminance of a hex colour.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rLin, gLin, bLin] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Compute the WCAG contrast ratio between two hex colours.
 */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fgL = relativeLuminance(foregroundHex);
  const bgL = relativeLuminance(backgroundHex);
  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Guard that verifies a value is a hex colour literal.
 */
export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value).trim());
}
