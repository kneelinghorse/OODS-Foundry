import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import validatorAjv8 from '@rjsf/validator-ajv8';

import type { User } from '../../generated/objects/User';
import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import {
  PreferenceForm,
  PreferencePreview,
  type PreferenceDocumentChange,
  type PreferenceFormValidationState,
} from '@/components/preferences/index.js';

export interface UserProfileSettingsProps {
  readonly user: User;
  readonly onSave?: (payload: { userId: string; document: PreferenceDocument }) => Promise<void> | void;
}

type SaveState = 'clean' | 'dirty' | 'saving';

export function UserProfileSettings({ user, onSave }: UserProfileSettingsProps): JSX.Element {
  const [document, setDocument] = useState<PreferenceDocument>(() => cloneDocument(user.preference_document));
  const [status, setStatus] = useState<SaveState>('clean');
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  const namespaces: readonly string[] = useMemo(
    () => user.preference_namespaces ?? [],
    [user.preference_namespaces]
  );

  const handleDocumentChange = useCallback(
    ({ document: next }: PreferenceDocumentChange<PreferenceDocument>) => {
      setDocument(next);
      setStatus('dirty');
    },
    []
  );

  const handleValidationChange = useCallback(
    (state: PreferenceFormValidationState<PreferenceDocument>) => {
      setValidationIssues(state.issues.map((issue) => `${issue.path}: ${issue.message}`));
    },
    []
  );

  const handleReset = useCallback(() => {
    setDocument(cloneDocument(user.preference_document));
    setValidationIssues([]);
    setStatus('clean');
  }, [user.preference_document]);

  const handleSave = useCallback(async () => {
    if (status !== 'dirty') {
      return;
    }
    setStatus('saving');
    await onSave?.({ userId: user.user_id, document });
    setStatus('clean');
  }, [document, onSave, status, user.user_id]);

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-[--cmp-border-subtle] bg-[--cmp-surface-raised] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[260px]">
            <p className="text-xs uppercase tracking-wide text-[--sys-text-muted] mb-1">User Preferences</p>
            <h2 className="text-2xl font-semibold text-[--sys-text-primary]">{user.name}</h2>
            <p className="text-sm text-[--sys-text-muted]">{user.primary_email}</p>
          </div>
          <dl className="flex flex-wrap gap-6 text-sm text-[--sys-text-muted]">
            <div>
              <dt className="text-xs uppercase tracking-wide">Version</dt>
              <dd className="text-base text-[--sys-text-primary]">{user.preference_version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Last Updated</dt>
              <dd className="text-base text-[--sys-text-primary]">{user.preference_metadata.lastUpdated}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Mutations</dt>
              <dd className="text-base text-[--sys-text-primary]">{user.preference_mutations ?? 0}</dd>
            </div>
          </dl>
        </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {namespaces.map((namespace: string) => (
              <span
                key={namespace}
                className="rounded-full border border-[--cmp-border-subtle] px-3 py-1 text-xs font-medium text-[--sys-text-secondary]"
              >
                {namespace}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <article className="rounded-3xl border border-[--cmp-border-subtle] bg-[--cmp-surface-canvas] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-[--sys-text-primary]">Edit preferences</h3>
              <p className="text-sm text-[--sys-text-muted]">
                Changes auto-validate via the Preferenceable registry schema.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-[--sys-text-muted]">State: {status}</span>
          </div>
          <PreferenceForm
            document={document}
            version={user.preference_version}
            onDocumentChange={handleDocumentChange}
            onValidationChange={handleValidationChange}
            validator={validatorAjv8}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="cmp-button"
              data-tone="accent"
              disabled={status !== 'dirty'}
              onClick={handleSave}
            >
              {status === 'saving' ? 'Saving…' : 'Save preferences'}
            </button>
            <button className="cmp-button" data-variant="outline" onClick={handleReset}>
              Reset form
            </button>
          </div>
          {validationIssues.length ? (
            <div className="mt-4 rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface-subtle] p-4">
              <p className="text-sm font-medium text-[--sys-text-warning]">Validation issues</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[--sys-text-primary]">
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[--cmp-border-subtle] bg-[--cmp-surface-raised] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[--sys-text-primary]">Summary</h3>
            <p className="text-sm text-[--sys-text-muted]">
              Preview shows the rendered panel fed into PreferencePanel view extensions.
            </p>
          </div>
          <PreferencePreview document={document} />
        </aside>
      </div>
    </section>
  );
}

function cloneDocument<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
