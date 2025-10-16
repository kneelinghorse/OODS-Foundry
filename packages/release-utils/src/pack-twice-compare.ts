import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { runCommand, type RunCommandOptions } from './command.js';

function sha256FileSync(filePath: string): string {
  const h = createHash('sha256');
  const data = readFileSync(filePath);
  h.update(data);
  return h.digest('hex');
}

async function listTarEntries(tarballPath: string, options: RunCommandOptions): Promise<string[]> {
  const result = await runCommand('tar', ['-tf', tarballPath], options);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function removeDir(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true });
}

export type PackTwiceCompareOptions = {
  packageDir: string;
};

export type PackVerificationResult = {
  name: string;
  version: string;
  identical: boolean;
  sha256: string;
  sizeBytes: number;
  files: string[];
  warnings: string[];
};

async function readPackageManifest(packageDir: string): Promise<{ name: string; version: string }> {
  const manifestPath = path.join(packageDir, 'package.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as { name?: string; version?: string };
  if (!parsed.name || !parsed.version) {
    throw new Error(`Invalid package manifest: ${manifestPath}`);
  }
  return { name: parsed.name, version: parsed.version };
}

async function resolveTarballPath(packOutput: string, outputDir: string): Promise<{ filename: string; absolute: string }> {
  const trimmed = packOutput.trim();
  if (!trimmed) throw new Error('npm pack produced no output');
  let filename: string | undefined;
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const jsonSlice = trimmed.slice(start, end + 1);
      const parsed = JSON.parse(jsonSlice) as Array<{ filename?: string }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        filename = parsed[parsed.length - 1]?.filename;
      }
    } catch {
      // Ignore and fall through to regex extraction.
    }
  }
  if (!filename) {
    const match = trimmed.match(/"filename"\s*:\s*"([^"]+)"/);
    if (match) {
      filename = match[1];
    }
  }
  if (!filename) {
    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    filename = lines[lines.length - 1];
  }
  if (!filename) throw new Error(`Unable to parse npm pack output: ${packOutput}`);
  const absolute = path.join(outputDir, filename);
  return { filename, absolute };
}

export async function packTwiceCompare(options: PackTwiceCompareOptions): Promise<PackVerificationResult> {
  const packageDir = path.resolve(options.packageDir);
  const { name, version } = await readPackageManifest(packageDir);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-pack-'));
  const runOneDir = path.join(tempRoot, 'run-1');
  const runTwoDir = path.join(tempRoot, 'run-2');
  await Promise.all([ensureDir(runOneDir), ensureDir(runTwoDir)]);
  const env = {
    ...process.env,
    npm_config_userconfig: '/dev/null',
    NPM_CONFIG_USERCONFIG: '/dev/null',
  };
  const warnings: string[] = [];
  try {
    await runCommand('pnpm', ['run', 'build'], { cwd: packageDir, env });

    const firstPack = await runCommand('npm', ['pack', '--json', '--pack-destination', runOneDir], { cwd: packageDir, env });
    const firstTar = await resolveTarballPath(firstPack.stdout, runOneDir);

    await runCommand('pnpm', ['run', 'build'], { cwd: packageDir, env });

    const secondPack = await runCommand('npm', ['pack', '--json', '--pack-destination', runTwoDir], { cwd: packageDir, env });
    const secondTar = await resolveTarballPath(secondPack.stdout, runTwoDir);

    const firstFiles = await listTarEntries(firstTar.absolute, { env });
    const secondFiles = await listTarEntries(secondTar.absolute, { env });

    const files = firstFiles;
    if (JSON.stringify(firstFiles) !== JSON.stringify(secondFiles)) {
      warnings.push(`Tarball file list differs for ${name}@${version}.`);
    }

    const firstSha = sha256FileSync(firstTar.absolute);
    const secondSha = sha256FileSync(secondTar.absolute);
    const identical = firstSha === secondSha && warnings.length === 0;

    const stat = await fs.stat(firstTar.absolute);

    return {
      name,
      version,
      identical,
      sha256: firstSha,
      sizeBytes: stat.size,
      files,
      warnings,
    };
  } finally {
    await Promise.all([removeDir(runOneDir), removeDir(runTwoDir)]).catch(() => {});
    await removeDir(tempRoot).catch(() => {});
  }
}
