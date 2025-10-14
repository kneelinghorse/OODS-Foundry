import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseObjectDefinition,
  parseObjectDefinitionFromFile,
} from '../../src/parsers/object-parser.ts';

describe('Object Definition Parser', () => {
  it('parses a fully featured object definition with parameters and resolutions', () => {
    const yaml = `
object:
  name: Subscription
  version: 1.2.0
  extends:
    name: BaseRecord
    version: 2.1.0
traits:
  - name: Stateful
    alias: Lifecycle
    version: 1.0.0
    parameters:
      states:
        - trialing
        - active
        - past_due
        - canceled
      trackHistory: true
  - Timestamped
schema:
  plan_id: string
  quantity:
    type: number
  status_label: string?
semantics:
  plan_id:
    semantic_type: plan_reference
tokens:
  subscription.primary: "#111827"
annotations:
  draft: true
resolutions:
  fields:
    status:
      use: Lifecycle
      alias:
        Timestamped: updated_status
    quantity:
      keep: object
views:
  detail:
    - action: replace
      id: subscriptionStatus
      component: SubscriptionStatus
      priority: 50
metadata:
  owners:
    - ops@acme.test
  changelog:
    - version: "1.2.0"
      description: Added status badge
actions:
  - name: cancel
    label: Cancel Subscription
    confirmation: true
`;

    const result = parseObjectDefinition(yaml, 'subscription.object.yaml');

    expect(result.success).toBe(true);
    const definition = result.data!;

    expect(definition.object.name).toBe('Subscription');
    expect(definition.object.version).toBe('1.2.0');
    expect(definition.object.extends?.name).toBe('BaseRecord');
    expect(definition.object.extends?.version).toBe('2.1.0');

    expect(definition.traits).toHaveLength(2);
    expect(definition.traits[0].name).toBe('Stateful');
    expect(definition.traits[0].alias).toBe('Lifecycle');
    expect(definition.traits[0].parameters?.trackHistory).toBe(true);
    expect(Array.isArray(definition.traits[0].parameters?.states)).toBe(true);
    expect(definition.traits[1].name).toBe('Timestamped');

    expect(definition.schema?.plan_id?.type).toBe('string');
    expect(definition.schema?.plan_id?.required).toBe(true);
    expect(definition.schema?.status_label?.required).toBe(false);

    expect(definition.semantics?.plan_id?.semantic_type).toBe('plan_reference');
    expect(definition.tokens?.['subscription.primary']).toBe('#111827');
    expect(definition.annotations?.draft).toBe(true);

    const fieldResolutions = definition.resolutions?.fields;
    expect(fieldResolutions?.status?.strategy).toBe('use_trait');
    expect(fieldResolutions?.status?.trait).toBe('Lifecycle');
    expect(fieldResolutions?.quantity?.strategy).toBe('use_object');

    const detailOverrides = definition.views?.detail ?? [];
    expect(detailOverrides).toHaveLength(1);
    expect(detailOverrides[0].component).toBe('SubscriptionStatus');
    expect(detailOverrides[0].action).toBe('replace');

    expect(definition.metadata?.owners?.[0]).toBe('ops@acme.test');
    expect(definition.actions).toHaveLength(1);
    expect(definition.actions?.[0].name).toBe('cancel');
  });

  it('flags schema conflicts when trait resolution prefers the trait field', () => {
    const yaml = `
object:
  name: Product
  version: 0.1.0
traits:
  - name: Sellable
schema:
  sku: string
resolutions:
  fields:
    sku: Sellable
`;

    const result = parseObjectDefinition(yaml, 'product.object.yaml');

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    const conflict = result.errors?.find((error) => error.code === 'CONFLICTING_FIELD_DEFINITION');
    expect(conflict).toBeDefined();
    expect(conflict?.field).toBe('schema.sku');
    expect(conflict?.line).toBeGreaterThan(0);
  });

  it('reports structural validation errors with field paths', () => {
    const yaml = `
object:
  name: ""
traits:
  - {}
`;

    const result = parseObjectDefinition(yaml, 'invalid.object.yaml');

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    const fields = result.errors?.map((error) => error.field);
    expect(fields).toContain('object.name');
    expect(fields).toContain('traits[0].name');
    result.errors?.forEach((error) => {
      expect(error.line).toBeGreaterThan(0);
    });
  });

  it('supports file-based parsing and resolution shorthands', () => {
    const dir = mkdtempSync(join(tmpdir(), 'object-parser-'));
    const filePath = join(dir, 'inventory.object.yaml');

    const yaml = `
object:
  name: InventoryItem
traits:
  - name: InventoryTracked
    when: env == "prod"
schema:
  sku: string
  stock_level: number
resolutions:
  fields:
    discount: merge
    stock_level: object
views:
  list:
    action: add
    component: StockBadge
`;

    writeFileSync(filePath, yaml, 'utf8');

    try {
      const result = parseObjectDefinitionFromFile(filePath);
      expect(result.success).toBe(true);
      const definition = result.data!;
      expect(definition.resolutions?.fields?.discount?.strategy).toBe('merge');
      expect(definition.resolutions?.fields?.stock_level?.strategy).toBe('use_object');
      const listOverrides = definition.views?.list ?? [];
      expect(listOverrides).toHaveLength(1);
      expect(listOverrides[0].component).toBe('StockBadge');
      expect(listOverrides[0].action).toBe('add');
      expect(definition.traits[0].mount?.when).toBe('env == "prod"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surfaces duplicate trait aliases and invalid view overrides', () => {
    const yaml = `
object:
  name: InvalidViews
traits:
  - name: Stateful
    alias: Lifecycle
  - name: Billable
    alias: Lifecycle
views:
  detail: 'bad data'
`;

    const result = parseObjectDefinition(yaml, 'invalid-view.object.yaml');

    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.code === 'DUPLICATE_ALIAS')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'views.detail')).toBe(true);
  });

  it('handles file read failures and non-object YAML roots', () => {
    const missing = parseObjectDefinitionFromFile('/tmp/does-not-exist.object.yaml');
    expect(missing.success).toBe(false);
    expect(missing.errors?.[0].code).toBe('FILE_READ_ERROR');

    const invalidRoot = parseObjectDefinition('42', 'scalar-root.object.yaml');
    expect(invalidRoot.success).toBe(false);
    expect(invalidRoot.errors?.[0].code).toBe('INVALID_ROOT');

    const invalidYaml = parseObjectDefinition(
      'object:\n  name: Broken\n  tags: [one, two',
      'broken.object.yaml'
    );
    expect(invalidYaml.success).toBe(false);
    expect(invalidYaml.errors?.[0].code).toBe('YAML_PARSE_ERROR');
  });

  it('validates structural types across all sections', () => {
    const yaml = `
object: []
traits: 123
schema: []
resolutions: oops
views: wrong
semantics: []
tokens: []
actions: {}
`;

    const result = parseObjectDefinition(yaml, 'invalid-structures.object.yaml');
    expect(result.success).toBe(false);
    const codes = new Set(result.errors?.map((error) => error.code));
    expect(codes.has('INVALID_FIELD_TYPE')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'object')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'traits')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'schema')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'resolutions')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'views')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'semantics')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'tokens')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'actions')).toBe(true);
  });

  it('requires an object block at the root', () => {
    const result = parseObjectDefinition('traits: []', 'missing-object.object.yaml');
    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'object')).toBe(true);
  });

  it('rejects malformed schema field declarations', () => {
    const yaml = `
object:
  name: SchemaEdgeCases
traits:
  - name: Timestamped
schema:
  invalid_array: []
  wrong_type:
    type: 123
`;

    const result = parseObjectDefinition(yaml, 'bad-schema-fields.object.yaml');
    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'schema.invalid_array')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'schema.wrong_type.type')).toBe(true);
  });

  it('reports granular errors for invalid trait and schema entries', () => {
    const yaml = `
object:
  name: Sample
  extends: 42
traits:
  - ''
  - 123
  - name: BrokenTrait
    parameters: 42
    params: []
schema:
  empty: ''
  missing_type: {}
resolutions:
  fields: []
  semantics: []
  tokens: []
`;

    const result = parseObjectDefinition(yaml, 'invalid-trait-schema.object.yaml');
    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'object.extends')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'traits[0]')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'traits[1]')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'traits[2].parameters')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'schema.empty')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'resolutions.fields')).toBe(true);
  });

  it('detects schema fields missing required type metadata', () => {
    const yaml = `
object:
  name: Minimal
traits:
  - name: Timestamped
schema:
  missing_type: {}
`;

    const result = parseObjectDefinition(yaml, 'missing-type.object.yaml');
    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'schema.missing_type.type')).toBe(true);
  });

  it('normalizes string-based extends metadata', () => {
    const yaml = `
object:
  name: Extended
  extends: BaseEntity
traits:
  - name: Timestamped
schema:
  id: string
`;

    const result = parseObjectDefinition(yaml, 'string-extends.object.yaml');
    expect(result.success).toBe(true);
    expect(result.data?.object.extends?.name).toBe('BaseEntity');
  });

  it('normalizes advanced resolution metadata and trait parameter shapes', () => {
    const yaml = `
object:
  name: AnalyticsCard
traits:
  - name: Insightful
    alias: Insights
    parameters:
      thresholds:
        - label: high
          value: 90
      enabled: true
      sequence: [1, 2, 3]
      flags: [true, false]
    mount: detail
    extra_info: captured
schema:
  score:
    type: number
    required: 'false'
resolutions:
  fields:
    score:
      strategy: merge
      trait: Insights
      alias:
        Base: base_score
      rename:
        Insightful: insights_score
      notes: Merge analytics signals
      mergeStrategy: deep
      extraFlag: true
  metadata:
    enforcedBy: analytics-team
views:
  detail:
    - action: augment
      component: ScoreCard
      props:
        variant: warning
      metadata:
        source: analytics
`;

    const result = parseObjectDefinition(yaml, 'analytics.object.yaml');
    expect(result.success).toBe(true);
    const definition = result.data!;

    expect(definition.traits[0].parameters?.thresholds).toBeDefined();
    expect(Array.isArray(definition.traits[0].parameters?.thresholds)).toBe(true);
    expect(definition.traits[0].parameters?.sequence).toEqual([1, 2, 3]);
    expect(definition.traits[0].parameters?.flags).toEqual([true, false]);
    expect(definition.traits[0].mount?.contexts).toEqual(['detail']);
    expect(definition.traits[0].annotations?.extra_info).toBe('captured');

    expect(definition.schema?.score?.required).toBe(false);

    const scoreResolution = definition.resolutions?.fields?.score;
    expect(scoreResolution?.strategy).toBe('merge');
    expect(scoreResolution?.alias?.Base).toBe('base_score');
    expect(scoreResolution?.rename?.Insightful).toBe('insights_score');
    expect(scoreResolution?.mergeStrategy).toBe('deep');
    expect(scoreResolution?.metadata?.extraFlag).toBe(true);
    expect(definition.resolutions?.metadata?.enforcedBy).toBe('analytics-team');

    const detailOverride = definition.views?.detail?.[0];
    expect(detailOverride?.props?.variant).toBe('warning');
    expect(detailOverride?.metadata?.source).toBe('analytics');
  });
});
