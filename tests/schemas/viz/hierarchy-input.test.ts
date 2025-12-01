import { readFileSync } from 'node:fs';
import path from 'node:path';

import Ajv from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  detectHierarchyFormat,
  validateHierarchyInput,
} from '../../../src/viz/validation/network-flow-validators.js';

const SCHEMA_PATH = path.resolve(process.cwd(), 'schemas/viz/hierarchy-input.schema.json');
const FIXTURES_PATH = path.resolve(process.cwd(), 'tests/fixtures/network-flow');

describe('Hierarchy input schema', () => {
  let validate: ReturnType<Ajv['compile']>;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
    validate = ajv.compile(schema);
  });

  const loadFixture = (name: string) =>
    JSON.parse(readFileSync(path.join(FIXTURES_PATH, name), 'utf-8'));

  it('validates adjacency list payloads', () => {
    const input = loadFixture('file-system-hierarchy.json');
    expect(validate(input)).toBe(true);

    const result = validateHierarchyInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates nested payloads', () => {
    const input = loadFixture('org-chart-nested.json');

    const result = validateHierarchyInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(detectHierarchyFormat(input)).toBe('nested');
  });

  it('rejects missing node identifiers with clear errors', () => {
    const input = {
      type: 'adjacency_list',
      data: [{ parentId: null, value: 10 }],
    };

    const result = validateHierarchyInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.path).toContain('/data/0');
  });

  it('rejects orphan nodes when parentId is unknown', () => {
    const input = {
      type: 'adjacency_list',
      data: [
        { id: 'root', parentId: null, value: 10 },
        { id: 'child', parentId: 'missing', value: 5 },
      ],
    };

    const result = validateHierarchyInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message.includes('Parent'))).toBe(true);
  });

  it('detects hierarchy format correctly', () => {
    const adjacency = loadFixture('file-system-hierarchy.json');
    const nested = loadFixture('org-chart-nested.json');

    expect(detectHierarchyFormat(adjacency)).toBe('adjacency_list');
    expect(detectHierarchyFormat(nested)).toBe('nested');
    expect(detectHierarchyFormat({ data: [] })).toBe('unknown');
  });
});
