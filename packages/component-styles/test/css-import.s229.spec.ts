import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('the public CSS path resolves as a typed module; the untyped path cannot resolve', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-css-import-'));
  try {
    const consumer = path.join(directory, 'entry.ts'), target = path.join(directory, 'node_modules/@oods/component-styles');
    fs.mkdirSync(target, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    fs.cpSync(path.join(root, 'dist'), path.join(target, 'dist'), { recursive: true });
    fs.writeFileSync(consumer, "import '@oods/component-styles/css';\n");
    const host = { ...ts.sys, fileExists: (file: string) => file.startsWith(directory + path.sep) && ts.sys.fileExists(file), directoryExists: (file: string) => file.startsWith(directory + path.sep) && ts.sys.directoryExists(file), readFile: (file: string) => file.startsWith(directory + path.sep) ? ts.sys.readFile(file) : undefined };
    const resolved = () => ts.resolveModuleName('@oods/component-styles/css', consumer, { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }, host).resolvedModule;
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest));
    expect(resolved()?.resolvedFileName).toBe(path.join(target, 'dist/css.d.ts'));
    delete manifest.exports['./css'].types;
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest));
    expect(resolved()).toBeUndefined();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
