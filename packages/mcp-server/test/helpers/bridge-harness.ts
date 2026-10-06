import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

const BUILD_LOCK_DIR = path.join(os.tmpdir(), 'oods-mcp-bridge-build-lock');
const BUILD_LOCK_POLL_MS = 100;
const BUILD_LOCK_TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockAgeMs(): number {
  try {
    return Date.now() - fs.statSync(BUILD_LOCK_DIR).mtimeMs;
  } catch {
    // Lock vanished between the EEXIST and this stat — treat as fully reclaimable.
    return Number.POSITIVE_INFINITY;
  }
}

async function acquireBuildLock(): Promise<void> {
  const startedAt = Date.now();

  while (true) {
    try {
      fs.mkdirSync(BUILD_LOCK_DIR);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    // Reclaim an abandoned lock. The mkdir lock has no auto-release, so a holder
    // that crashed or was killed at its own 180s hook timeout leaves a stale lock
    // dir behind. No legitimate holder outlives the timeout window (its own build +
    // beforeAll hook die first), so a lock older than that is a prior-run leftover —
    // break it and retry rather than blocking this fresh run for the full window.
    if (lockAgeMs() >= BUILD_LOCK_TIMEOUT_MS) {
      releaseBuildLock();
      continue;
    }

    if (Date.now() - startedAt >= BUILD_LOCK_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for bridge build lock at ${BUILD_LOCK_DIR}`);
    }

    await sleep(BUILD_LOCK_POLL_MS);
  }
}

function releaseBuildLock(): void {
  fs.rmSync(BUILD_LOCK_DIR, { recursive: true, force: true });
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const stderrChunks: string[] = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
  const [code] = (await once(child, 'close')) as [number | null];
  if (code !== 0) {
    throw new Error(`Command failed (${cmd} ${args.join(' ')}):\n${stderrChunks.join('')}`);
  }
}

async function startBridge(bridgeDir: string, extraEnv?: Record<string, string>): Promise<BridgeProcess> {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: bridgeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_BRIDGE_PORT: '0',
      ...extraEnv,
    },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  return await new Promise<BridgeProcess>((resolve, reject) => {
    let resolved = false;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(
        new Error(
          `Timed out waiting for bridge startup.\nstdout: ${stdoutChunks.join('')}\nstderr: ${stderrChunks.join('')}`,
        ),
      );
    }, 20_000);

    function maybeResolve(chunk: string): void {
      const match = chunk.match(/\[mcp-bridge\] listening on :(\d+)/);
      if (!match || resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ child, port: Number(match[1]) });
    }

    child.stdout.on('data', (chunk: string) => {
      stdoutChunks.push(chunk);
      maybeResolve(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
      maybeResolve(chunk);
    });

    child.once('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `Bridge exited before startup (code=${String(code)}).\nstdout: ${stdoutChunks.join('')}\nstderr: ${stderrChunks.join('')}`,
        ),
      );
    });
  });
}

const BUILD_FRESHNESS_THRESHOLD_MS = 1_000;

/**
 * Newest mtimeMs across every file under `dir` (recursively), or null when the
 * directory is missing or contains no files. node_modules and dotfiles are skipped.
 */
function newestMtimeMs(dir: string): number | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  let newest: number | null = null;
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const candidate = entry.isDirectory()
      ? newestMtimeMs(full)
      : entry.isFile()
        ? fs.statSync(full).mtimeMs
        : null;
    if (candidate !== null && (newest === null || candidate > newest)) {
      newest = candidate;
    }
  }
  return newest;
}

/**
 * A package build is "fresh" — and its `pnpm build` can be safely skipped — only
 * when its `dist/` EXISTS and is at least ~1s newer than the newest file in `src/`.
 *
 * The existence check is load-bearing: a cleaned/never-built `dist`
 * (newestMtimeMs === null) is never fresh, and a deleted `src` tree (also null)
 * must NOT skip a rebuild — a stale dist with no sources behind it could otherwise
 * be reused silently. The conservative 1s margin biases toward rebuilding on any
 * ambiguity (mtime granularity, near-ties), so a stale build is never reused.
 */
function isBuildFresh(packageDir: string): boolean {
  const distNewest = newestMtimeMs(path.join(packageDir, 'dist'));
  const srcNewest = newestMtimeMs(path.join(packageDir, 'src'));
  if (distNewest === null || srcNewest === null) return false;
  return distNewest - srcNewest >= BUILD_FRESHNESS_THRESHOLD_MS;
}

export async function buildAndStartBridge(options: {
  repoRoot: string;
  bridgeDir: string;
  extraEnv?: Record<string, string>;
}): Promise<BridgeProcess> {
  const serverDir = path.join(options.repoRoot, 'packages', 'mcp-server');

  // Fast path: when both dists are already fresh (the steady state in CI and in
  // local re-runs) NO build is needed, so we skip the build lock ENTIRELY. The
  // unconditional double `pnpm build` inside the lock is what blew the 180s
  // beforeAll hook; acquiring the lock only when a build is genuinely needed also
  // keeps a stale lock (crash/kill leftover from a prior run) from ever touching
  // the common fresh path.
  const serverFresh = isBuildFresh(serverDir);
  const bridgeFresh = isBuildFresh(options.bridgeDir);

  if (!serverFresh || !bridgeFresh) {
    await acquireBuildLock();
    try {
      // Re-check INSIDE the lock: a peer that held the lock may have just built,
      // so the waiter skips the now-redundant rebuild.
      const serverStale = !isBuildFresh(serverDir);
      if (serverStale) {
        await runCommand('pnpm', ['--filter', '@oods/mcp-server', 'run', 'build'], options.repoRoot);
      }
      // The bridge bundles/consumes @oods/mcp-server, so rebuild it when its own
      // sources changed OR when the server was just rebuilt (its dependency moved).
      if (serverStale || !isBuildFresh(options.bridgeDir)) {
        await runCommand('pnpm', ['--filter', '@oods/mcp-bridge', 'run', 'build'], options.repoRoot);
      }
    } finally {
      releaseBuildLock();
    }
  }

  // startBridge spawns the already-built dist and binds an OS-assigned port, so it
  // needs no lock — keeping it outside avoids serializing parallel workers' startup.
  return await startBridge(options.bridgeDir, options.extraEnv);
}

export async function stopBridge(proc: BridgeProcess): Promise<void> {
  proc.child.kill('SIGTERM');
  await once(proc.child, 'close');
}
