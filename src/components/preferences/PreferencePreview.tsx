import { useMemo } from 'react';
import type { JSX, ReactNode } from 'react';

import type { FieldDensity } from '@/components/base/fieldUtils.js';
import type {
  PreferenceDocument,
  PreferenceRecord,
  PreferenceValue,
} from '@/schemas/preferences/preference-document.js';

export interface PreferencePreviewEntry {
  readonly id: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly path: string;
}

export interface PreferencePreviewSection {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly entries: readonly PreferencePreviewEntry[];
}

export interface PreferencePreviewProps {
  readonly document: PreferenceDocument;
  readonly sections?: readonly PreferencePreviewSection[];
  readonly className?: string;
  readonly density?: FieldDensity;
  readonly title?: string;
}

const BASE_CONTAINER_CLASSES =
  'preference-preview rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-6 shadow-[0_1px_6px_rgba(15,23,42,0.08)]';

export function PreferencePreview({
  document,
  sections,
  className,
  density = 'comfortable',
  title = 'Preference summary',
}: PreferencePreviewProps): JSX.Element {
  const derivedSections = useMemo(
    () => sections ?? buildPreferencePreviewSections(document),
    [document, sections]
  );

  const containerClassName = [BASE_CONTAINER_CLASSES, className].filter(Boolean).join(' ');

  if (!derivedSections.length) {
    return (
      <section className={containerClassName} data-density={density} aria-label={title}>
        <p className="text-sm text-[--sys-text-muted]">No preferences available yet.</p>
      </section>
    );
  }

  return (
    <section className={containerClassName} data-density={density} aria-label={title}>
      <header className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
          {title}
        </span>
      </header>
      <div className="flex flex-col gap-5">
        {derivedSections.map((section) => (
          <div key={section.id} aria-labelledby={`${section.id}-preview-title`}>
            <header className="mb-2">
              <h3 id={`${section.id}-preview-title`} className="text-base font-semibold text-[--sys-text-primary]">
                {section.title}
              </h3>
              {section.description ? (
                <p className="text-sm text-[--sys-text-muted]">{section.description}</p>
              ) : null}
            </header>
            <dl className="grid gap-2">
              {section.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 rounded-xl border border-transparent bg-[--cmp-surface-canvas] px-3 py-2 hover:border-[--cmp-border-subtle]"
                  data-path={entry.path}
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">
                    {entry.label}
                  </dt>
                  <dd className="text-sm text-[--sys-text-primary]">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export function buildPreferencePreviewSections(
  document: PreferenceDocument
): PreferencePreviewSection[] {
  const preferences = document.preferences ?? {};
  const sections: PreferencePreviewSection[] = [];

  for (const [group, value] of Object.entries(preferences)) {
    const entries = flattenPreferenceValue(value as PreferenceValue, [group]);
    if (!entries.length) {
      continue;
    }
    sections.push({
      id: group,
      title: toTitleCase(group),
      entries,
    });
  }

  return sections;
}

function flattenPreferenceValue(value: PreferenceValue, path: string[]): PreferencePreviewEntry[] {
  if (value === null || typeof value === 'undefined') {
    return [buildEntry(path, '—')];
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [buildEntry(path, value.toString())];
  }

  if (typeof value === 'boolean') {
    return [buildEntry(path, value ? 'Enabled' : 'Disabled')];
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return [buildEntry(path, '—')];
    }
    const joined = value
      .map((entry) =>
        typeof entry === 'string' || typeof entry === 'number'
          ? entry.toString()
          : typeof entry === 'boolean'
          ? entry
            ? 'Enabled'
            : 'Disabled'
          : '[complex]'
      )
      .join(', ');
    return [buildEntry(path, joined)];
  }

  if (isPreferenceRecord(value)) {
    const entries: PreferencePreviewEntry[] = [];
    for (const [key, nested] of Object.entries(value)) {
      entries.push(...flattenPreferenceValue(nested, [...path, key]));
    }
    return entries;
  }

  return [buildEntry(path, String(value))];
}

function buildEntry(path: string[], renderedValue: ReactNode): PreferencePreviewEntry {
  const id = path.join('.');
  const label = toTitleCase(path[path.length - 1] ?? 'preference');
  return {
    id,
    label,
    value: renderedValue,
    path: id,
  };
}

function toTitleCase(value: string): string {
  const spaced = value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) {
    return '';
  }
  return spaced
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isPreferenceRecord(value: PreferenceValue): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
