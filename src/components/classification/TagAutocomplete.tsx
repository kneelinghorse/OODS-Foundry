import * as React from 'react';

import type { TagSuggestion } from '@/hooks/useTagAutocomplete.js';

import './tag-field.css';

export interface TagAutocompleteProps {
  readonly suggestions: readonly TagSuggestion[];
  readonly activeIndex: number;
  readonly listboxId: string;
  readonly onSuggestionHover?: (index: number) => void;
  readonly onSelect?: (suggestion: TagSuggestion) => void;
}

export function TagAutocomplete({
  suggestions,
  activeIndex,
  listboxId,
  onSuggestionHover,
  onSelect,
}: TagAutocompleteProps): React.ReactElement | null {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <ul className="tag-autocomplete" role="listbox" id={listboxId} data-empty={suggestions.length === 0 ? 'true' : undefined}>
      {suggestions.map((suggestion, index) => {
        const optionId = `${listboxId}-option-${index}`;
        const label = buildLabel(suggestion);
        const meta = suggestion.tag?.usageCount;
        return (
          <li
            key={suggestion.id}
            id={optionId}
            role="option"
            aria-selected={index === activeIndex}
            className="tag-autocomplete__option"
            data-kind={suggestion.type}
            onMouseEnter={() => onSuggestionHover?.(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect?.(suggestion);
            }}
          >
            <div className="tag-pill__label">{label}</div>
            {suggestion.description ? (
              <div className="tag-autocomplete__option-description">{suggestion.description}</div>
            ) : null}
            {typeof meta === 'number' ? (
              <div className="tag-autocomplete__meta">Used {meta.toLocaleString()} times</div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function buildLabel(suggestion: TagSuggestion): React.ReactNode {
  if (suggestion.tag) {
    return (
      <React.Fragment>
        {highlightText(suggestion.tag.name, suggestion.highlight)}
        <span className="tag-pill__slug">#{suggestion.tag.slug}</span>
      </React.Fragment>
    );
  }
  return (
    <React.Fragment>
      Create “{suggestion.value}”
    </React.Fragment>
  );
}

function highlightText(value: string, highlight?: readonly [number, number]): React.ReactNode {
  if (!highlight) {
    return value;
  }
  const [start, end] = highlight;
  return (
    <React.Fragment>
      {value.slice(0, start)}
      <mark>{value.slice(start, end)}</mark>
      {value.slice(end)}
    </React.Fragment>
  );
}
