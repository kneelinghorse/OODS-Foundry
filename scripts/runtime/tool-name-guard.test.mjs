import assert from 'node:assert/strict';
import test from 'node:test';
import { retiredToolReferences } from './tool-name-guard.mjs';

test('rejects old call instructions but preserves input field names', () => {
  for (const name of ['health', 'pipeline', 'map', 'object', 'schema', 'repl', 'structuredData_fetch', 'brand_intake']) {
    assert(retiredToolReferences(`Call \`${name}\` with these arguments.`).some(row => row.name === name), name);
  }
  assert.deepEqual(retiredToolReferences('Pass an inline `schema` and the `object` parameter. Call `object_registry` with `action: list`.'), []);
});
test('only the changelog rename table can retain legacy calls', () => {
  const table = '### Tool renames\n\n| `health` | `health_check` |\n\nOld names still answer.\n';
  assert.deepEqual(retiredToolReferences(table, 'CHANGELOG.md'), []);
  assert(retiredToolReferences(table + 'Call `health`.', 'CHANGELOG.md').length);
  assert(retiredToolReferences(table, 'README.md').length);
});
test('marked runnable calls and JSON tool names cannot bypass the guard', () => {
  assert(retiredToolReferences('<!-- quickstart: check health -->').length);
  assert(retiredToolReferences('{"name":"object","arguments":{"action":"list"}}').length);
});
