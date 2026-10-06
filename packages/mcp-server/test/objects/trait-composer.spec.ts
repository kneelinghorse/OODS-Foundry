import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeObject } from '../../src/objects/trait-composer.js';
import { clearObjectCache, listObjects, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import * as traitLoader from '../../src/objects/trait-loader.js';
import type { ObjectDefinition } from '../../src/objects/types.js';

describe('trait-composer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearObjectCache();
    clearTraitCache();
  });

  it.each([
    ['MarkArea', 'area', 'VizAreaPreview'],
    ['MarkBar', 'bar', 'VizMarkPreview'],
    ['MarkLine', 'line', 'VizLinePreview'],
    ['MarkPoint', 'scatter', 'VizPointPreview'],
    ['MarkRect', 'heatmap', 'VizHeatmapPreview'],
  ])('projects bound %s without standalone controls or encoding fields', (mark, chartType, component) => {
    const object = structuredClone(loadObject('Invoice'));
    const chart = { source: 'record-array', chartType, dataField: 'measurements', sampleRows: [{ x: 1, y: 2 }], encodings: { x: 'x', y: 'y' } };
    object.traits = [{ name: `viz/${mark}`, parameters: { chart, title: 'Recorded measurements', description: 'A declared example series.' } }];
    const composed = composeObject(object);
    const definition = composed.traits[0]!.definition;
    expect(definition.schema).toEqual({});
    expect(definition.semantics).toEqual({});
    expect(definition.dependencies).toEqual([]);
    expect(Object.keys(composed.schema).filter(field => field.startsWith('viz_'))).toEqual([]);
    expect(composed.viewExtensions.detail).toEqual([{ component, position: 'top', priority: 55, props: { chart, title: 'Recorded measurements', description: 'A declared example series.' } }]);
    expect(composed.viewExtensions.form).toBeUndefined();
    if (mark === 'MarkBar' || mark === 'MarkLine') expect(composed.viewExtensions.dashboard).toEqual(composed.viewExtensions.detail);
    else expect(composed.viewExtensions.dashboard).toBeUndefined();
    expect(composed.viewExtensions.detail![0]!.props!.chart).not.toBe(chart);
  });

  it('rejects a mismatched chart type instead of rendering the wrong mark', () => {
    const object = structuredClone(loadObject('Invoice'));
    object.traits = [{ name: 'viz/MarkBar', parameters: { chart: { chartType: 'line' } } }];
    expect(() => composeObject(object)).toThrow('requires chartType "bar"');
  });

  it('rejects a loaded but unknown bound Mark instead of leaking editor controls', () => {
    const object = structuredClone(loadObject('Invoice'));
    object.traits = [{ name: 'viz/MarkBar', parameters: { chart: { chartType: 'bar' } } }];
    const unknown = structuredClone(traitLoader.loadTrait('viz/MarkBar'));
    unknown.trait.name = 'MarkUnknown';
    vi.spyOn(traitLoader, 'loadTrait').mockReturnValueOnce(unknown);
    expect(() => composeObject(object)).toThrow('has no supported preview projection');
  });

  it('composes a real object (User) with merged schema', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    expect(composed.object.name).toBe('User');
    expect(composed.traits.length).toBeGreaterThan(0);

    // Object's own fields should be present
    expect(composed.schema.user_id).toBeDefined();
    expect(composed.schema.name).toBeDefined();
    expect(composed.schema.role).toBeDefined();

    // Trait-contributed fields should be present (from Timestampable)
    expect(composed.schema.created_at).toBeDefined();
    expect(composed.schema.updated_at).toBeDefined();
  });

  it('composes a real object (Product) with trait view_extensions', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    expect(composed.object.name).toBe('Product');

    // Priceable trait contributes view_extensions to detail, list, card
    expect(composed.viewExtensions.detail).toBeDefined();
    expect(composed.viewExtensions.detail.length).toBeGreaterThan(0);
  });

  it('merges tokens with object override', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    // Object tokens should be present
    for (const [key, value] of Object.entries(user.tokens)) {
      expect(composed.tokens[key]).toBe(value);
    }
  });

  it('merges semantics from traits and object', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    // Object semantics should be present
    expect(composed.semantics.user_id).toBeDefined();
    expect(composed.semantics.user_id.semantic_type).toBeDefined();

    // Trait-contributed semantics should also be present (from Timestampable)
    expect(composed.semantics.created_at).toBeDefined();
  });

  it('handles object with 0 traits gracefully', () => {
    const bare: ObjectDefinition = {
      object: {
        name: 'Bare',
        version: '0.0.1',
        domain: 'test',
        description: 'No traits',
      },
      traits: [],
      schema: {
        id: { type: 'uuid', required: true, description: 'Primary key' },
      },
      semantics: {},
      tokens: { 'test.id': 'var(--text)' },
      metadata: {},
    };

    const composed = composeObject(bare);

    expect(composed.object.name).toBe('Bare');
    expect(composed.traits).toHaveLength(0);
    expect(composed.schema.id).toBeDefined();
    expect(Object.keys(composed.viewExtensions)).toHaveLength(0);
    expect(composed.tokens['test.id']).toBe('var(--text)');
    expect(composed.warnings).toHaveLength(0);
  });

  it('handles traits with no view_extensions gracefully', () => {
    // Taggable and some other traits may not have view_extensions
    // This test verifies the composer doesn't crash on empty view_extensions
    const user = loadObject('User');
    const composed = composeObject(user);
    // Should succeed without errors
    expect(composed).toBeDefined();
  });

  it('detects field collisions with warnings', () => {
    const conflicting: ObjectDefinition = {
      object: {
        name: 'Conflicting',
        version: '0.0.1',
        domain: 'test',
        description: 'Tests collisions',
      },
      traits: [
        { name: 'lifecycle/Stateful' },
        { name: 'lifecycle/Timestampable' },
      ],
      schema: {
        // This field also exists in Timestampable trait
        created_at: {
          type: 'string',
          required: true,
          description: 'Object override of trait field',
        },
      },
      semantics: {},
      tokens: {},
      metadata: {},
    };

    const composed = composeObject(conflicting);

    // s211-m01: an object refining a trait field is reported once, naming the field by its trait.
    expect(composed.warnings).toEqual([
      'Conflicting refines 1 field its traits define, and its own definition is used: lifecycle/Timestampable (created_at).',
    ]);

    // Object's own definition should win for created_at
    expect(composed.schema.created_at.description).toBe(
      'Object override of trait field',
    );
  });

  it('resolves view_extension priorities (higher priority first)', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    // For each context, extensions should be sorted by priority descending
    for (const [, extensions] of Object.entries(composed.viewExtensions)) {
      for (let i = 1; i < extensions.length; i++) {
        const prevPriority = extensions[i - 1].priority ?? 0;
        const currPriority = extensions[i].priority ?? 0;
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    }
  });

  it('trait declaration order breaks priority ties', () => {
    // When two traits have the same priority (or both undefined = 0),
    // earlier declared trait's extensions come first
    const user = loadObject('User');
    const composed = composeObject(user);
    // This should complete without error; ordering is deterministic
    expect(composed.viewExtensions).toBeDefined();
  });

  it('object tokens override trait tokens', () => {
    // Build an object that has a token key matching a trait token
    const product = loadObject('Product');
    const composed = composeObject(product);

    // Product defines its own tokens; those should be in the final map
    for (const [key, value] of Object.entries(product.tokens)) {
      expect(composed.tokens[key]).toBe(value);
    }
  });

  it('resolves all traits for all known objects without error', () => {
    // Smoke test: compose every known object
    const names = listObjects();

    for (const name of names) {
      const obj = loadObject(name);
      const composed = composeObject(obj);
      expect(composed.object.name).toBe(name);
      expect(composed.schema).toBeDefined();
    }
  });

  it('rejects an incomplete object when a required trait cannot be loaded', () => {
    const broken: ObjectDefinition = {
      object: {
        name: 'Broken',
        version: '0.0.1',
        domain: 'test',
        description: 'References a non-existent trait',
      },
      traits: [{ name: 'nonexistent/FakeTrait' }],
      schema: {},
      semantics: {},
      tokens: {},
      metadata: {},
    };

    expect(() => composeObject(broken)).toThrow(expect.objectContaining({
      opiCode: 'OODS-V215',
      message: expect.stringContaining('nonexistent/FakeTrait'),
    }));
  });

  it('resolvedTraits include ref and definition', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    for (const resolved of composed.traits) {
      expect(resolved.ref).toBeDefined();
      expect(resolved.ref.name).toBeDefined();
      expect(resolved.definition).toBeDefined();
      expect(resolved.definition.trait.name).toBeDefined();
    }
  });

  it('collects view_extensions across multiple contexts', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    // Product uses Priceable (detail, list, card) + Timestampable (detail, list)
    // + possibly Stateful extensions
    const contexts = Object.keys(composed.viewExtensions);
    expect(contexts.length).toBeGreaterThanOrEqual(2);
  });
});
