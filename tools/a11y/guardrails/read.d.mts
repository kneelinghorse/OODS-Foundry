export const PALETTE_CHECK_TYPES: readonly ['ramp-monotonicity', 'family-hue', 'neutral-hue', 'chroma-curve', 'gamut', 'dark-coverage'];
export interface GuardrailSpec {
  checkType: (typeof PALETTE_CHECK_TYPES)[number] | 'relative-color';
  source: string | null;
  target: string | null;
  id: string;
  usage: string;
  theme: string;
  state: string;
  baseToken: string;
  derivedToken: string;
  deltaLMin: number | null;
  deltaLMax: number | null;
  deltaCMin: number | null;
  deltaCMax: number | null;
  deltaHMax: number | null;
  contrastForeground: string | null;
  contrastBackground: string | null;
  contrastThreshold: number | null;
}

export function loadGuardrails(filePath: string): Promise<GuardrailSpec[]>;
