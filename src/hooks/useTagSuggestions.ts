import * as React from 'react';

import TimeService from '@/services/time/index.js';
import type { Tag } from '@/schemas/classification/tag.js';

export interface TagUsageSignal {
  readonly objectId: string;
  readonly tags: readonly string[];
  readonly weight?: number;
  readonly similarity?: number;
  readonly lastSeenAt?: string;
}

export interface ContextualTagSuggestion {
  readonly id: string;
  readonly tag: Tag;
  readonly score: number;
  readonly reason: string;
}

export interface UseTagSuggestionsOptions {
  readonly availableTags: readonly Tag[];
  readonly signals: readonly TagUsageSignal[];
  readonly selectedTagIds?: readonly string[];
  readonly limit?: number;
}

export function useTagSuggestions({
  availableTags,
  signals,
  selectedTagIds,
  limit = 6,
}: UseTagSuggestionsOptions): readonly ContextualTagSuggestion[] {
  const selected = React.useMemo(() => new Set(selectedTagIds ?? []), [selectedTagIds]);

  return React.useMemo(() => {
    if (!availableTags || availableTags.length === 0 || !signals || signals.length === 0) {
      return [];
    }

    const tagLookup = new Map<string, Tag>();
    const slugLookup = new Map<string, Tag>();
    for (const tag of availableTags) {
      tagLookup.set(tag.id, tag);
      slugLookup.set(tag.slug, tag);
    }

    const scores = new Map<string, { score: number; occurrences: number }>();

    for (const signal of signals) {
      const weight = signal.weight ?? 1;
      const similarity = signal.similarity ?? 1;
      const recencyBoost = signal.lastSeenAt ? computeRecencyBoost(signal.lastSeenAt) : 1;
      const baseScore = weight * similarity * recencyBoost;
      for (const candidate of signal.tags) {
        const resolved = tagLookup.get(candidate) ?? slugLookup.get(candidate);
        if (!resolved) {
          continue;
        }
        const bucket = scores.get(resolved.id) ?? { score: 0, occurrences: 0 };
        bucket.score += baseScore;
        bucket.occurrences += 1;
        scores.set(resolved.id, bucket);
      }
    }

    const suggestions: ContextualTagSuggestion[] = [];
    for (const [id, bucket] of scores.entries()) {
      if (selected.has(id)) {
        continue;
      }
      const tag = tagLookup.get(id);
      if (!tag) {
        continue;
      }
      suggestions.push({
        id: `context-${id}`,
        tag,
        score: bucket.score,
        reason: `Used in ${bucket.occurrences.toLocaleString()} similar records`,
      });
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [availableTags, limit, selected, signals]);
}

function computeRecencyBoost(timestamp: string): number {
  try {
    const now = TimeService.nowSystem();
    const normalized = TimeService.normalizeToUtc(timestamp);
    const elapsedDays = Math.max(now.diff(normalized, 'days').days, 0);
    if (elapsedDays <= 1) {
      return 1.25;
    }
    if (elapsedDays <= 7) {
      return 1.1;
    }
    if (elapsedDays <= 30) {
      return 1.05;
    }
  } catch {
    return 1;
  }
  return 1;
}
