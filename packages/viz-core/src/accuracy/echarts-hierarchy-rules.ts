// Sprint-172 m03 — the treemap/sunburst accuracy rules: OODS-V154 and OODS-V155.
//
// Both read the `hierarchy` data branch, which is the only place the values exist: the IR
// for these types is metadata-only.

import type { HierarchyInput } from '../spec/network-flow.js';
import { isAdjacencyList } from '../adapters/echarts/hierarchy-utils.js';
import type { AccuracyRuleOutcome } from './types.js';
import { differsBeyondTolerance, type EChartsAccuracyOperand } from './echarts-types.js';

/** One node flattened out of either hierarchy shape, with its children resolved. */
interface FlatNode {
  readonly label: string;
  readonly value: unknown;
  readonly children: readonly FlatNode[];
}

/**
 * Flatten either hierarchy shape into the same node view. Deliberately NOT
 * convertToEChartsTreeData: that helper substitutes `name ?? id ?? 'node'` and defaults
 * children to [], which is right for emission and wrong for a rule that must distinguish
 * "no explicit value" from "value 0". This reads the AUTHORED branch.
 */
function flatten(input: HierarchyInput): FlatNode[] {
  if (isAdjacencyList(input)) {
    const rows = input.data ?? [];
    const byId = new Map<string, { row: Record<string, unknown>; children: FlatNode[] }>();
    for (const row of rows as unknown as Array<Record<string, unknown>>) {
      byId.set(String(row.id), { row, children: [] });
    }
    const all: FlatNode[] = [];
    // Build children first so each FlatNode carries a live array, then materialise.
    const nodes = new Map<string, FlatNode>();
    for (const [id, entry] of byId) {
      const node: FlatNode = {
        label: String(entry.row.name ?? id),
        value: entry.row.value,
        children: entry.children,
      };
      nodes.set(id, node);
      all.push(node);
    }
    for (const [id, entry] of byId) {
      const parentId = entry.row.parentId;
      if (parentId === null || parentId === undefined) {
        continue;
      }
      const parent = byId.get(String(parentId));
      const self = nodes.get(id);
      if (parent && self) {
        parent.children.push(self);
      }
    }
    return all;
  }

  const roots = Array.isArray(input.data) ? input.data : [input.data];
  const all: FlatNode[] = [];
  const walk = (raw: unknown): FlatNode => {
    const node = (raw ?? {}) as Record<string, unknown>;
    const kids = Array.isArray(node.children) ? node.children.map(walk) : [];
    const flat: FlatNode = { label: String(node.name ?? 'node'), value: node.value, children: kids };
    all.push(flat);
    return flat;
  };
  for (const root of roots) {
    walk(root);
  }
  return all;
}

/** A node's value if it is an authored number (finite or not); undefined when unauthored. */
function authoredNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * OODS-V154 — a treemap/sunburst node value that AREA CANNOT ENCODE.
 *
 * These adapters pass the authored value straight through into the option
 * (hierarchy-utils.ts's converters copy `value` verbatim). A treemap tile's area and a
 * sunburst arc's angle are magnitudes: there is no negative area and no NaN angle. ECharts
 * does not reject them — it draws something, and whatever it draws does not mean what the
 * number says. Non-finite and negative are the two ways to get there.
 */
export function evaluateHierarchyNegativeValue(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const nodes = flatten(operand.branchData as HierarchyInput);
  if (nodes.length === 0) {
    return { evaluated: false, note: 'The hierarchy branch carries no nodes, so node values could not be checked.' };
  }
  const bad: string[] = [];
  for (const node of nodes) {
    if (node.value === undefined || node.value === null) {
      continue;
    }
    const numeric = authoredNumber(node.value);
    if (numeric === undefined || !Number.isFinite(numeric) || numeric < 0) {
      bad.push(`${node.label} (${String(node.value)})`);
    }
  }
  if (bad.length === 0) {
    return { evaluated: true };
  }
  return {
    evaluated: true,
    message: `${bad.length} ${operand.chartType} node value(s) cannot be encoded as area or angle: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? `, +${bad.length - 3} more` : ''}. A negative or non-finite value is passed through to the option unchanged, so the tile or arc drawn for it does not represent the number.`,
  };
}

/**
 * OODS-V155 — an EXPLICIT parent value that is not the sum of its children.
 *
 * Scoped tightly on purpose. It fires only where the author supplied a parent value AND
 * every child of that parent carries an explicit finite value, because only then is the
 * intended sum knowable. A parent with no value of its own is computed by the renderer and
 * cannot disagree with itself; a parent with partly-valueless children has no computable
 * sum and is reported unevaluated rather than guessed at.
 *
 * The comparison uses the chartered RELATIVE epsilon: a parent of 0.3 over children 0.1
 * and 0.2 is correct data that exact equality would flag.
 */
export function evaluateHierarchyNonAdditiveParent(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const nodes = flatten(operand.branchData as HierarchyInput);
  const offenders: string[] = [];
  let comparable = 0;
  let skippedForMissingChildValues = 0;

  for (const node of nodes) {
    if (node.children.length === 0) {
      continue;
    }
    const parentValue = authoredNumber(node.value);
    if (parentValue === undefined || !Number.isFinite(parentValue)) {
      continue;
    }
    const childValues = node.children.map((child) => authoredNumber(child.value));
    if (childValues.some((value) => value === undefined || !Number.isFinite(value))) {
      skippedForMissingChildValues += 1;
      continue;
    }
    comparable += 1;
    const sum = (childValues as number[]).reduce((total, value) => total + value, 0);
    if (differsBeyondTolerance(parentValue, sum)) {
      offenders.push(`${node.label} (declared ${parentValue}, children sum to ${sum})`);
    }
  }

  if (comparable === 0) {
    return {
      evaluated: false,
      note:
        skippedForMissingChildValues > 0
          ? `No parent in the hierarchy carries an explicit value alongside fully-valued children (${skippedForMissingChildValues} parent(s) had at least one child with no value), so parent/child additivity could not be checked.`
          : 'No parent in the hierarchy carries an explicit value, so parent/child additivity could not be checked (renderer-computed parents cannot disagree with their children).',
    };
  }
  if (offenders.length === 0) {
    return { evaluated: true };
  }
  return {
    evaluated: true,
    message: `${offenders.length} explicit parent value(s) do not equal the sum of their children: ${offenders.slice(0, 3).join('; ')}${offenders.length > 3 ? `; +${offenders.length - 3} more` : ''}. The parent's tile or arc is sized by the declared value while its children tile the space beneath it, so the part-of-whole relationship the chart shows is not the one in the data.`,
  };
}
