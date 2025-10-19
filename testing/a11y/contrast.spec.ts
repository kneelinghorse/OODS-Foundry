import { describe, expect, it } from 'vitest';

import { DEFAULT_CONTRAST_RULES, evaluateContrastRules } from '@oods/a11y-tools';
import { flatTokens, prefix } from '@oods/tokens';

describe('High-Contrast guardrails', () => {
  it('keeps semantic tokens within required contrast ratios', () => {
    const evaluations = evaluateContrastRules(flatTokens, { prefix, rules: DEFAULT_CONTRAST_RULES });
    const failures = evaluations.filter((evaluation) => !evaluation.passed);

    const failureSummary =
      failures.length > 0
        ? failures
            .map((failure) => {
              const context = `${failure.rule.ruleId} (${failure.rule.target})`;
              if (failure.message) {
                return `${context}: ${failure.message}`;
              }
              if (Number.isFinite(failure.ratio)) {
                return `${context}: measured ${failure.ratio?.toFixed(2)}:1 < ${failure.threshold?.toFixed(2)}:1`;
              }
              return `${context}: check failed`;
            })
            .join('\n')
        : undefined;

    expect(failures, failureSummary).toHaveLength(0);
  });
});
