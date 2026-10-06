import { describe, expect, it } from 'vitest';
import { createSemanticCatalog, createSemanticProtocol } from '@/system_protocols/Semantic Protocol — v3.2.0.js';

const collectIssues = (validation: { results: Array<{ issues?: Array<{ p: string }> }> }) =>
  validation.results.flatMap(result => result.issues || []);

describe('Semantic Protocol v3.2.0', () => {
  it('self-enriches intent, criticality, confidence, and semantic vectors', () => {
    const protocol = createSemanticProtocol({
      id: 'checkout.primary-button',
      element: { type: 'ui.button' },
      semantics: { purpose: 'Submit checkout form' },
      context: { domain: 'commerce', flow: 'checkout', step: 'review' },
      governance: { businessImpact: 8, userVisibility: 0.7, owner: 'design-systems' },
      metadata: { description: 'Primary action button for checkout submission' }
    });

    const manifest = protocol.manifest();

    expect(manifest.version).toBe('3.2.0');
    expect(manifest.element.intent).toBe('Create');
    expect(manifest.element.criticality).toBeGreaterThan(0);
    expect(manifest.semantics.precision.confidence).toBeGreaterThan(0.4);

    const vector: number[] = manifest.semantics.features.vector;
    expect(vector).toHaveLength(64);
    expect(vector.some(value => value > 0)).toBe(true);
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('builds semantic vectors that drive catalog relationship discovery', () => {
    const checkout = createSemanticProtocol({
      id: 'checkout.form',
      element: { type: 'ui.form' },
      semantics: { purpose: 'Collect checkout payment details' },
      metadata: { description: 'Captures billing address and payment instrument' }
    });

    const checkoutVariant = createSemanticProtocol({
      id: 'checkout.form.variant',
      element: { type: 'ui.form' },
      semantics: { purpose: 'Collect checkout billing details and submit payment' },
      metadata: { description: 'Handles billing and payment capture' }
    });

    const auditLog = createSemanticProtocol({
      id: 'audit.logger',
      element: { type: 'service.logger' },
      semantics: { purpose: 'Emit audit events for compliance' },
      metadata: { description: 'Writes immutable audit records' }
    });

    const catalog = createSemanticCatalog([checkout, checkoutVariant, auditLog]);
    const relationships = catalog.discoverRelationships(0.35);

    const checkoutUrn = checkout.manifest().urn;
    const checkoutVariantUrn = checkoutVariant.manifest().urn;
    const auditUrn = auditLog.manifest().urn;

    const checkoutRelationship = relationships.some(
      relationship =>
        (relationship.from === checkoutUrn && relationship.to === checkoutVariantUrn) ||
        (relationship.from === checkoutVariantUrn && relationship.to === checkoutUrn)
    );

    expect(checkoutRelationship).toBe(true);
    expect(relationships.every(rel => rel.similarity >= 0 && rel.similarity <= 1)).toBe(true);
    expect(relationships.filter(rel => rel.from === auditUrn || rel.to === auditUrn)).toHaveLength(0);
  });

  it('validates protocol bindings and normalizes requires/provides contracts', () => {
    const protocol = createSemanticProtocol({
      id: 'checkout.api',
      element: { type: 'api.endpoint' },
      context: {
        protocolBindings: {
          api: [
            {
              urn: 'urn:proto:api.endpoint:checkout.submit@1.0.0',
              requires: 'urn:proto:data:cart@1.0.0',
              provides: ['urn:proto:event:checkout.completed@1.0.0']
            },
            {
              urn: 'not-a-urn',
              requires: ['urn:proto:data:cart@1.0.0', 'invalid-binding'],
              provides: 'invalid-provide'
            }
          ]
        }
      }
    });

    const manifest = protocol.manifest();
    expect(manifest.context.protocolBindings.api[0].requires).toEqual(['urn:proto:data:cart@1.0.0']);
    expect(manifest.context.protocolBindings.api[0].provides).toEqual([
      'urn:proto:event:checkout.completed@1.0.0'
    ]);

    const validation = protocol.validate();
    const issues = collectIssues(validation);

    expect(validation.ok).toBe(false);
    expect(issues.some(issue => issue.p === 'bindings.api[1]')).toBe(true);
    expect(issues.some(issue => issue.p === 'bindings.api[1].requires[1]')).toBe(true);
    expect(issues.some(issue => issue.p === 'bindings.api[1].provides[0]')).toBe(true);

    const validBinding = createSemanticProtocol({
      id: 'checkout.api.valid',
      element: { type: 'api.endpoint' },
      context: {
        protocolBindings: {
          api: [
            {
              urn: 'urn:proto:api.endpoint:checkout.submit@1.0.0',
              requires: ['urn:proto:data:cart@1.0.0'],
              provides: ['urn:proto:event:checkout.completed@1.0.0']
            }
          ]
        }
      }
    });

    expect(validBinding.validate().ok).toBe(true);
  });
});
