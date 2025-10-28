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

### Nightly Performance Run

A GitHub Actions workflow will run the full harness nightly on `main`:

```yaml
# .github/workflows/perf-nightly.yml
name: Performance Nightly

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm perf:harness --output diagnostics/perf-results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: perf-results-${{ github.sha }}
          path: diagnostics/perf-results.json
```

### PR Smoke Check

A lightweight smoke check runs on PRs to catch catastrophic regressions:

```yaml
# .github/workflows/pr-validate.yml (add to existing)
- name: Performance Smoke Check
  run: pnpm perf:harness --scenario compositor --browser chromium
  continue-on-error: true
```

---

## Baselines and Regression Detection

### Establishing Baselines

Baselines are calculated from the last **N=10** successful nightly runs on `main`:

1. Retrieve last 10 `diagnostics.json` artifacts
2. For each metric, calculate:
   - **Median** (baseline value)
   - **Standard deviation** (variability)
3. Store baseline data for comparison

### Regression Thresholds

A regression is flagged when **all three** conditions are met:

1. **Statistical significance**: `newValue > (baselineMedian + 3 * stdDev)`
2. **Absolute significance**: `(newValue - baselineMedian) > 50ms`
3. **Relative significance**: `((newValue - baselineMedian) / baselineMedian) * 100 > 15%`

This multi-faceted approach minimizes false positives.

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

The CLI outputs a summary table:

```
🚀 Starting Performance Harness...

Configuration:
  Scenario: list
  Browser:  chromium
  Output:   diagnostics/perf-results.json

Running 3 tests using 1 worker

✅ Performance tests completed successfully
📊 Captured 5 snapshots (saved to diagnostics/perf-results.json)
    • List.Table.100Rows → React.actualDuration: 14.60 ms
    • List.Table.100Rows → React.commitTime: 464.20 ms
    • List.Table.FilterApply → UserTiming.duration: 0.10 ms
    • List.Tabs.NavigationSwitch → React.actualDuration: 0.30 ms
    • List.Tabs.NavigationSwitch → UserTiming.duration: 0.10 ms
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

### Sprint 19+ (Out of Scope for B18.7)

- **Lighthouse integration** - Capture Web Vitals (LCP, TTI)
- **Regression alerting** - Automated Slack notifications
- **Baseline auto-fetch** - Pull baselines from CI artifacts
- **Performance budgets** - Hard limits enforced in CI
- **Parameterized scenarios** - Test across tenancy modes, feature flags

---

## References

- [Research R18.2: Performance Instrumentation Strategy](../../cmos/missions/research/R18.2_Performance-Instrumentation-Strategy.md)
- [Mission B18.7: Performance Harness Core](../../cmos/missions/sprint-18/B18.7_perf-harness-core.yaml)
- [Playwright Performance Testing Guide](https://playwright.dev/docs/test-assertions#performance)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [User Timing API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure)

---

**Last updated**: Sprint 18 (B18.7)
**Status**: Core harness implemented, CI integration pending (B18.8)
