import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import AuditableTraitModule from '../../traits/lifecycle/Auditable.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'lifecycle');
const yamlPath = join(traitDir, 'Auditable.trait.yaml');

describe('Auditable trait', () => {
  it('parses YAML definition with audit timeline semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Auditable');
    expect(def.trait.version).toBe('1.0.0');
    expect(def.schema.audit_log.type).toBe('AuditEntry[]');
    expect(def.semantics?.audit_log?.token_mapping).toBe('tokenMap(audit.timeline.*)');
    expect(def.view_extensions?.timeline?.[0]?.component).toBe('AuditTimeline');
  });

  it('exposes TypeScript definition with audit tokens', () => {
    const def = AuditableTraitModule;

    expect(def.parameters?.[0]?.default).toBe(0);
    expect(def.parameters?.[2]?.name).toBe('trackActorId');
    expect(def.parameters?.[2]?.default).toBe(true);
    expect(def.metadata?.maturity).toBe('experimental');
    expect(def.tokens).toHaveProperty('cmp.audit.timeline.connector.color');
    expect(def.tokens).toHaveProperty('cmp.audit.entry.bg');
  });

  it('accepts default configuration (no parameters)', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Auditable', {});

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('accepts a full compliance configuration', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Auditable', {
      retentionDays: 365,
      requireTransitionReason: true,
      trackActorId: true,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects negative retention days', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Auditable', {
      retentionDays: -1,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
