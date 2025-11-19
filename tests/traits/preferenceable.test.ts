import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import PreferenceableTraitModule, {
  PREFERENCEABLE_TRAIT_VERSION,
} from '../../traits/core/Preferenceable.trait.ts';
import { PreferenceableTrait } from '@/traits/preferenceable/preferenceable-trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'core');
const yamlPath = join(traitDir, 'Preferenceable.trait.yaml');

const baseDocument = {
  version: '1.0.0',
  preferences: {
    theme: {
      mode: 'light',
    },
  },
  metadata: {
    schemaVersion: '1.0.0',
    lastUpdated: '2025-11-18T00:00:00Z',
    source: 'user',
    migrationApplied: [],
  },
};

describe('Preferenceable trait definition', () => {
  it('parses YAML definition with semantics and view extensions', async () => {
    const result = await parseTrait(yamlPath);
    expect(result.success).toBe(true);

    const def = result.data!;
    expect(def.trait.name).toBe('Preferenceable');
    expect(def.schema.preference_document.description).toContain('Normalized preference payload');
    expect(def.view_extensions?.form?.[0]?.component).toBe('PreferenceEditor');
  });

  it('exports TypeScript definition with defaults and tokens', () => {
    expect(PreferenceableTraitModule.trait.version).toBe(PREFERENCEABLE_TRAIT_VERSION);
    expect(PreferenceableTraitModule.parameters?.[0]?.name).toBe('namespaces');
    expect(PreferenceableTraitModule.tokens).toHaveProperty('preferences.panel.bg');
  });

  it('validates parameters through the shared validator', () => {
    const validator = new ParameterValidator();

    const ok = validator.validate('Preferenceable', {
      namespaces: ['theme', 'notifications', 'display'],
      schemaVersion: '1.0.0',
    });
    expect(ok.valid).toBe(true);

    const invalid = validator.validate('Preferenceable', {
      namespaces: [],
      schemaVersion: 'abc',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]?.message).toContain('Array must contain');
  });
});

describe('Preferenceable trait runtime helper', () => {
  it('manages preference get/set + reset semantics with namespace guardrails', () => {
    const trait = new PreferenceableTrait(
      {
        document: baseDocument,
      },
      {
        namespaces: ['theme', 'notifications', 'display'],
        defaults: {
          theme: { mode: 'system' },
          notifications: {
            mention: { email: true },
          },
        },
        clock: () => '2025-11-19T10:00:00Z',
      }
    );

    trait.setPreference('notifications.mention.push', false);
    expect(trait.getPreference('notifications.mention.push')).toBe(false);
    expect(trait.getPreference('theme.mode')).toBe('light');

    trait.resetToDefaults();
    expect(trait.getPreference('theme.mode')).toBe('system');
    expect(trait.getPreference('notifications.mention.email')).toBe(true);
  });

  it('prevents writes to blocked namespaces unless allowed and records version bumps', () => {
    const trait = new PreferenceableTrait(
      {
        document: baseDocument,
      },
      {
        namespaces: ['theme', 'notifications'],
        clock: () => '2025-11-19T11:00:00Z',
      }
    );

    expect(() => trait.setPreference('features.beta', true)).toThrow(/Namespace/);

    const relaxed = new PreferenceableTrait(
      {
        document: baseDocument,
      },
      {
        namespaces: ['theme'],
        allowUnknownNamespaces: true,
        clock: () => '2025-11-19T11:05:00Z',
      }
    );

    relaxed.setPreference('features.beta', true);
    const migrated = relaxed.bumpVersion('1.1.0', { strategy: 'eager', id: 'pref-1-1-0' });

    expect(migrated.version).toBe('1.1.0');
    expect(migrated.metadata.migrationApplied.at(-1)?.id).toBe('pref-1-1-0');
  });
});
