import { readFileSync, readdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const DIST_DIR = path.join(ROOT, 'dist');

function collectDeclarationFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDeclarationFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Public API declarations', () => {
  it('do not expose explicit `any` types', () => {
    const declarationFiles = collectDeclarationFiles(DIST_DIR);
    expect(declarationFiles.length, 'Expected generated declaration files in dist/').toBeGreaterThan(0);

    const offenders: Array<{ file: string; matches: string[] }> = [];
    const pattern = /(?:[:<]\s*any\b|any\[\])/g;

    for (const file of declarationFiles) {
      const contents = readFileSync(file, 'utf8');
      const found = contents.match(pattern);
      if (found && found.length > 0) {
        offenders.push({
          file: path.relative(ROOT, file),
          matches: Array.from(new Set(found)),
        });
      }
    }

    expect(
      offenders,
      offenders
        .map(
          ({ file, matches }) =>
            `Explicit any usage detected in ${file}: ${matches.join(', ')}`
        )
        .join('\n')
    ).toEqual([]);
  });
});
