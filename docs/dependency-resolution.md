# Dependency Resolution System

## Overview

The Dependency Resolution System provides a complete implementation of directed acyclic graph (DAG) algorithms for validating and ordering trait dependencies in the composition engine.

## Architecture

### Core Components

#### 1. DependencyGraph (`src/core/dependency-graph.ts`)

The graph data structure that manages trait dependencies:

- **Node Management**: Add, retrieve, and manage trait nodes
- **Edge Tracking**: Dependencies (forward) and dependents (backward)
- **Circular Dependency Detection**: DFS-based algorithm with full cycle path tracking
- **Transitive Closure**: Compute all indirect dependencies
- **Conflict Tracking**: Store and retrieve conflict relationships

**Key Methods:**
- `addTrait(trait)`: Add a trait to the graph
- `getDependencies(id)`: Get direct dependencies
- `getDependents(id)`: Get traits that depend on this one
- `detectCircularDependencies()`: Find all cycles in the graph
- `getTransitiveDependencies(id)`: Get complete dependency closure

#### 2. Topological Sort (`src/core/topological-sort.ts`)

Implements Kahn's algorithm for dependency ordering:

- **Kahn's Algorithm**: Primary topological sort implementation
- **DFS Alternative**: Depth-first search based sorting
- **Deterministic Output**: Same input always produces same order
- **Cycle Detection**: Integrated with error reporting

**Key Functions:**
- `topologicalSort(graph)`: Sort using Kahn's algorithm
- `topologicalSortDFS(graph)`: Sort using DFS (alternative)
- `validateAndSort(graph)`: Complete validation + sorting

**Complexity:** O(V + E) where V = traits, E = dependencies

#### 3. DependencyValidator (`src/core/dependency-validator.ts`)

Comprehensive validation of trait compositions:

- **Missing Dependencies**: Ensure all dependencies exist
- **Circular Dependencies**: Detect dependency cycles
- **Conflict Detection**: Validate conflict_with relationships
- **Optional Dependencies**: Handle soft dependencies
- **Composition Validation**: Check if specific trait sets can be composed

**Key Methods:**
- `validate()`: Full validation with errors and warnings
- `validateComposition(traitIds)`: Validate specific trait set
- `canCompose(trait1, trait2)`: Check compatibility
- `findConflictingTraits(traitId)`: Get all conflicts

#### 4. Graph Visualizer (`src/utils/graph-visualizer.ts`)

Export dependency graphs for visualization:

- **Mermaid Diagrams**: Generate Mermaid markdown
- **DOT Format**: Export for Graphviz
- **Cycle Visualization**: Special formatting for cycles
- **Statistical Reports**: Text-based analysis

**Output Formats:**
- Mermaid (for documentation)
- DOT (for advanced visualization)
- Text reports (for analysis)

## Usage Examples

### Basic Usage

```typescript
import { DependencyGraph, validateAndSort } from './core';

// Create graph
const graph = new DependencyGraph();

// Add traits
graph.addTrait(timestampedTrait);
graph.addTrait(auditableTrait);
graph.addTrait(versionedTrait);

// Validate and get ordering
const result = validateAndSort(graph);

if (result.success) {
  console.log('Composition order:', result.data);
  // ['Timestamped', 'Auditable', 'Versioned']
}
```

### Validation

```typescript
import { DependencyValidator } from './core';

const validator = new DependencyValidator(graph);
const validation = validator.validate();

if (!validation.success) {
  for (const error of validation.errors) {
    console.error(error.message);
    if (error.cycle) {
      console.error('Cycle:', error.cycle.join(' → '));
    }
  }
}
```

### Visualization

```typescript
import { generateMermaidDiagram } from './utils';

const diagram = generateMermaidDiagram(graph, {
  direction: 'TB',
  showConflicts: true,
  showDetails: true
});

console.log(diagram);
```

### CLI Usage

```bash
# Basic validation
yarn validate:dependencies

# Verbose output with visualization
yarn validate:dependencies --verbose --visualize

# Custom path with JSON output
yarn validate:dependencies --path ./traits --format json --output report.json
```

## Algorithm Details

### Kahn's Algorithm (Topological Sort)

1. Calculate in-degree (number of dependencies) for each node
2. Add all nodes with in-degree 0 to queue
3. While queue is not empty:
   - Remove node from queue
   - Add to result order
   - Decrease in-degree of all dependents
   - If dependent in-degree becomes 0, add to queue
4. If all nodes processed → success
5. Otherwise → circular dependency detected

**Time Complexity:** O(V + E)
**Space Complexity:** O(V)

### Circular Dependency Detection (DFS)

1. For each unvisited node:
   - Mark as visiting (in recursion stack)
   - Visit all dependencies
   - If dependency is in recursion stack → cycle found
   - Track full path for error reporting
2. Return all cycles found

**Time Complexity:** O(V + E)
**Space Complexity:** O(V)

## Performance Benchmarks

All performance requirements met:

- **100 traits**: < 10ms ✓
- **1000 traits**: < 50ms ✓
- **10000 traits**: < 500ms ✓

Tested on realistic dependency structures with multiple chains and diamond patterns.

## Error Handling

### Error Types

1. **Missing Dependency**
   ```
   Trait "Auditable" depends on "Timestamped" which is not defined
   ```

2. **Circular Dependency**
   ```
   Circular dependency detected: A → B → C → A
   Cycle: [A, B, C, A]
   ```

3. **Conflict**
   ```
   Trait "Premium" conflicts with "Free" but both are present
   ```

### Warnings

1. **Optional Dependency Missing**
2. **Version Mismatch**
3. **Deprecated Trait**

## Testing

Comprehensive test suite in `tests/core/dependency-graph.test.ts`:

- ✓ 39 tests covering all functionality
- ✓ Edge cases (empty graphs, self-loops, disconnected components)
- ✓ Performance tests (100+ traits)
- ✓ Complex dependency patterns (diamond, chains, forests)

Run tests:
```bash
npm test tests/core/dependency-graph.test.ts
```

## Integration

The dependency resolution system integrates with:

1. **Trait Parser**: Load traits from YAML/TS files
2. **Composition Engine**: Apply traits in dependency order
3. **Type Generator**: Ensure correct type composition
4. **CLI Tools**: Validate trait libraries

## File Structure

```
src/
├── core/
│   ├── dependency-graph.ts       # Graph data structure
│   ├── topological-sort.ts       # Sorting algorithms
│   ├── dependency-validator.ts   # Validation logic
│   ├── trait-definition.ts       # Type definitions
│   └── index.ts                  # Core exports
├── utils/
│   ├── graph-visualizer.ts       # Visualization tools
│   └── index.ts                  # Utils exports
└── cli/
    └── validate-dependencies.ts  # CLI command

tests/
└── core/
    └── dependency-graph.test.ts  # Comprehensive tests

examples/
└── dependency-graph/
    ├── example-traits.ts         # Usage examples
    └── example-output.md         # Expected output
```

## API Reference

See inline JSDoc comments in source files for detailed API documentation.

## Future Enhancements

Potential improvements:

1. Parallel dependency resolution
2. Incremental graph updates
3. Dependency caching
4. Custom conflict resolution strategies
5. Graph query language
6. Visual graph editor integration

## References

- [Kahn's Algorithm](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm)
- [Depth-First Search](https://en.wikipedia.org/wiki/Depth-first_search)
- [Directed Acyclic Graphs](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
- [Mermaid Diagrams](https://mermaid.js.org/)
