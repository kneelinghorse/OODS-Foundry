import { DEFAULT_CONTRAST_RULES, evaluateContrastRules } from '@oods/a11y-tools';
import type { ContrastEvaluation } from '@oods/a11y-tools';

import type { ReplIssue } from '../schemas/generated.js';
import { flattenDTCGLayers, toFlatTokenMap } from './token-color-resolver.js';
import type { DTCGTokenData } from './token-color-resolver.js';

// Legacy explicit-input DTCG utility. Runtime tools use built-screen.ts.

function wcagLevel(threshold: number): string {
  return threshold >= 4.5 ? 'AA' : 'AA (large text/graphics)';
}

function formatFailure(evaluation: ContrastEvaluation): ReplIssue {
  const { rule, ratio, threshold } = evaluation;
  const ratioText = Number.isFinite(ratio) ? `${ratio}:1` : 'unmeasurable';
  const level = wcagLevel(threshold);

  return {
    code: 'A11Y_CONTRAST',
    message: rule.summary,
    hint: `${rule.target} fails WCAG ${level} — contrast ratio ${ratioText}, minimum ${threshold}:1 required.`,
    severity: 'warning',
  };
}

/**
 * Run all default contrast rules against token data and return ReplIssue
 * entries for any failures.
 *
 * @param tokenData DTCG token data from the structured data artifact.
 * @returns Array of ReplIssue with code `A11Y_CONTRAST` and severity `warning`.
 */
export function validateContrast(tokenData: DTCGTokenData): ReplIssue[] {
  const flatMap = flattenDTCGLayers(tokenData);
  const flatTokenMap = toFlatTokenMap(flatMap);

  const evaluations = evaluateContrastRules(flatTokenMap, {
    prefix: 'oods',
    rules: DEFAULT_CONTRAST_RULES,
  });

  return evaluations.filter((e) => !e.passed).map(formatFailure);
}
