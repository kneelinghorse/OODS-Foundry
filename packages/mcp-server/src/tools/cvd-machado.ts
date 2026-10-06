// Machado-Oliveira-Fernandes (2009) color-vision-deficiency simulation.
//
// s137 m02: the ONLY new color-science code the contrast pillar needs — every other
// primitive it uses (WCAG contrastRatio, rgb->hex normaliseColor, CIEDE2000) is
// reused from @oods/a11y-tools + colorjs.io. certify's role-A categorical
// distinguishability check folds CVD in by simulating each palette color under the
// three dichromacies and taking the worst-case CIEDE2000 (min-over-CVD), so a
// palette that separates only for trichromats does NOT pass.
//
// The matrices are the published Machado-2009 severity=1.0 (100%) 3x3 transforms
// (the paper's precomputed table; the same values shipped by cols4all /
// colorspacious). They are applied in LINEAR-sRGB space — the paper's working space,
// per the DaltonLens convention: sRGB -> linear -> matrix -> linear -> sRGB. The
// fixed matrices + pinned severity make the simulation a pure, deterministic
// function of the input color (no Date/random) — a hard requirement for certify.

export type CvdType = 'deuteran' | 'protan' | 'tritan';

type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/**
 * Machado et al. 2009 CVD simulation matrices at severity 1.0 (full dichromacy),
 * row-major, operating on LINEAR-sRGB column vectors. These exact entries are the
 * "published reference values" unit-tested in cvd-machado.spec.ts.
 */
export const MACHADO_2009_SEVERITY_100: Record<CvdType, Matrix3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteran: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

/** The three dichromacies folded into the min-over-CVD distinguishability check. */
export const CVD_TYPES: readonly CvdType[] = ['deuteran', 'protan', 'tritan'];

function srgbChannelToLinear(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb8(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, srgb)) * 255);
}

function hexToRgb8(hex: string): [number, number, number] {
  const n = hex.replace('#', '').trim();
  const full = n.length === 3 ? n.split('').map((ch) => ch + ch).join('') : n;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgb8ToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Simulate how a #rgb / #rrggbb color appears under the given color-vision
 * deficiency (severity 100). Pure + deterministic.
 */
export function simulateCvd(hex: string, type: CvdType): string {
  const [r8, g8, b8] = hexToRgb8(hex);
  const [r, g, b] = [srgbChannelToLinear(r8), srgbChannelToLinear(g8), srgbChannelToLinear(b8)];
  const m = MACHADO_2009_SEVERITY_100[type];
  const nr = m[0][0] * r + m[0][1] * g + m[0][2] * b;
  const ng = m[1][0] * r + m[1][1] * g + m[1][2] * b;
  const nb = m[2][0] * r + m[2][1] * g + m[2][2] * b;
  return rgb8ToHex(linearChannelToSrgb8(nr), linearChannelToSrgb8(ng), linearChannelToSrgb8(nb));
}
