/**
 * Topological Sort
 *
 * Implements Kahn's algorithm for topological sorting of a dependency graph.
 * Produces a valid ordering of traits where all dependencies come before dependents.
 */

import { DependencyGraph, GraphResult, GraphError } from './dependency-graph.js';

/**
 * Result of topological sort
 */
export interface TopologicalSortResult {
  success: boolean;
  order?: string[];
  errors?: GraphError[];
}

/**
 * Perform topological sort on a dependency graph using Kahn's algorithm
 *
 * Algorithm:
 * 1. Calculate in-degree (number of dependencies) for each node
 * 2. Add all nodes with in-degree 0 to a queue
 * 3. While queue is not empty:
 *    a. Remove node from queue and add to result
 *    b. For each dependent of the node:
 *       - Decrease its in-degree by 1
 *       - If in-degree becomes 0, add to queue
 * 4. If all nodes are processed, return sorted order
 * 5. Otherwise, there's a cycle (some nodes still have in-degree > 0)
 *
 * Time Complexity: O(V + E) where V is nodes and E is edges
 * Space Complexity: O(V)
 */
export function topologicalSort(graph: DependencyGraph): TopologicalSortResult {
  const nodes = graph.getAllNodes();
  const traitIds = graph.getTraitIds();

  // Handle empty graph
  if (nodes.length === 0) {
    return {
      success: true,
      order: [],
    };
  }

  // Calculate in-degrees for all nodes
  const inDegree = new Map<string, number>();
  for (const id of traitIds) {
    inDegree.set(id, 0);
  }

  for (const node of nodes) {
    for (const _dep of node.dependencies) {
      const current = inDegree.get(node.id) || 0;
      inDegree.set(node.id, current + 1);
    }
  }

  // Queue for nodes with no dependencies (in-degree = 0)
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  // Result order
  const sortedOrder: string[] = [];

  // Process nodes
  while (queue.length > 0) {
    // For deterministic output, sort the queue
    // This ensures same input always produces same output
    queue.sort();

    const current = queue.shift()!;
    sortedOrder.push(current);

    // Process all dependents (traits that depend on current)
    const dependents = graph.getDependents(current);
    for (const dependent of dependents) {
      const degree = inDegree.get(dependent)!;
      inDegree.set(dependent, degree - 1);

      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check if all nodes were processed
  if (sortedOrder.length !== traitIds.length) {
    // Some nodes still have in-degree > 0, meaning there's a cycle
    const unprocessed = traitIds.filter((id) => !sortedOrder.includes(id));

    // Try to find the actual cycle
    const cycleResult = graph.detectCircularDependencies();

    return {
      success: false,
      errors: cycleResult.errors || [
        {
          type: 'circular_dependency',
          message: `Circular dependency detected. Unable to process traits: ${unprocessed.join(', ')}`,
          traits: unprocessed,
        },
      ],
    };
  }

  return {
    success: true,
    order: sortedOrder,
  };
}

/**
 * Perform topological sort with DFS-based algorithm (alternative implementation)
 *
 * This is an alternative to Kahn's algorithm that uses depth-first search.
 * Useful for debugging and comparison.
 */
export function topologicalSortDFS(graph: DependencyGraph): TopologicalSortResult {
  const nodes = graph.getAllNodes();
  const traitIds = graph.getTraitIds();

  // Handle empty graph
  if (nodes.length === 0) {
    return {
      success: true,
      order: [],
    };
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const sortedOrder: string[] = [];
  const errors: GraphError[] = [];

  const dfs = (nodeId: string, path: string[]): boolean => {
    if (recStack.has(nodeId)) {
      // Cycle detected
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart);
      cycle.push(nodeId);

      errors.push({
        type: 'circular_dependency',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        cycle,
      });
      return false;
    }

    if (visited.has(nodeId)) {
      return true;
    }

    visited.add(nodeId);
    recStack.add(nodeId);

    // Visit all dependencies first
    const dependencies = graph.getDependencies(nodeId);
    for (const dep of dependencies.sort()) {
      // Sort for deterministic output
      if (!dfs(dep, [...path, nodeId])) {
        return false;
      }
    }

    recStack.delete(nodeId);
    sortedOrder.push(nodeId);

    return true;
  };

  // Visit all nodes
  const sortedTraitIds = [...traitIds].sort(); // Sort for deterministic output
  for (const id of sortedTraitIds) {
    if (!visited.has(id)) {
      if (!dfs(id, [])) {
        return {
          success: false,
          errors,
        };
      }
    }
  }

  return {
    success: true,
    order: sortedOrder,
  };
}

/**
 * Validate and sort a list of trait IDs based on their dependencies
 *
 * This is a convenience function that:
 * 1. Builds a graph from the provided traits
 * 2. Validates dependencies exist
 * 3. Checks for circular dependencies
 * 4. Returns a valid topological order
 */
export function validateAndSort(
  graph: DependencyGraph
): GraphResult<string[]> {
  // Check for missing dependencies
  const missingDepsResult = graph.validateDependenciesExist();
  if (!missingDepsResult.success) {
    return {
      success: false,
      errors: missingDepsResult.errors,
    };
  }

  // Check for circular dependencies
  const circularResult = graph.detectCircularDependencies();
  if (!circularResult.success) {
    return {
      success: false,
      errors: circularResult.errors,
    };
  }

  // Perform topological sort
  const sortResult = topologicalSort(graph);
  if (!sortResult.success) {
    return {
      success: false,
      errors: sortResult.errors,
    };
  }

  return {
    success: true,
    data: sortResult.order,
  };
}
