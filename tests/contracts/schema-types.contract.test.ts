import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { SCHEMA_ROUTES } from '../../scripts/types/schema-routes.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SCHEMA_DIR = path.join(ROOT, 'schemas');
const GENERATED_DIR = path.join(ROOT, 'generated', 'types');

function collectSchemaFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSchemaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.schema.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Schema-derived types', () => {
  it('can be consumed from one barrel without ambiguous chart parameter type exports', () => {
    const program = ts.createProgram([path.join(GENERATED_DIR, 'index.ts')], {
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    const errors = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    expect(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
  });

  it('exist for every schema file', () => {
    const schemas = collectSchemaFiles(SCHEMA_DIR);
    expect(schemas.length, 'Expected to find JSON Schemas under schemas/').toBeGreaterThan(0);

    const missing: string[] = [];

    for (const schema of schemas) {
      const relative = path.relative(SCHEMA_DIR, schema);
      const routeKey = relative.split(path.sep).join('/');
      const route = SCHEMA_ROUTES[routeKey];

      // #681: schemas hand-authored in @oods/viz-core are intentionally never generated.
      if (route === 'skip') {
        continue;
      }

      // Routed schemas (e.g. the viz-core IR) generate INTO their package, not generated/types/.
      const expected = route
        ? path.join(ROOT, route.outFile)
        : path.join(GENERATED_DIR, relative.replace(/\.schema\.json$/i, '.ts'));

      if (!existsSync(expected)) {
        missing.push(`${relative} → ${path.relative(ROOT, expected)}`);
      }
    }

    expect(
      missing,
      missing.length > 0
        ? `Missing generated types for:\n${missing.join('\n')}`
        : undefined
    ).toEqual([]);
  });

  it('are all exported through the barrel file', () => {
    const indexPath = path.join(GENERATED_DIR, 'index.ts');
    expect(existsSync(indexPath), 'Expected generated/types/index.ts to exist').toBe(true);

    if (!existsSync(indexPath)) {
      return;
    }

    const exports = new Set(
      readdirSync(GENERATED_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts')
        .map((entry) => entry.name.replace(/\.ts$/, ''))
    );

    const subdirectories = readdirSync(GENERATED_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((dir) =>
        readdirSync(path.join(GENERATED_DIR, dir.name), { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
          .map((entry) => path.join(dir.name, entry.name.replace(/\.ts$/, '')).split(path.sep).join('/'))
      );

    const indexContents = readFileSync(indexPath, 'utf8');

    const missingExports: string[] = [];

    for (const file of [...exports, ...subdirectories]) {
      const modulePath = `./${file.split(path.sep).join('/')}`;
      if (!indexContents.includes(modulePath)) {
        missingExports.push(modulePath);
      }
    }

    expect(
      missingExports,
      missingExports.length > 0
        ? `Generated barrel missing exports for:\n${missingExports.join('\n')}`
        : undefined
    ).toEqual([]);
  });
});
