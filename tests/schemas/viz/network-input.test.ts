import { readFileSync } from 'node:fs';
import path from 'node:path';

import Ajv from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';

import { validateNetworkInput } from '../../../src/viz/validation/network-flow-validators.js';

const SCHEMA_PATH = path.resolve(process.cwd(), 'schemas/viz/network-input.schema.json');
const FIXTURES_PATH = path.resolve(process.cwd(), 'tests/fixtures/network-flow');

describe('Network input schema', () => {
  let validate: ReturnType<Ajv['compile']>;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
    validate = ajv.compile(schema);
  });

  const loadFixture = (name: string) =>
    JSON.parse(readFileSync(path.join(FIXTURES_PATH, name), 'utf-8'));

  it('accepts valid nodes and links', () => {
    const input = loadFixture('server-network.json');

    expect(validate(input)).toBe(true);
    const result = validateNetworkInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a link references a missing node', () => {
    const input = {
      nodes: [{ id: 'web-1' }],
      links: [{ source: 'web-1', target: 'db-1', value: 10 }],
    };

    const result = validateNetworkInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.endsWith('/target'))).toBe(true);
  });

  it('fails when node identifiers are duplicated', () => {
    const input = {
      nodes: [
        { id: 'duplicate', group: 'web' },
        { id: 'duplicate', group: 'db' },
      ],
      links: [],
    };

    const result = validateNetworkInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.includes('/nodes/1/id'))).toBe(true);
  });

  it('allows empty node and link arrays', () => {
    const input = { nodes: [], links: [] };
    const result = validateNetworkInput(input);

    expect(validate(input)).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
