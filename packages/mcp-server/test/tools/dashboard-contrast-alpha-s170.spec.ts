import { describe, expect, it } from 'vitest';
import {
  CONTRAST_PAIRS,
  resolveBrandTokens,
  scanBrandContrast,
} from '../../src/tools/dashboard.render.html.js';

// ============================================================================
// s170 m04 — a TRANSLUCENT colour is not gradable, and must not be graded as opaque.
//
// `toGradableHex` accepted `rgba(r, g, b, a)` and threw the alpha away, returning the opaque
// hex. The scan then reported a contrast ratio for a colour nobody ever sees: what renders is
// the composite of that colour over whatever sits behind it, which this function cannot see.
// A ratio computed from the wrong colour is worse than no ratio, because it is indistinguishable
// from a real measurement — the same class of defect as the inert scan s169 m04 fixed in this
// exact function, one layer down.
//
// This spec lives in test/tools/ (NOT colocated under src/tools/) deliberately: the mcp-server
// vitest config includes `src/**/*.test.ts`, but the ROOT `core` project includes only
// `packages/mcp-server/test/**`. A colocated guard would run in one suite and be invisible to
// the other; here it runs in both.
// ============================================================================

const PAIR = CONTRAST_PAIRS[0];

/** A palette whose two colours would grade as a clean PASS if their alpha were ignored. */
function palette(fg: string, bg: string): Record<string, string> {
  return { [PAIR.fg]: fg, [PAIR.bg]: bg };
}

describe('s170 m04 — toGradableHex skips translucent colours', () => {
  it('an opaque rgb() pair is still graded (the guard did not disable the scan)', () => {
    const result = scanBrandContrast(palette('rgb(0, 0, 0)', 'rgb(255, 255, 255)'));
    expect(result.graded).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('rgba() with alpha 1 is opaque and IS graded — the guard keys on the value, not the syntax', () => {
    const result = scanBrandContrast(palette('rgba(0, 0, 0, 1)', 'rgba(255, 255, 255, 1)'));
    expect(result.graded).toBe(1);
  });

  it('RED: a translucent foreground is SKIPPED, not graded as if it were opaque', () => {
    // Black at 10% over white renders as a pale grey — nowhere near the 21:1 that the opaque
    // hex would score. Pre-fix this pair graded, passed, and reported a ratio the user would
    // never experience.
    const result = scanBrandContrast(palette('rgba(0, 0, 0, 0.1)', 'rgb(255, 255, 255)'));
    expect(result.graded).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('a translucent BACKGROUND is skipped too (both sides of the pair are checked)', () => {
    const result = scanBrandContrast(palette('rgb(0, 0, 0)', 'rgba(255, 255, 255, 0.4)'));
    expect(result.graded).toBe(0);
  });

  it('the skip is VISIBLE — a skipped pair lowers `graded`, it does not silently pass', () => {
    // The honesty contract this function already carries: a scan that measured nothing must not
    // look like a scan that passed. Two pairs offered, one translucent → graded reports 1.
    const two = {
      [PAIR.fg]: 'rgba(0, 0, 0, 0.25)',
      [PAIR.bg]: 'rgb(255, 255, 255)',
      [CONTRAST_PAIRS[1].fg]: 'rgb(0, 0, 0)',
      [CONTRAST_PAIRS[1].bg]: 'rgb(255, 255, 255)',
    };
    expect(scanBrandContrast(two).graded).toBe(1);
  });

  it('a translucent pair that WOULD fail opaque is skipped rather than reported as a finding', () => {
    // Direction check: the guard is not a way to launder a failure into a pass — it removes the
    // pair from the measured set entirely, which `graded` discloses.
    const result = scanBrandContrast(palette('rgba(200, 200, 200, 0.5)', 'rgb(255, 255, 255)'));
    expect(result.findings).toEqual([]);
    expect(result.graded).toBe(0);
  });

  it('NO GOLDEN MOVEMENT: every committed brand pair token is opaque, so both brands still grade 4', () => {
    // The whole reason this fix is safe: not one of the six pair tokens in either brand is
    // translucent today. If a future token gains an alpha, THIS assertion is what will catch it
    // — the count moving is the signal, and it must be a decision, not a surprise.
    for (const brand of ['A', 'B'] as const) {
      const result = scanBrandContrast(resolveBrandTokens(brand));
      expect(result.graded, `brand ${brand}`).toBe(CONTRAST_PAIRS.length);
    }
  });
});
