import * as React from 'react';

import type { Tag } from '@/schemas/classification/tag.js';
import { normalizeSlug } from '@/schemas/classification/utils.js';
import { SynonymMapper, type SynonymResolution } from '@/traits/classifiable/tag/synonym-mapper.js';

import type { ContextualTagSuggestion } from './useTagSuggestions.js';

export type TagSuggestionKind = 'match' | 'synonym' | 'contextual' | 'create';

export interface TagSuggestion {
  readonly id: string;
  readonly type: TagSuggestionKind;
  readonly value: string;
  readonly tag?: Tag;
  readonly description?: string;
  readonly resolution?: SynonymResolution | null;
  readonly score: number;
  readonly highlight?: readonly [number, number];
}

export interface UseTagAutocompleteOptions {
  readonly query: string;
  readonly availableTags: readonly Tag[];
  readonly selectedTagIds?: readonly string[];
  readonly contextualSuggestions?: readonly ContextualTagSuggestion[];
  readonly synonymMapper?: SynonymMapper;
  readonly includeCreateOption?: boolean;
  readonly maxSuggestions?: number;
}

export function useTagAutocomplete({
  query,
  availableTags,
  selectedTagIds,
  contextualSuggestions,
  synonymMapper,
  includeCreateOption = false,
  maxSuggestions = 8,
}: UseTagAutocompleteOptions): readonly TagSuggestion[] {
  const normalizedQuery = normalizeQuery(query);
  const selected = React.useMemo(() => new Set(selectedTagIds ?? []), [selectedTagIds]);

  const mapper = React.useMemo(
    () => synonymMapper ?? new SynonymMapper(availableTags),
    [availableTags, synonymMapper]
  );

  return React.useMemo(() => {
    const slugLookup = new Map<string, Tag>();
    const suggestions = new Map<string, TagSuggestion>();

    for (const tag of availableTags) {
      slugLookup.set(tag.slug, tag);
    }

    if (contextualSuggestions) {
      for (const suggestion of contextualSuggestions) {
        if (!suggestion.tag || selected.has(suggestion.tag.id)) {
          continue;
        }
        suggestions.set(`context-${suggestion.tag.id}`, {
          id: `context-${suggestion.tag.id}`,
          type: 'contextual',
          value: suggestion.tag.slug,
          tag: suggestion.tag,
          description: suggestion.reason,
          score: suggestion.score,
        });
      }
    }

    if (normalizedQuery) {
      for (const tag of availableTags) {
        if (selected.has(tag.id)) {
          continue;
        }
        const score = computeMatchScore(normalizedQuery, tag);
        if (score <= 0) {
          continue;
        }
        const highlight = buildHighlightRange(normalizedQuery, tag.name);
        suggestions.set(tag.id, {
          id: `match-${tag.id}`,
          type: 'match',
          value: tag.slug,
          tag,
          description: tag.synonyms.length > 0 ? `${tag.synonyms.length} synonym(s)` : undefined,
          score,
          highlight,
        });
      }

      const resolution = mapper.resolve(normalizedQuery);
      if (resolution) {
        const resolvedTag = slugLookup.get(resolution.canonicalSlug);
        if (resolvedTag && !selected.has(resolvedTag.id)) {
          suggestions.set(`synonym-${resolvedTag.id}`, {
            id: `synonym-${resolvedTag.id}`,
            type: 'synonym',
            value: resolvedTag.slug,
            tag: resolvedTag,
            resolution,
            description: resolution.matchedAlias
              ? `Synonym for ${resolvedTag.name}`
              : `Canonical tag: ${resolvedTag.name}`,
            score: 95,
          });
        }
      }
    }

    const canonicalQuerySlug = safeNormalizeSlug(normalizedQuery);
    if (includeCreateOption && canonicalQuerySlug && !slugLookup.has(canonicalQuerySlug)) {
      suggestions.set(`create-${normalizedQuery}`, {
        id: `create-${normalizedQuery}`,
        type: 'create',
        value: canonicalQuerySlug,
        description: 'Create new tag',
        score: 40,
      });
    }

    return Array.from(suggestions.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return rankForKind(a.type) - rankForKind(b.type);
      })
      .slice(0, maxSuggestions);
  }, [availableTags, contextualSuggestions, includeCreateOption, mapper, maxSuggestions, normalizedQuery, selected]);
}

function normalizeQuery(value: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function safeNormalizeSlug(value: string): string | null {
  if (!value) {
    return null;
  }
  try {
    return normalizeSlug(value);
  } catch {
    return value;
  }
}

function computeMatchScore(query: string, tag: Tag): number {
  const label = `${tag.name} ${tag.slug} ${(tag.synonyms ?? []).join(' ')}`.toLowerCase();
  if (!query) {
    return 0;
  }
  if (label.startsWith(query)) {
    return 90;
  }
  if (label.includes(query)) {
    const index = label.indexOf(query);
    return Math.max(65 - index, 50);
  }
  const fuzzy = fuzzyContains(query, label);
  return Math.round(fuzzy * 50);
}

function fuzzyContains(query: string, value: string): number {
  if (!query) {
    return 0;
  }
  let score = 0;
  let searchIndex = 0;
  for (const char of query) {
    const matchIndex = value.indexOf(char, searchIndex);
    if (matchIndex === -1) {
      return score / query.length;
    }
    const distance = matchIndex - searchIndex;
    score += Math.max(0.2, 1 - distance * 0.1);
    searchIndex = matchIndex + 1;
  }
  return score / query.length;
}

function buildHighlightRange(query: string, label: string): readonly [number, number] | undefined {
  const normalizedLabel = label.toLowerCase();
  const index = normalizedLabel.indexOf(query);
  if (index === -1) {
    return undefined;
  }
  return [index, index + query.length];
}

function rankForKind(kind: TagSuggestionKind): number {
  switch (kind) {
    case 'match':
      return 0;
    case 'synonym':
      return 1;
    case 'contextual':
      return 2;
    case 'create':
      return 3;
    default:
      return 4;
  }
}
