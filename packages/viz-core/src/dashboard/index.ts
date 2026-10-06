// Headless dashboard primitives (sprint-113). Pure, deterministic, renderer-
// agnostic helpers that operate over the DashboardSpec IR (spec/dashboard-spec).
// One-feature-per-barrel, mirroring adapters/spatial.

// Deterministic auto-layout resolver (m02): panels[] -> abstract grid placements.
export * from './auto-layout.js';

// KPI primitive (m03): rows -> renderer-agnostic {value,delta,deltaPct,trend,...}.
export * from './kpi.js';

// Cross-filter linking primitives (m03 resolver; m04 reducer).
export * from './links/index.js';
