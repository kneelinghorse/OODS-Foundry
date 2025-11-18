import * as React from 'react';

import { resolveFieldMetadata, type FieldDensity, type FieldValidation } from '@/components/base/fieldUtils.js';
import type { Tag } from '@/schemas/classification/tag.js';
import { normalizeTag } from '@/schemas/classification/tag.js';
import type { TagCreationContext, SpamFinding } from '@/traits/classifiable/tag/spam-detector.js';
import { SpamDetector } from '@/traits/classifiable/tag/spam-detector.js';

import { useTagAutocomplete, type TagSuggestion } from '@/hooks/useTagAutocomplete.js';
import { useTagSuggestions, type ContextualTagSuggestion, type TagUsageSignal } from '@/hooks/useTagSuggestions.js';
import { TagAutocomplete } from './TagAutocomplete.js';
import { TagPill } from './TagPill.js';

import './tag-field.css';

export interface TagInputProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly availableTags: readonly Tag[];
  readonly selectedTags?: readonly Tag[];
  readonly defaultTags?: readonly Tag[];
  readonly name?: string;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly required?: boolean;
  readonly requiredIndicator?: React.ReactNode;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly contextualSuggestions?: readonly ContextualTagSuggestion[];
  readonly contextSignals?: readonly TagUsageSignal[];
  readonly suggestionLimit?: number;
  readonly onChange?: (next: readonly Tag[]) => void;
  readonly onTagAdd?: (tag: Tag, source: TagSuggestion['type']) => void;
  readonly onTagRemove?: (tag: Tag) => void;
  readonly onCreateTag?: (label: string) => Promise<Tag | { tag: Tag }> | Tag | { tag: Tag };
  readonly spamDetector?: SpamDetector;
  readonly spamContext?: TagCreationContext;
}

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  border: 0,
};

export function TagInput({
  id,
  label,
  availableTags,
  selectedTags: selectedProp,
  defaultTags,
  name,
  description,
  validation,
  density = 'comfortable',
  required,
  requiredIndicator = DEFAULT_REQUIRED_INDICATOR,
  placeholder = 'Add tags…',
  disabled = false,
  readOnly = false,
  className,
  style,
  contextualSuggestions: contextualOverrides,
  contextSignals,
  suggestionLimit = 8,
  onChange,
  onTagAdd,
  onTagRemove,
  onCreateTag,
  spamDetector,
  spamContext,
}: TagInputProps): React.ReactElement {
  const [internalTags, setInternalTags] = React.useState<readonly Tag[]>(() => defaultTags ?? []);
  const isControlled = Array.isArray(selectedProp);
  const selectedTags = (isControlled ? selectedProp : internalTags) ?? [];

  const [query, setQuery] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [spamFindings, setSpamFindings] = React.useState<readonly SpamFinding[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);

  const comboboxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const metadata = resolveFieldMetadata(id, {
    hasDescription: Boolean(description),
    validation,
  });

  const derivedSuggestions = contextSignals?.length
    ? useTagSuggestions({
        availableTags,
        signals: contextSignals,
        selectedTagIds: selectedTags.map((tag) => tag.id),
        limit: suggestionLimit,
      })
    : [];

  const contextualSuggestions = React.useMemo(() => {
    if (!contextualOverrides || contextualOverrides.length === 0) {
      return derivedSuggestions;
    }
    const map = new Map<string, ContextualTagSuggestion>();
    for (const suggestion of derivedSuggestions) {
      map.set(suggestion.tag.id, suggestion);
    }
    for (const suggestion of contextualOverrides) {
      map.set(suggestion.tag.id, suggestion);
    }
    return Array.from(map.values());
  }, [contextualOverrides, derivedSuggestions]);

  const suggestions = useTagAutocomplete({
    query,
    availableTags,
    selectedTagIds: selectedTags.map((tag) => tag.id),
    contextualSuggestions,
    includeCreateOption: Boolean(onCreateTag),
    maxSuggestions: suggestionLimit,
  });

  const listboxId = `${id}-listbox`;
  const inputId = `${id}-input`;
  const isDisabled = disabled || readOnly;
  const showSuggestions = isOpen && suggestions.length > 0;
  const ariaControls = showSuggestions ? listboxId : undefined;

  const setTags = (updater: readonly Tag[] | ((current: readonly Tag[]) => readonly Tag[])) => {
    const next = typeof updater === 'function' ? (updater as (current: readonly Tag[]) => readonly Tag[])(selectedTags) : updater;
    onChange?.(next);
    if (!isControlled) {
      setInternalTags(next);
    }
  };

  const addTag = (tag: Tag, source: TagSuggestion['type']) => {
    if (selectedTags.some((candidate) => candidate.id === tag.id)) {
      return;
    }
    setTags([...selectedTags, tag]);
    onTagAdd?.(tag, source);
    announce(`Added ${tag.name}`);
    setQuery('');
    setActiveIndex(-1);
    setSpamFindings([]);
  };

  const removeTag = (tag: Tag) => {
    setTags(selectedTags.filter((candidate) => candidate.id !== tag.id));
    onTagRemove?.(tag);
    announce(`Removed ${tag.name}`);
  };

  const announce = (message: string) => {
    setStatusMessage(message);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Backspace' && !query && selectedTags.length > 0) {
      const last = selectedTags[selectedTags.length - 1];
      if (last) {
        removeTag(last);
      }
      return;
    }
    if (event.key === 'Enter' || (event.key === ',' && !event.shiftKey)) {
      event.preventDefault();
      commitSelection();
    }
  };

  const commitSelection = () => {
    if (showSuggestions && activeIndex >= 0 && suggestions[activeIndex]) {
      handleSuggestionSelect(suggestions[activeIndex]);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const canonical = findMatchingTag(trimmed, availableTags);
    if (canonical) {
      addTag(canonical, 'match');
      return;
    }
    if (onCreateTag) {
      void createTag(trimmed);
    }
  };

  const handleSuggestionSelect = (suggestion: TagSuggestion) => {
    if (suggestion.type === 'create') {
      void createTag(suggestion.value);
      return;
    }
    if (suggestion.tag) {
      addTag(suggestion.tag, suggestion.type);
    }
  };

  const createTag = async (labelValue: string) => {
    if (!labelValue || isCreating) {
      return;
    }
    const detector = spamDetector ?? new SpamDetector();
    const spamPayload = {
      name: labelValue,
      slug: labelValue,
      usageCount: 0,
      synonyms: [],
    };
    const context: TagCreationContext =
      spamContext ?? {
        userId: 'tag-input',
        userReputation: 50,
        recentCreations: [],
      };
    const findings = detector.evaluate(spamPayload, context);
    setSpamFindings(findings);
    const blocked = findings.some((finding) => finding.severity === 'block');
    if (blocked) {
      announce('Tag creation blocked by governance rules.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await onCreateTag?.(labelValue);
      const created = result && 'tag' in result ? result.tag : result;
      const finalTag =
        created ??
        normalizeTag({
          id: labelValue,
          name: labelValue,
          slug: labelValue,
          usageCount: 0,
          state: 'active',
          isCanonical: true,
          synonyms: [],
        });
      addTag(finalTag, 'create');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFocus = () => {
    if (!isDisabled) {
      setIsOpen(true);
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (event) => {
    if (comboboxRef.current?.contains(event.relatedTarget as Node)) {
      return;
    }
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const fieldClasses = ['form-field', 'tag-input', className].filter(Boolean).join(' ');
  const fieldStyle = metadata.variables
    ? ({ ...metadata.variables, ...style } as React.CSSProperties)
    : style;

  return (
    <div
      className={fieldClasses}
      style={fieldStyle}
      data-density={density}
      data-validation-state={metadata.dataValidationState}
    >
      <div className="form-field__label" id={`${id}-label`}>
        <label htmlFor={inputId}>
          <span>{label}</span>
          {required && requiredIndicator}
        </label>
      </div>
      <div className="form-field__control" aria-describedby={metadata.describedBy}>
        <div
          ref={comboboxRef}
          className="tag-input__control"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={ariaControls}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
          aria-describedby={metadata.describedBy}
          data-disabled={isDisabled ? 'true' : undefined}
          onBlur={handleBlur}
        >
          {selectedTags.map((tag) => (
            <TagPill
              key={tag.id}
              tag={tag}
              removable={!isDisabled}
              onRemove={() => removeTag(tag)}
              interactive={false}
            />
          ))}
          <div className="tag-input__combobox">
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              className="tag-input__input"
              disabled={isDisabled}
              readOnly={readOnly}
              placeholder={selectedTags.length === 0 ? placeholder : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              aria-autocomplete="list"
              aria-controls={ariaControls}
              aria-activedescendant={
                showSuggestions && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
              }
              autoComplete="off"
            />
          </div>
        </div>
        {showSuggestions ? (
          <TagAutocomplete
            suggestions={suggestions}
            activeIndex={activeIndex}
            listboxId={listboxId}
            onSuggestionHover={setActiveIndex}
            onSelect={handleSuggestionSelect}
          />
        ) : null}
      </div>
      {description ? (
        <p className="form-field__description" id={metadata.descriptionId}>
          {description}
        </p>
      ) : null}
      {validation?.message ? (
        <p className="form-field__validation" id={metadata.validationId} aria-live="polite">
          {validation.message}
        </p>
      ) : null}
      {spamFindings.length > 0 ? (
        <div className="tag-input__status" role="status">
          {spamFindings.map((finding) => (
            <div key={`${finding.rule}-${finding.message}`}>{finding.message}</div>
          ))}
        </div>
      ) : null}
      {name
        ? selectedTags.map((tag, index) => (
            <input key={tag.id} type="hidden" name={`${name}[${index}]`} value={tag.slug} />
          ))
        : null}
      <div aria-live="polite" style={SR_ONLY_STYLE}>
        {statusMessage}
      </div>
      {isCreating ? <div className="tag-input__status">Creating tag…</div> : null}
    </div>
  );
}

function findMatchingTag(query: string, tags: readonly Tag[]): Tag | undefined {
  const normalized = query.trim().toLowerCase();
  return tags.find((tag) => tag.slug === normalized || tag.name.toLowerCase() === normalized);
}
