import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { TelemetryLogger, TelemetryRun } from '../../../scripts/logging/instrument.ts';

type ToolName = 'a11y.scan' | 'purity.audit' | 'vrt.run' | 'diag.snapshot' | 'brand.apply';
type RunStatus = 'success' | 'failure';

type RunRecord = {
  runId: string;
  tool: ToolName;
  index: number;
  apply: boolean;
  start: string;
  end: string;
  durationMs: number;
  exitCode: number;
  status: RunStatus;
  attempts: number;
  policyCode: string | null;
  incidentId: string | null;
  error?: string;
};

type ToolSummary = {
  tool: ToolName;
  totalRuns: number;
  passCount: number;
  failCount: number;
  flakePct: number;
  p95_ms: number;
  p99_ms: number;
  runs: RunRecord[];
};

type SoakReport = {
  missionId: string;
  startedAt: string;
  finishedAt: string;
  config: {
    baseUrl: string;
    runsPerTool: number;
    backoffMs: number;
    maxRetries: number;
    maxConcurrent: number;
  };
  tools: ToolSummary[];
};

type BridgeErrorPayload = {
  error: {
    code?: string;
    message?: string;
    incidentId?: string;
    details?: unknown;
  };
};

type BridgeSuccessPayload = {
  ok: true;
  tool: string;
  artifacts: string[];
  transcriptPath: string | null;
  bundleIndexPath: string | null;
  diagnosticsPath: string | null;
  preview?: {
    summary?: string | null;
    notes?: string[] | null;
  } | null;
};

type BridgeOutcome =
  | {
      ok: true;
      status: number;
      payload: BridgeSuccessPayload;
    }
  | {
      ok: false;
      status: number;
      message: string;
      policyCode: string | null;
      incidentId: string | null;
      payload?: BridgeErrorPayload | null;
    };

type RunPlan = {
  tool: ToolName;
  apply: boolean;
  requiresApproval: boolean;
  input: Record<string, unknown>;
  index: number;
  timeoutMs: number;
  rateLimitMs: number;
};

const missionId = 'B14.7';
const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

const TOOL_LIMITS: Record<ToolName, { timeoutMs: number; rateLimitMs: number }> = {
  'a11y.scan': { timeoutMs: 15_000, rateLimitMs: 2_500 },
  'purity.audit': { timeoutMs: 20_000, rateLimitMs: 2_500 },
  'vrt.run': { timeoutMs: 60_000, rateLimitMs: 4_000 },
  'diag.snapshot': { timeoutMs: 5_000, rateLimitMs: 5_000 },
  'brand.apply': { timeoutMs: 180_000, rateLimitMs: 5_000 },
};

const telemetryLogger = new TelemetryLogger({
  missionId,
  source: 'soak-runner',
});

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeBaseUrl(url: string): string {
  if (!url.trim()) return 'http://127.0.0.1:4466';
  return url.replace(/\/+$/, '');
}

function isoNow(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jitter(base: number): number {
  if (base <= 0) return 0;
  return Math.floor(Math.random() * base);
}

function percentile(values: number[], target: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(target * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index];
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toRelativePath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
}

function reportPathForToday(fileName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const baseDir = path.join(REPO_ROOT, 'artifacts', 'current-state', today);
  ensureDir(baseDir);
  return path.join(baseDir, fileName);
}

function buildReadPlan(tool: ToolName, runsPerTool: number, timeoutMs: number, rateLimitMs: number): RunPlan[] {
  const plans: RunPlan[] = [];
  for (let i = 0; i < runsPerTool; i += 1) {
    plans.push({
      tool,
      apply: false,
      requiresApproval: false,
      input: { apply: false },
      index: i + 1,
      timeoutMs,
      rateLimitMs,
    });
  }
  return plans;
}

function buildBrandApplyPlans(runsPerTool: number, timeoutMs: number, rateLimitMs: number): RunPlan[] {
  const plans: RunPlan[] = [];
  const dryRuns = Math.max(runsPerTool - 1, 1);
  for (let i = 0; i < dryRuns; i += 1) {
    plans.push({
      tool: 'brand.apply',
      apply: false,
      requiresApproval: false,
      input: {
        brand: 'A',
        strategy: 'alias',
        delta: {},
        apply: false,
      },
      index: i + 1,
      timeoutMs,
      rateLimitMs,
    });
  }
  plans.push({
    tool: 'brand.apply',
    apply: true,
    requiresApproval: true,
    input: {
      brand: 'A',
      strategy: 'alias',
      delta: {},
      apply: true,
    },
    index: dryRuns + 1,
    timeoutMs,
    rateLimitMs: rateLimitMs * 3,
  });
  return plans;
}

function classifyPolicyCode(payload?: BridgeErrorPayload | null): string | null {
  if (!payload || !payload.error) return null;
  const { code } = payload.error;
  return typeof code === 'string' && code.trim().length ? code : null;
}

function shouldRetry(outcome: BridgeOutcome): boolean {
  if (outcome.ok) return false;
  if (outcome.status === 429 || outcome.status === 503 || outcome.status === 0) return true;
  if (outcome.policyCode === 'RATE_LIMITED' || outcome.policyCode === 'TIMEOUT') return true;
  return false;
}

async function invokeTool(
    plan: RunPlan,
    baseUrl: string,
    token: string | null,
    approvalToken: string | null,
    timeoutMs: number
  ): Promise<BridgeOutcome> {
  const url = new URL('/run', baseUrl).toString();
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('X-Bridge-Token', token);
  if (plan.requiresApproval && approvalToken) headers.set('X-Bridge-Approval', approvalToken);
  if (plan.requiresApproval && !approvalToken) headers.set('X-Bridge-Approval', 'granted');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool: plan.tool, input: plan.input }),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text.length ? (JSON.parse(text) as BridgeSuccessPayload | BridgeErrorPayload) : null;

    if (!response.ok) {
      const payload = data && 'error' in (data as BridgeErrorPayload) ? (data as BridgeErrorPayload) : null;
      const message = payload?.error?.message ?? `Bridge request failed with status ${response.status}`;
      const incidentId =
        payload && typeof payload.error?.incidentId === 'string' ? payload.error.incidentId : null;
      return { ok: false, status: response.status, message, policyCode: classifyPolicyCode(payload), incidentId, payload };
    }

    const payload = data && 'ok' in (data as BridgeSuccessPayload) ? (data as BridgeSuccessPayload) : null;
    if (!payload || !payload.ok) {
      return {
        ok: false,
        status: response.status,
        message: 'Unexpected bridge payload shape.',
        policyCode: null,
        incidentId: null,
      };
    }

    return { ok: true, status: response.status, payload };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        message: `Request timed out after ${timeoutMs}ms`,
        policyCode: 'TIMEOUT',
        incidentId: null,
      };
    }
    const message = error instanceof Error ? error.message : 'Unknown error invoking bridge';
    return { ok: false, status: 0, message, policyCode: null, incidentId: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executePlan(
  plan: RunPlan,
  baseUrl: string,
  token: string | null,
  approvalToken: string | null,
  baseBackoffMs: number,
  maxRetries: number,
  telemetry?: TelemetryLogger
): Promise<RunRecord> {
  const runId = randomUUID();
  const startedAt = Date.now();
  const startIso = new Date(startedAt).toISOString();
  let attempts = 0;
  let outcome: BridgeOutcome;
  let telemetrySpan: TelemetryRun | null = null;

  if (telemetry) {
    const jobName = `soak:${plan.tool}#${plan.index}${plan.apply ? ':apply' : ':dry'}`;
    telemetrySpan = telemetry.start(jobName, {
      runId,
      tool: plan.tool,
      apply: plan.apply,
      index: plan.index,
    });
  }

  while (true) {
    attempts += 1;
    outcome = await invokeTool(plan, baseUrl, token, approvalToken, plan.timeoutMs);
    if (outcome.ok) {
      break;
    }
    if (attempts > maxRetries || !shouldRetry(outcome)) {
      break;
    }
    const delay = baseBackoffMs * 2 ** (attempts - 1) + jitter(baseBackoffMs);
    await sleep(delay);
  }

  const end = Date.now();
  const record: RunRecord = {
    runId,
    tool: plan.tool,
    index: plan.index,
    apply: plan.apply,
    start: startIso,
    end: new Date(end).toISOString(),
    durationMs: end - startedAt,
    exitCode: outcome.ok ? 0 : outcome.status || 1,
    status: outcome.ok ? 'success' : 'failure',
    attempts,
    policyCode: outcome.ok ? null : outcome.policyCode,
    incidentId: outcome.ok ? null : outcome.incidentId,
    error: outcome.ok ? undefined : outcome.message,
  };

  if (telemetrySpan) {
    telemetry.complete(telemetrySpan, outcome.ok ? 'success' : 'failure', {
      durationMs: record.durationMs,
      errorCode: record.exitCode,
      incidentId: record.incidentId,
      metadata: {
        attempts,
        policyCode: record.policyCode,
        apply: plan.apply,
        tool: plan.tool,
        index: plan.index,
        runId,
      },
    });
  }

  return record;
}

function summarizeTool(tool: ToolName, runs: RunRecord[]): ToolSummary {
  const totalRuns = runs.length;
  const passCount = runs.filter((run) => run.status === 'success').length;
  const failCount = totalRuns - passCount;
  const successDurations = runs.filter((run) => run.status === 'success').map((run) => run.durationMs);
  const flakePct = totalRuns === 0 ? 0 : +(Math.max((failCount / totalRuns) * 100, 0).toFixed(2));
  const p95_ms = percentile(successDurations, 0.95);
  const p99_ms = percentile(successDurations, 0.99);

  return {
    tool,
    totalRuns,
    passCount,
    failCount,
    flakePct,
    p95_ms,
    p99_ms,
    runs,
  };
}

function renderMarkdownReport(report: SoakReport): string {
  const lines: string[] = [];
  lines.push(`# Reliability Soak Report`);
  lines.push('');
  lines.push(`- Mission: ${report.missionId}`);
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Finished: ${report.finishedAt}`);
  lines.push(`- Bridge URL: ${report.config.baseUrl}`);
  lines.push(`- Runs per tool: ${report.config.runsPerTool}`);
  lines.push('');
  lines.push('| Tool | Runs | Pass | Fail | Flake % | p95 (ms) | p99 (ms) |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const summary of report.tools) {
    lines.push(
      `| \`${summary.tool}\` | ${summary.totalRuns} | ${summary.passCount} | ${summary.failCount} | ${summary.flakePct.toFixed(2)} | ${summary.p95_ms} | ${summary.p99_ms} |`
    );
  }
  lines.push('');
  lines.push('## Operational Notes');
  lines.push('- Correlation IDs for each invocation are logged in telemetry JSONL under `metadata.runId`.');
  lines.push('- Incident IDs appear when retries exhaust or policy denials occur.');
  lines.push('- See `diagnostics.json.telemetry` for the latest aggregated summary.');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const baseUrl = sanitizeBaseUrl(readEnv('BRIDGE_URL') ?? 'http://127.0.0.1:4466');
  const bridgeToken = readEnv('BRIDGE_TOKEN');
  const approvalToken = readEnv('BRIDGE_APPROVAL');
  const runsPerTool = parseIntEnv('SOAK_RUNS_PER_TOOL', 25);
  const baseBackoffMs = parseIntEnv('SOAK_BACKOFF_MS', 250);
  const maxRetries = parseIntEnv('SOAK_MAX_RETRIES', 3);
  const maxConcurrent = parseIntEnv('SOAK_MAX_CONCURRENT', 1);
  const globalRateLimitMs = parseIntEnv('SOAK_GLOBAL_RATE_LIMIT_MS', 2_500);
  if (maxConcurrent !== 1) {
    process.stderr.write('Only maxConcurrent=1 is supported in the soak runner.\n');
  }

  const runStartMs = Date.now();
  const overallSpan = telemetryLogger.start('soak-runner', {
    baseUrl,
    runsPerTool,
    backoffMs: baseBackoffMs,
    maxRetries,
    globalRateLimitMs,
  });

  try {
    const readPlans: RunPlan[] = [
      ...buildReadPlan(
        'a11y.scan',
        runsPerTool,
        TOOL_LIMITS['a11y.scan'].timeoutMs,
        TOOL_LIMITS['a11y.scan'].rateLimitMs
      ),
      ...buildReadPlan(
        'purity.audit',
        runsPerTool,
        TOOL_LIMITS['purity.audit'].timeoutMs,
        TOOL_LIMITS['purity.audit'].rateLimitMs
      ),
      ...buildReadPlan(
        'vrt.run',
        runsPerTool,
        TOOL_LIMITS['vrt.run'].timeoutMs,
        TOOL_LIMITS['vrt.run'].rateLimitMs
      ),
      ...buildReadPlan(
        'diag.snapshot',
        runsPerTool,
        TOOL_LIMITS['diag.snapshot'].timeoutMs,
        TOOL_LIMITS['diag.snapshot'].rateLimitMs
      ),
    ];
    const brandPlans = buildBrandApplyPlans(
      runsPerTool,
      TOOL_LIMITS['brand.apply'].timeoutMs,
      TOOL_LIMITS['brand.apply'].rateLimitMs
    );
    const plans: RunPlan[] = [...readPlans, ...brandPlans];

    const startedAt = new Date(runStartMs).toISOString();
    const lastRunByTool = new Map<ToolName, number>();
    const toolRuns = new Map<ToolName, RunRecord[]>();
    let lastGlobalEnd = 0;

    for (const plan of plans) {
      const lastEnd = lastRunByTool.get(plan.tool);
      const now = Date.now();
      const waits: number[] = [];
      if (lastEnd) {
        const elapsed = now - lastEnd;
        waits.push(plan.rateLimitMs - elapsed);
      }
      if (lastGlobalEnd) {
        const elapsedGlobal = now - lastGlobalEnd;
        waits.push(globalRateLimitMs - elapsedGlobal);
      }
      const waitFor = Math.max(0, ...waits);
      if (waitFor > 0) {
        await sleep(waitFor + jitter(baseBackoffMs));
      }

      const record = await executePlan(
        plan,
        baseUrl,
        bridgeToken,
        approvalToken,
        baseBackoffMs,
        maxRetries,
        telemetryLogger
      );
      const runs = toolRuns.get(plan.tool) ?? [];
      runs.push(record);
      toolRuns.set(plan.tool, runs);
      lastRunByTool.set(plan.tool, Date.parse(record.end));
      lastGlobalEnd = Date.parse(record.end);

      const statusLabel = record.status === 'success' ? 'ok' : 'fail';
      process.stdout.write(
        `${plan.tool} #${record.index} (${record.apply ? 'apply' : 'dry'}) ${statusLabel} in ${record.durationMs}ms after ${record.attempts} attempt(s)\n`
      );
      if (record.error) {
        process.stdout.write(`  error: ${record.error}\n`);
        if (record.policyCode) {
          process.stdout.write(`  policy: ${record.policyCode}\n`);
        }
      }
    }

    const finishedAt = isoNow();
    const summaries: ToolSummary[] = [];
    for (const [tool, runs] of toolRuns.entries()) {
      summaries.push(summarizeTool(tool, runs));
    }
    summaries.sort((a, b) => a.tool.localeCompare(b.tool));

    const report: SoakReport = {
      missionId,
      startedAt,
      finishedAt,
      config: {
        baseUrl,
        runsPerTool,
        backoffMs: baseBackoffMs,
        maxRetries,
        maxConcurrent,
      },
      tools: summaries,
    };

    const markdownReport = renderMarkdownReport(report);
    const reportPath = reportPathForToday('soak-report.md');
    fs.writeFileSync(reportPath, `${markdownReport.trimEnd()}\n`, 'utf8');
    const reportRelative = toRelativePath(reportPath);
    process.stdout.write(`\nSoak report written to ${reportRelative}\n`);

    const diagnosticsPath = reportPathForToday('diagnostics.json');
    let diagnostics: Record<string, unknown> = {};
    if (fs.existsSync(diagnosticsPath)) {
      try {
        const raw = fs.readFileSync(diagnosticsPath, 'utf8');
        diagnostics = JSON.parse(raw) as Record<string, unknown>;
      } catch (error) {
        process.stderr.write(`Failed to read existing diagnostics.json: ${(error as Error).message}\n`);
      }
    }

    const reliabilitySummary = summaries.map((summary) => ({
      tool: summary.tool,
      total_runs: summary.totalRuns,
      pass: summary.passCount,
      fail: summary.failCount,
      flake_pct: summary.flakePct,
      p95_ms: summary.p95_ms,
      p99_ms: summary.p99_ms,
    }));

    const totalRuns = reliabilitySummary.reduce((acc, item) => acc + item.total_runs, 0);
    const totalFailures = reliabilitySummary.reduce((acc, item) => acc + item.fail, 0);

    diagnostics.reliability = {
      missionId,
      generated_at: finishedAt,
      soak_report: reportRelative,
      format: 'markdown',
      summary: reliabilitySummary,
    };

    diagnostics.telemetry = {
      missionId,
      generated_at: finishedAt,
      source: 'soak-runner',
      correlation: {
        soak_runner: overallSpan.correlationId,
      },
      jobs: reliabilitySummary.map((item) => ({
        job: `soak:${item.tool}`,
        runs: item.total_runs,
        pass: item.pass,
        fail: item.fail,
        flake_pct: item.flake_pct,
      })),
    };

    fs.writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
    process.stdout.write(`Diagnostics updated with reliability summary at ${toRelativePath(diagnosticsPath)}\n`);

    telemetryLogger.complete(overallSpan, 'success', {
      durationMs: Date.now() - runStartMs,
      metadata: {
        report: reportRelative,
        totalRuns,
        failures: totalFailures,
      },
    });
  } catch (error) {
    telemetryLogger.complete(overallSpan, 'failure', {
      durationMs: Date.now() - runStartMs,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`soak-runner failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
