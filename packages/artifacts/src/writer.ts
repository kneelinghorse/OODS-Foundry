import fs from 'node:fs';
import path from 'node:path';
import {
  type BundleIndexDocument,
  type BundleIndexEntryInput,
  type DiagnosticsDocument,
  type DiagnosticsWriteInput,
  type TranscriptArtifact,
  type TranscriptDocument,
  type TranscriptDraft
} from './types.js';
import { canonicalize, ensureParentDir, normalizePath, sha256, sha256File } from './utils.js';
import { validateBundleIndex, validateDiagnostics, validateTranscript } from './validation.js';

export const TRANSCRIPT_SCHEMA_VERSION = '1.0';

function isoNow(): string {
  return new Date().toISOString();
}

export function todayDir(base = path.join(process.cwd(), 'artifacts', 'current-state')): string {
  const now = new Date();
  const dir = path.join(
    base,
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeArtifact(entry: TranscriptArtifact): TranscriptArtifact {
  const pathValue = normalizePath(entry.path);
  const role = entry.role ?? 'output';
  return { ...entry, path: pathValue, role };
}

function signTranscript(doc: TranscriptDocument): { algo: string; hash: string } {
  const artifacts = [...(doc.artifacts || [])].map((item) => ({ path: item.path, sha256: item.sha256, role: item.role }));
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  const payload = {
    schemaVersion: doc.schemaVersion,
    tool: doc.tool,
    command: doc.command,
    source: doc.source,
    user: doc.user,
    startTime: doc.startTime,
    artifacts
  };
  const canonical = canonicalize(payload);
  return { algo: 'sha256', hash: sha256(canonical) };
}

function writeJson(filePath: string, doc: object): string {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
  return filePath;
}

export function writeTranscript(dir: string, draft: TranscriptDraft): string {
  const artifacts = (draft.artifacts || []).map(normalizeArtifact);
  const schemaVersion = draft.schemaVersion || TRANSCRIPT_SCHEMA_VERSION;

  const transcript: TranscriptDocument = {
    ...draft,
    schemaVersion,
    artifacts,
    signature: draft.signature || { algo: 'sha256', hash: '' }
  };

  transcript.signature = signTranscript(transcript);

  const validation = validateTranscript(transcript);
  if (!validation.ok) {
    throw new Error(`Transcript validation failed: ${validation.errors}`);
  }

  const filePath = path.join(dir, 'transcript.json');
  return writeJson(filePath, transcript);
}

type ResolvedBundleEntry = {
  path: string;
  name?: string;
  purpose?: string | null;
  sizeBytes?: number | null;
  sha256: string;
  openUrl?: string;
  role?: 'input' | 'output';
};

function normalizeBundleEntry(dir: string, entry: BundleIndexEntryInput): ResolvedBundleEntry {
  const descriptor = typeof entry === 'string' ? { path: entry } : entry;
  const normalizedPath = normalizePath(descriptor.path);
  const abs = path.isAbsolute(normalizedPath) ? normalizedPath : path.resolve(dir, normalizedPath);
  let sizeBytes: number | null | undefined = descriptor.sizeBytes;
  let hash = descriptor.sha256;
  if (fs.existsSync(abs)) {
    try {
      const stat = fs.statSync(abs);
      sizeBytes = sizeBytes ?? stat.size;
      hash = hash ?? sha256File(abs);
    } catch {
      // fall back to default hash below
    }
  }
  if (!hash) {
    hash = sha256('');
  }
  const relative = normalizePath(path.relative(dir, abs)) || normalizedPath;
  return {
    path: relative,
    name: descriptor.name,
    purpose: descriptor.purpose,
    sizeBytes: sizeBytes ?? null,
    sha256: hash,
    openUrl: descriptor.openUrl,
    role: descriptor.role
  };
}

export function writeBundleIndex(dir: string, entries: BundleIndexEntryInput[]): string {
  const files = entries.map((entry) => normalizeBundleEntry(dir, entry));
  files.sort((a, b) => a.path.localeCompare(b.path));
  const doc: BundleIndexDocument = {
    schemaVersion: '1.0',
    generatedAt: isoNow(),
    files
  };

  const validation = validateBundleIndex(doc);
  if (!validation.ok) {
    throw new Error(`Bundle index validation failed: ${validation.errors}`);
  }

  const filePath = path.join(dir, 'bundle_index.json');
  return writeJson(filePath, doc);
}

export function writeDiagnostics(dir: string, diagnostics: DiagnosticsWriteInput): string {
  const doc: DiagnosticsDocument = {
    schemaVersion: '1.0',
    createdAt: diagnostics.createdAt || isoNow(),
    ...diagnostics
  };
  const validation = validateDiagnostics(doc);
  if (!validation.ok) {
    throw new Error(`Diagnostics validation failed: ${validation.errors}`);
  }
  const filePath = path.join(dir, 'diagnostics.json');
  return writeJson(filePath, doc);
}

export const writer = {
  todayDir,
  writeTranscript,
  writeBundleIndex,
  writeDiagnostics,
  sha256File
};
