# @oods/a11y-tools

`@oods/a11y-tools` bundles the accessibility helpers that power the OODS colour guardrails and contrast diagnostics. The package exposes deterministic, dual-module builds that can be consumed in Node 20 runtimes or modern build systems.

```ts
import { DEFAULT_CONTRAST_RULES, evaluateContrastRules } from '@oods/a11y-tools';
import tokens from '@oods/tokens';

const results = evaluateContrastRules(tokens.flatTokens, DEFAULT_CONTRAST_RULES);
const failing = results.filter((result) => !result.passed);

if (failing.length > 0) {
  console.table(failing.map(({ rule, ratio }) => ({ rule: rule.ruleId, ratio })));
}
```

The evaluation utilities accept the `flat` token map emitted by `@oods/tokens` and return structured results with ratios, thresholds, and foreground/background metadata so teams can wire the checks into test suites or release gates.
