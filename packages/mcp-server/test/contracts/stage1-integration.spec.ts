/**
 * Stage1 → OODS Foundry Integration Tests
 *
 * Validates the bilateral contract (docs/integration/stage1-oods-contract.md v1.0).
 * Tests simulate Stage1 artifact payloads flowing through OODS tools:
 *   - ORCA candidates → map.create (component mapping)
 *   - Component clusters → map.create with propMappings
 *   - Token guesses → brand.apply (alias strategy)
 *   - Full pipeline orchestration (map → compose → brand)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as mapCreateHandle } from '../../src/tools/map.create.js';
import { handle as mapListHandle } from '../../src/tools/map.list.js';
import { handle as mapResolveHandle } from '../../src/tools/map.resolve.js';
import { handle as mapDeleteHandle } from '../../src/tools/map.delete.js';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as brandApplyHandle } from '../../src/tools/brand.apply.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const DEFAULT_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';

/* ------------------------------------------------------------------ */
/*  Stage1 mock artifacts (from contract examples)                     */
/* ------------------------------------------------------------------ */

/** Simulated orca_candidates.json — e-commerce scenario */
const ORCA_ECOMMERCE = {
  objects: [
    {
      id: 'orca-001',
      name: 'ProductCard',
      category: 'component',
      domain_hints: ['pricing', 'product'],
      recurrence_count: 12,
    },
    {
      id: 'orca-002',
      name: 'CartSummary',
      category: 'component',
      domain_hints: ['cart', 'pricing'],
      recurrence_count: 3,
    },
    {
      id: 'orca-skip-001',
      name: 'PageHeader',
      category: 'layout',  // not component — should be filtered out
      domain_hints: ['navigation'],
      recurrence_count: 1,
    },
  ],
};

/** Simulated orca_candidates.json — SaaS dashboard scenario */
const ORCA_SAAS = {
  objects: [
    {
      id: 'orca-010',
      name: 'MetricWidget',
      category: 'component',
      domain_hints: ['metric', 'dashboard', 'analytics'],
      recurrence_count: 8,
    },
    {
      id: 'orca-011',
      name: 'UserRow',
      category: 'component',
      domain_hints: ['user', 'table', 'list'],
      recurrence_count: 25,
    },
  ],
};

/** Simulated component_clusters.json — SaaS MetricWidget */
const CLUSTER_METRIC_WIDGET = {
  clusterId: 'cl-metric-widget',
  patternName: 'MetricWidget',
  semanticRole: 'card',
  props: {
    title: { type: 'string', required: true },
    value: { type: 'number', required: true },
    trend: { type: 'string', values: ['up', 'down', 'flat'] },
  },
  confidence: 0.87,
  totalInstances: 8,
};

/** Simulated token-guess.json */
const TOKEN_GUESS = {
  kind: 'token_guess',
  tokens: {
    'colors.primary': { value: '#2563eb', confidence: 0.92, occurrences: 47, source: 'css_variable' },
    'colors.text.primary': { value: '#1f2937', confidence: 0.88, occurrences: 312, source: 'computed_style' },
    'typography.fontSize.md': { value: '16px', confidence: 0.95, occurrences: 89, source: 'computed_style' },
    'spacing.md': { value: '16px', confidence: 0.78, occurrences: 23, source: 'inferred' },
    'colors.lowconf': { value: '#999', confidence: 0.45, occurrences: 2, source: 'inferred' },
  },
};

/* ------------------------------------------------------------------ */
/*  Contract helpers: domain hint → trait, token path translation      */
/* ------------------------------------------------------------------ */

const DOMAIN_TRAIT_MAP: Record<string, string[]> = {
  pricing: ['Priceable', 'Stateful'],
  subscription: ['Priceable', 'Stateful'],
  billing: ['Priceable', 'Stateful'],
  user: ['Identifiable', 'Labelled'],
  profile: ['Identifiable', 'Labelled'],
  account: ['Identifiable', 'Labelled'],
  form: ['Editable', 'Validatable'],
  input: ['Editable', 'Validatable'],
  navigation: ['Navigable'],
  menu: ['Navigable'],
  status: ['Stateful', 'Labelled'],
  badge: ['Stateful', 'Labelled'],
  chart: ['Measurable', 'Labelled'],
  metric: ['Measurable', 'Labelled'],
  dashboard: ['Measurable', 'Labelled'],
  list: ['Listable', 'Sortable'],
  table: ['Listable', 'Sortable'],
  grid: ['Listable', 'Sortable'],
  media: ['Presentable'],
  image: ['Presentable'],
  date: ['Temporal'],
  time: ['Temporal'],
  product: ['Priceable', 'Labelled'],
  cart: ['Priceable', 'Listable'],
  analytics: ['Measurable'],
};

const TOKEN_PATH_MAP: Record<string, string> = {
  'colors.primary': 'color.brand.primary',
  'colors.secondary': 'color.brand.secondary',
  'colors.background': 'color.surface.default',
  'colors.text.primary': 'color.text.default',
  'colors.text.secondary': 'color.text.muted',
  'typography.fontSize.md': 'size.font.md',
  'spacing.md': 'size.spacing.md',
};

/** Translate Stage1 domain hints to OODS traits (deduplicated). */
function domainHintsToTraits(hints: string[]): string[] {
  const traits = new Set<string>();
  for (const hint of hints) {
    const mapped = DOMAIN_TRAIT_MAP[hint];
    if (mapped) mapped.forEach((t) => traits.add(t));
  }
  return [...traits];
}

/** Translate Stage1 token paths to OODS DTCG paths. */
function translateTokenPath(stage1Path: string): string | null {
  return TOKEN_PATH_MAP[stage1Path] ?? null;
}

/** Filter tokens by confidence threshold. */
function filterTokensByConfidence(
  tokens: Record<string, { value: string; confidence: number }>,
  threshold: number,
): Record<string, { value: string; confidence: number }> {
  const result: Record<string, { value: string; confidence: number }> = {};
  for (const [key, entry] of Object.entries(tokens)) {
    if (entry.confidence >= threshold) {
      result[key] = entry;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Test setup: preserve/restore mappings                              */
/* ------------------------------------------------------------------ */

let originalMappings: string | null = null;
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

function resetMappingsFile(): void {
  const mappingsPath = currentMappingsPath();
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(
    mappingsPath,
    JSON.stringify(
      {
        $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
        generatedAt: new Date().toISOString(),
        version: new Date().toISOString().slice(0, 10),
        stats: { mappingCount: 0, systemCount: 0 },
        mappings: [],
      },
      null,
      2,
    ) + '\n',
  );
}

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const originalPath = currentMappingsPath();
  originalMappings = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : null;

  mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-stage1-integration-'));
  process.env[MAPPINGS_PATH_ENV] = path.join(mappingsTmpDir, 'component-mappings.json');
  resetMappingsFile();
});

afterAll(() => {
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }

  const restoredMappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(restoredMappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(restoredMappingsPath), { recursive: true });
    fs.writeFileSync(restoredMappingsPath, originalMappings);
  }

  if (mappingsTmpDir) {
    fs.rmSync(mappingsTmpDir, { recursive: true, force: true });
    mappingsTmpDir = null;
  }
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Stage1 integration contract', () => {
  describe('domain hint → trait translation', () => {
    it('maps pricing domain hints to Priceable + Stateful', () => {
      expect(domainHintsToTraits(['pricing'])).toEqual(expect.arrayContaining(['Priceable', 'Stateful']));
    });

    it('maps user domain hints to Identifiable + Labelled', () => {
      expect(domainHintsToTraits(['user'])).toEqual(expect.arrayContaining(['Identifiable', 'Labelled']));
    });

    it('deduplicates traits from multiple overlapping hints', () => {
      const traits = domainHintsToTraits(['pricing', 'subscription']);
      expect(traits).toEqual(['Priceable', 'Stateful']);
    });

    it('handles unknown domain hints gracefully', () => {
      const traits = domainHintsToTraits(['unknown-domain', 'pricing']);
      expect(traits).toEqual(expect.arrayContaining(['Priceable']));
    });

    it('maps all 9 contract domain groups', () => {
      const groups = [
        ['pricing'], ['user'], ['form'], ['navigation'],
        ['status'], ['chart'], ['list'], ['media'], ['date'],
      ];
      for (const hints of groups) {
        const traits = domainHintsToTraits(hints);
        expect(traits.length).toBeGreaterThan(0);
      }
    });
  });

  describe('token path translation', () => {
    it('translates colors.primary to color.brand.primary', () => {
      expect(translateTokenPath('colors.primary')).toBe('color.brand.primary');
    });

    it('translates colors.text.primary to color.text.default', () => {
      expect(translateTokenPath('colors.text.primary')).toBe('color.text.default');
    });

    it('translates typography paths to size.font.*', () => {
      expect(translateTokenPath('typography.fontSize.md')).toBe('size.font.md');
    });

    it('translates spacing paths to size.spacing.*', () => {
      expect(translateTokenPath('spacing.md')).toBe('size.spacing.md');
    });

    it('returns null for unknown paths', () => {
      expect(translateTokenPath('unknown.path')).toBeNull();
    });
  });

  describe('confidence gating', () => {
    it('filters tokens at 0.8 threshold for auto-apply', () => {
      const filtered = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.8);
      expect(Object.keys(filtered)).toHaveLength(3); // primary, text.primary, fontSize.md
      expect(filtered['colors.lowconf']).toBeUndefined();
      expect(filtered['spacing.md']).toBeUndefined(); // 0.78 < 0.8
    });

    it('includes review-tier tokens at 0.5 threshold', () => {
      const filtered = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.5);
      expect(Object.keys(filtered)).toHaveLength(4); // excludes only lowconf (0.45)
    });

    it('excludes low-confidence tokens below 0.5', () => {
      const filtered = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.5);
      expect(filtered['colors.lowconf']).toBeUndefined();
    });
  });

  describe('ORCA object filtering', () => {
    it('filters to component and entity categories only', () => {
      const mappable = ORCA_ECOMMERCE.objects.filter(
        (o) => o.category === 'component' || o.category === 'entity',
      );
      expect(mappable).toHaveLength(2);
      expect(mappable.map((o) => o.name)).toEqual(['ProductCard', 'CartSummary']);
    });
  });

  describe('map.create — ORCA e-commerce payloads', () => {
    const createdIds: string[] = [];

    it('creates ProductCard mapping from ORCA object', async () => {
      const orcaObj = ORCA_ECOMMERCE.objects[0];
      const traits = domainHintsToTraits(orcaObj.domain_hints);

      const result = await mapCreateHandle({
        externalSystem: 'shop-example',
        externalComponent: orcaObj.name,
        oodsTraits: traits,
        confidence: 'auto',
        metadata: {
          author: 'stage1-orca',
          notes: `Auto-mapped from ORCA object ${orcaObj.id}, recurrence: ${orcaObj.recurrence_count}`,
        },
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.mapping).toBeDefined();
      expect(result.applied).toBe(true);
      if (result.mapping?.id) createdIds.push(result.mapping.id);
    });

    it('creates CartSummary mapping from ORCA object', async () => {
      const orcaObj = ORCA_ECOMMERCE.objects[1];
      const traits = domainHintsToTraits(orcaObj.domain_hints);

      const result = await mapCreateHandle({
        externalSystem: 'shop-example',
        externalComponent: orcaObj.name,
        oodsTraits: traits,
        confidence: 'auto',
        metadata: {
          author: 'stage1-orca',
          notes: `Auto-mapped from ORCA object ${orcaObj.id}, recurrence: ${orcaObj.recurrence_count}`,
        },
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.applied).toBe(true);
      if (result.mapping?.id) createdIds.push(result.mapping.id);
    });

    it('lists mappings filtered by external system', async () => {
      const result = await mapListHandle({ externalSystem: 'shop-example' });
      expect(result.mappings.length).toBeGreaterThanOrEqual(2);
      const names = result.mappings.map((m: any) => m.externalComponent);
      expect(names).toContain('ProductCard');
      expect(names).toContain('CartSummary');
    });

    it('resolves ProductCard mapping', async () => {
      const result = await mapResolveHandle({
        externalSystem: 'shop-example',
        externalComponent: 'ProductCard',
      });
      expect(result.status).toBe('ok');
      expect(result.mapping).toBeDefined();
      expect(result.mapping.oodsTraits).toEqual(
        expect.arrayContaining(['Priceable']),
      );
    });

    // Cleanup created mappings
    afterAll(async () => {
      for (const id of createdIds) {
        await mapDeleteHandle({ id, apply: true });
      }
    });
  });

  describe('map.create — SaaS cluster with propMappings', () => {
    const createdIds: string[] = [];

    it('creates MetricWidget mapping with prop translations', async () => {
      const orcaObj = ORCA_SAAS.objects[0];
      const traits = domainHintsToTraits(orcaObj.domain_hints);

      const result = await mapCreateHandle({
        externalSystem: 'saas-tool',
        externalComponent: orcaObj.name,
        oodsTraits: traits,
        propMappings: [
          { externalProp: 'title', oodsProp: 'label', coercion: { type: 'identity' } },
          { externalProp: 'value', oodsProp: 'metric', coercion: { type: 'identity' } },
          {
            externalProp: 'trend',
            oodsProp: 'trendDirection',
            coercion: {
              type: 'enum',
              mapping: { up: 'increasing', down: 'decreasing', flat: 'stable' },
            },
          },
        ],
        confidence: CLUSTER_METRIC_WIDGET.confidence >= 0.7 ? 'manual' : 'auto',
        metadata: {
          author: 'stage1-orca',
          notes: `${orcaObj.recurrence_count} instances, cluster confidence ${CLUSTER_METRIC_WIDGET.confidence}`,
        },
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.applied).toBe(true);
      expect(result.mapping.propMappings).toHaveLength(3);
      if (result.mapping?.id) createdIds.push(result.mapping.id);
    });

    it('resolves MetricWidget with prop translations', async () => {
      const result = await mapResolveHandle({
        externalSystem: 'saas-tool',
        externalComponent: 'MetricWidget',
      });
      expect(result.status).toBe('ok');
      expect(result.mapping.propMappings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ externalProp: 'trend', oodsProp: 'trendDirection' }),
        ]),
      );
    });

    it('creates UserRow mapping from table/list domain hints', async () => {
      const orcaObj = ORCA_SAAS.objects[1];
      const traits = domainHintsToTraits(orcaObj.domain_hints);

      const result = await mapCreateHandle({
        externalSystem: 'saas-tool',
        externalComponent: orcaObj.name,
        oodsTraits: traits,
        confidence: 'auto',
        metadata: {
          author: 'stage1-orca',
          notes: `${orcaObj.recurrence_count} instances across user tables`,
        },
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.mapping.oodsTraits).toEqual(
        expect.arrayContaining(['Identifiable', 'Listable']),
      );
      if (result.mapping?.id) createdIds.push(result.mapping.id);
    });

    afterAll(async () => {
      for (const id of createdIds) {
        await mapDeleteHandle({ id, apply: true });
      }
    });
  });

  describe('brand.apply — Stage1 token pipeline', () => {
    it('accepts alias strategy with translated token paths (dry-run)', async () => {
      const highConfTokens = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.8);
      const delta: Record<string, string> = {};

      for (const [stage1Path, entry] of Object.entries(highConfTokens)) {
        const oodsPath = translateTokenPath(stage1Path);
        if (oodsPath) {
          delta[oodsPath] = entry.value;
        }
      }

      const result = await brandApplyHandle({
        strategy: 'alias',
        delta,
        apply: false,
      });

      // brand.apply returns GenericOutput with preview on dry-run
      expect(result.preview).toBeDefined();
      expect(result.preview?.summary).toBeDefined();
    });

    it('translates only high-confidence tokens to DTCG delta', () => {
      const highConf = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.8);
      const delta: Record<string, string> = {};

      for (const [stage1Path, entry] of Object.entries(highConf)) {
        const oodsPath = translateTokenPath(stage1Path);
        if (oodsPath) delta[oodsPath] = entry.value;
      }

      // Should include primary color and text color, font size
      expect(delta['color.brand.primary']).toBe('#2563eb');
      expect(delta['color.text.default']).toBe('#1f2937');
      expect(delta['size.font.md']).toBe('16px');
      // Should NOT include spacing.md (0.78 < 0.8)
      expect(delta['size.spacing.md']).toBeUndefined();
    });
  });

  describe('design.compose — Stage1 intent generation', () => {
    it('composes from Stage1-derived intent string', async () => {
      // Build intent from ORCA objects: "{page description} with {top components}"
      const topComponents = ORCA_ECOMMERCE.objects
        .filter((o) => o.category === 'component')
        .sort((a, b) => b.recurrence_count - a.recurrence_count)
        .slice(0, 3)
        .map((o) => o.name.replace(/([A-Z])/g, ' $1').trim().toLowerCase());

      const intent = `product catalog with ${topComponents.join(' and ')}`;

      const result = await composeHandle({
        intent,
        layout: 'dashboard',
      });

      expect(result.status).toBe('ok');
      expect(result.schema).toBeDefined();
      expect(result.schemaRef).toBeDefined();
    });

    it('composes with object-backed intent from ORCA evidence', async () => {
      const result = await composeHandle({
        object: 'Subscription',
        context: 'detail',
      });

      expect(result.status).toBe('ok');
      expect(result.schema).toBeDefined();
    });
  });

  describe('full pipeline orchestration', () => {
    const createdIds: string[] = [];

    it('executes Stage1 → OODS end-to-end: map → compose → brand', async () => {
      // Step 1: Create mappings from ORCA objects
      for (const obj of ORCA_SAAS.objects.filter((o) => o.category === 'component')) {
        const traits = domainHintsToTraits(obj.domain_hints);
        const result = await mapCreateHandle({
          externalSystem: 'pipeline-test',
          externalComponent: obj.name,
          oodsTraits: traits,
          confidence: 'auto',
          metadata: { author: 'stage1-orca', notes: `Pipeline test: ${obj.recurrence_count} instances` },
          apply: true,
        });
        expect(result.status).toBe('ok');
        if (result.mapping?.id) createdIds.push(result.mapping.id);
      }

      // Step 2: Verify mappings exist
      const listResult = await mapListHandle({ externalSystem: 'pipeline-test' });
      expect(listResult.totalCount).toBeGreaterThanOrEqual(2);

      // Step 3: Compose UI from intent
      const composeResult = await composeHandle({
        intent: 'analytics dashboard with metrics and user management',
        layout: 'dashboard',
      });
      expect(composeResult.status).toBe('ok');
      expect(composeResult.schemaRef).toBeDefined();

      // Step 4: Apply tokens (dry-run)
      const delta: Record<string, string> = {};
      const highConf = filterTokensByConfidence(TOKEN_GUESS.tokens as any, 0.8);
      for (const [k, v] of Object.entries(highConf)) {
        const oodsPath = translateTokenPath(k);
        if (oodsPath) delta[oodsPath] = v.value;
      }

      const brandResult = await brandApplyHandle({
        strategy: 'alias',
        delta,
        apply: false,
      });
      expect(brandResult.preview).toBeDefined();
    });

    afterAll(async () => {
      for (const id of createdIds) {
        await mapDeleteHandle({ id, apply: true });
      }
    });
  });

  describe('evidence chain traceability', () => {
    const createdIds: string[] = [];

    it('preserves ORCA evidence in mapping metadata', async () => {
      const orcaObj = ORCA_ECOMMERCE.objects[0];
      const result = await mapCreateHandle({
        externalSystem: 'evidence-test',
        externalComponent: orcaObj.name,
        oodsTraits: domainHintsToTraits(orcaObj.domain_hints),
        confidence: 'auto',
        metadata: {
          author: 'stage1-orca',
          notes: `Auto-mapped from ORCA object ${orcaObj.id}, recurrence: ${orcaObj.recurrence_count}`,
        },
        apply: true,
      });

      expect(result.status).toBe('ok');
      expect(result.mapping.metadata.author).toBe('stage1-orca');
      expect(result.mapping.metadata.notes).toContain('orca-001');
      expect(result.mapping.metadata.notes).toContain('recurrence: 12');
      if (result.mapping?.id) createdIds.push(result.mapping.id);
    });

    afterAll(async () => {
      for (const id of createdIds) {
        await mapDeleteHandle({ id, apply: true });
      }
    });
  });

  describe('confidence gating in mapping confidence field', () => {
    it('sets confidence to manual for cluster confidence >= 0.7', () => {
      const clusterConf = CLUSTER_METRIC_WIDGET.confidence; // 0.87
      const mapConfidence = clusterConf >= 0.7 ? 'manual' : 'auto';
      expect(mapConfidence).toBe('manual');
    });

    it('sets confidence to auto for cluster confidence < 0.7', () => {
      const lowConf = 0.55;
      const mapConfidence = lowConf >= 0.7 ? 'manual' : 'auto';
      expect(mapConfidence).toBe('auto');
    });
  });
});
