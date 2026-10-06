import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyError, type ResolvedErrorDescriptor } from './errors.js';
import type { BundleIndexEntryInput } from '@oods/artifacts';
import { prepareReplay, type TranscriptReader } from './replay.js';

type CliCommand = 'plan' | 'apply' | 'replay';

type CliOptions = {
  approve: boolean;
  role?: string;
};

type ToolRunResult = {
  artifacts?: string[];
  transcriptPath?: string;
  bundleIndexPath?: string;
  diagnosticsPath?: string;
};

type ToolError = {
  code: string;
  message: string;
  details?: unknown;
  incidentId?: string;
  status?: number;
};

type WriterApi = {
  todayDir: () => string;
  writeTranscript: (dir: string, draft: any) => string;
  writeBundleIndex: (dir: string, entries: BundleIndexEntryInput[]) => string;
  sha256File: (filePath: string) => string;
};

class McpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private seq = 0;
  private buffer = '';
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void }
  >();

  constructor(private readonly serverDir: string) {}

  private ensureStarted() {
    if (this.child && !this.child.killed) return;

    const entry = path.join(this.serverDir, 'dist', 'index.js');
    if (!fs.existsSync(entry)) {
      throw {
        code: 'SERVER_NOT_BUILT',
        message: `MCP server entry not found at ${entry}. Run pnpm --filter @oods/mcp-server build.`,
      };
    }

    this.child = spawn(process.execPath, [entry], {
      cwd: this.serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {...process.env},
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as { id?: number; result?: any; error?: any };
          const id = parsed.id;
          if (id != null && this.pending.has(id)) {
            const pending = this.pending.get(id)!;
            this.pending.delete(id);
            if (parsed.error) pending.reject(parsed.error);
            else pending.resolve(parsed.result);
          }
        } catch {
          // ignore parse errors
        }
      }
    });

    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      const msg = chunk.trim();
      if (msg) process.stderr.write(`[mcp-server] ${msg}\n`);
    });

    this.child.on('exit', (code, signal) => {
      for (const [, pending] of this.pending) {
        pending.reject({ code: 'PROCESS_EXIT', message: `MCP server exited (${signal ?? code ?? 0})` });
      }
      this.pending.clear();
      this.child = null;
    });
  }

  async run(tool: string, input: any, role?: string) {
    this.ensureStarted();
    const id = ++this.seq;
    const payload = JSON.stringify({ id, tool, input, role }) + '\n';
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child!.stdin.write(payload, 'utf8');
    });
  }

  async dispose() {
    if (!this.child) return;
    try {
      this.child.stdin.end();
    } catch {
      // ignore
    }
    if (!this.child.killed) {
      this.child.kill('SIGTERM');
    }
    this.child = null;
  }
}

function usage(exitCode = 1) {
  const help = `
Usage:
  oods-agent plan <tool> [jsonArgs] [--role <role>]
  oods-agent apply <tool> [jsonArgs] --approve [--role <role>]
  oods-agent replay <transcriptPath> [--approve] [--role <role>]

Examples:
  oods-agent plan tokens.build '{"theme":"dark"}'
  oods-agent apply tokens.build '{"theme":"dark"}' --approve
  oods-agent replay artifacts/current-state/<date>/cli/tokens.build/<timestamp>-apply/transcript.json --approve
`.trim();
  console.log(help);
  process.exit(exitCode);
}

function parseArgv(argv: string[]) {
  const options: CliOptions = { approve: false };
  const positional: string[] = [];
  let showHelp = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--approve') {
      options.approve = true;
    } else if (arg === '--role') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --role');
      }
      options.role = next;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  const command = positional.shift() as CliCommand | undefined;
  return { command, positional, options, showHelp };
}

function parseJsonArgs(raw?: string): any {
  if (!raw) return {};
  if (raw.startsWith('@')) {
    const file = raw.slice(1);
    const text = fs.readFileSync(file, 'utf8');
    return JSON.parse(text);
  }
  return JSON.parse(raw);
}

function normalizeError(err: any): ToolError {
  if (!err) return { code: 'UNKNOWN', message: 'Unknown MCP error' };
  if (typeof err === 'string') return { code: 'ERROR', message: err };
  if (err instanceof Error) return { code: err.name || 'ERROR', message: err.message };

  const code = typeof err.code === 'string' ? err.code : String(err.code ?? 'ERROR');
  const message = String(err.message ?? err.messages ?? 'Unknown MCP error');
  const details = err.details ?? err.messages ?? err.errors;
  const incidentId = typeof err.incidentId === 'string' ? err.incidentId : undefined;
  const status =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
      ? err.statusCode
      : undefined;
  const normalized: ToolError = { code, message };
  if (details !== undefined) normalized.details = details;
  if (incidentId) normalized.incidentId = incidentId;
  if (status !== undefined) normalized.status = status;
  return normalized;
}

async function loadArtifacts(): Promise<{ writer: WriterApi; readTranscript: TranscriptReader; schemaVersion: string }> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const distPath = path.join(repoRoot, 'packages', 'artifacts', 'dist', 'index.js');
  const srcPath = path.join(repoRoot, 'packages', 'artifacts', 'src', 'index.ts');
  const chosen = fs.existsSync(distPath) ? distPath : fs.existsSync(srcPath) ? srcPath : null;
  if (!chosen) {
    throw new Error('Artifacts package not found. Build @oods/artifacts or ensure sources exist.');
  }

  const mod = (await import(pathToFileURL(chosen).href)) as any;
  const writer: WriterApi | undefined = mod.writer;
  const readTranscript: TranscriptReader | undefined =
    typeof mod.readTranscriptFile === 'function'
      ? mod.readTranscriptFile
      : typeof mod.verify?.readTranscriptFile === 'function'
      ? mod.verify.readTranscriptFile
      : undefined;
  const schemaVersion: string | undefined = typeof mod.TRANSCRIPT_SCHEMA_VERSION === 'string' ? mod.TRANSCRIPT_SCHEMA_VERSION : undefined;
  if (!writer) throw new Error('Artifacts writer API not found');
  if (!readTranscript) throw new Error('Artifacts transcript reader not found');
  if (!schemaVersion) throw new Error('Transcript schema version not exported');
  return { writer, readTranscript, schemaVersion };
}

function relativePath(p?: string | null): string | null {
  if (!p) return null;
  return path.relative(process.cwd(), p) || p;
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function detectUser(): string {
  return (
    process.env.OODS_AGENT_USER ||
    process.env.USER ||
    process.env.LOGNAME ||
    process.env.USERNAME ||
    'unknown'
  );
}

type RunSummary = {
  command: 'plan' | 'apply';
  tool: string;
  role?: string;
  approve: boolean;
  args: any;
  apply: boolean;
  replaySource?: string;
  result?: ToolRunResult;
  error?: ToolError;
  startedAt: Date;
  endedAt: Date;
  exitCode: number;
  user: string;
  hostname: string;
};

async function recordRun(writer: WriterApi, schemaVersion: string, summary: RunSummary) {
  const baseDir = writer.todayDir();
  const safeTool = summary.tool.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(baseDir, 'cli', safeTool, `${stamp}-${summary.command}`);
  fs.mkdirSync(dir, { recursive: true });

  const startIso = summary.startedAt.toISOString();
  const endIso = summary.endedAt.toISOString();
  const replaySourceAbs = summary.replaySource ? path.resolve(summary.replaySource) : undefined;
  const replaySourceRel = replaySourceAbs ? path.relative(dir, replaySourceAbs) : undefined;

  const payloadClone = cloneJson(summary.args ?? {});
  if (payloadClone && typeof payloadClone === 'object' && !Array.isArray(payloadClone)) {
    delete (payloadClone as Record<string, unknown>).apply;
  }

  const artifacts: { path: string; sha256: string; role: 'input' | 'output' }[] = [];
  const seen = new Set<string>();
  const addArtifact = (filePath: string | null | undefined, role: 'input' | 'output') => {
    if (!filePath) return;
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(abs)) return;
    const rel = path.relative(dir, abs) || path.basename(abs);
    const key = `${role}:${rel}`;
    if (seen.has(key)) return;
    seen.add(key);
    const normalizedPath = rel.replace(/\\/g, '/');
    artifacts.push({ path: normalizedPath, role, sha256: writer.sha256File(abs) });
  };

  if (replaySourceAbs) addArtifact(replaySourceAbs, 'input');

  if (summary.result) {
    for (const artifactPath of summary.result.artifacts ?? []) addArtifact(artifactPath, 'output');
    addArtifact(summary.result.transcriptPath, 'output');
    addArtifact(summary.result.bundleIndexPath, 'output');
    addArtifact(summary.result.diagnosticsPath, 'output');
  }

  artifacts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const argsPayload: Record<string, unknown> = {
    payload: payloadClone,
    apply: summary.apply,
    options: {
      approve: summary.approve,
      role: summary.role ?? null,
    },
  };
  if (replaySourceRel) {
    argsPayload.replaySource = replaySourceRel.replace(/\\/g, '/');
  }

  const meta: Record<string, unknown> = {};
  if (summary.result) {
    meta.result = {
      artifacts: summary.result.artifacts ?? [],
      transcriptPath: summary.result.transcriptPath ? path.relative(dir, summary.result.transcriptPath) : null,
      bundleIndexPath: summary.result.bundleIndexPath ? path.relative(dir, summary.result.bundleIndexPath) : null,
      diagnosticsPath: summary.result.diagnosticsPath ? path.relative(dir, summary.result.diagnosticsPath) : null,
    };
  }
  if (summary.error) {
    meta.error = { code: summary.error.code, message: summary.error.message };
  }

  const transcriptDraft: Record<string, unknown> = {
    schemaVersion,
    source: 'cli',
    command: summary.command,
    tool: summary.tool,
    args: argsPayload,
    user: summary.user,
    hostname: summary.hostname,
    startTime: startIso,
    endTime: endIso,
    exitCode: summary.exitCode,
    artifacts,
    redactions: [],
  };
  if (Object.keys(meta).length > 0) {
    transcriptDraft.meta = meta;
  }

  const transcriptPath = writer.writeTranscript(dir, transcriptDraft);
  const summaryPath = path.join(dir, 'summary.json');
  const summaryDoc = {
    command: summary.command,
    tool: summary.tool,
    args: payloadClone,
    apply: summary.apply,
    options: {
      approve: summary.approve,
      role: summary.role ?? null,
    },
    startedAt: startIso,
    endedAt: endIso,
    exitCode: summary.exitCode,
    replaySource: replaySourceRel ?? null,
    result: summary.result
      ? {
          artifacts: summary.result.artifacts ?? [],
          transcriptPath: summary.result.transcriptPath ? path.relative(dir, summary.result.transcriptPath) : null,
          bundleIndexPath: summary.result.bundleIndexPath ? path.relative(dir, summary.result.bundleIndexPath) : null,
          diagnosticsPath: summary.result.diagnosticsPath ? path.relative(dir, summary.result.diagnosticsPath) : null,
        }
      : null,
    error: summary.error ?? null,
    artifacts,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summaryDoc, null, 2), 'utf8');

  const bundleIndexPath = writer.writeBundleIndex(dir, [transcriptPath, summaryPath]);
  return { dir, transcriptPath, bundleIndexPath };
}

async function runTool(
  writer: WriterApi,
  schemaVersion: string,
  client: McpClient,
  command: 'plan' | 'apply',
  tool: string,
  args: any,
  options: CliOptions,
  replaySource?: string
) {
  const apply = command === 'apply';
  const payload = { ...(args ?? {}) };
  if (apply) {
    payload.apply = true;
  } else if ('apply' in payload) {
    delete (payload as any).apply;
  }

  const startedAt = new Date();
  const user = detectUser();
  const hostname = os.hostname();
  const replaySourceAbs = replaySource ? path.resolve(replaySource) : undefined;

  let result: ToolRunResult | undefined;
  let error: ToolError | undefined;
  let exitCode = 0;
  let errorDescriptor: ResolvedErrorDescriptor | null = null;

  try {
    const runResult = (await client.run(tool, payload, options.role)) as ToolRunResult;
    result = runResult ?? {};
  } catch (rawErr: any) {
    const normalized = normalizeError(rawErr);
    errorDescriptor = classifyError(normalized.code, normalized.status);
    error = normalized;
    exitCode = errorDescriptor.exitCode;
  }

  if (!error) {
    exitCode = 0;
  } else if (!errorDescriptor) {
    errorDescriptor = classifyError(error.code, error.status);
    exitCode = errorDescriptor.exitCode;
  }

  const recorded = await recordRun(writer, schemaVersion, {
    command,
    tool,
    role: options.role,
    approve: options.approve,
    args,
    apply,
    replaySource: replaySourceAbs,
    result,
    error,
    startedAt,
    endedAt: new Date(),
    exitCode,
    user,
    hostname,
  });

  if (!error) {
    console.log(`✅ ${command === 'plan' ? 'Plan' : 'Apply'} complete for ${tool}`);
    if (result?.artifacts?.length) {
      console.log('Artifacts:');
      for (const artifact of result.artifacts) {
        console.log(`  - ${relativePath(artifact)}`);
      }
    } else {
      console.log('Artifacts: (none)');
    }
    if (result?.transcriptPath) {
      console.log(`Server transcript: ${relativePath(result.transcriptPath)}`);
    }
    if (result?.bundleIndexPath) {
      console.log(`Server bundle index: ${relativePath(result.bundleIndexPath)}`);
    }
    console.log(`CLI transcript: ${relativePath(recorded.transcriptPath)}`);
    console.log(`CLI bundle index: ${relativePath(recorded.bundleIndexPath)}`);
  } else {
    const descriptor = errorDescriptor ?? classifyError(error.code, error.status);
    console.error(`❌ ${descriptor.title}`);
    console.error(descriptor.description);
    console.error(descriptor.guidance);
    if (error.message && error.message !== descriptor.description) {
      console.error(`Details: ${error.message}`);
    }
    const metaParts: string[] = [];
    if (descriptor.taxonomyCode) {
      let meta = `code ${descriptor.taxonomyCode}`;
      if (error.code && error.code !== descriptor.taxonomyCode) {
        meta += ` (source ${error.code})`;
      }
      metaParts.push(meta);
    } else if (error.code) {
      metaParts.push(`code ${error.code}`);
    }
    if (typeof error.status === 'number') {
      metaParts.push(`http ${error.status}`);
    }
    if (error.incidentId) {
      metaParts.push(`incident ${error.incidentId}`);
    }
    if (metaParts.length) {
      console.error(metaParts.join(' · '));
    }
    if (process.env.DEBUG === '1' && error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    console.error(`CLI transcript: ${relativePath(recorded.transcriptPath)}`);
    console.error(`CLI bundle index: ${relativePath(recorded.bundleIndexPath)}`);
  }

  return exitCode;
}

async function handleReplay(
  writer: WriterApi,
  schemaVersion: string,
  readTranscript: TranscriptReader,
  client: McpClient,
  transcriptPath: string,
  options: CliOptions
) {
  const prep = prepareReplay(transcriptPath, {
    readTranscript,
    hashFile: writer.sha256File,
  });

  if (!prep.ok) {
    console.error(`Replay aborted: ${prep.error}`);
    return 1;
  }

  const { plan, warnings } = prep;
  const displayPath = relativePath(plan.transcriptPath) ?? plan.transcriptPath;
  console.log(`Transcript loaded: ${displayPath}`);
  console.log(`Signature verified (sha256: ${plan.signature})`);
  if (plan.applyRecorded) {
    console.log('Original run applied changes. Preview will execute before any apply.');
  }
  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  const effectiveRole = options.role ?? plan.recordedRole ?? undefined;
  if (!options.role && plan.recordedRole) {
    console.log(`Using recorded role '${plan.recordedRole}' for replay.`);
  } else if (options.role && plan.recordedRole && options.role !== plan.recordedRole) {
    console.log(`Overriding recorded role '${plan.recordedRole}' with '${options.role}'.`);
  }

  const planArgs = cloneJson(plan.payload);
  const planExit = await runTool(
    writer,
    schemaVersion,
    client,
    'plan',
    plan.tool,
    planArgs,
    { approve: false, role: effectiveRole },
    plan.transcriptPath
  );

  if (planExit !== 0) {
    return planExit;
  }

  if (!plan.applyRecorded) {
    return planExit;
  }

  if (!options.approve) {
    console.warn('Replay apply step requires --approve. Preview completed without applying changes.');
    return planExit;
  }

  const applyArgs = cloneJson(plan.payload);
  return await runTool(
    writer,
    schemaVersion,
    client,
    'apply',
    plan.tool,
    applyArgs,
    { approve: true, role: effectiveRole },
    plan.transcriptPath
  );
}

async function main(argv: string[]) {
  try {
    const { command, positional, options, showHelp } = parseArgv(argv);
    if (!command || showHelp) {
      usage(showHelp ? 0 : 1);
      return 0;
    }

    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const serverDir = path.join(repoRoot, 'packages', 'mcp-server');
    const { writer, readTranscript, schemaVersion } = await loadArtifacts();
    const client = new McpClient(serverDir);

    let exitCode = 0;
    if (command === 'plan' || command === 'apply') {
      const tool = positional[0];
      if (!tool) {
        console.error('Missing tool name.');
        usage(1);
        return 1;
      }
      const rawArg = positional[1];
      let argsObj: any = {};
      try {
        argsObj = parseJsonArgs(rawArg);
      } catch (err: any) {
        console.error(`Failed to parse args: ${err?.message ?? err}`);
        return 1;
      }
      if (command === 'apply' && !options.approve) {
        console.error('Apply requires --approve confirmation.');
        return 1;
      }
      exitCode = await runTool(writer, schemaVersion, client, command, tool, argsObj, options);
    } else if (command === 'replay') {
      const transcriptPath = positional[0];
      if (!transcriptPath) {
        console.error('Replay requires a transcript path.');
        return 1;
      }
      exitCode = await handleReplay(writer, schemaVersion, readTranscript, client, transcriptPath, options);
    } else {
      console.error(`Unknown command: ${command}`);
      usage(1);
      return 1;
    }

    await client.dispose();
    return exitCode;
  } catch (err: any) {
    console.error(`Fatal error: ${err?.message ?? err}`);
    return 1;
  }
}

export async function runCli(argv: string[]): Promise<number> {
  return await main(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exit = await runCli(process.argv.slice(2));
  process.exit(exit);
}
