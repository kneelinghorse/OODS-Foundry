import { describe, it, expect } from 'vitest';
import { default as GeocodableTrait } from '../../../../traits/viz/spatial/geocodable.trait.js';
import { default as HasProjectionTrait } from '../../../../src/traits/viz/spatial/HasProjection.trait.js';
import { default as LayeredOverlayTrait } from '../../../../src/traits/viz/spatial/LayeredOverlay.trait.js';

describe('Spatial Trait Composition', () => {
  describe('Geocodable + HasProjection', () => {
    it('should compose without conflicts', () => {
      // Check that schema fields don't overlap
      const geocodableFields = Object.keys(GeocodableTrait.schema);
      const projectionFields = Object.keys(HasProjectionTrait.schema);

      const overlap = geocodableFields.filter((field) => projectionFields.includes(field));

      expect(overlap).toHaveLength(0);
    });

    it('should have compatible trait categories', () => {
      expect(GeocodableTrait.trait.category).toBe('viz.spatial');
      expect(HasProjectionTrait.trait.category).toBe('viz.spatial');
    });

    it('should have no conflicting dependencies', () => {
      const geocodableDeps = GeocodableTrait.dependencies || [];
      const projectionDeps = HasProjectionTrait.dependencies || [];

      // Both should have empty dependencies or non-conflicting ones
      expect(geocodableDeps).toBeDefined();
      expect(projectionDeps).toBeDefined();
    });

    it('should have distinct output properties', () => {
      const geocodableOutputs = Object.keys(GeocodableTrait.outputs || {});
      const projectionOutputs = Object.keys(HasProjectionTrait.outputs || {});

      const overlap = geocodableOutputs.filter((output) => projectionOutputs.includes(output));

      expect(overlap).toHaveLength(0);
    });
  });

  describe('Geocodable + HasProjection + LayeredOverlay', () => {
    it('should compose all three traits without conflicts', () => {
      const geocodableFields = Object.keys(GeocodableTrait.schema);
      const projectionFields = Object.keys(HasProjectionTrait.schema);
      const overlayFields = Object.keys(LayeredOverlayTrait.schema);

      // Check for any field name collisions
      const allFields = [...geocodableFields, ...projectionFields, ...overlayFields];
      const uniqueFields = new Set(allFields);

      expect(allFields.length).toBe(uniqueFields.size);
    });

    it('should all belong to viz.spatial category', () => {
      expect(GeocodableTrait.trait.category).toBe('viz.spatial');
      expect(HasProjectionTrait.trait.category).toBe('viz.spatial');
      expect(LayeredOverlayTrait.trait.category).toBe('viz.spatial');
    });

    it('should have no conflicting dependencies', () => {
      const geocodableDeps = GeocodableTrait.dependencies || [];
      const projectionDeps = HasProjectionTrait.dependencies || [];
      const overlayDeps = LayeredOverlayTrait.dependencies || [];

      // All should have empty dependencies
      expect(geocodableDeps).toHaveLength(0);
      expect(projectionDeps).toHaveLength(0);
      expect(overlayDeps).toHaveLength(0);
    });

    it('should have distinct output properties across all traits', () => {
      const geocodableOutputs = Object.keys(GeocodableTrait.outputs || {});
      const projectionOutputs = Object.keys(HasProjectionTrait.outputs || {});
      const overlayOutputs = Object.keys(LayeredOverlayTrait.outputs || {});

      const allOutputs = [...geocodableOutputs, ...projectionOutputs, ...overlayOutputs];
      const uniqueOutputs = new Set(allOutputs);

      expect(allOutputs.length).toBe(uniqueOutputs.size);
    });

    it('should have compatible view extensions', () => {
      // Check that view extensions don't conflict
      const geocodableExtensions = GeocodableTrait.view_extensions || {};
      const projectionExtensions = HasProjectionTrait.view_extensions || {};
      const overlayExtensions = LayeredOverlayTrait.view_extensions || {};

      // All should define extensions for detail, form, and list contexts
      expect(geocodableExtensions.detail).toBeDefined();
      expect(projectionExtensions.detail).toBeDefined();
      expect(overlayExtensions.detail).toBeDefined();

      expect(geocodableExtensions.form).toBeDefined();
      expect(projectionExtensions.form).toBeDefined();
      expect(overlayExtensions.form).toBeDefined();

      expect(geocodableExtensions.list).toBeDefined();
      expect(projectionExtensions.list).toBeDefined();
      expect(overlayExtensions.list).toBeDefined();
    });

    it('should have distinct priority values in view extensions', () => {
      const geocodableDetail = GeocodableTrait.view_extensions?.detail || [];
      const projectionDetail = HasProjectionTrait.view_extensions?.detail || [];
      const overlayDetail = LayeredOverlayTrait.view_extensions?.detail || [];

      const geocodablePriority = geocodableDetail[0]?.priority ?? 0;
      const projectionPriority = projectionDetail[0]?.priority ?? 0;
      const overlayPriority = overlayDetail[0]?.priority ?? 0;

      // Priorities should be distinct to avoid rendering conflicts
      expect(geocodablePriority).not.toBe(projectionPriority);
      expect(geocodablePriority).not.toBe(overlayPriority);
      expect(projectionPriority).not.toBe(overlayPriority);
    });

    it('should have compatible token namespaces', () => {
      const geocodableTokens = Object.keys(GeocodableTrait.tokens || {});
      const projectionTokens = Object.keys(HasProjectionTrait.tokens || {});
      const overlayTokens = Object.keys(LayeredOverlayTrait.tokens || {});

      // All tokens should have distinct names
      const allTokens = [...geocodableTokens, ...projectionTokens, ...overlayTokens];
      const uniqueTokens = new Set(allTokens);

      expect(allTokens.length).toBe(uniqueTokens.size);
    });

    it('should all have spatial tags', () => {
      expect(GeocodableTrait.trait.tags).toContain('spatial');
      expect(HasProjectionTrait.trait.tags).toContain('spatial');
      expect(LayeredOverlayTrait.trait.tags).toContain('spatial');
    });

    it('should have compatible metadata', () => {
      const geocodableMetadata = GeocodableTrait.metadata || {};
      const projectionMetadata = HasProjectionTrait.metadata || {};
      const overlayMetadata = LayeredOverlayTrait.metadata || {};

      // All should have same maturity level
      expect(geocodableMetadata.maturity).toBe('alpha');
      expect(projectionMetadata.maturity).toBe('alpha');
      expect(overlayMetadata.maturity).toBe('alpha');

      // All should have no conflicts
      expect(geocodableMetadata.conflicts_with).toHaveLength(0);
      expect(projectionMetadata.conflicts_with).toHaveLength(0);
      expect(overlayMetadata.conflicts_with).toHaveLength(0);
    });
  });

  describe('Trait registration compatibility', () => {
    it('should have unique trait IDs', () => {
      // Trait IDs should be unique
      const geocodableId = `${GeocodableTrait.trait.category}.${GeocodableTrait.trait.name}`;
      const projectionId = `${HasProjectionTrait.trait.category}.${HasProjectionTrait.trait.name}`;
      const overlayId = `${LayeredOverlayTrait.trait.category}.${LayeredOverlayTrait.trait.name}`;

      expect(geocodableId).not.toBe(projectionId);
      expect(geocodableId).not.toBe(overlayId);
      expect(projectionId).not.toBe(overlayId);
    });

    it('should have compatible versions', () => {
      // All should be version 1.0.0
      expect(GeocodableTrait.trait.version).toBe('1.0.0');
      expect(HasProjectionTrait.trait.version).toBe('1.0.0');
      expect(LayeredOverlayTrait.trait.version).toBe('1.0.0');
    });
  });
});

