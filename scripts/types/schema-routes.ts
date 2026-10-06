/**
 * Per-schema output routing — the single source of truth shared by the generator
 * (scripts/types/generate.ts) AND the drift guard
 * (tests/contracts/schema-types.contract.test.ts), so what is GENERATED and what is
 * VERIFIED can never diverge.
 *
 * #681 retarget (sprint-112 m04 / sprint-113 m01): the viz IR is the LIVE source of
 * truth for @oods/viz-core, so its generated type is emitted DIRECTLY into the
 * package (no repo-root generated/types duplicate / vendored copy that drifts). The
 * other viz data-contract schemas are hand-authored in viz-core (spec/network-flow.ts,
 * spec/spatial.ts) and their generated forms had ZERO importers — so they are SKIPPED.
 * A routed file is NOT a generated/types barrel member. Everything not listed here
 * emits to the default generated/types/ tree, unchanged. `--check` still covers routed
 * files so the headless IR can't silently drift.
 *
 * This module MUST stay side-effect-free (pure exports) so the contract test can import
 * the routing table without triggering a generation run.
 */

export type SchemaRoute = { readonly outFile: string; readonly banner: string } | 'skip';

export const VIZ_CORE_IR_BANNER =
  '// GENERATED into @oods/viz-core by scripts/types/generate.ts (generate:schema-types),\n' +
  '// from schemas/viz/normalized-viz-spec.schema.json. #681 retarget (sprint-112 m04):\n' +
  '// this file IS the live source of truth — do NOT edit by hand. Change the schema and\n' +
  '// re-run `pnpm generate:schema-types`; CI runs it with --check to catch drift.\n';

export const DASHBOARD_SPEC_BANNER =
  '// GENERATED into @oods/viz-core by scripts/types/generate.ts (generate:schema-types),\n' +
  '// from schemas/viz/dashboard-spec.schema.json. #681 retarget (sprint-113 m01): this\n' +
  '// file IS the live source of truth — do NOT edit by hand. Change the schema and\n' +
  '// re-run `pnpm generate:schema-types`; CI runs it with --check to catch drift.\n';

export const SCHEMA_ROUTES: Record<string, SchemaRoute> = {
  'viz/normalized-viz-spec.schema.json': {
    outFile: 'packages/viz-core/src/spec/normalized-viz-spec.types.ts',
    banner: VIZ_CORE_IR_BANNER,
  },
  'viz/dashboard-spec.schema.json': {
    outFile: 'packages/viz-core/src/spec/dashboard.types.ts',
    banner: DASHBOARD_SPEC_BANNER,
  },
  'viz/force-output.schema.json': 'skip',
  'viz/hierarchy-input.schema.json': 'skip',
  'viz/network-input.schema.json': 'skip',
  'viz/sankey-input.schema.json': 'skip',
  'viz/sankey-output.schema.json': 'skip',
  'viz/spatial-spec.schema.json': 'skip',
  'viz/sunburst-output.schema.json': 'skip',
  'viz/treemap-output.schema.json': 'skip',
};
