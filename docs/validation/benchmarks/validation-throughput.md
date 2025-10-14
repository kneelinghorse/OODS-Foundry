# Validation Throughput Benchmarks

Benchmarks are captured on MacBook Pro (M3 Max, 64 GB RAM) using Node.js 20.11 and npm 10. The CI target is to finish the validation pipeline in under two minutes; the current suite completes well within that envelope.

## Commands & Runtimes

| Command | Runtime (local) | Notes |
| --- | --- | --- |
| `npm run lint` | 3.1s | ESLint across `src/**`. |
| `npm run test:unit` | 4.5s | Excludes integration suites. |
| `npm run test:validation` | 1.9s | Focused AJV/Zod coverage. |
| `npm run test:integration` | 0.6s | Universal Quintet fixtures, golden & failure paths. |
| `npm run validate:pipeline` | 0.8s | CLI validation over `traits/`. |
| `npm run test:coverage` | 6.2s | Generates V8 coverage + HTML report. |
| `npm run ci:local` | 9.8s | Aggregated workflow end-to-end. |

> All timings represent the median of three consecutive runs with a warm npm cache. CI runners (GitHub-hosted Ubuntu) complete `ci:local` in ~70s, satisfying the <2 min requirement.

## Performance Observations

- **Composition Validator:** The Zod-based composition validation reports sub-10ms execution per composed object. `performanceTargetMs` is set to 50ms and never breached during load testing.
- **Parameter Validator:** AJV compilation cache eliminates repeated schema compilation. `ParameterValidator` maintains <5 cached validators for current fixtures.
- **I/O Boundaries:** No network or filesystem writes outside the repository occur; GitHub Actions caching keeps dependency installs fast.

## Next Steps

- Track historical runtime data by appending new rows with timestamps when workloads change.
- Extend benchmarking to include memory profiling if trait counts grow significantly.
- When additional domain packs are introduced, update Universal Quintet metrics and add new fixture-specific measurements.

