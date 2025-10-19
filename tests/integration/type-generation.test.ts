import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as ts from 'typescript';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';
import { renderBarrelFile } from '../../src/generators/barrel-generator.ts';

const OBJECTS_ROOT = path.resolve('objects', 'core');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];
const CANONICAL_OBJECTS = [
  'Organization',
  'Product',
  'Relationship',
  'Subscription',
  'Transaction',
  'User',
] as const;

interface Workspace {
  root: string;
  generated: string;
}

function createWorkspace(): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), 'type-generation-integration-'));
  const generated = path.join(root, 'generated');
  mkdirSync(generated, { recursive: true });
  return { root, generated };
}

function compileTypeScript(entryFile: string): ts.Diagnostic[] {
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    noEmitOnError: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const program = ts.createProgram([entryFile], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(program.emit().diagnostics ?? []);

  return diagnostics;
}

describe('Object type generation integration', () => {
  let registry: ObjectRegistry;
  let workspace: Workspace;

  beforeAll(async () => {
    workspace = createWorkspace();
    registry = new ObjectRegistry({
      roots: [OBJECTS_ROOT],
      watch: false,
    });
    await registry.waitUntilReady();
  });

  afterAll(() => {
    registry.close();
    rmSync(workspace.root, { recursive: true, force: true });
  });

  it(
    'generates TypeScript definitions that are directly importable',
    async () => {
    const barrelEntries: { interfaceName: string; fileName: string }[] = [];

    for (const name of CANONICAL_OBJECTS) {
      const resolved = await registry.resolve(name, {
        traitRoots: TRAIT_ROOTS,
        validateParameters: true,
      });
      const generated = generateObjectInterface(resolved, { includeJsDoc: false });

      expect(generated.interfaceName).toBe(name);
      expect(generated.code).toContain(`export interface ${name}`);
      expect(generated.code).toContain('DO NOT EDIT');
      expect(generated.traits.length).toBeGreaterThan(0);

      const filePath = path.join(workspace.generated, generated.fileName);
      writeFileSync(filePath, generated.code, 'utf8');
      barrelEntries.push({ interfaceName: generated.interfaceName, fileName: generated.fileName });
    }

    const barrelSource = renderBarrelFile(barrelEntries);
    const barrelPath = path.join(workspace.generated, 'index.ts');
    writeFileSync(barrelPath, barrelSource, 'utf8');
    expect(barrelSource).toContain("export type { Subscription } from './Subscription';");
    expect(barrelSource).toContain("export type { User } from './User';");

    const consumerPath = path.join(workspace.generated, 'consumer.ts');
    const importLines = CANONICAL_OBJECTS.map(
      (name) => `import type { ${name} } from './${name}';`
    ).join('\n');
    const usageLines = CANONICAL_OBJECTS.map(
      (name) => `export const ${name}Example: ${name} | null = null;`
    ).join('\n');
    writeFileSync(consumerPath, `${importLines}\n\n${usageLines}\n`, 'utf8');

    const diagnostics = compileTypeScript(consumerPath);
    if (diagnostics.length > 0) {
      const formatted = diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('\n');
      expect.fail(`TypeScript reported diagnostics:\n${formatted}`);
    }
  },
    15000
  );

  it('renders deterministic barrel exports', () => {
    const barrel = renderBarrelFile([
      { interfaceName: 'User', fileName: 'User.d.ts' },
      { interfaceName: 'Organization', fileName: 'Organization.d.ts' },
      { interfaceName: 'Product', fileName: 'Product.d.ts' },
    ]);

    const lines = barrel.trim().split('\n');
    const exports = lines.slice(-3);
    expect(exports).toEqual([
      "export type { Organization } from './Organization';",
      "export type { Product } from './Product';",
      "export type { User } from './User';",
    ]);
  });
});
