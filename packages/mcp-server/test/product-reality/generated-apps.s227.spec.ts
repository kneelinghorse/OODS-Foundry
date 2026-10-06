/** s227-m03: the guide must place every emitted file, and later generation must not mutate the first payload. */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatedAppFrameworks, generatedAppKinds, folderHashes, reproduceGeneratedApps } from '../../../../scripts/product-reality/s227-generated-apps.js';
import { editedStockable } from '../../../../scripts/product-reality/s227-first-change.js';
import { generatedActionContractDigest } from '../../src/codegen/artifact-envelope.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const guide = fs.readFileSync(path.join(root, 'packages/foundry/GENERATED-APPS.md'), 'utf8');
const quickstart = fs.readFileSync(path.join(root, 'packages/foundry/QUICKSTART.md'), 'utf8');
const trait = fs.readFileSync(path.join(root, 'packages/foundry/quickstart/Stockable.trait.yaml'), 'utf8');
let scratch: string;
let rows: Awaited<ReturnType<typeof reproduceGeneratedApps>>;
beforeAll(async () => {
  const scratchRoot = path.join(root, '.tmp/s227-tmp'); fs.mkdirSync(scratchRoot, { recursive: true });
  scratch = fs.mkdtempSync(path.join(fs.realpathSync(scratchRoot), 'generated-apps-test-'));
  rows = await reproduceGeneratedApps(scratch, editedStockable(trait, quickstart));
});
afterAll(() => { if (scratch) fs.rmSync(scratch, { recursive: true, force: true }); });

function tableRows(output: typeof generatedAppKinds[number], framework: typeof generatedAppFrameworks[number]) {
  const title = output[0]!.toUpperCase() + output.slice(1);
  const section = guide.split(`### ${title}\n`)[1]?.split('\n### ')[0];
  expect(section, `${title} has its own exact file table`).toBeTruthy();
  return [...section!.matchAll(/^\| (React|Vue|Both) \| `([^`]+)` \| ([^|]+) \|/gm)]
    .filter(([, target]) => target!.toLowerCase() === framework || target === 'Both')
    .map(([, , file, role]) => ({ file: file!, role: role!.trim() }));
}

describe('the published maintenance contract matches generated output', () => {
  for (const output of generatedAppKinds) for (const framework of generatedAppFrameworks) {
    it(`${output}/${framework}: both generations emit exactly the guide's files with a declared role`, () => {
      const row = rows.find(row => row.output === output && row.framework === framework)!;
      const table = tableRows(output, framework);
      expect(new Set(table.map(row => row.file)).size, 'Duplicate entries hide an incomplete ownership table').toBe(table.length);
      for (const entry of table) expect(['Replaced', 'Starting point']).toContain(entry.role);
      for (const version of [row.before, row.after]) {
        expect(table.map(row => row.file).sort()).toEqual(Object.keys(version.hashes).sort());
        expect(version.artifact.files.map(file => file.path).sort()).toEqual(table.map(row => row.file).filter(file => file !== 'artifact.json').sort());
        expect(version.artifact.files.some(file => /do not edit/i.test(file.contents))).toBe(false);
        const source = version.artifact.files.map(file => file.contents).join('\n');
        for (const action of version.artifact.actions) expect(source).toContain(`@oods-domain-action ${action.name} ${generatedActionContractDigest(action)}`);
      }
      // These are the safe replacement boundary: application wiring must not be presented as disposable screen code.
      expect(table.filter(row => /GeneratedUI|screens\/|actions\.ts|artifact\.json|README/.test(row.file)).every(row => row.role === 'Replaced')).toBe(true);
      expect(table.filter(row => /src\/App\.|src\/(application|store|sample-data)\./.test(row.file)).every(row => row.role === 'Starting point')).toBe(true);
    });

    it(`${output}/${framework}: the visible definition edit writes another folder and leaves all first-folder bytes intact`, () => {
      const row = rows.find(row => row.output === output && row.framework === framework)!;
      expect(row.after.directory).not.toBe(row.before.directory);
      expect(row.after.artifact.contentHash).not.toBe(row.before.artifact.contentHash);
      expect(folderHashes(row.before.directory)).toEqual(row.before.hashes);
      expect(row.firstFolderUnchanged).toBe(true);
      expect(row.after.schema.objectSchema).toHaveProperty('last_counted_at');
      expect(row.before.schema.objectSchema).not.toHaveProperty('last_counted_at');
      const extension = framework === 'react' ? 'tsx' : 'vue';
      const expected = output === 'component' ? [`src/GeneratedUI.${extension}`]
        : output === 'application' ? [`src/GeneratedUI.${extension}`, `src/App.${extension}`]
        : ['src/application.ts', 'src/sample-data.ts', 'src/store.ts', ...['List', 'Detail', 'Form', 'Timeline'].map(context => `src/screens/${context}.${extension}`)];
      expect(row.changedFiles.sort()).toEqual(['artifact.json', ...expected].sort());
      expect(row.changedActions, 'A displayed date adds no new domain operation').toEqual([]);
      expect(row.samePayloadReused).toBe(true);
      expect(row.editedGeneratedFileOverwritten).toBe(true);
      expect(folderHashes(row.after.directory)).toEqual(row.after.hashes);
    });
  }

  it('carries the maintenance pointer in every generated application and workflow README', () => {
    const sentences = 'A new generation is a complete new app and merges nothing into your app. Keep your changes in your own files, and see GENERATED-APPS.md in @oods/foundry.';
    for (const row of rows.filter(row => row.output !== 'component')) {
      expect(row.after.artifact.files.find(file => file.path === 'README.md')?.contents).toContain(sentences);
    }
  });
});
