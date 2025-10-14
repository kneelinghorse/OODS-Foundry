# Composition Validator

The composition validator enforces cross-trait rules after parameters are validated. It uses Zod with modular rule helpers to catch logical conflicts that emerge only once traits are composed together.

## What It Checks

- **Schema collisions** – reports conflicting field definitions and highlights how they were resolved (`TE-0301`).
- **Dependency satisfaction** – ensures required traits are present and flags missing optional traits as warnings (`TE-0303`).
- **State machine ownership** – limits a composition to a single owning trait and validates transition integrity (`TE-0305`).
- **Token coverage** – verifies semantic `tokenMap(...)` references point to exported token namespaces (`TE-0306`).
- **View extensions** – guards against non-canonical regions and broken field bindings (`TE-0307`).
- **Semantic completeness** – prevents orphaned fields without semantic metadata and catches mappings pointing to unknown fields (`TE-0308`).

## Using In the Pipeline

```ts
import { ValidationPipeline } from '../src/validation';

const pipeline = new ValidationPipeline();
const composed = compositor.compose(traits).data!;

const compositionResult = pipeline.validateComposition(composed, {
  filePath: 'compositions/subscription.json',
});

if (!compositionResult.valid) {
  // Turn structured issues into CLI output or CI annotations.
}
```

You can inject a customised validator when constructing the pipeline:

```ts
const pipeline = new ValidationPipeline({
  compositionValidator: { performanceTargetMs: 25 },
});

// or supply a fully customised instance later
pipeline.useCompositionValidator(new CompositionValidator({ performanceTargetMs: 10 }));
```

## Rule Helpers

Each rule lives under `src/validation/rules/`. They expose a small `RuleIssue` interface so new checks can be added without touching the validator core. Complex helpers (token flattening, provenance, etc.) live in `src/validation/zod-transformer.ts`.

## Error Payloads

All rule violations are converted to `ValidationIssue` objects with actionable hints. Zod issues store extra metadata in `issue.params`, which the formatter maps into error codes, hints, docs links, and related trait identifiers.

## Performance

The validator tracks the duration of the most recent run (`getLastDurationMs()`) and compares it to a configurable budget (`performanceTargetMs`, default 50 ms). The Vitest suite includes a baseline test to prevent regressions.

---

For a deeper dive into the rule implementations or to add new checks, start with `src/validation/composition-rules.ts` and extend the helper modules in `src/validation/rules/`.
