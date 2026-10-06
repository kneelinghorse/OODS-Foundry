import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { GeneratedArtifact } from '../../src/codegen/types.js';

/** Strict compilation reused by public-workflow and isolated archive integration tests. */
export function typecheckWorkflow(artifact: GeneratedArtifact) {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const directory = mkdtempSync(path.join(tmpdir(), `oods-s188-${artifact.framework}-`));
  const link = (source: string, target: string) => { mkdirSync(path.dirname(target), { recursive: true }); symlinkSync(source, target, 'junction'); };
  try {
    for (const file of artifact.files) { const target = path.join(directory, file.path); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, file.contents); }
    const req = createRequire(path.join(root, `packages/components-${artifact.framework}/package.json`));
    const dependencies = artifact.framework === 'react' ? ['react', 'react-dom', '@types/react', '@types/react-dom'] : ['vue', '@vue/server-renderer'];
    for (const dependency of dependencies) link(path.dirname(req.resolve(`${dependency}/package.json`)), path.join(directory, 'node_modules', dependency));
    link(path.dirname(createRequire(path.join(root, 'package.json')).resolve('@types/node/package.json')), path.join(directory, 'node_modules/@types/node'));
    for (const dependency of [`components-${artifact.framework}`, 'component-styles', 'component-contracts']) link(path.join(root, 'packages', dependency), path.join(directory, 'node_modules/@oods', dependency));
    const compiler = createRequire(path.join(root, 'packages/components-vue/package.json')).resolve(artifact.framework === 'react' ? 'typescript/bin/tsc' : 'vue-tsc/bin/vue-tsc.js');
    return spawnSync(process.execPath, [compiler, '--noEmit', '--pretty', 'false', '-p', path.join(directory, 'tsconfig.json')], { encoding: 'utf8', timeout: 60_000 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
