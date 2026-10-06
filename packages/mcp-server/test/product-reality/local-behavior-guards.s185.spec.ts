import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { canonicalize, sha256 } from '@oods/artifacts';
import { afterAll, describe, expect, it } from 'vitest';

import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { SUPPORTED_BINDING_DEFINITIONS } from '../../src/codegen/binding-utils.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/code.generate.js';
import { FOUNDATION_V1_SHOWCASE_SCHEMA } from './foundation-fixture.s182.js';

const matrix = (['react', 'vue'] as const).flatMap((framework) => (
  [true, false].map((typescript) => ({ framework, typescript }))
));
const outcomes: Record<string, unknown>[] = [];

function reseal(artifact: GeneratedArtifact): void {
  for (const file of artifact.files) file.contentHash = `sha256:${sha256(file.contents)}`;
  const { contentHash: _oldHash, ...payload } = artifact;
  artifact.contentHash = `sha256:${sha256(canonicalize(payload))}`;
}

function replaceBody(source: string, name: string, body: string): string {
  return source.replace(
    new RegExp(`(const ${name} = .*?=> \\{).*?(\\};)`),
    `$1 ${body} $2`,
  );
}

function assertBehaviorBite(
  original: GeneratedArtifact,
  id: string,
  mutate: (source: string) => string,
  handler = 'handleTabChange',
): void {
  expect(validateGeneratedArtifact(original)).toEqual([]);
  const mutated = structuredClone(original);
  const entry = mutated.files[0]!;
  entry.contents = mutate(entry.contents);
  expect(entry.contents, id).not.toBe(original.files[0]!.contents);
  reseal(mutated);
  expect(mutated.contentHash).not.toBe(original.contentHash);
  const issues = validateGeneratedArtifact(mutated);
  expect(issues, id).toEqual([
    `Generated local binding handler '${handler}' must update its own state from its input or dismiss it.`,
  ]);
  // Restoring the exact entry, then resealing, restores both validity and hash.
  const restored = structuredClone(mutated);
  restored.files[0]!.contents = original.files[0]!.contents;
  reseal(restored);
  expect(validateGeneratedArtifact(restored)).toEqual([]);
  expect(restored.contentHash).toBe(original.contentHash);
  outcomes.push({
    id, framework: original.framework,
    originalContentHash: original.contentHash, mutatedContentHash: mutated.contentHash,
    restoredContentHash: restored.contentHash, issues,
    originalSource: original.files[0]!.contents, mutatedSource: entry.contents,
    preGreen: true, selectedRed: true, restoredGreen: true,
  });
}

afterAll(() => {
  const evidenceRoot = process.env.OODS_BEHAVIOR_GUARD_EVIDENCE_DIR;
  if (!evidenceRoot) return;
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, 'hash-resealed-bites.json'), `${JSON.stringify({
    schemaVersion: '1.0.0', mission: 's185-m05', outcomes,
  }, null, 2)}\n`);
});

describe('Sprint 185 local binding behavior survives hash-consistent mutation', () => {
  it.each(matrix.flatMap((entry) => (['tokens', 'inline', 'tailwind'] as const).map((styling) => ({ ...entry, styling }))))(
    '$framework/$styling/typescript=$typescript accepts every supported local event protocol',
    async ({ framework, styling, typescript }) => {
      const definitions = SUPPORTED_BINDING_DEFINITIONS.filter(({ kind }) => kind === 'local');
      const schema: UiSchema = {
        version: '1.0',
        screens: [{
          id: 'local-protocols', component: 'Stack',
          children: definitions.map(({ component, event }, index) => ({
            id: `local-${index}`, component, bindings: { [event]: `handleLocal${index}` },
            ...(component === 'Tabs' ? { props: { items: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }] } } : {}),
            // s223-m02 (#2527 ruling 12): a SegmentedControl's contract requires its options, as Tabs requires its items.
            ...(component === 'SegmentedControl' ? { props: { options: [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] } } : {}),
          })),
        }],
      };
      const result = await handle({ schema, framework, options: { styling, typescript } });
      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.code.match(/@oods-local-binding/g)).toHaveLength(definitions.length);
      expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
    },
  );

  it.each(matrix)('$framework/typescript=$typescript rejects inert and unrelated state writes', async ({ framework, typescript }) => {
    const result = await handle({
      framework, schema: FOUNDATION_V1_SHOWCASE_SCHEMA, options: { typescript },
    });
    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    const artifact = result.artifact!;
    expect(result.code.match(/@oods-local-binding/g)).toHaveLength(7);
    for (const [id, body] of [
      ['void-zero', 'void 0;'],
      ['constant-expression', '0;'],
      ['bare-return', 'return;'],
      ['unrelated-state', 'setHandleEmailChangeState(id);'],
      ['self-assignment', 'setHandleTabChangeState(handleTabChangeState);'],
    ]) {
      assertBehaviorBite(artifact, `${framework}-${typescript}-${id}`, (source) => replaceBody(source, 'handleTabChange', body!));
    }
    assertBehaviorBite(artifact, `${framework}-${typescript}-missing-owned-state`, (source) => source.replace(
      framework === 'react'
        ? /const \[handleTabChangeState, setHandleTabChangeState\] = React\.useState[^\n]+/
        : /const handleTabChangeState = ref[^\n]+/,
      'const handleTabChangeState = undefined;',
    ));
    assertBehaviorBite(artifact, `${framework}-${typescript}-dismiss-noop`, (source) => replaceBody(source, 'handleDismiss', 'void 0;'), 'handleDismiss');
    if (framework === 'vue') {
      for (const [id, body] of [
        ['setter-noop', 'void 0;'],
        ['setter-unrelated-state', 'handleEmailChangeState.value = id;'],
        ['setter-self-assignment', 'handleTabChangeState.value = handleTabChangeState.value;'],
      ]) {
        assertBehaviorBite(artifact, `${framework}-${typescript}-${id}`, (source) => replaceBody(source, 'setHandleTabChangeState', body!));
      }
    }
  });
});
