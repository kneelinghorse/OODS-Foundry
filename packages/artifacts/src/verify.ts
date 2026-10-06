import fs from 'node:fs';
import path from 'node:path';
import type {
  BundleIndexDocument,
  DiagnosticsDocument,
  TranscriptDocument
} from './types.js';
import { canonicalize, sha256, sha256File } from './utils.js';
import { validateBundleIndex, validateDiagnostics, validateTranscript } from './validation.js';

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function verifyTranscriptSignature(doc: TranscriptDocument): { ok: true } | { ok: false; errors: string } {
  if (!doc.signature?.hash) {
    return { ok: false, errors: 'Transcript missing signature hash' };
  }
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
  const computed = sha256(canonical);
  if (computed !== doc.signature.hash) {
    return { ok: false, errors: 'Transcript signature mismatch' };
  }
  return { ok: true };
}

export function readTranscriptFile(filePath: string): { ok: true; transcript: TranscriptDocument } | { ok: false; errors: string } {
  try {
    const transcript = readJson<TranscriptDocument>(filePath);
    const validation = validateTranscript(transcript);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const signature = verifyTranscriptSignature(transcript);
    if (!signature.ok) return { ok: false, errors: signature.errors };
    return { ok: true, transcript };
  } catch (err: any) {
    return { ok: false, errors: err?.message || String(err) };
  }
}

export function validateTranscriptFile(filePath: string): { ok: true } | { ok: false; errors: string } {
  const result = readTranscriptFile(filePath);
  return result.ok ? { ok: true } : { ok: false, errors: result.errors };
}

export function validateBundleIndexFile(filePath: string): { ok: true; doc: BundleIndexDocument } | { ok: false; errors: string } {
  try {
    const doc = readJson<BundleIndexDocument>(filePath);
    const validation = validateBundleIndex(doc);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    return { ok: true, doc };
  } catch (err: any) {
    return { ok: false, errors: err?.message || String(err) };
  }
}

export function validateDiagnosticsFile(filePath: string): { ok: true; doc: DiagnosticsDocument } | { ok: false; errors: string } {
  try {
    const doc = readJson<DiagnosticsDocument>(filePath);
    const validation = validateDiagnostics(doc);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    return { ok: true, doc };
  } catch (err: any) {
    return { ok: false, errors: err?.message || String(err) };
  }
}

export function verifyBundleIndexIntegrity(dir: string, bundleIndexPath: string): { ok: true } | { ok: false; errors: string } {
  const parsed = validateBundleIndexFile(bundleIndexPath);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const missing: string[] = [];
  for (const file of parsed.doc.files) {
    const abs = path.isAbsolute(file.path) ? file.path : path.resolve(dir, file.path);
    if (!fs.existsSync(abs)) {
      missing.push(`Missing file: ${file.path}`);
      continue;
    }
    const hash = sha256File(abs);
    if (hash !== file.sha256) {
      missing.push(`Hash mismatch for ${file.path}`);
    }
  }
  if (missing.length) {
    return { ok: false, errors: missing.join('; ') };
  }
  return { ok: true };
}

export const verify = {
  readTranscriptFile,
  validateTranscriptFile,
  validateBundleIndexFile,
  validateDiagnosticsFile,
  verifyBundleIndexIntegrity
};
