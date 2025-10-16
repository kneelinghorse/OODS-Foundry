import type { FastifyInstance, FastifyReply } from 'fastify';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sendError } from '../middleware/errors.js';
import type { RateLimitWindow } from '../config.js';

const CURRENT_STATE_DIR = 'current-state';
const TRANSCRIPT_FILE = 'transcript.json';
const BUNDLE_INDEX_FILE = 'bundle_index.json';
const DIAGNOSTICS_FILE = 'diagnostics.json';
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

type RunListItem = {
  id: string;
  date: string;
  summary: string;
  tool?: string | null;
  startedAt?: string | null;
};

type BundleEntry = {
  name: string | null;
  purpose: string | null;
  sha: string | null;
  sizeBytes: number | null;
  openUrl: string | null;
};

type ResolvedRunPath = {
  relative: string;
  absolute: string;
};

type ResolvedFilePath = ResolvedRunPath & {
  fileRelative: string;
  fileAbsolute: string;
};

function encodeId(relative: string): string {
  return Buffer.from(relative, 'utf8').toString('base64url');
}

function decodeId(id: string): string | null {
  try {
    return Buffer.from(id, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function isWithin(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function normalizeRelativePath(value: string, options: { minSegments?: number } = {}): string | null {
  const segments = value.split('/').filter((part) => part.length > 0);
  if ((options.minSegments ?? 1) > segments.length) return null;
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment)) return null;
  }
  return segments.join('/');
}

async function readDirSafe(target: string) {
  try {
    return await fs.readdir(target, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function statSafe(target: string) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function readJsonFile<T>(target: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(target, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function collectRuns(currentStateRoot: string): Promise<RunListItem[]> {
  const dateDirs = await readDirSafe(currentStateRoot);
  const runs: RunListItem[] = [];

  for (const dateDir of dateDirs) {
    if (!dateDir.isDirectory()) continue;
    const normalizedDate = normalizeRelativePath(dateDir.name);
    if (!normalizedDate) continue;
    const datePath = path.join(currentStateRoot, normalizedDate);
    const runDirs = await readDirSafe(datePath);

    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) continue;
      const normalizedRun = normalizeRelativePath(runDir.name);
      if (!normalizedRun) continue;

      const runRelative = `${normalizedDate}/${normalizedRun}`;
      const runAbsolute = path.join(datePath, normalizedRun);
      const transcriptPath = path.join(runAbsolute, TRANSCRIPT_FILE);
      const transcript = await readJsonFile<{ ts?: string; tool?: string; startTime?: string }>(transcriptPath);

      const tsRaw =
        (transcript?.startTime && typeof transcript.startTime === 'string' ? transcript.startTime : null) ??
        (transcript?.ts && typeof transcript.ts === 'string' ? transcript.ts : null);
      const tool = transcript?.tool && typeof transcript.tool === 'string' ? transcript.tool : null;
      const summaryParts: string[] = [];
      if (tool) summaryParts.push(tool);
      if (tsRaw) {
        const iso = new Date(tsRaw).toISOString();
        summaryParts.push(iso);
      } else {
        summaryParts.push(runRelative);
      }

      runs.push({
        id: encodeId(runRelative),
        date: tsRaw ? new Date(tsRaw).toISOString() : normalizedDate,
        summary: summaryParts.join(' — '),
        tool,
        startedAt: tsRaw,
      });
    }
  }

  runs.sort((a, b) => {
    const aTs = a.startedAt ? Date.parse(a.startedAt) : 0;
    const bTs = b.startedAt ? Date.parse(b.startedAt) : 0;
    if (aTs !== bTs) return bTs - aTs;
    return a.id.localeCompare(b.id);
  });

  return runs;
}

function resolveRunPath(currentStateRoot: string, runId: string): ResolvedRunPath | null {
  const decoded = decodeId(runId);
  if (!decoded) return null;
  const normalized = normalizeRelativePath(decoded, { minSegments: 2 });
  if (!normalized) return null;
  const absolute = path.join(currentStateRoot, normalized);
  if (!isWithin(currentStateRoot, absolute)) return null;
  return { relative: normalized, absolute };
}

function resolveFilePath(currentStateRoot: string, runId: string, fileId: string): ResolvedFilePath | null {
  const run = resolveRunPath(currentStateRoot, runId);
  if (!run) return null;

  const decodedFile = decodeId(fileId);
  if (!decodedFile) return null;
  const normalizedFile = normalizeRelativePath(decodedFile);
  if (!normalizedFile) return null;

  const absFile = path.join(run.absolute, normalizedFile);
  if (!isWithin(run.absolute, absFile)) return null;

  return {
    relative: run.relative,
    absolute: run.absolute,
    fileRelative: normalizedFile,
    fileAbsolute: absFile,
  };
}

async function loadBundleIndex(runAbsolute: string): Promise<Map<string, BundleEntry>> {
  const indexPath = path.join(runAbsolute, BUNDLE_INDEX_FILE);
  const bundle = await readJsonFile<{
    files?: Array<{
      path?: string;
      file?: string;
      name?: string;
      purpose?: string | null;
      sha256?: string;
      sizeBytes?: number | null;
      openUrl?: string | null;
    }>;
  }>(indexPath);
  const map = new Map<string, BundleEntry>();
  if (!bundle?.files || !Array.isArray(bundle.files)) {
    return map;
  }

  for (const entry of bundle.files) {
    if (!entry) continue;
    const rel = typeof entry.path === 'string' ? entry.path : typeof entry.file === 'string' ? entry.file : null;
    if (!rel) continue;
    map.set(rel, {
      name: typeof entry.name === 'string' ? entry.name : path.basename(rel),
      purpose: typeof entry.purpose === 'string' ? entry.purpose : null,
      sha: typeof entry.sha256 === 'string' ? entry.sha256 : null,
      sizeBytes: typeof entry.sizeBytes === 'number' ? entry.sizeBytes : null,
      openUrl: typeof entry.openUrl === 'string' ? entry.openUrl : null,
    });
  }
  return map;
}

async function listRunFiles(runAbsolute: string): Promise<string[]> {
  const collected: string[] = [];
  async function walk(dir: string) {
    const entries = await readDirSafe(dir);
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const rel = path.relative(runAbsolute, abs).split(path.sep).join('/');
        collected.push(rel);
      }
    }
  }
  await walk(runAbsolute);
  collected.sort((a, b) => a.localeCompare(b));
  return collected;
}

function describePurpose(filename: string, bundleEntry?: BundleEntry): string | null {
  if (bundleEntry?.purpose) return bundleEntry.purpose;
  const basename = path.basename(filename);
  switch (basename) {
    case TRANSCRIPT_FILE:
      return 'Run transcript';
    case BUNDLE_INDEX_FILE:
      return 'Bundle manifest';
    case DIAGNOSTICS_FILE:
      return 'Diagnostics payload';
    default:
      return null;
  }
}

function formatOpenUrl(runId: string, fileId: string): string {
  return path.posix.join('/runs', runId, 'files', fileId, 'open');
}

async function handleRunsRequest(currentStateRoot: string, reply: FastifyReply) {
  const runs = await collectRuns(currentStateRoot);
  return reply.send(runs);
}

async function handleRunDetail(currentStateRoot: string, runId: string, reply: FastifyReply) {
  const resolved = resolveRunPath(currentStateRoot, runId);
  if (!resolved) {
    return sendError(reply, 404, 'NOT_FOUND', 'Run not found.', { details: { reason: 'UNKNOWN_RUN', runId } });
  }

  const diagnosticsPath = path.join(resolved.absolute, DIAGNOSTICS_FILE);
  const diagnostics = await readJsonFile<unknown>(diagnosticsPath);
  if (diagnostics == null) {
    return reply.send(null);
  }
  return reply.send(diagnostics);
}

async function handleRunFiles(currentStateRoot: string, runId: string, reply: FastifyReply) {
  const resolved = resolveRunPath(currentStateRoot, runId);
  if (!resolved) {
    return sendError(reply, 404, 'NOT_FOUND', 'Run not found.', { details: { reason: 'UNKNOWN_RUN', runId } });
  }

  const runStat = await statSafe(resolved.absolute);
  if (!runStat || !runStat.isDirectory()) {
    return sendError(reply, 404, 'NOT_FOUND', 'Run has no artifacts.', { details: { reason: 'MISSING_RUN_DIR', runId } });
  }

  const bundleIndex = await loadBundleIndex(resolved.absolute);
  const files = await listRunFiles(resolved.absolute);

  const entries = await Promise.all(
    files.map(async (fileRelative) => {
      const fileAbsolute = path.join(resolved.absolute, fileRelative);
      const stats = await statSafe(fileAbsolute);
      const bundleEntry = bundleIndex.get(fileRelative);
      const sha = bundleEntry?.sha ?? null;
      const purpose = describePurpose(fileRelative, bundleEntry);
      const size = bundleEntry?.sizeBytes ?? (stats?.isFile() ? stats.size : null);
      const id = encodeId(fileRelative);
      return {
        id,
        name: bundleEntry?.name ?? fileRelative,
        purpose,
        size,
        sha256: sha,
        openUrl: bundleEntry?.openUrl ?? formatOpenUrl(runId, id),
      };
    })
  );

  return reply.send(entries);
}

async function handleRunFileOpen(currentStateRoot: string, artifactsRoot: string, runId: string, fileId: string, reply: FastifyReply) {
  const resolved = resolveFilePath(currentStateRoot, runId, fileId);
  if (!resolved) {
    return sendError(reply, 404, 'NOT_FOUND', 'Artifact not found.', {
      details: { reason: 'UNKNOWN_ARTIFACT', runId, fileId },
    });
  }

  const stats = await statSafe(resolved.fileAbsolute);
  if (!stats || !stats.isFile()) {
    return sendError(reply, 404, 'NOT_FOUND', 'Artifact not found.', {
      details: { reason: 'MISSING_ARTIFACT', runId, fileId },
    });
  }

  const relativeToArtifacts = path.relative(artifactsRoot, resolved.fileAbsolute).split(path.sep).join('/');
  if (relativeToArtifacts.startsWith('..')) {
    return sendError(reply, 403, 'POLICY_DENIED', 'Artifact access rejected.', {
      details: { reason: 'OUT_OF_ROOT', runId, fileId },
    });
  }

  const redirectTarget = path.posix.join('/artifacts', relativeToArtifacts);
  reply.header('Cache-Control', 'no-store');
  return reply.redirect(redirectTarget);
}

type ArtifactEndpointRateLimit = {
  list: RateLimitWindow;
  detail: RateLimitWindow;
  files: RateLimitWindow;
  open: RateLimitWindow;
};

export async function registerArtifactEndpoints(
  fastify: FastifyInstance,
  artifactsRoot: string,
  rateLimit: ArtifactEndpointRateLimit
) {
  const currentStateRoot = path.join(artifactsRoot, CURRENT_STATE_DIR);

  fastify.get(
    '/runs',
    { config: { rateLimit: rateLimit.list } },
    async (_request, reply) => handleRunsRequest(currentStateRoot, reply)
  );

  fastify.get<{ Params: { runId: string } }>(
    '/runs/:runId',
    { config: { rateLimit: rateLimit.detail } },
    async (request, reply) => {
      const runId = request.params.runId;
      return handleRunDetail(currentStateRoot, runId, reply);
    }
  );

  fastify.get<{ Params: { runId: string } }>(
    '/runs/:runId/files',
    { config: { rateLimit: rateLimit.files } },
    async (request, reply) => {
      const runId = request.params.runId;
      return handleRunFiles(currentStateRoot, runId, reply);
    }
  );

  fastify.get<{ Params: { runId: string; fileId: string } }>(
    '/runs/:runId/files/:fileId/open',
    { config: { rateLimit: rateLimit.open } },
    async (request, reply) => {
      const { runId, fileId } = request.params;
      return handleRunFileOpen(currentStateRoot, artifactsRoot, runId, fileId, reply);
    }
  );
}
