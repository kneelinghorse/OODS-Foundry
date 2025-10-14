# Trait Compositor

The Trait Compositor is the heart of the Trait Engine, implementing deterministic trait composition with collision detection, resolution, and provenance tracking.

## Overview

The compositor merges multiple traits into a single composed object following a 5-layer merge cascade:

```
Foundation → Base Object → Traits (topo order) → Object Overrides → Context
```

## Key Features

- ✅ **Deterministic Composition** - Same input always produces same output
- ✅ **Automatic Dependency Resolution** - Traits are sorted topologically
- ✅ **Collision Detection & Resolution** - Smart merging with configurable policies
- ✅ **Provenance Tracking** - Know which trait contributed each field
- ✅ **Performance Monitoring** - Track composition performance
- ✅ **Multiple Report Formats** - ASCII, HTML, JSON, Mermaid diagrams

## Installation

The compositor is part of the `@oods/trait-engine` package:

```typescript
import { TraitCompositor, composeTraits } from '@oods/trait-engine';
```

## Quick Start

### Basic Composition

```typescript
import { composeTraits } from '@oods/trait-engine';
import type { TraitDefinition } from '@oods/trait-engine';

const TimestampedTrait: TraitDefinition = {
  trait: { name: 'Timestamped', version: '1.0.0' },
  schema: {
    created_at: { type: 'timestamp', required: true },
    updated_at: { type: 'timestamp', required: true },
  },
};

const result = composeTraits([TimestampedTrait]);

if (result.success) {
  console.log(result.data.schema);
  // { created_at: {...}, updated_at: {...} }
}
```

### Composition with Base Object

```typescript
const result = composeTraits(
  [TimestampedTrait, TaggableTrait],
  {
    id: 'user',
    name: 'User',
    schema: {
      id: { type: 'uuid', required: true },
      email: { type: 'email', required: true },
    },
  }
);
```

### Advanced Configuration

```typescript
import { TraitCompositor } from '@oods/trait-engine';

const compositor = new TraitCompositor({
  trackProvenance: true,
  trackPerformance: true,
  strictMode: false,
  collisionResolutions: {
    name: {
      strategy: 'prefer_trait',
      traitName: 'CustomTrait',
    },
  },
});

const result = compositor.compose([trait1, trait2]);
```

## Collision Resolution

The compositor automatically resolves field collisions using these rules:

### 1. Same Type → Prefer Stricter Constraints

```typescript
// Trait1
{ age: { type: 'number', validation: { min: 0 } } }

// Trait2
{ age: { type: 'number', validation: { min: 18 } } }

// Result: min: 18 (stricter)
```

### 2. Enum ∪ Enum → Union Values

```typescript
// Trait1
{ status: { type: 'string', validation: { enum: ['active', 'inactive'] } } }

// Trait2
{ status: { type: 'string', validation: { enum: ['pending', 'active'] } } }

// Result: enum: ['active', 'inactive', 'pending']
```

### 3. Optional vs Required → Required Wins

```typescript
// Trait1
{ email: { type: 'string', required: false } }

// Trait2
{ email: { type: 'string', required: true } }

// Result: required: true
```

### 4. Different Type → Error

```typescript
// Trait1
{ count: { type: 'number' } }

// Trait2
{ count: { type: 'string' } }

// Result: CompositionError - type mismatch
```

## Composition Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trackProvenance` | boolean | `true` | Track which trait contributed each field |
| `trackPerformance` | boolean | `false` | Monitor composition performance |
| `strictMode` | boolean | `false` | Fail on any warnings |
| `allowMultipleStateMachines` | boolean | `false` | Allow multiple state machines |
| `collisionResolutions` | object | `{}` | Manual collision resolution rules |

## Provenance Tracking

Track which trait contributed each field:

```typescript
const result = compositor.compose([trait1, trait2]);
const provenance = result.data.metadata.provenance;

for (const [fieldName, prov] of provenance.entries()) {
  console.log(`${fieldName} from ${prov.source}`);
}
```

## Report Generation

Generate comprehensive composition reports:

```typescript
import { generateFullVisualization } from '@oods/trait-engine/utils';

const viz = generateFullVisualization(composedObject);

// ASCII tables
console.log(viz.ascii.flow);
console.log(viz.ascii.provenance);
console.log(viz.ascii.collisions);

// Mermaid diagram
console.log(viz.mermaid);

// HTML report
fs.writeFileSync('report.html', viz.html);

// JSON export
fs.writeFileSync('schema.json', viz.json);
```

## Performance

Composition is highly efficient:

- ✅ **< 5ms** to compose 10 traits (target met)
- ✅ **O(V + E)** topological sort complexity
- ✅ **Linear** merge complexity per trait

Example performance metrics:

```typescript
const result = compositor.compose(traits);
const perf = result.data.metadata.performance;

console.log(`Duration: ${perf.durationMs}ms`);
console.log(`Fields: ${perf.fieldsProcessed}`);
console.log(`View Extensions: ${perf.viewExtensionsProcessed}`);
```

## Examples

### Subscription Object

Compose a subscription with multiple traits:

```bash
npx tsx examples/composed-objects/subscription.example.ts
```

Features:
- Stateful (status lifecycle)
- Cancellable (cancellation logic)
- Billable (payment tracking)

### User Object

Compose a user with ownership and tags:

```bash
npx tsx examples/composed-objects/user.example.ts
```

Features:
- Timestamped (creation/update tracking)
- Ownable (ownership tracking)
- Taggable (tag management)

### Product Object

Compose a product with inventory:

```bash
npx tsx examples/composed-objects/product.example.ts
```

Features:
- Colorized (color schemes)
- Priceable (pricing)
- Inventoried (stock tracking)
- Categorizable (categories)

### Full Demo

Run all examples with visualization:

```bash
npx tsx examples/composition-demo.ts
```

Generates reports in `examples/reports/`:
- HTML reports
- JSON schemas
- Mermaid diagrams

## Architecture

### Core Components

```
src/core/
├── compositor.ts              # Main composition engine
├── composed-object.ts         # Output types and interfaces
├── collision-resolver.ts      # Collision detection & resolution
└── merge-strategies/          # Field-specific merge logic
    ├── schema-merger.ts       # Schema merging
    ├── semantics-merger.ts    # Semantics merging
    ├── tokens-merger.ts       # Token merging
    ├── view-extensions-merger.ts
    └── actions-merger.ts
```

### Utilities

```
src/utils/
└── composition-visualizer.ts  # Report generation
```

## Testing

Run compositor tests:

```bash
npm test compositor.test.ts
```

Test coverage:
- ✅ 21 test cases
- ✅ All collision scenarios
- ✅ Dependency ordering
- ✅ State machine handling
- ✅ Provenance tracking
- ✅ Performance monitoring

## API Reference

### TraitCompositor

```typescript
class TraitCompositor {
  constructor(options?: CompositionOptions)

  compose(
    traits: TraitDefinition[],
    baseObject?: BaseObjectDefinition
  ): CompositionResult

  composeSchema(traits: TraitDefinition[]): Record<string, any> | null

  generateReport(composed: ComposedObject): string
}
```

### Convenience Functions

```typescript
// Quick composition without creating instance
function composeTraits(
  traits: TraitDefinition[],
  baseObject?: BaseObjectDefinition,
  options?: CompositionOptions
): CompositionResult

// Resolve single collision
function resolveCollision(
  fieldName: string,
  field1: SchemaField,
  field2: SchemaField,
  trait1: string,
  trait2: string,
  manualResolution?: ResolutionStrategy
): ResolutionResult
```

## Best Practices

### 1. Keep Traits Focused

Traits should have a single responsibility:

```typescript
// ✅ Good - focused trait
const TimestampedTrait = {
  trait: { name: 'Timestamped' },
  schema: {
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
};

// ❌ Bad - too many concerns
const EverythingTrait = {
  trait: { name: 'Everything' },
  schema: {
    created_at: { type: 'timestamp' },
    owner_id: { type: 'uuid' },
    tags: { type: 'array' },
    color: { type: 'string' },
    // ... too many fields
  },
};
```

### 2. Declare Dependencies

Always declare trait dependencies:

```typescript
const CancellableTrait = {
  trait: { name: 'Cancellable' },
  dependencies: ['Stateful'], // Required
  schema: {
    canceled_at: { type: 'timestamp' },
  },
};
```

### 3. Use Manual Resolutions for Predictability

For critical collisions, use manual resolutions:

```typescript
const compositor = new TraitCompositor({
  collisionResolutions: {
    name: { strategy: 'prefer_trait', traitName: 'CustomTrait' },
  },
});
```

### 4. Enable Performance Tracking in Development

```typescript
const compositor = new TraitCompositor({
  trackPerformance: true,
  trackProvenance: true,
});
```

## Migration Guide

### From Manual Composition

Before:

```typescript
const composed = {
  ...baseTrait,
  ...trait1,
  ...trait2,
  // Manual collision handling
};
```

After:

```typescript
const result = composeTraits([baseTrait, trait1, trait2]);
// Automatic collision handling with provenance
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Adding new merge strategies
- Extending collision resolution
- Writing tests
- Updating documentation

## License

MIT License - see [LICENSE](../LICENSE)
