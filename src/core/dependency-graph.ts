/**
 * Dependency Graph
 *
 * Builds a directed acyclic graph (DAG) from trait dependencies and provides
 * validation and traversal functionality.
 */

import { TraitDefinition } from './trait-definition.js';

/**
 * Represents a node in the dependency graph
 */
export interface GraphNode {
  id: string;
  trait: TraitDefinition;
  dependencies: Set<string>;
  dependents: Set<string>;
  conflicts: Set<string>;
}

/**
 * Result of a graph operation
 */
export interface GraphResult<T> {
  success: boolean;
  data?: T;
  errors?: GraphError[];
}

/**
 * Error types for dependency graph operations
 */
export interface GraphError {
  type: 'circular_dependency' | 'missing_dependency' | 'conflict' | 'invalid_graph';
  message: string;
  cycle?: string[];
  traits?: string[];
}

/**
 * Dependency Graph class
 *
 * Manages the directed graph of trait dependencies with support for:
 * - Adding traits with their dependencies
 * - Detecting circular dependencies
 * - Validating conflicts
 * - Computing dependency closure
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();

  /**
   * Add a trait to the dependency graph
   */
  addTrait(trait: TraitDefinition): void {
    const traitId = trait.trait.name;

    // Create or update node
    if (!this.nodes.has(traitId)) {
      this.nodes.set(traitId, {
        id: traitId,
        trait,
        dependencies: new Set(),
        dependents: new Set(),
        conflicts: new Set(),
      });
    }

    const node = this.nodes.get(traitId)!;
    node.trait = trait;

    // Parse dependencies
    if (trait.dependencies) {
      for (const dep of trait.dependencies) {
        const depName = typeof dep === 'string' ? dep : dep.trait;
        node.dependencies.add(depName);

        // Ensure dependency node exists
        if (!this.nodes.has(depName)) {
          // Create placeholder for missing dependency
          this.nodes.set(depName, {
            id: depName,
            trait: null as any, // Will be filled when trait is added
            dependencies: new Set(),
            dependents: new Set(),
            conflicts: new Set(),
          });
        }

        // Add reverse edge (dependent)
        this.nodes.get(depName)!.dependents.add(traitId);
      }
    }

    // Parse conflicts (from metadata or separate field)
    // Note: This assumes conflicts are stored in metadata.conflicts_with
    const conflictsWith = (trait.metadata as any)?.conflicts_with;
    if (Array.isArray(conflictsWith)) {
      for (const conflict of conflictsWith) {
        node.conflicts.add(conflict);
      }
    }
  }

  /**
   * Get a node by trait ID
   */
  getNode(traitId: string): GraphNode | undefined {
    return this.nodes.get(traitId);
  }

  /**
   * Get all nodes in the graph
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all trait IDs in the graph
   */
  getTraitIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Check if a trait exists in the graph
   */
  hasTrait(traitId: string): boolean {
    return this.nodes.has(traitId);
  }

  /**
   * Get direct dependencies of a trait
   */
  getDependencies(traitId: string): string[] {
    const node = this.nodes.get(traitId);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get direct dependents of a trait (traits that depend on this one)
   */
  getDependents(traitId: string): string[] {
    const node = this.nodes.get(traitId);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Get all traits that conflict with the given trait
   */
  getConflicts(traitId: string): string[] {
    const node = this.nodes.get(traitId);
    return node ? Array.from(node.conflicts) : [];
  }

  /**
   * Detect circular dependencies in the graph
   * Returns all cycles found. Uses DFS from every node, collecting
   * unique cycle paths deterministically.
   */
  detectCircularDependencies(): GraphResult<null> {
    const cycleSet = new Set<string>();
    const cycles: string[][] = [];

    // Canonicalize a cycle so duplicates are removed regardless of start point
    const canonicalize = (cycle: string[]): string => {
      // cycle like [A, B, C, A] => remove last equal to first for rotation
      const simple = cycle[cycle.length - 1] === cycle[0] ? cycle.slice(0, -1) : cycle.slice();
      if (simple.length === 0) return '';
      // rotate so that smallest (lexicographically) node is first
      let minIdx = 0;
      for (let i = 1; i < simple.length; i++) {
        if (simple[i] < simple[minIdx]) minIdx = i;
      }
      const rotated = simple.slice(minIdx).concat(simple.slice(0, minIdx));
      // close the cycle
      rotated.push(rotated[0]);
      return rotated.join('→');
    };

    const nodeIds = Array.from(this.nodes.keys()).sort(); // deterministic order

    for (const startId of nodeIds) {
      const inStack = new Set<string>();
      const path: string[] = [];

      const visit = (nodeId: string) => {
        inStack.add(nodeId);
        path.push(nodeId);

        const node = this.nodes.get(nodeId);
        if (node) {
          // Sort deps for determinism
          const deps = Array.from(node.dependencies).sort();
          for (const depId of deps) {
            if (!inStack.has(depId)) {
              visit(depId);
            } else {
              // Found a cycle, extract path from first occurrence of depId
              const idx = path.indexOf(depId);
              if (idx !== -1) {
                const cycle = path.slice(idx).concat(depId);
                const key = canonicalize(cycle);
                if (key && !cycleSet.has(key)) {
                  cycleSet.add(key);
                  // Restore canonicalized list with separators for message
                  const restored = key.split('→');
                  cycles.push(restored);
                }
              }
            }
          }
        }

        path.pop();
        inStack.delete(nodeId);
      };

      visit(startId);
    }

    if (cycles.length > 0) {
      // Sort cycles deterministically by their string key
      const sorted = Array.from(cycleSet).sort();
      const errors: GraphError[] = sorted.map((key) => {
        const seq = key.split('→');
        return {
          type: 'circular_dependency',
          message: `Circular dependency detected: ${seq.join(' → ')}`,
          cycle: seq,
        } as GraphError;
      });
      return { success: false, errors };
    }

    return { success: true, data: null };
  }

  /**
   * Validate that all dependencies exist
   */
  validateDependenciesExist(): GraphResult<null> {
    const errors: GraphError[] = [];

    for (const node of this.nodes.values()) {
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (!depNode || !depNode.trait) {
          errors.push({
            type: 'missing_dependency',
            message: `Trait "${node.id}" depends on "${depId}" which is not defined`,
            traits: [node.id, depId],
          });
        }
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: null,
    };
  }

  /**
   * Compute transitive closure of dependencies for a trait
   * Returns all traits that the given trait depends on (directly or indirectly)
   */
  getTransitiveDependencies(traitId: string): Set<string> {
    const closure = new Set<string>();
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return;

      for (const depId of node.dependencies) {
        closure.add(depId);
        dfs(depId);
      }
    };

    dfs(traitId);
    return closure;
  }

  /**
   * Get in-degree (number of dependencies) for each node
   * Used by topological sort algorithm
   */
  getInDegrees(): Map<string, number> {
    const inDegrees = new Map<string, number>();

    for (const nodeId of this.nodes.keys()) {
      inDegrees.set(nodeId, 0);
    }

    for (const node of this.nodes.values()) {
      for (const _dep of node.dependencies) {
        const currentDegree = inDegrees.get(node.id) || 0;
        inDegrees.set(node.id, currentDegree + 1);
      }
    }

    return inDegrees;
  }

  /**
   * Clear all nodes from the graph
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * Get the size (number of nodes) of the graph
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Clone the graph
   */
  clone(): DependencyGraph {
    const cloned = new DependencyGraph();

    // Deep clone all nodes
    for (const [id, node] of this.nodes.entries()) {
      cloned.nodes.set(id, {
        id: node.id,
        trait: node.trait,
        dependencies: new Set(node.dependencies),
        dependents: new Set(node.dependents),
        conflicts: new Set(node.conflicts),
      });
    }

    return cloned;
  }
}
