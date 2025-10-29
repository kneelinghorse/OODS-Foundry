#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const WORKSPACE_ROOT = path.resolve(path.dirname(__filename), '../..');
const RELEASE_ROOT = path.join(WORKSPACE_ROOT, 'dist', 'releases');
const ARTIFACT_ROOT = path.join(WORKSPACE_ROOT, 'artifacts', 'release-dry-run');
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TIMESTAMP_RAW = new Date().toISOString();
const SAFE_SUFFIX = TIMESTAMP_RAW.replace(/[:.]/g, '-');
const RUN_ID = `release-dry-run-${SAFE_SUFFIX}`;

const RUN_RELEASE_DIR = path.join(RELEASE_ROOT, SAFE_SUFFIX);
const RUN_ARTIFACT_DIR = path.join(ARTIFACT_ROOT, SAFE_SUFFIX);
const COMMAND_LOG_PATH = path.join(RUN_ARTIFACT_DIR, 'commands.log');
const SUMMARY_JSON_PATH = path.join(RUN_ARTIFACT_DIR, 'summary.json');
const SBOM_JSON_PATH = path.join(RUN_ARTIFACT_DIR, 'sbom.json');
const BUNDLE_INDEX_PATH = path.join(RUN_ARTIFACT_DIR, 'bundle_index.json');

const PACKAGE_TARGETS = [
  {
    name: '@oods/trait-engine',
    cwd: WORKSPACE_ROOT,
    manifestPath: path.join(WORKSPACE_ROOT, 'package.json'),
  },
  {
    name: '@oods/tokens',
    cwd: path.join(WORKSPACE_ROOT, 'packages', 'tokens'),
    manifestPath: path.join(WORKSPACE_ROOT, 'packages', 'tokens', 'package.json'),
  },
  {
    name: '@oods/tw-variants',
    cwd: path.join(WORKSPACE_ROOT, 'packages', 'tw-variants'),
    manifestPath: path.join(WORKSPACE_ROOT, 'packages', 'tw-variants', 'package.json'),
  },
  {
    name: '@oods/a11y-tools',
    cwd: path.join(WORKSPACE_ROOT, 'packages', 'a11y-tools'),
    manifestPath: path.join(WORKSPACE_ROOT, 'packages', 'a11y-tools', 'package.json'),
  },
];

/**
 * Run a command, stream output, and capture a transcript.
 */
async function runCommand(command, args, options = {}) {
  const startedAt = new Date();
  const transcript = [];
  const cwd = options.cwd ?? WORKSPACE_ROOT;

  await fsp.mkdir(RUN_ARTIFACT_DIR, { recursive: true });

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      transcript.push({ stream: 'stdout', text });
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      transcript.push({ stream: 'stderr', text });
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      const completedAt = new Date();
      const entry = {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        command,
        args,
        cwd,
        transcript,
      };

      if (code === 0) {
        resolve(entry);
      } else {
        const error = new Error(
          `Command "${command} ${args.join(' ')}" exited with code ${code}`
        );
        error.exitCode = code;
        error.transcript = transcript;
        error.commandEntry = entry;
        reject(error);
      }
    });
  });
}

async function writeCommandLog(entries) {
  const chunks = [];
  for (const entry of entries) {
    const header = [
      '---',
      `command: ${entry.command} ${entry.args.join(' ')}`,
      `cwd: ${entry.cwd}`,
      `started_at: ${entry.startedAt}`,
      `completed_at: ${entry.completedAt}`,
      '---',
    ].join('\n');
    chunks.push(header);
    for (const chunk of entry.transcript) {
      const lines = chunk.text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (index === lines.length - 1 && line === '') {
          continue;
        }
        chunks.push(`[${chunk.stream}] ${line}`);
      }
    }
    chunks.push('');
  }
  await fsp.writeFile(COMMAND_LOG_PATH, `${chunks.join('\n')}\n`, 'utf8');
}

async function collectTarballMetadata(dir) {
  const entries = [];
  const files = await fsp.readdir(dir);
  for (const file of files) {
    if (!file.endsWith('.tgz')) {
      continue;
    }
    const filePath = path.join(dir, file);
    const stats = await fsp.stat(filePath);
    const hash = await computeSha256(filePath);
    entries.push({
      file,
      path: path.relative(WORKSPACE_ROOT, filePath),
      sizeBytes: stats.size,
      sha256: hash,
    });
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file));
}

async function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('close', () => resolve(hash.digest('hex')));
  });
}

async function collectProvenance() {
  const provenancePath = path.join(WORKSPACE_ROOT, 'dist', 'pkg', 'provenance.json');
  try {
    const raw = await fsp.readFile(provenancePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function collectDiagnostics() {
  try {
    const raw = await fsp.readFile(path.join(WORKSPACE_ROOT, 'diagnostics.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const pkgCompat = parsed?.helpers?.pkgCompat ?? null;
    return pkgCompat
      ? {
          totals: pkgCompat.totals ?? null,
          lastRun: pkgCompat.lastRun ?? null,
        }
      : null;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function ensureDirectories() {
  await fsp.mkdir(RELEASE_ROOT, { recursive: true });
  await fsp.mkdir(ARTIFACT_ROOT, { recursive: true });
  await fsp.rm(RUN_RELEASE_DIR, { recursive: true, force: true });
  await fsp.mkdir(RUN_RELEASE_DIR, { recursive: true });
  await fsp.rm(RUN_ARTIFACT_DIR, { recursive: true, force: true });
  await fsp.mkdir(RUN_ARTIFACT_DIR, { recursive: true });
}

function computeTarballFilename(name, version) {
  return `${String(name).replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
}

function buildSbom(packageMetadata, tarballs) {
  const tarballMap = new Map(tarballs.map((entry) => [entry.file, entry]));
  const packages = packageMetadata.map((pkg) => {
    const manifest = pkg.manifest ?? {};
    const name = manifest.name ?? pkg.name;
    const version = manifest.version ?? null;
    const tarballName = version ? computeTarballFilename(name, version) : null;
    const tarball = tarballName ? tarballMap.get(tarballName) ?? null : null;

    return {
      name,
      version,
      tarball: tarball?.path ?? null,
      sha256: tarball?.sha256 ?? null,
      sizeBytes: tarball?.sizeBytes ?? null,
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
      files: manifest.files ?? null,
    };
  });

  return {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    packages,
  };
}

async function writeBundleIndex(relativeFiles) {
  const files = [];
  for (const rel of relativeFiles) {
    const abs = path.join(RUN_ARTIFACT_DIR, rel);
    const sha = await computeSha256(abs);
    files.push({ file: rel, sha256: sha });
  }
  await fsp.writeFile(BUNDLE_INDEX_PATH, `${JSON.stringify({ files }, null, 2)}\n`, 'utf8');
}

async function packPackages(commandLog) {
  for (const pkg of PACKAGE_TARGETS) {
    const args = ['pack', '--pack-destination', RUN_RELEASE_DIR];
    const entry = await runCommand('npm', args, {
      cwd: pkg.cwd,
      env: {
        ...process.env,
        NPM_CONFIG_USERCONFIG: '/dev/null',
        npm_config_loglevel: 'warn',
      },
    });
    entry.package = pkg.name;
    commandLog.push(entry);
  }
}

async function main() {
  await ensureDirectories();

  const packageMetadata = await Promise.all(
    PACKAGE_TARGETS.map(async (pkg) => {
      const raw = await fsp.readFile(pkg.manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      return { ...pkg, manifest };
    })
  );

  const startedAt = new Date();
  const commandLog = [];

  const compat = await runCommand(PNPM_CMD, ['run', 'pkg:compat']);
  commandLog.push(compat);

  const verify = await runCommand(PNPM_CMD, ['run', 'pack:verify']);
  commandLog.push(verify);

  await packPackages(commandLog);

  const tarballs = await collectTarballMetadata(RUN_RELEASE_DIR);
  const provenance = await collectProvenance();
  const diagnostics = await collectDiagnostics();
  const completedAt = new Date();
  const sbom = buildSbom(packageMetadata, tarballs);

  const summary = {
    runId: RUN_ID,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    releaseDir: path.relative(WORKSPACE_ROOT, RUN_RELEASE_DIR),
    artifactDir: path.relative(WORKSPACE_ROOT, RUN_ARTIFACT_DIR),
    commands: commandLog.map(({ command, args, cwd, startedAt: s, completedAt: c, package: pkg }) => ({
      command,
      args,
      cwd: path.relative(WORKSPACE_ROOT, cwd),
      package: pkg ?? null,
      startedAt: s,
      completedAt: c,
    })),
    tarballs,
    provenance,
    diagnostics,
  };

  await writeCommandLog(commandLog);
  await fsp.writeFile(SUMMARY_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fsp.writeFile(SBOM_JSON_PATH, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  await writeBundleIndex(['summary.json', 'commands.log', 'sbom.json']);

  console.log('\n✅ Release dry run complete.');
  console.log(`   Release artifacts: ${summary.releaseDir}`);
  console.log(`   Summary: ${path.relative(WORKSPACE_ROOT, SUMMARY_JSON_PATH)}`);
}

await main().catch(async (error) => {
  console.error('\n❌ Release dry run failed.');
  if (error?.commandEntry) {
    try {
      await writeCommandLog([error.commandEntry]);
    } catch {
      // ignore write failure
    }
  }
  process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
});
