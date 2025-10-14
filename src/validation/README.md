# Composition Validation Layer

**Mission:** Sprint-01-B9 - Zod Composition Validator
**Status:** ✅ Complete

## Overview

The validation pipeline now provides a robust, multi-layered validation system for trait definitions with high-quality error reporting inspired by the Rust compiler. Layer 3 introduces Zod-powered composition rules that guard cross-trait behaviour.

## Architecture

The system implements a **hybrid validation approach** as specified in R2 research:

- **AJV + JSON Schema** for parameter validation (Layer 2)
- **Zod** for composition validation (Layer 3)

### Core Components

```
src/validation/
├── types.ts           # ValidationIssue schema & error codes
├── formatter.ts       # Error transformation (AJV/Zod → ValidationIssue)
├── pipeline.ts        # Validation orchestration
├── composition-validator.ts # Zod-based composition validator
├── composition-rules.ts     # Shared schema + rule wiring
├── rules/                 # Individual composition rule modules
├── reporters/         # Output formatters
│   ├── json.ts       # Machine-readable JSON
│   ├── text.ts       # Human-readable colored output
│   └── github.ts     # GitHub Actions annotations
└── index.ts          # Public API
```

## Features

### ✅ Error Codes & Categories

Standardized error codes following `TE-XXYY` format:

- **01XX**: Structure errors (e.g., `TE-0101` - Invalid trait format)
- **02XX**: Parameter errors (e.g., `TE-0201` - Invalid parameter type)
- **03XX**: Composition errors (e.g., `TE-0301` - Property collision, `TE-0306` - Token mapping missing)
- **04XX**: Runtime errors (e.g., `TE-0401` - Invalid state transition)

### ✅ ValidationIssue Schema

```typescript
interface ValidationIssue {
  code: string;              // e.g., "TE-0102"
  message: string;           // Human-readable error
  location: {
    file: string;           // File path
    path: string;           // JSON Pointer (e.g., "/parameters/initialState")
    line?: number;          // Optional line number
    column?: number;        // Optional column
  };
  fixHint: string | null;   // Actionable suggestion
  severity: 'error' | 'warning' | 'info';
  details?: string;         // Additional context
  source?: string;          // Originating validator (ajv, zod, cli, etc.)
  domain?: string;          // Domain classification (trait, parameters, composition, runtime)
  docsUrl?: string;         // Optional remediation docs
  related?: string[];       // Related trait/parameter identifiers
  at?: string;              // Raw pointer (e.g., schema path)
}
```

### ✅ Error Formatters

Transforms raw validator errors into standardized ValidationIssue payloads:

- **AJV errors** → Maps keywords (required, type, pattern, etc.) to error codes with context-aware hints
- **Zod issues** → Maps issue codes (invalid_type, too_small, etc.) with smart hint generation
- **Custom validators** → Direct ValidationIssue creation

### ✅ Validation Pipeline

Orchestrates parameter, composition, and custom validators:

```typescript
const pipeline = new ValidationPipeline({ allErrors: true });

// Register AJV schema
pipeline.registerSchema('stateful', statefulSchema);

// Validate with schema
const result = pipeline.validateWithSchema('stateful', data);

// Validate with Zod
const result = pipeline.validateWithZod(zodSchema, data);

// Composition layer
const composed = compositor.compose(traits).data!;
const compositionResult = pipeline.validateComposition(composed);

// Custom validators
pipeline.registerValidator('lint', customValidator);

if (!compositionResult.valid) {
  // handle composition issues
}

// Inspect composition performance budget
const compositionValidator = pipeline.getCompositionValidator();
console.log(compositionValidator?.getLastDurationMs());
```

### ✅ Output Formats

#### Text (Human-Readable)
```
error[TE-0102]: Missing required field 'trait'
  --> traits/examples/invalid-trait.yaml/
  hint: Add a 'trait' field with the trait name

1 error
```

#### JSON (Machine-Readable)
```json
{
  "valid": false,
  "summary": { "errors": 1, "warnings": 0, "info": 0 },
  "issues": [...]
}
```

#### GitHub Actions Annotations
```
::error file=...,title=TE-0102: Missing...::Missing...
::notice::Validation completed: 1 error
```

### ✅ Composition Rule Coverage

- Collision summaries with actionable hints
- Dependency enforcement (errors) & optional dependency nudges (warnings)
- State machine ownership + transition integrity
- Token namespace existence checks for `tokenMap(...)`
- Canonical view region enforcement with schema-backed field references
- Semantic completeness validation for trait-provided fields

### ✅ CI Exit Codes

- `0` - Success (no errors)
- `1` - Errors found
- `2` - Warnings only

## CLI Usage

```bash
# Basic validation
yarn validate

# With options
yarn validate --path ./my-traits --verbose

# Different output formats
yarn validate --format json
yarn validate --format github --no-color

# Help
yarn validate --help
```

### CLI Options

- `-p, --path <dir>` - Path to traits directory (default: ./traits)
- `-f, --format <type>` - Output format: text, json, or github
- `-v, --verbose` - Show detailed information
- `--no-color` - Disable colored output
- `--no-hints` - Don't show fix hints
- `--no-codes` - Don't show error codes
- `--stop-on-error` - Stop on first error

## Programmatic API

```typescript
import {
  ValidationPipeline,
  formatAsText,
  formatAsJson,
  formatAsGitHubAnnotations,
} from './validation';

// Create pipeline
const pipeline = new ValidationPipeline({ allErrors: true });

// Validate
const result = pipeline.validateWithSchema('trait', data, {
  filePath: 'my-trait.yaml',
  allErrors: true,
});

// Format output
console.log(formatAsText(result, { color: true, showHints: true }));
console.log(formatAsJson(result, true));
console.log(formatAsGitHubAnnotations(result));

// Get exit code for CI
const exitCode = pipeline.getExitCode(result);
process.exit(exitCode);
```

## Dependencies

- `ajv` (^8.17.1) - JSON Schema validation
- `ajv-formats` (^3.0.1) - Additional format validators
- `zod` (^4.1.12) - TypeScript-first schema validation

## Future Enhancements

1. Trait-specific JSON Schemas (authoring ergonomics)
2. Runtime validation integration
3. Auto-generated documentation from schemas

## Testing

```bash
# Build
npm run build

# Test validation
npm run validate -- --path traits/examples --verbose

# Test different formats
npm run validate -- --format json
npm run validate -- --format github
```

## Examples

See `/app/examples/` for sample outputs in all formats.
