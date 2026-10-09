import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { sanitizeSchema } from './sanitize-schema.js';

describe('sanitizeSchema', () => {
  // ── $ref replacement (preserved from stripRefs) ───────────────────

  it('replaces $ref with object stub', () => {
    const schema = {
      type: 'object',
      properties: {
        schema: { $ref: './repl.ui.schema.json' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.schema).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  it('replaces deeply nested $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            deep: { $ref: './something.json' },
          },
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.nested.properties.deep).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  // ── Top-level meta-keyword stripping ──────────────────────────────

  it('strips top-level $schema, $id, and title', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/test.json',
      title: 'Test Schema',
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const result = sanitizeSchema(schema);
    expect(result).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
  });

  it('preserves title in nested properties', () => {
    const schema = {
      title: 'Root Title',
      type: 'object',
      properties: {
        field: { type: 'string', title: 'Field Title' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('title');
    expect(result.properties.field.title).toBe('Field Title');
  });

  // ── Top-level allOf stripping ─────────────────────────────────────

  it('strips top-level allOf (repl.render pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.render.input.json',
      title: 'Agentic REPL render input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'], default: 'full' },
        schema: { $ref: './repl.ui.schema.json' },
      },
      required: ['mode'],
      allOf: [
        {
          if: { properties: { mode: { const: 'full' } } },
          then: { required: ['schema'] },
        },
        {
          if: { properties: { mode: { const: 'patch' } } },
          then: { required: ['patch'] },
        },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('allOf');
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['mode']);
    expect(result.properties.mode).toEqual({
      type: 'string',
      enum: ['full', 'patch'],
      default: 'full',
    });
    // $ref should be replaced
    expect(result.properties.schema).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  it('strips top-level allOf (repl.validate pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.validate.input.json',
      title: 'Agentic REPL validate input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'] },
      },
      required: ['mode'],
      allOf: [
        { if: { properties: { mode: { const: 'full' } } }, then: { required: ['schema'] } },
        { if: { properties: { mode: { const: 'patch' } } }, then: { required: ['patch'] } },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('allOf');
    expect(result.required).toEqual(['mode']);
  });

  it('strips top-level oneOf', () => {
    const schema = {
      type: 'object',
      oneOf: [
        { properties: { a: { type: 'string' } } },
        { properties: { b: { type: 'number' } } },
      ],
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('oneOf');
    expect(result.type).toBe('object');
  });

  it('strips top-level anyOf', () => {
    const schema = {
      type: 'object',
      anyOf: [
        { properties: { x: { type: 'string' } } },
        { properties: { y: { type: 'number' } } },
      ],
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('anyOf');
  });

  // ── Nested oneOf/anyOf flattening ─────────────────────────────────

  it('flattens nested oneOf to first variant (brand.apply delta pattern)', () => {
    const schema = {
      type: 'object',
      properties: {
        delta: {
          description: 'Alias changes or RFC 6902 patch array.',
          oneOf: [
            { type: 'object' },
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  op: { type: 'string' },
                  path: { type: 'string' },
                },
              },
            },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // oneOf should be flattened — first variant merged into parent
    expect(result.properties.delta).toEqual({
      description: 'Alias changes or RFC 6902 patch array.',
      type: 'object',
    });
    expect(result.properties.delta).not.toHaveProperty('oneOf');
  });

  it('flattens nested oneOf to first variant (map.create coercion pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        propMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              coercion: {
                oneOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    required: ['type'],
                    properties: {
                      type: { type: 'string', enum: ['enum-map', 'boolean-invert'] },
                    },
                  },
                ],
                default: null,
              },
            },
          },
        },
      },
    };
    const result = sanitizeSchema(schema);
    const coercion = result.properties.propMappings.items.properties.coercion;
    expect(coercion).not.toHaveProperty('oneOf');
    expect(coercion.type).toBe('null');
    expect(coercion.default).toBeNull();
  });

  it('flattens nested anyOf to first variant', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          description: 'Mixed type value.',
          anyOf: [
            { type: 'string' },
            { type: 'number' },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.value).toEqual({
      description: 'Mixed type value.',
      type: 'string',
    });
  });

  // ── Passthrough / identity cases ──────────────────────────────────

  it('passes through primitives unchanged', () => {
    expect(sanitizeSchema(null)).toBeNull();
    expect(sanitizeSchema(42)).toBe(42);
    expect(sanitizeSchema('hello')).toBe('hello');
    expect(sanitizeSchema(true)).toBe(true);
  });

  it('handles arrays', () => {
    const result = sanitizeSchema([{ type: 'string' }, { type: 'number' }]);
    expect(result).toEqual([{ type: 'string' }, { type: 'number' }]);
  });

  it('preserves a clean schema unchanged', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).toEqual(schema);
  });

  it('preserves description, default, enum, and other standard keywords', () => {
    const schema = {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['a', 'b'],
          default: 'a',
          description: 'The mode.',
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.mode).toEqual({
      type: 'string',
      enum: ['a', 'b'],
      default: 'a',
      description: 'The mode.',
    });
  });

  // ── Full schema integration tests ─────────────────────────────────

  it('fully sanitizes a repl.render-like schema', () => {
    // Simulates the real repl.render.input.json
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.render.input.json',
      title: 'Agentic REPL render input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'], default: 'full' },
        schema: { $ref: './repl.ui.schema.json' },
        patch: { $ref: './repl.patch.json' },
        apply: { type: 'boolean' },
      },
      required: ['mode'],
      allOf: [
        { if: { properties: { mode: { const: 'full' } } }, then: { required: ['schema'] } },
        { if: { properties: { mode: { const: 'patch' } } }, then: { required: ['patch'] } },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);

    // No forbidden constructs
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('allOf');

    // Structure preserved
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['mode']);
    expect(result.additionalProperties).toBe(false);

    // $refs replaced
    expect(result.properties.schema.type).toBe('object');
    expect(result.properties.patch.type).toBe('object');

    // Simple properties preserved
    expect(result.properties.apply).toEqual({ type: 'boolean' });
  });

  it('fully sanitizes a brand.apply-like schema', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        brand: { type: 'string', enum: ['A'], default: 'A' },
        delta: {
          description: 'Alias changes or patch array.',
          oneOf: [
            { type: 'object' },
            { type: 'array', items: { type: 'object' } },
          ],
        },
        strategy: { type: 'string', enum: ['alias', 'patch'], default: 'alias' },
        apply: { type: 'boolean', default: false },
      },
      required: ['delta'],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);

    expect(result).not.toHaveProperty('$schema');
    expect(result.properties.delta).toEqual({
      description: 'Alias changes or patch array.',
      type: 'object',
    });
    expect(result.properties.strategy).toEqual({
      type: 'string',
      enum: ['alias', 'patch'],
      default: 'alias',
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('handles empty oneOf array gracefully', () => {
    const schema = {
      type: 'object',
      properties: {
        val: { oneOf: [] },
      },
    };
    const result = sanitizeSchema(schema);
    // Empty oneOf — nothing to flatten, keep as-is
    expect(result.properties.val).toEqual({ oneOf: [] });
  });

  it('handles nested allOf (not at root) — preserves it', () => {
    // Only top-level allOf is stripped; nested allOf in properties is kept
    // (nested oneOf/anyOf are flattened, but allOf at non-root is kept)
    const schema = {
      type: 'object',
      properties: {
        nested: {
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // allOf at non-root level is kept as-is (only oneOf/anyOf are flattened)
    expect(result.properties.nested).toHaveProperty('allOf');
  });

  it('handles deeply nested $ref inside oneOf variant', () => {
    const schema = {
      type: 'object',
      properties: {
        data: {
          oneOf: [
            {
              type: 'object',
              properties: { inner: { $ref: './inner.json' } },
            },
            { type: 'string' },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // First variant is used, with its $ref replaced
    expect(result.properties.data.type).toBe('object');
    expect(result.properties.data.properties.inner).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });
});

// s161 m6 rider r2 (Fork-5=TAKE): the enum/const primitive-type inference (sanitize-schema.js:54-64)
// was shipped in s160 but UNTESTED (the s160 review's disclosed residual). Strict MCP providers
// (e.g. Moonshot) reject a typeless enum/const, so this block infers a `type`. These tests pin every
// arm, INCLUDING the mixed-type-enum → `type` ARRAY arm the residual specifically named.
describe('sanitizeSchema — typeless enum/const primitive-type inference', () => {
  it('infers const → the const value’s JSON type (number / string / boolean)', () => {
    expect(sanitizeSchema({ const: 42 }).type).toBe('number');
    expect(sanitizeSchema({ const: 'x' }).type).toBe('string');
    expect(sanitizeSchema({ const: true }).type).toBe('boolean');
  });

  it('infers const: null → type "null"', () => {
    expect(sanitizeSchema({ const: null }).type).toBe('null');
  });

  it('infers a single-type enum → that scalar type', () => {
    expect(sanitizeSchema({ enum: ['a', 'b', 'c'] }).type).toBe('string');
    expect(sanitizeSchema({ enum: [1, 2, 3] }).type).toBe('number');
  });

  it('infers a MIXED-type enum → the `type` ARRAY of distinct JSON types (the untested s160 residual)', () => {
    expect(sanitizeSchema({ enum: ['a', 1, true] }).type).toEqual(['string', 'number', 'boolean']);
    expect(sanitizeSchema({ enum: ['a', 1] }).type).toEqual(['string', 'number']);
  });

  it('does NOT override an explicit type (the !("type" in out) guard)', () => {
    expect(sanitizeSchema({ type: 'string', enum: ['a', 'b'] })).toEqual({ type: 'string', enum: ['a', 'b'] });
  });

  it('does NOT infer a type for an empty enum', () => {
    expect(sanitizeSchema({ enum: [] })).not.toHaveProperty('type');
  });

  it('const takes precedence over a co-present enum', () => {
    expect(sanitizeSchema({ const: 7, enum: ['a'] }).type).toBe('number');
  });
});

// s211-m01: an assistant sees only what tools/list advertises. The four action tools (repl, schema, object, map)
// keep every per-action argument inside top-level if/then branches, and stripping those branches alone listed
// `action` and nothing else, so no assistant could discover schemaRef, apply or output on repl.
describe('sanitizeSchema — per-action arguments of the action tools stay listed (s211-m01)', () => {
  const dispatcher = name => JSON.parse(readFileSync(new URL(`../mcp-server/src/schemas/${name}.input.json`, import.meta.url), 'utf8'));
  const branchArguments = schema => new Set(schema.allOf.flatMap(branch => Object.keys(branch.then.properties ?? {})));

  it.each(['repl', 'schema', 'object'])('%s lists every argument any of its actions accepts, with action the only required field', name => {
    const source = dispatcher(name);
    const listed = sanitizeSchema(source);
    expect(Object.keys(listed.properties).sort()).toEqual([...branchArguments(source)].sort());
    expect(listed.required).toEqual(['action']);
    expect(listed).not.toHaveProperty('allOf');
    for (const [argument, definition] of Object.entries(listed.properties)) {
      if (argument !== 'action') expect(definition.description, argument).toMatch(/Actions: [a-z]+/);
    }
  });

  it('map lists the single-create contract and both batch inputs, even when create uses nested branches and refs', () => {
    const source = dispatcher('map');
    const listed = sanitizeSchema(source);
    expect(Object.keys(listed.properties).sort()).toEqual([
      'accept', 'action', 'apply', 'capabilities', 'confidence', 'disambiguation_decisions', 'draftId', 'externalComponent', 'externalSystem',
      'id', 'mappings', 'mappingsPath', 'metadata', 'minConfidence', 'oodsTraits',
      'preferred_terms', 'projection_variants', 'propMappings', 'report', 'reportPath', 'source', 'substitution', 'updates',
    ].sort());
    expect(listed.required).toEqual(['action']);
    expect(listed).not.toHaveProperty('allOf');
    expect(listed.properties.externalSystem.type).toBe('string');
    expect(listed.properties.oodsTraits.type).toBe('array');
    expect(listed.properties.mappings).toMatchObject({ type: 'array', minItems: 1 });
    expect(listed.properties.mappingsPath).toMatchObject({ type: 'string', pattern: '^/[\\s\\S]*$' });
    expect(listed.properties.substitution.properties.react.properties.export.type).toBe('string');
    for (const name of ['substitution', 'oodsTraits', 'mappings', 'mappingsPath']) {
      expect(listed.properties[name].description, name).toMatch(/Actions: create\.$/);
    }
    // Static intake must expose its source, review identity and explicit acceptance at discovery time.
    expect(listed.properties.source.description).toBe('Actions: draft (required).');
    expect(listed.properties.draftId.description).toBe('Actions: apply (required).');
    expect(listed.properties.accept).toMatchObject({ type: 'array', minItems: 1, description: 'Actions: apply (required).' });
    // A batch call does not take these single-create fields, so discovery must not call them required for create.
    expect(listed.properties.externalSystem.description).not.toContain('create (required)');
  });

  it('follows recursive local action refs once and keeps conditional arguments optional', () => {
    const source = {
      type: 'object', properties: { action: { enum: ['create'] } }, required: ['action'],
      allOf: [{ if: { properties: { action: { const: 'create' } } }, then: { allOf: [{ $ref: '#/$defs/create~1input' }] } }],
      $defs: {
        'create/input': {
          properties: { name: { type: 'string' } }, required: ['name'],
          allOf: [{ $ref: '#/$defs/create~1input' }],
          if: { required: ['name'] }, then: { properties: { optional: { type: 'boolean' } }, required: ['optional'] },
        },
      },
    };
    const listed = sanitizeSchema(source);
    expect(Object.keys(listed.properties).sort()).toEqual(['action', 'name', 'optional']);
    expect(listed.properties.name.description).toBe('Actions: create (required).');
    expect(listed.properties.optional.description).toBe('Actions: create.');
  });

  it('repl lists schemaRef, apply and output, each saying which actions take it', () => {
    const { properties } = sanitizeSchema(dispatcher('repl'));
    expect(properties.schemaRef).toMatchObject({ type: 'string' });
    expect(properties.schemaRef.description).toMatch(/Actions: render, validate\.$/);
    expect(properties.output.type).toBe('object');
    expect(properties.output.description).toMatch(/Actions: render\.$/);
    // render's apply is what produces HTML; validate ignores it. One sentence must not speak for both.
    expect(properties.apply.description).toMatch(/^For render: When true and the schema validates, render it/);
    expect(properties.apply.description).toContain('For validate: Accepted for bridge dry-run/apply mode parity');
  });

  it('names the actions that require an argument, and folds a description that only shortens another', () => {
    const { properties } = sanitizeSchema(dispatcher('schema'));
    expect(properties.name.description).toBe('Saved schema name in slug format (letters, numbers, hyphens, underscores). Actions: save (required), delete (required).');
    expect(sanitizeSchema(dispatcher('object')).properties.name.description).toMatch(/Actions: show \(required\)\.$/);
  });

  it('merges differing object shapes into their union and marks the fields only some actions take', () => {
    const { options } = sanitizeSchema(dispatcher('repl')).properties;
    expect(Object.keys(options.properties).sort()).toEqual(['checkA11y', 'checkComponents', 'includeNormalized', 'includeTree']);
    expect(options.properties.includeTree.description).toBe('Only for render.');
    // s221-m03: since 8edb5e4b9 (Sprint 216) checkA11y grades declared component pairs in every built scope; the
    // per-action marker is what this test pins.
    expect(options.properties.checkA11y.description).toMatch(/^Checks declared foreground\/background pairs .* Only for validate\.$/);
  });

  it('keeps the action scope on an argument that is a $ref', () => {
    expect(sanitizeSchema(dispatcher('repl')).properties.schema).toEqual({ type: 'object', description: '(complex schema — see server docs) Actions: render, validate.' });
  });

  it('adds nothing for a top-level allOf that is not an action dispatcher', () => {
    const schema = { type: 'object', properties: { mode: { type: 'string' } }, allOf: [{ if: { properties: { mode: { const: 'full' } } }, then: { properties: { extra: { type: 'string' } }, required: ['extra'] } }] };
    expect(sanitizeSchema(schema)).toEqual({ type: 'object', properties: { mode: { type: 'string' } } });
  });
});
