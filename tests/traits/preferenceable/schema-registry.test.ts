import { describe, expect, it } from 'vitest';

import { getPreferenceExample, listPreferenceSchemas } from '@/traits/preferenceable/schema-registry.ts';
import {
  analyzeSchemaCompatibility,
  generateMigrationPlan,
} from '@/traits/preferenceable/compatibility-checker.ts';
import { validatePreferenceDocument } from '@/traits/preferenceable/schema-validator.ts';
import {
  generatePreferenceTypes,
  resetPreferenceTypeCache,
} from '@/traits/preferenceable/type-generator.ts';

describe('preference schema registry', () => {
  it('lists versions in descending order with metadata context', () => {
    const schemas = listPreferenceSchemas();
    expect(schemas[0]?.version).toBe('2.0.0');
    expect(schemas).toHaveLength(3);
    expect(schemas[1]?.status).toBe('stable');
    expect(schemas[2]?.compatibleWith).toContain('1.0.0');
  });

  it('validates canonical documents with Ajv and surfaces issues', () => {
    const example = getPreferenceExample('2.0.0');
    const success = validatePreferenceDocument(example, { version: '2.0.0' });
    expect(success.valid).toBe(true);

    const invalid = { ...example };
    // Remove the privacy block to trigger a schema violation.
    delete (invalid as any).preferences.privacy;
    const failure = validatePreferenceDocument(invalid, { version: '2.0.0' });
    expect(failure.valid).toBe(false);
    expect(failure.issues[0]?.message).toContain('required');
  });

  it('reports compatibility diffs across versions', () => {
    const backward = analyzeSchemaCompatibility('1.0.0', '1.1.0');
    expect(backward.level).toBe('backward');
    expect(backward.declaredCompatible).toBe(true);
    expect(backward.diff.addedFields).toContain('preferences.theme.highContrast');

    const breaking = analyzeSchemaCompatibility('1.1.0', '2.0.0');
    expect(breaking.level).toBe('breaking');
    expect(breaking.diff.typeChanges).toContain('preferences.notifications.channels');
  });

  it('loads migration plans from registry metadata', () => {
    const plan = generateMigrationPlan('1.0.0', '1.1.0');
    expect(plan?.strategy).toBe('lazy');
    expect(plan?.steps).toHaveLength(2);
  });

  it('generates TypeScript types per schema version', async () => {
    resetPreferenceTypeCache();
    const emitted = await generatePreferenceTypes({ version: '1.0.0' });
    expect(emitted).toMatch(/export (interface|type) PreferenceDocumentV1/);
    expect(emitted).toContain('preferences:');
  });
});
