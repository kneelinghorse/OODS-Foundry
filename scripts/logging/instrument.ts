import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export type TelemetryOutcome = 'pending' | 'success' | 'failure';

export type TelemetryStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export type TelemetryAction = 'start' | 'complete';

export type TelemetryEvent = {
  ts: string;
  missionId: string;
  job: string;
  action: TelemetryAction;
  status: TelemetryStatus;
  outcome: TelemetryOutcome;
  correlationId: string;
  incidentId: string | null;
  source?: string;
  durationMs?: number;
  errorCode?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type TelemetryLoggerOptions = {
  missionId: string;
  source?: string;
  fileName?: string;
  telemetryDir?: string;
};

export type TelemetryRun = {
  job: string;
  correlationId: string;
  startedAt: number;
  metadata?: Record<string, unknown> | null;
};

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

function resolveTelemetryDir(customDir?: string): string {
  const dir =
    customDir && customDir.trim().length > 0
      ? customDir
      : process.env.OODS_TELEMETRY_DIR && process.env.OODS_TELEMETRY_DIR.trim().length > 0
        ? process.env.OODS_TELEMETRY_DIR
        : path.join('artifacts', 'current-state');
  return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

function ensureTelemetryFile(baseDir: string, fileName: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const dir = path.join(baseDir, `${yyyy}-${mm}-${dd}`, 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}

function appendEvent(filePath: string, event: TelemetryEvent): void {
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

export class TelemetryLogger {
  private readonly missionId: string;
  private readonly source?: string;
  private readonly baseDir: string;
  private readonly fileName: string;

  constructor(options: TelemetryLoggerOptions) {
    this.missionId = options.missionId;
    this.source = options.source;
    this.baseDir = resolveTelemetryDir(options.telemetryDir);
    this.fileName = options.fileName ?? 'pipeline.jsonl';
  }

  private resolveFile(): string {
    return ensureTelemetryFile(this.baseDir, this.fileName);
  }

  private emit(event: TelemetryEvent): TelemetryEvent {
    const payload: TelemetryEvent = {
      ...event,
      missionId: this.missionId,
    };
    if (this.source && !payload.source) {
      payload.source = this.source;
    }
    appendEvent(this.resolveFile(), payload);
    return payload;
  }

  start(job: string, metadata?: Record<string, unknown> | null, correlationId: string | null = null): TelemetryRun {
    const id = correlationId && correlationId.trim().length > 0 ? correlationId : randomUUID();
    const event: TelemetryEvent = {
      ts: new Date().toISOString(),
      missionId: this.missionId,
      job,
      action: 'start',
      status: 'in_progress',
      outcome: 'pending',
      correlationId: id,
      incidentId: null,
      source: this.source,
      metadata: metadata ?? null,
    };
    this.emit(event);
    return {
      job,
      correlationId: id,
      startedAt: Date.now(),
      metadata: metadata ?? null,
    };
  }

  complete(
    run: TelemetryRun,
    outcome: Extract<TelemetryOutcome, 'success' | 'failure'>,
    details: {
      durationMs?: number;
      errorCode?: number | string | null;
      incidentId?: string | null;
      metadata?: Record<string, unknown> | null;
    } = {}
  ): TelemetryEvent {
    const duration = details.durationMs ?? Math.max(Date.now() - run.startedAt, 0);
    const incidentId = outcome === 'failure' ? details.incidentId ?? randomUUID() : null;
    const status: TelemetryStatus = outcome === 'success' ? 'completed' : 'failed';
    const event: TelemetryEvent = {
      ts: new Date().toISOString(),
      missionId: this.missionId,
      job: run.job,
      action: 'complete',
      status,
      outcome,
      correlationId: run.correlationId,
      incidentId,
      source: this.source,
      durationMs: duration,
      errorCode: details.errorCode ?? null,
      metadata: details.metadata ?? run.metadata ?? null,
    };
    return this.emit(event);
  }
}

type CLIOptions = {
  missionId: string;
  job: string;
  source?: string;
  correlationId?: string;
  fileName?: string;
  telemetryDir?: string;
};

type ParsedCLI = {
  options: CLIOptions;
  command: string[];
};

function parseCli(argv: string[]): ParsedCLI {
  const options: CLIOptions = { missionId: '', job: '' };
  const command: string[] = [];
  let readingCommand = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (readingCommand) {
      command.push(arg);
      continue;
    }
    if (arg === '--') {
      readingCommand = true;
      continue;
    }
    if (arg === '--mission') {
      options.missionId = argv[++i] ?? '';
      continue;
    }
    if (arg === '--job') {
      options.job = argv[++i] ?? '';
      continue;
    }
    if (arg === '--source') {
      options.source = argv[++i] ?? '';
      continue;
    }
    if (arg === '--correlation') {
      options.correlationId = argv[++i] ?? '';
      continue;
    }
    if (arg === '--file') {
      options.fileName = argv[++i] ?? '';
      continue;
    }
    if (arg === '--telemetry-dir') {
      options.telemetryDir = argv[++i] ?? '';
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!readingCommand || command.length === 0) {
    throw new Error('A command must be provided after `--`.');
  }
  if (!options.missionId) {
    throw new Error('`--mission` is required.');
  }
  if (!options.job) {
    throw new Error('`--job` is required.');
  }

  return { options, command };
}

async function runInstrumentCLI(argv: string[]): Promise<number> {
  const { options, command } = parseCli(argv);
  const logger = new TelemetryLogger({
    missionId: options.missionId,
    source: options.source ?? 'pipeline',
    fileName: options.fileName,
    telemetryDir: options.telemetryDir,
  });

  const run = logger.start(options.job, null, options.correlationId ?? null);
  const startedAt = Date.now();
  const spawned = spawn(command[0]!, command.slice(1), {
    stdio: 'inherit',
    env: process.env,
  });

  const exitCode: number = await new Promise((resolve) => {
    spawned.on('close', (code, signal) => {
      if (typeof code === 'number') {
        resolve(code);
        return;
      }
      if (signal) {
        resolve(128 + signal.charCodeAt(0));
        return;
      }
      resolve(1);
    });
    spawned.on('error', () => resolve(1));
  });

  const duration = Date.now() - startedAt;
  if (exitCode === 0) {
    logger.complete(run, 'success', { durationMs: duration, errorCode: null });
  } else {
    logger.complete(run, 'failure', { durationMs: duration, errorCode: exitCode });
  }

  return exitCode;
}

async function main(): Promise<void> {
  const [, , ...rest] = process.argv;
  try {
    const code = await runInstrumentCLI(rest);
    process.exitCode = code;
  } catch (error) {
    process.stderr.write(`instrument: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

const executedPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (argvPath === executedPath) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
