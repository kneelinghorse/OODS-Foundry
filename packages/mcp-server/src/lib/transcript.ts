import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writer,
  TRANSCRIPT_SCHEMA_VERSION,
  type BundleIndexEntryInput,
  type DiagnosticsDocument,
  type DiagnosticsWriteInput,
} from '@oods/artifacts';
import type { TranscriptArtifact, TranscriptRedaction, TranscriptDraft, TranscriptArgs } from '@oods/artifacts';
import { loadRedactions, type Redactions } from './security.js';
import { isUnsafeKey } from './safety.js';

export type WriteTranscriptOptions = {
  tool: string;
  input: unknown;
  apply?: boolean;
  artifacts?: string[];
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  role?: string | null;
};

const MASK_TOKEN = '***';

function maskString(value: string, redactions: Redactions): string {
  let next = value;
  for (const token of redactions.strings ?? []) {
    if (!token) continue;
    next = next.split(token).join(MASK_TOKEN);
  }
  for (const token of redactions.paths ?? []) {
    if (!token) continue;
    next = next.split(token).join(MASK_TOKEN);
  }
  return next;
}

function sanitizeValue(value: unknown, redactions: Redactions): unknown {
  if (typeof value === 'string') {
    return maskString(value, redactions);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, redactions));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'apply') continue;
      if (isUnsafeKey(key)) continue;
      result[key] = sanitizeValue(val, redactions);
    }
    return result;
  }
  return value;
}

function buildArtifactEntries(dir: string, files: string[] | undefined): TranscriptArtifact[] {
  if (!files || files.length === 0) return [];
  const entries: TranscriptArtifact[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (!file) continue;
    const abs = path.isAbsolute(file) ? file : path.resolve(dir, file);
    if (!fs.existsSync(abs)) continue;
    const rel = path.relative(dir, abs) || path.basename(abs);
    if (seen.has(rel)) continue;
    seen.add(rel);
    entries.push({
      path: rel.replace(/\\/g, '/'),
      sha256: writer.sha256File(abs),
      role: 'output',
    });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return entries;
}

function buildRedactionMetadata(redactions: Redactions): TranscriptRedaction[] {
  const entries: TranscriptRedaction[] = [];
  const stringCount = (redactions.strings ?? []).filter(Boolean).length;
  const pathCount = (redactions.paths ?? []).filter(Boolean).length;
  for (let i = 0; i < stringCount; i += 1) {
    entries.push({ field: '*', reason: 'configured_string' });
  }
  for (let i = 0; i < pathCount; i += 1) {
    entries.push({ field: '*', reason: 'configured_path' });
  }
  return entries;
}

export function writeTranscript(dir: string, options: WriteTranscriptOptions): string {
  const apply = Boolean(options.apply);
  const start = options.startTime ?? new Date();
  const end = options.endTime ?? new Date();
  const redactions = loadRedactions();

  const payload = sanitizeValue(options.input ?? {}, redactions);
  const artifacts = buildArtifactEntries(dir, options.artifacts);
  const redactionMeta = buildRedactionMetadata(redactions);

  const args: TranscriptArgs = {
    payload,
    apply,
    options: {
      approve: apply,
      role: options.role ?? null,
    },
  };

  const transcriptDraft: TranscriptDraft = {
    schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
    source: 'mcp-server',
    command: apply ? 'apply' : 'plan',
    tool: options.tool,
    args,
    user: process.env.MCP_USER || 'system',
    hostname: os.hostname(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    exitCode: options.exitCode ?? 0,
    artifacts,
    redactions: redactionMeta,
  };

  fs.mkdirSync(dir, { recursive: true });
  return writer.writeTranscript(dir, transcriptDraft);
}

export function writeBundleIndex(dir: string, entries: BundleIndexEntryInput[]): string {
  return writer.writeBundleIndex(dir, entries);
}

export const sha256File = writer.sha256File;

export function writeDiagnostics(dir: string, diagnostics: DiagnosticsWriteInput): string {
  return writer.writeDiagnostics(dir, diagnostics);
}

export type { BundleIndexEntryInput, DiagnosticsDocument, DiagnosticsWriteInput };
