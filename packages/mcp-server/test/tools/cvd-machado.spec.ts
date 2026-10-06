import { describe, expect, it } from 'vitest';
import { CVD_TYPES, MACHADO_2009_SEVERITY_100, simulateCvd } from '../../src/tools/cvd-machado.js';

// Machado-Oliveira-Fernandes (2009) CVD simulation — the ONLY new color-science code
// in the s137 contrast pillar. These tests pin (a) the published severity-1.0 matrix
// constants (version-independent "published reference values") and (b) the
// deterministic simulate output, so the min-over-CVD categorical distinguishability
// check stays reproducible.

describe('cvd-machado — published reference matrices (severity 100)', () => {
  // Verbatim Machado et al. 2009 severity=1.0 3x3 transforms (the paper's precomputed
  // table; identical to cols4all/colorspacious). A drift here silently changes every
  // role-A verdict, so it is asserted exactly.
  it('protan matrix equals the published severity-1.0 values', () => {
    expect(MACHADO_2009_SEVERITY_100.protan).toEqual([
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ]);
  });

  it('deuteran matrix equals the published severity-1.0 values', () => {
    expect(MACHADO_2009_SEVERITY_100.deuteran).toEqual([
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.011820, 0.042940, 0.968881],
    ]);
  });

  it('tritan matrix equals the published severity-1.0 values', () => {
    expect(MACHADO_2009_SEVERITY_100.tritan).toEqual([
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.303900],
    ]);
  });

  it('folds exactly the three dichromacies into the CVD check', () => {
    expect(CVD_TYPES).toEqual(['deuteran', 'protan', 'tritan']);
  });
});

describe('cvd-machado — simulateCvd behaviour', () => {
  it('preserves the achromatic axis (white/black map to themselves under every CVD)', () => {
    for (const type of CVD_TYPES) {
      expect(simulateCvd('#FFFFFF', type)).toBe('#FFFFFF');
      expect(simulateCvd('#000000', type)).toBe('#000000');
    }
  });

  it('confuses red along the red-green axis for protan/deuteran (desaturates toward olive), less for tritan', () => {
    // Pinned outputs (linear-RGB application) — the deterministic regression baseline.
    expect(simulateCvd('#FF0000', 'protan')).toBe('#6D5F00');
    expect(simulateCvd('#FF0000', 'deuteran')).toBe('#A39000');
    // Tritan (blue-yellow) barely shifts pure red — it stays red-dominant.
    expect(simulateCvd('#FF0000', 'tritan')).toBe('#FF000F');
  });

  it('is a pure deterministic function of the input (same in -> same out)', () => {
    expect(simulateCvd('#3668D8', 'deuteran')).toBe(simulateCvd('#3668D8', 'deuteran'));
    expect(simulateCvd('#279669', 'protan')).toBe(simulateCvd('#279669', 'protan'));
  });

  it('accepts shorthand #rgb hex', () => {
    expect(simulateCvd('#FFF', 'protan')).toBe('#FFFFFF');
    expect(simulateCvd('#000', 'tritan')).toBe('#000000');
  });
});
