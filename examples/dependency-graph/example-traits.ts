/**
 * Example: Dependency Graph Visualization
 *
 * Demonstrates the dependency graph system with realistic trait examples.
 */

import { DependencyGraph } from '../../src/core/dependency-graph.js';
import { validateAndSort } from '../../src/core/topological-sort.js';
import { DependencyValidator } from '../../src/core/dependency-validator.js';
import {
  generateMermaidDiagram,
  generateGraphReport,
} from '../../src/utils/graph-visualizer.js';
import { TraitDefinition } from '../../src/core/trait-definition.js';

// Example trait definitions
const exampleTraits: TraitDefinition[] = [
  {
    trait: {
      name: 'Base',
      version: '1.0.0',
      description: 'Base trait with fundamental fields',
      category: 'foundation',
    },
    schema: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
    },
  },
  {
    trait: {
      name: 'Timestamped',
      version: '1.0.0',
      description: 'Adds creation and update timestamps',
      category: 'metadata',
    },
    schema: {
      created_at: { type: 'datetime', required: true },
      updated_at: { type: 'datetime', required: true },
    },
    dependencies: ['Base'],
  },
  {
    trait: {
      name: 'Versioned',
      version: '1.0.0',
      description: 'Adds version tracking',
      category: 'metadata',
    },
    schema: {
      version: { type: 'number', required: true },
    },
    dependencies: ['Base'],
  },
  {
    trait: {
      name: 'Auditable',
      version: '1.0.0',
      description: 'Adds audit trail functionality',
      category: 'compliance',
    },
    schema: {
      created_by: { type: 'string', required: true },
      modified_by: { type: 'string', required: true },
    },
    dependencies: ['Timestamped'],
  },
  {
    trait: {
      name: 'Searchable',
      version: '1.0.0',
      description: 'Makes entity searchable',
      category: 'discovery',
    },
    schema: {
      search_index: { type: 'string[]' },
    },
    dependencies: ['Base'],
  },
  {
    trait: {
      name: 'Taggable',
      version: '1.0.0',
      description: 'Adds tagging capability',
      category: 'organization',
    },
    schema: {
      tags: { type: 'string[]', default: [] },
    },
    dependencies: ['Base'],
  },
  {
    trait: {
      name: 'Categorizable',
      version: '1.0.0',
      description: 'Adds category assignment',
      category: 'organization',
    },
    schema: {
      category: { type: 'string' },
      subcategory: { type: 'string' },
    },
    dependencies: ['Taggable'],
  },
  {
    trait: {
      name: 'Commentable',
      version: '1.0.0',
      description: 'Enables comments',
      category: 'social',
    },
    schema: {
      comments: { type: 'Comment[]', default: [] },
      comment_count: { type: 'number', default: 0 },
    },
    dependencies: ['Timestamped', 'Auditable'],
  },
  {
    trait: {
      name: 'Votable',
      version: '1.0.0',
      description: 'Adds voting/rating capability',
      category: 'social',
    },
    schema: {
      vote_count: { type: 'number', default: 0 },
      vote_score: { type: 'number', default: 0 },
    },
    dependencies: ['Timestamped'],
  },
  {
    trait: {
      name: 'Featured',
      version: '1.0.0',
      description: 'Marks entity as featured',
      category: 'presentation',
    },
    schema: {
      is_featured: { type: 'boolean', default: false },
      featured_at: { type: 'datetime' },
    },
    dependencies: ['Votable', 'Categorizable'],
  },
  {
    trait: {
      name: 'Premium',
      version: '1.0.0',
      description: 'Premium content features',
      category: 'monetization',
    },
    schema: {
      is_premium: { type: 'boolean', default: false },
      price: { type: 'number' },
    },
    dependencies: ['Featured', 'Searchable'],
  },
];

function runExample() {
  console.log('='.repeat(70));
  console.log('Dependency Graph Example - Complex Trait System');
  console.log('='.repeat(70));
  console.log('');

  // Build the graph
  console.log('Building dependency graph...');
  const graph = new DependencyGraph();

  for (const trait of exampleTraits) {
    graph.addTrait(trait);
  }

  console.log(`✓ Added ${graph.size()} traits to the graph\n`);

  // Validate dependencies
  console.log('Validating dependencies...');
  const validator = new DependencyValidator(graph);
  const validationResult = validator.validate();

  if (validationResult.success) {
    console.log('✓ All dependencies are valid\n');
  } else {
    console.log('✗ Validation errors found:\n');
    for (const error of validationResult.errors) {
      console.log(`  - ${error.message}`);
    }
    console.log('');
  }

  // Compute topological sort
  console.log('Computing topological order...');
  const sortResult = validateAndSort(graph);

  if (sortResult.success && sortResult.data) {
    console.log('✓ Successfully computed dependency order:\n');
    console.log('Composition Order (dependencies first):');
    for (let i = 0; i < sortResult.data.length; i++) {
      const traitName = sortResult.data[i];
      const deps = graph.getDependencies(traitName);
      console.log(`  ${i + 1}. ${traitName}${deps.length > 0 ? ` (requires: ${deps.join(', ')})` : ' (no dependencies)'}`);
    }
    console.log('');
  }

  // Generate Mermaid diagram
  console.log('\nMermaid Diagram (copy to Mermaid Live Editor):');
  console.log('='.repeat(70));
  console.log('```mermaid');
  const diagram = generateMermaidDiagram(graph, {
    direction: 'TB',
    showConflicts: true,
  });
  console.log(diagram);
  console.log('```');
  console.log('='.repeat(70));
  console.log('');

  // Generate detailed report
  console.log('\nDetailed Graph Report:');
  console.log('='.repeat(70));
  const report = generateGraphReport(graph);
  console.log(report);
  console.log('='.repeat(70));
  console.log('');

  // Example: Check if traits can be composed
  console.log('Composition Compatibility Tests:');
  console.log('-'.repeat(70));

  const testPairs = [
    ['Base', 'Timestamped'],
    ['Auditable', 'Searchable'],
    ['Featured', 'Premium'],
  ];

  for (const [trait1, trait2] of testPairs) {
    const canCompose = validator.canCompose(trait1, trait2);
    console.log(`  ${trait1} + ${trait2}: ${canCompose ? '✓ Compatible' : '✗ Incompatible'}`);
  }

  console.log('');

  // Example: Validate a specific composition
  console.log('\nValidating Specific Composition:');
  console.log('-'.repeat(70));

  const composition = ['Premium', 'Commentable'];
  console.log(`Requested traits: ${composition.join(', ')}`);

  const compositionResult = validator.validateComposition(composition);

  if (compositionResult.success) {
    console.log('✓ Composition is valid');

    // Get all required dependencies
    const allDeps = new Set<string>();
    for (const traitId of composition) {
      const deps = graph.getTransitiveDependencies(traitId);
      deps.forEach((d) => allDeps.add(d));
    }

    console.log(`Required dependencies: ${Array.from(allDeps).join(', ')}`);
  } else {
    console.log('✗ Composition has errors:');
    for (const error of compositionResult.errors) {
      console.log(`  - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Example completed successfully!');
  console.log('='.repeat(70));
}

// Run the example
runExample();
