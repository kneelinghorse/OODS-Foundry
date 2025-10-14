import { contrastRatio } from './contrast.js';
import { resolveColorSample } from './token.js';
import { DEFAULT_CONTRAST_RULES } from './rules.js';
import type { ContrastEvaluation, ContrastRule, FlatTokenMap } from './types.js';

interface EvaluateOptions {
  prefix?: string;
  rules?: ReadonlyArray<ContrastRule>;
}

export function evaluateContrastRules(
  flatTokens: FlatTokenMap,
  options: EvaluateOptions = {},
): ContrastEvaluation[] {
  const prefix = options.prefix ?? 'oods';
  const rules = options.rules ?? DEFAULT_CONTRAST_RULES;

  return rules.map((rule) => {
    try {
      const foreground = resolveColorSample(flatTokens, rule.foreground, prefix);
      const background = resolveColorSample(flatTokens, rule.background, prefix);

      const ratioRaw = contrastRatio(foreground.value, background.value);
      const ratio = Number(ratioRaw.toFixed(2));
      const threshold = Number(rule.threshold);
      const passed = ratioRaw + Number.EPSILON >= threshold;

      return {
        rule,
        ratio,
        threshold,
        passed,
        foreground,
        background,
        message: passed ? undefined : `Expected contrast ≥${threshold}:1 but measured ${ratio}:1.`,
      } satisfies ContrastEvaluation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        rule,
        ratio: Number.NaN,
        threshold: Number(rule.threshold),
        passed: false,
        foreground: {
          key: rule.foreground,
          value: '',
          cssVariable: '',
        },
        background: {
          key: rule.background,
          value: '',
          cssVariable: '',
        },
        message,
      } satisfies ContrastEvaluation;
    }
  });
}
