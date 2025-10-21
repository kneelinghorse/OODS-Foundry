import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build as tsupBuild } from 'tsup';

type ProvenanceRecord = {
  generated_at: string;
  sb_build_hash: string;
  vr_baseline_id: string;
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_DIST_DIR = path.join(WORKSPACE_ROOT, 'dist', 'pkg');

const STORYBOOK_PROJECT = path.join(WORKSPACE_ROOT, 'storybook-static', 'project.json');
const VRT_ROOT = path.join(WORKSPACE_ROOT, 'artifacts', 'vrt');

async function ensureCleanDist(): Promise<void> {
  await fsp.rm(PACKAGE_DIST_DIR, { recursive: true, force: true });
  await fsp.mkdir(PACKAGE_DIST_DIR, { recursive: true });
}

type TsupConfig = Parameters<typeof tsupBuild>[0];

async function loadTsupConfigs(): Promise<TsupConfig[]> {
  const tsupConfigPath = path.join(WORKSPACE_ROOT, 'tsup.config.mjs');
  const module = await import(pathToFileURL(tsupConfigPath).href);
  const exported = module.default ?? module;
  const configs = Array.isArray(exported) ? exported : [exported];
  return configs as TsupConfig[];
}

async function runTsup(): Promise<void> {
  const configs = await loadTsupConfigs();
  for (const config of configs) {
    await tsupBuild({
      ...config,
      clean: false,
    });
  }
}

async function readFileSafe(filePath: string): Promise<Buffer | null> {
  try {
    return await fsp.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function computeStorybookHash(): Promise<string> {
  const projectBuffer = await readFileSafe(STORYBOOK_PROJECT);
  if (!projectBuffer) {
    return 'unavailable';
  }
  const hash = createHash('sha256');
  hash.update(projectBuffer);
  return hash.digest('hex');
}

async function collectFiles(targetDir: string): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
  const results: Array<{ path: string; size: number; mtimeMs: number }> = [];
  const stack: string[] = [targetDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules') {
        continue;
      }
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      const stats = await fsp.stat(entryPath);
      results.push({
        path: path.relative(targetDir, entryPath),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

async function computeVrtBaseline(): Promise<string> {
  try {
    const stats = await fsp.stat(VRT_ROOT);
    if (!stats.isDirectory()) {
      return 'unavailable';
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'unavailable';
    }
    throw error;
  }

  const files = await collectFiles(VRT_ROOT);
  if (files.length === 0) {
    return 'unavailable';
  }

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(String(file.size));
    hash.update('\0');
    hash.update(String(Math.round(file.mtimeMs)));
    hash.update('\0');
  }

  return hash.digest('hex');
}

async function writeJson(target: string, data: unknown): Promise<void> {
  const contents = `${JSON.stringify(data, null, 2)}\n`;
  await fsp.writeFile(target, contents, 'utf8');
}

async function copyIfExists(sourceRelative: string, destDir: string): Promise<boolean> {
  const sourcePath = path.join(WORKSPACE_ROOT, sourceRelative);
  try {
    await fsp.copyFile(sourcePath, path.join(destDir, path.basename(sourceRelative)));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function createDistPackage(provenance: ProvenanceRecord): Promise<void> {
  const packagePath = path.join(WORKSPACE_ROOT, 'package.json');
  const rawPackage = await fsp.readFile(packagePath, 'utf8');
  const parsedPackage = JSON.parse(rawPackage) as Record<string, unknown>;
  const rawDependencies = (parsedPackage.dependencies as Record<string, string> | undefined) ?? {};

  const dependencies: Record<string, string> = {};
  const peerDependencies: Record<string, string> = {};

  for (const [name, version] of Object.entries(rawDependencies)) {
    if (name === 'react' || name === 'react-dom') {
      peerDependencies[name] = version;
      continue;
    }
    dependencies[name] = version;
  }

  const files = ['index.js', 'index.cjs', 'index.d.ts', 'provenance.json'];
  try {
    await fsp.access(path.join(PACKAGE_DIST_DIR, 'index.d.cts'));
    files.push('index.d.cts');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  if (await copyIfExists('README.md', PACKAGE_DIST_DIR)) {
    files.push('README.md');
  }
  if (await copyIfExists('CHANGELOG.md', PACKAGE_DIST_DIR)) {
    files.push('CHANGELOG.md');
  }
  if (await copyIfExists('LICENSE', PACKAGE_DIST_DIR)) {
    files.push('LICENSE');
  }

  const distPackage = {
    name: parsedPackage.name,
    version: parsedPackage.version,
    description: parsedPackage.description,
    type: 'module',
    private: true,
    license: parsedPackage.license ?? 'UNLICENSED',
    main: './index.cjs',
    module: './index.js',
    types: './index.d.ts',
    sideEffects: false,
    exports: {
      '.': {
        types: './index.d.ts',
        import: './index.js',
        require: './index.cjs',
      },
      './package.json': './package.json',
      './provenance.json': './provenance.json',
    },
    files,
    dependencies,
    peerDependencies,
    oodsProvenance: provenance,
  };

  await writeJson(path.join(PACKAGE_DIST_DIR, 'package.json'), distPackage);
}

async function main(): Promise<void> {
  if (!process.env.CI) {
    process.env.NODE_ENV = process.env.NODE_ENV ?? 'production';
  }

  await ensureCleanDist();
  await runTsup();

  const provenance: ProvenanceRecord = {
    generated_at: new Date().toISOString(),
    sb_build_hash: await computeStorybookHash(),
    vr_baseline_id: await computeVrtBaseline(),
  };

  await writeJson(path.join(PACKAGE_DIST_DIR, 'provenance.json'), provenance);
  await createDistPackage(provenance);

  console.log(`\n✨ Built @oods/trait-engine into ${path.relative(WORKSPACE_ROOT, PACKAGE_DIST_DIR)}`);
  console.log(`   Storybook hash: ${provenance.sb_build_hash}`);
  console.log(`   VR baseline id: ${provenance.vr_baseline_id}`);
  console.log('');
}

await main().catch((error) => {
  console.error('pkg:build failed');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
