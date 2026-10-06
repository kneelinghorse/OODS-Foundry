import { describe, expect, it } from 'vitest';

import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/code.generate.output.json' assert { type: 'json' };
import { handle } from '../../src/tools/code.generate.js';
import { FOUNDATION_V1_SHOWCASE_SCHEMA } from './foundation-fixture.s182.js';

const validateOutput = getAjv().compile(outputSchema);
const frameworks = ['react', 'vue'] as const;
const stylings = ['inline', 'tailwind', 'tokens'] as const;
const typescriptOptions = [false, true] as const;
const HTML_CONTROL_SCHEMA = structuredClone(FOUNDATION_V1_SHOWCASE_SCHEMA);
const htmlNodes = [...HTML_CONTROL_SCHEMA.screens];
while (htmlNodes.length > 0) {
  const node = htmlNodes.pop()!;
  delete node.bindings;
  if (node.children) htmlNodes.push(...node.children);
}
const matrix = frameworks.flatMap((framework) => (
  stylings.flatMap((styling) => (
    typescriptOptions.map((typescript) => ({ framework, styling, typescript }))
  ))
));

describe('Sprint 183 M01 runnable artifact contract', () => {
  it.each(matrix)(
    'emits a well-formed artifact for $framework/$styling/typescript=$typescript',
    async ({ framework, styling, typescript }) => {
      const result = await handle({
        framework,
        schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
        options: { styling, typescript },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(validateOutput(result), JSON.stringify(validateOutput.errors ?? [])).toBe(true);
      expect(result.artifact).toBeDefined();
      expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
      expect(result.artifact).toMatchObject({
        schemaVersion: '1.0.0',
        framework,
        files: [{ contents: result.code }],
      });
      expect(result.artifact!.files[0]!.path.endsWith(result.fileExtension)).toBe(true);
      expect(result.artifact!.dependencies.length).toBeGreaterThan(0);
      for (const dependency of result.artifact!.dependencies) {
        expect(dependency.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
        expect(dependency.version).not.toMatch(/workspace:|file:|link:|https?:|git:/);
        expect(dependency.name).not.toContain('/src/');
      }

      // Compatibility disposition for the v1 envelope: the v0 aliases remain
      // exact projections, but they are no longer the primary payload.
      expect(result.code).toBe(result.artifact!.files[0]!.contents);
      const manifestedNames = new Set(result.artifact!.dependencies.map(({ name }) => name));
      for (const specifier of result.imports) {
        const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
        expect(manifestedNames.has(name), `${specifier} is not installable from the manifest`).toBe(true);
      }
    },
  );

  it.each(matrix)(
    're-emits byte-identical artifacts for $framework/$styling/typescript=$typescript',
    async ({ framework, styling, typescript }) => {
      const input = {
        framework,
        schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
        options: { styling, typescript },
      };
      const first = await handle(input);
      const second = await handle(input);

      expect(Buffer.from(JSON.stringify(first.artifact))).toEqual(Buffer.from(JSON.stringify(second.artifact)));
      expect(first.artifact!.contentHash).toBe(second.artifact!.contentHash);
      expect(first.artifact!.files.map(({ contentHash }) => contentHash)).toEqual(
        second.artifact!.files.map(({ contentHash }) => contentHash),
      );
    },
  );

  it('makes a nondeterministic timestamp addition fail the output contract', async () => {
    const result = await handle({
      framework: 'react',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
    });
    const timestamped = structuredClone(result) as typeof result & {
      artifact: NonNullable<typeof result.artifact> & { generatedAt: string };
    };
    timestamped.artifact.generatedAt = new Date().toISOString();

    expect(validateOutput(timestamped)).toBe(false);
    expect(validateOutput.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ keyword: 'additionalProperties' }),
    ]));
  });

  it('makes non-exact versions and unsafe paths fail the output contract', async () => {
    const result = await handle({
      framework: 'react',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
    });

    const ranged = structuredClone(result);
    ranged.artifact!.dependencies[0]!.version = '^0.1.0';
    expect(validateOutput(ranged)).toBe(false);
    expect(validateOutput.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: expect.stringContaining('/dependencies/0/version'), keyword: 'pattern' }),
    ]));

    const traversing = structuredClone(result);
    traversing.artifact!.files[0]!.path = '../GeneratedUI.tsx';
    expect(validateOutput(traversing)).toBe(false);
    expect(validateOutput.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: expect.stringContaining('/files/0/path'), keyword: 'pattern' }),
    ]));
  });

  it('keeps error responses artifact-free and schema-valid', async () => {
    const result = await handle({ framework: 'react' });

    expect(result.status).toBe('error');
    expect(result.artifact).toBeUndefined();
    expect(validateOutput(result), JSON.stringify(validateOutput.errors ?? [])).toBe(true);

    const success = await handle({
      framework: 'react',
      schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
    });
    const artifactOnError = { ...result, artifact: success.artifact };
    expect(validateOutput(artifactOnError)).toBe(false);
  });

  it('keeps HTML as a zero-dependency control artifact', async () => {
    const result = await handle({
      framework: 'html',
      schema: HTML_CONTROL_SCHEMA,
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(validateOutput(result), JSON.stringify(validateOutput.errors ?? [])).toBe(true);
    expect(result.artifact).toMatchObject({
      schemaVersion: '1.0.0',
      framework: 'html',
      files: [{ path: 'index.html', contents: result.code }],
      dependencies: [],
    });
    expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
  });
});
