# The Pure Modifier Pattern

Pure modifiers are the backbone of deterministic composition in the OODS view engine. A modifier is a synchronous function that receives the props for a rendered section and returns a partial set of props to merge. It must behave like a pure function: deterministic output, no side effects, and no mutation of its inputs.

## Canonical Signature

```ts
type Modifier<P extends object, C extends object = {}> = (props: P, context?: C) => Partial<P>;
```

Modifiers:

- **Do** read from `props` and optional `context` (often wrapping the `RenderContext`).
- **Return** a new object describing prop overrides; return `{}` when no change is needed.
- **Never** mutate the `props` argument or external state.

## Golden Path Example

```ts
// src/modifiers/withDensity.modifier.ts
const densityClassMap = {
  compact: 'is-compact',
  cozy: 'is-cozy',
  comfortable: 'is-comfortable',
} as const;

export const withDensity = (props: { className?: string; density?: keyof typeof densityClassMap }) => {
  const density = props.density ?? 'comfortable';
  const densityClass = densityClassMap[density];
  const className = [props.className, densityClass].filter(Boolean).join(' ');
  return { className };
};
```

The modifier returns a derived `className` without mutating the incoming props or touching external globals.

## Developer Checklist

Before opening a pull request, confirm the following:

- [ ] Produces the same output for the same input (no randomness or time-based logic).
- [ ] Does **not** mutate `props` or `context`.
- [ ] Returns a new object; never return the input reference.
- [ ] Avoids all side effects (`fetch`, `console.log`, `document`, `Math.random`, `new Date`, etc.).
- [ ] Does **not** call React Hooks (`useState`, `useEffect`, custom hooks).
- [ ] Covered by `validateModifierPurity` tests (see below).

## Forbidden Anti-Patterns

- **Prop mutation**: `props.className += 'new'`.
- **Global state**: reading or writing `window`, `document`, `localStorage`, feature flags, or module-level variables.
- **I/O or side effects**: network requests, analytics pushes, logging.
- **Non-determinism**: `Math.random()`, `crypto.randomUUID()`, `new Date()`, `performance.now()`.
- **Hooks**: any function whose name starts with `use` (enforced by `oods/no-hooks-in-modifiers` ESLint rule).
- **DOM mutation**: directly touching the DOM or triggering layout.

## When to Use a Behavioral Trait Instead

Move logic into a behavioral trait if it requires:

- Managing state (`useState`, `useReducer`).
- Responding to lifecycle effects (`useEffect`, subscriptions, timers).
- Handling analytics or other side effects.
- Imperative DOM operations or animations.
- Data fetching or async workflows.

A modifier should never be responsible for these behaviours.

## Testing With `validateModifierPurity`

All modifiers must include a unit test that uses the purity harness:

```ts
import { describe, expect, it } from 'vitest';
import { validateModifierPurity } from '@/compositor/tests/purityHarness';
import { withDensity } from './withDensity.modifier';

describe('withDensity modifier', () => {
  it('is pure and deterministic', () => {
    const result = validateModifierPurity(withDensity, { className: 'button', density: 'compact' });
    expect(result.className).toBe('button is-compact');
  });
});
```

`validateModifierPurity` clones inputs, runs the modifier twice, and ensures outputs do not mutate or diverge. Pair this with the lint rule to catch violations before code review.

## Related Resources

- `app/src/compositor/tests/purityHarness.ts` — runtime purity assertions.
- `eslint.config.cjs` — includes the `oods/no-hooks-in-modifiers` rule configuration.
- `missions/research/r3.2_Pure Modifier Pattern.md` — architectural rationale and enforcement strategy.
