import type {
  Stage1Capability,
  Stage1CapabilityPresentation,
  Stage1CapabilityRollup,
  Stage1ConfidenceDecomposition,
  Stage1ConfidenceSummary,
  Stage1EvidenceRef,
  Stage1IdentityGraph,
  Stage1IdentityGraphNode,
  Stage1ObjectRollup,
  Stage1RollupObject,
  Stage1RollupProjectionVariant,
} from '../tools/types.js';

export type NormalizedProjectionVariant = {
  id: string;
  surface: string;
  confidence?: number;
  selector?: string;
  object_canonical_id: string;
  object_canonical_label?: string;
  evidence_chain: Stage1EvidenceRef[];
  metadata?: Record<string, unknown>;
  confidence_summary?: Stage1ConfidenceSummary;
};

export type NormalizedPresentation = {
  capability_id: string;
  surface: string;
  label?: string;
  preconditions: unknown[];
  role_hints: string[];
  state_hints: string[];
  member_instances: Stage1EvidenceRef[];
  projection_variants: NormalizedProjectionVariant[];
};

export type NormalizedCapability = {
  canonical_id: string;
  display_label?: string;
  resolution_strategy?: string;
  derived_from_runs: string[];
  minimum_preconditions: unknown[];
  lifecycle_hints: unknown[];
  identity_node?: Stage1IdentityGraphNode;
  presentations: NormalizedPresentation[];
  conflicts: unknown[];
};

export type CapabilityNormalizerInputs = {
  capabilityRollup: Stage1CapabilityRollup;
  objectRollup?: Stage1ObjectRollup;
  identityGraph?: Stage1IdentityGraph;
};

type EvidenceIndexEntry = {
  object: Stage1RollupObject;
  variant: Stage1RollupProjectionVariant;
};

function evidenceKey(ref: Stage1EvidenceRef): string {
  return [ref.artifact_ref ?? '', ref.json_pointer ?? '', ref.run_id ?? ''].join('#');
}

/**
 * v1.6.0 bridges confidence as either a scalar (v1.0.0 / v1.1.0 object_rollup,
 * v1.1.0 capability_rollup / identity_graph candidate_mappings) or a full
 * ConfidenceDecomposition (v1.2.0 rollups). Downstream consumers want a scalar
 * for sorting/filtering, so unwrap `.total` when the decomposition shape is
 * present. Undefined stays undefined.
 */
function unwrapConfidenceTotal(
  value: number | Stage1ConfidenceDecomposition | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof (value as Stage1ConfidenceDecomposition).total === 'number') {
    return (value as Stage1ConfidenceDecomposition).total;
  }
  return undefined;
}

function buildEvidenceIndex(objectRollup?: Stage1ObjectRollup): Map<string, EvidenceIndexEntry[]> {
  const index = new Map<string, EvidenceIndexEntry[]>();
  if (!objectRollup) return index;
  for (const object of objectRollup.objects ?? []) {
    for (const variant of object.projection_variants ?? []) {
      for (const ref of variant.evidence_chain ?? []) {
        const key = evidenceKey(ref);
        const bucket = index.get(key);
        if (bucket) bucket.push({ object, variant });
        else index.set(key, [{ object, variant }]);
      }
    }
  }
  return index;
}

function buildIdentityNodeIndex(identityGraph?: Stage1IdentityGraph): Map<string, Stage1IdentityGraphNode> {
  const index = new Map<string, Stage1IdentityGraphNode>();
  if (!identityGraph) return index;
  for (const node of identityGraph.nodes ?? []) {
    if (node?.canonical_id) index.set(node.canonical_id, node);
  }
  return index;
}

function sortStrings(xs: readonly string[]): string[] {
  return [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function compareVariants(a: NormalizedProjectionVariant, b: NormalizedProjectionVariant): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  if (a.surface !== b.surface) return a.surface < b.surface ? -1 : 1;
  return 0;
}

function comparePresentations(a: NormalizedPresentation, b: NormalizedPresentation): number {
  if (a.surface !== b.surface) return a.surface < b.surface ? -1 : 1;
  const labelA = a.label ?? '';
  const labelB = b.label ?? '';
  if (labelA !== labelB) return labelA < labelB ? -1 : 1;
  return 0;
}

function compareCapabilities(a: NormalizedCapability, b: NormalizedCapability): number {
  return a.canonical_id < b.canonical_id ? -1 : a.canonical_id > b.canonical_id ? 1 : 0;
}

function deriveVariants(
  presentation: Stage1CapabilityPresentation,
  evidenceIndex: Map<string, EvidenceIndexEntry[]>,
): NormalizedProjectionVariant[] {
  const seen = new Set<string>();
  const variants: NormalizedProjectionVariant[] = [];
  for (const ref of presentation.member_instances ?? []) {
    const bucket = evidenceIndex.get(evidenceKey(ref));
    if (!bucket) continue;
    for (const entry of bucket) {
      if (seen.has(entry.variant.id)) continue;
      seen.add(entry.variant.id);
      const confidenceScalar = unwrapConfidenceTotal(entry.variant.confidence);
      variants.push({
        id: entry.variant.id,
        surface: entry.variant.surface,
        ...(confidenceScalar !== undefined ? { confidence: confidenceScalar } : {}),
        ...(entry.variant.selector ? { selector: entry.variant.selector } : {}),
        object_canonical_id: entry.object.canonical_id,
        ...(entry.object.canonical_label ? { object_canonical_label: entry.object.canonical_label } : {}),
        evidence_chain: entry.variant.evidence_chain ?? [],
        ...(entry.variant.metadata ? { metadata: entry.variant.metadata } : {}),
        ...(entry.variant.confidence_summary ? { confidence_summary: entry.variant.confidence_summary } : {}),
      });
    }
  }
  variants.sort(compareVariants);
  return variants;
}

function collectMemberObjectConflicts(
  presentations: NormalizedPresentation[],
  evidenceIndex: Map<string, EvidenceIndexEntry[]>,
): unknown[] {
  const seenObjects = new Set<string>();
  const conflicts: unknown[] = [];
  for (const presentation of presentations) {
    for (const ref of presentation.member_instances) {
      const bucket = evidenceIndex.get(evidenceKey(ref));
      if (!bucket) continue;
      for (const entry of bucket) {
        if (seenObjects.has(entry.object.canonical_id)) continue;
        seenObjects.add(entry.object.canonical_id);
        for (const c of entry.object.conflicts ?? []) conflicts.push(c);
      }
    }
  }
  return conflicts;
}

function normalizePresentation(
  capabilityId: string,
  presentation: Stage1CapabilityPresentation,
  evidenceIndex: Map<string, EvidenceIndexEntry[]>,
): NormalizedPresentation {
  return {
    capability_id: capabilityId,
    surface: presentation.surface,
    ...(presentation.label !== undefined ? { label: presentation.label } : {}),
    preconditions: presentation.preconditions ?? [],
    role_hints: sortStrings(presentation.role_hints ?? []),
    state_hints: sortStrings(presentation.state_hints ?? []),
    member_instances: presentation.member_instances ?? [],
    projection_variants: deriveVariants(presentation, evidenceIndex),
  };
}

function normalizeCapability(
  capability: Stage1Capability,
  evidenceIndex: Map<string, EvidenceIndexEntry[]>,
  identityNodes: Map<string, Stage1IdentityGraphNode>,
): NormalizedCapability {
  const presentations = (capability.presentations ?? [])
    .map((p) => normalizePresentation(capability.canonical_id, p, evidenceIndex))
    .sort(comparePresentations);

  const capabilityConflicts = capability.conflicts ?? [];
  const memberConflicts = collectMemberObjectConflicts(presentations, evidenceIndex);

  const normalized: NormalizedCapability = {
    canonical_id: capability.canonical_id,
    ...(capability.display_label !== undefined ? { display_label: capability.display_label } : {}),
    ...(capability.resolution_strategy ? { resolution_strategy: capability.resolution_strategy } : {}),
    derived_from_runs: sortStrings(capability.derived_from_runs ?? []),
    minimum_preconditions: capability.minimum_preconditions ?? [],
    lifecycle_hints: capability.lifecycle_hints ?? [],
    presentations,
    conflicts: [...capabilityConflicts, ...memberConflicts],
  };

  const identityNode = identityNodes.get(capability.canonical_id);
  if (identityNode) normalized.identity_node = identityNode;

  return normalized;
}

/**
 * Fold the three Stage1 rollup artifacts into a deterministic capability-centric
 * view. Pure and side-effect free — same inputs always produce byte-identical
 * output. Accepts both v1.5.0 scalar-confidence and v1.6.0 ConfidenceDecomposition
 * shapes on candidate_mappings[], presentations[], and projection_variants[].
 *
 * Spine: capability_rollup.capabilities[]. Every input canonical_id lands
 * in the output. Each presentation receives projection_variants derived
 * from object_rollup where any member_instance evidence ref (artifact_ref,
 * json_pointer, run_id) appears in a variant's evidence_chain; conflicts
 * from those matched objects are merged onto the capability's conflicts[].
 * identity_graph nodes with matching canonical_id attach as identity_node,
 * preserving candidate_mappings[].confidence in whichever shape Stage1 emitted
 * (so v1.2.0 signals[].hint surfaces stay reachable to downstream consumers).
 * resolution_strategy is preserved from capability_rollup. Variant confidence
 * is always emitted as a scalar (.total unwrapped when decomposed), with the
 * optional ConfidenceSummary passed through for evidence traceability.
 */
export function normalizeCapabilities(inputs: CapabilityNormalizerInputs): NormalizedCapability[] {
  const { capabilityRollup, objectRollup, identityGraph } = inputs;
  const evidenceIndex = buildEvidenceIndex(objectRollup);
  const identityNodes = buildIdentityNodeIndex(identityGraph);
  const normalized = (capabilityRollup.capabilities ?? []).map((c) =>
    normalizeCapability(c, evidenceIndex, identityNodes),
  );
  normalized.sort(compareCapabilities);
  return normalized;
}
