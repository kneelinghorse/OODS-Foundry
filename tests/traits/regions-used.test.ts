import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

// s223-m02 (#2527 ruling 13 g): a trait's metadata.regionsUsed is the set of contexts its view_extensions place a
// recipe in. live-registry.ts and refresh_structured_data.py copy it into the catalog regions of every component the
// trait's recipes place, and the composer's selector scores those regions. Authored by hand, it drifted: seven traits
// still listed timeline after s222-m03 removed their timeline recipes, three used the old names "badges" and "forms",
// some traits listed regions without a recipe and some recipes had no region. Checked against the recipes, it cannot
// drift again. The YAML is what the registry serves; a TypeScript twin must say the same.
const root = path.resolve(import.meta.dirname, '../..');
const TRAIT_ROOTS = ['traits', 'domains', 'src/traits'];

interface TraitDocument {
  view_extensions?: Record<string, unknown[] | null>;
  metadata?: { regionsUsed?: string[] };
}

function traitFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return traitFiles(full);
    return entry.name.endsWith('.trait.yaml') ? [path.relative(root, full)] : [];
  });
}

const files = TRAIT_ROOTS.flatMap((folder) => traitFiles(path.join(root, folder))).sort();
const sorted = (values: readonly string[]) => [...values].sort();

describe('trait regionsUsed', () => {
  it('reads every trait the registry serves', () => {
    expect(files).toEqual(expect.arrayContaining(['traits/lifecycle/Stateful.trait.yaml', 'domains/saas-billing/traits/billable.trait.yaml']));
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files)('%s lists exactly the contexts its recipes declare', async (file) => {
    const definition = load(readFileSync(path.join(root, file), 'utf8')) as TraitDocument;
    const contexts = Object.entries(definition.view_extensions ?? {})
      .filter(([, recipes]) => (recipes ?? []).length > 0)
      .map(([context]) => context);
    expect(sorted(definition.metadata?.regionsUsed ?? [])).toEqual(sorted(contexts));

    const twin = path.join(root, file.replace(/\.yaml$/, '.ts'));
    if (existsSync(twin)) {
      const typed = (await import(twin)).default as TraitDocument;
      expect(sorted(typed.metadata?.regionsUsed ?? []), `${file}'s TypeScript twin`).toEqual(sorted(contexts));
    }
  });
});
