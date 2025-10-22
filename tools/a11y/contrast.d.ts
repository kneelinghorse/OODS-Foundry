export function toLinear(channel: number): number;
export function hexToRgb(hex: string): { r: number; g: number; b: number };
export function relativeLuminance(hex: string): number;
export function contrastRatio(foregroundHex: string, backgroundHex: string): number;
export function isHexColor(value: string): boolean;
