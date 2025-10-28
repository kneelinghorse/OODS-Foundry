# Performance Harness Core Deliverables

**Mission**: B18.7 - Performance harness core
**Status**: ✅ Completed
**Date**: 2025-10-28

## Artifacts Delivered

### 1. Playwright Configuration
- `testkits/perf-harness/playwright.config.ts`
- Single-worker, serial execution for stable measurements
- Trace retention on failure

### 2. Instrumentation Utilities

#### React Profiler (`src/perf/instrumentation/profiler.tsx`)
- `<PerfProfiler>` wrapper component
- Captures `actualDuration`, `baseDuration`, `commitTime`
- Metrics stored in `window.__PERF_PROFILER_METRICS__`

#### User Timing API (`src/perf/instrumentation/userTiming.ts`)
- `measureSync()` / `measureAsync()` wrappers
- Manual `markStart()` / `markEnd()` helpers
- Global exposure via `window.__PERF_USER_TIMING__`

### 3. Test Scenarios

Four comprehensive test suites:

1. **Compositor Performance** (`tests/compositor.perf.spec.ts`)
   - Button state updates
   - Toast compositor updates

2. **List Rendering** (`tests/list.perf.spec.ts`)
   - Table with 100 rows
   - Filter application
   - Tab navigation switches

3. **Token Transforms** (`tests/token-transform.perf.spec.ts`)
   - Brand switching
   - Theme toggling
   - Token resolution

4. **Usage Aggregation** (`tests/usage-aggregation.perf.spec.ts`)
   - Daily usage aggregation (1000 events)
   - Weekly rollup
   - Billing calculations

### 4. Performance Schema
- `diagnostics/performance-harness.schema.json` (JSON Schema Draft 07)
- TypeScript types in `utils/schema.ts`
- Snapshot creation/serialization utilities

### 5. Developer CLI
- `testkits/perf-harness/cli.ts`
- NPM script: `pnpm perf:harness`
- Options: `--scenario`, `--browser`, `--output`

### 6. Documentation
- `docs/testing/PERFORMANCE_TESTING.md` (comprehensive guide)
- `testkits/perf-harness/README.md` (quick reference)
- Storybook stories under `stories/performance/*` instrumented with Profiler/User Timing

### 7. Smoke Tests
- `tests/smoke.perf.spec.ts`
- Verifies Storybook connection, User Timing API, profiler storage

## Success Criteria Met

✅ Playwright project initialized with config
✅ Target components/functions instrumented
✅ Four scenario test suites authored
✅ Schema defined and validated
✅ `pnpm perf:harness` command executes and writes `diagnostics/perf-results.json`
✅ Documentation complete

## Metrics Captured

| Metric Type | API Used | Example |
|-------------|----------|---------|
| Compositor updates | React Profiler | `React.actualDuration` |
| List rendering | User Timing | `UserTiming.renderDuration` |
| Token transforms | User Timing | `UserTiming.transformDuration` |
| Usage aggregation | User Timing | `UserTiming.aggregationDuration` |

## Next Steps (B18.8)

- [ ] Nightly CI workflow (GitHub Actions)
- [ ] Baseline calculation from N=10 runs
- [ ] Regression alerting (3-sigma + 15%)
- [ ] Performance runbooks
- [ ] Developer baseline fetch automation

## File Count

```
src/perf/instrumentation/
├── index.ts
├── profiler.tsx
└── userTiming.ts

testkits/perf-harness/
├── cli.ts
├── playwright.config.ts
├── README.md
├── utils/
│   └── schema.ts
└── tests/
    ├── compositor.perf.spec.ts
    ├── list.perf.spec.ts
    ├── smoke.perf.spec.ts
    ├── token-transform.perf.spec.ts
    └── usage-aggregation.perf.spec.ts
```

## Research Foundation
- R18.2: Performance Instrumentation Strategy
- Playwright + Profiler/User Timing hybrid stack
- Tiered CI cadence (PR smoke + nightly full run)
