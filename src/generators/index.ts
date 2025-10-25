#!/usr/bin/env node
/* c8 ignore file */
/**
 * Type Generator CLI
 *
 * Command-line interface for generating TypeScript types from trait definitions.
 * Supports both single trait and multi-trait composition scenarios.
 *
 * Usage:
 *   yarn generate:types <trait-file>
 *   yarn generate:types --compose <trait1> <trait2> ...
 *   yarn generate:types --dir <directory>
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import { parseTraits } from '../parsers/index';
import type { TraitDefinition } from '../core/trait-definition';
import { generateTraitTypes, hasGeneratableParameters } from './type-generator';
import { generateComposedTypes } from './composer';

/**
 * CLI configuration
 */
interface CLIOptions {
  /**
   * Input files or directories
   */
  inputs: string[];

  /**
   * Output directory for generated types
   */
  outputDir: string;

  /**
   * Whether to compose multiple traits
   */
  compose: boolean;

  /**
   * Whether to scan a directory recursively
   */
  recursive: boolean;

  /**
   * Verbose output
   */
  verbose: boolean;

  /**
   * Dry run (don't write files)
   */
  dryRun: boolean;

  /**
   * Output declaration files with .d.ts extension
   */
  dts: boolean;
}

/**
 * Parse command-line arguments
 */
function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    inputs: [],
    outputDir: './generated',
    compose: false,
    recursive: false,
    verbose: false,
    dryRun: false,
    dts: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--compose':
      case '-c':
        options.compose = true;
        break;

      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;

      case '--recursive':
      case '-r':
        options.recursive = true;
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--dry-run':
        options.dryRun = true;
        break;

      case '--dts':
        options.dts = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;

      default:
        if (!arg.startsWith('-')) {
          options.inputs.push(arg);
        }
        break;
    }
  }

  return options;
}

/**
 * Print CLI help
 */
function printHelp(): void {
  console.log(`
Type Generator CLI

Usage:
  yarn generate:types [options] <input...>

Options:
  -c, --compose       Compose multiple traits into a single output file
  -o, --output <dir>  Output directory (default: ./generated)
  -r, --recursive     Recursively scan directories for trait files
  -v, --verbose       Verbose output
  --dry-run           Show what would be generated without writing files
  --dts               Output declaration files (.d.ts)
  -h, --help          Show this help message

Examples:
  # Generate types for a single trait
  yarn generate:types examples/traits/Stateful.trait.yaml

  # Compose multiple traits
  yarn generate:types --compose examples/traits/Stateful.trait.yaml examples/traits/Colorized.trait.yaml

  # Generate types for all traits in a directory
  yarn generate:types --recursive examples/traits/

  # Dry run to preview output
  yarn generate:types --dry-run examples/traits/Stateful.trait.yaml
`);
}

/**
 * Find all trait files in a directory
 */
function findTraitFiles(dir: string, recursive: boolean = false): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    console.error(`Error: Directory not found: ${dir}`);
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && recursive) {
      files.push(...findTraitFiles(fullPath, recursive));
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (ext === '.yaml' || ext === '.yml' || ext === '.ts') {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Resolve input paths to trait files
 */
function resolveInputs(inputs: string[], recursive: boolean): string[] {
  const files: string[] = [];

  for (const input of inputs) {
    const resolvedPath = resolve(input);

    if (!existsSync(resolvedPath)) {
      console.error(`Warning: Input not found: ${resolvedPath}`);
      continue;
    }

    const stat = statSync(resolvedPath);

    if (stat.isDirectory()) {
      files.push(...findTraitFiles(resolvedPath, recursive));
    } else if (stat.isFile()) {
      files.push(resolvedPath);
    }
  }

  return files;
}

/**
 * Generate output filename for a trait
 */
function generateOutputFilename(
  traitNameOrKey: string,
  composed: boolean = false,
  dts: boolean = false
): string {
  const prefix = composed ? 'composed' : traitNameOrKey.toLowerCase();
  const ext = dts ? '.d.ts' : '.ts';
  return `${prefix}.types${ext}`;
}

/**
 * Main generation function
 */
async function generate(options: CLIOptions): Promise<void> {
  const { inputs, outputDir, compose, recursive, verbose, dryRun, dts } = options;

  // Validate inputs
  if (inputs.length === 0) {
    console.error('Error: No input files specified');
    printHelp();
    process.exit(1);
  }

  // Resolve input files
  const traitFiles = resolveInputs(inputs, recursive);

  if (traitFiles.length === 0) {
    console.error('Error: No trait files found');
    process.exit(1);
  }

  if (verbose) {
    console.log(`Found ${traitFiles.length} trait file(s):`);
    traitFiles.forEach((f) => console.log(`  - ${f}`));
  }

  // Parse all trait files
  const parseResults = await parseTraits(traitFiles);
  const traits: TraitDefinition[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parseResults.length; i++) {
    const result = parseResults[i];
    const file = traitFiles[i];

    if (result.success && result.data) {
      traits.push(result.data);

      if (verbose) {
        console.log(`✓ Parsed: ${result.data.trait.name}`);
      }
    } else {
      const errorMsg = `✗ Failed to parse: ${file}`;
      errors.push(errorMsg);

      if (result.errors) {
        result.errors.forEach((err) => {
          errors.push(`  ${err.message}`);
        });
      }
    }
  }

  if (errors.length > 0) {
    console.error('\nParsing errors:');
    errors.forEach((err) => console.error(err));

    if (traits.length === 0) {
      process.exit(1);
    }
  }

  // Filter traits that have generatable parameters
  const generatableTraits = traits.filter(hasGeneratableParameters);

  if (generatableTraits.length === 0) {
    console.log('\nNo traits with generatable parameters found.');
    process.exit(0);
  }

  // Create output directory if it doesn't exist
  if (!dryRun && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });

    if (verbose) {
      console.log(`\nCreated output directory: ${outputDir}`);
    }
  }

  console.log(`\nGenerating types for ${generatableTraits.length} trait(s)...`);

  // Generate types
  if (compose && generatableTraits.length > 1) {
    // Compose all traits into a single file
    const result = generateComposedTypes(generatableTraits, {
      formatted: true,
      exportTypes: true,
      includeComments: true,
    });

    const traitNames = generatableTraits.map((t) => t.trait.name);
    const outputFile = join(
      outputDir,
      `${traitNames.join('_').toLowerCase()}.composed.types${dts ? '.d.ts' : '.ts'}`
    );

    if (dryRun) {
      console.log(`\nWould generate: ${outputFile}`);
      console.log(result.code);
    } else {
      // Incremental write: only touch file if content changed
      let changed = true;
      if (existsSync(outputFile)) {
        try {
          const existing = await import('node:fs/promises').then(m => m.readFile(outputFile, 'utf-8'));
          if (existing === result.code) {
            changed = false;
          }
        } catch {
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(outputFile, result.code, 'utf-8');
        console.log(`✓ Generated composed types: ${outputFile}`);
      } else {
        console.log(`• Unchanged: ${outputFile}`);
      }
      console.log(`  - ${result.typeNames.length} type(s)`);
      console.log(`  - ${result.constantNames.length} constant(s)`);
    }
  } else {
    // Generate separate file for each trait
    for (const trait of generatableTraits) {
      const result = generateTraitTypes(trait, {
        formatted: true,
        exportTypes: true,
        includeComments: true,
      });

      const outputFile = join(outputDir, generateOutputFilename(trait.trait.name, false, dts));

      if (dryRun) {
        console.log(`\nWould generate: ${outputFile}`);
        console.log(result.code);
      } else {
        // Incremental write: only touch file if content changed
        let changed = true;
        if (existsSync(outputFile)) {
          try {
            const existing = await import('node:fs/promises').then(m => m.readFile(outputFile, 'utf-8'));
            if (existing === result.code) {
              changed = false;
            }
          } catch {
            changed = true;
          }
        }

        if (changed) {
          writeFileSync(outputFile, result.code, 'utf-8');
          console.log(`✓ Generated: ${outputFile}`);
        } else {
          console.log(`• Unchanged: ${outputFile}`);
        }

        if (verbose) {
          console.log(`  - ${result.typeNames.length} type(s)`);
          console.log(`  - ${result.constantNames.length} constant(s)`);
        }
      }
    }
  }

  console.log('\n✓ Type generation complete!');
}

/**
 * Entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    await generate(options);
  } catch (error) {
    console.error('\nError during type generation:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
// This check works for both tsx and node execution
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule || process.argv[1]?.includes('generators/index')) {
  main();
}

// Export for programmatic use
export { generate, parseArgs, type CLIOptions };
export * from './type-generator';
export * from './composer';
export * from './templates/index';
