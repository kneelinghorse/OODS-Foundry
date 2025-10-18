#!/usr/bin/env tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import Color from 'colorjs.io';
import { contrastRatio } from '@oods/a11y-tools';

import { loadDtcgTokens, type DtcgToken } from '../../src/tooling/tokens/dtcg.js';

interface CliOptions {
  mission: string;
  diagnostics: boolean;
  quiet: boolean;
}

interface GuardrailSpec {
  id: string;
  usage: string;
  theme: string;
  state: string;
  baseToken: string;
  derivedToken: string;
  deltaLMin: number | null;
  deltaLMax: number | null;
  deltaCMin: number | null;
  deltaCMax: number | null;
  deltaHMax: number | null;
  contrastForeground: string | null;
  contrastBackground: string | null;
  contrastThreshold: number | null;
}

interface GuardrailCheck {
  type: 'deltaL' | 'deltaC' | 'deltaH' | 'contrast';
  pass: boolean;
  actual?: number;
  expectedMin?: number | null;
  expectedMax?: number | null;
  ratio?: number;
  threshold?: number;
  foreground?: string;
  background?: string;
}

interface GuardrailResult {
  spec: GuardrailSpec;
  deltaL: number;
  deltaC: number;
  deltaH: number;
  contrastRatio?: number;
  checks: GuardrailCheck[];
  failures: string[];
}

interface DiagnosticsEntry {
  mission: string;
  evaluatedAt: string;
  checks: number;
  passes: number;
  failures: number;
  durationMs: number;
}

const DEFAULT_OPTIONS: CliOptions = {
  mission: 'unspecified',
  diagnostics: true,
  quiet: false,
};

const projectRoot = process.cwd();
const tokensRoot = path.resolve(projectRoot, 'tokens');
const guardrailCsvPath = path.resolve(projectRoot, 'tools/a11y/guardrails/relative-color.csv');
const diagnosticsPath = path.resolve(projectRoot, 'diagnostics.json');

const REFERENCE_PATTERN = /^\{([^}]+)\}$/;
const RANGE_TOLERANCE = 0.0005;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const start = performance.now();

  const guardrails = await loadGuardrails(guardrailCsvPath);
  if (guardrails.length === 0) {
    throw new Error(`No guardrails defined in ${path.relative(projectRoot, guardrailCsvPath)}.`);
  }

  const tokens = await loadDtcgTokens(tokensRoot);
  const tokenMap = new Map<string, DtcgToken>(tokens.map((token) => [token.path.join('.'), token]));

  const results = guardrails.map((spec) => evaluateGuardrail(spec, tokenMap));

  const failures = results.filter((result) => result.failures.length > 0);
  const passes = results.length - failures.length;
  const durationMs = Math.round(performance.now() - start);

  if (!options.quiet) {
    for (const result of results) {
      const status = result.failures.length === 0 ? '✓' : '✖';
      const summary = [
        `ΔL=${formatSigned(result.deltaL)}`,
        `ΔC=${formatSigned(result.deltaC)}`,
        `ΔH=${result.deltaH.toFixed(3)}`,
      ];
      if (typeof result.contrastRatio === 'number') {
        summary.push(`contrast=${result.contrastRatio.toFixed(2)}:1`);
      }
      const detail = summary.join(' · ');
      const line = `${status} ${result.spec.id} (${result.spec.usage}/${result.spec.theme}/${result.spec.state}) — ${detail}`;
      console[result.failures.length === 0 ? 'log' : 'error'](line);
      if (result.failures.length > 0) {
        for (const failure of result.failures) {
          console.error(`    • ${failure}`);
        }
      }
    }

    const outcome = failures.length === 0 ? '✔︎ Color guardrails pass' : '⚠︎ Color guardrails failed';
    console[failures.length === 0 ? 'log' : 'error'](
      `${outcome} (${passes}/${results.length} checks, ${durationMs}ms)`,
    );
  }

  if (options.diagnostics) {
    await appendDiagnostics({
      mission: options.mission,
      evaluatedAt: new Date().toISOString(),
      checks: results.length,
      passes,
      failures: failures.length,
      durationMs,
    });
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
    switch (arg) {
      case '--mission': {
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
          throw new Error('Expected mission identifier after --mission');
        }
        options.mission = next;
        i += 1;
        break;
      }
      case '--no-diagnostics':
        options.diagnostics = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        break;
    }
  }

  return options;
}

async function loadGuardrails(filePath: string): Promise<GuardrailSpec[]> {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.length === 0) {
    return [];
  }

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((header) => header.trim());

  return rows.map((row, index) => {
    const columns = row.split(',').map((column) => column.trim());
    if (columns.length !== headers.length) {
      throw new Error(
        `Guardrail csv row ${index + 2} expected ${headers.length} columns but received ${columns.length}.`,
      );
    }

    const entry: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      entry[header] = columns[columnIndex];
    });

    const numeric = (key: string): number | null => {
      const raw = entry[key];
      if (!raw) {
        return null;
      }
      const value = Number(raw);
      if (Number.isNaN(value)) {
        throw new Error(
          `Guardrail csv row ${index + 2} column "${key}" must be numeric. Received "${raw}".`,
        );
      }
      return value;
    };

    const text = (key: string): string | null => {
      const raw = entry[key];
      return raw ? raw : null;
    };

    return {
      id: entry.id ?? `guardrail-${index + 1}`,
      usage: entry.usage ?? 'unknown',
      theme: entry.theme ?? 'default',
      state: entry.state ?? 'state',
      baseToken: entry.base_token,
      derivedToken: entry.derived_token,
      deltaLMin: numeric('delta_l_min'),
      deltaLMax: numeric('delta_l_max'),
      deltaCMin: numeric('delta_c_min'),
      deltaCMax: numeric('delta_c_max'),
      deltaHMax: numeric('delta_h_max'),
      contrastForeground: text('contrast_foreground_token'),
      contrastBackground: text('contrast_background_token'),
      contrastThreshold: numeric('contrast_threshold'),
    };
  });
}

function evaluateGuardrail(spec: GuardrailSpec, tokens: Map<string, DtcgToken>): GuardrailResult {
  const baseValue = resolveTokenValue(spec.baseToken, tokens);
  const derivedValue = resolveTokenValue(spec.derivedToken, tokens);

  const baseColor = parseOklch(baseValue, spec.baseToken);
  const derivedColor = parseOklch(derivedValue, spec.derivedToken);

  const deltaL = derivedColor.l - baseColor.l;
  const deltaC = derivedColor.c - baseColor.c;
  const deltaH = Math.abs(hueDelta(baseColor.h, derivedColor.h));

  const checks: GuardrailCheck[] = [];
  const failures: string[] = [];

  if (spec.deltaLMin != null && spec.deltaLMax != null) {
    const pass =
      deltaL >= spec.deltaLMin - RANGE_TOLERANCE && deltaL <= spec.deltaLMax + RANGE_TOLERANCE;
    checks.push({
      type: 'deltaL',
      pass,
      actual: deltaL,
      expectedMin: spec.deltaLMin,
      expectedMax: spec.deltaLMax,
    });
    if (!pass) {
      failures.push(
        `ΔL ${formatSigned(deltaL)} outside [${spec.deltaLMin}, ${spec.deltaLMax}]`,
      );
    }
  }

  if (spec.deltaCMin != null && spec.deltaCMax != null) {
    const pass =
      deltaC >= spec.deltaCMin - RANGE_TOLERANCE && deltaC <= spec.deltaCMax + RANGE_TOLERANCE;
    checks.push({
      type: 'deltaC',
      pass,
      actual: deltaC,
      expectedMin: spec.deltaCMin,
      expectedMax: spec.deltaCMax,
    });
    if (!pass) {
      failures.push(
        `ΔC ${formatSigned(deltaC)} outside [${spec.deltaCMin}, ${spec.deltaCMax}]`,
      );
    }
  }

  if (spec.deltaHMax != null) {
    const pass = deltaH <= spec.deltaHMax + RANGE_TOLERANCE;
    checks.push({
      type: 'deltaH',
      pass,
      actual: deltaH,
      expectedMax: spec.deltaHMax,
    });
    if (!pass) {
      failures.push(`ΔH ${deltaH.toFixed(3)} exceeds ${spec.deltaHMax}`);
    }
  }

  let contrast: number | undefined;
  if (spec.contrastThreshold != null) {
    const foregroundToken = spec.contrastForeground;
    if (!foregroundToken) {
      throw new Error(
        `Guardrail "${spec.id}" defines a contrast threshold but no foreground token.`,
      );
    }
    const foregroundColor = toHex(resolveTokenValue(foregroundToken, tokens), foregroundToken);
    const backgroundToken = spec.contrastBackground ?? spec.derivedToken;
    const backgroundColor = toHex(resolveTokenValue(backgroundToken, tokens), backgroundToken);
    contrast = contrastRatio(foregroundColor, backgroundColor);
    const pass = contrast + Number.EPSILON >= spec.contrastThreshold;
    checks.push({
      type: 'contrast',
      pass,
      ratio: contrast,
      threshold: spec.contrastThreshold,
      foreground: foregroundToken,
      background: backgroundToken,
    });
    if (!pass) {
      failures.push(
        `Contrast ${contrast.toFixed(2)}:1 below ${spec.contrastThreshold.toFixed(2)}:1 (${foregroundToken} on ${backgroundToken})`,
      );
    }
  }

  return {
    spec,
    deltaL,
    deltaC,
    deltaH,
    contrastRatio: contrast,
    checks,
    failures,
  };
}

function resolveTokenValue(pathExpression: string, tokens: Map<string, DtcgToken>): string {
  const visited = new Set<string>();
  let current = pathExpression;

  while (true) {
    if (visited.has(current)) {
      throw new Error(`Circular token reference detected while resolving "${pathExpression}".`);
    }

    const token = tokens.get(current);
    if (!token) {
      throw new Error(`Token "${pathExpression}" references unknown token "${current}".`);
    }

    if (typeof token.value !== 'string') {
      throw new Error(`Token "${current}" does not expose a string value.`);
    }

    const trimmed = token.value.trim();
    const match = REFERENCE_PATTERN.exec(trimmed);
    if (!match) {
      return trimmed;
    }

    visited.add(current);
    current = match[1];
  }
}

function parseOklch(value: string, token: string): { l: number; c: number; h: number } {
  try {
    const color = new Color(value);
    const raw = color.oklch;
    let l = Number.NaN;
    let c = Number.NaN;
    let h = Number.NaN;

    if (Array.isArray(raw)) {
      l = Number(raw[0]);
      c = Number(raw[1]);
      h = Number(raw[2]);
    } else if (raw && typeof raw === 'object') {
      const record = raw as { l?: unknown; c?: unknown; h?: unknown };
      l = Number(record.l);
      c = Number(record.c);
      h = Number(record.h);
    }

    if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
      throw new Error('Missing OKLCH channels');
    }
    return { l, c, h };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse OKLCH value for "${token}": ${message}`);
  }
}

function toHex(value: string, token: string): string {
  try {
    const color = new Color(value);
    return color.to('srgb').toString({ format: 'hex', collapse: false }).toUpperCase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to convert token "${token}" to hex: ${message}`);
  }
}

function hueDelta(baseHue: number, derivedHue: number): number {
  const normalizedBase = Number.isFinite(baseHue) ? baseHue : 0;
  const normalizedDerived = Number.isFinite(derivedHue) ? derivedHue : 0;
  const diff = ((normalizedDerived - normalizedBase + 540) % 360) - 180;
  return diff;
}

function formatSigned(value: number): string {
  const formatted = value.toFixed(3);
  if (value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

async function appendDiagnostics(entry: DiagnosticsEntry): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const content = await fs.readFile(diagnosticsPath, 'utf8');
    existing = JSON.parse(content);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) {
      throw error;
    }
  }

  const tokensSection = ensureObject(existing, 'tokens');
  const guardrailSection = ensureObject(tokensSection, 'guardrails');
  const history = ensureArray<DiagnosticsEntry>(guardrailSection, 'history');

  history.push(entry);
  // Keep the most recent 20 entries
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  guardrailSection.lastRun = entry;

  await fs.writeFile(diagnosticsPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
}

function ensureObject(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = container[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const value: Record<string, unknown> = {};
  container[key] = value;
  return value;
}

function ensureArray<T>(container: Record<string, unknown>, key: string): T[] {
  const existing = container[key];
  if (Array.isArray(existing)) {
    return existing as T[];
  }
  const value: T[] = [];
  container[key] = value;
  return value;
}

await main();
