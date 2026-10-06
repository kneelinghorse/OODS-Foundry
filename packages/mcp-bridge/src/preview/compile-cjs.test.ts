import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { compileArtifact } from './compile.js';
import { inspectComponentPackages } from './component-packages.js';
import type { PreviewArtifact } from './store.js';

const require = createRequire(import.meta.url);
const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });

describe('CommonJS dependencies share the ESM preview runtime', () => {
  it('renders a non-Base package requiring React, React DOM and the JSX runtime, including a hook', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-cjs-')); folders.push(directory);
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'team-cjs', version: '1.0.0', exports: './index.mjs' }));
    fs.writeFileSync(path.join(directory, 'index.mjs'), "export { TeamCard } from './card.cjs';");
    fs.writeFileSync(path.join(directory, 'card.cjs'), `const React = require('react');
const { createPortal } = require('react-dom');
const { jsx } = require('react/jsx-runtime');
exports.TeamCard = function TeamCard() { const [label] = React.useState('Shared runtime'); return jsx('article', { 'data-portal': typeof createPortal, children: label }); };`);
    const packages = inspectComponentPackages([{ framework: 'react', specifier: 'team-cjs', version: '1.0.0', localPath: directory }]);
    const artifact = { framework: 'react', contentHash: packages[0]!.contentHash, files: [{ path: 'GeneratedUI.tsx', contents: "import { TeamCard } from 'team-cjs'; export const GeneratedUI = () => <TeamCard />;" }],
      substitutions: [{ component: 'Card', mappingId: 'team-card', source: { package: 'team-cjs', version: '1.0.0', export: 'TeamCard' }, packageContentHash: packages[0]!.contentHash }] } as unknown as PreviewArtifact;
    const compiled = await compileArtifact(artifact, { componentPackages: packages });
    // Node's URL imports stand in for the browser import map and keep the exact same React instance as the renderer.
    const code = compiled.code.replace(/from "(react(?:-dom)?(?:\/jsx-runtime)?)"/g, (_, specifier: string) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
    const { GeneratedUI } = await import(/* @vite-ignore */ 'data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
    const { createElement } = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    expect(renderToStaticMarkup(createElement(GeneratedUI))).toBe('<article data-portal="function">Shared runtime</article>');
    expect(compiled.externals).toEqual(['react', 'react-dom', 'react/jsx-runtime']);
  });
});
