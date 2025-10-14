import Color from 'colorjs.io';
import { isHexColor } from './contrast.js';

export function normaliseColor(value: unknown, tokenKey: string): string {
  const raw = String(value ?? '').trim();

  if (raw.length === 0) {
    throw new Error(`Token "${tokenKey}" does not contain a colour value.`);
  }

  if (isHexColor(raw)) {
    return raw.toUpperCase();
  }

  try {
    const colour = new Color(raw);
    return colour
      .to('srgb')
      .toString({ format: 'hex', collapse: false })
      .toUpperCase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to convert "${raw}" from "${tokenKey}" to hex: ${message}`);
  }
}
