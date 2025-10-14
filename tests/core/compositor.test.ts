/**
 * Tests for Trait Compositor
 *
 * Tests the core composition logic including:
 * - Basic composition
 * - Collision resolution
 * - Dependency ordering
 * - State machine handling
 * - Provenance tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraitCompositor, composeTraits } from '../../src/core/compositor.js';
import type { TraitDefinition } from '../../src/core/trait-definition.js';
import type { BaseObjectDefinition } from '../../src/core/compositor.js';

// Helper to create test traits
function createTrait(
  name: string,
  schema: Record<string, any> = {},
  dependencies: string[] = []
): TraitDefinition {
  return {
    trait: {
      name,
      version: '1.0.0',
    },
    schema,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
  };
}

describe('TraitCompositor', () => {
  let compositor: TraitCompositor;

  beforeEach(() => {
    compositor = new TraitCompositor();
  });

  describe('Basic Composition', () => {
    it('should compose a single trait', () => {
      const trait = createTrait('Timestamped', {
        created_at: { type: 'timestamp', required: true },
        updated_at: { type: 'timestamp', required: true },
      });

      const result = compositor.compose([trait]);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.schema).toHaveProperty('created_at');
      expect(result.data!.schema).toHaveProperty('updated_at');
      expect(result.data!.metadata.traitCount).toBe(1);
    });

    it('should compose multiple independent traits', () => {
      const trait1 = createTrait('Timestamped', {
        created_at: { type: 'timestamp', required: true },
        updated_at: { type: 'timestamp', required: true },
      });

      const trait2 = createTrait('Taggable', {
        tags: { type: 'array', required: false },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.schema).toHaveProperty('created_at');
      expect(result.data!.schema).toHaveProperty('updated_at');
      expect(result.data!.schema).toHaveProperty('tags');
      expect(result.data!.metadata.traitCount).toBe(2);
    });

    it('should compose traits with dependencies in correct order', () => {
      const baseTrait = createTrait('Base', {
        id: { type: 'uuid', required: true },
      });

      const dependentTrait = createTrait(
        'Dependent',
        {
          name: { type: 'string', required: true },
        },
        ['Base']
      );

      const result = compositor.compose([dependentTrait, baseTrait]);

      expect(result.success).toBe(true);
      expect(result.data!.metadata.traitOrder).toEqual(['Base', 'Dependent']);
    });
  });

  describe('Collision Resolution', () => {
    it('should resolve same-type collisions by preferring stricter constraints', () => {
      const trait1 = createTrait('Trait1', {
        name: {
          type: 'string',
          required: false,
          validation: { minLength: 1 },
        },
      });

      const trait2 = createTrait('Trait2', {
        name: {
          type: 'string',
          required: true,
          validation: { minLength: 5 },
        },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.schema.name.required).toBe(true); // Required wins
      expect(result.data!.schema.name.validation?.minLength).toBe(5); // Stricter wins
      expect(result.data!.metadata.collisions.length).toBeGreaterThan(0);
    });

    it('should union enum values when both fields are enums', () => {
      const trait1 = createTrait('Trait1', {
        status: {
          type: 'string',
          validation: { enum: ['active', 'inactive'] },
        },
      });

      const trait2 = createTrait('Trait2', {
        status: {
          type: 'string',
          validation: { enum: ['pending', 'active'] },
        },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      const enumValues = result.data!.schema.status.validation?.enum;
      expect(enumValues).toEqual(
        expect.arrayContaining(['active', 'inactive', 'pending'])
      );
      expect(enumValues).toHaveLength(3); // Deduplicated
    });

    it('should throw error on type mismatch', () => {
      const trait1 = createTrait('Trait1', {
        age: { type: 'string' },
      });

      const trait2 = createTrait('Trait2', {
        age: { type: 'number' },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Type mismatch');
    });

    it('should apply manual collision resolutions', () => {
      const trait1 = createTrait('Trait1', {
        color: { type: 'string', default: 'red' },
      });

      const trait2 = createTrait('Trait2', {
        color: { type: 'string', default: 'blue' },
      });

      const compositorWithResolution = new TraitCompositor({
        collisionResolutions: {
          color: {
            strategy: 'prefer_trait',
            traitName: 'Trait2',
          },
        },
      });

      const result = compositorWithResolution.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.schema.color.default).toBe('blue');
    });
  });

  describe('Schema Merging', () => {
    it('should merge schemas from base object and traits', () => {
      const baseObject: BaseObjectDefinition = {
        id: 'test-object',
        name: 'Test Object',
        schema: {
          id: { type: 'uuid', required: true },
        },
      };

      const trait = createTrait('Timestamped', {
        created_at: { type: 'timestamp', required: true },
      });

      const result = compositor.compose([trait], baseObject);

      expect(result.success).toBe(true);
      expect(result.data!.schema).toHaveProperty('id');
      expect(result.data!.schema).toHaveProperty('created_at');
    });
  });

  describe('Semantics Merging', () => {
    it('should merge semantic mappings', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: { status: { type: 'string' } },
        semantics: {
          status: {
            semantic_type: 'status_enum',
            ui_hints: { component: 'Badge' },
          },
        },
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: { priority: { type: 'number' } },
        semantics: {
          priority: {
            semantic_type: 'priority_level',
            ui_hints: { component: 'PriorityIndicator' },
          },
        },
      };

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.semantics).toHaveProperty('status');
      expect(result.data!.semantics).toHaveProperty('priority');
    });
  });

  describe('View Extensions', () => {
    it('should merge view extensions by context', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
        view_extensions: {
          list: [
            {
              component: 'StatusBadge',
              position: 'top',
              priority: 10,
            },
          ],
        },
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: {},
        view_extensions: {
          list: [
            {
              component: 'ActionButtons',
              position: 'bottom',
              priority: 20,
            },
          ],
        },
      };

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.viewExtensions.list).toHaveLength(2);
      // Should be sorted by priority
      expect(result.data!.viewExtensions.list![0].component).toBe('StatusBadge');
      expect(result.data!.viewExtensions.list![1].component).toBe('ActionButtons');
    });
  });

  describe('Tokens', () => {
    it('should merge tokens from multiple traits', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
        tokens: {
          'primary-color': '#007bff',
          'spacing-sm': '0.5rem',
        },
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: {},
        tokens: {
          'secondary-color': '#6c757d',
        },
      };

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.tokens).toHaveProperty('primary-color');
      expect(result.data!.tokens).toHaveProperty('secondary-color');
      expect(result.data!.tokens).toHaveProperty('spacing-sm');
    });
  });

  describe('Actions', () => {
    it('should merge actions from multiple traits', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
        actions: [
          {
            name: 'edit',
            label: 'Edit',
            icon: 'pencil',
          },
        ],
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: {},
        actions: [
          {
            name: 'delete',
            label: 'Delete',
            icon: 'trash',
            confirmation: true,
          },
        ],
      };

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.actions).toHaveLength(2);
      expect(result.data!.actions.map((a) => a.name)).toContain('edit');
      expect(result.data!.actions.map((a) => a.name)).toContain('delete');
    });
  });

  describe('State Machine', () => {
    it('should include state machine from trait', () => {
      const trait: TraitDefinition = {
        trait: { name: 'Stateful', version: '1.0.0' },
        schema: { status: { type: 'string' } },
        state_machine: {
          states: ['draft', 'active', 'archived'],
          initial: 'draft',
          transitions: [
            { from: 'draft', to: 'active' },
            { from: 'active', to: 'archived' },
          ],
        },
      };

      const result = compositor.compose([trait]);

      expect(result.success).toBe(true);
      expect(result.data!.stateMachine).toBeDefined();
      expect(result.data!.stateMachine!.ownerTrait).toBe('Stateful');
      expect(result.data!.stateMachine!.definition.states).toContain('draft');
    });

    it('should reject multiple state machines by default', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
        state_machine: {
          states: ['draft', 'published'],
          initial: 'draft',
          transitions: [],
        },
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: {},
        state_machine: {
          states: ['active', 'inactive'],
          initial: 'active',
          transitions: [],
        },
      };

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('multiple_state_machines');
    });

    it('should allow multiple state machines when configured', () => {
      const trait1: TraitDefinition = {
        trait: { name: 'Trait1', version: '1.0.0' },
        schema: {},
        state_machine: {
          states: ['draft', 'published'],
          initial: 'draft',
          transitions: [],
        },
      };

      const trait2: TraitDefinition = {
        trait: { name: 'Trait2', version: '1.0.0' },
        schema: {},
        state_machine: {
          states: ['active', 'inactive'],
          initial: 'active',
          transitions: [],
        },
      };

      const compositorWithOption = new TraitCompositor({
        allowMultipleStateMachines: true,
      });

      const result = compositorWithOption.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      // Last state machine wins
      expect(result.data!.stateMachine!.ownerTrait).toBe('Trait2');
    });
  });

  describe('Provenance Tracking', () => {
    it('should track field provenance', () => {
      const trait1 = createTrait('Trait1', {
        field1: { type: 'string' },
      });

      const trait2 = createTrait('Trait2', {
        field2: { type: 'number' },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);
      expect(result.data!.metadata.provenance.size).toBeGreaterThan(0);

      const field1Prov = result.data!.metadata.provenance.get('field1');
      expect(field1Prov).toBeDefined();
      expect(field1Prov!.source).toBe('Trait1');
    });

    it('should track field overrides', () => {
      const trait1 = createTrait('Trait1', {
        shared: { type: 'string', required: false },
      });

      const trait2 = createTrait('Trait2', {
        shared: { type: 'string', required: true },
      });

      const result = compositor.compose([trait1, trait2]);

      expect(result.success).toBe(true);

      const sharedProv = result.data!.metadata.provenance.get('shared');
      expect(sharedProv).toBeDefined();
      expect(sharedProv!.overridden).toBe(true);
      expect(sharedProv!.source).toBe('Trait2');
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance when enabled', () => {
      const compositorWithPerf = new TraitCompositor({
        trackPerformance: true,
      });

      const trait = createTrait('Trait', {
        field: { type: 'string' },
      });

      const result = compositorWithPerf.compose([trait]);

      expect(result.success).toBe(true);
      expect(result.data!.metadata.performance).toBeDefined();
      expect(result.data!.metadata.performance!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Strict Mode', () => {
    it('should fail in strict mode with warnings', () => {
      const compositorStrict = new TraitCompositor({
        strictMode: true,
      });

      // Create traits with a field that has conflicting required status
      // This will generate a warning
      const trait1 = createTrait('Trait1', {
        field: {
          type: 'string',
          required: false,
        },
      });

      const trait2 = createTrait('Trait2', {
        field: {
          type: 'string',
          required: true,
        },
      });

      const result = compositorStrict.compose([trait1, trait2]);

      // Strict mode should fail if there are any warnings
      // (required status conflict generates warnings)
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('warnings in strict mode');
    });
  });

  describe('Convenience Function', () => {
    it('should compose traits using convenience function', () => {
      const trait = createTrait('Timestamped', {
        created_at: { type: 'timestamp' },
      });

      const result = composeTraits([trait]);

      expect(result.success).toBe(true);
      expect(result.data!.schema).toHaveProperty('created_at');
    });
  });

  describe('Report Generation', () => {
    it('should generate a composition report', () => {
      const trait1 = createTrait('Trait1', {
        field1: { type: 'string' },
      });

      const trait2 = createTrait('Trait2', {
        field2: { type: 'number' },
      });

      const result = compositor.compose([trait1, trait2]);
      expect(result.success).toBe(true);

      const report = compositor.generateReport(result.data!);

      expect(report).toContain('COMPOSITION REPORT');
      expect(report).toContain('Trait1');
      expect(report).toContain('Trait2');
      expect(report).toContain('field1');
      expect(report).toContain('field2');
    });
  });
});
