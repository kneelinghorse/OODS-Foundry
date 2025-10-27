/**
 * @file Progress component token resolution helpers
 */

import { getToneTokenSet, type StatusTone } from '../statusables/statusRegistry.js';
import type { ProgressIntent } from './types.js';

const INTENT_TO_TONE: Record<ProgressIntent, StatusTone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'critical',
};

const neutralTokens = getToneTokenSet('neutral');

export interface ProgressTokenSet {
  readonly tone: StatusTone;
  readonly track: string;
  readonly indicator: string;
}

/**
 * Resolve the Statusables token mapping for a given progress intent.
 * This ensures multi-brand themes derive their values from shared status tokens.
 */
export function resolveProgressTokens(intent: ProgressIntent = 'info'): ProgressTokenSet {
  const tone = INTENT_TO_TONE[intent] ?? 'info';
  const toneTokens = getToneTokenSet(tone);

  return {
    tone,
    track: neutralTokens.background,
    indicator: toneTokens.border,
  };
}
