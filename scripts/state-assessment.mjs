#!/usr/bin/env node

/**
 * Sprint 16 current state assessment orchestrator.
 *
 * Generates JSON + Markdown artifacts under artifacts/state/* with
 * category-level signals, evidence, and next steps.
 *
 * This is an assessment-only tool: it runs checks, records facts, and
 * never attempts to auto-fix problems.
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';

const SCRIPT_VERSION = '1.0.0';
const MISSION_ID = 'BI-20251023-1690';
const CHECK_IDS = [
  'storybook',
  'domains',
  'overlays',
  'a11y',
  'vr',
  'guardrails',
  'performance',
  'tokens',
  'coverage',
  'packaging'
];

const PERFORMANCE_BUDGETS = {
  compositorActualDurationMs: 7,
  listActualDurationMs: 150,
  tokenTransformUserTimingMs: 3000
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const artifactsRoot = path.join(repoRoot, 'artifacts', 'state');
const screenshotsRoot = path.join(artifactsRoot, 'screenshots');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const nodeCmd = process.execPath;
const require = createRequire(import.meta.url);
const metadataGuardrailRule = require('../eslint/rules/no-account-unsafe-metadata.cjs');
const tenancyGuardrailRule = require('../eslint/rules/no-unsafe-tenancy-override.cjs');

/**
 * Entry point.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const selectedChecks =
    args.enabled.size > 0 ? [...args.enabled] : [...CHECK_IDS];

  const context = {
    repoRoot,
    artifactsRoot,
    screenshotsRoot,
    pnpmCmd,
    nodeCmd,
    options: args.options,
    memo: {
      storybookReady: false
    }
  };

  await fs.mkdir(artifactsRoot, { recursive: true });
  await fs.mkdir(screenshotsRoot, { recursive: true });

  const checkResults = [];

  for (const id of CHECK_IDS) {
    if (!selectedChecks.includes(id)) {
      continue;
    }
    const descriptor = CHECK_RUNNERS[id];
    if (!descriptor) {
      continue;
    }

    const startedAt = new Date();
    const timerStart = performance.now();
    let outcome;

    try {
      outcome = await descriptor.run(context);
    } catch (error) {
      const durationMs = Math.round(performance.now() - timerStart);
      const note =
        error instanceof Error ? error.message : String(error ?? 'Unknown failure');
      outcome = {
        id,
        label: descriptor.label,
        status: 'UNKNOWN',
        keyMetric: 'Check failed to execute',
        metrics: {},
        rationale: [
          `Execution error: ${note}`
        ],
        evidence: [],
        outputs: descriptor.outputs ?? {},
        durationMs,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        errors: [note]
      };
    }

    outcome.durationMs = outcome.durationMs ?? Math.round(performance.now() - timerStart);
    outcome.startedAt = outcome.startedAt ?? startedAt.toISOString();
    outcome.completedAt = outcome.completedAt ?? new Date().toISOString();
    outcome.outputs = { ...(descriptor.outputs ?? {}), ...(outcome.outputs ?? {}) };

    checkResults.push(outcome);
  }

  const statusCounts = countStatuses(checkResults);
  const overallStatus = deriveOverallStatus(statusCounts);
  const nextSteps = deriveNextSteps(checkResults);
  const generatedAt = new Date().toISOString();
  const commitHash = await resolveGitCommit(repoRoot);

  const assessment = {
    missionId: MISSION_ID,
    displayName: 'Implementation Mission',
    scriptVersion: SCRIPT_VERSION,
    generatedAt,
    repository: {
      root: repoRoot,
      commit: commitHash
    },
    summary: {
      overallStatus,
      statusCounts
    },
    checks: checkResults,
    nextSteps,
    artifacts: {
      assessment: 'artifacts/state/assessment.json',
      summary: 'artifacts/state/assessment.md',
      storybook: 'artifacts/state/storybook.json',
      domains: 'artifacts/state/domains.json',
      overlays: 'artifacts/state/overlays.json',
      a11y: 'artifacts/state/a11y.json',
      vr: 'artifacts/state/vr.json',
      performance: 'artifacts/state/performance.json',
      tokens: 'artifacts/state/tokens.json',
      coverage: 'artifacts/state/tests.json',
      packaging: 'artifacts/state/packaging.json'
    }
  };

  await writeJson(path.join(artifactsRoot, 'assessment.json'), assessment);
  await writeMarkdown(
    path.join(artifactsRoot, 'assessment.md'),
    buildMarkdownSummary(assessment)
  );

  printConsoleSummary(assessment);
}

/**
 * Command-line argument parsing.
 */
function parseArgs(argv) {
  const enabled = new Set();
  const options = {
    vrMode: 'auto'
  };
  let help = false;

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      help = true;
      continue;
    }
    if (!raw.startsWith('--')) {
      continue;
    }
    const token = raw.slice(2);

    if (token === 'all') {
      CHECK_IDS.forEach((id) => enabled.add(id));
      continue;
    }

    switch (token) {
      case 'sb':
      case 'storybook':
        enabled.add('storybook');
        break;
      case 'domains':
        enabled.add('domains');
        break;
      case 'overlays':
        enabled.add('overlays');
        break;
      case 'a11y':
        enabled.add('a11y');
        break;
      case 'vr':
        enabled.add('vr');
        options.vrMode = 'chromatic';
        break;
      case 'vr-dry':
        enabled.add('vr');
        options.vrMode = 'chromatic';
        break;
      case 'vr-fallback':
        enabled.add('vr');
        options.vrMode = 'fallback';
        break;
      case 'perf':
      case 'performance':
        enabled.add('performance');
        break;
      case 'guardrails':
        enabled.add('guardrails');
        break;
      case 'tokens':
        enabled.add('tokens');
        break;
      case 'coverage':
        enabled.add('coverage');
        break;
      case 'packaging':
        enabled.add('packaging');
        break;
      default:
        break;
    }
  }

  return { enabled, options, help };
}

/**
 * Help text.
 */
function printHelp() {
  console.log(`Usage: node scripts/state-assessment.mjs [options]

Runs current-state assessment checks and writes artifacts under artifacts/state/.

Options:
  --all             Run every check (default when no flags provided)
  --sb              Only run Storybook wiring & taxonomy check
  --domains         Only run domain view check
  --overlays        Only run overlays proof
  --a11y            Only run accessibility check
  --vr              Force Chromatic dry run (requires CHROMATIC_PROJECT_TOKEN)
  --vr-dry          Alias for --vr
  --vr-fallback     Force local VRT fallback (storycap light/dark)
  --perf            Only run performance baseline check
  --performance     Alias for --perf
  --guardrails      Only run metadata & tenancy guardrail lint checks
  --tokens          Only run token governance & CSS purity checks
  --coverage        Only run coverage & reliability checks
  --packaging       Only run packaging & provenance readiness
  -h, --help        Show this message
`);
}

/**
 * Check registry.
 */
const CHECK_RUNNERS = {
  storybook: {
    label: 'Storybook wiring & taxonomy',
    outputs: {
      json: 'artifacts/state/storybook.json'
    },
    run: runStorybookCheck
  },
  domains: {
    label: 'Domain views (contexts & regions)',
    outputs: {
      json: 'artifacts/state/domains.json'
    },
    run: runDomainsCheck
  },
  overlays: {
    label: 'Overlays foundation (B16.2)',
    outputs: {
      json: 'artifacts/state/overlays.json'
    },
    run: runOverlaysCheck
  },
  a11y: {
    label: 'Accessibility & HC contract',
    outputs: {
      json: 'artifacts/state/a11y.json'
    },
    run: runA11yCheck
  },
  vr: {
    label: 'Visual regression dry run',
    outputs: {
      json: 'artifacts/state/vr.json'
    },
    run: runVisualRegressionCheck
  },
  guardrails: {
    label: 'Metadata & tenancy guardrails',
    outputs: {
      json: 'artifacts/state/guardrails.json'
    },
    run: runGuardrailsCheck
  },
  performance: {
    label: 'Performance baselines',
    outputs: {
      json: 'artifacts/state/performance.json'
    },
    run: runPerformanceCheck
  },
  tokens: {
    label: 'Token governance & CSS purity',
    outputs: {
      json: 'artifacts/state/tokens.json'
    },
    run: runTokenGovernanceCheck
  },
  coverage: {
    label: 'Coverage & reliability',
    outputs: {
      json: 'artifacts/state/tests.json'
    },
    run: runCoverageCheck
  },
  packaging: {
    label: 'Packaging & provenance readiness',
    outputs: {
      json: 'artifacts/state/packaging.json'
    },
    run: runPackagingCheck
  }
};

/**
 * Storybook wiring & taxonomy check.
 */
async function runStorybookCheck(context) {
  const taxonomyPath = path.join(context.repoRoot, '.storybook', 'TAXONOMY.md');
  const storyIndexPath = path.join(context.repoRoot, 'storybook-static', 'index.json');
  const previewPath = path.join(context.repoRoot, '.storybook', 'preview.ts');

  const rationale = [];
  const evidence = [];

  const taxonomy = await parseTaxonomyDoc(taxonomyPath);
  if (!taxonomy) {
    const details = 'Canonical taxonomy document missing at .storybook/TAXONOMY.md';
    await writeJson(path.join(context.artifactsRoot, 'storybook.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: details
    });
    return {
      id: 'storybook',
      label: CHECK_RUNNERS.storybook.label,
      status: 'UNKNOWN',
      keyMetric: 'No taxonomy definition available',
      metrics: {},
      rationale: [details],
      evidence
    };
  }

  const ensure = await ensureStorybookBuild(context, 'storybook index');
  if (ensure.error) {
    const details = `build-storybook failed: ${ensure.error}`;
    await writeJson(path.join(context.artifactsRoot, 'storybook.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: details
    });
    return {
      id: 'storybook',
      label: CHECK_RUNNERS.storybook.label,
      status: 'UNKNOWN',
      keyMetric: 'Storybook build unavailable',
      metrics: {},
      rationale: [details],
      evidence
    };
  }

  const storyIndex = await readJsonIfExists(storyIndexPath);
  if (!storyIndex || typeof storyIndex !== 'object') {
    const details = 'storybook-static/index.json missing or unreadable';
    await writeJson(path.join(context.artifactsRoot, 'storybook.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: details
    });
    return {
      id: 'storybook',
      label: CHECK_RUNNERS.storybook.label,
      status: 'UNKNOWN',
      keyMetric: 'Story index unavailable',
      metrics: {},
      rationale: [details],
      evidence
    };
  }

  const entries = storyIndex.entries ?? {};
  const storyEntries = Object.values(entries).filter(
    (entry) => entry && typeof entry === 'object' && entry.type === 'story'
  );
  const totalStories = storyEntries.length;

  const observedCategories = new Set(
    storyEntries
      .map((entry) => (typeof entry.title === 'string' ? entry.title.split('/')[0] : null))
      .filter((value) => typeof value === 'string' && value.length > 0)
  );

  const missing = taxonomy.allowed.filter((item) => !observedCategories.has(item));
  const extras = [...observedCategories].filter((item) => !taxonomy.allowed.includes(item));

  let globalsOk = false;
  try {
    const previewContents = await fs.readFile(previewPath, 'utf8');
    globalsOk =
      previewContents.includes("setAttribute('data-theme'") &&
      previewContents.includes("setAttribute('data-brand'");
  } catch {
    globalsOk = false;
  }

  const samples = storyEntries.slice(0, 10).map((entry) => ({
    id: entry.id ?? null,
    title: entry.title ?? null,
    name: entry.name ?? null,
    importPath: entry.importPath ?? null,
    tags: Array.isArray(entry.tags) ? entry.tags : []
  }));

  let status = 'GREEN';
  if (!globalsOk) {
    status = 'RED';
    rationale.push('Global theme/brand decorators missing expected data attributes in preview.ts.');
  }
  if (missing.length > 0 || extras.length > 0) {
    const drift = [];
    if (missing.length > 0) {
      drift.push(`missing: ${missing.join(', ')}`);
    }
    if (extras.length > 0) {
      drift.push(`extras: ${extras.join(', ')}`);
    }
    rationale.push(`Taxonomy drift detected (${drift.join('; ')}).`);
    status = status === 'RED' ? 'RED' : 'YELLOW';
  }
  if (rationale.length === 0) {
    rationale.push('Storybook globals apply expected data attributes and taxonomy aligns with canonical list.');
  }

  const keyMetric = `Total stories: ${totalStories} | Missing categories: ${missing.length} | Extras: ${extras.length}`;

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    globalsOk,
    taxonomy: {
      allowed: taxonomy.allowed,
      missing,
      extras,
      observed: [...observedCategories]
    },
    stories: {
      total: totalStories
    },
    samples,
    rationale
  };

  await writeJson(path.join(context.artifactsRoot, 'storybook.json'), payload);

  evidence.push(
    { label: 'Taxonomy doc', path: '.storybook/TAXONOMY.md' },
    { label: 'Story index', path: 'storybook-static/index.json' }
  );

  return {
    id: 'storybook',
    label: CHECK_RUNNERS.storybook.label,
    status,
    keyMetric,
    metrics: {
      totalStories,
      missingCategories: missing,
      extraCategories: extras,
      globalsOk
    },
    rationale,
    evidence
  };
}

/**
 * Domain view assessment.
 */
async function runDomainsCheck(context) {
  const storyIndexPath = path.join(context.repoRoot, 'storybook-static', 'index.json');
  const rationale = [];
  const evidence = [{ label: 'Story index', path: 'storybook-static/index.json' }];

  const ensure = await ensureStorybookBuild(context, 'domain mapping');
  if (ensure.error) {
    const message = `build-storybook failed: ${ensure.error}`;
    await writeJson(path.join(context.artifactsRoot, 'domains.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: message
    });
    return {
      id: 'domains',
      label: CHECK_RUNNERS.domains.label,
      status: 'UNKNOWN',
      keyMetric: 'Storybook build unavailable',
      metrics: {},
      rationale: [message],
      evidence
    };
  }

  const storyIndex = await readJsonIfExists(storyIndexPath);
  if (!storyIndex) {
    const message = 'storybook-static/index.json missing or unreadable';
    await writeJson(path.join(context.artifactsRoot, 'domains.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: message
    });
    return {
      id: 'domains',
      label: CHECK_RUNNERS.domains.label,
      status: 'UNKNOWN',
      keyMetric: 'Story index unavailable',
      metrics: {},
      rationale: [message],
      evidence
    };
  }

  const domainDetails = collectDomainStories(storyIndex.entries ?? {});
  const domainKeys = Object.keys(domainDetails);
  if (domainKeys.length === 0) {
    const message = 'No stories under Domains/* detected in Storybook index.';
    await writeJson(path.join(context.artifactsRoot, 'domains.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: message,
      perDomain: {}
    });
    return {
      id: 'domains',
      label: CHECK_RUNNERS.domains.label,
      status: 'UNKNOWN',
      keyMetric: 'No domain stories found',
      metrics: {},
      rationale: [message],
      evidence
    };
  }

  const gaps = [];
  let missingContextTotal = 0;
  let redCandidates = 0;

  for (const [domainKey, detail] of Object.entries(domainDetails)) {
    const missingContexts = REQUIRED_CONTEXTS.filter((ctx) => !detail.contexts[ctx]);
    if (missingContexts.length > 0) {
      missingContextTotal += missingContexts.length;
      gaps.push({
        domain: domainKey,
        missing: missingContexts
      });
      if (missingContexts.length >= 3) {
        redCandidates += 1;
      }
    }
  }

  let status = 'GREEN';
  if (redCandidates > 0) {
    status = 'RED';
  } else if (missingContextTotal > 0) {
    status = 'YELLOW';
  }

  if (status === 'GREEN') {
    rationale.push('All domain views expose detail/list/form/timeline stories.');
  } else {
    rationale.push('Domain context coverage incomplete — see gaps array.');
  }

  const keyMetric = `Domains: ${domainKeys.length} | Missing contexts: ${missingContextTotal}`;

  await writeJson(path.join(context.artifactsRoot, 'domains.json'), {
    generatedAt: new Date().toISOString(),
    status,
    perDomain: domainDetails,
    gaps
  });

  return {
    id: 'domains',
    label: CHECK_RUNNERS.domains.label,
    status,
    keyMetric,
    metrics: {
      totalDomains: domainKeys.length,
      missingContextTotal,
      gaps
    },
    rationale,
    evidence
  };
}

const REQUIRED_CONTEXTS = ['detail', 'list', 'form', 'timeline'];

function collectDomainStories(entries) {
  const domains = {};
  if (!entries || typeof entries !== 'object') {
    return domains;
  }

  for (const entry of Object.values(entries)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    if (entry.type !== 'story') {
      continue;
    }
    if (typeof entry.title !== 'string' || !entry.title.startsWith('Domains/')) {
      continue;
    }

    const segments = entry.title.split('/');
    if (segments.length < 3) {
      continue;
    }
    const domainKey = segments.slice(0, 3).join('/');
    const context = detectContext(entry);
    if (!domains[domainKey]) {
      domains[domainKey] = {
        contexts: {
          detail: false,
          list: false,
          form: false,
          timeline: false
        },
        stories: []
      };
    }
    domains[domainKey].stories.push({
      id: entry.id ?? null,
      name: entry.name ?? null,
      context
    });
    if (context && domains[domainKey].contexts.hasOwnProperty(context)) {
      domains[domainKey].contexts[context] = true;
    }
  }

  return domains;
}

function detectContext(entry) {
  const tokens = [];
  if (typeof entry.id === 'string') {
    tokens.push(entry.id.toLowerCase());
  }
  if (typeof entry.name === 'string') {
    tokens.push(entry.name.toLowerCase());
  }
  const joined = tokens.join(' ');
  if (joined.includes('detail')) {
    return 'detail';
  }
  if (joined.includes('list')) {
    return 'list';
  }
  if (joined.includes('timeline')) {
    return 'timeline';
  }
  if (joined.includes('form')) {
    return 'form';
  }
  return null;
}

/**
 * Overlays proof.
 */
async function runOverlaysCheck(context) {
  const rationale = [];
  const diagnosticsPath = path.join(context.repoRoot, 'diagnostics.json');
  const evidence = [{ label: 'diagnostics.json', path: 'diagnostics.json' }];

  const command = await runProcess(context.pnpmCmd, ['run', 'overlays:proof'], {
    cwd: context.repoRoot
  });

  if (command.exitCode !== 0) {
    rationale.push('overlays:proof command failed — see console output.');
  }

  const diagnostics = await readJsonIfExists(diagnosticsPath);
  const helper = diagnostics?.helpers?.overlaysProof;
  const lastRun = helper?.lastRun ?? null;

  if (!lastRun) {
    const payload = {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: 'No overlaysProof entry present in diagnostics.json.',
      run: null
    };
    await writeJson(path.join(context.artifactsRoot, 'overlays.json'), payload);

    return {
      id: 'overlays',
      label: CHECK_RUNNERS.overlays.label,
      status: 'UNKNOWN',
      keyMetric: 'No overlays diagnostics available',
      metrics: {},
      rationale: ['No overlays proof run recorded in diagnostics.json.'],
      evidence
    };
  }

  const status = lastRun.status === 'passed' ? 'GREEN' : 'RED';
  const keyMetric = `Last run: ${lastRun.status} @ ${lastRun.runAt}`;

  if (status === 'GREEN') {
    rationale.push('Overlay manager e2e + axe suites passed in latest run.');
  } else {
    rationale.push('Overlay proof failed — review diagnostics history.');
  }

  await writeJson(path.join(context.artifactsRoot, 'overlays.json'), {
    generatedAt: new Date().toISOString(),
    status,
    helper,
    notes: rationale
  });

  return {
    id: 'overlays',
    label: CHECK_RUNNERS.overlays.label,
    status,
    keyMetric,
    metrics: {
      lastRun,
      totals: helper.totals ?? null
    },
    rationale,
    evidence
  };
}

/**
 * Accessibility contract check.
 */
async function runA11yCheck(context) {
  const rationale = [];
  const evidence = [
    { label: 'A11y report', path: 'tools/a11y/reports/a11y-report.json' }
  ];
  const reportPath = path.join(context.repoRoot, 'tools', 'a11y', 'reports', 'a11y-report.json');

  const ensure = await ensureStorybookBuild(context, 'a11y check');
  if (ensure.error) {
    const message = `build-storybook failed: ${ensure.error}`;
    await writeJson(path.join(context.artifactsRoot, 'a11y.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: message
    });
    return {
      id: 'a11y',
      label: CHECK_RUNNERS.a11y.label,
      status: 'UNKNOWN',
      keyMetric: 'Storybook build unavailable',
      metrics: {},
      rationale: [message],
      evidence
    };
  }

  const command = await runProcess(context.pnpmCmd, ['run', 'a11y:check'], {
    cwd: context.repoRoot
  });

  if (command.exitCode !== 0) {
    rationale.push('a11y:check reported failures — inspect console output.');
  }

  const report = await readJsonIfExists(reportPath);
  if (!report) {
    const message = 'Accessibility report missing after a11y:check run.';
    await writeJson(path.join(context.artifactsRoot, 'a11y.json'), {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: message
    });
    return {
      id: 'a11y',
      label: CHECK_RUNNERS.a11y.label,
      status: 'UNKNOWN',
      keyMetric: 'No axe report generated',
      metrics: {},
      rationale: [message],
      evidence
    };
  }

  const violations = collectA11yViolations(report);
  const violationCount = violations.length;
  let status = 'GREEN';
  if (violationCount === 0) {
    rationale.push('0 axe/contrast violations in curated sweep.');
  } else if (violationCount <= 2) {
    status = 'YELLOW';
    rationale.push(`${violationCount} accessibility violations detected.`);
  } else {
    status = 'RED';
    rationale.push(`${violationCount} accessibility violations detected.`);
  }

  const keyMetric = `Violations: ${violationCount}`;

  await writeJson(path.join(context.artifactsRoot, 'a11y.json'), {
    generatedAt: new Date().toISOString(),
    status,
    totals: report.totals ?? null,
    violations,
    notes: rationale
  });

  return {
    id: 'a11y',
    label: CHECK_RUNNERS.a11y.label,
    status,
    keyMetric,
    metrics: {
      totals: report.totals ?? null,
      violationCount
    },
    rationale,
    evidence
  };
}

function collectA11yViolations(report) {
  const violations = [];
  const sections = report.sections ?? {};

  for (const items of Object.values(sections)) {
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items) {
      if (item && item.pass === false) {
        violations.push({
          ruleId: item.ruleId ?? null,
          summary: item.summary ?? null,
          target: item.target ?? null,
          failureSummary: item.failureSummary ?? ''
        });
      }
    }
  }

  return violations;
}

/**
 * Visual regression check.
 */
async function runVisualRegressionCheck(context) {
  const mode = context.options.vrMode;
  const rationale = [];
  const evidence = [];
  const reportScript = path.join(context.repoRoot, 'scripts', 'vr', 'report.mjs');
  const artifactPath = path.join(context.artifactsRoot, 'vr.json');

  let actualMode = mode;
  let commandResult = null;

  if (mode === 'fallback') {
    commandResult = await runProcess(context.pnpmCmd, ['run', 'vrt:lightdark', '--', '--ci'], {
      cwd: context.repoRoot
    });
    actualMode = 'fallback';
  } else {
    commandResult = await runProcess(context.pnpmCmd, ['run', 'chromatic:dry-run'], {
      cwd: context.repoRoot
    });
    if (commandResult.exitCode !== 0) {
      rationale.push('chromatic:dry-run failed; falling back to local VRT harness.');
      const fallbackResult = await runProcess(
        context.pnpmCmd,
        ['run', 'vrt:lightdark', '--', '--ci'],
        { cwd: context.repoRoot }
      );
      commandResult = fallbackResult;
      actualMode = 'fallback';
    } else {
      actualMode = 'chromatic';
    }
  }

  let status = 'UNKNOWN';
  let keyMetric = 'No visual regression metrics captured';
  let metrics = {};
  let vrReport = null;

  if (actualMode === 'chromatic' && commandResult.exitCode === 0) {
    const summariseResult = await runProcess(context.nodeCmd, [reportScript], {
      cwd: context.repoRoot
    });
    if (summariseResult.exitCode !== 0) {
      rationale.push('Chromatic run completed but JSON summariser failed.');
    }

    vrReport = await readJsonIfExists(artifactPath);
    if (!vrReport) {
      rationale.push('Chromatic JSON summary missing at artifacts/state/vr.json.');
    } else {
      metrics = {
        totals: vrReport.totals ?? {},
        totalDiffs: vrReport.totalDiffs ?? 0,
        byBrand: vrReport.byBrand ?? {},
        suspectedGroupingOnly: vrReport.suspectedGroupingOnly ?? false
      };

      evidence.push({
        label: 'VR summary',
        path: path.relative(context.repoRoot, artifactPath)
      });

      if (vrReport.sources) {
        for (const [brandKey, relPath] of Object.entries(vrReport.sources)) {
          const labelBrand = brandKey.replace(/^brand-/, 'brand ').toUpperCase();
          evidence.push({
            label: `Chromatic ${labelBrand}`,
            path: relPath
          });
        }
      }

      const greenRate =
        typeof vrReport.totals?.greenRate === 'number' ? vrReport.totals.greenRate : null;

      if (greenRate != null) {
        if (greenRate >= 0.98) {
          status = 'GREEN';
        } else if (greenRate >= 0.95) {
          status = 'YELLOW';
        } else {
          status = 'RED';
        }
        const diffCount = vrReport.totalDiffs ?? metrics.totalDiffs ?? 0;
        keyMetric = `Chromatic green rate: ${(greenRate * 100).toFixed(2)}% (diffs: ${diffCount})`;
        if (vrReport.suspectedGroupingOnly && diffCount > 0) {
          rationale.push('Diffs appear to stem from grouping/taxonomy changes only.');
        }
      } else {
        rationale.push('Chromatic JSON summary did not include a green rate.');
      }
    }
  } else if (actualMode === 'fallback') {
    status = commandResult.exitCode === 0 ? 'YELLOW' : 'RED';
    keyMetric =
      commandResult.exitCode === 0
        ? 'Fallback storycap smoke run completed (no diff counts available)'
        : 'Fallback storycap harness failed';
    evidence.push({ label: 'Local VRT output', path: 'artifacts/vrt/lightdark/local' });
    if (status === 'YELLOW') {
      rationale.push('Chromatic unavailable; relied on fallback storycap harness.');
    } else {
      rationale.push('Fallback visual regression harness failed.');
    }
    vrReport = buildFallbackVrReport(actualMode, {
      sources: { fallback: 'artifacts/vrt/lightdark/local' }
    });
    metrics = {
      totals: vrReport.totals,
      totalDiffs: vrReport.totalDiffs,
      byBrand: vrReport.byBrand,
      suspectedGroupingOnly: vrReport.suspectedGroupingOnly
    };
  } else {
    rationale.push('Chromatic run failed to produce diagnostics.');
  }

  if (!vrReport) {
    vrReport = buildFallbackVrReport(actualMode);
    metrics = {
      totals: vrReport.totals,
      totalDiffs: vrReport.totalDiffs,
      byBrand: vrReport.byBrand,
      suspectedGroupingOnly: vrReport.suspectedGroupingOnly
    };
  }

  vrReport.status = status;
  vrReport.keyMetric = keyMetric;
  vrReport.notes = rationale;

  await writeJson(artifactPath, vrReport);

  return {
    id: 'vr',
    label: CHECK_RUNNERS.vr.label,
    status,
    keyMetric,
    metrics,
    rationale,
    evidence
  };
}

function buildFallbackVrReport(mode, overrides = {}) {
  const baseTotals = {
    totalSnapshots: 0,
    totalChanged: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalPassed: 0,
    totalDiffs: 0,
    greenRate: null
  };

  const totals = {
    ...baseTotals,
    ...(overrides.totals ?? {})
  };

  totals.totalDiffs =
    totals.totalDiffs ?? totals.totalChanged + totals.totalAdded + totals.totalRemoved;

  return {
    generatedAt: new Date().toISOString(),
    mode,
    totals,
    totalDiffs: totals.totalDiffs,
    suspectedGroupingOnly: overrides.suspectedGroupingOnly ?? false,
    byBrand: overrides.byBrand ?? {},
    sources: overrides.sources ?? {}
  };
}

/**
 * Token governance and CSS purity.
 */
async function runGuardrailsCheck(context) {
  const rationale = [];
  const artifactsPath = path.join(context.artifactsRoot, 'guardrails.json');
  const evidence = [{ label: 'Guardrail audit', path: 'artifacts/state/guardrails.json' }];
  const metadataViolations = [];
  const tenancyViolations = [];

  const eslint = new ESLint({
    useEslintrc: false,
    cwd: context.repoRoot,
    plugins: {
      oods: {
        rules: {
          'no-account-unsafe-metadata': metadataGuardrailRule,
          'no-unsafe-tenancy-override': tenancyGuardrailRule,
        },
      },
    },
    overrideConfig: {
      parser: require.resolve('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      plugins: ['oods'],
      ignorePatterns: [
        '**/node_modules/**',
        'dist/**',
        'storybook-static/**',
        'coverage/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'stories/**',
        'scripts/tenancy/**',
      ],
      rules: {
        'oods/no-account-unsafe-metadata': 'error',
        'oods/no-unsafe-tenancy-override': 'error',
      },
    },
  });

  let lintResults;
  try {
    lintResults = await eslint.lintFiles(['src/**/*.ts', 'src/**/*.tsx']);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown lint failure');
    rationale.push(`Guardrail lint failed: ${message}`);
    await writeJson(artifactsPath, {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      error: message,
    });
    return {
      id: 'guardrails',
      label: CHECK_RUNNERS.guardrails.label,
      status: 'UNKNOWN',
      keyMetric: 'Guardrail lint failed',
      metrics: {},
      rationale,
      evidence,
    };
  }

  for (const result of lintResults) {
    if (!result.messages || result.messages.length === 0) {
      continue;
    }
    const relativePath = path.relative(context.repoRoot, result.filePath).split(path.sep).join('/');
    for (const message of result.messages) {
      if (message.ruleId === 'oods/no-account-unsafe-metadata') {
        metadataViolations.push({
          file: relativePath,
          line: message.line ?? null,
          column: message.column ?? null,
          message: message.message,
        });
      }
      if (message.ruleId === 'oods/no-unsafe-tenancy-override') {
        tenancyViolations.push({
          file: relativePath,
          line: message.line ?? null,
          column: message.column ?? null,
          message: message.message,
        });
      }
    }
  }

  const metadataCount = metadataViolations.length;
  const tenancyCount = tenancyViolations.length;
  const generatedAt = new Date().toISOString();

  const status = metadataCount === 0 && tenancyCount === 0 ? 'GREEN' : 'RED';
  const keyMetric = `Metadata violations: ${metadataCount} | Tenancy overrides: ${tenancyCount}`;

  if (status === 'GREEN') {
    rationale.push('Metadata policy and tenancy override guardrails clean across source files.');
  } else {
    if (metadataCount > 0) {
      const first = metadataViolations[0];
      rationale.push(
        `Metadata guardrail violations detected (first: ${first.file}:${first.line ?? 0} ${first.message}).`
      );
    }
    if (tenancyCount > 0) {
      const first = tenancyViolations[0];
      rationale.push(
        `Tenancy override guardrail violations detected (first: ${first.file}:${first.line ?? 0} ${first.message}).`
      );
    }
  }

  await writeJson(artifactsPath, {
    generatedAt,
    status,
    totals: {
      metadataViolations: metadataCount,
      tenancyViolations: tenancyCount,
    },
    metadataViolations,
    tenancyViolations,
  });

  await updateGuardrailDiagnostics(context.repoRoot, {
    generatedAt,
    status,
    metadataViolations: metadataViolations.slice(0, 5),
    metadataTotal: metadataCount,
    tenancyViolations: tenancyViolations.slice(0, 5),
    tenancyTotal: tenancyCount,
  });

  return {
    id: 'guardrails',
    label: CHECK_RUNNERS.guardrails.label,
    status,
    keyMetric,
    metrics: {
      metadataViolations: metadataCount,
      tenancyViolations: tenancyCount,
    },
    rationale,
    evidence,
  };
}

async function runPerformanceCheck(context) {
  const artifactsPath = path.join(context.artifactsRoot, 'performance.json');
  const resultsPath = path.join(context.repoRoot, 'diagnostics', 'perf-results.json');
  const evidence = [{ label: 'Performance harness results', path: 'diagnostics/perf-results.json' }];

  const results = await readJsonIfExists(resultsPath);
  const snapshots = Array.isArray(results?.performanceHarness?.snapshots)
    ? results.performanceHarness.snapshots.filter(
        (snapshot) => typeof snapshot?.value === 'number' && Number.isFinite(snapshot.value)
      )
    : [];

  if (snapshots.length === 0) {
    const note = 'Performance harness results missing or empty at diagnostics/perf-results.json.';
    await writeJson(artifactsPath, {
      generatedAt: new Date().toISOString(),
      status: 'UNKNOWN',
      reason: note
    });
    return {
      id: 'performance',
      label: CHECK_RUNNERS.performance.label,
      status: 'UNKNOWN',
      keyMetric: 'No performance snapshots available',
      metrics: {},
      rationale: [note],
      evidence
    };
  }

  const stats = collectPerformanceStats(snapshots);
  const evaluation = evaluatePerformanceBudgets(stats);
  const status = evaluation.status;
  const generatedAt = new Date().toISOString();

  const budgetsPayload = buildPerformanceBudgetPayload(stats);
  await writeJson(artifactsPath, {
    generatedAt,
    status,
    budgets: budgetsPayload,
    snapshots: {
      total: snapshots.length,
      source: 'diagnostics/perf-results.json'
    },
    source: {
      runTimestamp: results?.performanceHarness?.runTimestamp ?? null,
      commitSha: results?.performanceHarness?.commitSha ?? null,
      path: 'diagnostics/perf-results.json'
    },
    notes: evaluation.notes
  });

  const keyMetric = [
    `compositor ${formatNumber(stats.compositorActualDurationMs?.p95)}ms ≤ ${PERFORMANCE_BUDGETS.compositorActualDurationMs}ms`,
    `list ${formatNumber(stats.listActualDurationMs?.p95)}ms ≤ ${PERFORMANCE_BUDGETS.listActualDurationMs}ms`,
    `token ${formatNumber(stats.tokenTransformUserTimingMs?.p95)}ms ≤ ${PERFORMANCE_BUDGETS.tokenTransformUserTimingMs}ms`
  ].join(' | ');

  return {
    id: 'performance',
    label: CHECK_RUNNERS.performance.label,
    status,
    keyMetric,
    metrics: {
      budgets: budgetsPayload,
      snapshots: {
        total: snapshots.length
      }
    },
    rationale: evaluation.notes,
    evidence
  };
}

async function runTokenGovernanceCheck(context) {
  const rationale = [];
  const evidence = [];

  const governanceDir = path.join(context.artifactsRoot, 'governance');
  const distTokenPath = path.join(context.repoRoot, 'packages', 'tokens', 'dist', 'tailwind', 'tokens.json');
  try {
    await fs.unlink(distTokenPath);
    console.warn(`Removed built token artifact at ${path.relative(context.repoRoot, distTokenPath)} to keep governance diff clean.`);
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  await fs.mkdir(governanceDir, { recursive: true });
  const brandReports = {};

  for (const brand of ['A', 'B']) {
    const outputPath = path.join(governanceDir, `brand-${brand}.json`);
    const args = ['run', 'tokens:governance', '--', 'diff', '--brand', brand, '--json', outputPath];
    const result = await runProcess(context.pnpmCmd, args, { cwd: context.repoRoot });
    const report = await readJsonIfExists(outputPath);
    if (report) {
      brandReports[brand] = report;
      const rel = path.relative(context.repoRoot, outputPath);
      evidence.push({ label: `Governance diff (brand ${brand})`, path: rel });
    }
    if (result.exitCode !== 0) {
      rationale.push(`tokens:governance diff for brand ${brand} failed — see console output.`);
    }
  }

  const purityResult = await runProcess(context.nodeCmd, [path.join(context.repoRoot, 'scripts', 'purity', 'audit.js')], {
    cwd: context.repoRoot,
    captureOutput: true
  });

  const purityViolations = parsePurityViolations(purityResult);
  if (purityViolations.length > 0) {
    rationale.push(`${purityViolations.length} CSS purity violations detected.`);
  }

  let highRisk = 0;
  let leaks = 0;
  let orphans = 0;

  for (const report of Object.values(brandReports)) {
    highRisk += report?.summary?.highRisk ?? 0;
    leaks += Array.isArray(report?.leaks) ? report.leaks.length : 0;
    orphans += Array.isArray(report?.orphans) ? report.orphans.length : 0;
  }

  const requiresBreaking = Object.values(brandReports).some(
    (report) => report?.requiresBreakingLabel && !report?.hasBreakingLabel
  );
  if (requiresBreaking) {
    rationale.push('Protected token changes require token-change:breaking label.');
  }

  let status = 'GREEN';
  if (purityViolations.length > 0 || highRisk > 0 || requiresBreaking) {
    status = 'RED';
  } else if (leaks > 0 || orphans > 0) {
    status = 'YELLOW';
  }

  if (status === 'GREEN') {
    rationale.push('No high-risk token changes, leaks, or CSS literals detected.');
  }

  const keyMetric = `High-risk token deltas: ${highRisk} | CSS literals: ${purityViolations.length}`;

  const generatedAt = new Date().toISOString();

  await writeJson(path.join(context.artifactsRoot, 'tokens.json'), {
    generatedAt,
    status,
    brands: brandReports,
    purityViolations,
    summary: {
      highRisk,
      leaks,
      orphans
    }
  });

  const brandSummaries = Object.fromEntries(
    Object.entries(brandReports).map(([brand, report]) => [
      brand,
      {
        highRisk: report?.summary?.highRisk ?? 0,
        mediumRisk: report?.summary?.mediumRisk ?? 0,
        lowRisk: report?.summary?.lowRisk ?? 0,
        requiresBreakingLabel: !!report?.requiresBreakingLabel,
        hasBreakingLabel: !!report?.hasBreakingLabel,
        labels: Array.isArray(report?.labels) ? report.labels : [],
      }
    ])
  );

  const artifactMap = Object.fromEntries(
    Object.keys(brandReports).map((brand) => [
      brand,
      path.posix.join('artifacts/state/governance', `brand-${brand}.json`)
    ])
  );

  await updateTokenGovernanceDiagnostics(context.repoRoot, {
    generatedAt,
    status,
    highRisk,
    leaks,
    orphans,
    purityViolationsCount: purityViolations.length,
    purityViolationsSample: purityViolations.slice(0, 5),
    requiresBreaking,
    brands: brandSummaries,
    artifacts: artifactMap
  });

  return {
    id: 'tokens',
    label: CHECK_RUNNERS.tokens.label,
    status,
    keyMetric,
    metrics: {
      highRisk,
      leaks,
      orphans,
      purityViolations
    },
    rationale,
    evidence
  };
}

function parsePurityViolations(result) {
  if (!result || typeof result.stdout !== 'string' && typeof result.stderr !== 'string') {
    return [];
  }
  const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('[forbidden var]') || line.includes('[color literal]'));
  return lines;
}

async function updateGuardrailDiagnostics(repoRoot, record) {
  const diagnosticsPath = path.join(repoRoot, 'diagnostics.json');
  const diagnostics = (await readJsonIfExists(diagnosticsPath)) ?? {};

  diagnostics.helpers = diagnostics.helpers ?? {};
  const helper = diagnostics.helpers.guardrails ?? {};
  const history = Array.isArray(helper.history) ? helper.history.slice(0, 9) : [];

  const entry = {
    generatedAt: record.generatedAt,
    status: record.status,
    metadataViolations: record.metadataViolations,
    counts: {
      metadata: record.metadataTotal,
      tenancy: record.tenancyTotal,
    },
    tenancyViolations: record.tenancyViolations,
  };

  history.unshift(entry);

  const totals = {
    runs: (helper.totals?.runs ?? 0) + 1,
    metadataViolations: (helper.totals?.metadataViolations ?? 0) + record.metadataTotal,
    tenancyViolations: (helper.totals?.tenancyViolations ?? 0) + record.tenancyTotal,
  };

  diagnostics.helpers.guardrails = {
    totals,
    lastRun: entry,
    history,
  };

  await fs.writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
}

async function updateTokenGovernanceDiagnostics(repoRoot, record) {
  const diagnosticsPath = path.join(repoRoot, 'diagnostics.json');
  const diagnostics = (await readJsonIfExists(diagnosticsPath)) ?? {};

  const tokensSection = diagnostics.tokens ?? {};
  const governance = tokensSection.governance ?? {};
  const history = Array.isArray(governance.history) ? governance.history.slice(0, 9) : [];

  const entry = {
    generatedAt: record.generatedAt,
    status: record.status,
    highRisk: record.highRisk,
    leaks: record.leaks,
    orphans: record.orphans,
    purityViolations: {
      count: record.purityViolationsCount,
      samples: record.purityViolationsSample,
    },
    requiresBreakingLabel: record.requiresBreaking,
    brands: record.brands,
    artifacts: record.artifacts,
  };

  history.unshift(entry);

  const totals = {
    runs: (governance.totals?.runs ?? 0) + 1,
    highRisk: (governance.totals?.highRisk ?? 0) + record.highRisk,
    purityViolations: (governance.totals?.purityViolations ?? 0) + record.purityViolationsCount,
  };

  tokensSection.governance = {
    totals,
    lastRun: entry,
    history,
  };

  diagnostics.tokens = {
    ...tokensSection,
  };

  await fs.writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
}

/**
 * Coverage & reliability.
 */
async function runCoverageCheck(context) {
  const rationale = [];
  const evidence = [
    { label: 'coverage summary', path: 'coverage/coverage-summary.json' }
  ];

  const command = await runProcess(
    context.pnpmCmd,
    ['exec', 'vitest', 'run', '--coverage', '--reporter=json'],
    { cwd: context.repoRoot, captureOutput: true }
  );

  const vitestJson = extractVitestJson(command.stdout ?? '');
  const coverageSummary = await readJsonIfExists(path.join(context.repoRoot, 'coverage', 'coverage-summary.json'));

  let status = 'UNKNOWN';
  let keyMetric = 'No coverage data';
  let linePct = null;
  let branchPct = null;

  if (coverageSummary?.total?.lines?.pct != null) {
    linePct = coverageSummary.total.lines.pct;
    branchPct = coverageSummary.total.branches?.pct ?? null;
    if (linePct >= 80) {
      status = 'GREEN';
    } else if (linePct >= 70) {
      status = 'YELLOW';
    } else {
      status = 'RED';
    }
    keyMetric = `Coverage — lines: ${linePct.toFixed(2)}%`;
  }

  if (!vitestJson) {
    rationale.push('Unable to parse vitest JSON reporter output.');
  } else {
    const passRate =
      vitestJson.numTotalTests > 0
        ? vitestJson.numPassedTests / vitestJson.numTotalTests
        : null;
    const durations = collectTestDurations(vitestJson);
    const p95 = computePercentile(durations, 0.95);
    if (passRate != null) {
      rationale.push(`Pass rate: ${(passRate * 100).toFixed(2)}%.`);
    }
    if (p95 != null) {
      rationale.push(`Test duration p95: ${p95.toFixed(2)} ms.`);
    }
  }

  await writeJson(path.join(context.artifactsRoot, 'tests.json'), {
    generatedAt: new Date().toISOString(),
    status,
    coverage: coverageSummary?.total ?? null,
    vitest: vitestJson ?? null,
    notes: rationale
  });

  return {
    id: 'coverage',
    label: CHECK_RUNNERS.coverage.label,
    status,
    keyMetric,
    metrics: {
      coverage: coverageSummary?.total ?? null,
      vitest: vitestJson ?? null
    },
    rationale,
    evidence
  };
}

function extractVitestJson(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return null;
  }
  const lines = stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function collectTestDurations(vitestJson) {
  const durations = [];
  if (!vitestJson || !Array.isArray(vitestJson.testResults)) {
    return durations;
  }
  for (const suite of vitestJson.testResults) {
    if (!Array.isArray(suite.assertionResults)) {
      continue;
    }
    for (const assertion of suite.assertionResults) {
      if (typeof assertion.duration === 'number' && !Number.isNaN(assertion.duration)) {
        durations.push(assertion.duration);
      }
    }
  }
  return durations;
}

function computePercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(percentile * sorted.length));
  return sorted[index];
}

function collectPerformanceStats(snapshots) {
  const groups = {
    compositorActualDurationMs: {
      scenarioPrefix: 'Compositor.',
      metricName: 'React.actualDuration'
    },
    listActualDurationMs: {
      scenarioPrefix: 'List.',
      metricName: 'React.actualDuration'
    },
    tokenTransformUserTimingMs: {
      scenarioPrefix: 'TokenTransform.',
      metricName: 'UserTiming.duration'
    }
  };

  const stats = {};

  for (const [key, config] of Object.entries(groups)) {
    const values = snapshots
      .filter(
        (snapshot) =>
          typeof snapshot?.scenarioId === 'string' &&
          snapshot.scenarioId.startsWith(config.scenarioPrefix) &&
          snapshot.metricName === config.metricName
      )
      .map((snapshot) => Number(snapshot.value))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      stats[key] = null;
      continue;
    }

    const p95 = computePercentile(values, 0.95);
    const max = values.reduce((acc, value) => (value > acc ? value : acc), values[0]);

    stats[key] = {
      samples: values.length,
      p95: roundTo(p95),
      max: roundTo(max)
    };
  }

  return stats;
}

function buildPerformanceBudgetPayload(stats) {
  const mapping = {
    compositorActualDurationMs: {
      scenario: 'Compositor.*',
      metric: 'React.actualDuration'
    },
    listActualDurationMs: {
      scenario: 'List.*',
      metric: 'React.actualDuration'
    },
    tokenTransformUserTimingMs: {
      scenario: 'TokenTransform.*',
      metric: 'UserTiming.duration'
    }
  };

  const payload = {};

  for (const [key, meta] of Object.entries(mapping)) {
    const stat = stats[key];
    payload[key] = {
      budget: PERFORMANCE_BUDGETS[key],
      p95: typeof stat?.p95 === 'number' ? stat.p95 : null,
      max: typeof stat?.max === 'number' ? stat.max : null,
      samples: stat?.samples ?? 0,
      scenario: meta.scenario,
      metric: meta.metric
    };
  }

  return payload;
}

function evaluatePerformanceBudgets(stats) {
  let status = 'GREEN';
  const notes = [];

  for (const [key, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
    const stat = stats[key];
    const label = performanceLabel(key);
    if (!stat || typeof stat.p95 !== 'number') {
      if (status !== 'RED') {
        status = 'YELLOW';
      }
      notes.push(`${label} missing recent performance snapshots.`);
      continue;
    }
    if (stat.p95 > budget) {
      status = 'RED';
      notes.push(`${label} p95 ${formatNumber(stat.p95)}ms exceeds budget ${budget}ms.`);
    } else {
      notes.push(`${label} p95 ${formatNumber(stat.p95)}ms within ${budget}ms budget.`);
    }
  }

  return { status, notes };
}

function performanceLabel(key) {
  switch (key) {
    case 'compositorActualDurationMs':
      return 'Compositor updates';
    case 'listActualDurationMs':
      return 'List rendering';
    case 'tokenTransformUserTimingMs':
      return 'Token transform';
    default:
      return key;
  }
}

function roundTo(value, decimals = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value, decimals = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }
  const rounded = roundTo(value, decimals);
  if (rounded === null) {
    return 'n/a';
  }
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Packaging and provenance readiness.
 */
async function runPackagingCheck(context) {
  const rationale = [];
  const evidence = [
    { label: 'dist provenance', path: 'dist/pkg/provenance.json' },
    { label: 'diagnostics.json', path: 'diagnostics.json' }
  ];

  const result = await runProcess(context.pnpmCmd, ['run', 'pkg:compat'], {
    cwd: context.repoRoot
  });

  const diagnostics = await readJsonIfExists(path.join(context.repoRoot, 'diagnostics.json'));
  const helper = diagnostics?.helpers?.pkgCompat;
  const lastRun = helper?.lastRun ?? null;

  const provenance = await readJsonIfExists(path.join(context.repoRoot, 'dist', 'pkg', 'provenance.json'));

  let status = 'UNKNOWN';
  if (result.exitCode === 0 && lastRun?.status === 'passed') {
    status = 'GREEN';
    rationale.push('pkg:compat build + sample app smoke test passed.');
  } else if (result.exitCode === 0) {
    status = 'YELLOW';
    rationale.push('pkg:compat completed but diagnostics did not report pass status.');
  } else {
    status = 'RED';
    rationale.push('pkg:compat failed — inspect console output.');
  }

  const keyMetric =
    lastRun?.runAt != null ? `Last compat run: ${lastRun.status} @ ${lastRun.runAt}` : 'No compat history';

  await writeJson(path.join(context.artifactsRoot, 'packaging.json'), {
    generatedAt: new Date().toISOString(),
    status,
    pkgCompat: helper ?? null,
    provenance: provenance ?? null,
    notes: rationale
  });

  return {
    id: 'packaging',
    label: CHECK_RUNNERS.packaging.label,
    status,
    keyMetric,
    metrics: {
      pkgCompat: helper ?? null,
      provenance: provenance ?? null
    },
    rationale,
    evidence
  };
}

/**
 * Ensure storybook-static exists. Returns { error?: string }.
 */
async function ensureStorybookBuild(context, reason) {
  if (context.memo.storybookReady) {
    return {};
  }
  const storyIndexPath = path.join(context.repoRoot, 'storybook-static', 'index.json');
  const exists = await fileExists(storyIndexPath);
  if (exists) {
    context.memo.storybookReady = true;
    return {};
  }

  const result = await runProcess(context.pnpmCmd, ['run', 'build-storybook'], {
    cwd: context.repoRoot
  });
  if (result.exitCode === 0) {
    context.memo.storybookReady = true;
    return {};
  }

  return {
    error: `build-storybook failed during ${reason}`
  };
}

/**
 * Child process helper.
 */
function runProcess(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env,
    captureOutput = false
  } = options;

  const startedAt = performance.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit'
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput && child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }
    if (captureOutput && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      const durationMs = Math.round(performance.now() - startedAt);
      resolve({
        exitCode: code ?? 0,
        stdout: captureOutput ? stdout : null,
        stderr: captureOutput ? stderr : null,
        durationMs
      });
    });
  });
}

/**
 * Utility helpers.
 */
async function writeJson(targetPath, data) {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(targetPath, payload, 'utf8');
}

async function writeMarkdown(targetPath, contents) {
  await fs.writeFile(targetPath, `${contents.trim()}\n`, 'utf8');
}

async function parseTaxonomyDoc(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const allowed = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- `'))
      .map((line) => {
        const match = line.match(/`([^`]+)`/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    return { allowed };
  } catch {
    return null;
  }
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function tryReadDir(dir) {
  try {
    const entries = await fs.readdir(dir);
    return entries;
  } catch {
    return [];
  }
}

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveGitCommit(root) {
  try {
    const result = await runProcess('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      captureOutput: true
    });
    if (result.exitCode === 0 && typeof result.stdout === 'string') {
      return result.stdout.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

function countStatuses(results) {
  const counts = {
    GREEN: 0,
    YELLOW: 0,
    RED: 0,
    UNKNOWN: 0
  };
  for (const result of results) {
    if (counts.hasOwnProperty(result.status)) {
      counts[result.status] += 1;
    }
  }
  return counts;
}

function deriveOverallStatus(counts) {
  if (counts.RED > 0) {
    return 'RED';
  }
  if (counts.YELLOW > 0) {
    return 'YELLOW';
  }
  if (counts.GREEN > 0 && counts.UNKNOWN === 0) {
    return 'GREEN';
  }
  if (counts.GREEN > 0 && counts.UNKNOWN > 0) {
    return 'YELLOW';
  }
  return counts.UNKNOWN > 0 ? 'UNKNOWN' : 'GREEN';
}

function deriveNextSteps(results) {
  const steps = [];

  for (const result of results) {
    if (result.status === 'GREEN') {
      continue;
    }

    const priority = result.status === 'RED' ? 'P0' : 'P1';
    const summary =
      result.rationale && result.rationale.length > 0
        ? result.rationale[0]
        : `Investigate ${result.label}`;
    const evidencePath = result.outputs?.json ?? null;

    steps.push({
      priority,
      categoryId: result.id,
      summary,
      evidence: evidencePath
    });
  }

  return steps.sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });
}

function buildMarkdownSummary(assessment) {
  const lines = [];
  lines.push(`# Current State Assessment — Build.Implementation.v1`);
  lines.push('');
  lines.push('| Category | Status | Key Metric | Evidence |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of assessment.checks) {
    const evidenceLink = check.outputs?.json
      ? `[JSON](./${path.basename(check.outputs.json)})`
      : '—';
    lines.push(`| ${check.label} | ${check.status} | ${escapePipes(check.keyMetric ?? '—')} | ${evidenceLink} |`);
  }

  lines.push('');
  lines.push('## Findings by Area');
  for (const check of assessment.checks) {
    lines.push(`### ${check.label}`);
    lines.push(`- Status: ${check.status}`);
    lines.push(`- Key metric: ${check.keyMetric ?? 'n/a'}`);
    if (check.rationale && check.rationale.length > 0) {
      lines.push(`- Notes: ${check.rationale.join(' ')}`);
    }
    if (check.evidence && check.evidence.length > 0) {
      const refs = check.evidence
        .map((item) => `[${item.label}](${normalizeEvidencePath(item.path)})`)
        .join(', ');
      lines.push(`- Evidence: ${refs}`);
    }
    lines.push('');
  }

  if (assessment.nextSteps.length > 0) {
    lines.push('## Next Steps');
    for (const step of assessment.nextSteps) {
      const link = step.evidence ? ` (${normalizeEvidencePath(step.evidence)})` : '';
      lines.push(`- ${step.priority} — ${step.summary}${link}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function escapePipes(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function normalizeEvidencePath(relPath) {
  if (!relPath) {
    return '#';
  }
  if (relPath.startsWith('http://') || relPath.startsWith('https://')) {
    return relPath;
  }
  const normalized = relPath.split(path.sep).join('/');
  if (normalized.startsWith('artifacts/state/')) {
    return `../${normalized.slice('artifacts/'.length)}`;
  }
  return `../${normalized}`;
}

function printConsoleSummary(assessment) {
  console.log('\nState assessment results');
  console.log('------------------------');
  console.log(`Overall status: ${assessment.summary.overallStatus}`);
  for (const check of assessment.checks) {
    console.log(`- ${check.label}: ${check.status} (${check.keyMetric ?? 'n/a'})`);
  }
  if (assessment.nextSteps.length > 0) {
    console.log('\nNext steps:');
    for (const step of assessment.nextSteps) {
      console.log(`- ${step.priority} ${step.categoryId}: ${step.summary}`);
    }
  }
}

await main().catch((error) => {
  console.error('State assessment failed.');
  console.error(error);
  process.exitCode = 1;
});
