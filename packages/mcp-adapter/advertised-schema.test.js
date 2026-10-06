import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { advertisedSchema } from './advertised-schema.js';
import { sanitizeSchema } from './sanitize-schema.js';

const read = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const surface = read('./tool-surface.json');

describe('compact discovery without weaker server validation', () => {
  it('keeps every parameter, action scope, required field and primitive constraint while leaving source schemas untouched', () => {
    const registry = read('../mcp-server/src/tools/registry.json');
    expect(Object.keys(surface)).toEqual([...registry.auto, ...registry.onDemand]);
    for (const name of Object.keys(surface)) {
      const source = read(`../mcp-server/src/schemas/${name}.input.json`);
      const before = JSON.stringify(source);
      const full = sanitizeSchema(source);
      const compact = advertisedSchema(source);
      expect(Object.keys(compact.properties)).toEqual(Object.keys(full.properties ?? {}));
      expect(compact.required).toEqual(full.required);
      for (const [key, property] of Object.entries(compact.properties)) {
        expect(property.type, `${name}.${key} must be typed`).toBeTruthy();
        expect(property.description, `${name}.${key} must explain its intent`).toBeTruthy();
        if (full.properties[key].type) expect([property.type].flat()).toEqual(expect.arrayContaining([full.properties[key].type].flat()));
        if (full.properties[key].enum) expect(property.enum).toEqual(full.properties[key].enum);
        const actions = full.properties[key].description?.match(/Actions: .*$/)?.[0];
        if (actions) expect(property.description).toContain(actions);
      }
      expect(JSON.stringify(source)).toBe(before);
    }
  });

  it('admits every legal union and unconstrained JSON value instead of guessing a string or first variant', () => {
    const schema = { type: 'object', properties: {
      value: {}, choice: { anyOf: [{ type: 'number' }, { type: 'string' }] },
      patch: { $ref: './patch.json' },
    } };
    const compact = advertisedSchema(schema, () => ({ oneOf: [{ type: 'object' }, { type: 'array' }] }));
    expect(compact.properties.value.type).toEqual(['object', 'array', 'string', 'number', 'boolean', 'null']);
    expect(compact.properties.choice.type).toEqual(['number', 'string']);
    expect(compact.properties.patch.type).toEqual(['object', 'array']);
  });

  it('names summarized nested fields without falsely rejecting them in discovery', () => {
    const schema = { type: 'object', properties: { options: { type: 'object', properties: {
      config: { type: 'object', properties: { title: { type: 'string' }, rows: { type: 'array' } }, required: ['rows'], additionalProperties: false },
    } } } };
    const compact = advertisedSchema(schema).properties.options.properties.config;
    expect(compact.description).toContain('Fields: title, rows.');
    expect(compact.additionalProperties).toBe(true);
    expect(compact.required).toBeUndefined();
    expect(schema.properties.options.properties.config.required).toEqual(['rows']);
  });

  it('keeps titles concise and explicitly distinguishes every repeated-call side effect', () => {
    const descriptions = read('./tool-descriptions.json');
    const policy = read('../mcp-server/src/security/policy.json');
    for (const [internal, entry] of Object.entries(surface)) {
      expect(entry.name).toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/);
      expect(entry.title.split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(typeof entry.idempotentHint).toBe('boolean');
      if (entry.idempotentHint) expect(policy.rules.find(rule => rule.tool === internal).readOnly).toBe(true);
      if (['viz.render', 'dashboard.render', 'fidelity.preview'].includes(internal)) expect(entry.idempotentHint).toBe(false);
      expect(descriptions[internal].split(/\s+/).length).toBeLessThanOrEqual(120);
      expect(descriptions[internal]).toContain('Returns');
      expect(descriptions[internal]).toContain(`oods://schemas/${entry.name}.input.json`);
    }
  });
});
