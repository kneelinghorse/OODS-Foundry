import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';
import createInputSchema from '../../src/schemas/map.create.input.json' assert { type: 'json' };
import createOutputSchema from '../../src/schemas/map.create.output.json' assert { type: 'json' };
import listInputSchema from '../../src/schemas/map.list.input.json' assert { type: 'json' };
import listOutputSchema from '../../src/schemas/map.list.output.json' assert { type: 'json' };
import resolveInputSchema from '../../src/schemas/map.resolve.input.json' assert { type: 'json' };
import resolveOutputSchema from '../../src/schemas/map.resolve.output.json' assert { type: 'json' };
import updateInputSchema from '../../src/schemas/map.update.input.json' assert { type: 'json' };
import updateOutputSchema from '../../src/schemas/map.update.output.json' assert { type: 'json' };
import deleteInputSchema from '../../src/schemas/map.delete.input.json' assert { type: 'json' };
import deleteOutputSchema from '../../src/schemas/map.delete.output.json' assert { type: 'json' };
import { handle as createHandle } from '../../src/tools/map.create.js';
import { handle as listHandle } from '../../src/tools/map.list.js';
import { handle as resolveHandle } from '../../src/tools/map.resolve.js';
import { handle as updateHandle } from '../../src/tools/map.update.js';
import { handle as deleteHandle } from '../../src/tools/map.delete.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const DEFAULT_MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const MAPPINGS_PATH_ENV = 'MCP_MAPPINGS_PATH';

const ajv = getAjv();
const validateCreateInput = ajv.compile(createInputSchema);
const validateCreateOutput = ajv.compile(createOutputSchema);
const validateListInput = ajv.compile(listInputSchema);
const validateListOutput = ajv.compile(listOutputSchema);
const validateResolveInput = ajv.compile(resolveInputSchema);
const validateResolveOutput = ajv.compile(resolveOutputSchema);
const validateUpdateInput = ajv.compile(updateInputSchema);
const validateUpdateOutput = ajv.compile(updateOutputSchema);
const validateDeleteInput = ajv.compile(deleteInputSchema);
const validateDeleteOutput = ajv.compile(deleteOutputSchema);

// Preserve original file state for cleanup
let originalMappings: string | null = null;
let originalMappingsPathEnv: string | undefined;
let currentTestTmpDir: string | null = null;

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const mappingsPath = currentMappingsPath();
  originalMappings = fs.existsSync(mappingsPath) ? fs.readFileSync(mappingsPath, 'utf8') : null;
});

afterAll(() => {
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }

  const mappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(mappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
    fs.writeFileSync(mappingsPath, originalMappings);
  }
});

function resetMappingsFile(): void {
  const mappingsPath = currentMappingsPath();
  const empty = {
    $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
    generatedAt: new Date().toISOString(),
    version: new Date().toISOString().slice(0, 10),
    stats: { mappingCount: 0, systemCount: 0 },
    mappings: [],
  };
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, JSON.stringify(empty, null, 2) + '\n');
}

function buildBenchMappings(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `bench-system-component-${String(index + 1).padStart(4, '0')}`,
    externalSystem: 'bench-system',
    externalComponent: `Component ${String(index + 1).padStart(4, '0')}`,
    oodsTraits: ['Stateful'],
    confidence: 'manual',
    metadata: {
      createdAt: '2026-04-16T00:00:00.000Z',
    },
  }));
}

function writeBenchMappings(count: number): void {
  const mappings = buildBenchMappings(count);
  const mappingsPath = currentMappingsPath();
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(
    mappingsPath,
    JSON.stringify(
      {
        $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
        generatedAt: '2026-04-16T00:00:00.000Z',
        version: '2026-04-16',
        stats: {
          mappingCount: mappings.length,
          systemCount: 1,
        },
        mappings,
      },
      null,
      2,
    ) + '\n',
  );
}

beforeEach(() => {
  currentTestTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-mappings-spec-'));
  process.env[MAPPINGS_PATH_ENV] = path.join(currentTestTmpDir, 'component-mappings.json');
});

afterEach(() => {
  if (currentTestTmpDir) {
    fs.rmSync(currentTestTmpDir, { recursive: true, force: true });
    currentTestTmpDir = null;
  }
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }
});

// ── Schema validation ──

describe('map.create schema validation', () => {
  it('accepts valid create input', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
      }),
    ).toBe(true);
  });

  it('accepts input with propMappings and metadata', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
        propMappings: [
          { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { contained: 'primary' } } },
          { externalProp: 'disabled', oodsProp: 'disabled', coercion: null },
        ],
        confidence: 'auto',
        metadata: { author: 'test', notes: 'test mapping' },
      }),
    ).toBe(true);
  });

  it('rejects input missing required fields', () => {
    expect(validateCreateInput({ externalSystem: 'material' })).toBe(false);
  });

  it('rejects empty oodsTraits', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: [],
      }),
    ).toBe(false);
  });

  it('rejects invalid confidence value', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
        confidence: 'maybe',
      }),
    ).toBe(false);
  });
});

describe('map.list schema validation', () => {
  it('accepts empty input', () => {
    expect(validateListInput({})).toBe(true);
  });

  it('accepts input with externalSystem filter', () => {
    expect(validateListInput({ externalSystem: 'material' })).toBe(true);
  });

  it('accepts pagination parameters', () => {
    expect(validateListInput({ cursor: 'bench-system-component-0100', limit: 100 })).toBe(true);
  });

  it('rejects limit above the max page size', () => {
    expect(validateListInput({ limit: 501 })).toBe(false);
  });
});

describe('map.resolve schema validation', () => {
  it('accepts valid resolve input', () => {
    expect(
      validateResolveInput({
        externalSystem: 'material',
        externalComponent: 'Button',
      }),
    ).toBe(true);
  });

  it('rejects input missing externalComponent', () => {
    expect(validateResolveInput({ externalSystem: 'material' })).toBe(false);
  });
});

// ── Handler tests ──

describe('map.create → map.list → map.resolve round-trip', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('creates a mapping and retrieves it via list and resolve', async () => {
    // Create
    const createResult = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { contained: 'primary' } } },
      ],
      confidence: 'manual',
    });

    expect(validateCreateOutput(createResult)).toBe(true);
    expect(createResult.status).toBe('ok');
    expect(createResult.mapping).toBeDefined();
    expect((createResult.mapping as any).id).toBe('material-button');
    expect(createResult.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(createResult.applied).toBe(true);

    // List
    const listResult = await listHandle({});
    expect(validateListOutput(listResult)).toBe(true);
    expect(listResult.totalCount).toBe(1);
    expect(listResult.stats.mappingCount).toBe(1);
    expect(listResult.stats.systemCount).toBe(1);

    // Resolve
    const resolveResult = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
    });
    expect(validateResolveOutput(resolveResult)).toBe(true);
    expect(resolveResult.status).toBe('ok');
    expect(resolveResult.mapping).toBeDefined();
    expect((resolveResult.mapping as any).oodsTraits).toEqual(['Stateful']);
    expect(resolveResult.propTranslations).toBeInstanceOf(Array);
    expect(resolveResult.propTranslations!.length).toBe(1);
    expect(resolveResult.propTranslations![0].externalProp).toBe('variant');
    expect(resolveResult.propTranslations![0].oodsProp).toBe('appearance');
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum');
  });

  it('resolve success uses the documented ok/not_found status model', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
    });

    expect(validateResolveOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.message).toBeUndefined();
  });
});

describe('map.create trait validation', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('warns on unknown trait references', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Slider',
      oodsTraits: ['NonExistentTrait'],
    });

    expect(result.status).toBe('ok');
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w: string) => w.includes('NonExistentTrait'))).toBe(true);
  });

  it('does not warn on known traits', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Chip',
      oodsTraits: ['Taggable', 'Stateful'],
    });

    expect(result.status).toBe('ok');
    // No warnings about unknown traits (both are real OODS traits)
    const traitWarnings = (result.warnings ?? []).filter((w: string) => w.includes('Unknown trait'));
    expect(traitWarnings.length).toBe(0);
  });
});

describe('map.list pagination', () => {
  beforeEach(() => {
    writeBenchMappings(250);
  });

  it('preserves legacy full-list behavior when cursor and limit are omitted', async () => {
    const result = await listHandle({});

    expect(validateListOutput(result)).toBe(true);
    expect(result.mappings).toHaveLength(250);
    expect(result.totalCount).toBe(250);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns paginated results with nextCursor when limit is provided', async () => {
    const result = await listHandle({ limit: 100 });

    expect(validateListOutput(result)).toBe(true);
    expect(result.mappings).toHaveLength(100);
    expect(result.totalCount).toBe(250);
    expect(result.nextCursor).toBe('bench-system-component-0100');
  });

  it('keeps cursor paging stable across concurrent map.create mutations', async () => {
    const firstPage = await listHandle({ limit: 100 });
    const seen = new Set(firstPage.mappings.map((mapping) => String((mapping as any).id)));

    await createHandle({
      apply: true,
      externalSystem: 'bench-system',
      externalComponent: 'Component 0050a',
      oodsTraits: ['Stateful'],
    });
    await createHandle({
      apply: true,
      externalSystem: 'bench-system',
      externalComponent: 'Component 0999',
      oodsTraits: ['Stateful'],
    });

    const secondPage = await listHandle({ cursor: firstPage.nextCursor, limit: 100 });
    const secondIds = secondPage.mappings.map((mapping) => String((mapping as any).id));

    expect(secondIds[0]).toBe('bench-system-component-0101');
    expect(secondIds.some((id) => seen.has(id))).toBe(false);
  });

  it('benchmarks paginated reads p99 within a relative warmup budget at 1000 mappings', async () => {
    writeBenchMappings(1000);

    // Warmup baseline (sprint-129 m04 de-flake): a RELATIVE budget vs a warmup on THIS runner, so it
    // is load-cancelling instead of the old absolute `p99 < 200ms` that flaked on loaded shared CI.
    // This benchmarks the PAGINATED-READ path (listHandle) — a distinct operation from the
    // registry-snapshot p99 benchmark, so the two co-located 1000-mapping budgets are intentional,
    // not a consolidation candidate.
    const warmup: number[] = [];
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const started = performance.now();
      await listHandle({ limit: 100 });
      warmup.push(performance.now() - started);
    }
    const baseline = [...warmup].sort((a, b) => a - b)[Math.floor(warmup.length / 2)];

    const durations: number[] = [];
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const started = performance.now();
      const result = await listHandle({ limit: 100 });
      durations.push(performance.now() - started);
      expect(result.mappings).toHaveLength(100);
      expect(result.totalCount).toBe(1000);
    }

    const sorted = [...durations].sort((left, right) => left - right);
    const p99 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1)];
    // p99 within 8x the warmup median, with the ORIGINAL 200ms as an absolute floor — never tighter
    // than the original on a fast runner, but with headroom that scales with the warmup on a LOADED
    // runner (where the old absolute flaked). Catches a gross per-op blowup; immune to shared load.
    expect(p99).toBeLessThan(Math.max(baseline * 8, 200));
  });
});

describe('map.create duplicate detection', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('rejects duplicate mapping for same system + component', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const duplicate = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(validateCreateOutput(duplicate)).toBe(true);
    expect(duplicate.status).toBe('error');
    expect(duplicate.applied).toBe(false);
    expect(duplicate.errors).toBeDefined();
    expect(duplicate.errors!.details.some((d) => d.field === 'externalSystem')).toBe(true);
  });

  it('allows same component name from different systems', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await createHandle({
      apply: true,
      externalSystem: 'ant-design',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).id).toBe('ant-design-button');
  });
});

describe('map.create apply flag', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('does not persist mappings when apply is false', async () => {
    const result = await createHandle({
      apply: false,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(validateCreateOutput(result)).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.warnings?.some((w: string) => w.includes('Dry run'))).toBe(true);

    const listResult = await listHandle({});
    expect(listResult.totalCount).toBe(0);
  });
});

describe('multi-system mappings', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('creates mappings from multiple systems and filters by system', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'TextField',
      oodsTraits: ['Labelled', 'Stateful'],
    });
    await createHandle({
      apply: true,
      externalSystem: 'chakra',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    // List all
    const allResult = await listHandle({});
    expect(allResult.totalCount).toBe(3);
    expect(allResult.stats.systemCount).toBe(2);

    // Filter by material
    const materialResult = await listHandle({ externalSystem: 'material' });
    expect(materialResult.totalCount).toBe(2);

    // Filter by chakra
    const chakraResult = await listHandle({ externalSystem: 'chakra' });
    expect(chakraResult.totalCount).toBe(1);

    // Filter by unknown system
    const unknownResult = await listHandle({ externalSystem: 'nonexistent' });
    expect(unknownResult.totalCount).toBe(0);
  });

  it('filters are case-insensitive', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await listHandle({ externalSystem: 'MATERIAL' });
    expect(result.totalCount).toBe(1);
  });
});

describe('map.resolve not found', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('returns not_found for unmapped component', async () => {
    const result = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'NonExistent',
    });

    expect(validateResolveOutput(result)).toBe(true);
    expect(result.status).toBe('not_found');
    expect(result.message).toBeDefined();
    expect(result.mapping).toBeUndefined();
  });
});

describe('map.resolve case-insensitive lookup', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('resolves regardless of case', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await resolveHandle({
      externalSystem: 'MATERIAL',
      externalComponent: 'button',
    });

    expect(result.status).toBe('ok');
  });
});

describe('map.create all coercion types', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('supports all four coercion strategies in prop mappings', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { a: 'b' } } },
        { externalProp: 'inverted', oodsProp: 'active', coercion: { type: 'boolean_to_string', trueValue: 'yes', falseValue: 'no' } },
        { externalProp: 'width', oodsProp: 'size', coercion: { type: 'template', pattern: '{{value}}px' } },
        { externalProp: 'passthrough', oodsProp: 'passthrough', coercion: { type: 'identity' } },
        { externalProp: 'label', oodsProp: 'text', coercion: null },
      ],
    });

    expect(result.status).toBe('ok');

    const resolveResult = await resolveHandle({
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
    });

    expect(resolveResult.propTranslations!.length).toBe(5);
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum');
    expect(resolveResult.propTranslations![1].coercionType).toBe('boolean_to_string');
    expect(resolveResult.propTranslations![2].coercionType).toBe('template');
    expect(resolveResult.propTranslations![3].coercionType).toBe('identity');
    // null coercion is normalized to identity
    expect(resolveResult.propTranslations![4].coercionType).toBe('identity');
  });
});

describe('map.create auto-generated metadata', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('sets createdAt timestamp automatically', async () => {
    const before = new Date().toISOString();
    const result = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });
    const after = new Date().toISOString();

    const mapping = result.mapping as any;
    expect(mapping.metadata.createdAt).toBeDefined();
    expect(mapping.metadata.createdAt >= before).toBe(true);
    expect(mapping.metadata.createdAt <= after).toBe(true);
  });

  it('preserves user-provided author and notes', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      metadata: { author: 'testuser', notes: 'Test mapping for CI' },
    });

    const mapping = result.mapping as any;
    expect(mapping.metadata.author).toBe('testuser');
    expect(mapping.metadata.notes).toBe('Test mapping for CI');
  });
});

describe('map.create defaults', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('defaults confidence to manual when omitted', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect((result.mapping as any).confidence).toBe('manual');
  });
});

// ── map.update tests ──

describe('map.update schema validation', () => {
  it('accepts valid update input', () => {
    expect(
      validateUpdateInput({
        id: 'material-button',
        updates: { confidence: 'auto' },
      }),
    ).toBe(true);
  });

  it('rejects update with empty updates', () => {
    expect(
      validateUpdateInput({
        id: 'material-button',
        updates: {},
      }),
    ).toBe(false);
  });
});

describe('map.update handler', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('updates confidence from manual to auto', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      confidence: 'manual',
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { confidence: 'auto' },
    });

    expect(validateUpdateOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.changes).toContain('confidence');
    expect((result.mapping as any).confidence).toBe('auto');
    expect((result.mapping as any).metadata.updatedAt).toBeDefined();
  });

  it('updates oodsTraits', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { oodsTraits: ['Stateful', 'Taggable'] },
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).oodsTraits).toEqual(['Stateful', 'Taggable']);
    expect(result.changes).toContain('oodsTraits');
  });

  it('updates notes in metadata', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { notes: 'Verified mapping' },
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).metadata.notes).toBe('Verified mapping');
    expect(result.changes).toContain('notes');
  });

  it('updates propMappings with new coercion', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: null },
      ],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: {
        propMappings: [
          { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { primary: 'filled' } } },
        ],
      },
    });

    expect(result.status).toBe('ok');
    expect(result.changes).toContain('propMappings');
  });

  it('returns error for invalid ID', async () => {
    const result = await updateHandle({
      id: 'nonexistent-mapping',
      updates: { confidence: 'auto' },
    });

    expect(validateUpdateOutput(result)).toBe(true);
    expect(result.status).toBe('error');
    expect(result.message).toContain('nonexistent-mapping');
  });

  it('persists updates visible to list', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      confidence: 'auto',
    });

    await updateHandle({
      id: 'material-button',
      updates: { confidence: 'manual' },
    });

    const listResult = await listHandle({});
    const mapping = listResult.mappings.find((m: any) => m.id === 'material-button') as any;
    expect(mapping.confidence).toBe('manual');
  });
});

// ── map.delete tests ──

describe('map.delete schema validation', () => {
  it('accepts valid delete input', () => {
    expect(validateDeleteInput({ id: 'material-button' })).toBe(true);
  });

  it('rejects delete without id', () => {
    expect(validateDeleteInput({})).toBe(false);
  });
});

describe('map.delete handler', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('deletes an existing mapping and returns the deleted summary object', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await deleteHandle({ id: 'material-button' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result.deleted!.id).toBe('material-button');
    expect(result.deleted!.externalSystem).toBe('material');
    expect(result.deleted!.externalComponent).toBe('Button');
  });

  it('map_list reflects deletion', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    await deleteHandle({ id: 'material-button' });

    const listResult = await listHandle({});
    expect(listResult.totalCount).toBe(0);
  });

  it('returns error for double-delete', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    await deleteHandle({ id: 'material-button' });
    const result = await deleteHandle({ id: 'material-button' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('error');
    expect(result.message).toContain('material-button');
  });

  it('returns error for nonexistent ID', async () => {
    const result = await deleteHandle({ id: 'nonexistent-mapping' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('error');
  });
});

// ── map_resolve + coercion integration ──

describe('map_resolve coercion integration', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('resolves enum coercion with mapping details', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Btn',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { primary: 'filled', secondary: 'outlined' } } },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Btn',
    });

    expect(result.status).toBe('ok');
    const translation = result.propTranslations![0];
    expect(translation.coercionType).toBe('enum');
    expect(translation.coercionDetail).toEqual({
      type: 'enum',
      mapping: { primary: 'filled', secondary: 'outlined' },
    });
  });

  it('normalizes null coercion to identity in resolution', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Input',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'value', oodsProp: 'value', coercion: null },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Input',
    });

    expect(result.propTranslations![0].coercionType).toBe('identity');
    expect(result.propTranslations![0].coercionDetail).toEqual({ type: 'identity' });
  });

  it('resolves boolean_to_string coercion details', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Toggle',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'checked', oodsProp: 'active', coercion: { type: 'boolean_to_string', trueValue: 'on', falseValue: 'off' } },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Toggle',
    });

    expect(result.propTranslations![0].coercionType).toBe('boolean_to_string');
    expect(result.propTranslations![0].coercionDetail).toEqual({
      type: 'boolean_to_string',
      trueValue: 'on',
      falseValue: 'off',
    });
  });
});

// ── s94-m03: Stage1 v1.6.0 raw-string coercion compatibility ──
// Stage1 bridge emits propMappings[].coercion as raw labels (enum-map | type-cast
// | identity) rather than structured CoercionDef objects. Public map_create must
// accept and round-trip these strings without losing information.

describe('map.create v1.6.0 string coercion compatibility (s94-m03)', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  for (const label of ['enum-map', 'type-cast', 'identity']) {
    it(`schema accepts coercion: '${label}' on a propMappings entry`, () => {
      expect(
        validateCreateInput({
          externalSystem: 'stripe',
          externalComponent: 'Button',
          oodsTraits: ['Stateful'],
          propMappings: [{ externalProp: 'variant', oodsProp: 'appearance', coercion: label }],
        }),
      ).toBe(true);
    });
  }

  it('schema rejects an empty-string coercion', () => {
    expect(
      validateCreateInput({
        externalSystem: 'stripe',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
        propMappings: [{ externalProp: 'variant', oodsProp: 'appearance', coercion: '' }],
      }),
    ).toBe(false);
  });

  it('handler round-trips a string coercion verbatim through persistence', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'stripe',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: 'enum-map' },
        { externalProp: 'kind', oodsProp: 'role', coercion: 'type-cast' },
        { externalProp: 'mode', oodsProp: 'mode', coercion: 'identity' },
        { externalProp: 'href', oodsProp: 'href', coercion: null },
      ],
    });

    expect(result.status).toBe('ok');
    const persisted = JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8'));
    const propMappings = persisted.mappings[0].propMappings;
    expect(propMappings).toEqual([
      { externalProp: 'variant', oodsProp: 'appearance', coercion: 'enum-map' },
      { externalProp: 'kind', oodsProp: 'role', coercion: 'type-cast' },
      { externalProp: 'mode', oodsProp: 'mode', coercion: 'identity' },
      { externalProp: 'href', oodsProp: 'href', coercion: null },
    ]);
  });

  it('mixes structured + string coercion in one propMappings array', async () => {
    const result = await createHandle({
      apply: true,
      externalSystem: 'mixed-system',
      externalComponent: 'Field',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'kind', oodsProp: 'kind', coercion: { type: 'enum', mapping: { a: 'b' } } },
        { externalProp: 'shape', oodsProp: 'shape', coercion: 'enum-map' },
      ],
    });
    expect(result.status).toBe('ok');
    expect((result.mapping as any).propMappings[0].coercion).toEqual({ type: 'enum', mapping: { a: 'b' } });
    expect((result.mapping as any).propMappings[1].coercion).toBe('enum-map');
  });

  it('map.resolve surfaces string coercion as coercionType + null coercionDetail', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'stripe',
      externalComponent: 'Card',
      oodsTraits: ['Stateful'],
      propMappings: [{ externalProp: 'variant', oodsProp: 'appearance', coercion: 'enum-map' }],
    });
    const result = await resolveHandle({ externalSystem: 'stripe', externalComponent: 'Card' });
    expect(result.status).toBe('ok');
    const translation = result.propTranslations![0];
    expect(translation.coercionType).toBe('enum-map');
    expect(translation.coercionDetail).toBeNull();
  });

  it('map.update accepts string coercion and persists round-trip', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'linear',
      externalComponent: 'Row',
      oodsTraits: ['Listable'],
      propMappings: [{ externalProp: 'kind', oodsProp: 'kind', coercion: null }],
    });
    const updated = await updateHandle({
      id: 'linear-row',
      updates: {
        propMappings: [{ externalProp: 'kind', oodsProp: 'kind', coercion: 'type-cast' }],
      },
    });
    expect(updated.status).toBe('ok');
    const persisted = JSON.parse(fs.readFileSync(currentMappingsPath(), 'utf8'));
    expect(persisted.mappings[0].propMappings[0].coercion).toBe('type-cast');
  });
});

// ── s92-m01: projection_variants[] write-path activation ──
// Aligns with Stage1 contract v1.5.0 §7.3. Unblocks bridge payloads that
// include per-mapping cross-surface identity variants.

describe('map.create projection_variants[] schema validation (s92-m01)', () => {
  it('accepts a minimal projection_variants entry (id + surface)', () => {
    expect(
      validateCreateInput({
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        projection_variants: [{ id: 'variant-1', surface: 'desktop' }],
      }),
    ).toBe(true);
  });

  it('accepts the full projection_variants shape from Stage1 v1.5.0 §7.3', () => {
    expect(
      validateCreateInput({
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        projection_variants: [
          {
            id: 'variant-1',
            surface: 'desktop',
            external_component: 'IssueRow',
            capability_id: 'cap-1',
            selector: '.issue-row',
            confidence: 0.92,
            evidence_chain: [{ pass: 'dom.components' }],
            metadata: { notes: 'primary surface' },
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects projection_variants entry missing required surface', () => {
    expect(
      validateCreateInput({
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        projection_variants: [{ id: 'variant-1' }],
      }),
    ).toBe(false);
  });

  it('still rejects unknown top-level fields on map.create input (additionalProperties:false preserved)', () => {
    expect(
      validateCreateInput({
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        bogus_field: 'should reject',
      }),
    ).toBe(false);
  });

  it('rejects confidence outside [0, 1] on a projection variant', () => {
    expect(
      validateCreateInput({
        externalSystem: 'linear',
        externalComponent: 'Issue Row',
        oodsTraits: ['Listable'],
        projection_variants: [{ id: 'variant-1', surface: 'desktop', confidence: 1.5 }],
      }),
    ).toBe(false);
  });
});

describe('map.create projection_variants[] handler persistence (s92-m01)', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('persists projection_variants[] on apply:true and round-trips through list', async () => {
    const variants = [
      { id: 'variant-1', surface: 'desktop', selector: '.issue-row', confidence: 0.9 },
      { id: 'variant-2', surface: 'mobile', external_component: 'IssueCard' },
    ];

    const createResult = await createHandle({
      apply: true,
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
      projection_variants: variants,
    });

    expect(validateCreateOutput(createResult)).toBe(true);
    expect(createResult.status).toBe('ok');
    expect((createResult.mapping as any).projection_variants).toEqual(variants);

    // Round-trip: file on disk must carry the field losslessly.
    const listResult = await listHandle({});
    const persisted = listResult.mappings.find((m: any) => m.id === 'linear-issue-row') as any;
    expect(persisted).toBeDefined();
    expect(persisted.projection_variants).toEqual(variants);
  });

  it('does not persist projection_variants[] on apply:false (dry-run)', async () => {
    const result = await createHandle({
      apply: false,
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
      projection_variants: [{ id: 'variant-1', surface: 'desktop' }],
    });

    expect(result.status).toBe('ok');
    expect(result.applied).toBe(false);
    // The dry-run response still includes the constructed mapping, including the variants.
    expect((result.mapping as any).projection_variants).toEqual([
      { id: 'variant-1', surface: 'desktop' },
    ]);

    // But the file on disk has no such mapping.
    const listResult = await listHandle({});
    expect(listResult.totalCount).toBe(0);
  });

  it('omits projection_variants from the persisted mapping when not provided', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
    });

    const listResult = await listHandle({});
    const persisted = listResult.mappings.find((m: any) => m.id === 'linear-issue-row') as any;
    expect(persisted).toBeDefined();
    expect('projection_variants' in persisted).toBe(false);
  });

  it('omits projection_variants when input provides an empty array', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
      projection_variants: [],
    });

    const listResult = await listHandle({});
    const persisted = listResult.mappings.find((m: any) => m.id === 'linear-issue-row') as any;
    expect('projection_variants' in persisted).toBe(false);
  });
});

// ── s95-m01: combined synthetic smoke for the last open Stage1 activation probe ──
// Exercises the one shape that remained unproven after s92/s94: a single
// map.create payload carrying BOTH projection_variants[] and raw-string
// propMappings[].coercion labels, first as a dry-run, then persisted and
// round-tripped through map.resolve.
describe('map.create combined projection_variants[] + string coercion smoke (s95-m01)', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('accepts the combined Stage1-shaped payload via dry-run and resolves it losslessly after apply:true', async () => {
    const payload = {
      externalSystem: 'stage1-synthetic',
      externalComponent: 'Capability Card',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: 'enum-map' },
        { externalProp: 'kind', oodsProp: 'role', coercion: 'type-cast' },
      ],
      projection_variants: [
        {
          id: 'capability-card-desktop',
          surface: 'desktop',
          external_component: 'CapabilityCard',
          capability_id: 'cap-capability-card',
          selector: '[data-capability-card]',
          confidence: 0.93,
          evidence_chain: [{ pass: 'dom.components', note: 'Synthetic s95-m01 smoke payload' }],
        },
        {
          id: 'capability-card-mobile',
          surface: 'mobile',
          external_component: 'CapabilityCardMobile',
          selector: '[data-capability-card-mobile]',
        },
      ],
    } as const;

    expect(validateCreateInput(payload)).toBe(true);

    const dryRun = await createHandle({
      ...payload,
      apply: false,
    });

    expect(validateCreateOutput(dryRun)).toBe(true);
    expect(dryRun.status).toBe('ok');
    expect(dryRun.applied).toBe(false);
    expect((dryRun.mapping as any).projection_variants).toEqual(payload.projection_variants);
    expect((dryRun.mapping as any).propMappings).toEqual(payload.propMappings);

    const afterDryRun = await listHandle({});
    expect(afterDryRun.totalCount).toBe(0);

    const persisted = await createHandle({
      ...payload,
      apply: true,
    });

    expect(validateCreateOutput(persisted)).toBe(true);
    expect(persisted.status).toBe('ok');
    expect(persisted.applied).toBe(true);

    const resolved = await resolveHandle({
      externalSystem: payload.externalSystem,
      externalComponent: payload.externalComponent,
    });

    expect(validateResolveOutput(resolved)).toBe(true);
    expect(resolved.status).toBe('ok');
    expect((resolved.mapping as any).projection_variants).toEqual(payload.projection_variants);
    expect(resolved.propTranslations).toEqual([
      {
        externalProp: 'variant',
        oodsProp: 'appearance',
        coercionType: 'enum-map',
        coercionDetail: null,
      },
      {
        externalProp: 'kind',
        oodsProp: 'role',
        coercionType: 'type-cast',
        coercionDetail: null,
      },
    ]);
  });
});

// s228-m02: no team should discover a collision or a missing local export only after composing a screen.
describe('map.create checks a whole team mapping list before one write', () => {
  it.each(['mappings', 'mappingsPath'] as const)('s229: %s rejects case variants against the store and inside a list without writing', async form => {
    const original = { externalSystem: 'acme', externalComponent: 'DataTable', oodsTraits: ['Stateful'] };
    const variant = { ...original, externalSystem: 'ACME', externalComponent: 'DATATABLE' };
    const submit = (mappings: typeof original[]) => {
      if (form === 'mappings') return createHandle({ mappings, apply: true });
      const mappingsPath = path.join(currentTestTmpDir!, 'input.json');
      fs.writeFileSync(mappingsPath, JSON.stringify({ mappings }));
      return createHandle({ mappingsPath, apply: true });
    };
    const within = await submit([original, variant]);
    expect(within).toMatchObject({ status: 'error', applied: false });
    expect(within.entries[1].errors?.[0]).toMatchObject({ code: 'OODS-V219' });
    expect(within.entries[1].errors?.[0].message).toContain('acme/DataTable');
    expect(within.entries[1].errors?.[0].message).toContain('ACME/DATATABLE');
    expect(fs.existsSync(currentMappingsPath())).toBe(false);
    await createHandle({ ...original, apply: true });
    const before = fs.readFileSync(currentMappingsPath(), 'utf8');
    const stored = await submit([variant]);
    expect(stored).toMatchObject({ status: 'error', applied: false });
    expect(stored.entries[0].errors?.[0]).toMatchObject({ code: 'OODS-V219' });
    expect(stored.entries[0].errors?.[0].message).toContain('acme/DataTable');
    expect(stored.entries[0].errors?.[0].message).toContain('ACME/DATATABLE');
    expect(fs.readFileSync(currentMappingsPath(), 'utf8')).toBe(before);
    expect(await submit([{ ...original, externalComponent: 'Button' }, { ...original, externalComponent: 'Input' }])).toMatchObject({ status: 'ok', applied: true });
  });

  it.each([false, true])('s229: create, update and delete preserve the shared mapping target (symlink=%s)', async linked => {
    const mappingPath = currentMappingsPath();
    const target = linked ? path.join(currentTestTmpDir!, 'shared.json') : mappingPath;
    resetMappingsFile();
    if (linked) { fs.renameSync(mappingPath, target); fs.symlinkSync('shared.json', mappingPath); }
    const read = () => {
      expect(fs.lstatSync(mappingPath).isSymbolicLink()).toBe(linked);
      return JSON.parse(fs.readFileSync(target, 'utf8')).mappings;
    };
    const result = await createHandle({ externalSystem: 'acme', externalComponent: 'DataTable', oodsTraits: ['Stateful'], apply: true });
    expect(read()).toHaveLength(1);
    await updateHandle({ id: result.mapping.id, updates: { notes: 'shared edit' } });
    expect(read()[0].metadata.notes).toBe('shared edit');
    await deleteHandle({ id: result.mapping.id });
    expect(read()).toEqual([]);
  });

  it('s229: a dangling mappings link is refused by name instead of silently replaced', async () => {
    const mappingPath = currentMappingsPath();
    fs.symlinkSync('missing.json', mappingPath);
    await expect(createHandle({ externalSystem: 'acme', externalComponent: 'DataTable', oodsTraits: ['Stateful'], apply: true })).rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringContaining(mappingPath) });
    expect(fs.lstatSync(mappingPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(currentTestTmpDir!, 'missing.json'))).toBe(false);
  });

  const entry = (externalComponent = 'TeamButton', component = 'Button') => ({
    externalSystem: 'batch-team', externalComponent, oodsTraits: ['Stateful'],
    substitution: { component, react: { package: '@batch-team/components/react', version: '1.0.0', export: externalComponent } },
  });
  function localEntry() {
    const directory = path.join(currentTestTmpDir!, 'package');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: '@batch-team/components', version: '1.0.0', type: 'module', exports: { './react': { types: './react.d.ts', import: './react.js' } } }));
    fs.writeFileSync(path.join(directory, 'react.js'), "throw new Error('must never execute the component package');\nexport { Button as TeamButton } from './button.js';\n");
    fs.writeFileSync(path.join(directory, 'button.js'), 'export function Button() {}\n');
    const input = entry();
    return { directory, input: { ...input, substitution: { ...input.substitution, react: { ...input.substitution.react, localPath: directory } } } };
  }
  function diskContents() { return fs.existsSync(currentMappingsPath()) ? fs.readFileSync(currentMappingsPath(), 'utf8') : null; }

  it('returns every entry outcome and applies the complete list; dry run returns valid entries without writing', async () => {
    const mappings = [entry(), entry('TeamInput', 'Input')];
    expect(validateCreateInput({ mappings })).toBe(true);
    const dry = await createHandle({ mappings });
    expect(validateCreateOutput(dry)).toBe(true);
    expect(dry).toMatchObject({ status: 'ok', applied: false, entries: [
      { index: 0, id: 'batch-team-team-button', status: 'valid', applied: false },
      { index: 1, id: 'batch-team-team-input', status: 'valid', applied: false },
    ] });
    expect(diskContents()).toBeNull();
    const rename = vi.spyOn(fs, 'renameSync');
    const saved = await createHandle({ mappings, apply: true });
    expect(rename).toHaveBeenCalledTimes(1);
    rename.mockRestore();
    expect(validateCreateOutput(saved)).toBe(true);
    expect(saved.entries.every(outcome => outcome.applied && outcome.status === 'valid')).toBe(true);
    expect(JSON.parse(diskContents()!).mappings.map((mapping: { id: string }) => mapping.id)).toEqual(saved.entries.map(outcome => outcome.id));
    expect(fs.readdirSync(currentTestTmpDir!).filter(name => name.endsWith('.partial'))).toEqual([]);
  });

  it('keeps the previous store intact if the atomic rename fails', async () => {
    await createHandle({ ...entry(), apply: true });
    const before = diskContents();
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('planted rename failure'); });
    try {
      await expect(createHandle({ mappings: [entry('TeamInput', 'Input')], apply: true })).rejects.toThrow('planted rename failure');
    } finally { rename.mockRestore(); }
    expect(diskContents()).toBe(before);
    expect(fs.readdirSync(currentTestTmpDir!).filter(name => name.endsWith('.partial'))).toEqual([]);
  });

  it('names the bad entry and saves none of the list, including its otherwise valid entries', async () => {
    const mappings = [entry(), { ...entry('TeamInput', 'Input'), oodsTraits: [] }];
    const result = await createHandle({ mappings, apply: true });
    expect(result).toMatchObject({ status: 'error', applied: false, entries: [
      { index: 0, status: 'valid', applied: false },
      { index: 1, id: 'batch-team-team-input', status: 'invalid', applied: false, errors: [{ code: 'OODS-V219', message: expect.stringContaining("Entry 1 ('batch-team-team-input')") }] },
    ] });
    expect(validateCreateOutput(result)).toBe(true);
    expect(diskContents()).toBeNull();
  });

  it('the duplicate-component guard bites on a planted second Button, even with distinct mapping ids', async () => {
    const result = await createHandle({ apply: true, mappings: [entry(), entry('OtherButton')] });
    expect(result).toMatchObject({ status: 'error', entries: [
      { status: 'valid', applied: false },
      { id: 'batch-team-other-button', status: 'invalid', errors: [{ code: 'OODS-V219', message: expect.stringContaining("shipped component 'Button'") }] },
    ] });
    expect(diskContents()).toBeNull();
  });

  it('refuses a component already mapped in the store and preserves the stored bytes', async () => {
    await createHandle({ ...entry(), apply: true });
    const before = diskContents();
    const result = await createHandle({ apply: true, mappings: [entry('OtherButton'), entry('TeamInput', 'Input')] });
    expect(result.status).toBe('error');
    expect(result.entries[0].errors?.[0].message).toContain("mapping 'batch-team-team-button'");
    expect(result.entries.every(outcome => !outcome.applied)).toBe(true);
    expect(diskContents()).toBe(before);
    await expect(createHandle({ ...entry('AnotherButton'), apply: true })).rejects.toMatchObject({ opiCode: 'OODS-V219', details: { index: 0, id: 'batch-team-another-button' } });
    expect(diskContents()).toBe(before);
  });

  it('refuses duplicate generated ids and does not permit entry-local apply flags', async () => {
    const duplicate = { ...entry('TeamInput', 'Input'), externalComponent: 'Team Button' };
    const result = await createHandle({ apply: true, mappings: [entry(), duplicate] });
    expect(result.entries[1]).toMatchObject({ status: 'invalid', errors: [{ code: 'OODS-V219', message: expect.stringContaining('mapping id') }] });
    expect(diskContents()).toBeNull();
    const withApply = await createHandle({ mappings: [{ ...entry(), apply: true }] } as any);
    expect(withApply.entries[0]).toMatchObject({ status: 'invalid', applied: false, errors: [{ code: 'OODS-V219' }] });
    expect(validateCreateInput({ mappings: [entry()], mappingsPath: '/absolute/mappings.json' })).toBe(false);
    expect(validateCreateInput({ mappings: [entry()], externalSystem: 'mixed' })).toBe(false);
  });

  it('validates a local exact version and re-export without executing the package', async () => {
    const { input } = localEntry();
    const result = await createHandle({ apply: true, mappings: [input] });
    expect(result).toMatchObject({ status: 'ok', entries: [{ status: 'valid', applied: true }] });
    expect(JSON.parse(diskContents()!).mappings[0].substitution).toMatchObject(input.substitution);
  });

  it.each(['version', 'name', 'missing-file', 'missing-export', 'comment-only'])('refuses %s in a local package before any mapping is saved', async failure => {
    const { input, directory } = localEntry();
    if (failure === 'version') input.substitution.react.version = '2.0.0';
    if (failure === 'name') input.substitution.react.package = '@another/components/react';
    if (failure === 'missing-file') fs.unlinkSync(path.join(directory, 'react.js'));
    if (failure === 'missing-export') input.substitution.react.export = 'Missing';
    if (failure === 'comment-only') fs.writeFileSync(path.join(directory, 'react.js'), "// export const TeamButton = true;\nconst text = 'export function TeamButton() {}';\nexport const Actual = true;\n");
    const result = await createHandle({ apply: true, mappings: [input, entry('TeamInput', 'Input')] });
    expect(result).toMatchObject({ status: 'error', applied: false, entries: [
      { index: 0, id: 'batch-team-team-button', status: 'invalid', errors: [{ code: 'OODS-V219', message: expect.stringContaining("Entry 0 ('batch-team-team-button'): substitution.react:") }] },
      { index: 1, status: 'valid', applied: false },
    ] });
    expect(diskContents()).toBeNull();
  });

  it('mappingsPath performs the same validation as the inline list and cannot contain apply', async () => {
    const mappings = [entry(), entry('TeamInput', 'Input')];
    const mappingsPath = path.join(currentTestTmpDir!, 'mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify({ mappings }));
    expect(validateCreateInput({ mappingsPath })).toBe(true);
    const inline = await createHandle({ mappings });
    const file = await createHandle({ mappingsPath });
    const validation = (result: typeof inline) => result.entries.map(({ mapping: _mapping, ...outcome }) => outcome);
    expect(validation(file)).toEqual(validation(inline));
    expect(diskContents()).toBeNull();
    fs.writeFileSync(mappingsPath, JSON.stringify({ mappings: [{ ...entry(), apply: true }] }));
    const invalid = await createHandle({ mappingsPath, apply: true });
    expect(invalid.entries[0]).toMatchObject({ status: 'invalid', errors: [{ code: 'OODS-V219' }] });
    expect(diskContents()).toBeNull();
  });

  it('checks and maps the shipped Harbor file once after the documented absolute-path preparation', async () => {
    const directory = path.resolve(import.meta.dirname, '../../../foundry/quickstart/team-components');
    const source = JSON.parse(fs.readFileSync(path.join(directory, 'mappings.json'), 'utf8'));
    for (const mapping of source.mappings) for (const framework of ['react', 'vue']) mapping.substitution[framework].localPath = directory;
    const mappingsPath = path.join(currentTestTmpDir!, 'harbor-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify(source));
    const result = await createHandle({ mappingsPath, apply: true });
    expect(result).toMatchObject({ status: 'ok', applied: true, entries: [{ id: 'harbor-team-button', status: 'valid', applied: true }] });
    expect(JSON.parse(diskContents()!).mappings[0].substitution.component).toBe('Button');
  });
});
