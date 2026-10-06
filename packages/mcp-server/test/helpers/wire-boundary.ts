import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';

export const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const index = fs.readFileSync(path.join(repositoryRoot, 'packages/mcp-server/src/index.ts'), 'utf8');
const specs = new Map([...index.matchAll(/'([^']+)':\s*\{\s*modulePath:\s*'[^']+',\s*inputSchema:\s*'([^']+)',\s*outputSchema:\s*'([^']+)'/g)]
  .map(match => [match[1], { input: match[2], output: match[3] }]));
const validators = new Map<string, ReturnType<ReturnType<typeof getAjv>['compile']>>();

/** Validate JSON wire values against the schema actually registered for the tool. */
export function wire<T>(tool: string, direction: 'input' | 'output', value: T): T {
  const key = tool + '.' + direction;
  if (!validators.has(key)) {
    const spec = specs.get(tool);
    if (!spec) throw new Error('Missing registered tool: ' + tool);
    const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'packages/mcp-server/src', spec[direction]), 'utf8'));
    validators.set(key, (schema.$id ? getAjv().getSchema(schema.$id) : undefined) ?? getAjv().compile(schema));
  }
  const validate = validators.get(key)!;
  const json = JSON.parse(JSON.stringify(value)) as T;
  const valid = validate(json);
  expect(valid, key + ': ' + JSON.stringify(validate.errors)).toBe(true);
  return json;
}

export function retain(name: string, value: unknown): void {
  if (!process.env.S194_REGISTRY_RECEIPTS) return;
  const output = path.resolve(process.env.S194_REGISTRY_RECEIPTS);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n');
}
