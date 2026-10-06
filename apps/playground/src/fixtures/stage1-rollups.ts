/**
 * Stage1 v1.6.0 rollup fixtures for the playground capability view (s94-m04).
 *
 * Shapes pulled verbatim from the live a0300dc0 (linear) + 7adc1d79 (stripe)
 * Sprint 46 reruns that sprint-94 gates against (see
 * test/e2e/stage1-rollups.e2e.spec.ts). schema_versions: identity_graph 1.2.0,
 * capability_rollup 1.2.0, object_rollup 1.1.0. Each variant carries the new
 * ConfidenceDecomposition shape (total + method + signals[]); the normalizer
 * unwraps .total and preserves confidence_summary.
 *
 * object_rollup and identity_graph are trimmed to representative samples to
 * keep the playground bundle lean; capability_rollup is full so the panel
 * shows the complete capability spine per fixture.
 *
 * Normalizer logic mirrors packages/mcp-server/src/stage1/capability-normalizer.ts
 * — the playground can't import mcp-server source directly, so the transform
 * is reimplemented here with identical semantics (evidence-ref tuple equality,
 * deterministic sort, capability_id threading, ConfidenceDecomposition unwrap).
 */

import linearRollups from './linear-v16-rollups.json';
import stripeRollups from './stripe-v16-rollups.json';

export type EvidenceRef = {
  artifact_ref: string;
  json_pointer: string;
  run_id?: string;
  source_surface?: string;
  observation_type?: string;
};

/** Stage1 v1.6.0 confidence decomposition surfaces (contract §2d). */
export type ConfidenceMethodId = 'weighted_blend_v1' | 'threshold_gate_v1' | string;

export type ConfidenceSignal = {
  type: string;
  raw_score: number;
  weight: number;
  weighted_contribution: number;
  evidence_ref: EvidenceRef;
  hint?: string;
};

export type ConfidenceDecomposition = {
  total: number;
  method: ConfidenceMethodId;
  signals: ConfidenceSignal[];
};

export type ConfidenceSummary = {
  total: number;
  method: ConfidenceMethodId;
  evidence_ref: EvidenceRef;
  top_signal_types?: string[];
};

export type CapabilityPresentation = {
  surface: string;
  label?: string;
  /** v1.2.0 adds ConfidenceDecomposition per presentation. */
  confidence?: ConfidenceDecomposition;
  preconditions?: unknown[];
  role_hints?: string[];
  state_hints?: string[];
  member_instances?: EvidenceRef[];
};

export type CapabilityEntry = {
  canonical_id: string;
  display_label?: string;
  presentations: CapabilityPresentation[];
  minimum_preconditions?: unknown[];
  lifecycle_hints?: unknown[];
  conflicts?: unknown[];
  resolution_strategy?: string;
  derived_from_runs?: string[];
};

export type RollupProjectionVariant = {
  id: string;
  surface: string;
  /** v1.0.0 scalar; v1.1.0 ConfidenceDecomposition. */
  confidence?: number | ConfidenceDecomposition;
  /** v1.1.0 summary backref; preserved on normalized variants. */
  confidence_summary?: ConfidenceSummary;
  selector?: string;
  evidence_chain?: EvidenceRef[];
  metadata?: Record<string, unknown>;
  external_component?: string;
  capability_id?: string;
};

export type RollupObject = {
  canonical_id: string;
  canonical_label?: string;
  external_component?: string;
  oods_traits?: string[];
  projection_variants?: RollupProjectionVariant[];
  conflicts?: unknown[];
  reconciliation?: { action?: string };
};

export type IdentityNode = {
  canonical_id: string;
  canonical_label?: string;
  identity_class: string;
  /** v1.1.0 scalar; v1.2.0 ConfidenceDecomposition (signals[].hint replaces legacy top-level hints[]). */
  candidate_mappings?: Array<{
    target: string;
    confidence: number | ConfidenceDecomposition;
  }>;
  review_status?: string;
};

export type RollupBundle = {
  capabilityRollup: {
    kind: 'capability_rollup';
    schema_version: string;
    generated_at: string;
    run_id: string;
    target: { id: string; url?: string };
    capabilities: CapabilityEntry[];
  };
  objectRollup: {
    kind: 'object_rollup';
    schema_version: string;
    generated_at: string;
    run_id: string;
    target: { id: string; url?: string };
    objects: RollupObject[];
  };
  identityGraph: {
    kind: 'identity_graph';
    schema_version: string;
    generated_at: string;
    run_id: string;
    target: { id: string; url?: string };
    nodes: IdentityNode[];
  };
  sourceCounts: {
    capabilities: number;
    objects: number;
    nodes: number;
  };
};

export type NormalizedProjectionVariant = {
  id: string;
  surface: string;
  confidence?: number;
  selector?: string;
  object_canonical_id: string;
  object_canonical_label?: string;
  evidence_chain: EvidenceRef[];
  metadata?: Record<string, unknown>;
  confidence_summary?: ConfidenceSummary;
};

export type NormalizedPresentation = {
  capability_id: string;
  surface: string;
  label?: string;
  member_instances: EvidenceRef[];
  projection_variants: NormalizedProjectionVariant[];
  role_hints: string[];
  state_hints: string[];
};

export type NormalizedCapability = {
  canonical_id: string;
  display_label?: string;
  resolution_strategy?: string;
  derived_from_runs: string[];
  identity_node?: IdentityNode;
  presentations: NormalizedPresentation[];
  conflicts: unknown[];
};

export const LINEAR_V16_ROLLUPS = linearRollups as RollupBundle;
export const STRIPE_V16_ROLLUPS = stripeRollups as RollupBundle;

function evidenceKey(ref: EvidenceRef): string {
  return [ref.artifact_ref ?? '', ref.json_pointer ?? '', ref.run_id ?? ''].join('#');
}

/** Mirrors unwrapConfidenceTotal in packages/mcp-server/src/stage1/capability-normalizer.ts. */
function unwrapConfidenceTotal(
  value: number | ConfidenceDecomposition | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof (value as ConfidenceDecomposition).total === 'number') {
    return (value as ConfidenceDecomposition).total;
  }
  return undefined;
}

function sortStrings(xs: readonly string[]): string[] {
  return [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

type EvidenceEntry = {
  object: RollupObject;
  variant: RollupProjectionVariant;
};

function buildEvidenceIndex(objects: RollupObject[]): Map<string, EvidenceEntry[]> {
  const index = new Map<string, EvidenceEntry[]>();
  for (const object of objects) {
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

function deriveVariants(
  presentation: CapabilityPresentation,
  index: Map<string, EvidenceEntry[]>,
): NormalizedProjectionVariant[] {
  const seen = new Set<string>();
  const variants: NormalizedProjectionVariant[] = [];
  for (const ref of presentation.member_instances ?? []) {
    const bucket = index.get(evidenceKey(ref));
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
  variants.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return variants;
}

/**
 * Fold capability_rollup + object_rollup + identity_graph into a deterministic
 * capability-centric view. Pure; side-effect free. Mirrors the mcp-server
 * normalizer shape so the playground UI never diverges from what m02 emits.
 */
export function normalizeCapabilities(bundle: RollupBundle): NormalizedCapability[] {
  const index = buildEvidenceIndex(bundle.objectRollup.objects);
  const identityByCanonicalId = new Map<string, IdentityNode>();
  for (const node of bundle.identityGraph.nodes) {
    identityByCanonicalId.set(node.canonical_id, node);
  }

  const result = bundle.capabilityRollup.capabilities.map<NormalizedCapability>((capability) => {
    const presentations = (capability.presentations ?? [])
      .map<NormalizedPresentation>((presentation) => ({
        capability_id: capability.canonical_id,
        surface: presentation.surface,
        ...(presentation.label !== undefined ? { label: presentation.label } : {}),
        member_instances: presentation.member_instances ?? [],
        projection_variants: deriveVariants(presentation, index),
        role_hints: sortStrings(presentation.role_hints ?? []),
        state_hints: sortStrings(presentation.state_hints ?? []),
      }))
      .sort((a, b) => {
        if (a.surface !== b.surface) return a.surface < b.surface ? -1 : 1;
        const la = a.label ?? '';
        const lb = b.label ?? '';
        return la < lb ? -1 : la > lb ? 1 : 0;
      });

    const memberConflicts: unknown[] = [];
    const seenObjects = new Set<string>();
    for (const presentation of presentations) {
      for (const ref of presentation.member_instances) {
        const bucket = index.get(evidenceKey(ref));
        if (!bucket) continue;
        for (const entry of bucket) {
          if (seenObjects.has(entry.object.canonical_id)) continue;
          seenObjects.add(entry.object.canonical_id);
          for (const c of entry.object.conflicts ?? []) memberConflicts.push(c);
        }
      }
    }

    const normalized: NormalizedCapability = {
      canonical_id: capability.canonical_id,
      ...(capability.display_label !== undefined ? { display_label: capability.display_label } : {}),
      ...(capability.resolution_strategy ? { resolution_strategy: capability.resolution_strategy } : {}),
      derived_from_runs: sortStrings(capability.derived_from_runs ?? []),
      presentations,
      conflicts: [...(capability.conflicts ?? []), ...memberConflicts],
    };

    const identity = identityByCanonicalId.get(capability.canonical_id);
    if (identity) normalized.identity_node = identity;

    return normalized;
  });

  result.sort((a, b) => (a.canonical_id < b.canonical_id ? -1 : a.canonical_id > b.canonical_id ? 1 : 0));
  return result;
}
