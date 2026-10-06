import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TRANSCRIPT_SCHEMA_VERSION,
  readTranscriptFile,
  verifyBundleIndexIntegrity,
  writeBundleIndex,
  writeDiagnostics,
  writeTranscript,
  writer
} from '../src/index.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-artifacts-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('artifacts writer', () => {
  it('writes a signed transcript that verifies', () => {
    const base = makeTempDir();
    const runDir = path.join(base, 'cli', 'sample');
    fs.mkdirSync(runDir, { recursive: true });

    const artifactPath = path.join(runDir, 'preview.txt');
    fs.writeFileSync(artifactPath, 'hello world', 'utf8');

    const start = new Date().toISOString();
    const end = new Date(Date.now() + 10).toISOString();

    const transcriptPath = writeTranscript(runDir, {
      schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
      source: 'cli',
      command: 'plan',
      tool: 'tokens.build',
      args: {
        payload: { theme: 'dark' },
        apply: false,
        options: { approve: false, role: null }
      },
      user: 'tester',
      hostname: 'localhost',
      startTime: start,
      endTime: end,
      exitCode: 0,
      artifacts: [{ path: 'preview.txt', sha256: writer.sha256File(artifactPath), role: 'output' }],
      redactions: []
    });

    expect(fs.existsSync(transcriptPath)).toBe(true);
    const parsed = readTranscriptFile(transcriptPath);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.transcript.signature?.hash?.length).toBeGreaterThan(10);
      expect(parsed.transcript.tool).toBe('tokens.build');
    }
  });

  it('writes diagnostics and bundle index and verifies integrity', () => {
    const base = makeTempDir();
    const runDir = path.join(base, 'health');
    fs.mkdirSync(runDir, { recursive: true });

    const sampleArtifact = path.join(runDir, 'report.json');
    fs.writeFileSync(sampleArtifact, JSON.stringify({ ok: true }, null, 2), 'utf8');

    const diagnosticsPath = writeDiagnostics(runDir, {
      runId: 'diag-1',
      sprint: '30',
      tool: 'health',
      summary: 'Diag snapshot sample',
      tokens: { buildMs: 10 },
      inventory: { components: 1, stories: 1 }
    });

    const bundleIndexPath = writeBundleIndex(runDir, [
      'report.json',
      { path: path.relative(runDir, diagnosticsPath), name: 'diagnostics.json' }
    ]);

    expect(fs.existsSync(bundleIndexPath)).toBe(true);
    const verify = verifyBundleIndexIntegrity(runDir, bundleIndexPath);
    expect(verify.ok).toBe(true);
  });
});
