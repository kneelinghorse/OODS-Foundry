/**
 * Shared colour contrast helpers used by both the CLI reports and UI previews.
 * These utilities mirror the logic from the a11y contrast tooling.
 */

/**
 * Convert a channel value (0-255) to its linear-light representation.
 * @param {number} channel
 * @returns {number}
 */
export function toLinear(channel) {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

/**
 * Parse a hex colour into its RGB components.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const normalised = hex.replace('#', '').trim();
  if (![3, 6].includes(normalised.length)) {
    throw new Error(`Unsupported colour format "${hex}". Expected #rgb or #rrggbb.`);
  }

  const expand = normalised.length === 3
    ? normalised.split('').map((char) => char + char).join('')
    : normalised;

  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    throw new Error(`Unable to parse colour value "${hex}".`);
  }

  return { r, g, b };
}

/**
 * Calculate the relative luminance of a hex colour.
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rLin, gLin, bLin] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Return the WCAG contrast ratio between two colours.
 * @param {string} foregroundHex
 * @param {string} backgroundHex
 * @returns {number}
 */
export function contrastRatio(foregroundHex, backgroundHex) {
  const fgL = relativeLuminance(foregroundHex);
  const bgL = relativeLuminance(backgroundHex);
  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Defensive guard that verifies a string is a valid hex colour.
 * @param {string} value
 * @returns {boolean}
 */
export function isHexColor(value) {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value).trim());
}
