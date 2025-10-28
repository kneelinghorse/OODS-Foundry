# Performance Regression Runbook

> **Audience**: On-call engineers, performance team
> **Last Updated**: Sprint 18 (B18.8)
> **Alert Source**: Slack `#engineering`, GitHub Actions workflow failure

---

## Overview

This runbook guides you through responding to performance regression alerts from the nightly performance harness.

**Typical alert:**

> ⚠️ **Performance Regressions Detected**
> Total: 24 metrics
> Stable: 20
> Improvements: 2
> Regressions: 2
>
> **Top Regressions:**
> - List.Table.100Rows → React.actualDuration
>   14.20 → 22.40 ms (+57.7%)

---

## Step 1: Assess Severity

### Critical Regression

**Triggers immediate response** if:

- User-facing scenario (e.g., List rendering, brand switching)
- Absolute degradation > 200ms
- Multiple related regressions (suggests systemic issue)

**Action:** Page on-call engineer, escalate to performance team.

### Non-Critical Regression

**Standard response** if:

- Internal tooling scenario (e.g., usage aggregation)
- Absolute degradation 50-200ms
- Single isolated regression

**Action:** Create tracking issue, triage in next sprint planning.

---

## Step 2: Gather Context

### Download Artifacts

```bash
# Find the failing workflow run
gh run list --workflow=perf-harness.yml --limit 5

# Download regression report
gh run download <run-id> -n perf-regression-report-<sha>

# This gives you:
# - diagnostics/perf-baseline.json
# - diagnostics/perf-regressions.json
```

### Review Regression Report

```bash
cat diagnostics/perf-regressions.json | jq '.regressions'
```

**Key fields:**

- `scenarioId` - Which test scenario regressed
- `metricName` - Which metric (React.actualDuration, UserTiming.duration, etc.)
- `newValue` vs `baselineMedian` - How much slower
- `absoluteDiff` and `relativeDiff` - Magnitude of regression

### Identify Suspect Commits

```bash
# Check recent commits on main
git log --oneline -10

# Diff between baseline and current
git diff <baseline-sha> <current-sha> --stat
```

Look for:

- Component changes affecting the regressed scenario
- Token/theme changes (if token-transform regressed)
- Data processing changes (if usage-aggregation regressed)

---

## Step 3: Reproduce Locally

### Run Suspect Scenario

```bash
# Checkout the suspect commit
git checkout <sha>

# Install dependencies
pnpm install

# Run the specific scenario
pnpm perf:harness --scenario <scenario-name>

# Example:
pnpm perf:harness --scenario list
```

> When `diagnostics/perf-baseline.json` is available locally, the CLI prints per-metric deltas against the stored baseline at the end of the run.

### Compare Against Baseline

```bash
# Run on baseline commit
git checkout <baseline-sha>
pnpm install
pnpm perf:harness --scenario list --output perf-baseline-local.json

# Run on suspect commit
git checkout <suspect-sha>
pnpm install
pnpm perf:harness --scenario list --output perf-suspect-local.json

# Manual comparison
diff perf-baseline-local.json perf-suspect-local.json
```

### Profile the Regression

Use Chrome DevTools Performance profiler:

1. Open Storybook: `pnpm storybook`
2. Navigate to regressed story
3. Open DevTools → Performance tab
4. Record interaction (e.g., click, filter, render)
5. Analyze flame graph for expensive operations

**Common culprits:**

- Excessive re-renders (check React Profiler)
- Large data transformations (check User Timing marks)
- Token lookup inefficiency (check CSS variable access)

---

## Step 4: Mitigation Strategies

### Quick Wins

1. **Memoization** - Add `useMemo` or `React.memo` to expensive components
2. **Debouncing** - Add debounce to frequent operations (filters, search)
3. **Lazy loading** - Defer non-critical computations
4. **Token caching** - Cache token lookups if repeated

### Rollback

If regression is severe and no quick fix is available:

```bash
# Revert suspect commit
git revert <suspect-sha>

# Test that revert fixes regression
pnpm perf:harness --scenario <scenario>

# Push revert to main
git push origin main
```

### Defer

If regression is non-critical:

1. Create tracking issue with links to:
   - Failing workflow run
   - Regression report artifact
   - Suspect commit(s)
2. Add to next sprint planning
3. Update baseline to accept new performance (if intentional trade-off)

---

## Step 5: Verify Fix

### Local Verification

```bash
# Apply fix
git checkout -b fix/perf-regression-<scenario>

# Test fix
pnpm perf:harness --scenario <scenario>

# Ensure metric returns to baseline range
# Baseline: 14.20 ms (±2.10)
# Fixed:    15.10 ms (within 3-sigma)
```

### CI Verification

```bash
# Push fix branch
git push origin fix/perf-regression-<scenario>

# Open PR
gh pr create --title "fix(perf): resolve <scenario> regression" --body "..."

# Manually trigger perf workflow on PR branch (via Actions UI)
# or merge PR and wait for next nightly run
```

### Update Baseline (If Needed)

If the regression is intentional (e.g., new feature adds necessary work):

1. Document the trade-off in PR description
2. Merge the change
3. Baseline will automatically update after 10 nightly runs
4. Alternatively, manually accept the new baseline:

```bash
# Update baseline threshold in check-regressions.mjs
# (increase ABSOLUTE_THRESHOLD_MS or RELATIVE_THRESHOLD_PCT)
```

---

## Step 6: Post-Incident Review

After resolving a critical regression, conduct a brief post-mortem:

### Questions to Answer

1. **Root cause**: What code change caused the regression?
2. **Detection**: Why didn't we catch this earlier (e.g., in PR review)?
3. **Response time**: How long from alert to resolution?
4. **Prevention**: What can we do to prevent similar regressions?

### Action Items

- Update performance budgets if needed
- Add missing performance tests
- Improve code review guidelines
- Update this runbook with lessons learned

---

## Common Scenarios

### Scenario: List.Table.100Rows Regressed

**Likely causes:**

- Inefficient filtering logic
- Missing memoization on row components
- Virtualization disabled or broken

**Debug steps:**

1. Check `List.tsx` for recent changes
2. Profile row rendering in DevTools
3. Verify virtual scrolling is active
4. Check if filtering is debounced

---

### Scenario: TokenTransform.BrandSwitch Regressed

**Likely causes:**

- Token pipeline changes (DTCG → CSS vars)
- CSS variable lookup inefficiency
- Theme context re-render cascade

**Debug steps:**

1. Check `scripts/tokens/transform.ts` for changes
2. Profile CSS variable reads in DevTools
3. Check React Profiler for theme context consumers
4. Verify token caching is working

---

### Scenario: UsageAggregation.Daily Regressed

**Likely causes:**

- Aggregation logic inefficiency
- Data structure changes
- Missing indexing

**Debug steps:**

1. Check `scripts/usage/aggregate.ts` for changes
2. Profile aggregation function with User Timing
3. Verify data structures are optimized
4. Check database query efficiency (if applicable)

---

## Escalation

If regression cannot be resolved within 24 hours:

1. **Escalate to performance team** - `@perf-team` in Slack
2. **Consider rollback** - Revert suspect commit to unblock `main`
3. **Schedule deep dive** - Book 1-hour session with relevant engineers

---

## References

- [PERFORMANCE_TESTING.md](../docs/testing/PERFORMANCE_TESTING.md)
- [Mission B18.8: Performance CI Integration](../cmos/missions/sprint-18/B18.8_perf-ci-and-docs.yaml)
- [GitHub Actions Workflow](.github/workflows/perf-harness.yml)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [Chrome DevTools Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)

---

**Questions?** Ask in `#engineering` or file an issue.
