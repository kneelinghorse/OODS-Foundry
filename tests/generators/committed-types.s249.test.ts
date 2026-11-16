/**
 * s249-m01 (next step 1875): every committed generated type is what its generator writes today.
 *
 * generated/objects/Transaction.d.ts and Article.d.ts lacked Approvable's fields and its name in their trait lists from
 * 0.13.0, when both objects composed Approvable, until this sprint: the object generator emitted them, but nothing held the
 * committed files to it, and running the generator over every object writes a different set of objects than the one
 * committed. So each committed object type is regenerated alone, from its own definition file, and compared byte for
 * byte, and the barrel is the generator's barrel of the committed set. The schema-derived types under generated/types
 * are held by their generator's own drift check (scripts/types/generate.ts --check), run here.
 *
 * A change that moves a committed type regenerates it in the same commit (src/cli/generate-objects.ts --object <file>
 * --out <scratch>, then copy the one file; `pnpm generate:schema-types` for generated/types).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ObjectRegistry } from '../../src/registry/registry';
import { generateObjectInterface } from '../../src/generators/object-type-generator';
import { renderBarrelFile } from '../../src/generators/barrel-generator';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const OBJECTS = path.join(ROOT, 'generated', 'objects');
const SOURCES = ['objects', 'domains', 'repository-objects'];
const TRAITS = [path.join(ROOT, 'traits'), path.join(ROOT, 'examples', 'traits')];

function definitionFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? definitionFiles(full) : entry.name.endsWith('.object.yaml') ? [full] : [];
  });
}
const sources = SOURCES.flatMap(folder => definitionFiles(path.join(ROOT, folder)));
const committed = readdirSync(OBJECTS).filter(name => name.endsWith('.d.ts')).sort();

/** The one object definition a committed type names as its source. */
function sourceOf(file: string): string {
  const named = /^ \* Source: (.+\.object\.yaml)$/m.exec(readFileSync(path.join(OBJECTS, file), 'utf8'))?.[1];
  const found = sources.filter(source => path.basename(source) === named);
  expect(found, `${file}: its source ${String(named)}`).toHaveLength(1);
  return found[0]!;
}

async function generatedAlone(source: string) {
  const registry = new ObjectRegistry({ roots: [source], watch: false });
  try {
    await registry.waitUntilReady();
    const [record] = registry.list();
    return generateObjectInterface(await registry.resolve(record!.name, { traitRoots: TRAITS }));
  } finally {
    registry.close();
  }
}

describe('every committed generated type is what its generator writes today', () => {
  it('covers the committed object types, Transaction and Article among them', () => {
    expect(committed.length).toBeGreaterThanOrEqual(20);
    expect(committed).toEqual(expect.arrayContaining(['Article.d.ts', 'Transaction.d.ts', 'User.d.ts', 'Organization.d.ts']));
  });

  it.each(committed)('generated/objects/%s, regenerated alone from its definition', async file => {
    const generated = await generatedAlone(sourceOf(file));
    expect(generated.fileName).toBe(file);
    expect(readFileSync(path.join(OBJECTS, file), 'utf8')).toBe(generated.code);
  }, 60_000);

  it('Transaction and Article carry Approvable, which they compose, in their trait lists and fields', () => {
    for (const file of ['Transaction.d.ts', 'Article.d.ts']) {
      const text = readFileSync(path.join(OBJECTS, file), 'utf8');
      expect(text, file).toMatch(/^ \* Traits: .*\bApprovable$/m);
      expect(text, file).toContain('approval_state?:');
      expect(text, file).toContain('approval_summary?: string;');
    }
  });

  it('the barrel exports the committed set, as the generator writes it', async () => {
    const entries = await Promise.all(committed.map(async file => {
      const generated = await generatedAlone(sourceOf(file));
      return { interfaceName: generated.interfaceName, fileName: generated.fileName };
    }));
    expect(readFileSync(path.join(OBJECTS, 'index.ts'), 'utf8')).toBe(renderBarrelFile(entries));
  }, 120_000);

  it('the schema-derived types under generated/types match their generator (scripts/types/generate.ts --check)', () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', path.join(ROOT, 'scripts/types/generate.ts'), '--check', '--silent'], { cwd: ROOT, encoding: 'utf8' });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, 120_000);
});
