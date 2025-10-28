# Performance Harness

> Playwright-based performance measurement for OODS Foundry components

## Quick Reference

```bash
# Run all scenarios
pnpm perf:harness

# Specific scenario
pnpm perf:harness --scenario compositor
pnpm perf:harness --scenario list
pnpm perf:harness --scenario token-transform
pnpm perf:harness --scenario usage-aggregation

# Specify browser
pnpm perf:harness --browser firefox

# Help
pnpm perf:harness --help
```

## What Gets Measured

| Scenario | Metrics | Target Budget |
|----------|---------|---------------|
| **Compositor** | React component update time | < 100ms |
| **List** | Table rendering, filtering | < 1000ms |
| **Token Transform** | Brand/theme switching | < 500ms |
| **Usage Aggregation** | Billing data processing | < 1000ms |

## Output

Results are saved to `diagnostics/perf-results.json` (structured snapshots) and `testkits/perf-harness/perf-results/html/` (Playwright report). The CLI prints a concise summary after each run.

## Schema

All metrics conform to `diagnostics/performance-harness.schema.json`:

```typescript
interface PerformanceSnapshot {
  snapshotId: string;        // UUID
  scenarioId: string;        // e.g., "List.Table.100Rows"
  metricName: string;        // e.g., "React.actualDuration"
  value: number;             // Measured value
  unit: 'ms' | 'seconds' | 'bytes' | 'score';
  browser: 'chromium' | 'firefox' | 'webkit';
  parameters?: object;       // Test configuration
}
```

## Instrumentation

### React Profiler

```tsx
import { PerfProfiler } from '~/src/perf/instrumentation';

<PerfProfiler id="MyComponent">
  <ExpensiveChild />
</PerfProfiler>
```

### User Timing

```typescript
import { measureSync, measureAsync } from '~/src/perf/instrumentation';

const { result, duration } = measureSync('operation', () => {
  return expensiveCalculation();
});
```

Instrumentation utilities are sourced from `src/perf/instrumentation` and are consumed both by Storybook stories and by Playwright test helpers.

## Documentation

See [docs/testing/PERFORMANCE_TESTING.md](../../docs/testing/PERFORMANCE_TESTING.md) for:

- Detailed API reference
- Writing performance tests
- CI integration guide
- Baseline and regression detection
- Troubleshooting

## Files

```
testkits/perf-harness/
├── README.md                      # This file
├── playwright.config.ts           # Playwright configuration
├── cli.ts                         # CLI wrapper
├── utils/
│   └── schema.ts                 # Performance snapshot types
└── tests/
    ├── compositor.perf.spec.ts
    ├── list.perf.spec.ts
    ├── token-transform.perf.spec.ts
    └── usage-aggregation.perf.spec.ts
```

## Mission Context

**Sprint**: 18
**Mission**: B18.7 - Performance harness core
**Status**: ✅ Core implementation complete
**Next**: B18.8 - CI integration & runbooks
