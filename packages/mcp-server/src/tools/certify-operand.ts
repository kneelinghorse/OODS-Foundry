// artifact.certify's OPERAND path (sprint-172 m01).
//
// certify's input has been {spec} only since s136, and an ECharts-primary
// NormalizedVizSpec is METADATA-ONLY by ratified design (data:{values:[]},
// encoding:{}) — the chart's nodes/links/rows/geometry live in viz.render's data
// branch and never enter the IR. That is WHY pillars.determinism and pillars.accuracy
// read 'unchecked' for the 8 ECharts-primary types: not because nothing is checkable,
// but because certify could not see the operand. s172 adds the optional `data` input,
// and this module is the seam that resolves it.
//
// It resolves and VALIDATES, it never grades. Every rejection reuses the render path's
// own validator so certify refuses exactly what viz.render refuses, with the same code
// and the same message:
//   - sankey     -> validateSankeyInput (viz-core, importable today) -> OODS-V126
//   - chord      -> danglingLinkError (the lifted F4 V147 check)     -> OODS-V147
//   - network    -> danglingLinkError (force_graph keying)           -> OODS-V147
//   - geo        -> the lifted renderGeoOption guards (GeoInputError)-> OODS-V126
//   - hierarchy  -> no standalone validator exists on the render path either; the
//                   adapter is the validator, so certify surfaces its throw when it
//                   re-emits (s172 m02). Stated, not silently skipped.
// V148-class duplicate-link WARNs are deliberately NOT replayed: certify has no warnings
// channel, sankey duplicates become certify's own V158 accuracy rule (m03), and
// chord/force_graph duplicates stay render-side warnings.

import { validateSankeyInput, type SankeyInput } from '@oods/viz-core';
import {
  ECHARTS_PRIMARY,
  echartsPrimaryTypeForMarkTrait,
  type EChartsPrimaryType,
} from './echarts-primary.js';
import { danglingLinkError } from './echarts-link-integrity.js';

/** The five data branches, mirroring viz.render's (and certify's mirrored input schema). */
export interface CertifyDataBranch {
  readonly hierarchy?: unknown;
  readonly sankey?: unknown;
  readonly chord?: unknown;
  readonly network?: unknown;
  readonly geo?: unknown;
}

export type CertifyOperandBranchName = keyof CertifyDataBranch;

const BRANCH_NAMES: readonly CertifyOperandBranchName[] = ['hierarchy', 'sankey', 'chord', 'network', 'geo'];

export interface CertifyOperandError {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export interface CertifyOperandResolved {
  readonly ok: true;
  readonly chartType: EChartsPrimaryType;
  readonly branch: CertifyOperandBranchName;
  readonly branchData: unknown;
}

export type CertifyOperandResult = CertifyOperandResolved | CertifyOperandError;

const fail = (code: string, message: string): CertifyOperandError => ({ ok: false, code, message });

/** The branch keys actually present on a supplied `data` object. */
function presentBranches(data: CertifyDataBranch): CertifyOperandBranchName[] {
  return BRANCH_NAMES.filter((name) => data[name] !== undefined);
}

/**
 * Resolve `input.data` against the IR's mark trait.
 *
 * `trait` is the ALIAS-NORMALIZED trait certify routes on. A cartesian or unmodeled trait
 * with data supplied is a structured error — those paths compile from the IR itself, so
 * the operand would be dead input (the s169 no-dead-affordance principle, applied in the
 * one direction where it does hold).
 */
export function resolveCertifyOperand(
  trait: string | undefined,
  data: CertifyDataBranch,
): CertifyOperandResult {
  const present = presentBranches(data);
  if (present.length === 0) {
    return fail(
      'OODS-V123',
      "`data` was supplied with no branch. Supply exactly one of 'hierarchy', 'sankey', 'chord', 'network' or 'geo' — the branch the spec's mark trait requires — or omit `data` entirely.",
    );
  }
  if (present.length > 1) {
    return fail(
      'OODS-V123',
      `\`data\` carries ${present.length} branches (${present.join(', ')}). Exactly one branch is allowed — a chart has one operand.`,
    );
  }
  const branch = present[0];

  const chartType = trait ? echartsPrimaryTypeForMarkTrait(trait) : undefined;
  if (!chartType) {
    return fail(
      'OODS-V123',
      `\`data\` is only accepted for the 8 ECharts-primary mark traits (MarkTreemap, MarkSunburst, MarkSankey, MarkGraph, MarkChord, MarkChoropleth, MarkBubble, MarkFlow); the spec's mark trait is ${trait ?? '(no mark trait)'}. A cartesian or unmodeled spec is certified from the IR alone, so a data branch would be dead input — remove it.`,
    );
  }

  const expected = ECHARTS_PRIMARY[chartType].dataBranch;
  if (branch !== expected) {
    return fail(
      'OODS-V123',
      `Mark trait ${trait} renders as chartType "${chartType}", which requires the "${expected}" data branch; "${branch}" was supplied. Each ECharts-primary type is coupled to exactly one branch.`,
    );
  }

  const branchData = data[branch];
  const invalid = validateBranchData(chartType, branchData);
  if (invalid) {
    return invalid;
  }
  return { ok: true, chartType, branch, branchData };
}

/**
 * Per-type branch-content validation, delegated to the render path's own validators.
 * Returns undefined when the operand is acceptable.
 */
function validateBranchData(
  chartType: EChartsPrimaryType,
  branchData: unknown,
): CertifyOperandError | undefined {
  if (chartType === 'sankey') {
    try {
      validateSankeyInput(branchData as SankeyInput);
    } catch (err) {
      return fail('OODS-V126', err instanceof Error ? err.message : String(err));
    }
    return undefined;
  }

  if (chartType === 'chord' || chartType === 'force_graph') {
    const dangling = danglingLinkError(chartType, branchData);
    return dangling ? fail(dangling.code, dangling.message) : undefined;
  }

  // geo (choropleth/bubble_map/flow_map) and hierarchy (treemap/sunburst): the render
  // path has NO standalone validator for either — the geo guards live inside the shared
  // builder and the hierarchy adapters validate as they build. So certify validates them
  // the same way the render path does: by building. That happens ONCE, in m02's re-emit
  // (certify-echarts-emit.ts), whose throw partition is viz.render's own — GeoInputError
  // -> OODS-V126, EChartsAdapterError -> OODS-V128. Nothing is re-typed here.
  return undefined;
}
