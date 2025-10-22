/**
 * Tests for Dependency Graph
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../src/core/dependency-graph.js';
import { TraitDefinition } from '../../src/core/trait-definition.js';
import { topologicalSort, validateAndSort } from '../../src/core/topological-sort.js';
import { DependencyValidator } from '../../src/core/dependency-validator.js';
import { generateMermaidDiagram, generateCycleDiagram } from '../../src/utils/graph-visualizer.js';

// Helper to create test traits
function createTrait(
  name: string,
  dependencies: string[] = [],
  conflicts: string[] = []
): TraitDefinition {
  return {
    trait: {
      name,
      version: '1.0.0',
    },
    schema: {
      testField: {
        type: 'string',
      },
    },
    dependencies: dependencies.map((dep) => ({ trait: dep })),
    metadata: {
      conflicts_with: conflicts,
    },
  };
}

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Basic Operations', () => {
    it('should add a trait to the graph', () => {
      const trait = createTrait('Timestamped');
      graph.addTrait(trait);

      expect(graph.hasTrait('Timestamped')).toBe(true);
      expect(graph.size()).toBe(1);
    });

    it('should add multiple traits', () => {
      graph.addTrait(createTrait('Timestamped'));
      graph.addTrait(createTrait('Versioned'));
      graph.addTrait(createTrait('Auditable'));

      expect(graph.size()).toBe(3);
    });

    it('should track dependencies', () => {
      graph.addTrait(createTrait('Timestamped'));
      graph.addTrait(createTrait('Auditable', ['Timestamped']));

      const deps = graph.getDependencies('Auditable');
      expect(deps).toContain('Timestamped');
    });

    it('should track dependents', () => {
      graph.addTrait(createTrait('Timestamped'));
      graph.addTrait(createTrait('Auditable', ['Timestamped']));

      const dependents = graph.getDependents('Timestamped');
      expect(dependents).toContain('Auditable');
    });

    it('should handle trait updates', () => {
      const trait1 = createTrait('Timestamped');
      graph.addTrait(trait1);

      const trait2 = createTrait('Timestamped', ['Versioned']);
      graph.addTrait(trait2);

      const deps = graph.getDependencies('Timestamped');
      expect(deps).toContain('Versioned');
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependency', () => {
      graph.addTrait(createTrait('A', ['B']));
      graph.addTrait(createTrait('B', ['A']));

      const result = graph.detectCircularDependencies();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].type).toBe('circular_dependency');
      expect(result.errors![0].cycle).toBeDefined();
    });

    it('should detect three-way circular dependency', () => {
      graph.addTrait(createTrait('A', ['B']));
      graph.addTrait(createTrait('B', ['C']));
      graph.addTrait(createTrait('C', ['A']));

      const result = graph.detectCircularDependencies();

      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('circular_dependency');
    });

    it('should detect self-loop', () => {
      graph.addTrait(createTrait('A', ['A']));

      const result = graph.detectCircularDependencies();

      expect(result.success).toBe(false);
      expect(result.errors![0].cycle).toContain('A');
    });

    it('should pass when no circular dependencies exist', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['B']));

      const result = graph.detectCircularDependencies();

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect multiple disjoint cycles and return all with full paths', () => {
      // Cycle 1: A -> B -> A
      const g = new DependencyGraph();
      g.addTrait(createTrait('A', ['B']));
      g.addTrait(createTrait('B', ['A']));

      // Cycle 2: C -> D -> E -> C
      g.addTrait(createTrait('C', ['D']));
      g.addTrait(createTrait('D', ['E']));
      g.addTrait(createTrait('E', ['C']));

      // Non-cyclic node
      g.addTrait(createTrait('F'));

      const result = g.detectCircularDependencies();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      const errors = result.errors!;

      // Expect at least 2 unique cycles
      const cycleErrors = errors.filter(e => e.type === 'circular_dependency');
      expect(cycleErrors.length).toBeGreaterThanOrEqual(2);

      // Verify cycles contain expected node sets
      const cycleStrs = cycleErrors.map(e => (e.cycle || []).join(','));
      const hasAB = cycleStrs.some(s => s.includes('A') && s.includes('B'));
      const hasCDE = cycleStrs.some(s => s.includes('C') && s.includes('D') && s.includes('E'));
      expect(hasAB).toBe(true);
      expect(hasCDE).toBe(true);
    });

    it('should handle disconnected graph', () => {
      graph.addTrait(createTrait('A', ['B']));
      graph.addTrait(createTrait('B'));
      graph.addTrait(createTrait('C', ['D']));
      graph.addTrait(createTrait('D'));

      const result = graph.detectCircularDependencies();

      expect(result.success).toBe(true);
    });
  });

  describe('Missing Dependencies', () => {
    it('should detect missing dependencies', () => {
      graph.addTrait(createTrait('A', ['B']));

      const result = graph.validateDependenciesExist();

      expect(result.success).toBe(false);
      expect(result.errors![0].type).toBe('missing_dependency');
      expect(result.errors![0].traits).toContain('A');
      expect(result.errors![0].traits).toContain('B');
    });

    it('should pass when all dependencies exist', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));

      const result = graph.validateDependenciesExist();

      expect(result.success).toBe(true);
    });
  });

  describe('Transitive Dependencies', () => {
    it('should compute transitive dependencies', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['B']));

      const deps = graph.getTransitiveDependencies('C');

      expect(deps.has('A')).toBe(true);
      expect(deps.has('B')).toBe(true);
      expect(deps.size).toBe(2);
    });

    it('should handle complex dependency chains', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B'));
      graph.addTrait(createTrait('C', ['A', 'B']));
      graph.addTrait(createTrait('D', ['C']));

      const deps = graph.getTransitiveDependencies('D');

      expect(deps.has('A')).toBe(true);
      expect(deps.has('B')).toBe(true);
      expect(deps.has('C')).toBe(true);
      expect(deps.size).toBe(3);
    });

    it('should return empty set for trait with no dependencies', () => {
      graph.addTrait(createTrait('A'));

      const deps = graph.getTransitiveDependencies('A');

      expect(deps.size).toBe(0);
    });
  });

  describe('Conflicts', () => {
    it('should track conflicts', () => {
      graph.addTrait(createTrait('A', [], ['B']));
      graph.addTrait(createTrait('B'));

      const conflicts = graph.getConflicts('A');

      expect(conflicts).toContain('B');
    });

    it('should detect conflict violations', () => {
      graph.addTrait(createTrait('A', [], ['B']));
      graph.addTrait(createTrait('B'));

      const validator = new DependencyValidator(graph);
      const result = validator.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.type === 'conflict')).toBe(true);
    });
  });
});

describe('Topological Sort', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Kahn\'s Algorithm', () => {
    it('should sort simple linear dependency chain', () => {
      graph.addTrait(createTrait('C', ['B']));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('A'));

      const result = topologicalSort(graph);

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();

      const order = result.order!;
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
    });

    it('should sort complex dependency graph', () => {
      // Create a diamond dependency
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['A']));
      graph.addTrait(createTrait('D', ['B', 'C']));

      const result = topologicalSort(graph);

      expect(result.success).toBe(true);

      const order = result.order!;
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    });

    it('should handle 10+ traits with complex dependencies', () => {
      // Create a complex graph
      const traits = [
        createTrait('Base'),
        createTrait('Timestamped', ['Base']),
        createTrait('Versioned', ['Base']),
        createTrait('Auditable', ['Timestamped']),
        createTrait('Searchable', ['Base']),
        createTrait('Taggable', ['Base']),
        createTrait('Categorizable', ['Taggable']),
        createTrait('Commentable', ['Timestamped', 'Auditable']),
        createTrait('Votable', ['Timestamped']),
        createTrait('Featured', ['Votable', 'Categorizable']),
        createTrait('Premium', ['Featured', 'Searchable']),
      ];

      for (const trait of traits) {
        graph.addTrait(trait);
      }

      const result = topologicalSort(graph);

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(11);

      // Verify dependency ordering
      const order = result.order!;
      expect(order.indexOf('Base')).toBeLessThan(order.indexOf('Timestamped'));
      expect(order.indexOf('Timestamped')).toBeLessThan(order.indexOf('Auditable'));
      expect(order.indexOf('Auditable')).toBeLessThan(order.indexOf('Commentable'));
      expect(order.indexOf('Featured')).toBeLessThan(order.indexOf('Premium'));
    });

    it('should fail on circular dependency', () => {
      graph.addTrait(createTrait('A', ['B']));
      graph.addTrait(createTrait('B', ['C']));
      graph.addTrait(createTrait('C', ['A']));

      const result = topologicalSort(graph);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should be deterministic (same input = same output)', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['A']));

      const result1 = topologicalSort(graph);
      const result2 = topologicalSort(graph);

      expect(result1.order).toEqual(result2.order);
    });

    it('should handle empty graph', () => {
      const result = topologicalSort(graph);

      expect(result.success).toBe(true);
      expect(result.order).toEqual([]);
    });

    it('should handle single node', () => {
      graph.addTrait(createTrait('A'));

      const result = topologicalSort(graph);

      expect(result.success).toBe(true);
      expect(result.order).toEqual(['A']);
    });
  });

  describe('Performance', () => {
    /**
     * Threshold tuned to accommodate CI/coverage instrumentation overhead.
     * Locally we typically see ~10-15ms, but coverage can add ~10ms.
     */
    const PERFORMANCE_BUDGET_MS = 35;

    it(`should resolve 100 traits in under ${PERFORMANCE_BUDGET_MS}ms`, () => {
      // Create 100 traits with dependencies
      for (let i = 0; i < 100; i++) {
        const deps = i > 0 ? [`Trait${i - 1}`] : [];
        graph.addTrait(createTrait(`Trait${i}`, deps));
      }

      const start = performance.now();
      const result = validateAndSort(graph);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_BUDGET_MS);
    });
  });
});

describe('DependencyValidator', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Conflict Detection', () => {
    it('should detect direct conflicts', () => {
      graph.addTrait(createTrait('A', [], ['B']));
      graph.addTrait(createTrait('B'));

      const validator = new DependencyValidator(graph);
      const result = validator.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.type === 'conflict')).toBe(true);
    });

    it('should detect transitive conflicts', () => {
      graph.addTrait(createTrait('A', ['B'], ['C']));
      graph.addTrait(createTrait('B'));
      graph.addTrait(createTrait('C'));

      const validator = new DependencyValidator(graph);
      const result = validator.validate();

      expect(result.success).toBe(false);
    });

    it('should pass when no conflicts exist', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));

      const validator = new DependencyValidator(graph);
      const result = validator.validate();

      expect(result.success).toBe(true);
    });
  });

  describe('Composition Validation', () => {
    it('should validate valid composition', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['B']));

      const validator = new DependencyValidator(graph);
      const result = validator.validateComposition(['C']);

      expect(result.success).toBe(true);
    });

    it('should detect missing dependencies in composition', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['D'])); // D is missing

      const validator = new DependencyValidator(graph);
      const result = validator.validateComposition(['C']);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.type === 'missing_dependency')).toBe(true);
    });
  });

  describe('canCompose', () => {
    it('should return true for compatible traits', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B'));

      const validator = new DependencyValidator(graph);
      const result = validator.canCompose('A', 'B');

      expect(result).toBe(true);
    });

    it('should return false for conflicting traits', () => {
      graph.addTrait(createTrait('A', [], ['B']));
      graph.addTrait(createTrait('B'));

      const validator = new DependencyValidator(graph);
      const result = validator.canCompose('A', 'B');

      expect(result).toBe(false);
    });
  });
});

describe('Graph Visualization', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('Mermaid Diagram', () => {
    it('should generate valid Mermaid diagram', () => {
      graph.addTrait(createTrait('A'));
      graph.addTrait(createTrait('B', ['A']));
      graph.addTrait(createTrait('C', ['B']));

      const diagram = generateMermaidDiagram(graph);

      expect(diagram).toContain('graph TB');
      expect(diagram).toContain('A[A]');
      expect(diagram).toContain('B --> A');
      expect(diagram).toContain('C --> B');
    });

    it('should handle complex graphs', () => {
      graph.addTrait(createTrait('Base'));
      graph.addTrait(createTrait('Timestamped', ['Base']));
      graph.addTrait(createTrait('Auditable', ['Timestamped']));
      graph.addTrait(createTrait('Versioned', ['Base']));

      const diagram = generateMermaidDiagram(graph);

      expect(diagram).toContain('Timestamped --> Base');
      expect(diagram).toContain('Auditable --> Timestamped');
      expect(diagram).toContain('Versioned --> Base');
    });

    it('should show conflicts when enabled', () => {
      graph.addTrait(createTrait('A', [], ['B']));
      graph.addTrait(createTrait('B'));

      const diagram = generateMermaidDiagram(graph, { showConflicts: true });

      expect(diagram).toContain('-.x');
    });
  });

  describe('Cycle Diagram', () => {
    it('should generate cycle visualization', () => {
      const cycle = ['A', 'B', 'C', 'A'];
      const diagram = generateCycleDiagram(cycle);

      expect(diagram).toContain('graph LR');
      expect(diagram).toContain('A --> B');
      expect(diagram).toContain('B --> C');
      expect(diagram).toContain('C -->|cycle| A');
    });
  });
});

describe('Edge Cases', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  it('should handle disconnected graphs', () => {
    graph.addTrait(createTrait('A', ['B']));
    graph.addTrait(createTrait('B'));
    graph.addTrait(createTrait('C', ['D']));
    graph.addTrait(createTrait('D'));

    const result = topologicalSort(graph);

    expect(result.success).toBe(true);
    expect(result.order!.length).toBe(4);
  });

  it('should handle graphs with multiple root nodes', () => {
    graph.addTrait(createTrait('A'));
    graph.addTrait(createTrait('B'));
    graph.addTrait(createTrait('C', ['A', 'B']));

    const result = topologicalSort(graph);

    expect(result.success).toBe(true);
    expect(result.order!.length).toBe(3);
  });

  it('should clone graph correctly', () => {
    graph.addTrait(createTrait('A'));
    graph.addTrait(createTrait('B', ['A']));

    const cloned = graph.clone();

    expect(cloned.size()).toBe(2);
    expect(cloned.getDependencies('B')).toContain('A');

    // Modify original, clone should not change
    graph.addTrait(createTrait('C'));
    expect(cloned.size()).toBe(2);
  });
});
