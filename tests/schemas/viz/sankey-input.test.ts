import { readFileSync } from 'node:fs';
import path from 'node:path';

import Ajv from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';

import { validateSankeyInput } from '../../../src/viz/validation/network-flow-validators.js';

const SCHEMA_PATH = path.resolve(process.cwd(), 'schemas/viz/sankey-input.schema.json');
const FIXTURES_PATH = path.resolve(process.cwd(), 'tests/fixtures/network-flow');

describe('Sankey input schema', () => {
  let validate: ReturnType<Ajv['compile']>;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
    validate = ajv.compile(schema);
  });

  const loadFixture = (name: string) =>
    JSON.parse(readFileSync(path.join(FIXTURES_PATH, name), 'utf-8'));

  it('accepts valid flow data (including circular flows)', () => {
    const input = loadFixture('energy-flow.json');

    expect(validate(input)).toBe(true);
    const result = validateSankeyInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a link is missing a value', () => {
    const input = {
      nodes: [{ name: 'A' }, { name: 'B' }],
      links: [{ source: 'A', target: 'B' }],
    };

    const result = validateSankeyInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.endsWith('/value'))).toBe(true);
  });

  it('fails when a link references an unknown node', () => {
    const input = {
      nodes: [{ name: 'A' }, { name: 'B' }],
      links: [{ source: 'A', target: 'C', value: 10 }],
    };

    const result = validateSankeyInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.endsWith('/target'))).toBe(true);
  });
});
