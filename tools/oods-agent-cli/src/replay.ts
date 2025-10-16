import fs from 'node:fs';
import path from 'node:path';

export type TranscriptArtifact = {
  path: string;
  sha256: string;
  role: 'input' | 'output';
};

export type TranscriptArgs = {
  payload: unknown;
  apply: boolean;
  options: { approve: boolean; role?: string | null };
  replaySource?: string;
};

export type TranscriptDocument = {
  schemaVersion: string;
  source: string;
  command: 'plan' | 'apply';
  tool: string;
  args: TranscriptArgs;
  user: string;
  hostname: string;
  startTime: string;
  endTime: string;
  exitCode: number;
  artifacts: TranscriptArtifact[];
  redactions: unknown[];
  signature: { algo: string; hash: string };
  meta?: Record<string, unknown>;
};

export type TranscriptReader = (filePath: string) =>
  | { ok: true; transcript: TranscriptDocument }
  | { ok: false; errors: string };

export type HashFn = (filePath: string) => string;

export type ReplayPlan = {
  tool: string;
  payload: unknown;
  command: 'plan' | 'apply';
  applyRecorded: boolean;
  recordedRole?: string | null;
  signature: string;
  transcriptPath: string;
  transcriptDir: string;
  artifacts: TranscriptArtifact[];
};

export type ReplayPreparationResult =
  | { ok: true; plan: ReplayPlan; warnings: string[] }
  | { ok: false; error: string };

function clonePayload<T>(value: T): T {
  if (value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export function prepareReplay(
  transcriptPath: string,
  readers: { readTranscript: TranscriptReader; hashFile: HashFn }
): ReplayPreparationResult {
  const absPath = path.resolve(transcriptPath);
  if (!fs.existsSync(absPath)) {
    return { ok: false, error: `Transcript not found: ${transcriptPath}` };
  }

  const loaded = readers.readTranscript(absPath);
  if (!loaded.ok) {
    return { ok: false, error: loaded.errors };
  }

  const transcript = loaded.transcript;
  if (!transcript?.tool || typeof transcript.tool !== 'string') {
    return { ok: false, error: 'Transcript missing tool identifier' };
  }

  const payload = clonePayload(transcript.args?.payload ?? {});
  const applyRecorded = Boolean(transcript.args?.apply);
  const recordedRole = transcript.args?.options?.role ?? null;
  const signature = transcript.signature?.hash ?? '';

  if (!signature) {
    return { ok: false, error: 'Transcript missing signature hash' };
  }

  const transcriptDir = path.dirname(absPath);
  const warnings: string[] = [];
  const blocking: string[] = [];

  for (const artifact of transcript.artifacts ?? []) {
    const artifactPath = path.resolve(transcriptDir, artifact.path);
    if (!fs.existsSync(artifactPath)) {
      const message = `Missing ${artifact.role} artifact: ${artifact.path}`;
      if (artifact.role === 'input') blocking.push(message);
      else warnings.push(message);
      continue;
    }
    const actual = readers.hashFile(artifactPath);
    if (actual !== artifact.sha256) {
      const message = `Hash mismatch for ${artifact.role} artifact ${artifact.path}`;
      if (artifact.role === 'input') blocking.push(message);
      else warnings.push(message);
    }
  }

  if (blocking.length) {
    return { ok: false, error: blocking.join('; ') };
  }

  const plan: ReplayPlan = {
    tool: transcript.tool,
    payload,
    command: transcript.command,
    applyRecorded,
    recordedRole,
    signature,
    transcriptPath: absPath,
    transcriptDir,
    artifacts: transcript.artifacts ?? [],
  };

  return { ok: true, plan, warnings };
}
