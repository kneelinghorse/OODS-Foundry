import type {
  PreferenceDocumentInput,
  PreferenceRecord,
  PreferenceValue,
} from '@/schemas/preferences/preference-document.js';

import {
  PreferenceStore,
  type PreferenceStoreOptions,
  type PreferenceStoreSnapshot,
  type PreferencePath,
  type BumpVersionOptions,
} from './preference-store.js';

export interface PreferenceableTraitState {
  readonly document?: PreferenceDocumentInput;
}

export type PreferenceableTraitOptions = PreferenceStoreOptions;

/**
 * Public runtime facade for the Preferenceable trait.
 * Wraps PreferenceStore to expose a stable API for objects/services.
 */
export class PreferenceableTrait {
  private readonly store: PreferenceStore;

  constructor(state: PreferenceableTraitState = {}, options: PreferenceableTraitOptions = {}) {
    this.store = new PreferenceStore(
      {
        document: state.document,
      },
      options
    );
  }

  getPreference(path: PreferencePath): PreferenceValue | undefined {
    return this.store.getPreference(path);
  }

  setPreference(path: PreferencePath, value: PreferenceValue): PreferenceValue {
    return this.store.setPreference(path, value);
  }

  getPreferences(): PreferenceRecord {
    return this.store.getPreferences();
  }

  resetToDefaults(): PreferenceStoreSnapshot {
    return this.store.resetToDefaults();
  }

  getVersion(): string {
    return this.store.getVersion();
  }

  bumpVersion(nextVersion: string, options?: BumpVersionOptions): PreferenceStoreSnapshot {
    return this.store.bumpVersion(nextVersion, options);
  }

  toDocument(): PreferenceStoreSnapshot {
    return this.store.toDocument();
  }
}

export { PreferenceStore };
