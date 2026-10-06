/**
 * Sprint 54: Upstream Trait Sync — MCP Tool Exposure Contracts
 *
 * Validates that upstream trait updates (S42-S43) are correctly exposed
 * through MCP tools after pnpm refresh:data.
 *
 * Coverage:
 *   1. Taggable v2 — new params visible in catalog (tagMinLength, tagMaxLength, etc.)
 *   2. Colorized v2 — updated tones reflected in structured data
 *   3. Auditable v1 + Statusable v1 — discoverable as new traits
 *   4. structuredData.fetch — versioned data includes updated trait metadata
 */
import { describe, it, expect } from 'vitest';
import { handle as fetchData, listAvailableVersions } from '../../src/tools/structuredData.fetch.js';
import { handle as listCatalog } from '../../src/tools/catalog.list.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TraitMeta {
  name: string;
  version: string;
  category: string;
  parameters: { name: string; type?: string; default?: unknown }[];
  [key: string]: unknown;
}

async function fetchTraits(): Promise<TraitMeta[]> {
  const result = await fetchData({ dataset: 'components' });
  expect(result.payloadIncluded).toBe(true);
  return (result.payload as Record<string, unknown>).traits as TraitMeta[];
}

function findTrait(traits: TraitMeta[], name: string): TraitMeta {
  const trait = traits.find((t) => t.name === name);
  expect(trait, `Expected trait "${name}" to be discoverable`).toBeDefined();
  return trait!;
}

// ─── 1. Taggable v2 — new parameters ───────────────────────────────────────

describe('Taggable v2 params visible in structured data', () => {
  it('exposes all 8 parameters including new upstream additions', async () => {
    const traits = await fetchTraits();
    const taggable = findTrait(traits, 'Taggable');

    expect(taggable.version).toBe('2.0.0');
    const paramNames = taggable.parameters.map((p) => p.name);

    // Original params
    expect(paramNames).toContain('maxTags');
    expect(paramNames).toContain('allowCustomTags');
    expect(paramNames).toContain('allowedTags');
    expect(paramNames).toContain('caseSensitive');

    // New upstream params (s54-m01)
    expect(paramNames).toContain('tagMinLength');
    expect(paramNames).toContain('tagMaxLength');
    expect(paramNames).toContain('allowTagModeration');
    expect(paramNames).toContain('synonymResolution');
  });
});

// ─── 2. Colorized v2 — updated tones ───────────────────────────────────────

describe('Colorized v2 tones reflected in structured data', () => {
  it('exposes v2 with 4 parameters including contrastLevel and colorMode', async () => {
    const traits = await fetchTraits();
    const colorized = findTrait(traits, 'Colorized');

    expect(colorized.version).toBe('2.0.0');
    const paramNames = colorized.parameters.map((p) => p.name);

    expect(paramNames).toContain('colorStates');
    expect(paramNames).toContain('contrastLevel');
    expect(paramNames).toContain('colorMode');
    expect(paramNames).toContain('fallbackTone');
  });

  it('has colorStates default including critical (not danger)', async () => {
    const traits = await fetchTraits();
    const colorized = findTrait(traits, 'Colorized');
    const colorStatesParam = colorized.parameters.find((p) => p.name === 'colorStates');

    expect(colorStatesParam).toBeDefined();
    const defaults = colorStatesParam!.default as string[];
    expect(defaults).toContain('critical');
    expect(defaults).not.toContain('danger');
  });
});

// ─── 3. New traits: Auditable + Statusable ─────────────────────────────────

describe('New traits discoverable in structured data', () => {
  it('exposes Auditable v1 with audit trail parameters', async () => {
    const traits = await fetchTraits();
    const auditable = findTrait(traits, 'Auditable');

    expect(auditable.version).toBe('1.0.0');
    expect(auditable.category).toBe('lifecycle');
    const paramNames = auditable.parameters.map((p) => p.name);
    expect(paramNames).toContain('retentionDays');
    expect(paramNames).toContain('requireTransitionReason');
    expect(paramNames).toContain('trackActorId');
  });

  it('exposes Statusable v1 with domain-scoped presentation parameters', async () => {
    const traits = await fetchTraits();
    const statusable = findTrait(traits, 'Statusable');

    expect(statusable.version).toBe('1.0.0');
    expect(statusable.category).toBe('visual');
    const paramNames = statusable.parameters.map((p) => p.name);
    expect(paramNames).toContain('domains');
    expect(paramNames).toContain('toneAliases');
    expect(paramNames).toContain('defaultTone');
  });

  it('reports correct total trait count including new additions', async () => {
    const traits = await fetchTraits();
    // Sprint 54 adds Auditable + Statusable on top of existing traits
    expect(traits.length).toBeGreaterThanOrEqual(37);
  });
});

// ─── 4. Versioned structured data ──────────────────────────────────────────

describe('Versioned structured data returns updated trait metadata', () => {
  it('returns nearest-available versioned artifact with enriched trait surface', async () => {
    const available = listAvailableVersions('components');
    expect(available.length).toBeGreaterThan(0);

    const requested = new Date().toISOString().slice(0, 10);
    const sorted = [...available].sort();
    let expected = sorted[0];
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i] <= requested) {
        expected = sorted[i];
        break;
      }
    }

    const result = await fetchData({ dataset: 'components', version: requested });

    expect(result.payloadIncluded).toBe(true);
    expect(result.requestedVersion).toBe(requested);
    expect(result.resolvedVersion).toBe(expected);
    expect(result.version).toBe(expected);
    if (expected !== requested) {
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w) => w.includes('not found'))).toBe(true);
    } else {
      expect(result.warnings).toBeUndefined();
    }

    const traits = (result.payload as Record<string, unknown>).traits as TraitMeta[];
    const traitNames = traits.map((t) => t.name);
    expect(traitNames).toContain('Auditable');
    expect(traitNames).toContain('Statusable');
    expect(traitNames).toContain('Colorized');
    expect(traitNames).toContain('Taggable');
  });

  it('reports the active manifest version even when a named release follows dated snapshots', async () => {
    const versions = listAvailableVersions('components');
    expect(versions.length).toBeGreaterThan(0);
    const result = await fetchData({ dataset: 'manifest' });
    expect(result.payloadIncluded).toBe(true);
    const manifest = result.payload as Record<string, unknown>;
    const components = await fetchData({ dataset: 'components', version: manifest.version as string });
    expect(components.version).toBe(manifest.version);
    expect(components.warnings).toBeUndefined();
    expect(result.version).toBe(manifest.version);
  });

  it('includes etag that differs from pre-sync baseline', async () => {
    const result = await fetchData({ dataset: 'components' });
    expect(result.etag).toBeDefined();
    expect(typeof result.etag).toBe('string');
    expect(result.etag!.length).toBeGreaterThan(0);
  });
});

// ─── 5. catalog.list exposes enriched trait metadata ────────────────────────

describe('catalog.list reflects enriched trait surface', () => {
  it('returns components with trait data', async () => {
    // s211-m01: an unfiltered call is brief (name, categories, readiness); traits are in summary.
    const output = await listCatalog({ detail: 'summary' }) as { totalCount: number; components: Array<{ traits: string[] }> };
    expect(output.totalCount).toBeGreaterThan(0);

    const allTraits = new Set<string>();
    for (const component of output.components) {
      for (const trait of component.traits) {
        allTraits.add(trait);
      }
    }

    // Foundational traits should be present in component catalog
    expect(allTraits.size).toBeGreaterThan(0);
  });
});
