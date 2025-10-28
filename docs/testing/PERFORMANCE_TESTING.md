# Performance Testing

> **Sprint 18 Deliverable**: Playwright-based performance harness for measuring React component performance, token transformations, and data aggregation.

## Overview

The OODS Foundry performance harness is built on Playwright and provides high-precision measurement of:

- **Compositor performance** - React component update times
- **List rendering** - Large dataset rendering and filtering
- **Token transforms** - Brand/theme switching operations
- **Usage aggregation** - Billing data processing

All metrics conform to the [`performance-harness.schema.json`](../../diagnostics/performance-harness.schema.json) for consistent diagnostics integration.

---

## Quick Start

### Run All Scenarios

```bash
pnpm perf:harness
```

### Run Specific Scenario

```bash
# Measure compositor performance only
pnpm perf:harness --scenario compositor

# Measure list rendering only
pnpm perf:harness --scenario list

# Measure token transformations
pnpm perf:harness --scenario token-transform

# Measure usage aggregation
pnpm perf:harness --scenario usage-aggregation
```

### Specify Browser

```bash
pnpm perf:harness --scenario list --browser firefox
```

### Custom Output Path

```bash
pnpm perf:harness --output ./my-results/perf.json
```

### Compare Against Stored Baseline

```bash
pnpm perf:harness --baseline diagnostics/perf-baseline.json
```

> If `--baseline` is omitted, the CLI looks for `diagnostics/perf-baseline.json` by default.

---

## Architecture

### Instrumentation Stack

The harness uses a **hybrid instrumentation approach**:

1. **React Profiler API** - Measures component render/commit times
2. **User Timing API** - Measures arbitrary JavaScript function execution
3. **Playwright** - Orchestrates tests in real browser environments

This combination provides:
- High-fidelity, real-browser measurements
- Framework-aware React metrics
- Stable CI/CD execution
- Cross-browser capability (Chromium, Firefox, WebKit)

### Directory Structure

```
testkits/perf-harness/
├── playwright.config.ts          # Playwright configuration
├── cli.ts                         # Developer CLI wrapper
├── instrumentation/
│   ├── profiler.tsx              # React Profiler wrapper
│   ├── userTiming.ts             # User Timing API utilities
│   └── index.ts                  # Exports
├── utils/
│   └── schema.ts                 # Performance snapshot types
└── tests/
    ├── compositor.perf.spec.ts   # Compositor tests
    ├── list.perf.spec.ts         # List rendering tests
    ├── token-transform.perf.spec.ts
    └── usage-aggregation.perf.spec.ts
```

---

## Instrumentation APIs

### React Profiler

Wrap components with `<PerfProfiler>` to capture render metrics:

```tsx
import { PerfProfiler } from '~/src/perf/instrumentation';

function MyComponent() {
  return (
    <PerfProfiler id="MyComponent">
      <ExpensiveChild />
    </PerfProfiler>
  );
}
```

Metrics are stored in `window.__PERF_PROFILER_METRICS__` and accessible from Playwright:

```ts
const metrics = await page.evaluate(() => {
  return window.__PERF_PROFILER_METRICS__;
});
```

### User Timing API

Measure JavaScript function execution:

```ts
import { measureSync, measureAsync } from '~/src/perf/instrumentation';

// Synchronous function
const { result, duration } = measureSync('myFunction', () => {
  return expensiveCalculation();
});

// Async function
const { result, duration } = await measureAsync('asyncOperation', async () => {
  return await fetchData();
});
```

Or use manual marks:

```ts
import { markStart, markEnd } from '~/src/perf/instrumentation';

markStart('operation');
// ... do work
const duration = markEnd('operation');
```

---

## Writing Performance Tests

### Example: Compositor Performance

```ts
import { test, expect } from '../utils/perfTest';
import { createSnapshot } from '../utils/schema';

test('captures button state update', async ({ page, recordSnapshot }) => {
  await page.goto('/iframe.html?id=performance-compositor-harness--button-state-update');

  await page.evaluate(() => {
    window.__PERF_PROFILER_METRICS__ = [];
  });

  const button = page.getByTestId('perf-button-toggle');
  await button.click();
  await page.waitForTimeout(120);

  const profilerMetric = await page.evaluate(() => {
    const metrics = window.__PERF_PROFILER_METRICS__ ?? [];
    return metrics.filter((entry) => entry.id === 'Compositor.Button.StateUpdate').pop();
  });

  expect(profilerMetric, 'Expected profiler data for the button state update').not.toBeNull();
  if (!profilerMetric) return;

  await recordSnapshot(
    createSnapshot('Compositor.Button.StateUpdate', 'React.actualDuration', profilerMetric.actualDuration, {
      unit: 'ms',
    }),
  );

  expect(profilerMetric.actualDuration).toBeLessThan(50);
});
```

---

## Performance Schema

All metrics conform to `diagnostics/performance-harness.schema.json`:

```json
{
  "performanceHarness": {
    "version": "1.0.0",
    "runTimestamp": "2025-10-28T00:00:00Z",
    "commitSha": "abc1234",
    "environment": "local",
    "snapshots": [
      {
        "snapshotId": "uuid-here",
        "scenarioId": "List.With1000Items",
        "metricName": "React.actualDuration",
        "value": 123.45,
        "unit": "ms",
        "browser": "chromium",
        "parameters": {
          "rowCount": 1000
        }
      }
    ]
  }
}
```

### Snapshot Fields

| Field | Type | Description |
|-------|------|-------------|
| `snapshotId` | `uuid` | Unique measurement identifier |
| `scenarioId` | `string` | Test scenario (e.g., `List.Table.100Rows`) |
| `metricName` | `string` | Metric identifier (e.g., `React.actualDuration`) |
| `value` | `number` | Measured value |
| `unit` | `enum` | Unit: `ms`, `seconds`, `bytes`, `score` |
| `browser` | `enum` | Browser: `chromium`, `firefox`, `webkit` |
| `parameters` | `object` | Run configuration (tenancy, feature flags, etc.) |
| `isRegression` | `boolean` | Regression flag (CI only) |
| `baselineValue` | `number` | Baseline for comparison |

---

## CI Integration

### Nightly Performance Pipeline

The performance harness runs nightly at **2 AM UTC** via `.github/workflows/perf-harness.yml`:

**Pipeline steps:**

1. **Run harness** - Execute full test suite, output to `diagnostics/perf-results-{sha}.json`
2. **Download history** - Retrieve last 10 nightly artifacts
3. **Calculate baseline** - Compute median + stdDev for each metric
4. **Check regressions** - Apply 3-sigma + absolute + relative thresholds
5. **Send alerts** - Post to Slack if regressions detected
6. **Update diagnostics** - Merge latest run into `diagnostics.json`

**Workflow triggers:**

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM UTC
  workflow_dispatch:      # Manual trigger with optional scenario filter
```

**Manual trigger:**

```bash
# Via GitHub Actions UI:
# Actions → Performance Harness Nightly → Run workflow
# Optional: specify scenario (compositor, list, token-transform, usage-aggregation)
```

### Regression Detection

A regression is flagged when **all three** conditions are met:

1. **Statistical significance**: `newValue > (baselineMedian + 3 * stdDev)`
2. **Absolute significance**: `(newValue - baselineMedian) > 50ms`
3. **Relative significance**: `((newValue - baselineMedian) / baselineMedian) > 15%`

This multi-faceted approach minimizes false positives while catching meaningful slowdowns.

**Example output:**

```
⚠️  Performance Regressions Detected:

  ❌ List.Table.100Rows → React.actualDuration (chromium)
     Baseline: 14.20 ms (±2.10)
     Current:  22.40 ms
     Δ 8.20 ms (+57.7%)
     Checks: statistical=true, absolute=true, relative=true
```

### Slack Notifications

When regressions are detected, the workflow posts a summary to the engineering Slack channel:

- Top 5 regressions (scenario, metric, delta)
- Commit SHA and CI run links
- Improvements (if any)

**Setup:**

1. Create Slack incoming webhook
2. Add `SLACK_PERF_WEBHOOK_URL` to repository secrets
3. Workflow automatically posts on regression

### Local CI Simulation

Test the full CI pipeline locally:

```bash
# Run harness
pnpm perf:harness --output diagnostics/perf-results-local.json

# Calculate baseline (requires historical runs)
pnpm perf:baseline --history 10 --input diagnostics/perf-history --output diagnostics/perf-baseline.json

# Check for regressions
pnpm perf:check --current diagnostics/perf-results-local.json --baseline diagnostics/perf-baseline.json

# Send Slack notification (optional)
SLACK_WEBHOOK_URL=https://... pnpm perf:notify --report diagnostics/perf-regressions.json
```

### Artifacts

All runs produce artifacts with 90-day retention:

| Artifact | Contents | Use Case |
|----------|----------|----------|
| `perf-results-{sha}` | Raw performance snapshots | Baseline calculation, historical analysis |
| `perf-regression-report-{sha}` | Regression analysis + baseline | Debugging slowdowns, trend analysis |

Download artifacts via GitHub Actions UI or CLI:

```bash
gh run download <run-id> -n perf-results-abc1234
```

---

## Developer Workflow

### Local Pre-Commit Validation

Before creating a PR:

```bash
# Measure impact of your changes
pnpm perf:harness --scenario list

# Compare against baseline (fetch from CI artifacts)
# (Future enhancement: auto-fetch baseline)
```

### Interpreting Results

The CLI outputs a summary table and compares results against the latest baseline:

```
🚀 Starting Performance Harness...

Configuration:
  Scenario: list
  Browser:  chromium
  Output:   diagnostics/perf-results.json
  Baseline: diagnostics/perf-baseline.json

Running 3 tests using 1 worker

✅ Performance tests completed successfully
📊 Captured 5 snapshots (saved to diagnostics/perf-results.json)
    • List.Table.100Rows → React.actualDuration: 14.60 ms
    • List.Table.100Rows → React.commitTime: 464.20 ms
    • List.Table.FilterApply → UserTiming.duration: 0.10 ms
    • List.Tabs.NavigationSwitch → React.actualDuration: 0.30 ms
    • List.Tabs.NavigationSwitch → UserTiming.duration: 0.10 ms

📉 Baseline comparison
    Source: diagnostics/perf-baseline.json (computed 2025-10-27T02:00:00Z, last 10 runs)
    • List.Table.100Rows → React.actualDuration (chromium)
      14.60 ms vs baseline 14.20 ms (Δ +0.40 ms, +2.8%)
    • List.Tabs.NavigationSwitch → React.actualDuration (chromium)
      0.30 ms vs baseline 0.40 ms (Δ -0.10 ms, -25.0%)
```

### Trace Files

On failure, Playwright generates trace files for debugging:

```bash
pnpm playwright show-report testkits/perf-harness/perf-results/html
```

---

## Troubleshooting

### High Variability in Local Runs

Local performance can vary due to:
- Background applications
- CPU throttling
- Browser extensions

**Solution**: Run tests multiple times and look for trends, not absolute values.

### Tests Timing Out

If tests exceed 60s timeout:

1. Check Storybook is running (`http://127.0.0.1:6006`)
2. Increase timeout in `playwright.config.ts`:
   ```ts
   timeout: 120_000, // 2 minutes
   ```

### Metrics Not Captured

Ensure instrumentation is active:

```ts
// Check profiler metrics exist
const metrics = await page.evaluate(() => {
  return window.__PERF_PROFILER_METRICS__;
});
console.log('Captured metrics:', metrics);
```

---

## Future Enhancements

### Sprint 19+ Backlog

- **Lighthouse integration** - Capture Web Vitals (LCP, TTI)
- **Performance budgets** - Hard limits enforced in CI (currently uses regression detection only)
- **Parameterized scenarios** - Test across tenancy modes, feature flags
- **Dashboard visualization** - Historical trend charts
- **Cross-browser matrix** - Expand beyond Chromium to Firefox/WebKit

---

## References

- [Research R18.2: Performance Instrumentation Strategy](../../cmos/missions/research/R18.2_Performance-Instrumentation-Strategy.md)
- [Mission B18.7: Performance Harness Core](../../cmos/missions/sprint-18/B18.7_perf-harness-core.yaml)
- [Playwright Performance Testing Guide](https://playwright.dev/docs/test-assertions#performance)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [User Timing API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure)

---

**Last updated**: Sprint 18 (B18.8)
**Status**: ✅ Core harness + CI integration complete
