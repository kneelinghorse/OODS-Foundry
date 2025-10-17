#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Color from 'colorjs.io';
import { contrastRatio } from './contrast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_SOURCE = path.resolve(__dirname, '../../packages/tokens/dist/tailwind/tokens.json');
const REPORT_PATH = path.resolve(__dirname, './reports/a11y-report.json');
const BASELINE_PATH = path.resolve(__dirname, './baseline/a11y-baseline.json');
const GUARDRAILS_PATH = path.resolve(__dirname, './guardrails/relative-color.csv');

const RANGE_TOLERANCE = 0.001;
if ((process.env.GITHUB_HEAD_REF ?? '').includes('smoke-a11y')) {
  console.error(`[a11y-contract] Intentional smoke failure for branch ${process.env.GITHUB_HEAD_REF}`);
  process.exit(1);
}

const RULES = [
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.canvas',
    foreground: 'sys.text.primary',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Primary text on the default surface must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.canvas',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.canvas',
    threshold: 4.5,
    summary: 'Dark theme primary text on canvas must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.raised',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.raised',
    threshold: 4.5,
    summary: 'Dark theme primary text on raised surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'theme-dark.text.primary on theme-dark.surface.subtle',
    foreground: 'theme-dark.text.primary',
    background: 'theme-dark.surface.subtle',
    threshold: 4.5,
    summary: 'Dark theme primary text on subtle surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'inverse-text',
    target: 'sys.text.inverse on sys.surface.inverse',
    foreground: 'sys.text.inverse',
    background: 'sys.surface.inverse',
    threshold: 4.5,
    summary: 'Inverse text must meet 4.5:1 contrast on inverse surfaces.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.raised',
    foreground: 'sys.text.primary',
    background: 'sys.surface.raised',
    threshold: 4.5,
    summary: 'Primary text on raised surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.primary on sys.surface.subtle',
    foreground: 'sys.text.primary',
    background: 'sys.surface.subtle',
    threshold: 4.5,
    summary: 'Primary text on subtle surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.secondary on sys.surface.canvas',
    foreground: 'sys.text.secondary',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Secondary headings on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.muted on sys.surface.canvas',
    foreground: 'sys.text.muted',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Muted body text on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-surface',
    target: 'sys.text.accent on sys.surface.canvas',
    foreground: 'sys.text.accent',
    background: 'sys.surface.canvas',
    threshold: 4.5,
    summary: 'Inline links on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.info.text on sys.status.info.surface',
    foreground: 'sys.status.info.text',
    background: 'sys.status.info.surface',
    threshold: 4.5,
    summary: 'Info text inside info surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.success.text on sys.status.success.surface',
    foreground: 'sys.status.success.text',
    background: 'sys.status.success.surface',
    threshold: 4.5,
    summary: 'Success text inside success surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.warning.text on sys.status.warning.surface',
    foreground: 'sys.status.warning.text',
    background: 'sys.status.warning.surface',
    threshold: 4.5,
    summary: 'Warning text inside warning surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.critical.text on sys.status.critical.surface',
    foreground: 'sys.status.critical.text',
    background: 'sys.status.critical.surface',
    threshold: 4.5,
    summary: 'Critical text inside critical surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.info.icon on sys.status.info.surface',
    foreground: 'sys.status.info.icon',
    background: 'sys.status.info.surface',
    threshold: 3,
    summary: 'Info icons inside info surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.success.icon on sys.status.success.surface',
    foreground: 'sys.status.success.icon',
    background: 'sys.status.success.surface',
    threshold: 3,
    summary: 'Success icons inside success surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.warning.icon on sys.status.warning.surface',
    foreground: 'sys.status.warning.icon',
    background: 'sys.status.warning.surface',
    threshold: 3,
    summary: 'Warning icons inside warning surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.critical.icon on sys.status.critical.surface',
    foreground: 'sys.status.critical.icon',
    background: 'sys.status.critical.surface',
    threshold: 3,
    summary: 'Critical icons inside critical surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.accent.text on sys.status.accent.surface',
    foreground: 'sys.status.accent.text',
    background: 'sys.status.accent.surface',
    threshold: 4.5,
    summary: 'Accent text inside accent surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.accent.icon on sys.status.accent.surface',
    foreground: 'sys.status.accent.icon',
    background: 'sys.status.accent.surface',
    threshold: 3,
    summary: 'Accent icons inside accent surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'status-text',
    target: 'sys.status.neutral.text on sys.status.neutral.surface',
    foreground: 'sys.status.neutral.text',
    background: 'sys.status.neutral.surface',
    threshold: 4.5,
    summary: 'Neutral text inside neutral surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'status-icon',
    target: 'sys.status.neutral.icon on sys.status.neutral.surface',
    foreground: 'sys.status.neutral.icon',
    background: 'sys.status.neutral.surface',
    threshold: 3,
    summary: 'Neutral icons inside neutral surfaces must meet 3:1 contrast.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.canvas',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.canvas',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against the default surface.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.raised',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.raised',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against raised surfaces.'
  },
  {
    ruleId: 'focus-ring',
    target: 'sys.focus.ring.outer on sys.surface.subtle',
    foreground: 'sys.focus.ring.outer',
    background: 'sys.surface.subtle',
    threshold: 3,
    summary: 'Default focus ring must meet 3:1 contrast against subtle surfaces.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.default',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.default',
    threshold: 4.5,
    summary: 'Interactive text on the default primary surface must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.hover',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.hover',
    threshold: 4.5,
    summary: 'Interactive text on hover states must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'sys.text.on-interactive on sys.surface.interactive.primary.pressed',
    foreground: 'sys.text.on-interactive',
    background: 'sys.surface.interactive.primary.pressed',
    threshold: 4.5,
    summary: 'Interactive text on pressed states must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.default',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.default',
    threshold: 4.5,
    summary: 'Dark theme interactive text on default surfaces must meet 4.5:1 contrast.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.hover',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.hover',
    threshold: 4.5,
    summary: 'Dark theme interactive text on hover surfaces must remain AA compliant.'
  },
  {
    ruleId: 'text-on-interactive',
    target: 'theme-dark.text.on-interactive on theme-dark.surface.interactive.primary.pressed',
    foreground: 'theme-dark.text.on-interactive',
    background: 'theme-dark.surface.interactive.primary.pressed',
    threshold: 4.5,
    summary: 'Dark theme interactive text on pressed surfaces must remain AA compliant.'
  }
];

function toSegments(tokenPath) {
  return tokenPath.split('.').map((segment) => segment.trim()).filter(Boolean);
}

async function loadTokenTree() {
  const raw = await readFile(TOKEN_SOURCE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed?.tokens) {
    throw new Error(`Unable to load tokens from ${TOKEN_SOURCE}`);
  }
  return parsed.tokens;
}

function resolveTokenNode(tree, tokenPath) {
  const segments = toSegments(tokenPath);
  let current = tree;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      throw new Error(`Token path "${tokenPath}" could not be resolved.`);
    }
    current = current[segment];
  }

  if (!current || typeof current !== 'object' || !('$value' in current)) {
    throw new Error(`Token path "${tokenPath}" does not reference a token with a $value.`);
  }

  return current;
}

function resolveToken(tree, tokenPath, seen = new Set()) {
  if (seen.has(tokenPath)) {
    throw new Error(`Circular token alias detected at "${tokenPath}".`);
  }
  seen.add(tokenPath);

  const node = resolveTokenNode(tree, tokenPath);
  const value = node.$value;

  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const aliasPath = value.slice(1, -1);
    return resolveToken(tree, aliasPath, seen);
  }

  if (typeof value !== 'string') {
    throw new Error(`Token "${tokenPath}" does not resolve to a string value.`);
  }

  return { node, value };
}

function normaliseColor(token, tokenPath) {
  const fallback = token.node?.$extensions?.ods?.fallback;
  if (fallback && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(fallback)) {
    return fallback;
  }

  const trimmed = token.value.trim();
  if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('oklch')) {
    try {
      const colour = new Color(trimmed);
      return colour
        .to('srgb')
        .toString({ format: 'hex', collapse: false })
        .toUpperCase();
    } catch (error) {
      throw new Error(`Unable to convert "${trimmed}" from ${tokenPath} to hex: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Token "${tokenPath}" resolved to an unsupported colour format "${trimmed}".`);
}

function resolveColor(tree, tokenPath) {
  const token = resolveToken(tree, tokenPath);
  return normaliseColor(token, tokenPath);
}

function parseOklchComponents(rawValue, tokenPath) {
  const value = String(rawValue ?? '').trim();
  try {
    const colour = new Color(value);
    const { l, c, h } = colour.oklch;
    const hue = Number.isFinite(h) ? h : 0;
    return { l, c, h: hue };
  } catch (error) {
    throw new Error(`Unable to parse "${value}" from ${tokenPath} as OKLCH: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hueDelta(baseHue, derivedHue) {
  const base = Number.isFinite(baseHue) ? baseHue : 0;
  const derived = Number.isFinite(derivedHue) ? derivedHue : 0;
  return ((derived - base + 540) % 360) - 180;
}

function formatSigned(value, digits = 4) {
  const formatted = value.toFixed(digits);
  return value >= 0 ? `+${formatted}` : formatted;
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

async function loadGuardrailConfig() {
  let raw;
  try {
    raw = await readFile(GUARDRAILS_PATH, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read guardrail dataset at ${GUARDRAILS_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const rows = lines.filter((line) => line.length > 0 && !line.startsWith('#'));

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].split(',').map((header) => header.trim());
  return rows.slice(1).map((line, index) => {
    const columns = line.split(',').map((column) => column.trim());
    if (columns.length !== headers.length) {
      throw new Error(`Guardrail CSV row ${index + 2} expected ${headers.length} columns but received ${columns.length}.`);
    }

    const entry = {};
    headers.forEach((header, columnIndex) => {
      entry[header] = columns[columnIndex];
    });

    const numeric = (fieldName) => {
      const value = entry[fieldName];
      if (value === undefined || value === '') {
        return null;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        throw new Error(`Guardrail CSV row ${index + 2} column "${fieldName}" must be numeric. Received "${value}".`);
      }
      return asNumber;
    };

    if (!entry.base_token) {
      throw new Error(`Guardrail CSV row ${index + 2} is missing "base_token".`);
    }
    if (!entry.derived_token) {
      throw new Error(`Guardrail CSV row ${index + 2} is missing "derived_token".`);
    }

    return {
      id: entry.id ?? `${entry.usage ?? 'guardrail'}-${entry.theme ?? 'default'}-${entry.state ?? 'state'}`,
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
      contrastForeground: entry.contrast_foreground_token ? entry.contrast_foreground_token : null,
      contrastBackground: entry.contrast_background_token ? entry.contrast_background_token : null,
      contrastThreshold: numeric('contrast_threshold')
    };
  });
}

function evaluateGuardrails(tree, guardrails) {
  if (!Array.isArray(guardrails) || guardrails.length === 0) {
    return [];
  }

  return guardrails.map((guardrail) => {
    const baseToken = resolveToken(tree, guardrail.baseToken);
    const derivedToken = resolveToken(tree, guardrail.derivedToken);

    const baseOklchRaw = parseOklchComponents(baseToken.value, guardrail.baseToken);
    const derivedOklchRaw = parseOklchComponents(derivedToken.value, guardrail.derivedToken);

    const deltaL = derivedOklchRaw.l - baseOklchRaw.l;
    const deltaC = derivedOklchRaw.c - baseOklchRaw.c;
    const deltaH = hueDelta(baseOklchRaw.h, derivedOklchRaw.h);
    const deltaHAbs = Math.abs(deltaH);

    const checks = [];
    const failures = [];

    if (guardrail.deltaLMin != null && guardrail.deltaLMax != null) {
      const pass = deltaL >= guardrail.deltaLMin - RANGE_TOLERANCE && deltaL <= guardrail.deltaLMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaL',
        pass,
        actual: deltaL,
        expectedMin: guardrail.deltaLMin,
        expectedMax: guardrail.deltaLMax
      });
      if (!pass) {
        failures.push(`ΔL ${formatSigned(deltaL)} outside [${guardrail.deltaLMin}, ${guardrail.deltaLMax}].`);
      }
    }

    if (guardrail.deltaCMin != null && guardrail.deltaCMax != null) {
      const pass = deltaC >= guardrail.deltaCMin - RANGE_TOLERANCE && deltaC <= guardrail.deltaCMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaC',
        pass,
        actual: deltaC,
        expectedMin: guardrail.deltaCMin,
        expectedMax: guardrail.deltaCMax
      });
      if (!pass) {
        failures.push(`ΔC ${formatSigned(deltaC)} outside [${guardrail.deltaCMin}, ${guardrail.deltaCMax}].`);
      }
    }

    if (guardrail.deltaHMax != null) {
      const pass = deltaHAbs <= guardrail.deltaHMax + RANGE_TOLERANCE;
      checks.push({
        type: 'deltaH',
        pass,
        actual: deltaHAbs,
        expectedMax: guardrail.deltaHMax
      });
      if (!pass) {
        failures.push(`ΔH ${deltaHAbs.toFixed(4)} exceeds ${guardrail.deltaHMax}.`);
      }
    }

    let contrastRatioValue;
    let baseContrastRatio;
    if (guardrail.contrastThreshold != null) {
      const foregroundPath = guardrail.contrastForeground ?? null;
      const backgroundPath = guardrail.contrastBackground ?? guardrail.derivedToken;
      if (!foregroundPath) {
        throw new Error(`Guardrail "${guardrail.id}" specifies a contrast threshold but no foreground token.`);
      }
      const foregroundHex = resolveColor(tree, foregroundPath);
      const derivedHex = resolveColor(tree, backgroundPath);
      contrastRatioValue = contrastRatio(foregroundHex, derivedHex);
      const pass = contrastRatioValue + Number.EPSILON >= guardrail.contrastThreshold;
      checks.push({
        type: 'contrast',
        pass,
        ratio: contrastRatioValue,
        threshold: guardrail.contrastThreshold,
        foreground: foregroundPath,
        background: backgroundPath
      });
      if (!pass) {
        failures.push(`Contrast ${contrastRatioValue.toFixed(2)}:1 below ${guardrail.contrastThreshold}:1.`);
      }

      try {
        const baseHex = resolveColor(tree, guardrail.baseToken);
        baseContrastRatio = contrastRatio(foregroundHex, baseHex);
      } catch {
        baseContrastRatio = null;
      }
    }

    const pass = checks.every((check) => check.pass);

    const baseOklch = {
      l: Number(baseOklchRaw.l.toFixed(4)),
      c: Number(baseOklchRaw.c.toFixed(4)),
      h: Number(baseOklchRaw.h.toFixed(2))
    };
    const derivedOklch = {
      l: Number(derivedOklchRaw.l.toFixed(4)),
      c: Number(derivedOklchRaw.c.toFixed(4)),
      h: Number(derivedOklchRaw.h.toFixed(2))
    };

    return {
      ruleId: `guardrail:${guardrail.id}`,
      checkType: 'guardrail',
      target: `${titleCase(guardrail.usage)} (${titleCase(guardrail.theme)}) • ${titleCase(guardrail.state)}`,
      summary: [
        `Derived token ${guardrail.derivedToken} must remain within guardrail Δ ranges of ${guardrail.baseToken}.`,
        guardrail.contrastThreshold != null
          ? `Maintain ≥${guardrail.contrastThreshold}:1 contrast using ${guardrail.contrastForeground ?? guardrail.contrastBackground ?? guardrail.derivedToken}.`
          : null
      ].filter(Boolean).join(' '),
      pass,
      failureSummary: failures.join(' '),
      ratio: typeof contrastRatioValue === 'number' ? Number(contrastRatioValue.toFixed(2)) : undefined,
      threshold: guardrail.contrastThreshold ?? undefined,
      metrics: {
        deltaL: Number(deltaL.toFixed(4)),
        deltaC: Number(deltaC.toFixed(4)),
        deltaH: Number(deltaH.toFixed(4)),
        baseToken: guardrail.baseToken,
        derivedToken: guardrail.derivedToken,
        baseOklch,
        derivedOklch,
        contrast: contrastRatioValue == null
          ? null
          : {
              ratio: Number(contrastRatioValue.toFixed(2)),
              threshold: guardrail.contrastThreshold,
              baseRatio: baseContrastRatio == null ? null : Number(baseContrastRatio.toFixed(2)),
              foreground: guardrail.contrastForeground,
              background: guardrail.contrastBackground ?? guardrail.derivedToken
            }
      },
      details: {
        usage: guardrail.usage,
        theme: guardrail.theme,
        state: guardrail.state,
        checks
      }
    };
  });
}

async function generateReport() {
  const tree = await loadTokenTree();

  const contrastResults = RULES.map((rule) => {
    const foreground = resolveColor(tree, rule.foreground);
    const background = resolveColor(tree, rule.background);

    const ratio = contrastRatio(foreground, background);
    const pass = ratio + Number.EPSILON >= rule.threshold;
    const ratioRounded = Number(ratio.toFixed(2));

    return {
      ruleId: rule.ruleId,
      checkType: 'contrast',
      target: rule.target,
      summary: rule.summary,
      ratio: ratioRounded,
      threshold: rule.threshold,
      pass,
      failureSummary: pass
        ? ''
        : `Expected contrast ratio >= ${rule.threshold}, but received ${ratioRounded}.`,
      details: {
        foreground: rule.foreground,
        background: rule.background
      }
    };
  });

  const guardrailConfig = await loadGuardrailConfig();
  const guardrailResults = evaluateGuardrails(tree, guardrailConfig);

  const results = [...contrastResults, ...guardrailResults];

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      contrast: contrastResults.length,
      guardrails: guardrailResults.length,
      overall: results.length
    },
    sections: {
      contrast: contrastResults,
      guardrails: guardrailResults
    },
    results
  };
}

async function ensureReportDir() {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
}

async function writeReport(report) {
  await ensureReportDir();
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function fingerprint(entry) {
  return `${entry.ruleId}::${entry.target}::${entry.summary}`;
}

async function loadBaseline() {
  const raw = await readFile(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const violations = Array.isArray(parsed?.violations) ? parsed.violations : [];
  return {
    ...parsed,
    violations
  };
}

async function runCheck() {
  const report = await generateReport();
  await writeReport(report);

  const contrastResults = Array.isArray(report.sections?.contrast) ? report.sections.contrast : [];
  const guardrailResults = Array.isArray(report.sections?.guardrails) ? report.sections.guardrails : [];

  const contrastPasses = contrastResults.filter((item) => item.pass).length;
  const guardrailPasses = guardrailResults.filter((item) => item.pass).length;
  const totalPasses = report.results.filter((item) => item.pass).length;
  const totalFailures = report.results.length - totalPasses;

  const summaryParts = [];
  if (contrastResults.length > 0) {
    summaryParts.push(`contrast ${contrastPasses}/${contrastResults.length}`);
  }
  if (guardrailResults.length > 0) {
    summaryParts.push(`guardrails ${guardrailPasses}/${guardrailResults.length}`);
  }
  summaryParts.push(`total ${totalPasses}/${report.results.length}`);

  console.log(`[a11y] Report written to ${path.relative(process.cwd(), REPORT_PATH)} (${summaryParts.join(', ')}).`);

  if (totalFailures > 0) {
    console.warn('[a11y] Accessibility guardrail or contrast violations detected. Run "yarn a11y:diff" to compare against the baseline.');
  }
}

async function runDiff() {
  const report = await generateReport();
  await writeReport(report);

  let baseline;
  try {
    baseline = await loadBaseline();
  } catch (error) {
    console.error(`[a11y] Failed to read baseline from ${BASELINE_PATH}.`);
    throw error;
  }

  const baselineFingerprints = new Set(
    baseline.violations.map((violation) => fingerprint(violation))
  );
  const currentViolations = report.results.filter((item) => !item.pass);

  const newViolations = currentViolations.filter(
    (violation) => !baselineFingerprints.has(fingerprint(violation))
  );

  const resolvedViolations = baseline.violations.filter(
    (violation) => !currentViolations.some(
      (current) => fingerprint(current) === fingerprint(violation)
    )
  );

  if (newViolations.length > 0) {
    console.error('[a11y] New accessibility guardrail/contrast violations detected:');
    for (const violation of newViolations) {
      const label = violation.checkType ? `[${violation.checkType}] ` : '';
      const hasRatio = typeof violation.ratio === 'number' && typeof violation.threshold === 'number';
      const ratioPart = hasRatio ? ` — ratio ${violation.ratio} (threshold ${violation.threshold})` : '';
      console.error(`  • ${label}${violation.target}${ratioPart}`);
      if (violation.failureSummary) {
        console.error(`    ↳ ${violation.failureSummary}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (resolvedViolations.length > 0) {
    console.log('[a11y] Existing baseline violations now passing:');
    for (const violation of resolvedViolations) {
      console.log(`  • ${violation.target}`);
    }
    console.log('[a11y] Consider updating the baseline with "node tools/a11y/index.mjs baseline".');
  }

  console.log('[a11y] No new accessibility guardrail or contrast violations detected.');
}

async function runBaselineUpdate() {
  const report = await generateReport();
  await writeReport(report);

  const violations = report.results.filter((item) => !item.pass);
  const baseline = {
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(path.dirname(BASELINE_PATH), REPORT_PATH),
    fingerprintFields: ['ruleId', 'target', 'summary'],
    violations
  };

  await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
  await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');

  console.log(`[a11y] Baseline updated with ${violations.length} violation(s).`);
}

async function main() {
  const [, , rawCommand] = process.argv;
  const command = rawCommand ?? 'check';

  try {
    if (command === 'check') {
      await runCheck();
    } else if (command === 'diff') {
      await runDiff();
    } else if (command === 'baseline') {
      await runBaselineUpdate();
    } else {
      console.error(`[a11y] Unknown command "${command}". Expected "check", "diff", or "baseline".`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[a11y] An error occurred while evaluating contrast rules.');
    if (error instanceof Error) {
      console.error(`      ${error.message}`);
    } else {
      console.error(`      ${String(error)}`);
    }
    process.exitCode = 1;
  }
}

await main();
