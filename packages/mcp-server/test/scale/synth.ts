/**
 * Scale-tier reconciliation-report synthesizer.
 *
 * Generates ReconciliationReport fixtures at 100/500/1000 candidate_objects with
 * shape preserved from real Stage1 sprint-46 artifacts. Cardinality is the only
 * controlled axis; everything else (object_id, name, role, confidence, action,
 * trait set, diff payload) is real-fixture-shaped with seeded variation.
 *
 * Determinism: same seed produces byte-identical output across runs. Verified
 * by `determinism.spec.ts`.
 */
import type {
  Stage1CandidateObject,
  Stage1ReconciliationReport,
} from '../../src/tools/types.js';
import type { ComponentMapping, MappingsDoc } from '../../src/tools/map.shared.js';

export type ScaleTier = 100 | 500 | 1000;

export interface SynthesizeOptions {
  tier: ScaleTier;
  seed: number;
}

// mulberry32: small, fast, well-distributed PRNG with explicit state.
// Same seed -> same sequence; no implicit Math.random() / Date.now() leaks.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLES = ['button', 'row', 'card', 'menu', 'panel', 'header', 'list', 'form', 'input', 'tab'] as const;
const TRAIT_POOL = ['Stateful', 'Labelled', 'Listable', 'Sortable', 'Navigable', 'Priceable', 'Selectable'] as const;
const DOMAINS = ['navigation', 'issues', 'billing', 'auth', 'reporting', 'content'] as const;

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function pickActionByCdf(rand: () => number): Stage1CandidateObject['action'] {
  // Distribution matches the verdict mix in real Stage1 artifacts:
  // create-heavy (new mappings dominate), then patch/skip near-equal, conflict rare.
  const r = rand();
  if (r < 0.4) return 'create';
  if (r < 0.65) return 'patch';
  if (r < 0.9) return 'skip';
  return 'conflict';
}

function synthesizeCandidate(rand: () => number, index: number): Stage1CandidateObject {
  // ~80% above the default minConfidence (0.75), ~20% below — exercises both
  // the verdict-routed path and the queued-below-threshold path.
  const aboveThreshold = rand() < 0.8;
  const confidence = aboveThreshold
    ? 0.75 + rand() * 0.25
    : rand() * 0.74;

  const action = pickActionByCdf(rand);
  const role = pick(rand, ROLES);

  const traitCount = 1 + Math.floor(rand() * 3);
  const traits = new Set<string>();
  while (traits.size < traitCount) {
    traits.add(pick(rand, TRAIT_POOL));
  }

  const objectId = `obj-synth-${String(index).padStart(5, '0')}`;
  const name = `Synth ${role} ${index}`;
  const reasoning = `Synthesized candidate ${index} with role ${role}.`;
  const verdictReasoning = `Synthesized verdict reasoning for candidate ${index}.`;

  const candidate: Stage1CandidateObject = {
    object_id: objectId,
    name,
    role,
    inferred_role: role,
    inferred_role_score: Math.min(1, Math.max(0, confidence + (rand() - 0.5) * 0.1)),
    confidence,
    recommended_oods_traits: Array.from(traits),
    recommended_domain: pick(rand, DOMAINS),
    action,
    reasoning,
    verdict_reasoning: verdictReasoning,
  };

  if (action === 'patch') {
    candidate.existing_map_id = `existing-map-${index}`;
    candidate.diff = {
      added_traits: [pick(rand, TRAIT_POOL)],
      removed_traits: [],
      changed_fields: [
        {
          field: 'metadata.notes',
          from: 'pre-synth',
          to: 'post-synth',
        },
      ],
    };
  } else if (action === 'skip' || action === 'conflict') {
    candidate.existing_map_id = `existing-map-${index}`;
  }

  return candidate;
}

export function synthesizeReconciliationReport(
  options: SynthesizeOptions,
): Stage1ReconciliationReport {
  const rand = mulberry32(options.seed);
  const candidates: Stage1CandidateObject[] = [];
  for (let i = 0; i < options.tier; i += 1) {
    candidates.push(synthesizeCandidate(rand, i));
  }

  return {
    kind: 'reconciliation_report',
    schema_version: '1.1.0',
    // Fixed timestamp keeps synth output byte-identical across runs at the
    // same seed; the real-fixture date isn't load-bearing for map.apply.
    generated_at: '2026-05-21T00:00:00.000Z',
    target: {
      id: `scale-tier-${options.tier}`,
      url: `https://scale-test.example.invalid/tier-${options.tier}`,
    },
    candidate_objects: candidates,
  };
}

/**
 * Build a MappingsDoc whose entries cover every candidate in the report that
 * carries an `existing_map_id` (patch / skip / conflict verdicts). Without
 * this pre-seed, patch verdicts in map.apply would all fail the
 * `findExistingMapping` lookup and surface as errors.
 *
 * Each seeded mapping uses the candidate's own recommended trait set so the
 * patch path lands on a no-op (plan.hasChanges = false) — sufficient to
 * exercise the route end-to-end without polluting the diff summary.
 */
export function synthesizeMappingsDoc(
  report: Stage1ReconciliationReport,
): MappingsDoc {
  const externalSystem = deriveExternalSystemForSeed(report);
  const mappings: ComponentMapping[] = [];

  for (const candidate of report.candidate_objects) {
    if (!candidate.existing_map_id) continue;
    mappings.push({
      id: candidate.existing_map_id,
      externalSystem,
      externalComponent: candidate.name,
      oodsTraits: candidate.recommended_oods_traits,
      confidence: 'auto',
    });
  }

  const generatedAt = report.generated_at;
  return {
    generatedAt,
    version: generatedAt.slice(0, 10),
    stats: {
      mappingCount: mappings.length,
      systemCount: new Set(mappings.map((m) => m.externalSystem)).size,
    },
    mappings,
  };
}

// Mirrors deriveExternalSystem() in map.apply.ts. Duplicating the few lines
// here keeps the synth a self-contained test helper without exporting an
// internal handler util.
function deriveExternalSystemForSeed(report: Stage1ReconciliationReport): string {
  if (report.target.url) {
    try {
      const hostname = new URL(report.target.url).hostname.replace(/^www\./, '');
      const pieces = hostname.split('.');
      if (pieces.length > 1) return pieces.slice(0, -1).join('-');
      return hostname;
    } catch {
      // fall through
    }
  }
  return report.target.id
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
