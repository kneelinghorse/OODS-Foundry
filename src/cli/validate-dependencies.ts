#!/usr/bin/env node

/**
 * CLI Command: validate:dependencies
 *
 * Validates trait dependencies and generates visualization diagrams.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { load } from 'js-yaml';
import { DependencyGraph } from '../core/dependency-graph.js';
import { DependencyValidator } from '../core/dependency-validator.js';
import { validateAndSort } from '../core/topological-sort.js';
import {
  generateMermaidDiagram,
  generateGraphReport,
  generateCycleDiagram,
} from '../utils/graph-visualizer.js';
import { TraitDefinition } from '../core/trait-definition.js';

interface CLIOptions {
  path?: string;
  output?: string;
  verbose?: boolean;
  visualize?: boolean;
  format?: 'text' | 'json';
}

/**
 * Load all trait definitions from a directory
 */
function loadTraitsFromDirectory(dir: string): TraitDefinition[] {
  const traits: TraitDefinition[] = [];

  function scanDirectory(currentDir: string) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const parsed = load(content) as TraitDefinition;

          if (parsed && parsed.trait && parsed.schema) {
            traits.push(parsed);
          }
        } catch (error) {
          console.error(`Error parsing ${fullPath}:`, error);
        }
      }
    }
  }

  scanDirectory(dir);
  return traits;
}

/**
 * Main validation function
 */
function validateDependencies(options: CLIOptions = {}) {
  const {
    path = './traits',
    output,
    verbose = false,
    visualize = false,
    format = 'text',
  } = options;

  console.log('🔍 Trait Dependency Validator\n');

  // Load traits
  console.log(`Loading traits from: ${path}`);
  const traits = loadTraitsFromDirectory(path);
  console.log(`✓ Loaded ${traits.length} trait(s)\n`);

  if (traits.length === 0) {
    console.log('⚠️  No traits found');
    process.exit(0);
  }

  // Build dependency graph
  console.log('Building dependency graph...');
  const graph = new DependencyGraph();
  for (const trait of traits) {
    graph.addTrait(trait);
  }
  console.log(`✓ Graph built with ${graph.size()} node(s)\n`);

  // Validate dependencies
  console.log('Validating dependencies...');
  const validator = new DependencyValidator(graph);
  const validationResult = validator.validate();

  // Display errors
  if (validationResult.errors.length > 0) {
    console.log('\n❌ Validation Errors:\n');

    for (const error of validationResult.errors) {
      console.log(`  [${error.type.toUpperCase()}] ${error.message}`);

      if (error.cycle && error.cycle.length > 0) {
        console.log(`    Cycle: ${error.cycle.join(' → ')}`);

        if (visualize) {
          const cycleDiagram = generateCycleDiagram(error.cycle);
          console.log('\n```mermaid');
          console.log(cycleDiagram);
          console.log('```\n');
        }
      }

      if (error.traits && error.traits.length > 0) {
        console.log(`    Traits: ${error.traits.join(', ')}`);
      }
    }
  } else {
    console.log('✓ No errors found\n');
  }

  // Display warnings
  if (validationResult.warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');

    for (const warning of validationResult.warnings) {
      console.log(`  [${warning.type.toUpperCase()}] ${warning.message}`);
    }

    console.log('');
  }

  // Perform topological sort
  console.log('Computing topological order...');
  const sortResult = validateAndSort(graph);

  if (sortResult.success && sortResult.data) {
    console.log('✓ Valid dependency order found\n');

    if (verbose) {
      console.log('Topological Order:');
      for (let i = 0; i < sortResult.data.length; i++) {
        console.log(`  ${i + 1}. ${sortResult.data[i]}`);
      }
      console.log('');
    }
  } else {
    console.log('❌ Could not compute topological order\n');
  }

  // Generate visualization
  if (visualize) {
    console.log('\nDependency Graph Visualization:\n');
    console.log('```mermaid');
    const diagram = generateMermaidDiagram(graph, {
      showDetails: verbose,
      showConflicts: true,
      direction: 'TB',
    });
    console.log(diagram);
    console.log('```\n');
  }

  // Generate report
  if (verbose) {
    console.log('\n' + generateGraphReport(graph));
  }

  // Write output file
  if (output) {
    const outputData =
      format === 'json'
        ? JSON.stringify(
            {
              success: validationResult.success,
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              order: sortResult.data,
              stats: {
                totalTraits: graph.size(),
                totalErrors: validationResult.errors.length,
                totalWarnings: validationResult.warnings.length,
              },
            },
            null,
            2
          )
        : generateGraphReport(graph);

    writeFileSync(output, outputData, 'utf-8');
    console.log(`\n✓ Report written to: ${output}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Total Traits: ${graph.size()}`);
  console.log(`  Errors: ${validationResult.errors.length}`);
  console.log(`  Warnings: ${validationResult.warnings.length}`);
  console.log(`  Status: ${validationResult.success ? '✓ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(validationResult.success ? 0 : 1);
}

// Parse command line arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--path':
      case '-p':
        options.path = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--visualize':
      case '--viz':
        options.visualize = true;
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'text' | 'json';
        break;
      case '--help':
      case '-h':
        console.log(`
Trait Dependency Validator

Usage: yarn validate:dependencies [options]

Options:
  -p, --path <dir>        Path to traits directory (default: ./traits)
  -o, --output <file>     Write report to file
  -v, --verbose           Show detailed information
  --viz, --visualize      Show Mermaid diagrams
  -f, --format <type>     Output format: text or json (default: text)
  -h, --help              Show this help message

Examples:
  yarn validate:dependencies
  yarn validate:dependencies --path ./my-traits --verbose
  yarn validate:dependencies --visualize --output report.txt
  yarn validate:dependencies --format json --output report.json
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  validateDependencies(options);
}

export { validateDependencies };
