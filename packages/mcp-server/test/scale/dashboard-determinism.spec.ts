import { describe, expect, it } from 'vitest';
import type { DashboardRenderInput, DashboardRenderOutput } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/dashboard.render.js';
import { synthesizeDashboardSpec, type VizScaleTier } from './viz-synth.js';

// Dashboard scale-determinism gate (sprint-113 m06). A seeded synthetic
// metric-overview dashboard at 100/500/1000 rows: same (tier, seed) -> a
// byte-identical composed payload (the determinism moat at scale); a different
// seed -> a divergent payload (the tripwire — proving the gate actually
// discriminates). The specRef trio is per-call-unique, so it is redacted before
// comparison. Runs under the opt-in `test:scale` lane (60s budget per case; the
// 4-panel synth keeps each render well within it).

const TIERS: readonly VizScaleTier[] = [100, 500, 1000];

function render(tier: VizScaleTier, seed: number): Promise<DashboardRenderOutput> {
  return handle(synthesizeDashboardSpec({ tier, seed }) as unknown as DashboardRenderInput);
}

function payload(out: DashboardRenderOutput): string {
  const { specRef: _r, specRefCreatedAt: _c, specRefExpiresAt: _e, ...rest } = out;
  return JSON.stringify(rest);
}

describe('dashboard.render scale determinism', () => {
  for (const tier of TIERS) {
    it(`tier ${tier}: same seed -> byte-identical composed dashboard`, async () => {
      const a = payload(await render(tier, 42));
      const b = payload(await render(tier, 42));
      expect(a).toBe(b);
    });

    it(`tier ${tier}: different seed -> divergent composed dashboard (tripwire)`, async () => {
      const a = payload(await render(tier, 1));
      const b = payload(await render(tier, 2));
      expect(a).not.toBe(b);
    });
  }
});
