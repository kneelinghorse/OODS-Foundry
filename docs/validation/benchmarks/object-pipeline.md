# Object Pipeline Benchmarks

Date: 2025-10-16  
Environment: macOS (M3 Max, 64 GB RAM), Node.js 20.11, npm 10, warm filesystem cache.

## Method

1. Instantiate a single `ObjectRegistry` pointing at `objects/core`.
2. Build a reusable `TraitResolver` with roots `traits/` and `examples/traits/` plus `ParameterValidator`.
3. Resolve each Universal Quintet object once to populate the trait loader cache.
4. Resolve each object a second time and record `resolved.metadata.totalMs` (resolution + composition).

This mirrors the production CLI behaviour and ensures we measure steady-state latency. The totals exclude type generation, which runs synchronously after composition (see below).

## Results

| Object | Total (ms) | Budget |
| --- | --- | --- |
| Organization | 0 | < 100 ms |
| Product | 0 | < 100 ms |
| Relationship | 1 | < 100 ms |
| Transaction | 0 | < 100 ms |
| User | 0 | < 100 ms |

All objects stay well below the 100 ms per-object requirement after the initial warm-up. First-run timings (which include filesystem parsing) complete within ~40 ms and are dominated by YAML deserialization.

### Type Generation

Running `npm run object:generate -- --dry-run --quiet` (no file writes) completes in under 50 ms for the full quintet, largely because the generator reuses the same resolved objects from the registry loop.

### Re-running the Benchmark

Use the following snippet to revalidate performance after trait changes:

```ts
import path from 'node:path';
import { ObjectRegistry } from '../src/registry/registry.ts';
import { TraitResolver } from '../src/registry/resolver.ts';
import { TraitLoader } from '../src/registry/trait-loader.ts';
import { ParameterValidator } from '../src/validation/parameter-validator.ts';

const registry = new ObjectRegistry({ roots: [path.resolve('objects', 'core')], watch: false });
await registry.waitUntilReady();

const traitResolver = new TraitResolver({
  loader: new TraitLoader({ roots: [path.resolve('traits'), path.resolve('examples', 'traits')] }),
  validator: new ParameterValidator(),
  validateParameters: true,
});

const names = registry.list().map((record) => record.name).sort();
for (const name of names) {
  await registry.resolve(name, { traitResolver }); // warm cache
}
for (const name of names) {
  const resolved = await registry.resolve(name, { traitResolver });
  console.log(name, resolved.metadata.totalMs);
}

registry.close();
```

Record updated timings in the table whenever the object catalogue or trait stack changes meaningfully.
