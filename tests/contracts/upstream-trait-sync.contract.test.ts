/**
 * Contract tests for Sprint 54 — Upstream Trait Sync (s54-m05).
 *
 * Verifies that enriched/new upstream traits are correctly exposed through MCP
 * tools after structured data refresh. Four contract groups:
 *   1. Taggable v2 params visible in catalog
 *   2. Colorized v2 tones reflected in validation
 *   3. New traits (Auditable, Statusable) discoverable
 *   4. Versioned structured data returns updated trait metadata
 */
import { describe, it, expect } from 'vitest';
import { handle as catalogHandle } from '../../packages/mcp-server/src/tools/catalog.list.js';
import {
  handle as structuredDataHandle,
  listAvailableVersions,
} from '../../packages/mcp-server/src/tools/structuredData.fetch.js';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';

/* ------------------------------------------------------------------ */
/*  Contract 1: Taggable v2 params visible in catalog                  */
/* ------------------------------------------------------------------ */

describe('contract: Taggable v2 enriched params visible in catalog', () => {
  it('catalog.list returns components with Taggable trait', async () => {
    const result = await catalogHandle({ trait: 'Taggable' });

    expect(result.totalCount).toBeGreaterThan(0);
    for (const component of result.components) {
      expect(component.traits).toContain('Taggable');
    }
  });

  it('Taggable v2 accepts tagMinLength parameter', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Taggable', {
      maxTags: 15,
      tagMinLength: 3,
      allowCustomTags: true,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('Taggable v2 accepts synonymResolution parameter', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Taggable', {
      maxTags: 10,
      synonymResolution: 'suggest',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('Taggable v2 rejects tagMinLength below minimum', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Taggable', {
      tagMinLength: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Contract 2: Colorized v2 tones reflected in validation             */
/* ------------------------------------------------------------------ */

describe('contract: Colorized v2 tones reflected in validation', () => {
  it('accepts the v2 canonical tone set including accent and critical', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'info', 'accent', 'success', 'warning', 'critical'],
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('accepts contrastLevel parameter (AA/AAA)', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'success'],
      contrastLevel: 'AAA',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('accepts colorMode parameter', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'info'],
      colorMode: 'semantic',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects legacy "danger" tone (renamed to "critical" in v2)', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'danger'],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects invalid contrastLevel value', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral'],
      contrastLevel: 'AAAA',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Contract 3: New traits (Auditable, Statusable) discoverable        */
/* ------------------------------------------------------------------ */

describe('contract: new traits Auditable and Statusable discoverable', () => {
  it('structuredData.fetch components dataset includes Auditable trait', async () => {
    const result = await structuredDataHandle({
      dataset: 'components',
      includePayload: true,
    });

    expect(result.schemaValidated).toBe(true);
    expect(result.payloadIncluded).toBe(true);

    const payload = result.payload as Record<string, any>;
    const traits: any[] = payload.traits ?? [];
    const auditableTrait = traits.find(
      (t: any) => t.name === 'Auditable' || t.trait === 'Auditable',
    );

    expect(auditableTrait).toBeDefined();
  });

  it('structuredData.fetch components dataset includes Statusable trait', async () => {
    const result = await structuredDataHandle({
      dataset: 'components',
      includePayload: true,
    });

    expect(result.schemaValidated).toBe(true);

    const payload = result.payload as Record<string, any>;
    const traits: any[] = payload.traits ?? [];
    const statusableTrait = traits.find(
      (t: any) => t.name === 'Statusable' || t.trait === 'Statusable',
    );

    expect(statusableTrait).toBeDefined();
  });

  it('structuredData.fetch tokens dataset includes Auditable overlay tokens', async () => {
    const result = await structuredDataHandle({
      dataset: 'tokens',
      includePayload: true,
    });

    expect(result.schemaValidated).toBe(true);

    const payload = result.payload as Record<string, any>;
    const overlays: any[] = payload.traitOverlays ?? [];
    const auditableOverlay = overlays.find((o: any) => o.trait === 'Auditable');

    expect(auditableOverlay).toBeDefined();
    expect(auditableOverlay.tokens).toHaveProperty('cmp.audit.timeline.connector.color');
    expect(auditableOverlay.tokens).toHaveProperty('cmp.audit.entry.bg');
  });

  it('structuredData.fetch tokens dataset includes Statusable overlay tokens', async () => {
    const result = await structuredDataHandle({
      dataset: 'tokens',
      includePayload: true,
    });

    expect(result.schemaValidated).toBe(true);

    const payload = result.payload as Record<string, any>;
    const overlays: any[] = payload.traitOverlays ?? [];
    const statusableOverlay = overlays.find((o: any) => o.trait === 'Statusable');

    expect(statusableOverlay).toBeDefined();
    expect(statusableOverlay.tokens).toHaveProperty('cmp.status.neutral.surface');
    expect(statusableOverlay.tokens).toHaveProperty('cmp.status.critical.text');
    expect(statusableOverlay.tokens).toHaveProperty('cmp.banner.background');
  });

  it('Auditable parameter validation works end-to-end', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Auditable', {
      retentionDays: 90,
      requireTransitionReason: true,
      trackActorId: true,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('Statusable parameter validation works end-to-end', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Statusable', {
      domains: ['subscription', 'invoice'],
      defaultTone: 'info',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Contract 4: Versioned structured data returns updated metadata     */
/* ------------------------------------------------------------------ */

describe('contract: versioned structured data returns updated trait metadata', () => {
  it('listAvailableVersions includes the latest refresh date', () => {
    const versions = listAvailableVersions('components');

    expect(versions.length).toBeGreaterThan(0);
    // The latest version should be the one from our refresh
    const latest = versions[versions.length - 1];
    expect(latest).toBeDefined();
    // Dates are YYYY-MM-DD format
    expect(latest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('latest versioned components snapshot contains updated trait count', async () => {
    const versions = listAvailableVersions('components');
    const latest = versions[versions.length - 1];

    const result = await structuredDataHandle({
      dataset: 'components',
      version: latest,
      includePayload: true,
    });

    expect(result.schemaValidated).toBe(true);

    const payload = result.payload as Record<string, any>;
    const traits: any[] = payload.traits ?? [];

    // Sprint 54 added Auditable + Statusable → total should be >= 37
    expect(traits.length).toBeGreaterThanOrEqual(37);
  });

  it('versioned tokens snapshot validates against schema', async () => {
    const versions = listAvailableVersions('tokens');
    const latest = versions[versions.length - 1];

    const result = await structuredDataHandle({
      dataset: 'tokens',
      version: latest,
    });

    expect(result.schemaValidated).toBe(true);
    expect(result.validationErrors).toBeUndefined();
  });

  it('structuredData.fetch manifest reflects the latest version', async () => {
    const result = await structuredDataHandle({
      dataset: 'manifest',
      includePayload: true,
    });

    expect(result.payloadIncluded).toBe(true);

    const payload = result.payload as Record<string, any>;
    expect(payload.version).toBeDefined();
    expect(payload.artifacts).toBeDefined();
    expect(payload.artifacts.length).toBeGreaterThanOrEqual(2);

    // Components and tokens artifacts should exist
    const componentArtifact = payload.artifacts.find((a: any) => a.name === 'components');
    const tokenArtifact = payload.artifacts.find((a: any) => a.name === 'tokens');
    expect(componentArtifact).toBeDefined();
    expect(tokenArtifact).toBeDefined();
    expect(componentArtifact.etag).toBeTruthy();
    expect(tokenArtifact.etag).toBeTruthy();
  });

  it('ifNoneMatch returns matched=true for current etag', async () => {
    // First fetch to get the etag
    const first = await structuredDataHandle({
      dataset: 'components',
      includePayload: false,
    });

    expect(first.etag).toBeTruthy();

    // Second fetch with etag
    const second = await structuredDataHandle({
      dataset: 'components',
      ifNoneMatch: first.etag,
      includePayload: true,
    });

    expect(second.matched).toBe(true);
    expect(second.payloadIncluded).toBe(false);
  });
});
